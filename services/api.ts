
import { User, Car, Rental, Client, BookingRequest, Transaction, Investor, Staff, Fine, UserRole, AppNotification, SupportMessage, SupportThread } from '../types';

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

  static async verifyEmail(token: string): Promise<{ message: string }> {
      const response = await fetch(`${BackendAPI.BASE_URL}/auth/verify-email?token=${encodeURIComponent(token)}`);
      return BackendAPI.handleResponse(response);
  }

  static async resendVerification(): Promise<{ message: string }> {
      const response = await fetch(`${BackendAPI.BASE_URL}/auth/resend-verification`, {
          method: 'POST',
          headers: BackendAPI.getHeaders()
      });
      return BackendAPI.handleResponse(response);
  }

  static async changePassword(currentPassword: string, newPassword: string): Promise<{ message: string }> {
      const response = await fetch(`${BackendAPI.BASE_URL}/auth/change-password`, {
          method: 'POST',
          headers: BackendAPI.getHeaders(),
          body: JSON.stringify({ currentPassword, newPassword })
      });
      return BackendAPI.handleResponse(response);
  }

  static async forgotPassword(email: string): Promise<{ message: string }> {
      const response = await fetch(`${BackendAPI.BASE_URL}/auth/forgot-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email })
      });
      return BackendAPI.handleResponse(response);
  }

  static async resetPassword(token: string, password: string): Promise<{ message: string }> {
      const response = await fetch(`${BackendAPI.BASE_URL}/auth/reset-password`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, password })
      });
      return BackendAPI.handleResponse(response);
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

  // --- PUSH ---
  static async getVapidPublicKey(): Promise<string | null> {
      try {
        const response = await fetch(`${BackendAPI.BASE_URL}/push/vapid-public-key`);
        if (!response.ok) return null;
        const data = await response.json();
        return data.publicKey;
      } catch { return null; }
  }
  static async subscribePush(subscription: PushSubscriptionJSON): Promise<void> {
      const response = await fetch(`${BackendAPI.BASE_URL}/push/subscribe`, {
          method: 'POST',
          headers: BackendAPI.getHeaders(),
          body: JSON.stringify(subscription)
      });
      await BackendAPI.handleResponse(response);
  }
  static async unsubscribePush(endpoint: string): Promise<void> {
      const response = await fetch(`${BackendAPI.BASE_URL}/push/unsubscribe`, {
          method: 'POST',
          headers: BackendAPI.getHeaders(),
          body: JSON.stringify({ endpoint })
      });
      await BackendAPI.handleResponse(response);
  }

  // --- NOTIFICATIONS ---
  static async getNotifications(): Promise<AppNotification[]> {
      const response = await fetch(`${BackendAPI.BASE_URL}/notifications`, { headers: BackendAPI.getHeaders() });
      return BackendAPI.handleResponse(response);
  }
  static async markNotificationRead(id: string): Promise<void> {
      const response = await fetch(`${BackendAPI.BASE_URL}/notifications/${id}/read`, {
        method: 'PATCH', headers: BackendAPI.getHeaders()
      });
      await BackendAPI.handleResponse(response);
  }
  static async markAllNotificationsRead(): Promise<void> {
      const response = await fetch(`${BackendAPI.BASE_URL}/notifications/read-all`, {
        method: 'PATCH', headers: BackendAPI.getHeaders()
      });
      await BackendAPI.handleResponse(response);
  }

  // --- SUPPORT CHAT ---
  static async getSupportThreads(): Promise<SupportThread[]> {
      const response = await fetch(`${BackendAPI.BASE_URL}/support/threads`, { headers: BackendAPI.getHeaders() });
      return BackendAPI.handleResponse(response);
  }
  static async getSupportMessages(adminId?: string): Promise<SupportMessage[]> {
      const qs = adminId ? `?adminId=${encodeURIComponent(adminId)}` : '';
      const response = await fetch(`${BackendAPI.BASE_URL}/support/messages${qs}`, { headers: BackendAPI.getHeaders() });
      return BackendAPI.handleResponse(response);
  }
  static async sendSupportMessage(body: string, opts?: { toUserId?: string; broadcast?: boolean }): Promise<SupportMessage> {
      const response = await fetch(`${BackendAPI.BASE_URL}/support/messages`, {
          method: 'POST',
          headers: BackendAPI.getHeaders(),
          body: JSON.stringify({ body, ...opts })
      });
      return BackendAPI.handleResponse(response);
  }
  static async markSupportRead(adminId?: string): Promise<void> {
      const response = await fetch(`${BackendAPI.BASE_URL}/support/messages/read`, {
          method: 'PATCH',
          headers: BackendAPI.getHeaders(),
          body: JSON.stringify({ adminId })
      });
      await BackendAPI.handleResponse(response);
  }

  // --- UTILS ---
  static async compressImage(file: File): Promise<string> {
      return compressImage(file);
  }
}
