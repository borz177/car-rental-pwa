
import 'process';
import React, { useState, useEffect } from 'react';
import {
  User, Car, Rental, Client, BookingRequest, AppView,
  Transaction, TransactionType, Investor, Fine, UserRole, RequestStatus, Staff, AppNotification
} from './types';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import TopNavbar from './components/TopNavbar';
import Dashboard from './components/Dashboard';
import CarList from './components/CarList';
import ClientList from './components/ClientList';
import BookingCalendar from './components/BookingCalendar';
import BookingRequests from './components/BookingRequests';
import Settings from './components/Settings';
import ManualBooking from './components/ManualBooking';
import ContractList from './components/ContractList';
import Cashbox from './components/Cashbox';
import Reports from './components/Reports';
import ClientDetails from './components/ClientDetails';
import CarDetails from './components/CarDetails';
import Tariffs from './components/Tariffs';
import InvestorList from './components/InvestorList';
import StaffList from './components/StaffList';
import InvestorDetails from './components/InvestorDetails';
import StaffDetails from './components/StaffDetails';
import SuperadminPanel from './components/SuperadminPanel';
import ClientCatalog from './components/ClientCatalog';
import SubscriptionExpiredModal from './components/SubscriptionExpiredModal';
import CompleteRentalModal from './components/CompleteRentalModal';
import BackendAPI from './services/offlineApi';
import { flushQueue } from './services/offlineSync';
import ToastContainer, { ToastMessage } from './components/Toast';
import NotificationBell from './components/NotificationBell';
import SupportChat from './components/SupportChat';
import { enablePush } from './services/push';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [currentView, setCurrentView] = useState<AppView>('DASHBOARD');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [fleetOwner, setFleetOwner] = useState<User | null>(null);

  // Auth State
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER' | 'FORGOT'>('LOGIN');
  const [authLoading, setAuthLoading] = useState(false);
  const [authNotice, setAuthNotice] = useState<string | null>(null);
  const [resendCooldown, setResendCooldown] = useState(0);

  // Email verification link (?verifyEmail=) / password reset link (?resetPassword=) landing states
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetDone, setResetDone] = useState(false);

  // Уведомления вместо alert(): браузерное окно блокирует интерфейс
  // и особенно мешает на телефоне.
  const [toasts, setToasts] = useState<ToastMessage[]>([]);
  const notify = (text: string, kind: ToastMessage['kind'] = 'error') =>
    setToasts(prev => [...prev, { id: Date.now() + Math.random(), text, kind }]);
  const dismissToast = (id: number) => setToasts(prev => prev.filter(t => t.id !== id));

  // Modal State
  const [completingRental, setCompletingRental] = useState<Rental | null>(null);
  // Открыть форму редактирования авто сразу после возврата из карточки автомобиля
  const [autoEditCarId, setAutoEditCarId] = useState<string | null>(null);

  // Access Control State
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeModalContent, setUpgradeModalContent] = useState({ title: '', message: '' });

  const [cars, setCars] = useState<Car[]>([]);
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  // Fix: Changed staff state to use Staff[] to match backend data structure.
  const [staff, setStaff] = useState<Staff[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [fines, setFines] = useState<Fine[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [currentFleetSlug, setCurrentFleetSlug] = useState<string | null>(null);
  const [notifications, setNotifications] = useState<AppNotification[]>([]);

  // --- ACCESS CONTROL HELPERS ---

  const isSubscriptionActive = () => {
    if (!currentUser) return false;
    // Admins always active for testing, or check dates
    if (currentUser.role === UserRole.SUPERADMIN) return true;
    // Clients don't have subscriptions
    if (currentUser.role === UserRole.CLIENT) return true;

    if (!currentUser.subscriptionUntil) return false; // No date set
    return new Date(currentUser.subscriptionUntil) > new Date();
  };

  const getPlanLimit = () => {
    if (!currentUser) return 0;
    const plan = currentUser.activePlan || (currentUser.isTrial ? 'Premium' : 'Start');

    if (plan.toUpperCase().includes('БИЗНЕС') || plan.toUpperCase().includes('BUSINESS')) return 20;
    if (plan.toUpperCase().includes('ПРЕМИУМ') || plan.toUpperCase().includes('PREMIUM')) return 9999;

    // Default Start
    return 5;
  };

  const checkAccess = (action: 'ADD_CAR' | 'CREATE_RENTAL') => {
    if (!isSubscriptionActive()) {
      setUpgradeModalContent({
        title: 'Подписка истекла',
        message: 'Для создания новых сделок и добавления авто необходимо продлить подписку. Ваши данные доступны только для чтения.'
      });
      setShowUpgradeModal(true);
      return false;
    }

    if (action === 'ADD_CAR') {
      const limit = getPlanLimit();
      if (cars.length >= limit) {
        setUpgradeModalContent({
          title: 'Лимит тарифа исчерпан',
          message: `Ваш тариф позволяет добавить до ${limit} автомобилей. Обновите тариф для расширения автопарка.`
        });
        setShowUpgradeModal(true);
        return false;
      }
    }

    return true;
  };

  const loadData = async () => {
    try {
      const results = await Promise.all([
        BackendAPI.getCars(),
        BackendAPI.getClients(),
        BackendAPI.getRentals(),
        BackendAPI.getTransactions(),
        BackendAPI.getInvestors(),
        BackendAPI.getStaff(),
        BackendAPI.getFines(),
        BackendAPI.getRequests()
      ]);

      // Fix: Adjusted type assertion for staff to Staff[].
      const [c, cl, r, t, inv, st, f, req] = results as [
        Car[], Client[], Rental[], Transaction[], Investor[], Staff[], Fine[], BookingRequest[]
      ];

      setCars(c);
      setClients(cl);
      setRentals(r);
      setTransactions(t);
      setInvestors(inv);
      setStaff(st);
      setFines(f);
      setRequests(req);

      // Если зашел суперадмин, подгружаем всех юзеров системы
      const user = await BackendAPI.getCurrentUser();
      if (user?.role === UserRole.SUPERADMIN) {
        const users = await BackendAPI.getAllUsers();
        setAllUsers(users);
      }
    } catch (e) {
      console.warn("Ошибка загрузки данных:", e);
    }
  };

  // CLIENT-аккаунты в колокольчике и чате поддержки не участвуют (см. App.tsx notifyOwnerTeam
  // на бэкенде — уведомления адресуются только владельцу автопарка и его сотрудникам).
  const loadNotifications = async () => {
    try {
      const list = await BackendAPI.getNotifications();
      setNotifications(list);
    } catch (e) {
      console.warn('Ошибка загрузки уведомлений:', e);
    }
  };

 useEffect(() => {
  const init = async () => {
    try {
      // 🆕 1. Сначала читаем fleetSlug из URL
      const urlParams = new URLSearchParams(window.location.search);
      const fleetSlug = urlParams.get('fleet');

      // Ссылка подтверждения email из письма
      const verifyToken = urlParams.get('verifyEmail');
      if (verifyToken) {
        window.history.replaceState({}, '', window.location.pathname);
        try {
          await BackendAPI.verifyEmail(verifyToken);
          setAuthNotice('Email подтверждён! Теперь можно войти.');
        } catch (err) {
          setAuthNotice('Ссылка подтверждения недействительна или истекла. Запросите новую после входа.');
        }
        setAuthMode('LOGIN');
      }

      // Ссылка сброса пароля из письма
      const resetTokenParam = urlParams.get('resetPassword');
      if (resetTokenParam) {
        window.history.replaceState({}, '', window.location.pathname);
        setResetToken(resetTokenParam);
        setIsInitializing(false);
        return;
      }

      if (fleetSlug) {
        try {
          const publicData = await BackendAPI.getPublicFleet(fleetSlug);
          setCars(publicData.cars);
          setRentals(publicData.rentals);
          setFleetOwner(publicData.owner);


         setCurrentFleetSlug(fleetSlug);
        } catch (err) {
          console.error('Failed to load public fleet', err);
          // 🆕 Опционально: можно показать ошибку пользователю
        }
      }

      // 🆕 4. Теперь проверяем авторизацию
      const user = await BackendAPI.getCurrentUser();

      if (user) {
        setCurrentUser(user);


        const isOwnFleet = user.publicSlug === fleetSlug || user.id === fleetSlug;

        if (fleetSlug && !isOwnFleet) {

          setCurrentView('CLIENT_CATALOG');

        }
        else if (user.role !== UserRole.CLIENT) {
          // 🎯 Владелец смотрит СВОЙ флот или зашёл без slug — стандартная загрузка
          await loadData();
          await loadNotifications();

        }
        else if (user.role === UserRole.CLIENT) {
          // 🎯 Клиент — грузим только его заявки
          const reqs = await BackendAPI.getRequests();
          setRequests(reqs);
          setCurrentView('CLIENT_CATALOG');
        }
      }
      else {
        // 🎯 Гость + есть slug — показываем каталог
        if (fleetSlug) {
          setCurrentView('CLIENT_CATALOG');
        }
      }

    } catch (e) {
      console.error("Ошибка инициализации:", e);
    } finally {
      setIsInitializing(false);
    }
  };
  init();
}, []);

useEffect(() => {
  const handleOnline = async () => {
    setIsOnline(true);
    await flushQueue();
    await loadData();
  };
  const handleOffline = () => setIsOnline(false);

  window.addEventListener('online', handleOnline);
  window.addEventListener('offline', handleOffline);
  return () => {
    window.removeEventListener('online', handleOnline);
    window.removeEventListener('offline', handleOffline);
  };
}, []);

// Пуш работает и при закрытой вкладке, а этот поллинг — только пока приложение
// открыто, но зато отражает и уведомления, до которых пуш не добрался
// (разрешение не выдано, браузер не поддерживает Push API и т.п.).
useEffect(() => {
  if (!currentUser || currentUser.role === UserRole.CLIENT) return;
  const interval = setInterval(loadNotifications, 25000);
  return () => clearInterval(interval);
}, [currentUser]);

  const handleAuthSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthLoading(true);
    setAuthNotice(null);
    const fd = new FormData(e.currentTarget);
    const email = fd.get('email') as string;
    const password = fd.get('password') as string;
    const name = fd.get('name') as string;

    try {
      if (authMode === 'FORGOT') {
        const res = await BackendAPI.forgotPassword(email);
        setAuthNotice(res.message);
        return;
      }
      let user;
      if (authMode === 'LOGIN') {
        user = await BackendAPI.login({ email, password });
      } else {
        user = await BackendAPI.register({ email, password, name, role: UserRole.ADMIN });
      }
      setCurrentUser(user);
      await loadData();
      await loadNotifications();
    } catch (err: any) {
      notify(err.message || 'Ошибка авторизации');
    } finally {
      setAuthLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendCooldown > 0) return;
    try {
      const res = await BackendAPI.resendVerification();
      setAuthNotice(res.message);
      setResendCooldown(30);
      const timer = setInterval(() => {
        setResendCooldown((prev: number) => {
          if (prev <= 1) { clearInterval(timer); return 0; }
          return prev - 1;
        });
      }, 1000);
    } catch (err: any) {
      notify(err.message || 'Не удалось отправить письмо');
    }
  };

  const handleRecheckVerification = async () => {
    const user = await BackendAPI.getCurrentUser();
    if (user) setCurrentUser(user);
  };

  const handleResetPasswordSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const password = fd.get('password') as string;
    const confirm = fd.get('confirm') as string;
    if (password !== confirm) {
      notify('Пароли не совпадают');
      return;
    }
    setResetLoading(true);
    try {
      await BackendAPI.resetPassword(resetToken!, password);
      setResetDone(true);
    } catch (err: any) {
      notify(err.message || 'Не удалось сбросить пароль');
    } finally {
      setResetLoading(false);
    }
  };

  const handleSaveRental = async (rental: Rental) => {
    // Check subscription before creating NEW rental (updating existing is fine usually, but for strict mode let's check)
    if (!rental.id && !checkAccess('CREATE_RENTAL')) return;

    setIsGlobalLoading(true);
    try {
      await BackendAPI.saveRental(rental);
      if (!rental.isReservation) {
        if (rental.paymentStatus === 'PAID') {
          await BackendAPI.saveTransaction({
            id: '',
            ownerId: '',
            amount: rental.totalAmount,
            type: TransactionType.INCOME,
            category: 'Аренда',
            description: `Оплата по дог. ${rental.contractNumber}`,
            date: new Date().toISOString(),
            clientId: rental.clientId,
            carId: rental.carId
          });
        }
        else if (rental.paymentStatus === 'DEBT') {
          const client = clients.find(c => c.id === rental.clientId);
          if (client) {
            await BackendAPI.saveClient({
              ...client,
              debt: (client.debt || 0) + rental.totalAmount
            });
          }
        }
      }
      await loadData();
      // Убрали автоматический переход, теперь этим управляет ManualBooking через onNavigate
    } catch (e: any) {
      notify(e.message);
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const handleConfirmCompletion = async (rental: Rental, amountReceived: number) => {
    setIsGlobalLoading(true);
    try {
      // 1. Create income transaction if amount is received
      if (amountReceived > 0) {
        await BackendAPI.saveTransaction({
          amount: amountReceived,
          type: TransactionType.INCOME,
          category: 'Аренда (завершение)',
          description: `Постоплата по дог. ${rental.contractNumber}`,
          date: new Date().toISOString(),
          clientId: rental.clientId,
          carId: rental.carId
        });
      }

      // 2. Update client's debt
      const client = clients.find(c => c.id === rental.clientId);
      if (client && client.debt && client.debt > 0) {
        // Reduce debt by the amount paid. Don't let it go below zero from this operation.
        const newDebt = Math.max(0, client.debt - amountReceived);
        await BackendAPI.saveClient({ ...client, debt: newDebt });
      }

      // 3. Update rental status to COMPLETED
      await BackendAPI.saveRental({ ...rental, status: 'COMPLETED' });

      // 4. Refresh all data
      await loadData();
      setCompletingRental(null); // Close the modal
    } catch (e: any) {
      notify('Ошибка при завершении аренды: ' + e.message);
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const apiAction = (fn: (...args: any[]) => Promise<any>) => async (...args: any[]) => {
    setIsGlobalLoading(true);
    try {
      await fn(...args);
      await loadData();
    } catch (e: any) {
      notify(e.message);
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const handleMarkNotificationRead = async (id: string) => {
    // Оптимистично: колокольчик не должен ждать сеть, чтобы погасить точку.
    setNotifications(prev => prev.map(n => n.id === id ? { ...n, isRead: true } : n));
    try { await BackendAPI.markNotificationRead(id); } catch { /* переживёт до следующего опроса */ }
  };

  const handleMarkAllNotificationsRead = async () => {
    setNotifications(prev => prev.map(n => ({ ...n, isRead: true })));
    try { await BackendAPI.markAllNotificationsRead(); } catch { /* переживёт до следующего опроса */ }
  };

  const handleAddCar = async (car: Car) => {
    if (!car.id && !checkAccess('ADD_CAR')) return; // Only check limit on creation
    await apiAction(BackendAPI.saveCar)(car);
  };


  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_35%,rgba(59,130,246,0.16),transparent_60%)]"></div>

        <div className="relative flex flex-col items-center gap-5 animate-splash-logo">
          <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-2xl shadow-md">
            <i className="fas fa-car-side"></i>
          </div>

          <div className="text-center">
            <h1 className="text-2xl font-semibold text-white tracking-tight">AutoPro AI</h1>
            <p className="text-slate-500 font-semibold uppercase text-[10px] tracking-wide mt-1.5">Система управления автопарком</p>
          </div>

          <div className="w-36 h-1 bg-slate-800 rounded-full overflow-hidden mt-3">
            <div className="w-1/3 h-full bg-blue-500 rounded-full animate-splash-bar"></div>
          </div>
        </div>

        <div className="absolute bottom-8 text-slate-700 text-[10px] font-semibold uppercase tracking-wide">
          {isOnline ? 'Загрузка' : 'Офлайн режим'}
        </div>
      </div>
    );
  }


  // Password reset landing (from email link) — takes priority over everything else
  if (resetToken) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
        <ToastContainer toasts={toasts} onClose={dismissToast} />
        <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-md animate-scaleIn">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-3xl shadow-lg mx-auto mb-4">
              <i className="fas fa-key"></i>
            </div>
            <h1 className="text-2xl font-semibold text-slate-900 tracking-tight">Новый пароль</h1>
          </div>

          {resetDone ? (
            <div className="text-center space-y-4">
              <p className="text-slate-500 text-sm font-medium">Пароль обновлён. Теперь можно войти с новым паролем.</p>
              <button
                onClick={() => { setResetToken(null); setResetDone(false); }}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-semibold uppercase tracking-wide text-xs shadow-md hover:bg-blue-700 active:scale-95 transition-all"
              >
                Войти
              </button>
            </div>
          ) : (
            <form onSubmit={handleResetPasswordSubmit} className="space-y-4">
              <input
                name="password"
                type="password"
                placeholder="Новый пароль"
                required
                minLength={6}
                className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500 transition-all"
              />
              <input
                name="confirm"
                type="password"
                placeholder="Повторите пароль"
                required
                minLength={6}
                className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500 transition-all"
              />
              <button
                type="submit"
                disabled={resetLoading}
                className="w-full py-4 bg-blue-600 text-white rounded-2xl font-semibold uppercase tracking-wide text-xs shadow-md hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center space-x-2"
              >
                {resetLoading && <i className="fas fa-circle-notch animate-spin"></i>}
                <span>Сохранить пароль</span>
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  // Public Catalog View Wrapper
  if (!currentUser && currentView === 'CLIENT_CATALOG') {
    return (
      <div className="min-h-screen bg-slate-50 relative overflow-y-auto">
        <ToastContainer toasts={toasts} onClose={dismissToast} />
        <ClientCatalog
          cars={cars}
          rentals={rentals}
          currentUser={null}
          onSubmitRequest={async (req) => {
             // Use public endpoint for guest requests
             await BackendAPI.submitBookingRequest(req);
             notify('Заявка отправлена!', 'success');
          }}
          fleetOwner={fleetOwner}
          onAuthRequest={() => window.location.reload()}
          onRegisterClient={async (u) => {
            const user = await BackendAPI.register({...u, role: UserRole.CLIENT});
            setCurrentUser(user);
          }}
          onLoginClient={async (e, p) => {
            const user = await BackendAPI.login({email: e, password: p});
            setCurrentUser(user);
          }}
        />
      </div>
    );
  }



  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
        <ToastContainer toasts={toasts} onClose={dismissToast} />
        <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-md animate-scaleIn">
          <div className="text-center mb-8">
            <div className="w-12 h-12 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-3xl shadow-lg mx-auto mb-4">
              <i className="fas fa-car-side"></i>
            </div>
            <h1 className="text-3xl font-semibold text-slate-900 tracking-tight">AutoPro AI</h1>
            <p className="text-slate-400 font-bold uppercase text-xs tracking-wide mt-2">
              {authMode === 'FORGOT' ? 'Восстановление пароля' : 'Система управления автопарком'}
            </p>
          </div>

          {authNotice && (
            <div className="mb-4 p-3 bg-blue-50 text-blue-700 text-xs font-semibold rounded-xl text-center">
              {authNotice}
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === 'REGISTER' && (
              <input
                name="name"
                placeholder="Название компании / ФИО"
                required
                className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500 transition-all"
              />
            )}
            <input
              name="email"
              type="email"
              placeholder="Email"
              required
              className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500 transition-all"
            />
            {authMode !== 'FORGOT' && (
              <input
                name="password"
                type="password"
                placeholder="Пароль"
                required
                className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500 transition-all"
              />
            )}

            {authMode === 'LOGIN' && (
              <div className="text-right -mt-2">
                <button
                  type="button"
                  onClick={() => { setAuthMode('FORGOT'); setAuthNotice(null); }}
                  className="text-slate-400 font-semibold text-xs hover:text-blue-600 transition-colors"
                >
                  Забыли пароль?
                </button>
              </div>
            )}

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-semibold uppercase tracking-wide text-xs shadow-md hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center space-x-2"
            >
              {authLoading && <i className="fas fa-circle-notch animate-spin"></i>}
              <span>{authMode === 'LOGIN' ? 'Войти' : authMode === 'FORGOT' ? 'Отправить ссылку' : 'Создать аккаунт'}</span>
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => { setAuthMode(authMode === 'LOGIN' ? 'REGISTER' : 'LOGIN'); setAuthNotice(null); }}
              className="text-slate-400 font-bold text-xs uppercase tracking-wide hover:text-blue-600 transition-colors"
            >
              {authMode === 'LOGIN' ? 'Нет аккаунта? Регистрация' : authMode === 'FORGOT' ? 'Назад ко входу' : 'Уже есть аккаунт? Войти'}
            </button>
          </div>
        </div>
      </div>
    );
  }

  // ADMIN accounts must verify their email before touching the fleet dashboard.
  if (currentUser.role === UserRole.ADMIN && !currentUser.emailVerified) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
        <ToastContainer toasts={toasts} onClose={dismissToast} />
        <div className="bg-white rounded-2xl w-full max-w-md p-6 shadow-md animate-scaleIn text-center">
          <div className="w-12 h-12 bg-amber-100 rounded-2xl flex items-center justify-center text-amber-600 text-2xl mx-auto mb-4">
            <i className="fas fa-envelope-circle-check"></i>
          </div>
          <h1 className="text-xl font-semibold text-slate-900">Подтвердите email</h1>
          <p className="text-slate-500 text-sm font-medium mt-2">
            Мы отправили письмо со ссылкой подтверждения на <span className="font-semibold text-slate-700">{currentUser.email}</span>.
            Перейдите по ссылке, чтобы получить доступ к автопарку.
          </p>

          {authNotice && (
            <div className="mt-4 p-3 bg-blue-50 text-blue-700 text-xs font-semibold rounded-xl">
              {authNotice}
            </div>
          )}

          <div className="mt-6 space-y-3">
            <button
              onClick={handleRecheckVerification}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-semibold uppercase tracking-wide text-xs shadow-md hover:bg-blue-700 active:scale-95 transition-all"
            >
              Я подтвердил, проверить
            </button>
            <button
              onClick={handleResendVerification}
              disabled={resendCooldown > 0}
              className="w-full py-4 bg-slate-50 text-slate-500 rounded-2xl font-semibold uppercase tracking-wide text-xs hover:bg-slate-100 transition-all disabled:opacity-50"
            >
              {resendCooldown > 0 ? `Отправить ещё раз (${resendCooldown}с)` : 'Отправить письмо ещё раз'}
            </button>
            <button
              onClick={() => BackendAPI.logout()}
              className="text-slate-400 font-semibold text-xs uppercase tracking-wide hover:text-blue-600 transition-colors"
            >
              Выйти
            </button>
          </div>
        </div>
      </div>
    );
  }

  const activeRentalsCount = rentals.filter(r => r.status === 'ACTIVE' && !r.isReservation).length;
  const bookingsCount = rentals.filter(r => r.status === 'ACTIVE' && r.isReservation).length;
  // Count ONLY pending requests for the badge
  const pendingRequestsCount = requests.filter(r => r.status === RequestStatus.PENDING).length;

  const rentalToComplete = completingRental ? rentals.find(r => r.id === completingRental.id) : null;
  const carToComplete = rentalToComplete ? cars.find(c => c.id === rentalToComplete.carId) : null;
  const clientToComplete = rentalToComplete ? clients.find(cl => cl.id === rentalToComplete.clientId) : null;

  const permissions = currentUser.permissions;
  const isStaff = currentUser.role === UserRole.STAFF;

  return (
    <div className="min-h-screen bg-slate-50 relative flex overflow-hidden">
      {/* RESTRICTION MODAL (Only shows when action blocked) */}
      {showUpgradeModal && (
        <SubscriptionExpiredModal
          onRenew={() => { setShowUpgradeModal(false); setCurrentView('TARIFFS'); }}
          onClose={() => setShowUpgradeModal(false)}
          title={upgradeModalContent.title}
          message={upgradeModalContent.message}
        />
      )}

      {/* RENTAL COMPLETION MODAL */}
      {completingRental && rentalToComplete && carToComplete && clientToComplete && (
        <CompleteRentalModal
          rental={rentalToComplete}
          car={carToComplete}
          client={clientToComplete}
          onClose={() => setCompletingRental(null)}
          onConfirm={handleConfirmCompletion}
        />
      )}

      {isGlobalLoading && (
        <div className="fixed inset-0 z-[100] bg-white/40 backdrop-blur-[2px] flex items-center justify-center">
          <div className="w-14 h-14 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      <ToastContainer toasts={toasts} onClose={dismissToast} />

      {!isOnline && (
        <div className="fixed top-0 inset-x-0 z-[90] bg-amber-500 text-white text-xs font-semibold text-center py-1.5 px-4 flex items-center justify-center gap-2">
          <i className="fas fa-triangle-exclamation"></i>
          <span>Офлайн режим — изменения синхронизируются при подключении</span>
        </div>
      )}

      <TopNavbar
        brandName={currentUser.publicBrandName || 'AutoPro AI'}
        notifications={notifications}
        onMarkNotificationRead={handleMarkNotificationRead}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
        onNavigate={(view) => { setSelectedEntityId(null); setCurrentView(view); }}
      />

      <Sidebar
        currentView={currentView}
        user={currentUser}
        userName={currentUser.name}
        onNavigate={(view) => {
          // Reset selection when navigating from sidebar to prevent sticking to specific reports
          setSelectedEntityId(null);
          setCurrentView(view);
        }}
        onLogout={() => BackendAPI.logout()}
        requestCount={pendingRequestsCount}
        rentalCount={activeRentalsCount}
        bookingCount={bookingsCount}
        notifications={notifications}
        onMarkNotificationRead={handleMarkNotificationRead}
        onMarkAllNotificationsRead={handleMarkAllNotificationsRead}
      />

      <main className="flex-1 overflow-y-auto pt-32 md:pt-12 pb-44 md:pb-12 md:ml-64 p-6">
        <div className="max-w-7xl mx-auto mt-4">
          {currentView === 'DASHBOARD' &&
              <Dashboard
                  cars={cars}
                  rentals={rentals}
                  clients={clients}
                  transactions={transactions}
                  fines={fines}
                  user={currentUser}
                  onCompleteRental={setCompletingRental}
                  onNavigate={(view) => { setSelectedEntityId(null); setCurrentView(view); }}
                  onSelectCar={(id) => { setSelectedEntityId(id); setCurrentView('CAR_DETAILS'); }}
              />
          }

          {currentView === 'CARS' && (
              <CarList
                  cars={cars}
                  investors={investors}
                  rentals={rentals}
                  clients={clients}
                  onAdd={handleAddCar}
                  onUpdate={apiAction(BackendAPI.saveCar)}
                  onDelete={apiAction(BackendAPI.deleteCar)}
                  onIssue={(id) => {
                    setSelectedEntityId(id);
                    setCurrentView('MANUAL_BOOKING');
                  }}
                  onReserve={(id) => {
                    setSelectedEntityId(id);
                    setCurrentView('MANUAL_BOOKING');
                  }}
                  onInfo={(id) => {
                    setSelectedEntityId(id);
                    setCurrentView('CAR_DETAILS');
                  }}
                  onComplete={setCompletingRental}
                  currentUser={currentUser}
                  planLimit={getPlanLimit()}
                  autoEditCarId={autoEditCarId}
                  onAutoEditHandled={() => setAutoEditCarId(null)}
              />
          )}

          {currentView === 'CLIENTS' && (
              <ClientList
                  clients={clients}
                  rentals={rentals}
                  transactions={transactions}
                  onAdd={apiAction(BackendAPI.saveClient)}
                  onUpdate={apiAction(BackendAPI.saveClient)}
                  onDelete={apiAction(BackendAPI.deleteClient)}
                  onSelectClient={(id) => {
                    setSelectedEntityId(id);
                    setCurrentView('CLIENT_DETAILS');
                  }}
              />
          )}

          {(currentView === 'CONTRACTS' || currentView === 'BOOKINGS' || currentView === 'CONTRACTS_ARCHIVE') && (
              <ContractList
                  rentals={rentals}
                  cars={cars}
                  clients={clients}
                  onUpdate={apiAction(BackendAPI.saveRental)}
                  onDelete={apiAction(BackendAPI.deleteRental)}
                  onIssueFromBooking={(id) => {
                    setSelectedEntityId(id);
                    setCurrentView('MANUAL_BOOKING');
                  }}
                  onComplete={setCompletingRental}
                  viewMode={currentView === 'BOOKINGS' ? 'BOOKINGS' : (currentView === 'CONTRACTS_ARCHIVE' ? 'ARCHIVE' : 'CONTRACTS')}
                  brandName={currentUser.publicBrandName}
              />
          )}

          {currentView === 'CASHBOX' && (!isStaff || permissions?.canViewDocs) && (
              <Cashbox
                  transactions={transactions}
                  clients={clients}
                  rentals={rentals}
                  staff={staff}
                  investors={investors}
                  cars={cars}
                  onAddTransaction={apiAction(BackendAPI.saveTransaction)}
              />
          )}

          {currentView === 'REPORTS' && (!isStaff || permissions?.canViewDocs) && (
              <Reports
                  transactions={transactions}
                  cars={cars}
                  investors={investors}
                  rentals={rentals}
                  clients={clients}
                  fines={fines}
                  initialSearchId={selectedEntityId}
                  initialCategory={selectedEntityId ? 'CARS' : 'ALL'}
              />
          )}

          {currentView === 'INVESTORS' && (!isStaff || permissions?.canViewDocs) && (
              <InvestorList
                  investors={investors}
                  cars={cars}
                  rentals={rentals}
                  transactions={transactions}
                  onAdd={apiAction(BackendAPI.saveInvestor)}
                  onUpdate={apiAction(BackendAPI.saveInvestor)}
                  onDelete={apiAction(BackendAPI.deleteInvestor)}
                  onSelectInvestor={(id) => {
                    setSelectedEntityId(id);
                    setCurrentView('INVESTOR_DETAILS');
                  }}
              />
          )}

          {currentView === 'STAFF' && !isStaff && (
              <StaffList
                  staff={staff}
                  onAdd={apiAction(BackendAPI.saveStaff)}
                  onUpdate={apiAction(BackendAPI.saveStaff)}
                  onDelete={apiAction(BackendAPI.deleteStaff)}
                  onSelectStaff={(id) => {
                    setSelectedEntityId(id);
                    setCurrentView('STAFF_DETAILS');
                  }}
              />
          )}

          {currentView === 'CLIENT_DETAILS' && (
              <ClientDetails
                  client={clients.find(c => c.id === selectedEntityId)!}
                  rentals={rentals}
                  transactions={transactions}
                  cars={cars}
                  fines={fines}
                  onBack={() => setCurrentView('CLIENTS')}
                  onAddFine={apiAction(BackendAPI.saveFine)}
                  onPayFine={apiAction(BackendAPI.payFine)}
              />
          )}

          {currentView === 'CAR_DETAILS' && cars.find(c => c.id === selectedEntityId) && (
              <CarDetails
                  car={cars.find(c => c.id === selectedEntityId)!}
                  rentals={rentals}
                  clients={clients}
                  transactions={transactions}
                  investors={investors}
                  fines={fines}
                  onBack={() => setCurrentView('CARS')}
                  onUpdate={apiAction(BackendAPI.saveCar)}
                  onEdit={() => { setAutoEditCarId(selectedEntityId); setCurrentView('CARS'); }}
                  onViewReport={() => setCurrentView('REPORTS')}
              />
          )}

          {currentView === 'INVESTOR_DETAILS' && (
              <InvestorDetails
                  investor={investors.find(i => i.id === selectedEntityId)!}
                  cars={cars}
                  rentals={rentals}
                  transactions={transactions}
                  onBack={() => setCurrentView('INVESTORS')}
              />
          )}

          {currentView === 'STAFF_DETAILS' && (
              <StaffDetails
                  member={staff.find(s => s.id === selectedEntityId)!}
                  onBack={() => setCurrentView('STAFF')}
              />
          )}

          {currentView === 'SUPERADMIN_PANEL' && (
              <SuperadminPanel
                  allUsers={allUsers}
                  onUpdateUser={apiAction(BackendAPI.updateGlobalUser)}
                  onDeleteUser={apiAction(BackendAPI.deleteGlobalUser)}
              />
          )}

          {currentView === 'MANUAL_BOOKING' && (
              <ManualBooking
                  cars={cars}
                  clients={clients}
                  rentals={rentals}
                  currentUser={currentUser}
                  preSelectedRentalId={currentView === 'MANUAL_BOOKING' && rentals.find(r => r.id === selectedEntityId) ? selectedEntityId : null}
                  preSelectedCarId={!rentals.find(r => r.id === selectedEntityId) ? selectedEntityId || undefined : undefined}
                  onCreate={handleSaveRental}
                  onNavigate={setCurrentView}
                  onQuickAddClient={async (c) => {
                    const res = await BackendAPI.saveClient(c as Client);
                    return res.id;
                  }}
              />
          )}

          {currentView === 'CALENDAR' && (
              <BookingCalendar
                  cars={cars}
                  rentals={rentals}
                  clients={clients}
                  onSelectCar={(id) => { setSelectedEntityId(id); setCurrentView('CAR_DETAILS'); }}
                  onBookCar={(id) => { setSelectedEntityId(id); setCurrentView('MANUAL_BOOKING'); }}
              />
          )}

          {currentView === 'REQUESTS' && (
              <BookingRequests
                  requests={requests}
                  cars={cars}
                  onAction={apiAction(BackendAPI.deleteRequest)}
              />
          )}

          {currentView === 'CLIENT_CATALOG' && (
              <ClientCatalog
                  cars={cars}
                  rentals={rentals}
                  currentUser={currentUser}
                  onSubmitRequest={async (req) => {
                    // Use public endpoint here too to ensure ownerId is respected correctly
                    await BackendAPI.submitBookingRequest(req);
                    // Refresh requests list
                    const reqs = await BackendAPI.getRequests();
                    setRequests(reqs);
                  }}
                  fleetOwner={fleetOwner}
                  onAuthRequest={() => {
                  }}
                  onRegisterClient={async (u) => {
                    const user = await BackendAPI.register({...u, role: UserRole.CLIENT});
                    setCurrentUser(user);
                  }}
                  onLoginClient={async (e, p) => {
                    const user = await BackendAPI.login({email: e, password: p});
                    setCurrentUser(user);
                  }}
              />
          )}

          {/* New View for Client Bookings */}
          {currentView === 'CLIENT_MY_BOOKINGS' && (
              <BookingRequests
                  requests={requests}
                  cars={cars}
                  isReadOnly={true}
              />
          )}

          {currentView === 'SETTINGS' && (
              <Settings
                  user={currentUser}
                  onUpdate={async (updates) => {
                    // Optimistic update for UI
                    setCurrentUser(prev => prev ? ({
                      ...prev, ...updates,
                      settings: {...prev.settings, ...updates.settings}
                    }) : null);
                    await apiAction((u) => BackendAPI.updateGlobalUser(currentUser.id, u))(updates);
                  }}
                  onNavigate={setCurrentView}
                  onLogout={() => BackendAPI.logout()}
              />
          )}

          {currentView === 'TARIFFS' && (
              <Tariffs
                  user={currentUser}
                  onUpdate={apiAction((u) => BackendAPI.updateGlobalUser(currentUser.id, u))}
                  onBack={() => setCurrentView('SETTINGS')}
              />
          )}

          {currentView === 'SUPPORT_CHAT' && (
              <SupportChat currentUser={currentUser} />
          )}
        </div>
      </main>

      <BottomNav
          currentView={currentView}
          userRole={currentUser.role}
          onNavigate={(view) => {
            setSelectedEntityId(null);
          setCurrentView(view);
        }}
        requestCount={pendingRequestsCount}
        isClientMode={currentUser.role === UserRole.CLIENT}
      />
    </div>
  );
};

export default App;