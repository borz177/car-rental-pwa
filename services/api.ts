
import { Car, User, Rental, Client, Transaction, Investor, Staff, Fine, BookingRequest } from '../types';

class BackendAPI {
  private static BASE_URL = '/api';

  private static getHeaders() {
    const token = localStorage.getItem('autopro_token');
    return {
      'Content-Type': 'application/json',
      'Authorization': token ? `Bearer ${token}` : ''
    };
  }

  private static isNewId(id?: string): boolean {
    if (!id) return true;
    // UUID v4 regex check. If it's not a valid UUID, we treat it as a new/temp record.
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return !uuidRegex.test(id);
  }

  private static async handleResponse(response: Response) {
    if (response.status === 401) {
      BackendAPI.logout();
      window.location.reload();
      throw new Error('Сессия истекла. Пожалуйста, войдите снова.');
    }

    const data = await response.json();
    if (!response.ok) {
      throw new Error(data.message || 'Ошибка сервера');
    }
    return data;
  }

  // --- AUTHENTICATION ---
  static async login(credentials: Partial<User>): Promise<User> {
    const response = await fetch(`${BackendAPI.BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });

    const data = await BackendAPI.handleResponse(response);
    if (data.token) {
      localStorage.setItem('autopro_token', data.token);
    }
    return data.user;
  }

  static async register(userData: Partial<User>): Promise<User> {
    const response = await fetch(`${BackendAPI.BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    return BackendAPI.handleResponse(response);
  }

  static async getCurrentUser(): Promise<User | null> {
    const token = localStorage.getItem('autopro_token');
    if (!token) return null;

    try {
      const response = await fetch(`${BackendAPI.BASE_URL}/auth/me`, {
        headers: BackendAPI.getHeaders()
      });
      return await BackendAPI.handleResponse(response);
    } catch (e) {
      return null;
    }
  }

  static logout() {
    localStorage.removeItem('autopro_token');
  }

  // --- CARS ---
  static async getCars(): Promise<Car[]> {
    const response = await fetch(`${BackendAPI.BASE_URL}/cars`, {
      headers: BackendAPI.getHeaders()
    });
    return BackendAPI.handleResponse(response);
  }

  static async saveCar(car: Car): Promise<Car> {
    const isNew = BackendAPI.isNewId(car.id);
    const url = isNew ? `${BackendAPI.BASE_URL}/cars` : `${BackendAPI.BASE_URL}/cars/${car.id}`;

    const response = await fetch(url, {
      method: isNew ? 'POST' : 'PUT',
      headers: BackendAPI.getHeaders(),
      body: JSON.stringify(car)
    });
    return BackendAPI.handleResponse(response);
  }

  static async deleteCar(id: string): Promise<void> {
    const response = await fetch(`${BackendAPI.BASE_URL}/cars/${id}`, {
      method: 'DELETE',
      headers: BackendAPI.getHeaders()
    });
    await BackendAPI.handleResponse(response);
  }

  // --- CLIENTS ---
  static async getClients(): Promise<Client[]> {
    const response = await fetch(`${BackendAPI.BASE_URL}/clients`, {
      headers: BackendAPI.getHeaders()
    });
    return BackendAPI.handleResponse(response);
  }

  static async saveClient(client: Client): Promise<Client> {
    const isNew = BackendAPI.isNewId(client.id);
    const url = isNew ? `${BackendAPI.BASE_URL}/clients` : `${BackendAPI.BASE_URL}/clients/${client.id}`;

    const response = await fetch(url, {
      method: isNew ? 'POST' : 'PUT',
      headers: BackendAPI.getHeaders(),
      body: JSON.stringify(client)
    });
    return BackendAPI.handleResponse(response);
  }

  static async deleteClient(id: string): Promise<void> {
    const response = await fetch(`${BackendAPI.BASE_URL}/clients/${id}`, {
      method: 'DELETE',
      headers: BackendAPI.getHeaders()
    });
    await BackendAPI.handleResponse(response);
  }

  // --- RENTALS ---
  static async getRentals(): Promise<Rental[]> {
    const response = await fetch(`${BackendAPI.BASE_URL}/rentals`, {
      headers: BackendAPI.getHeaders()
    });
    return BackendAPI.handleResponse(response);
  }

  static async saveRental(rental: Rental): Promise<Rental> {
    const isNew = BackendAPI.isNewId(rental.id);
    const url = isNew ? `${BackendAPI.BASE_URL}/rentals` : `${BackendAPI.BASE_URL}/rentals/${rental.id}`;

    const response = await fetch(url, {
      method: isNew ? 'POST' : 'PUT',
      headers: BackendAPI.getHeaders(),
      body: JSON.stringify(rental)
    });
    return BackendAPI.handleResponse(response);
  }

  static async deleteRental(id: string): Promise<void> {
    const response = await fetch(`${BackendAPI.BASE_URL}/rentals/${id}`, {
      method: 'DELETE',
      headers: BackendAPI.getHeaders()
    });
    await BackendAPI.handleResponse(response);
  }

  // --- TRANSACTIONS ---
  static async getTransactions(): Promise<Transaction[]> {
    const response = await fetch(`${BackendAPI.BASE_URL}/transactions`, {
      headers: BackendAPI.getHeaders()
    });
    return BackendAPI.handleResponse(response);
  }

  static async saveTransaction(transaction: Transaction): Promise<Transaction> {
    const response = await fetch(`${BackendAPI.BASE_URL}/transactions`, {
      method: 'POST',
      headers: BackendAPI.getHeaders(),
      body: JSON.stringify(transaction)
    });
    return BackendAPI.handleResponse(response);
  }

  // --- INVESTORS ---
  static async getInvestors(): Promise<Investor[]> {
    const response = await fetch(`${BackendAPI.BASE_URL}/investors`, {
      headers: BackendAPI.getHeaders()
    });
    return BackendAPI.handleResponse(response);
  }

  static async saveInvestor(investor: Investor): Promise<Investor> {
    const isNew = BackendAPI.isNewId(investor.id);
    const url = isNew ? `${BackendAPI.BASE_URL}/investors` : `${BackendAPI.BASE_URL}/investors/${investor.id}`;

    const response = await fetch(url, {
      method: isNew ? 'POST' : 'PUT',
      headers: BackendAPI.getHeaders(),
      body: JSON.stringify(investor)
    });
    return BackendAPI.handleResponse(response);
  }

  static async deleteInvestor(id: string): Promise<void> {
    const response = await fetch(`${BackendAPI.BASE_URL}/investors/${id}`, {
      method: 'DELETE',
      headers: BackendAPI.getHeaders()
    });
    await BackendAPI.handleResponse(response);
  }

  // --- STAFF ---
  static async getStaff(): Promise<Staff[]> {
    const response = await fetch(`${BackendAPI.BASE_URL}/staff`, {
      headers: BackendAPI.getHeaders()
    });
    return BackendAPI.handleResponse(response);
  }

  static async saveStaff(staff: Staff): Promise<Staff> {
    const isNew = BackendAPI.isNewId(staff.id);
    const url = isNew ? `${BackendAPI.BASE_URL}/staff` : `${BackendAPI.BASE_URL}/staff/${staff.id}`;

    const response = await fetch(url, {
      method: isNew ? 'POST' : 'PUT',
      headers: BackendAPI.getHeaders(),
      body: JSON.stringify(staff)
    });
    return BackendAPI.handleResponse(response);
  }

  static async deleteStaff(id: string): Promise<void> {
    const response = await fetch(`${BackendAPI.BASE_URL}/staff/${id}`, {
      method: 'DELETE',
      headers: BackendAPI.getHeaders()
    });
    await BackendAPI.handleResponse(response);
  }

  // --- FINES ---
  static async getFines(): Promise<Fine[]> {
    const response = await fetch(`${BackendAPI.BASE_URL}/fines`, {
      headers: BackendAPI.getHeaders()
    });
    return BackendAPI.handleResponse(response);
  }

  static async saveFine(fine: Fine): Promise<Fine> {
    const response = await fetch(`${BackendAPI.BASE_URL}/fines`, {
      method: 'POST',
      headers: BackendAPI.getHeaders(),
      body: JSON.stringify(fine)
    });
    return BackendAPI.handleResponse(response);
  }

  static async payFine(id: string): Promise<Fine> {
    const response = await fetch(`${BackendAPI.BASE_URL}/fines/${id}/pay`, {
      method: 'PATCH',
      headers: BackendAPI.getHeaders()
    });
    return BackendAPI.handleResponse(response);
  }

  // --- REQUESTS ---
  static async getRequests(): Promise<BookingRequest[]> {
    const response = await fetch(`${BackendAPI.BASE_URL}/requests`, {
      headers: BackendAPI.getHeaders()
    });
    return BackendAPI.handleResponse(response);
  }

  static async saveRequest(request: BookingRequest): Promise<BookingRequest> {
    const isNew = BackendAPI.isNewId(request.id);
    const url = isNew ? `${BackendAPI.BASE_URL}/requests` : `${BackendAPI.BASE_URL}/requests/${request.id}`;
    
    const response = await fetch(url, {
      method: isNew ? 'POST' : 'PUT',
      headers: BackendAPI.getHeaders(),
      body: JSON.stringify(request)
    });
    return BackendAPI.handleResponse(response);
  }

  static async deleteRequest(id: string): Promise<void> {
    const response = await fetch(`${BackendAPI.BASE_URL}/requests/${id}`, {
      method: 'DELETE',
      headers: BackendAPI.getHeaders()
    });
    await BackendAPI.handleResponse(response);
  }

  // --- SUPERADMIN ---
  static async getAllUsers(): Promise<User[]> {
    const response = await fetch(`${BackendAPI.BASE_URL}/admin/users`, {
      headers: BackendAPI.getHeaders()
    });
    return BackendAPI.handleResponse(response);
  }

  static async updateGlobalUser(id: string, updates: Partial<User>): Promise<User> {
    const response = await fetch(`${BackendAPI.BASE_URL}/admin/users/${id}`, {
      method: 'PATCH',
      headers: BackendAPI.getHeaders(),
      body: JSON.stringify(updates)
    });
    return BackendAPI.handleResponse(response);
  }

  static async deleteGlobalUser(id: string): Promise<void> {
    const response = await fetch(`${BackendAPI.BASE_URL}/admin/users/${id}`, {
      method: 'DELETE',
      headers: BackendAPI.getHeaders()
    });
    await BackendAPI.handleResponse(response);
  }

  // --- IMAGE COMPRESSION ---
  static compressImage(file: File): Promise<string> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onerror = () => reject(new Error('Failed to read file'));
      reader.readAsDataURL(file);
      reader.onload = (event) => {
        const img = new Image();
        img.src = event.target?.result as string;
        img.onerror = () => reject(new Error('Failed to load image'));
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const MAX_WIDTH = 1200;
          let width = img.width;
          let height = img.height;
          if (width > MAX_WIDTH) {
            height *= MAX_WIDTH / width;
            width = MAX_WIDTH;
          }
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);
          resolve(canvas.toDataURL('image/jpeg', 0.8));
        };
      };
    });
  }
}

export default BackendAPI;
