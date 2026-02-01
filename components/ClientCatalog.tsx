
import React, { useState, useMemo } from 'react';
import { Car, BookingRequest, User, RequestStatus, Rental, CarStatus } from '../types';

interface ClientCatalogProps {
  cars: Car[];
  rentals: Rental[];
  currentUser: User | null;
  onSubmitRequest: (req: BookingRequest) => Promise<void>;
  fleetOwner: User | null;
  onAuthRequest: () => void;
  onRegisterClient: (data: Partial<User>) => Promise<void>;
  onLoginClient: (email: string, pass: string) => Promise<void>;
}

// Generate valid UUID to prevent "invalid input syntax for type uuid" error in Postgres
function generateUUID() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0, v = c == 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

const ClientCatalog: React.FC<ClientCatalogProps> = ({
  cars,
  rentals,
  currentUser,
  onSubmitRequest,
  fleetOwner,
  onRegisterClient,
  onLoginClient
}) => {
  const [selectedCar, setSelectedCar] = useState<Car | null>(null);
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [showSuccessModal, setShowSuccessModal] = useState(false);
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('REGISTER');
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  // Calendar View State
  const [viewDate, setViewDate] = useState(new Date());

  // Set Today in Moscow Time
  const today = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' });

  const [bookingForm, setBookingForm] = useState({
    start: today,
    startTime: '10:00',
    end: '',
    endTime: '10:00',
    name: currentUser?.name || '',
    phone: '',
    dob: ''
  });

  // Calculate visible cars based on owner's plan limit
  const visibleCars = useMemo(() => {
    if (!fleetOwner) return cars;

    let limit = 5; // Default Start
    const plan = fleetOwner.activePlan || (fleetOwner.isTrial ? 'Premium' : 'Start');

    if (plan.toUpperCase().includes('БИЗНЕС') || plan.toUpperCase().includes('BUSINESS')) limit = 20;
    if (plan.toUpperCase().includes('ПРЕМИУМ') || plan.toUpperCase().includes('PREMIUM')) limit = 9999;

    // Only show cars within the plan limit (e.g. first 5)
    return cars.slice(0, limit);
  }, [cars, fleetOwner]);

  // Calculate actual availability based on status and active rentals
  const getCarAvailability = (car: Car) => {
    if (car.status === CarStatus.MAINTENANCE) return { status: 'REPAIR', label: 'В ремонте', color: 'bg-slate-700' };

    // Check if currently rented
    const now = new Date();
    const activeRental = rentals.find(r => {
      if (r.carId !== car.id || r.status !== 'ACTIVE') return false;

      const endDateStr = r.endDate.toString().split('T')[0];
      const end = new Date(`${endDateStr}T${r.endTime}`);
      return end > now;
    });

    if (activeRental) {
       return {
         status: 'BUSY',
         label: activeRental.isReservation ? 'Забронирован' : 'В аренде',
         color: 'bg-amber-500',
         until: `${new Date(activeRental.endDate).toLocaleDateString()} ${activeRental.endTime}`
       };
    }

    return { status: 'AVAILABLE', label: 'Свободен', color: 'bg-emerald-500' };
  };

  const handleAuthSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setIsAuthLoading(true);
    const fd = new FormData(e.currentTarget);
    try {
      if (authMode === 'REGISTER') {
        await onRegisterClient({
          name: fd.get('name') as string,
          email: fd.get('email') as string,
          password: fd.get('password') as string
        });
      } else {
        await onLoginClient(fd.get('email') as string, fd.get('password') as string);
      }
      setShowAuthModal(false);
    } catch (err: any) {
      alert(err.message || 'Ошибка авторизации. Проверьте данные.');
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleRequestClick = (car: Car) => {
    setSelectedCar(car);
    setBookingForm(prev => ({ ...prev, name: currentUser?.name || '', start: today, end: '' }));
    setViewDate(new Date());
  };

  const handleFinalSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedCar) return;

    // VALIDATION: Check for overlaps
    const start = new Date(`${bookingForm.start}T${bookingForm.startTime}`);
    const end = new Date(`${bookingForm.end || bookingForm.start}T${bookingForm.endTime}`); // Allow single day if end not set

    if (end < start) {
        alert('Дата окончания должна быть позже даты начала');
        return;
    }

    const hasOverlap = rentals.some(r => {
        if (r.carId !== selectedCar.id || r.status !== 'ACTIVE') return false;
        const rStart = new Date(`${r.startDate.split('T')[0]}T${r.startTime}`);
        const rEnd = new Date(`${r.endDate.split('T')[0]}T${r.endTime}`);

        // Check intersection
        return (start < rEnd && end > rStart);
    });

    if (hasOverlap) {
        alert('Выбранные даты заняты. Пожалуйста, выберите другое время.');
        return;
    }

    const request: BookingRequest = {
      id: generateUUID(),
      ownerId: selectedCar.ownerId,
      carId: selectedCar.id,
      clientId: currentUser?.id || null, // FIX: Send null instead of 'guest'
      clientName: bookingForm.name,
      clientPhone: bookingForm.phone,
      clientDob: bookingForm.dob,
      startDate: bookingForm.start,
      startTime: bookingForm.startTime,
      endDate: bookingForm.end || bookingForm.start,
      endTime: bookingForm.endTime,
      status: RequestStatus.PENDING,
      createdAt: new Date().toISOString()
    };

    try {
      await onSubmitRequest(request);
      setSelectedCar(null);
      setShowSuccessModal(true);
    } catch (err: any) {
      alert('Ошибка при отправке заявки: ' + (err.message || 'Попробуйте позже'));
    }
  };

  // --- CALENDAR LOGIC ---
  const getDaysArray = (year: number, month: number) => {
    const firstDay = new Date(year, month, 1);
    const lastDay = new Date(year, month + 1, 0);
    const daysInMonth = lastDay.getDate();
    // Monday based: 0=Mon, ... 6=Sun
    let startDayOfWeek = firstDay.getDay();
    startDayOfWeek = startDayOfWeek === 0 ? 6 : startDayOfWeek - 1;

    const days = [];
    for (let i = 0; i < startDayOfWeek; i++) days.push(null);
    for (let i = 1; i <= daysInMonth; i++) days.push(new Date(year, month, i));
    return days;
  };

  const isBusy = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];
    return rentals.some(r => {
        if (r.carId !== selectedCar?.id || r.status !== 'ACTIVE') return false;
        return dateStr >= r.startDate && dateStr <= r.endDate;
    });
  };

  const handleDateClick = (date: Date) => {
    const dateStr = date.toISOString().split('T')[0];

    // If start is empty OR both start and end are set -> Start new selection
    if (!bookingForm.start || (bookingForm.start && bookingForm.end)) {
        setBookingForm(prev => ({ ...prev, start: dateStr, end: '' }));
        return;
    }

    // If start is set but end is empty
    if (bookingForm.start && !bookingForm.end) {
        if (dateStr < bookingForm.start) {
            // Picked a date before start -> Make it new start
            setBookingForm(prev => ({ ...prev, start: dateStr }));
        } else {
            // Validate range for overlaps
            const hasBusyInBetween = rentals.some(r => {
               if (r.carId !== selectedCar?.id || r.status !== 'ACTIVE') return false;
               return r.startDate <= dateStr && r.endDate >= bookingForm.start;
            });

            if (hasBusyInBetween) {
                alert('Выбранный период включает занятые даты.');
                setBookingForm(prev => ({ ...prev, start: dateStr, end: '' })); // Reset to new start
            } else {
                setBookingForm(prev => ({ ...prev, end: dateStr }));
            }
        }
    }
  };

  const changeMonth = (offset: number) => {
    const newDate = new Date(viewDate);
    newDate.setMonth(newDate.getMonth() + offset);
    setViewDate(newDate);
  };

  const renderCalendar = () => {
    const days = getDaysArray(viewDate.getFullYear(), viewDate.getMonth());
    const monthName = viewDate.toLocaleString('ru-RU', { month: 'long', year: 'numeric' });

    return (
      <div className="bg-slate-50 p-4 rounded-[2rem] select-none border border-slate-100">
        <div className="flex justify-between items-center mb-4 px-2">
          <button type="button" onClick={() => changeMonth(-1)} className="w-8 h-8 flex items-center justify-center bg-white rounded-full text-slate-400 hover:text-slate-900 shadow-sm"><i className="fas fa-chevron-left"></i></button>
          <div className="font-black text-slate-900 capitalize text-sm">{monthName}</div>
          <button type="button" onClick={() => changeMonth(1)} className="w-8 h-8 flex items-center justify-center bg-white rounded-full text-slate-400 hover:text-slate-900 shadow-sm"><i className="fas fa-chevron-right"></i></button>
        </div>
        <div className="grid grid-cols-7 gap-1 md:gap-2 text-center mb-2">
          {['Пн','Вт','Ср','Чт','Пт','Сб','Вс'].map(d => <div key={d} className="text-[10px] font-bold text-slate-400 uppercase">{d}</div>)}
        </div>
        <div className="grid grid-cols-7 gap-1 md:gap-2">
          {days.map((date, idx) => {
            if (!date) return <div key={idx}></div>;

            const dateStr = date.toISOString().split('T')[0];
            const isPast = dateStr < today;
            const busy = isBusy(date);
            const disabled = isPast || busy;

            let className = "h-9 md:h-10 rounded-xl flex items-center justify-center text-xs font-bold transition-all ";

            const isStart = bookingForm.start === dateStr;
            const isEnd = bookingForm.end === dateStr;
            const inRange = bookingForm.start && bookingForm.end && dateStr > bookingForm.start && dateStr < bookingForm.end;

            if (disabled) {
                className += "bg-slate-100 text-slate-300 cursor-not-allowed";
                if (busy) className += " line-through opacity-50 bg-rose-50 text-rose-300";
            } else if (isStart || isEnd) {
                className += "bg-blue-600 text-white shadow-lg shadow-blue-500/30 scale-105 z-10";
            } else if (inRange) {
                className += "bg-blue-100 text-blue-600";
            } else {
                className += "bg-white text-slate-700 hover:bg-blue-50 hover:text-blue-600 cursor-pointer shadow-sm";
            }

            return (
              <button
                key={idx}
                type="button"
                disabled={disabled}
                onClick={() => handleDateClick(date)}
                className={className}
              >
                {date.getDate()}
              </button>
            );
          })}
        </div>
        <div className="flex items-center justify-center gap-4 mt-4 px-2">
           <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
              <div className="w-3 h-3 bg-white rounded-full border border-slate-200"></div> <span>Своб.</span>
           </div>
           <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
              <div className="w-3 h-3 bg-rose-50 rounded-full border border-rose-200 opacity-50 line-through"></div> <span>Занято</span>
           </div>
           <div className="flex items-center gap-2 text-[10px] font-bold text-slate-400">
              <div className="w-3 h-3 bg-blue-600 rounded-full"></div> <span>Выбор</span>
           </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-[1600px] mx-auto space-y-8 animate-fadeIn pb-24 md:pb-0 p-4">
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

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5 gap-6">
        {visibleCars.map(car => {
          const avail = getCarAvailability(car);
          // Allow booking even if BUSY, but not if REPAIR
          const isBookable = avail.status !== 'REPAIR';

          return (
            <div key={car.id} className="bg-white rounded-[2.5rem] overflow-hidden shadow-xl shadow-slate-200/40 border border-slate-50 group hover:-translate-y-2 transition-all duration-300">
              {/* Reduced height from h-48 to h-44 for better compactness */}
              <div className="h-44 relative overflow-hidden">
                <img src={car.images[0]} className={`w-full h-full object-cover transition-transform duration-700 ${isBookable ? 'group-hover:scale-110' : 'grayscale opacity-80'}`} alt={car.model} />

                <div className="absolute top-4 left-4 flex gap-2">
                  <div className="bg-white/90 backdrop-blur-md px-3 py-1 rounded-full text-[9px] font-black text-blue-600 shadow-sm uppercase tracking-widest">
                    {car.category}
                  </div>
                </div>

                <div className={`absolute bottom-3 right-3 px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest text-white shadow-lg ${avail.color}`}>
                  {avail.label} {avail.until && <span className="block text-[8px] normal-case opacity-90">до {avail.until}</span>}
                </div>
              </div>

              <div className="p-6">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="text-lg font-black text-slate-900">{car.brand} {car.model}</h3>
                    <p className="text-slate-400 font-bold uppercase text-[9px] tracking-widest mt-0.5">{car.year} г.в. • {car.transmission}</p>
                  </div>
                  <div className="text-right">
                    <div className="text-xl font-black text-blue-600">{car.pricePerDay} ₽</div>
                    <div className="text-[9px] text-slate-400 uppercase font-black tracking-widest">в сутки</div>
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-3 mb-6">
                   <div className="bg-slate-50 p-2 rounded-xl text-center">
                      <div className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Топливо</div>
                      <div className="text-[10px] font-bold">{car.fuel}</div>
                   </div>
                   <div className="bg-slate-50 p-2 rounded-xl text-center">
                      <div className="text-[8px] font-black text-slate-400 uppercase mb-0.5">Пробег</div>
                      <div className="text-[10px] font-bold">{car.mileage.toLocaleString()} км</div>
                   </div>
                </div>

                <button
                  onClick={() => handleRequestClick(car)}
                  disabled={!isBookable}
                  className={`w-full py-4 rounded-xl font-black uppercase tracking-widest text-[10px] transition-all shadow-lg active:scale-95 ${isBookable ? 'bg-slate-900 text-white hover:bg-blue-600' : 'bg-slate-100 text-slate-400 cursor-not-allowed'}`}
                >
                  {avail.status === 'BUSY' ? 'Забронировать на будущее' : (isBookable ? 'Забронировать' : 'В ремонте')}
                </button>
              </div>
            </div>
          );
        })}
        {visibleCars.length === 0 && (
          <div className="col-span-full py-32 text-center">
            <div className="w-20 h-20 bg-slate-100 rounded-full flex items-center justify-center mx-auto mb-6 text-slate-300 text-3xl">
              <i className="fas fa-car-side"></i>
            </div>
            <p className="text-slate-400 font-bold uppercase tracking-widest text-sm">К сожалению, доступных авто сейчас нет.</p>
          </div>
        )}
      </div>

      {/* Booking Modal */}
      {selectedCar && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
          <form onSubmit={handleFinalSubmit} className="bg-white rounded-[3rem] w-full max-w-lg p-10 shadow-2xl animate-scaleIn my-auto">
            <h2 className="text-3xl font-black mb-2 text-slate-900 tracking-tight">Заявка на бронь</h2>
            <p className="text-blue-600 mb-8 font-black uppercase text-[10px] tracking-widest">{selectedCar.brand} {selectedCar.model}</p>

            <div className="space-y-6 mb-10">
              {/* Personal Data Section */}
              <div className="bg-slate-50 p-6 rounded-3xl border border-slate-100 space-y-4">
                 <h4 className="text-xs font-black uppercase text-slate-400 tracking-widest">Личные данные</h4>
                 <input
                   required placeholder="ФИО полностью"
                   value={bookingForm.name} onChange={e => setBookingForm({...bookingForm, name: e.target.value})}
                   className="w-full p-4 bg-white rounded-2xl font-bold outline-none border border-slate-200 focus:border-blue-500"
                   readOnly={!!currentUser}
                 />
                 <div className="grid grid-cols-2 gap-4">
                    <input
                      required placeholder="+7 (999) 000-00-00" type="tel"
                      value={bookingForm.phone} onChange={e => setBookingForm({...bookingForm, phone: e.target.value})}
                      className="w-full p-4 bg-white rounded-2xl font-bold outline-none border border-slate-200 focus:border-blue-500"
                    />
                    <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase ml-2 mb-1 block">Дата рождения</label>
                      <input
                        required type="date"
                        value={bookingForm.dob} onChange={e => setBookingForm({...bookingForm, dob: e.target.value})}
                        className="w-full p-4 bg-white rounded-2xl font-bold outline-none border border-slate-200 focus:border-blue-500"
                      />
                    </div>
                 </div>
              </div>

              {/* Calendar Section */}
              <div>
                <div className="flex justify-between items-end mb-2">
                   <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Выберите даты аренды (МСК)</div>
                   <div className="text-xs font-bold text-blue-600">
                      {new Date(bookingForm.start).toLocaleDateString()}
                      {bookingForm.end ? ` — ${new Date(bookingForm.end).toLocaleDateString()}` : ''}
                   </div>
                </div>

                {renderCalendar()}

                {/* Time Selection */}
                <div className="grid grid-cols-2 gap-4 mt-4">
                   <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase ml-2 block mb-1">Время начала</label>
                      <input
                        type="time" required className="w-full p-3 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500 text-center"
                        value={bookingForm.startTime} onChange={e => setBookingForm({...bookingForm, startTime: e.target.value})}
                      />
                   </div>
                   <div>
                      <label className="text-[9px] font-bold text-slate-400 uppercase ml-2 block mb-1">Время окончания</label>
                      <input
                        type="time" required className="w-full p-3 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500 text-center"
                        value={bookingForm.endTime} onChange={e => setBookingForm({...bookingForm, endTime: e.target.value})}
                      />
                   </div>
                </div>
              </div>
            </div>

            <div className="flex gap-4">
              <button type="button" onClick={() => setSelectedCar(null)} className="flex-1 py-5 bg-slate-100 rounded-2xl font-bold text-slate-600 hover:bg-slate-200 transition-all">
                Отмена
              </button>
              <button type="submit" className="flex-1 py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-700 transition-all shadow-xl shadow-blue-500/20">
                Отправить
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Success Modal */}
      {showSuccessModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/80 backdrop-blur-md">
          <div className="bg-white rounded-[3rem] w-full max-w-md p-10 shadow-2xl animate-scaleIn text-center">
            <div className="w-20 h-20 bg-emerald-100 text-emerald-600 rounded-full flex items-center justify-center mx-auto mb-6 text-4xl shadow-lg">
              <i className="fas fa-check"></i>
            </div>
            <h2 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Заявка принята!</h2>
            <p className="text-slate-500 font-medium mb-8">
              Менеджер скоро свяжется с вами для подтверждения.
            </p>

            {!currentUser && (
               <div className="bg-blue-50 p-6 rounded-3xl mb-8 border border-blue-100">
                  <p className="text-sm font-bold text-blue-800 mb-3">Хотите отслеживать статус?</p>
                  <button
                    onClick={() => { setShowSuccessModal(false); setShowAuthModal(true); }}
                    className="w-full py-3 bg-blue-600 text-white rounded-xl font-bold uppercase text-[10px] tracking-widest hover:bg-blue-700"
                  >
                    Зарегистрироваться
                  </button>
               </div>
            )}

            <button
              onClick={() => setShowSuccessModal(false)}
              className="w-full py-4 bg-slate-100 text-slate-600 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-slate-200 transition-all"
            >
              Закрыть
            </button>
          </div>
        </div>
      )}

      {/* Auth Prompt Modal */}
      {showAuthModal && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
          <div className="bg-white rounded-[3rem] w-full max-w-md p-10 shadow-2xl animate-scaleIn my-auto">
            <div className="flex justify-between items-center mb-8">
               <h2 className="text-2xl font-black text-slate-900 tracking-tight">
                 {authMode === 'REGISTER' ? 'Регистрация' : 'Вход'}
               </h2>
               <button onClick={() => setShowAuthModal(false)} className="text-slate-300 hover:text-slate-900"><i className="fas fa-times"></i></button>
            </div>

            <p className="text-slate-400 text-sm font-medium mb-8">
              {authMode === 'REGISTER'
                ? 'Создайте аккаунт, чтобы видеть историю заказов и статус заявок.'
                : 'Войдите, чтобы управлять бронированиями.'}
            </p>

            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {authMode === 'REGISTER' && (
                <input name="name" required placeholder="Ваше ФИО" className="w-full p-5 bg-slate-50 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" />
              )}
              <input name="email" type="email" required placeholder="Ваш Email" className="w-full p-5 bg-slate-50 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" />
              <input name="password" type="password" required placeholder="Придумайте пароль" className="w-full p-5 bg-slate-50 rounded-2xl font-bold outline-none focus:ring-2 focus:ring-blue-500" />

              <button
                type="submit"
                disabled={isAuthLoading}
                className="w-full py-5 bg-blue-600 text-white rounded-2xl font-black uppercase tracking-widest text-xs shadow-xl shadow-blue-500/20 mt-4 flex items-center justify-center"
              >
                {isAuthLoading ? <i className="fas fa-circle-notch animate-spin mr-2"></i> : null}
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
