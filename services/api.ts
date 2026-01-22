
import { Car, User, Rental, Client, Transaction, Investor, Staff, Fine } from '../types.ts';

/**
 * Client-side API service for communicating with the real backend.
 */
class BackendAPI {
  private static BASE_URL = '/api'; // Assuming proxy or same-origin

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

  // --- IMAGE COMPRESSION (Frontend only) ---
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
