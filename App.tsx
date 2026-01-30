
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
  const [preSelectedRentalId, setPreSelectedRentalId] = useState<string | null>(null);
  const [preIsReservation, setPreIsReservation] = useState(false);

  // States for cross-component report filtering
  const [reportFilterId, setReportFilterId] = useState<string | null>(null);
  const [reportCategory, setReportCategory] = useState<'ALL' | 'INVESTORS' | 'CARS' | 'CLIENTS' | 'FINES'>('ALL');

  const [cars, setCars] = useState<Car[]>([]);
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [fines, setFines] = useState<Fine[]>([]);

  const loadData = async () => {
    const token = localStorage.getItem('autopro_token');
    if (!token) return;
    const fetchData = async <T,>(promise: Promise<T>, setter: (val: T) => void, label: string) => {
      try { const data = await promise; setter(data); } catch (e) { console.warn(`Could not load ${label}:`, e); }
    };
    await Promise.all([
      fetchData(BackendAPI.getCars(), setCars, 'cars'),
      fetchData(BackendAPI.getClients(), setClients, 'clients'),
      fetchData(BackendAPI.getRentals(), setRentals, 'rentals'),
      fetchData(BackendAPI.getTransactions(), setTransactions, 'transactions'),
      fetchData(BackendAPI.getInvestors(), setInvestors, 'investors'),
      fetchData(BackendAPI.getStaff(), setStaff, 'staff'),
      fetchData(BackendAPI.getFines(), setFines, 'fines'),
      fetchData(BackendAPI.getRequests(), setRequests, 'requests')
    ]);
    const user = await BackendAPI.getCurrentUser();
    if (user?.role === UserRole.SUPERADMIN) fetchData(BackendAPI.getAllUsers(), setAllUsers, 'global users');
  };

  useEffect(() => {
    const init = async () => {
      try {
        const user = await BackendAPI.getCurrentUser();
        if (user) { setCurrentUser(user); await loadData(); if (user.role === UserRole.SUPERADMIN) setCurrentView('SUPERADMIN_PANEL'); else if (user.role === UserRole.CLIENT) setCurrentView('CLIENT_CATALOG'); else setCurrentView('DASHBOARD');
        } else { setAuthMode('SELECT_ROLE'); }
      } catch (e: any) { setInitError("Сервер временно недоступен."); } finally { setIsInitializing(false); }
    };
    init();
  }, []);

  const handleSaveRental = async (rental: Rental) => {
    setIsGlobalLoading(true);
    try {
      const saved = await BackendAPI.saveRental(rental);
      if (rental.paymentStatus === 'PAID' && !rental.isReservation) {
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
      await loadData();
      setCurrentView('CONTRACTS');
    } catch (e: any) { alert(e.message); }
    finally { setIsGlobalLoading(false); }
  };

  const handleAuth = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsGlobalLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      const user = authMode === 'REGISTER' ? await BackendAPI.register({ email: fd.get('email') as string, password: fd.get('password') as string, name: fd.get('name') as string, role: selectedRole || UserRole.ADMIN }) : await BackendAPI.login({ email: fd.get('email') as string, password: fd.get('password') as string });
      setCurrentUser(user); await loadData(); if (user.role === UserRole.SUPERADMIN) setCurrentView('SUPERADMIN_PANEL'); else if (user.role === UserRole.CLIENT) setCurrentView('CLIENT_CATALOG'); else setCurrentView('DASHBOARD');
    } catch (err: any) { alert(err.message); } finally { setIsGlobalLoading(false); }
  };

  const handleLogout = () => {
    BackendAPI.logout(); setCurrentUser(null); setAuthMode('SELECT_ROLE'); setCurrentView('DASHBOARD');
    setCars([]); setClients([]); setRentals([]); setTransactions([]); setInvestors([]); setStaff([]); setFines([]); setRequests([]);
  };

  const apiAction = (fn: (...args: any[]) => Promise<any>) => async (...args: any[]) => {
    setIsGlobalLoading(true);
    try { await fn(...args); await loadData(); } catch (e: any) { alert(e.message); } finally { setIsGlobalLoading(false); }
  };

  const renderAuth = () => {
    if (authMode === 'SELECT_ROLE') {
      return (
        <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-white animate-fadeIn">
          <div className="w-20 h-20 bg-blue-600 rounded-[2rem] flex items-center justify-center text-3xl shadow-2xl shadow-blue-500/40 mb-10"><i className="fas fa-car-side"></i></div>
          <h1 className="text-4xl font-black mb-2 tracking-tighter">AutoPro AI</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 w-full max-w-2xl mt-10">
            <button onClick={() => { setSelectedRole(UserRole.ADMIN); setAuthMode('LOGIN'); }} className="group bg-white/5 border border-white/10 p-10 rounded-[3rem] text-left hover:bg-blue-600 transition-all shadow-xl">
              <i className="fas fa-building text-3xl mb-6 text-blue-500 group-hover:text-white"></i>
              <h3 className="text-xl font-black">Компания</h3>
            </button>
            <button onClick={() => { setSelectedRole(UserRole.CLIENT); setAuthMode('LOGIN'); }} className="group bg-white/5 border border-white/10 p-10 rounded-[3rem] text-left hover:bg-emerald-600 transition-all shadow-xl">
              <i className="fas fa-user text-3xl mb-6 text-emerald-500 group-hover:text-white"></i>
              <h3 className="text-xl font-black">Клиент</h3>
            </button>
          </div>
        </div>
      );
    }
    return (
      <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 animate-fadeIn">
        <form onSubmit={handleAuth} className="bg-white rounded-[3rem] w-full max-w-md p-10 md:p-14 shadow-2xl">
          <h2 className="text-3xl font-black text-slate-900 mb-2 tracking-tight">{authMode === 'LOGIN' ? 'Вход' : 'Регистрация'}</h2>
          <div className="space-y-4 mb-10 mt-10">
            {authMode === 'REGISTER' && <input name="name" required placeholder="Полное имя" className="w-full p-5 bg-slate-50 rounded-2xl font-bold outline-none" />}
            <input name="email" type="email" required placeholder="Email адрес" className="w-full p-5 bg-slate-50 rounded-2xl font-bold outline-none" />
            <input name="password" type="password" required placeholder="Пароль" className="w-full p-5 bg-slate-50 rounded-2xl font-bold outline-none" />
          </div>
          <button type="submit" className="w-full py-5 bg-slate-900 text-white rounded-2xl font-black uppercase text-xs hover:bg-blue-600 transition-all shadow-xl active:scale-95">{authMode === 'LOGIN' ? 'Войти' : 'Создать'}</button>
          <div className="mt-8 flex flex-col gap-4 text-center">
            <button type="button" onClick={() => setAuthMode(authMode === 'LOGIN' ? 'REGISTER' : 'LOGIN')} className="text-xs font-bold text-blue-600 hover:underline">{authMode === 'LOGIN' ? 'Зарегистрироваться' : 'Уже есть аккаунт?'}</button>
            <button type="button" onClick={() => setAuthMode('SELECT_ROLE')} className="text-[10px] font-black uppercase text-slate-300 hover:text-slate-500 transition-colors">На главную</button>
          </div>
        </form>
      </div>
    );
  };

  const renderView = () => {
    switch (currentView) {
      case 'DASHBOARD': return <Dashboard cars={cars} rentals={rentals} clients={clients} user={currentUser} />;
      case 'CARS': return (
        <CarList
          cars={cars} investors={investors} rentals={rentals} clients={clients}
          onAdd={apiAction(BackendAPI.saveCar)} onUpdate={apiAction(BackendAPI.saveCar)} onDelete={apiAction(BackendAPI.deleteCar)}
          onIssue={(carId) => { setPreSelectedRentalId(null); setSelectedEntityId(carId); setPreIsReservation(false); setCurrentView('MANUAL_BOOKING'); }}
          onReserve={(carId) => { setPreSelectedRentalId(null); setSelectedEntityId(carId); setPreIsReservation(true); setCurrentView('MANUAL_BOOKING'); }}
          onInfo={(carId) => { setReportFilterId(carId); setReportCategory('CARS'); setCurrentView('REPORTS'); }}
          currentOwnerId={currentUser?.id || ''}
        />
      );
      case 'CLIENTS': return <ClientList clients={clients} rentals={rentals} transactions={transactions} onAdd={apiAction(BackendAPI.saveClient)} onUpdate={apiAction(BackendAPI.saveClient)} onDelete={apiAction(BackendAPI.deleteClient)} onSelectClient={(id) => { setSelectedEntityId(id); setCurrentView('CLIENT_DETAILS'); }} />;
      case 'CALENDAR': return <BookingCalendar cars={cars} rentals={rentals} />;
      case 'REQUESTS': return <BookingRequests requests={requests} cars={cars} onAction={(id) => apiAction(BackendAPI.deleteRequest)(id)} />;
      case 'MANUAL_BOOKING': return <ManualBooking cars={cars} clients={clients} rentals={rentals} preSelectedCarId={selectedEntityId || undefined} preIsReservation={preIsReservation} preSelectedRentalId={preSelectedRentalId} onCreate={handleSaveRental} onQuickAddClient={async (c) => { const res = await BackendAPI.saveClient(c as Client); return res.id; }} />;
      case 'CONTRACTS': return <ContractList rentals={rentals} cars={cars} clients={clients} onUpdate={apiAction(BackendAPI.saveRental)} onDelete={apiAction(BackendAPI.deleteRental)} viewMode="CONTRACTS" brandName={currentUser?.publicBrandName} />;
      case 'BOOKINGS': return <ContractList rentals={rentals} cars={cars} clients={clients} onUpdate={apiAction(BackendAPI.saveRental)} onDelete={apiAction(BackendAPI.deleteRental)} onIssueFromBooking={(id) => { setPreSelectedRentalId(id); setCurrentView('MANUAL_BOOKING'); }} viewMode="BOOKINGS" brandName={currentUser?.publicBrandName} />;
      case 'CONTRACTS_ARCHIVE': return <ContractList rentals={rentals} cars={cars} clients={clients} onUpdate={apiAction(BackendAPI.saveRental)} onDelete={apiAction(BackendAPI.deleteRental)} viewMode="ARCHIVE" brandName={currentUser?.publicBrandName} />;
      case 'AI_ADVISOR': return <AiAdvisor cars={cars} rentals={rentals} />;
      case 'CASHBOX': return <Cashbox transactions={transactions} clients={clients} rentals={rentals} staff={staff} investors={investors} cars={cars} onAddTransaction={apiAction(BackendAPI.saveTransaction)} />;
      case 'INVESTORS': return <InvestorList investors={investors} cars={cars} rentals={rentals} transactions={transactions} onAdd={apiAction(BackendAPI.saveInvestor)} onUpdate={apiAction(BackendAPI.saveInvestor)} onDelete={apiAction(BackendAPI.deleteInvestor)} onSelectInvestor={(id) => { setSelectedEntityId(id); setCurrentView('INVESTOR_DETAILS'); }} />;
      case 'REPORTS': return <Reports transactions={transactions} cars={cars} investors={investors} rentals={rentals} clients={clients} staff={staff} fines={fines} initialSearchId={reportFilterId} initialCategory={reportCategory} />;
      case 'STAFF': return <StaffList staff={staff} onAdd={apiAction(BackendAPI.saveStaff)} onUpdate={apiAction(BackendAPI.saveStaff)} onDelete={apiAction(BackendAPI.deleteStaff)} onSelectStaff={(id) => { setSelectedEntityId(id); setCurrentView('STAFF_DETAILS'); }} />;
      case 'SETTINGS': return <Settings user={currentUser} onUpdate={apiAction((u: any) => BackendAPI.updateGlobalUser(currentUser!.id, u))} onNavigate={setCurrentView} onLogout={handleLogout} />;
      case 'CLIENT_CATALOG': return <ClientCatalog cars={cars.filter(c => c.status === CarStatus.AVAILABLE)} currentUser={currentUser} onSubmitRequest={apiAction(BackendAPI.saveRequest)} fleetOwner={currentUser} onAuthRequest={() => setAuthMode('LOGIN')} onRegisterClient={apiAction(BackendAPI.register)} onLoginClient={(email, pass) => apiAction(BackendAPI.login)({email, password: pass})} />;
      case 'SUPERADMIN_PANEL': return <SuperadminPanel allUsers={allUsers} onUpdateUser={apiAction((id: string, upd: any) => BackendAPI.updateGlobalUser(id, upd))} onDeleteUser={apiAction(BackendAPI.deleteGlobalUser)} />;
      case 'CLIENT_DETAILS': { const client = clients.find(c => c.id === selectedEntityId); return client ? <ClientDetails client={client} rentals={rentals} transactions={transactions} cars={cars} fines={fines} onBack={() => setCurrentView('CLIENTS')} onAddFine={apiAction(BackendAPI.saveFine)} onPayFine={apiAction(BackendAPI.payFine)} /> : <Dashboard cars={cars} rentals={rentals} clients={clients} user={currentUser} />; }
      case 'STAFF_DETAILS': { const member = staff.find(s => s.id === selectedEntityId); return member ? <StaffDetails member={member} onBack={() => setCurrentView('STAFF')} /> : <Dashboard cars={cars} rentals={rentals} clients={clients} user={currentUser} />; }
      case 'INVESTOR_DETAILS': { const investor = investors.find(i => i.id === selectedEntityId); return investor ? <InvestorDetails investor={investor} cars={cars} rentals={rentals} transactions={transactions} onBack={() => setCurrentView('INVESTORS')} /> : <Dashboard cars={cars} rentals={rentals} clients={clients} user={currentUser} />; }
      case 'TARIFFS': return <Tariffs user={currentUser!} onUpdate={apiAction((u: any) => BackendAPI.updateGlobalUser(currentUser!.id, u))} onBack={() => setCurrentView('SETTINGS')} />;
      default: return <Dashboard cars={cars} rentals={rentals} clients={clients} user={currentUser} />;
    }
  };

  if (isInitializing) return <div className="min-h-screen bg-slate-950 flex flex-col items-center justify-center p-6 text-center"><div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-6"></div><h1 className="text-white font-black text-xl uppercase tracking-[0.2em] animate-pulse">AutoPro AI</h1></div>;
  if (!currentUser) return renderAuth();
  const showSidebar = currentUser.role !== UserRole.CLIENT;
  return (
    <div className="min-h-screen bg-slate-50 relative flex overflow-hidden">
      {isGlobalLoading && <div className="fixed inset-0 z-[100] bg-white/40 backdrop-blur-[2px] flex items-center justify-center"><div className="w-14 h-14 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div></div>}
      <TopNavbar brandName={currentUser.publicBrandName || 'AutoPro AI'} />
      {showSidebar && (
        <Sidebar
          currentView={currentView} userRole={currentUser.role} userName={currentUser.name} onNavigate={setCurrentView} onLogout={handleLogout}
          requestCount={requests.length} rentalCount={rentals.filter(r => !r.isReservation && r.status === 'ACTIVE').length} bookingCount={rentals.filter(r => r.isReservation && r.status === 'ACTIVE').length} user={currentUser}
        />
      )}
      <main className={`flex-1 overflow-y-auto transition-all duration-300 min-h-screen ${showSidebar ? 'md:ml-64' : ''} p-6 md:p-10 pt-32 md:pt-12 pb-44 md:pb-12`}>
        <div className="max-w-7xl mx-auto">{renderView()}</div>
      </main>
      <BottomNav currentView={currentView} userRole={currentUser.role} onNavigate={setCurrentView} requestCount={requests.length} isClientMode={currentUser.role === UserRole.CLIENT} />
    </div>
  );
};

export default App;
