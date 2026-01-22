
import React, { useState, useEffect } from 'react';
import { User, Car, Rental, Client, BookingRequest, AppView, UserRole, CarStatus, Transaction, TransactionType, Investor, Staff, Fine, FineStatus } from './types';
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
  const [initError, setInitError] = useState<string | null>(null);
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);

  const [allUsers, setAllUsers] = useState<User[]>([]);
  const [authMode, setAuthMode] = useState<'SELECT_ROLE' | 'LOGIN' | 'REGISTER'>('SELECT_ROLE');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [currentView, setCurrentView] = useState<AppView>('DASHBOARD');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);

  const [cars, setCars] = useState<Car[]>([]);
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [fines, setFines] = useState<Fine[]>([]);

  const loadData = async (currentUser: User) => {
  try {
    const [c, cl, r, t, i, s, f, req] = await Promise.all([
      BackendAPI.getCars(),
      BackendAPI.getClients(),
      BackendAPI.getRentals(),
      BackendAPI.getTransactions(),
      BackendAPI.getInvestors(),
      BackendAPI.getStaff(),
      BackendAPI.getFines(),
      BackendAPI.getRequests()
    ]);

    setCars(c || []);
    setClients(cl || []);
    setRentals(r || []);
    setTransactions(t || []);
    setInvestors(i || []);
    setStaff(s || []);
    setFines(f || []);
    setRequests(req || []);

    // Загружаем всех пользователей ТОЛЬКО для SUPERADMIN
    if (currentUser.role === UserRole.SUPERADMIN) {
      const users = await BackendAPI.getAllUsers();
      setAllUsers(users || []);
    }
  } catch (e) {
    console.error("Failed to load application data", e);
    throw e;
  }
};

  useEffect(() => {
    const init = async () => {
  try {
    const user = await BackendAPI.getCurrentUser();
    if (user) {
      setCurrentUser(user);
      await loadData(user); // ← передаём уже полученного пользователя

      if (user.role === UserRole.SUPERADMIN) setCurrentView('SUPERADMIN_PANEL');
      else if (user.role === UserRole.CLIENT) setCurrentView('CLIENT_CATALOG');
      else setCurrentView('DASHBOARD');
    }
  } catch (e: any) {
    console.error("Init error", e);
    setInitError("Не удалось подключиться к серверу. Убедитесь, что API запущен.");
  } finally {
    setIsInitializing(false);
  }
};
    init();
  }, []);

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsGlobalLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const user = authMode === 'REGISTER' 
        ? await BackendAPI.register({ 
            email: fd.get('email') as string, 
            password: fd.get('password') as string, 
            name: fd.get('name') as string, 
            role: selectedRole || UserRole.ADMIN 
          })
        : await BackendAPI.login({ 
            email: fd.get('email') as string, 
            password: fd.get('password') as string 
          });
      
      setCurrentUser(user);
      await loadData();
      setCurrentView(user.role === UserRole.CLIENT ? 'CLIENT_CATALOG' : (user.role === UserRole.SUPERADMIN ? 'SUPERADMIN_PANEL' : 'DASHBOARD'));
    } catch (err: any) {
      alert(err.message);
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const handleLogout = () => {
    BackendAPI.logout();
    setCurrentUser(null);
    setAuthMode('SELECT_ROLE');
    setCurrentView('DASHBOARD');
    setCars([]); setClients([]); setRentals([]); setTransactions([]); setInvestors([]); setStaff([]); setFines([]); setRequests([]);
  };

  const apiAction = (fn: Function) => async (...args: any[]) => {
    setIsGlobalLoading(true);
    try {
      await fn(...args);
      await loadData();
    } catch (e: any) {
      alert(e.message);
    } finally {
      setIsGlobalLoading(false);
    }
  };

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-6"></div>
        <h1 className="text-white font-black text-xl uppercase tracking-[0.2em]">AutoPro AI</h1>
        <p className="mt-2 text-slate-500 font-bold uppercase tracking-widest text-[10px]">Загрузка системы...</p>
      </div>
    );
  }

  if (initError && !currentUser) {
    return (
      <div className="min-h-screen bg-slate-50 flex flex-col items-center justify-center p-6 text-center">
        <div className="w-20 h-20 bg-rose-100 text-rose-600 rounded-[2rem] flex items-center justify-center text-3xl mb-6">
          <i className="fas fa-exclamation-triangle"></i>
        </div>
        <h2 className="text-2xl font-black text-slate-900 mb-2">Ошибка подключения</h2>
        <p className="text-slate-500 max-w-xs mb-8 font-medium">{initError}</p>
        <button 
          onClick={() => window.location.reload()} 
          className="bg-blue-600 text-white px-8 py-4 rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-500/20 hover:bg-blue-700 transition-all"
        >
          Попробовать снова
        </button>
      </div>
    );
  }

  const renderView = () => {
    switch (currentView) {
      case 'DASHBOARD': return <Dashboard cars={cars} rentals={rentals} clients={clients} user={currentUser} />;
      case 'CARS': return <CarList cars={cars} investors={investors} onAdd={apiAction(BackendAPI.saveCar)} onUpdate={apiAction(BackendAPI.saveCar)} onDelete={apiAction(BackendAPI.deleteCar)} currentOwnerId={currentUser?.id || ''} />;
      case 'CLIENTS': return <ClientList clients={clients} rentals={rentals} transactions={transactions} onAdd={apiAction(BackendAPI.saveClient)} onUpdate={apiAction(BackendAPI.saveClient)} onDelete={apiAction(BackendAPI.deleteClient)} onSelectClient={(id) => { setSelectedEntityId(id); setCurrentView('CLIENT_DETAILS'); }} />;
      case 'CALENDAR': return <BookingCalendar cars={cars} rentals={rentals} />;
      case 'REQUESTS': return <BookingRequests requests={requests} cars={cars} onAction={apiAction(BackendAPI.deleteRequest)} />;
      case 'MANUAL_BOOKING': return <ManualBooking cars={cars} clients={clients} onCreate={apiAction(BackendAPI.saveRental)} onQuickAddClient={async (c) => { const res = await BackendAPI.saveClient(c as Client); return res.id; }} />;
      case 'CONTRACTS': return <ContractList rentals={rentals} cars={cars} clients={clients} onUpdate={apiAction(BackendAPI.saveRental)} onDelete={apiAction(BackendAPI.deleteRental)} />;
      case 'AI_ADVISOR': return <AiAdvisor cars={cars} rentals={rentals} />;
      case 'CASHBOX': return <Cashbox transactions={transactions} clients={clients} rentals={rentals} staff={staff} investors={investors} cars={cars} onAddTransaction={apiAction(BackendAPI.saveTransaction)} />;
      case 'INVESTORS': return <InvestorList investors={investors} cars={cars} rentals={rentals} transactions={transactions} onAdd={apiAction(BackendAPI.saveInvestor)} onUpdate={apiAction(BackendAPI.saveInvestor)} onDelete={apiAction(BackendAPI.deleteInvestor)} onSelectInvestor={(id) => { setSelectedEntityId(id); setCurrentView('INVESTOR_DETAILS'); }} />;
      case 'REPORTS': return <Reports transactions={transactions} cars={cars} investors={investors} rentals={rentals} clients={clients} staff={staff} fines={fines} />;
      case 'STAFF': return <StaffList staff={staff} onAdd={apiAction(BackendAPI.saveStaff)} onUpdate={apiAction(BackendAPI.saveStaff)} onDelete={apiAction(BackendAPI.deleteStaff)} onSelectStaff={(id) => { setSelectedEntityId(id); setCurrentView('STAFF_DETAILS'); }} />;
      case 'SETTINGS': return <Settings user={currentUser} onUpdate={apiAction((u: any) => BackendAPI.updateGlobalUser(currentUser!.id, u))} onNavigate={setCurrentView} onLogout={handleLogout} />;
      case 'CLIENT_CATALOG': return <ClientCatalog cars={cars.filter(c => c.status === CarStatus.AVAILABLE)} currentUser={currentUser} onSubmitRequest={apiAction(BackendAPI.saveRequest)} fleetOwner={currentUser} onAuthRequest={() => setAuthMode('LOGIN')} onRegisterClient={apiAction(BackendAPI.register)} onLoginClient={apiAction(BackendAPI.login)} />;
      default: return <Dashboard cars={cars} rentals={rentals} clients={clients} user={currentUser} />;
    }
  };

  if (!currentUser) {
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
                  <input name="name" required className="w-full p-4 bg-white/5 border border-white/10 rounded-2xl text-white outline-none focus:border-blue-500 placeholder-white/20" placeholder="My Rental Brand" />
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

  return (
    <div className="min-h-screen flex flex-col md:flex-row bg-slate-50">
      {isGlobalLoading && (
        <div className="fixed inset-0 z-[100] bg-white/30 backdrop-blur-sm flex items-center justify-center">
          <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}
      <TopNavbar brandName={currentUser?.publicBrandName || 'AutoPro AI'} />
      {currentUser && currentUser.role !== UserRole.CLIENT && (
        <Sidebar 
          currentView={currentView} 
          userRole={currentUser.role} 
          userName={currentUser.name} 
          onNavigate={setCurrentView} 
          onLogout={handleLogout} 
          requestCount={requests.length} 
          user={currentUser} 
        />
      )}
      <main className={`flex-1 ${currentUser && currentUser.role !== UserRole.CLIENT ? 'md:ml-64' : ''} p-6 md:p-10 pt-24 md:pt-10 pb-32 md:pb-10 transition-all`}>
        <div className="max-w-7xl mx-auto">{renderView()}</div>
      </main>
      {currentUser && (
        <BottomNav 
          currentView={currentView} 
          userRole={currentUser.role} 
          onNavigate={setCurrentView} 
          requestCount={requests.length} 
          isClientMode={currentUser.role === UserRole.CLIENT} 
        />
      )}
    </div>
  );
};

export default App;
