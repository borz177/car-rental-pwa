
import React, { useState } from 'react';
import { Car, BookingRequest, User, RequestStatus } from '../types.ts';

interface ClientCatalogProps {
  cars: Car[];
  currentUser: User | null;
  onSubmitRequest: (req: BookingRequest) => void;
  fleetOwner: User | null;
  onAuthRequest: () => void;
  onRegisterClient: (data: Partial<User>) => void;
  onLoginClient: (email: string, pass: string) => void;
}

const ClientCatalog: React.FC<ClientCatalogProps> = ({ 
  cars, 
  currentUser, 
  onSubmitRequest, 
  fleetOwner,
  onRegisterClient,
  onLoginClient
}) => {
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('REGISTER');
  
  const today = new Date().toISOString().split('T')[0];
  const [dates, setDates] = useState({ 
    start: today, 
    startTime: '10:00',
    end: '', 
    endTime: '10:00' 
  });

  const handleAuthSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    if (authMode === 'REGISTER') {
      onRegisterClient({
        name: fd.get('name') as string,
        email: fd.get('email') as string,
        password: fd.get('password') as string
      });
    } else {
      onLoginClient(fd.get('email') as string, fd.get('password') as string);
    }
    setShowAuthModal(false);
  };

  const handleRequestClick = (car: Car) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }
    setSelectedCar(car);
  };

  const handleFinalSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCar || !currentUser) return;

    const request: BookingRequest = {
      id: `req-${Date.now()}`,
      ownerId: selectedCar.ownerId,
      carId: selectedCar.id,
      clientId: currentUser.id,
      clientName: currentUser.name,
      startDate: dates.start,
      startTime: dates.startTime,
      endDate: dates.end,
      endTime: dates.endTime,
      status: RequestStatus.PENDING,
      createdAt: new Date().toISOString()
    };

    onSubmitRequest(request);
    setSelectedCar(null);
    alert('Ваша заявка отправлена владельцу! Мы свяжемся с вами в ближайшее время.');
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-24 md:pb-0">
      {/* Public Header */}
      <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col md:flex-row justify-between items-center gap-6">
        <div>
          <h2 className="text-4xl font-black text-slate-900 mb-2 tracking-tight">
            {fleetOwner?.publicBrandName || 'Наш автопарк'}
          </h2>
          <p className="text-slate-500 font-bold uppercase text-[10px] tracking-[0.2em]">
            Аренда автомобилей премиум и бизнес-класса
          </p>
        </div>
        {!currentUser && (
          <button 
            onClick={() => setShowAuthModal(true)}
            className="px-8 py-4 bg-slate-900 text-white rounded-2xl font-black text-sm uppercase tracking-widest hover:bg-blue-600 transition-all shadow-xl shadow-slate-200"
          >
            Войти в личный кабинет
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
        {cars.map(car => (
          <div key={car.id} className="bg-white rounded-[2.5rem] overflow-hidden shadow-xl shadow-slate-200/40 border border-slate-50 group hover:-translate-y-2 transition-all duration-300">
            <div className="h-64 relative overflow-hidden">
              <img src={car.images[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700" alt={car.model} />
              <div className="absolute top-6 left-6 bg-white/90 backdrop-blur-md px-5 py-2 rounded-full text-[10px] font-black text-blue-600 shadow-sm uppercase tracking-widest">
                {car.category}
              </div>
            </div>
            <div className="p-8">
              <div className="flex justify-between items-start mb-6">
                <div>
                  <h3 className="text-2xl font-black text-slate-900">{car.brand} {car.model}</h3>
                  <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">{car.year} г.в. • {car.transmission}</p>
                </div>
                <div className="text-right">
                  <div className="text-2xl font-black text-blue-600">{car.pricePerDay} ₽</div>
                  <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest">в сутки</div>
                </div>
              </div>
              
              <div className="grid grid-cols-2 gap-4 mb-8">
                 <div className="bg-slate-50 p-3 rounded-2xl text-center">
                    <div className="text-[8px] font-black text-slate-400 uppercase mb-1">Топливо</div>
                    <div className="text-xs font-bold">{car.fuel}</div>
                 </div>
                 <div className="bg-slate-50 p-3 rounded-2xl text-center">
                    <div className="text-[8px] font-black text-slate-400 uppercase mb-1">Пробег</div>
                    <div className="text-xs font-bold">{car.mileage.toLocaleString()} км</div>
                 </div>
              </div>

              <button 
                onClick={() => handleRequestClick(car)}
                className="w-full bg-slate-900 text-white py-5 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-600 transition-all shadow-lg active:scale-95"
              >
                Забронировать
              </button>
            </div>
          </div>
        ))}
        {cars.length === 0 && (
          <div className="col-span-full py-32 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300 text-3xl">
              <i className="fas fa-car-side"></i>
            </div>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">К сожалению, доступных авто сейчас нет.</p>
          </div>
        )}
      </div>

      {/* Booking Modal */}
      {selectedCar && currentUser && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
          <form onSubmit={handleFinalSubmit} className="bg-white rounded-[3rem] w-full max-w-lg p-10 shadow-2xl animate-scaleIn my-auto">
            <h2 className="text-3xl font-black mb-2 text-slate-900 tracking-tight">Бронирование</h2>
            <p className="text-blue-600 mb-8 font-black uppercase text-[10px] tracking-widest">{selectedCar.brand} {selectedCar.model}</p>
            
            <div className="space-y-6 mb-10">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Дата и время начала</div>
                <input 
                  type="date" required className="p-5 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500"
                  value={dates.start} onChange={e => setDates({...dates, start: e.target.value})}
                />
                <input 
                  type="time" required className="p-5 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500"
                  value={dates.startTime} onChange={e => setDates({...dates, startTime: e.target.value})}
                />

                <div className="col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mt-4">Дата и время конца</div>
                <input 
                  type="date" required className="p-5 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500"
                  value={dates.end} onChange={e => setDates({...dates, end: e.target.value})}
                />
                <input 
                  type="time" required className="p-5 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500"
                  value={dates.endTime} onChange={e => setDates({...dates, endTime: e.target.value})}
                />
              </div>
            </div>

            <div className="flex gap-4">
              <button type="button" onClick={() => setSelectedCar(null)} className="flex-1 py-5 bg-slate-100 rounded-2xl font-bold text-slate-600 hover:bg-slate-200 transition-all">
                Отмена
              </button>
              <button type="submit" className="flex-1 py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20">
                Отправить запрос
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Auth Prompt Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
          <div className="bg-white rounded-[3rem] w-full max-w-md p-10 shadow-2xl animate-scaleIn my-auto">
            <div className="flex justify-between items-center mb-8">
               <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                 {authMode === 'REGISTER' ? 'Регистрация клиента' : 'Вход для клиентов'}
               </h2>
               <button onClick={() => setShowAuthModal(false)} className="text-slate-300 hover:text-slate-900"><i className="fas fa-times"></i></button>
            </div>

            <p className="text-slate-400 text-sm font-medium mb-8">
              {authMode === 'REGISTER' 
                ? 'Создайте аккаунт, чтобы сохранять историю бронирований и быстро оформлять документы.' 
                : 'Войдите, чтобы увидеть свои текущие брони и задолженность.'}
            </p>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authMode === 'REGISTER' && (
                <input name="name" required placeholder="Ваше ФИО" className="w-full p-5 bg-slate-50 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" />
              )}
              <input name="email" type="email" required placeholder="Ваш Email" className="w-full p-5 bg-slate-50 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" />
              <input name="password" type="password" required placeholder="Придумайте пароль" className="w-full p-5 bg-slate-50 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" />
              
              <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-500/20 mt-4">
                {authMode === 'REGISTER' ? 'Зарегистрироваться' : 'Войти'}
              </button>
            </form>

            <button 
              onClick={() => setAuthMode(authMode === 'REGISTER' ? 'LOGIN' : 'REGISTER')}
              className="w-full text-center mt-6 text-sm font-bold text-blue-600 hover:underline"
            >
              {authMode === 'REGISTER' ? 'Уже есть аккаунт? Войти' : 'Нет аккаунта? Зарегистрироваться'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientCatalog;
