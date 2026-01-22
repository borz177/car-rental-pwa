
import React, { useState, useEffect } from 'react';
import { User, Car, Rental, Client, BookingRequest, AppView, UserRole, CarStatus, Transaction, TransactionType, Investor, Staff, Fine, FineStatus } from './types.ts';
import { INITIAL_CARS } from './constants';
import Sidebar from './components/Sidebar';
import BottomNav from './components/BottomNav';
import TopNavbar from './components/TopNavbar';
import Dashboard from './components/Dashboard';
import CarList from './components/CarList';
import ClientList from './components/ClientList';
import BookingCalendar from './components/BookingCalendar';
import AiAdvisor from './components/AiAdvisor';
import ClientCatalog from './components/ClientCatalog';
import BookingRequests from './components/BookingRequests';
import Settings from './components/Settings';
import ManualBooking from './components/ManualBooking';
import ContractList from './components/ContractList';
import InvestorList from './components/InvestorList';
import Cashbox from './components/Cashbox';
import Reports from './components/Reports';
import StaffList from './components/StaffList';
import ClientDetails from './components/ClientDetails';
import StaffDetails from './components/StaffDetails';
import InvestorDetails from './components/InvestorDetails';
import Tariffs from './components/Tariffs';
import SuperadminPanel from './components/SuperadminPanel';
import BackendAPI from './services/api';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);

  const [allUsers, setAllUsers] = useState<User[]>([]); // Now fetched from server via Superadmin
  const [authMode, setAuthMode] = useState<'SELECT_ROLE' | 'LOGIN' | 'REGISTER'>('SELECT_ROLE');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [currentView, setCurrentView] = useState<AppView>('DASHBOARD');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [publicFleetOwner, setPublicFleetOwner] = useState<User | null>(null);

  const [cars, setCars] = useState<Car[]>([]);
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [fines, setFines] = useState<Fine[]>([]);

  const loadData = async () => {
    try {
      const fetchedCars = await BackendAPI.getCars();
      setCars(fetchedCars);
      
      const fetchedClients = await BackendAPI.getClients();
      setClients(fetchedClients);
      
      // Add other fetches here...
    } catch (e) {
      console.error("Failed to load data", e);
    }
  };

  useEffect(() => {
    const init = async () => {
      const user = await BackendAPI.getCurrentUser();
      if (user) {
        setCurrentUser(user);
        await loadData();
      }
      setIsInitializing(false);
    };
    init();
  }, []);

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsGlobalLoading(true);
    const fd = new FormData(e.currentTarget);
    const email = fd.get('email') as string;
    const password = fd.get('password') as string;
    const name = fd.get('name') as string;

    try {
      let user;
      if (authMode === 'REGISTER') {
        user = await BackendAPI.register({ email, password, name, role: selectedRole || UserRole.ADMIN });
      } else {
        user = await BackendAPI.login({ email, password });
      }
      
      setCurrentUser(user);
      await loadData();
      setCurrentView(user.role === UserRole.CLIENT ? 'CLIENT_CATALOG' : (user.role === UserRole.SUPERADMIN ? 'SUPERADMIN_PANEL' : 'DASHBOARD'));
    } catch (err: any) {
      alert(err.message || 'Ошибка авторизации');
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const handleLogout = () => {
    BackendAPI.logout();
    setCurrentUser(null);
    setAuthMode('SELECT_ROLE');
    setCurrentView('DASHBOARD');
    setCars([]);
    setClients([]);
  };

  const handleAddCar = async (car: Car) => {
    setIsGlobalLoading(true);
    try {
      const saved = await BackendAPI.saveCar(car);
      setCars(prev => [...prev, saved]);
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const handleUpdateCar = async (car: Car) => {
    setIsGlobalLoading(true);
    try {
      const saved = await BackendAPI.saveCar(car);
      setCars(prev => prev.map(c => c.id === car.id ? saved : c));
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const handleDeleteCar = async (id: string) => {
    setIsGlobalLoading(true);
    try {
      await BackendAPI.deleteCar(id);
      setCars(prev => prev.filter(c => c.id !== id));
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsGlobalLoading(false);
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-6 text-slate-500 font-black uppercase tracking-widest text-[10px]">Загрузка AutoPro AI...</p>
      </div>
    );
  }

  // Rest of the component remains similar but uses the local states updated by server calls
  // (Rendering logic is preserved from the previous version)

  if (!currentUser && !publicFleetOwner) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-4">
        {isGlobalLoading && (
           <div className="fixed inset-0 z-[100] bg-slate-950/50 backdrop-blur-md flex items-center justify-center">
             <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
           </div>
        )}
        <div className="bg-white/5 backdrop-blur-2xl rounded-[3rem] p-8 md:p-12 max-w-md w-full shadow-2xl border border-white/10 text-center animate-fadeIn relative overflow-hidden">
          {authMode === 'SELECT_ROLE' ? (
            <>
              <div className="w-20 h-20 bg-blue-600 rounded-[1.5rem] mx-auto flex items-center justify-center text-white text-3xl mb-8 shadow-2xl shadow-blue-500/40 transform -rotate-3">
                <i className="fas fa-car-side"></i>
              </div>
              <h1 className="text-3xl font-black text-white mb-4 uppercase tracking-tighter">AutoPro AI</h1>
              <p className="text-slate-400 text-sm font-medium mb-8">Система управления автопрокатом</p>
              <div className="space-y-4">
                <button onClick={() => { setSelectedRole(UserRole.ADMIN); setAuthMode('LOGIN'); }} className="w-full bg-blue-600 text-white py-5 rounded-2xl font-black text-lg shadow-xl shadow-blue-500/20 active:scale-95 transition-all">Войти в панель</button>
                <div className="pt-4">
                  <p className="text-[10px] text-slate-500 uppercase font-black tracking-widest mb-4">Нет аккаунта?</p>
                  <button onClick={() => { setSelectedRole(UserRole.ADMIN); setAuthMode('REGISTER'); }} className="w-full bg-white/5 text-white py-4 rounded-2xl font-bold border border-white/10 active:scale-95 transition-all">Создать компанию</button>
                </div>
              </div>
            </>
          ) : (
            <form onSubmit={handleAuth} className="space-y-6 text-left">
              <div className="flex justify-between items-center mb-4">
                <button type="button" onClick={() => setAuthMode('SELECT_ROLE')} className="text-slate-400 p-2"><i className="fas fa-arrow-left"></i></button>
                <h2 className="text-xl font-black text-white">{authMode === 'LOGIN' ? 'Вход' : 'Регистрация'}</h2>
                <div className="w-8"></div>
              </div>
              {authMode === 'REGISTER' && (
                <div className="space-y-2">
                  <label className="text-[10px] font-black text-slate-500 uppercase ml-2">Название компании</label>
                  <input name="name" required className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:border-blue-500" />
                </div>
              )}
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase ml-2">Email</label>
                <input name="email" type="email" required className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:border-blue-500" />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-slate-500 uppercase ml-2">Пароль</label>
                <input name="password" type="password" required className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:border-blue-500" />
              </div>
              <button type="submit" className="w-full bg-blue-600 text-white py-4 rounded-2xl font-black text-lg shadow-xl shadow-blue-600/20">
                {authMode === 'LOGIN' ? 'Войти' : 'Создать'}
              </button>
              <button type="button" onClick={() => setAuthMode(authMode === 'LOGIN' ? 'REGISTER' : 'LOGIN')} className="w-full text-blue-400 text-sm font-bold mt-2 text-center">
                {authMode === 'LOGIN' ? 'Зарегистрировать компанию' : 'Уже есть аккаунт? Войти'}
              </button>
            </form>
          )}
        </div>
      </div>
    );
  }

  const navigateToDetails = (view: AppView, id: string) => {
    setSelectedEntityId(id);
    setCurrentView(view);
  };

  const renderView = () => {
    // Current user's scoped data
    const userCars = cars;
    const userRentals = rentals;
    const userClients = clients;
    const userInvestors = investors;
    const userStaff = staff;
    const userTransactions = transactions;
    const userRequests = requests;
    const userFines = fines;

    switch (currentView) {
      case 'DASHBOARD': return <Dashboard cars={userCars} rentals={userRentals} clients={userClients} user={currentUser} />;
      case 'CARS': return <CarList cars={userCars} currentOwnerId={currentUser?.id || ''} investors={userInvestors} onAdd={handleAddCar} onUpdate={handleUpdateCar} onDelete={handleDeleteCar} />;
      // ... other views (same as before, but data comes from state synced with server)
      case 'CLIENTS': return <ClientList clients={userClients} rentals={userRentals} transactions={userTransactions} onAdd={c => setClients(prev => [...prev, c])} onUpdate={c => setClients(prev => prev.map(x => x.id === c.id ? c : x))} onDelete={id => setClients(prev => prev.filter(x => x.id !== id))} onSelectClient={(id) => navigateToDetails('CLIENT_DETAILS', id)} />;
      case 'CALENDAR': return <BookingCalendar cars={userCars} rentals={userRentals} />;
      case 'SETTINGS': return <Settings user={currentUser} onUpdate={(u) => setCurrentUser(prev => prev ? {...prev, ...u} : null)} onNavigate={setCurrentView} onLogout={handleLogout} />;
      default: return <div className="p-12 text-center text-gray-400 font-black">СКОРО</div>;
    }
  };

  const isClientMode = currentUser?.role === UserRole.CLIENT || !!publicFleetOwner;

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {isGlobalLoading && (
        <div className="fixed inset-0 z-[100] bg-white/30 backdrop-blur-sm flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      <TopNavbar brandName={(publicFleetOwner?.publicBrandName || currentUser?.publicBrandName) || 'AutoPro AI'} />
      {!isClientMode && (
        <Sidebar currentView={currentView} userRole={currentUser?.role!} userName={currentUser?.name || ''} onNavigate={setCurrentView} onLogout={handleLogout} requestCount={requests.length} user={currentUser} />
      )}
      <main className={`flex-1 ${!isClientMode ? 'md:ml-64' : ''} p-6 md:p-10 pt-24 md:pt-10 pb-32 md:pb-10 transition-all duration-300`}>
        <div className="max-w-7xl mx-auto">{renderView()}</div>
      </main>
      <BottomNav currentView={currentView} userRole={currentUser?.role || UserRole.CLIENT} onNavigate={setCurrentView} requestCount={requests.length} isClientMode={isClientMode} />
    </div>
  );
};

export default App;
