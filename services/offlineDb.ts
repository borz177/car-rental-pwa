import { openDB, IDBPDatabase, DBSchema } from 'idb';
import { Car, Client, Rental, Transaction, Investor, Staff, Fine, BookingRequest, User } from '../types';

export type CollectionStore =
  | 'cars' | 'clients' | 'rentals' | 'transactions'
  | 'investors' | 'staff' | 'fines' | 'requests';

interface Entity { id: string }

export interface QueuedMutation {
  id?: number;
  resource: CollectionStore;
  methodName: string;
  args: any[];
  tempId?: string;
  createdAt: number;
}

interface AutoProDB extends DBSchema {
  cars: { key: string; value: Car };
  clients: { key: string; value: Client };
  rentals: { key: string; value: Rental };
  transactions: { key: string; value: Transaction };
  investors: { key: string; value: Investor };
  staff: { key: string; value: Staff };
  fines: { key: string; value: Fine };
  requests: { key: string; value: BookingRequest };
  meta: { key: string; value: any };
  mutationQueue: { key: number; value: QueuedMutation };
}

const DB_NAME = 'autopro-offline-db';
const DB_VERSION = 1;
const COLLECTIONS: CollectionStore[] = [
  'cars', 'clients', 'rentals', 'transactions', 'investors', 'staff', 'fines', 'requests'
];

let dbPromise: Promise<IDBPDatabase<AutoProDB>> | null = null;

function getDb() {
  if (!dbPromise) {
    dbPromise = openDB<AutoProDB>(DB_NAME, DB_VERSION, {
      upgrade(db) {
        for (const store of COLLECTIONS) {
          if (!db.objectStoreNames.contains(store)) {
            db.createObjectStore(store, { keyPath: 'id' });
          }
        }
        if (!db.objectStoreNames.contains('meta')) {
          db.createObjectStore('meta');
        }
        if (!db.objectStoreNames.contains('mutationQueue')) {
          db.createObjectStore('mutationQueue', { keyPath: 'id', autoIncrement: true });
        }
      }
    });
  }
  return dbPromise;
}

export async function getAll<T extends Entity>(store: CollectionStore): Promise<T[]> {
  const db = await getDb();
  return db.getAll(store) as unknown as Promise<T[]>;
}

export async function getOne<T extends Entity>(store: CollectionStore, id: string): Promise<T | undefined> {
  const db = await getDb();
  return db.get(store, id) as unknown as Promise<T | undefined>;
}

export async function put<T extends Entity>(store: CollectionStore, item: T): Promise<void> {
  const db = await getDb();
  await db.put(store, item as any);
}

export async function remove(store: CollectionStore, id: string): Promise<void> {
  const db = await getDb();
  await db.delete(store, id);
}

// Replaces the full contents of a store with a fresh server list, while preserving
// any record that's still waiting in the mutation queue to be synced (so an
// offline-created car doesn't vanish from the UI just because loadData() refetched).
export async function replaceAll<T extends Entity>(store: CollectionStore, items: T[]): Promise<void> {
  const db = await getDb();
  const queue = await getQueue();
  const pendingTempIds = queue.filter(q => q.resource === store && q.tempId).map(q => q.tempId!);

  const tx = db.transaction(store, 'readwrite');
  const preserved: T[] = [];
  for (const id of pendingTempIds) {
    const rec = await tx.store.get(id);
    if (rec) preserved.push(rec as unknown as T);
  }
  await tx.store.clear();
  for (const item of items) await tx.store.put(item as any);
  for (const item of preserved) await tx.store.put(item as any);
  await tx.done;
}

export async function getMeta<T = any>(key: string): Promise<T | undefined> {
  const db = await getDb();
  return db.get('meta', key);
}

export async function setMeta(key: string, value: any): Promise<void> {
  const db = await getDb();
  if (value === null || value === undefined) {
    await db.delete('meta', key);
  } else {
    await db.put('meta', value, key);
  }
}

export async function enqueueMutation(mutation: Omit<QueuedMutation, 'id'>): Promise<void> {
  const db = await getDb();
  await db.add('mutationQueue', mutation as QueuedMutation);
}

export async function getQueue(): Promise<QueuedMutation[]> {
  const db = await getDb();
  const all = await db.getAll('mutationQueue');
  return all.sort((a, b) => a.createdAt - b.createdAt);
}

export async function dequeueMutation(id: number): Promise<void> {
  const db = await getDb();
  await db.delete('mutationQueue', id);
}

// A delete arriving for a record that was created offline and never synced —
// cancel the pending create instead of queuing a delete the server has never heard of.
export async function cancelQueuedCreate(store: CollectionStore, tempId: string): Promise<void> {
  const db = await getDb();
  const tx = db.transaction('mutationQueue', 'readwrite');
  let cursor = await tx.store.openCursor();
  while (cursor) {
    if (cursor.value.resource === store && cursor.value.tempId === tempId) {
      await cursor.delete();
    }
    cursor = await cursor.continue();
  }
  await tx.done;
}
