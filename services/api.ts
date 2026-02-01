
import { User, Car, Rental, Client, BookingRequest, Transaction, Investor, Staff, Fine, UserRole } from '../types';

// Helper to simulate image compression
const compressImage = async (file: File): Promise<string> => {
    return new Promise((resolve) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = () => resolve(reader.result as string);
    });
};

export default class BackendAPI {
  static BASE_URL = '/api';

  // Helper to get headers with token
  static getHeaders() {
    const headers: HeadersInit = {
      'Content-Type': 'application/json',
    };
    const token = localStorage.getItem('token');
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    return headers;
  }

  static async handleResponse(response: Response) {
    if (response.status === 401) {
      localStorage.removeItem('token');
      // Optional: window.location.reload() if you want to force logout immediately
      throw new Error('Unauthorized');
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ message: response.statusText }));
      throw new Error(error.message || 'API Error');
    }

    if (response.status === 204) {
        return null;
    }
    return response.json();
  }

  // --- PUBLIC ---
  static async getPublicFleet(slug: string): Promise<{ owner: User, cars: Car[], rentals: Rental[] }> {
    const response = await fetch(`${BackendAPI.BASE_URL}/public/fleet/${slug}`);
    return BackendAPI.handleResponse(response);
  }

  static async submitBookingRequest(request: BookingRequest): Promise<void> {
    const response = await fetch(`${BackendAPI.BASE_URL}/public/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(request)
    });
    await BackendAPI.handleResponse(response);
  }

  // --- AUTH ---
  static async login(creds: any): Promise<User> {
     const response = await fetch(`${BackendAPI.BASE_URL}/auth/login`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(creds)
     });
     const data = await BackendAPI.handleResponse(response);

     // Save token and return strictly the User object to avoid structure mismatch in App.tsx
     if (data.token) {
       localStorage.setItem('token', data.token);
     }
     return data.user;
  }

  static async register(data: any): Promise<User> {
     const response = await fetch(`${BackendAPI.BASE_URL}/auth/register`, {
         method: 'POST',
         headers: { 'Content-Type': 'application/json' },
         body: JSON.stringify(data)
     });
     const resData = await BackendAPI.handleResponse(response);

     if (resData.token) {
        localStorage.setItem('token', resData.token);
     }
     return resData.user;
  }

  static async logout(): Promise<void> {
      // Clear local token first
      localStorage.removeItem('token');
      try {
        await fetch(`${BackendAPI.BASE_URL}/auth/logout`, { method: 'POST' });
      } catch (e) {
        // Ignore network errors on logout
      }
      window.location.reload();
  }

  static async getCurrentUser(): Promise<User | null> {
      // If no token, don't even try to fetch (avoids 401 console errors on initial load)
      if (!localStorage.getItem('token')) return null;

      try {
          const response = await fetch(`${BackendAPI.BASE_URL}/auth/me`, {
            headers: BackendAPI.getHeaders()
          });
          if (response.status === 401) return null;
          return BackendAPI.handleResponse(response);
      } catch {
          return null;
      }
  }

  static async getAllUsers(): Promise<User[]> {
      // FIX: Use /admin/users endpoint matching server.ts
      const response = await fetch(`${BackendAPI.BASE_URL}/admin/users`, { headers: BackendAPI.getHeaders() });
      return BackendAPI.handleResponse(response);
  }

  static async updateGlobalUser(id: string, updates: Partial<User>): Promise<User> {
      // FIX: Use /admin/users endpoint matching server.ts
      const response = await fetch(`${BackendAPI.BASE_URL}/admin/users/${id}`, {
          method: 'PATCH',
          headers: BackendAPI.getHeaders(),
          body: JSON.stringify(updates)
      });
      return BackendAPI.handleResponse(response);
  }

  static async deleteGlobalUser(id: string): Promise<void> {
      // FIX: Use /admin/users endpoint matching server.ts
      const response = await fetch(`${BackendAPI.BASE_URL}/admin/users/${id}`, {
        method: 'DELETE',
        headers: BackendAPI.getHeaders()
      });
      await BackendAPI.handleResponse(response);
  }

  // --- CARS ---
  static async getCars(): Promise<Car[]> {
      const response = await fetch(`${BackendAPI.BASE_URL}/cars`, { headers: BackendAPI.getHeaders() });
      return BackendAPI.handleResponse(response);
  }
  static async saveCar(car: Car): Promise<Car> {
      const method = car.id ? 'PUT' : 'POST';
      const url = car.id ? `${BackendAPI.BASE_URL}/cars/${car.id}` : `${BackendAPI.BASE_URL}/cars`;
      const response = await fetch(url, {
          method,
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
      const response = await fetch(`${BackendAPI.BASE_URL}/clients`, { headers: BackendAPI.getHeaders() });
      return BackendAPI.handleResponse(response);
  }
  static async saveClient(client: Client): Promise<Client> {
      const method = client.id ? 'PUT' : 'POST';
      const url = client.id ? `${BackendAPI.BASE_URL}/clients/${client.id}` : `${BackendAPI.BASE_URL}/clients`;
      const response = await fetch(url, {
          method,
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
      const response = await fetch(`${BackendAPI.BASE_URL}/rentals`, { headers: BackendAPI.getHeaders() });
      return BackendAPI.handleResponse(response);
  }
  static async saveRental(rental: Rental): Promise<Rental> {
      const method = rental.id ? 'PUT' : 'POST';
      const url = rental.id ? `${BackendAPI.BASE_URL}/rentals/${rental.id}` : `${BackendAPI.BASE_URL}/rentals`;
      const response = await fetch(url, {
          method,
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
      const response = await fetch(`${BackendAPI.BASE_URL}/transactions`, { headers: BackendAPI.getHeaders() });
      return BackendAPI.handleResponse(response);
  }
  static async saveTransaction(tx: Partial<Transaction>, clientId?: string): Promise<Transaction> {
      const response = await fetch(`${BackendAPI.BASE_URL}/transactions`, {
          method: 'POST',
          headers: BackendAPI.getHeaders(),
          body: JSON.stringify({ ...tx, clientId })
      });
      return BackendAPI.handleResponse(response);
  }

  // --- INVESTORS ---
  static async getInvestors(): Promise<Investor[]> {
      const response = await fetch(`${BackendAPI.BASE_URL}/investors`, { headers: BackendAPI.getHeaders() });
      return BackendAPI.handleResponse(response);
  }
  static async saveInvestor(investor: Investor): Promise<Investor> {
      const method = investor.id ? 'PUT' : 'POST';
      const url = investor.id ? `${BackendAPI.BASE_URL}/investors/${investor.id}` : `${BackendAPI.BASE_URL}/investors`;
      const response = await fetch(url, {
          method,
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
      const response = await fetch(`${BackendAPI.BASE_URL}/staff`, { headers: BackendAPI.getHeaders() });
      return BackendAPI.handleResponse(response);
  }
  static async saveStaff(staff: Staff): Promise<Staff> {
       const method = staff.id && !staff.id.startsWith('staff-') ? 'PUT' : 'POST';
       const url = method === 'PUT' ? `${BackendAPI.BASE_URL}/staff/${staff.id}` : `${BackendAPI.BASE_URL}/staff`;
       const response = await fetch(url, {
           method,
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
      const response = await fetch(`${BackendAPI.BASE_URL}/fines`, { headers: BackendAPI.getHeaders() });
      return BackendAPI.handleResponse(response);
  }
  static async saveFine(fine: Partial<Fine>): Promise<Fine> {
      const response = await fetch(`${BackendAPI.BASE_URL}/fines`, {
          method: 'POST',
          headers: BackendAPI.getHeaders(),
          body: JSON.stringify(fine)
      });
      return BackendAPI.handleResponse(response);
  }
  static async payFine(id: string): Promise<void> {
      const response = await fetch(`${BackendAPI.BASE_URL}/fines/${id}/pay`, {
        method: 'POST',
        headers: BackendAPI.getHeaders()
      });
      await BackendAPI.handleResponse(response);
  }

  // --- REQUESTS ---
  static async getRequests(): Promise<BookingRequest[]> {
      const response = await fetch(`${BackendAPI.BASE_URL}/requests`, { headers: BackendAPI.getHeaders() });
      return BackendAPI.handleResponse(response);
  }
  static async deleteRequest(id: string, action?: 'APPROVE' | 'REJECT'): Promise<void> {
      if (action) {
          const response = await fetch(`${BackendAPI.BASE_URL}/requests/${id}/status`, {
              method: 'PATCH',
              headers: BackendAPI.getHeaders(),
              body: JSON.stringify({ status: action === 'APPROVE' ? 'APPROVED' : 'REJECTED' })
          });
          await BackendAPI.handleResponse(response);
      } else {
          const response = await fetch(`${BackendAPI.BASE_URL}/requests/${id}`, {
            method: 'DELETE',
            headers: BackendAPI.getHeaders()
          });
          await BackendAPI.handleResponse(response);
      }
  }

  // --- UTILS ---
  static async compressImage(file: File): Promise<string> {
      return compressImage(file);
  }
}
