
import 'process';
import React, { useState, useEffect } from 'react';
import {
  User, Car, Rental, Client, BookingRequest, AppView,
  Transaction, TransactionType, Investor, Staff, Fine, UserRole, RequestStatus
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
import Tariffs from './components/Tariffs';
import InvestorList from './components/InvestorList';
import StaffList from './components/StaffList';
import InvestorDetails from './components/InvestorDetails';
import StaffDetails from './components/StaffDetails';
import SuperadminPanel from './components/SuperadminPanel';
import ClientCatalog from './components/ClientCatalog';
import SubscriptionExpiredModal from './components/SubscriptionExpiredModal';
import BackendAPI from './services/api';

const App: React.FC = () => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [isGlobalLoading, setIsGlobalLoading] = useState(false);
  const [currentView, setCurrentView] = useState<AppView>('DASHBOARD');
  const [selectedEntityId, setSelectedEntityId] = useState<string | null>(null);
  const [fleetOwner, setFleetOwner] = useState<User | null>(null);

  // Auth State
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [authLoading, setAuthLoading] = useState(false);

  // Access Control State
  const [showUpgradeModal, setShowUpgradeModal] = useState(false);
  const [upgradeModalContent, setUpgradeModalContent] = useState({ title: '', message: '' });

  const [cars, setCars] = useState<Car[]>([]);
  const [requests, setRequests] = useState<BookingRequest[]>([]);
  const [rentals, setRentals] = useState<Rental[]>([]);
  const [clients, setClients] = useState<Client[]>([]);
  const [investors, setInvestors] = useState<Investor[]>([]);
  const [staff, setStaff] = useState<Staff[]>([]);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [fines, setFines] = useState<Fine[]>([]);
  const [allUsers, setAllUsers] = useState<User[]>([]);

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

  useEffect(() => {
    const init = async () => {
      try {
        const user = await BackendAPI.getCurrentUser();
        // Always try to load public fleet if param is present, regardless of auth status
        // This ensures clients see the correct cars
        const urlParams = new URLSearchParams(window.location.search);
        const fleetSlug = urlParams.get('fleet');

        if (fleetSlug) {
           try {
              const publicData = await BackendAPI.getPublicFleet(fleetSlug);
              setCars(publicData.cars);
              // Only overwrite rentals if not admin, or merge logic needed
              // For simplicity, we trust loadData for admins, and publicData for clients/guests
              if (!user || user.role === UserRole.CLIENT) {
                 setRentals(publicData.rentals);
                 setFleetOwner(publicData.owner);
              }
           } catch (err) {
              console.error('Failed to load public fleet', err);
           }
        }

        if (user) {
          setCurrentUser(user);
          if (user.role !== UserRole.CLIENT) {
             await loadData();
          } else {
             // For clients, we still need their own requests and rentals info (e.g. debt)
             // getRequests/getRentals returns data filtered by client_id = user.id
             const reqs = await BackendAPI.getRequests();
             setRequests(reqs);
             // Note: Cars are already loaded via getPublicFleet above if slug exists
          }

          if (user.role === UserRole.CLIENT) {
            setCurrentView('CLIENT_CATALOG');
          }
        } else {
          // Public guest view
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

  const handleAuthSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setAuthLoading(true);
    const fd = new FormData(e.currentTarget);
    const email = fd.get('email') as string;
    const password = fd.get('password') as string;
    const name = fd.get('name') as string;

    try {
      let user;
      if (authMode === 'LOGIN') {
        user = await BackendAPI.login({ email, password });
      } else {
        user = await BackendAPI.register({ email, password, name, role: UserRole.ADMIN });
      }
      setCurrentUser(user);
      await loadData();
    } catch (err: any) {
      alert(err.message || 'Ошибка авторизации');
    } finally {
      setAuthLoading(false);
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
      alert(e.message);
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const handleCompleteRental = async (rental: Rental) => {
    if(!confirm('Вы уверены, что хотите завершить аренду? Статус договора изменится на "Завершен".')) return;

    setIsGlobalLoading(true);
    try {
        await BackendAPI.saveRental({ ...rental, status: 'COMPLETED' });
        await loadData();
    } catch (e: any) {
        alert(e.message);
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
      alert(e.message);
    } finally {
      setIsGlobalLoading(false);
    }
  };

  const handleAddCar = async (car: Car) => {
    if (!car.id && !checkAccess('ADD_CAR')) return; // Only check limit on creation
    await apiAction(BackendAPI.saveCar)(car);
  };

  // Public Catalog View Wrapper
  if (!currentUser && currentView === 'CLIENT_CATALOG') {
    return (
      <div className="min-h-screen bg-slate-50 relative overflow-y-auto">
        <ClientCatalog
          cars={cars}
          rentals={rentals}
          currentUser={null}
          onSubmitRequest={async (req) => {
             // Use public endpoint for guest requests
             await BackendAPI.submitBookingRequest(req);
             alert('Заявка отправлена!');
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

  if (isInitializing) {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-16 h-16 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!currentUser) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-900 p-4">
        <div className="bg-white rounded-[2.5rem] w-full max-w-md p-10 shadow-2xl animate-scaleIn">
          <div className="text-center mb-8">
            <div className="w-16 h-16 bg-blue-600 rounded-2xl flex items-center justify-center text-white text-3xl shadow-lg mx-auto mb-4">
              <i className="fas fa-car-side"></i>
            </div>
            <h1 className="text-3xl font-black text-slate-900 tracking-tight">AutoPro AI</h1>
            <p className="text-slate-400 font-bold uppercase text-xs tracking-widest mt-2">Система управления автопарком</p>
          </div>

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
            <input
              name="password"
              type="password"
              placeholder="Пароль"
              required
              className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500 transition-all"
            />

            <button
              type="submit"
              disabled={authLoading}
              className="w-full py-4 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-500/20 hover:bg-blue-700 active:scale-95 transition-all flex items-center justify-center space-x-2"
            >
              {authLoading && <i className="fas fa-circle-notch animate-spin"></i>}
              <span>{authMode === 'LOGIN' ? 'Войти' : 'Создать аккаунт'}</span>
            </button>
          </form>

          <div className="mt-6 text-center">
            <button
              onClick={() => setAuthMode(authMode === 'LOGIN' ? 'REGISTER' : 'LOGIN')}
              className="text-slate-400 font-bold text-xs uppercase tracking-widest hover:text-blue-600 transition-colors"
            >
              {authMode === 'LOGIN' ? 'Нет аккаунта? Регистрация' : 'Уже есть аккаунт? Войти'}
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

      {isGlobalLoading && (
        <div className="fixed inset-0 z-[100] bg-white/40 backdrop-blur-[2px] flex items-center justify-center">
          <div className="w-14 h-14 border-4 border-blue-600 border-t-transparent rounded-full animate-spin"></div>
        </div>
      )}

      <TopNavbar brandName={currentUser.publicBrandName || 'AutoPro AI'} />

      <Sidebar
        currentView={currentView}
        userRole={currentUser.role}
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
        user={currentUser}
      />

      <main className="flex-1 overflow-y-auto pt-32 md:pt-12 pb-44 md:pb-12 md:ml-64 p-6">
        <div className="max-w-7xl mx-auto">
          {currentView === 'DASHBOARD' &&
            <Dashboard
              cars={cars}
              rentals={rentals}
              clients={clients}
              user={currentUser}
              onCompleteRental={handleCompleteRental}
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
              onIssue={(id) => { setSelectedEntityId(id); setCurrentView('MANUAL_BOOKING'); }}
              onReserve={(id) => { setSelectedEntityId(id); setCurrentView('MANUAL_BOOKING'); }}
              onInfo={(id) => { setSelectedEntityId(id); setCurrentView('REPORTS'); }}
              currentOwnerId={currentUser.id}
              planLimit={getPlanLimit()}
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
              onSelectClient={(id) => { setSelectedEntityId(id); setCurrentView('CLIENT_DETAILS'); }}
            />
          )}

          {(currentView === 'CONTRACTS' || currentView === 'BOOKINGS' || currentView === 'CONTRACTS_ARCHIVE') && (
            <ContractList
              rentals={rentals}
              cars={cars}
              clients={clients}
              onUpdate={apiAction(BackendAPI.saveRental)}
              onDelete={apiAction(BackendAPI.deleteRental)}
              onIssueFromBooking={(id) => { setSelectedEntityId(id); setCurrentView('MANUAL_BOOKING'); }}
              viewMode={currentView === 'BOOKINGS' ? 'BOOKINGS' : (currentView === 'CONTRACTS_ARCHIVE' ? 'ARCHIVE' : 'CONTRACTS')}
              brandName={currentUser.publicBrandName}
            />
          )}

          {currentView === 'CASHBOX' && (
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

          {currentView === 'REPORTS' && (
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

          {currentView === 'INVESTORS' && (
            <InvestorList
              investors={investors}
              cars={cars}
              rentals={rentals}
              transactions={transactions}
              onAdd={apiAction(BackendAPI.saveInvestor)}
              onUpdate={apiAction(BackendAPI.saveInvestor)}
              onDelete={apiAction(BackendAPI.deleteInvestor)}
              onSelectInvestor={(id) => { setSelectedEntityId(id); setCurrentView('INVESTOR_DETAILS'); }}
            />
          )}

          {currentView === 'STAFF' && (
            <StaffList
              staff={staff}
              onAdd={apiAction(BackendAPI.saveStaff)}
              onUpdate={apiAction(BackendAPI.saveStaff)}
              onDelete={apiAction(BackendAPI.deleteStaff)}
              onSelectStaff={(id) => { setSelectedEntityId(id); setCurrentView('STAFF_DETAILS'); }}
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

          {currentView === 'CALENDAR' && <BookingCalendar cars={cars} rentals={rentals} />}

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
               onAuthRequest={() => {}}
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
              onUpdate={apiAction((u) => BackendAPI.updateGlobalUser(currentUser.id, u))}
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
