import React, { useState, useEffect } from 'react';
import { User, Car, Rental, Client, BookingRequest, AppView, UserRole, CarStatus, Transaction, TransactionType, Investor, Staff, Fine, FineStatus } from './types';
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

  const [allUsers, setAllUsers] = useState<User[]>([{
    id: 'super-01',
    name: 'Global Admin',
    email: 'admin@autopro.ai',
    password: 'admin',
    role: UserRole.SUPERADMIN,
    activePlan: 'System'
  }]);

  const [authMode, setAuthMode] = useState<'SELECT_ROLE' | 'LOGIN' | 'REGISTER'>('SELECT_ROLE');
  const [selectedRole, setSelectedRole] = useState<UserRole | null>(null);
  const [currentView, setCurrentView] = useState<AppView>('DASHBOARD');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [publicFleetOwner, setPublicFleetOwner] = useState<User | null>(null);

  // Все состояния теперь пустые — данные загружаются с сервера
  const [cars, setCars] = useState<Car[]>([]);
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [fines, setFines] = useState<Fine[]>([]);

  // Загрузка данных с сервера
  useEffect(() => {
    const loadData = async () => {
      try {
        const user = await BackendAPI.getCurrentUser();
        if (!user) {
          setIsInitializing(false);
          return;
        }

        setCurrentUser(user);

        // Загружаем все данные параллельно
        const [
          carsData,
          clientsData,
          rentalsData,
          investorsData,
          staffData,
          transactionsData,
          finesData,
          requestsData
        ] = await Promise.all([
          BackendAPI.getCars(),
          BackendAPI.getClients(),
          BackendAPI.getRentals(),
          BackendAPI.getInvestors(),
          BackendAPI.getStaff(),
          BackendAPI.getTransactions(),
          BackendAPI.getFines(),
          BackendAPI.getRequests()
        ]);

        setCars(carsData);
        setClients(clientsData);
        setRentals(rentalsData);
        setInvestors(investorsData);
        setStaff(staffData);
        setTransactions(transactionsData);
        setFines(finesData);
        setRequests(requestsData);

        // Определяем начальный вид
        const initialView = user.role === UserRole.CLIENT 
          ? 'CLIENT_CATALOG' 
          : (user.role === UserRole.SUPERADMIN ? 'SUPERADMIN_PANEL' : 'DASHBOARD');
        setCurrentView(initialView);
      } catch (error) {
        console.error('Failed to load data:', error);
      } finally {
        setIsInitializing(false);
      }
    };

    loadData();

    // Service Worker
    if ('serviceWorker' in navigator) {
      window.addEventListener('load', () => {
        navigator.serviceWorker.register('/service-worker.js').catch(err => console.log('SW registration failed', err));
      });
    }
  }, []);

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsGlobalLoading(true);
    const fd = new FormData(e.currentTarget);
    const email = fd.get('email') as string;
    const pass = fd.get('password') as string;
    const name = fd.get('name') as string;

    try {
      if (authMode === 'REGISTER') {
        const newUser = await BackendAPI.register({
          email,
          password: pass,
          name,
          role: selectedRole || UserRole.ADMIN
        });
        setCurrentUser(newUser);
      } else {
        const user = await BackendAPI.login({ email, password: pass });
        setCurrentUser(user);
      }

      // После входа/регистрации перезагружаем данные
      const [
        carsData,
        clientsData,
        rentalsData,
        investorsData,
        staffData,
        transactionsData,
        finesData,
        requestsData
      ] = await Promise.all([
        BackendAPI.getCars(),
        BackendAPI.getClients(),
        BackendAPI.getRentals(),
        BackendAPI.getInvestors(),
        BackendAPI.getStaff(),
        BackendAPI.getTransactions(),
        BackendAPI.getFines(),
        BackendAPI.getRequests()
      ]);

      setCars(carsData);
      setClients(clientsData);
      setRentals(rentalsData);
      setInvestors(investorsData);
      setStaff(staffData);
      setTransactions(transactionsData);
      setFines(finesData);
      setRequests(requestsData);

      setCurrentView(currentUser?.role === UserRole.CLIENT ? 'CLIENT_CATALOG' : (currentUser?.role === UserRole.SUPERADMIN ? 'SUPERADMIN_PANEL' : 'DASHBOARD'));
    } catch (error) {
      alert('Ошибка аутентификации');
      console.error('Auth error:', error);
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const handleLogout = () => {
    BackendAPI.logout();
    setCurrentUser(null);
    setAuthMode('SELECT_ROLE');
    setCurrentView('DASHBOARD');
    // Очищаем данные при выходе
    setCars([]);
    setClients([]);
    setRentals([]);
    setInvestors([]);
    setStaff([]);
    setTransactions([]);
    setFines([]);
    setRequests([]);
  };

  const handleUpdateGlobalUser = async (userId: string, updates: Partial<User>) => {
    try {
      await BackendAPI.updateGlobalUser(userId, updates);
      // Обновляем локальные данные
      setAllUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
      if (currentUser?.id === userId) {
        setCurrentUser(prev => prev ? { ...prev, ...updates } : null);
      }
    } catch (error) {
      console.error('Failed to update user:', error);
    }
  };

  const handleDeleteGlobalUser = async (userId: string) => {
    try {
      await BackendAPI.deleteGlobalUser(userId);
      setAllUsers(prev => prev.filter(u => u.id !== userId));
    } catch (error) {
      console.error('Failed to delete user:', error);
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

  const activeOwnerId = publicFleetOwner ? publicFleetOwner.id : (currentUser?.id || '');

  const userCars = cars.filter(c => c.ownerId === activeOwnerId);
  const userRentals = rentals.filter(r => r.ownerId === activeOwnerId || r.clientId === currentUser?.id);
  const userClients = clients.filter(c => c.ownerId === activeOwnerId);
  const userInvestors = investors.filter(i => i.ownerId === activeOwnerId);
  const userStaff = staff.filter(s => s.ownerId === activeOwnerId);
  const userTransactions = transactions.filter(t => t.ownerId === activeOwnerId);
  const userRequests = requests.filter(r => r.ownerId === activeOwnerId || r.clientId === currentUser?.id);
  const userFines = fines.filter(f => f.ownerId === activeOwnerId);

  const handleAddTransaction = async (tData: Partial<Transaction>, clientId?: string) => {
    if (!currentUser) return;
    try {
      const newTx = await BackendAPI.saveTransaction({
        ...tData,
        ownerId: activeOwnerId,
        amount: tData.amount || 0,
        type: tData.type || TransactionType.INCOME,
        category: tData.category || 'Прочее',
        description: tData.description || '',
        date: tData.date || new Date().toISOString(),
        clientId,
        investorId: tData.investorId,
        carId: tData.carId
      });
      setTransactions(prev => [...prev, newTx]);
    } catch (error) {
      console.error('Failed to add transaction:', error);
    }
  };

  const handleAddCar = async (car: Car) => {
    setIsGlobalLoading(true);
    try {
      const saved = await BackendAPI.saveCar({ ...car, ownerId: activeOwnerId });
      setCars(prev => [...prev, saved]);
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const handleUpdateCar = async (car: Car) => {
    setIsGlobalLoading(true);
    try {
      const saved = await BackendAPI.saveCar(car);
      setCars(prev => prev.map(c => c.id === car.id ? saved : c));
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const handleDeleteCar = async (id: string) => {
    setIsGlobalLoading(true);
    try {
      await BackendAPI.deleteCar(id);
      setCars(prev => prev.filter(c => c.id !== id));
    } finally {
      setIsGlobalLoading(false);
    }
  };

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
    switch (currentView) {
      case 'DASHBOARD': return <Dashboard cars={userCars} rentals={userRentals} clients={userClients} user={currentUser} />;
      case 'CARS': return <CarList cars={userCars} currentOwnerId={activeOwnerId} investors={userInvestors} onAdd={handleAddCar} onUpdate={handleUpdateCar} onDelete={handleDeleteCar} />;
      case 'CLIENTS': return <ClientList clients={userClients} rentals={userRentals} transactions={userTransactions} onAdd={c => handleAddClient({ ...c, ownerId: activeOwnerId })} onUpdate={handleUpdateClient} onDelete={handleDeleteClient} onSelectClient={(id) => navigateToDetails('CLIENT_DETAILS', id)} />;
      case 'CALENDAR': return <BookingCalendar cars={userCars} rentals={userRentals} />;
      case 'REQUESTS': return <BookingRequests requests={userRequests} cars={userCars} onAction={handleBookingAction} />;
      case 'MANUAL_BOOKING': return <ManualBooking cars={userCars} clients={userClients} onCreate={handleCreateRental} onQuickAddClient={handleQuickAddClient} />;
      case 'CONTRACTS': return <ContractList rentals={userRentals} cars={userCars} clients={userClients} onUpdate={handleUpdateRental} onDelete={handleDeleteRental} />;
      case 'CONTRACTS_ARCHIVE': return <ContractList rentals={userRentals} cars={userCars} clients={userClients} onUpdate={handleUpdateRental} onDelete={handleDeleteRental} isArchive={true} />;
      case 'INVESTORS': return <InvestorList investors={userInvestors} cars={userCars} rentals={userRentals} transactions={userTransactions} onAdd={i => handleAddInvestor({ ...i, ownerId: activeOwnerId })} onUpdate={handleUpdateInvestor} onDelete={handleDeleteInvestor} onSelectInvestor={(id) => navigateToDetails('INVESTOR_DETAILS', id)} />;
      case 'CASHBOX': return <Cashbox transactions={userTransactions} clients={userClients} rentals={userRentals} staff={userStaff} investors={userInvestors} cars={userCars} onAddTransaction={handleAddTransaction} />;
      case 'REPORTS': return <Reports transactions={userTransactions} cars={userCars} investors={userInvestors} rentals={userRentals} clients={userClients} staff={userStaff} fines={userFines} />;
      case 'STAFF': return <StaffList staff={userStaff} onAdd={s => handleAddStaff({ ...s, ownerId: activeOwnerId })} onUpdate={handleUpdateStaff} onDelete={handleDeleteStaff} onSelectStaff={(id) => navigateToDetails('STAFF_DETAILS', id)} />;
      case 'SETTINGS': return <Settings user={currentUser} onUpdate={(u) => setCurrentUser(prev => prev ? {...prev, ...u} : null)} onNavigate={setCurrentView} onLogout={handleLogout} />;
      case 'BRANDING_SETTINGS': return <Settings user={currentUser} currentMode="BRANDING" onUpdate={(u) => setCurrentUser(prev => prev ? {...prev, ...u} : null)} onNavigate={setCurrentView} onLogout={handleLogout} />;
      case 'TARIFFS': return <Tariffs user={currentUser!} onUpdate={(u) => setCurrentUser(prev => prev ? {...prev, ...u} : null)} onBack={() => setCurrentView('SETTINGS')} />;
      case 'SUPERADMIN_PANEL': return <SuperadminPanel allUsers={allUsers} onUpdateUser={handleUpdateGlobalUser} onDeleteUser={handleDeleteGlobalUser} />;
      case 'CLIENT_CATALOG': return (
        <ClientCatalog
          cars={userCars.filter(c => c.status === CarStatus.AVAILABLE)}
          currentUser={currentUser}
          onSubmitRequest={(req) => handleAddRequest({ ...req, ownerId: activeOwnerId })}
          fleetOwner={publicFleetOwner || currentUser}
          onAuthRequest={() => { setAuthMode('LOGIN'); setSelectedRole(UserRole.CLIENT); }}
          onRegisterClient={(data) => {
            handleAuthWithClientData(data);
          }}
          onLoginClient={(email, pass) => {
            handleAuthWithClientData({ email, password: pass });
          }}
        />
      );
      case 'CLIENT_MY_BOOKINGS': return (
        <div className="space-y-6">
          <h2 className="text-2xl font-black">Мои бронирования</h2>
          {userRentals.length === 0 ? <p className="text-slate-400">У вас пока нет активных аренд</p> : (
            <div className="grid gap-4">
              {userRentals.map(r => (
                <div key={r.id} className="p-6 bg-white rounded-3xl border border-slate-100 flex justify-between items-center shadow-sm">
                  <div>
                    <div className="font-bold text-lg">{cars.find(c => c.id === r.carId)?.brand} {cars.find(c => c.id === r.carId)?.model}</div>
                    <div className="text-sm text-slate-400">{r.startDate} - {r.endDate}</div>
                  </div>
                  <div className="text-right">
                    <div className="font-black text-blue-600">{r.totalAmount} ₽</div>
                    <div className="text-[10px] uppercase font-black">{r.status}</div>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      );

      case 'CLIENT_DETAILS': {
        const client = clients.find(c => c.id === selectedEntityId);
        return client ? <ClientDetails client={client} rentals={userRentals} transactions={userTransactions} cars={userCars} fines={userFines} onBack={() => setCurrentView('CLIENTS')} onAddFine={handleAddFine} onPayFine={handlePayFine} /> : null;
      }
      case 'STAFF_DETAILS': {
        const member = staff.find(s => s.id === selectedEntityId);
        return member ? <StaffDetails member={member} onBack={() => setCurrentView('STAFF')} /> : null;
      }
      case 'INVESTOR_DETAILS': {
        const investor = investors.find(i => i.id === selectedEntityId);
        return investor ? <InvestorDetails investor={investor} cars={userCars} rentals={userRentals} transactions={userTransactions} onBack={() => setCurrentView('INVESTORS')} /> : null;
      }

      default: return <div className="p-12 text-center text-gray-400 font-black">СКОРО</div>;
    }
  };

  // Новые методы для работы с API
  const handleAddClient = async (client: Client) => {
    try {
      const saved = await BackendAPI.saveClient(client);
      setClients(prev => [...prev, saved]);
    } catch (error) {
      console.error('Failed to add client:', error);
    }
  };

  const handleUpdateClient = async (client: Client) => {
    try {
      const saved = await BackendAPI.saveClient(client);
      setClients(prev => prev.map(c => c.id === client.id ? saved : c));
    } catch (error) {
      console.error('Failed to update client:', error);
    }
  };

  const handleDeleteClient = async (id: string) => {
    try {
      await BackendAPI.deleteClient(id);
      setClients(prev => prev.filter(c => c.id !== id));
    } catch (error) {
      console.error('Failed to delete client:', error);
    }
  };

  const handleAddInvestor = async (investor: Investor) => {
    try {
      const saved = await BackendAPI.saveInvestor(investor);
      setInvestors(prev => [...prev, saved]);
    } catch (error) {
      console.error('Failed to add investor:', error);
    }
  };

  const handleUpdateInvestor = async (investor: Investor) => {
    try {
      const saved = await BackendAPI.saveInvestor(investor);
      setInvestors(prev => prev.map(i => i.id === investor.id ? saved : i));
    } catch (error) {
      console.error('Failed to update investor:', error);
    }
  };

  const handleDeleteInvestor = async (id: string) => {
    try {
      await BackendAPI.deleteInvestor(id);
      setInvestors(prev => prev.filter(i => i.id !== id));
    } catch (error) {
      console.error('Failed to delete investor:', error);
    }
  };

  const handleAddStaff = async (staffMember: Staff) => {
    try {
      const saved = await BackendAPI.saveStaff(staffMember);
      setStaff(prev => [...prev, saved]);
    } catch (error) {
      console.error('Failed to add staff:', error);
    }
  };

  const handleUpdateStaff = async (staffMember: Staff) => {
    try {
      const saved = await BackendAPI.saveStaff(staffMember);
      setStaff(prev => prev.map(s => s.id === staffMember.id ? saved : s));
    } catch (error) {
      console.error('Failed to update staff:', error);
    }
  };

  const handleDeleteStaff = async (id: string) => {
    try {
      await BackendAPI.deleteStaff(id);
      setStaff(prev => prev.filter(s => s.id !== id));
    } catch (error) {
      console.error('Failed to delete staff:', error);
    }
  };

  const handleAddRequest = async (request: BookingRequest) => {
    try {
      const saved = await BackendAPI.saveRequest(request);
      setRequests(prev => [...prev, saved]);
    } catch (error) {
      console.error('Failed to add request:', error);
    }
  };

  const handleUpdateRental = async (updatedRental: Rental) => {
    try {
      const saved = await BackendAPI.saveRental(updatedRental);
      setRentals(prev => prev.map(r => r.id === updatedRental.id ? saved : r));
      
      // Обновляем статус автомобиля
      if (updatedRental.status === 'COMPLETED') {
        setCars(prev => prev.map(c => c.id === updatedRental.carId ? { ...c, status: CarStatus.AVAILABLE } : c));
      } else if (updatedRental.status === 'ACTIVE') {
        setCars(prev => prev.map(c => c.id === updatedRental.carId ? { ...c, status: CarStatus.RENTED } : c));
      }
    } catch (error) {
      console.error('Failed to update rental:', error);
    }
  };

  const handleCreateRental = async (rental: Rental, isDebt: boolean = false) => {
    try {
      const newRental = await BackendAPI.saveRental({
        ...rental,
        ownerId: activeOwnerId,
        paymentStatus: isDebt ? 'DEBT' : 'PAID'
      });
      setRentals(prev => [...prev, newRental]);
      setCars(prev => prev.map(c => c.id === rental.carId ? { ...c, status: CarStatus.RENTED } : c));
      
      if (!isDebt) {
        handleAddTransaction({
          amount: rental.totalAmount,
          type: TransactionType.INCOME,
          category: 'Аренда',
          description: `Аренда по дог. ${rental.contractNumber} (Оплачено)`,
          carId: rental.carId
        }, rental.clientId);
      }
      
      setCurrentView('CONTRACTS');
    } catch (error) {
      console.error('Failed to create rental:', error);
    }
  };

  const handleDeleteRental = async (id: string) => {
    try {
      const rental = rentals.find(r => r.id === id);
      if (rental && rental.status === 'ACTIVE') {
        setCars(prev => prev.map(c => c.id === rental.carId ? { ...c, status: CarStatus.AVAILABLE } : c));
      }
      await BackendAPI.deleteRental(id);
      setRentals(prev => prev.filter(r => r.id !== id));
    } catch (error) {
      console.error('Failed to delete rental:', error);
    }
  };

  const handleBookingAction = async (id: string, action: 'APPROVE' | 'REJECT') => {
    try {
      const req = requests.find(r => r.id === id);
      if (!req) return;
      
      if (action === 'APPROVE') {
        const car = cars.find(c => c.id === req.carId);
        await handleCreateRental({ 
          id: `rent-${Date.now()}`, 
          ownerId: activeOwnerId, 
          carId: req.carId, 
          clientId: req.clientId, 
          startDate: req.startDate, 
          startTime: req.startTime, 
          endDate: req.endDate, 
          endTime: req.endTime, 
          totalAmount: car ? car.pricePerDay : 15000, 
          status: 'ACTIVE', 
          contractNumber: `дог-авто-${Math.floor(Math.random() * 9000) + 1000}` 
        }, false);
      }
      
      await BackendAPI.deleteRequest(id);
      setRequests(prev => prev.filter(r => r.id !== id));
    } catch (error) {
      console.error('Failed to process booking request:', error);
    }
  };

  const handleQuickAddClient = async (clientData: Partial<Client>) => {
    try {
      const newClient = await BackendAPI.saveClient({
        ...clientData,
        id: `c-${Date.now()}`,
        ownerId: activeOwnerId,
        debt: 0,
        createdAt: new Date().toISOString()
      } as Client);
      setClients(prev => [...prev, newClient]);
      return newClient.id;
    } catch (error) {
      console.error('Failed to add client:', error);
      return null;
    }
  };

  const handleAddFine = async (fData: Partial<Fine>) => {
    try {
      const newFine = await BackendAPI.saveFine({
        ...fData,
        id: `fine-${Date.now()}`,
        ownerId: activeOwnerId,
        status: FineStatus.UNPAID,
        date: fData.date || new Date().toISOString()
      } as Fine);
      setFines(prev => [...prev, newFine]);
    } catch (error) {
      console.error('Failed to add fine:', error);
    }
  };

  const handlePayFine = async (fineId: string) => {
    try {
      const fine = fines.find(f => f.id === fineId);
      if (!fine) return;
      
      await BackendAPI.payFine(fineId);
      setFines(prev => prev.map(f => f.id === fineId ? { ...f, status: FineStatus.PAID } : f));
      
      handleAddTransaction({
        amount: fine.amount,
        type: TransactionType.INCOME,
        category: 'Штраф',
        description: `Оплата штрафа: ${fine.description} (${fine.source})`,
        carId: fine.carId
      }, fine.clientId);
    } catch (error) {
      console.error('Failed to pay fine:', error);
    }
  };

  const handleAuthWithClientData = async (data: any) => {
    try {
      if (data.password) {
        const user = await BackendAPI.login({ email: data.email, password: data.password });
        setCurrentUser(user);
      } else {
        const user = await BackendAPI.register({ ...data, role: UserRole.CLIENT });
        setCurrentUser(user);
      }
      
      // Перезагружаем данные
      const [
        carsData,
        clientsData,
        rentalsData,
        investorsData,
        staffData,
        transactionsData,
        finesData,
        requestsData
      ] = await Promise.all([
        BackendAPI.getCars(),
        BackendAPI.getClients(),
        BackendAPI.getRentals(),
        BackendAPI.getInvestors(),
        BackendAPI.getStaff(),
        BackendAPI.getTransactions(),
        BackendAPI.getFines(),
        BackendAPI.getRequests()
      ]);

      setCars(carsData);
      setClients(clientsData);
      setRentals(rentalsData);
      setInvestors(investorsData);
      setStaff(staffData);
      setTransactions(transactionsData);
      setFines(finesData);
      setRequests(requestsData);
    } catch (error) {
      alert('Ошибка аутентификации клиента');
      console.error('Client auth error:', error);
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
        <Sidebar currentView={currentView} userRole={currentUser?.role!} userName={currentUser?.name || ''} onNavigate={setCurrentView} onLogout={handleLogout} requestCount={userRequests.length} user={currentUser} />
      )}
      <main className={`flex-1 ${!isClientMode ? 'md:ml-64' : ''} p-6 md:p-10 pt-24 md:pt-10 pb-32 md:pb-10 transition-all duration-300`}>
        <div className="max-w-7xl mx-auto">{renderView()}</div>
      </main>
      <BottomNav currentView={currentView} userRole={currentUser?.role || UserRole.CLIENT} onNavigate={setCurrentView} requestCount={userRequests.length} isClientMode={isClientMode} />
    </div>
  );
};

export default App;