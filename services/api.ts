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

  private static async handleResponse(response: Response) {
    if (response.status === 401) {
      this.logout();
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
    const response = await fetch(`${this.BASE_URL}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials)
    });
    
    const data = await this.handleResponse(response);
    if (data.token) {
      localStorage.setItem('autopro_token', data.token);
    }
    return data.user;
  }

  static async register(userData: Partial<User>): Promise<User> {
    const response = await fetch(`${this.BASE_URL}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(userData)
    });
    return this.handleResponse(response);
  }

  static async getCurrentUser(): Promise<User | null> {
    const token = localStorage.getItem('autopro_token');
    if (!token) return null;

    try {
      const response = await fetch(`${this.BASE_URL}/auth/me`, {
        headers: this.getHeaders()
      });
      return await this.handleResponse(response);
    } catch (e) {
      return null;
    }
  }

  static logout() {
    localStorage.removeItem('autopro_token');
  }

  // --- CARS ---
  static async getCars(): Promise<Car[]> {
    const response = await fetch(`${this.BASE_URL}/cars`, {
      headers: this.getHeaders()
    });
    return this.handleResponse(response);
  }

  static async saveCar(car: Car): Promise<Car> {
    const isNew = !car.id || car.id.startsWith('temp-');
    const url = isNew ? `${this.BASE_URL}/cars` : `${this.BASE_URL}/cars/${car.id}`;
    
    const response = await fetch(url, {
      method: isNew ? 'POST' : 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(car)
    });
    return this.handleResponse(response);
  }

  static async deleteCar(id: string): Promise<void> {
    const response = await fetch(`${this.BASE_URL}/cars/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    await this.handleResponse(response);
  }

  // --- CLIENTS ---
  static async getClients(): Promise<Client[]> {
    const response = await fetch(`${this.BASE_URL}/clients`, {
      headers: this.getHeaders()
    });
    return this.handleResponse(response);
  }

  static async saveClient(client: Client): Promise<Client> {
    const isNew = !client.id;
    const url = isNew ? `${this.BASE_URL}/clients` : `${this.BASE_URL}/clients/${client.id}`;
    
    const response = await fetch(url, {
      method: isNew ? 'POST' : 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(client)
    });
    return this.handleResponse(response);
  }

  static async deleteClient(id: string): Promise<void> {
    const response = await fetch(`${this.BASE_URL}/clients/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    await this.handleResponse(response);
  }

  // --- RENTALS ---
  static async getRentals(): Promise<Rental[]> {
    const response = await fetch(`${this.BASE_URL}/rentals`, {
      headers: this.getHeaders()
    });
    return this.handleResponse(response);
  }

  static async saveRental(rental: Rental): Promise<Rental> {
    const isNew = !rental.id;
    const url = isNew ? `${this.BASE_URL}/rentals` : `${this.BASE_URL}/rentals/${rental.id}`;
    
    const response = await fetch(url, {
      method: isNew ? 'POST' : 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(rental)
    });
    return this.handleResponse(response);
  }

  static async deleteRental(id: string): Promise<void> {
    const response = await fetch(`${this.BASE_URL}/rentals/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    await this.handleResponse(response);
  }

  // --- TRANSACTIONS ---
  static async getTransactions(): Promise<Transaction[]> {
    const response = await fetch(`${this.BASE_URL}/transactions`, {
      headers: this.getHeaders()
    });
    return this.handleResponse(response);
  }

  static async saveTransaction(transaction: Transaction): Promise<Transaction> {
    const response = await fetch(`${this.BASE_URL}/transactions`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(transaction)
    });
    return this.handleResponse(response);
  }

  // --- INVESTORS ---
  static async getInvestors(): Promise<Investor[]> {
    const response = await fetch(`${this.BASE_URL}/investors`, {
      headers: this.getHeaders()
    });
    return this.handleResponse(response);
  }

  static async saveInvestor(investor: Investor): Promise<Investor> {
    const isNew = !investor.id;
    const url = isNew ? `${this.BASE_URL}/investors` : `${this.BASE_URL}/investors/${investor.id}`;
    
    const response = await fetch(url, {
      method: isNew ? 'POST' : 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(investor)
    });
    return this.handleResponse(response);
  }

  static async deleteInvestor(id: string): Promise<void> {
    const response = await fetch(`${this.BASE_URL}/investors/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    await this.handleResponse(response);
  }

  // --- STAFF ---
  static async getStaff(): Promise<Staff[]> {
    const response = await fetch(`${this.BASE_URL}/staff`, {
      headers: this.getHeaders()
    });
    return this.handleResponse(response);
  }

  static async saveStaff(staff: Staff): Promise<Staff> {
    const isNew = !staff.id;
    const url = isNew ? `${this.BASE_URL}/staff` : `${this.BASE_URL}/staff/${staff.id}`;
    
    const response = await fetch(url, {
      method: isNew ? 'POST' : 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(staff)
    });
    return this.handleResponse(response);
  }

  static async deleteStaff(id: string): Promise<void> {
    const response = await fetch(`${this.BASE_URL}/staff/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    await this.handleResponse(response);
  }

  // --- FINES ---
  static async getFines(): Promise<Fine[]> {
    const response = await fetch(`${this.BASE_URL}/fines`, {
      headers: this.getHeaders()
    });
    return this.handleResponse(response);
  }

  static async saveFine(fine: Fine): Promise<Fine> {
    const response = await fetch(`${this.BASE_URL}/fines`, {
      method: 'POST',
      headers: this.getHeaders(),
      body: JSON.stringify(fine)
    });
    return this.handleResponse(response);
  }

  static async payFine(id: string): Promise<Fine> {
    const response = await fetch(`${this.BASE_URL}/fines/${id}/pay`, {
      method: 'PATCH',
      headers: this.getHeaders()
    });
    return this.handleResponse(response);
  }

  // --- REQUESTS ---
  static async getRequests(): Promise<BookingRequest[]> {
    const response = await fetch(`${this.BASE_URL}/requests`, {
      headers: this.getHeaders()
    });
    return this.handleResponse(response);
  }

  static async saveRequest(request: BookingRequest): Promise<BookingRequest> {
    const isNew = !request.id;
    const url = isNew ? `${this.BASE_URL}/requests` : `${this.BASE_URL}/requests/${request.id}`;
    
    const response = await fetch(url, {
      method: isNew ? 'POST' : 'PUT',
      headers: this.getHeaders(),
      body: JSON.stringify(request)
    });
    return this.handleResponse(response);
  }

  static async deleteRequest(id: string): Promise<void> {
    const response = await fetch(`${this.BASE_URL}/requests/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    await this.handleResponse(response);
  }

  // --- SUPERADMIN ---
  static async getAllUsers(): Promise<User[]> {
    const response = await fetch(`${this.BASE_URL}/admin/users`, {
      headers: this.getHeaders()
    });
    return this.handleResponse(response);
  }

  static async updateGlobalUser(id: string, updates: Partial<User>): Promise<User> {
    const response = await fetch(`${this.BASE_URL}/admin/users/${id}`, {
      method: 'PATCH',
      headers: this.getHeaders(),
      body: JSON.stringify(updates)
    });
    return this.handleResponse(response);
  }

  static async deleteGlobalUser(id: string): Promise<void> {
    const response = await fetch(`${this.BASE_URL}/admin/users/${id}`, {
      method: 'DELETE',
      headers: this.getHeaders()
    });
    await this.handleResponse(response);
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