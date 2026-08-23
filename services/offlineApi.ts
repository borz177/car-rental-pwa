import BackendAPI from './api';
import * as db from './offlineDb';
import { CollectionStore } from './offlineDb';
import { Car, Client, Rental, Transaction, Investor, Staff, Fine, FineStatus, BookingRequest, User } from '../types';

// Drop-in replacement for BackendAPI: same static method names/signatures.
// Reads fall back to the local IndexedDB cache when the network is unreachable;
// writes apply an optimistic local update and queue for replay on reconnect.

function isOfflineError(e: any): boolean {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return true;
  // fetch() rejects with a generic TypeError when there's no network/DNS/connection refused.
  return e instanceof TypeError;
}

function genTempId(): string {
  return `offline-${crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random().toString(36).slice(2)}`}`;
}

async function fetchAndCache<T extends { id: string }>(
  store: CollectionStore,
  networkCall: () => Promise<T[]>
): Promise<T[]> {
  try {
    const data = await networkCall();
    await db.replaceAll(store, data);
    return data;
  } catch (e) {
    if (!isOfflineError(e)) throw e;
    return db.getAll<T>(store);
  }
}

// For resources that can be both created (id === '') and updated (id present): cars, clients, rentals, investors, staff.
async function saveEntity<T extends { id: string }>(
  store: CollectionStore,
  methodName: string,
  entity: T,
  networkCall: () => Promise<T>
): Promise<T> {
  try {
    const result = await networkCall();
    await db.put(store, result);
    return result;
  } catch (e) {
    if (!isOfflineError(e)) throw e;
    const isCreate = !entity.id;
    const optimistic = isCreate ? { ...entity, id: genTempId() } : entity;
    await db.put(store, optimistic);
    await db.enqueueMutation({
      resource: store,
      methodName,
      args: [entity],
      tempId: isCreate ? optimistic.id : undefined,
      createdAt: Date.now()
    });
    return optimistic;
  }
}

// For resources that are only ever created (no edit flow): transactions, fines.
async function createEntity<T extends { id: string }>(
  store: CollectionStore,
  methodName: string,
  args: any[],
  optimisticBase: Partial<T>,
  networkCall: () => Promise<T>
): Promise<T> {
  try {
    const result = await networkCall();
    await db.put(store, result);
    return result;
  } catch (e) {
    if (!isOfflineError(e)) throw e;
    const optimistic = { ...optimisticBase, id: genTempId() } as T;
    await db.put(store, optimistic);
    await db.enqueueMutation({ resource: store, methodName, args, tempId: optimistic.id, createdAt: Date.now() });
    return optimistic;
  }
}

async function deleteEntity(
  store: CollectionStore,
  methodName: string,
  id: string,
  networkCall: () => Promise<void>
): Promise<void> {
  if (id.startsWith('offline-')) {
    // Never reached the server — cancel the pending create instead of queuing a delete for an unknown id.
    await db.cancelQueuedCreate(store, id);
    await db.remove(store, id);
    return;
  }
  try {
    await networkCall();
    await db.remove(store, id);
  } catch (e) {
    if (!isOfflineError(e)) throw e;
    await db.remove(store, id);
    await db.enqueueMutation({ resource: store, methodName, args: [id], createdAt: Date.now() });
  }
}

export default class OfflineAPI {
  // --- Passthroughs: require a live network by nature, or out of scope for offline use ---
  static getPublicFleet = BackendAPI.getPublicFleet;
  static submitBookingRequest = BackendAPI.submitBookingRequest;
  static login = BackendAPI.login;
  static register = BackendAPI.register;
  static logout = BackendAPI.logout;
  static verifyEmail = BackendAPI.verifyEmail;
  static resendVerification = BackendAPI.resendVerification;
  static forgotPassword = BackendAPI.forgotPassword;
  static resetPassword = BackendAPI.resetPassword;
  static getAllUsers = BackendAPI.getAllUsers;
  static updateGlobalUser = BackendAPI.updateGlobalUser;
  static deleteGlobalUser = BackendAPI.deleteGlobalUser;
  static compressImage = BackendAPI.compressImage;

  // --- Auth: cache the current user so a returning offline session lands on the fleet, not the login screen ---
  // Note: BackendAPI.getCurrentUser() swallows network errors and returns null itself, so it can't be used
  // here directly — a real fetch is needed to tell "offline" apart from an actual 401.
  static async getCurrentUser(): Promise<User | null> {
    if (!localStorage.getItem('token')) return null;
    try {
      const response = await fetch(`${(BackendAPI as any).BASE_URL}/auth/me`, {
        headers: (BackendAPI as any).getHeaders()
      });
      if (response.status === 401) {
        await db.setMeta('user', null);
        return null;
      }
      const user = await (BackendAPI as any).handleResponse(response);
      await db.setMeta('user', user);
      return user;
    } catch (e) {
      // Network failure (offline, DNS, connection refused) — fall back to the last-known cached user
      // rather than forcing a re-login.
      const cached = await db.getMeta<User>('user');
      return cached ?? null;
    }
  }

  // --- Cars ---
  static getCars = () => fetchAndCache<Car>('cars', BackendAPI.getCars);
  static saveCar = (car: Car) => saveEntity('cars', 'saveCar', car, () => BackendAPI.saveCar(car));
  static deleteCar = (id: string) => deleteEntity('cars', 'deleteCar', id, () => BackendAPI.deleteCar(id));

  // --- Clients ---
  static getClients = () => fetchAndCache<Client>('clients', BackendAPI.getClients);
  static saveClient = (client: Client) => saveEntity('clients', 'saveClient', client, () => BackendAPI.saveClient(client));
  static deleteClient = (id: string) => deleteEntity('clients', 'deleteClient', id, () => BackendAPI.deleteClient(id));

  // --- Rentals ---
  static getRentals = () => fetchAndCache<Rental>('rentals', BackendAPI.getRentals);
  static saveRental = (rental: Rental) => saveEntity('rentals', 'saveRental', rental, () => BackendAPI.saveRental(rental));
  static deleteRental = (id: string) => deleteEntity('rentals', 'deleteRental', id, () => BackendAPI.deleteRental(id));

  // --- Transactions (create-only ledger) ---
  static getTransactions = () => fetchAndCache<Transaction>('transactions', BackendAPI.getTransactions);
  static saveTransaction = (tx: Partial<Transaction>, clientId?: string) =>
    createEntity<Transaction>('transactions', 'saveTransaction', [tx, clientId], tx, () => BackendAPI.saveTransaction(tx, clientId));

  // --- Investors ---
  static getInvestors = () => fetchAndCache<Investor>('investors', BackendAPI.getInvestors);
  static saveInvestor = (investor: Investor) => saveEntity('investors', 'saveInvestor', investor, () => BackendAPI.saveInvestor(investor));
  static deleteInvestor = (id: string) => deleteEntity('investors', 'deleteInvestor', id, () => BackendAPI.deleteInvestor(id));

  // --- Staff ---
  static getStaff = () => fetchAndCache<Staff>('staff', BackendAPI.getStaff);
  static saveStaff = (staff: Staff) => saveEntity('staff', 'saveStaff', staff, () => BackendAPI.saveStaff(staff));
  static deleteStaff = (id: string) => deleteEntity('staff', 'deleteStaff', id, () => BackendAPI.deleteStaff(id));

  // --- Fines (create-only, plus a dedicated pay action) ---
  static getFines = () => fetchAndCache<Fine>('fines', BackendAPI.getFines);
  static saveFine = (fine: Partial<Fine>) =>
    createEntity<Fine>('fines', 'saveFine', [fine], fine, () => BackendAPI.saveFine(fine));
  static async payFine(id: string): Promise<void> {
    try {
      await BackendAPI.payFine(id);
      const fine = await db.getOne<Fine>('fines', id);
      if (fine) await db.put('fines', { ...fine, status: FineStatus.PAID });
    } catch (e) {
      if (!isOfflineError(e)) throw e;
      const fine = await db.getOne<Fine>('fines', id);
      if (fine) await db.put('fines', { ...fine, status: FineStatus.PAID });
      await db.enqueueMutation({ resource: 'fines', methodName: 'payFine', args: [id], createdAt: Date.now() });
    }
  }

  // --- Requests ---
  static getRequests = () => fetchAndCache<BookingRequest>('requests', BackendAPI.getRequests);
  static deleteRequest = (id: string, action?: 'APPROVE' | 'REJECT') => {
    // Approve/reject has server-side side effects (approving creates a client + reservation rental) —
    // always requires a live network rather than an offline-optimistic guess.
    if (action) return BackendAPI.deleteRequest(id, action);
    return deleteEntity('requests', 'deleteRequest', id, () => BackendAPI.deleteRequest(id));
  };
}
