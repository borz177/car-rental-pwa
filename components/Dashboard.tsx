
import React from 'react';
import { Car, Rental, Client, User } from '../types';

interface DashboardProps {
  cars: Car[];
  rentals: Rental[];
  clients: Client[];
  user?: User | null;
  onCompleteRental: (rental: Rental) => Promise<void>;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => (
  <div className="bg-white p-6 rounded-[2rem] shadow-sm border border-slate-100 flex items-center justify-between group hover:border-slate-200 transition-all">
    <div>
      <span className="text-slate-400 text-[10px] font-black uppercase tracking-widest block mb-1">{title}</span>
      <div className="text-2xl font-black text-slate-900">{value}</div>
    </div>
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl bg-${color}-50 text-${color}-500 group-hover:scale-110 transition-transform`}>
      <i className={`fas ${icon}`}></i>
    </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ cars, rentals, clients, user, onCompleteRental }) => {
  const totalRevenue = rentals.reduce((sum, r) => sum + r.totalAmount, 0);
  const utilizationRate = Math.round((cars.filter(c => c.status === 'В аренде').length / cars.length) * 100) || 0;

  // Logic for Returns Today (and Overdue) in Moscow Time
  const getMoscowCurrentTime = () => {
    const now = new Date();
    // Get formatted string in Moscow time: "YYYY-MM-DD, HH:mm:ss" (en-CA provides YYYY-MM-DD)
    const isoString = now.toLocaleString('en-CA', {
      timeZone: 'Europe/Moscow',
      hour12: false,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    }).replace(', ', 'T');

    return new Date(isoString);
  };

  const moscowNow = getMoscowCurrentTime();
  const todayStr = moscowNow.toISOString().split('T')[0];

  const returningRentals = rentals.filter(r => {
    const rentEndDate = typeof r.endDate === 'string' ? r.endDate.split('T')[0] : r.endDate;

    return r.status === 'ACTIVE' &&
           !r.isReservation &&
           rentEndDate <= todayStr; // Include past dates (overdue)
  }).sort((a, b) => {
      // Sort by end date/time ascending (most overdue first)
      if (a.endDate !== b.endDate) return a.endDate.localeCompare(b.endDate);
      return a.endTime.localeCompare(b.endTime);
  });

  const getOverdueText = (rental: Rental) => {
      const rentEndDate = typeof rental.endDate === 'string' ? rental.endDate.split('T')[0] : rental.endDate;
      const rentEnd = new Date(`${rentEndDate}T${rental.endTime}`);

      const diff = moscowNow.getTime() - rentEnd.getTime();

      if (diff <= 0) return null;

      const days = Math.floor(diff / (1000 * 60 * 60 * 24));
      const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));

      if (days > 0) return `${days}д ${hours}ч`;
      if (hours > 0) return `${hours}ч ${minutes}м`;
      return `${minutes}м`;
  };

  const handleWhatsAppRemind = (rental: Rental) => {
    const client = clients.find(c => c.id === rental.clientId);
    const car = cars.find(c => c.id === rental.carId);

    if (!client || !car) return;

    let phone = client.phone.replace(/\D/g, '');
    if (phone.startsWith('8') && phone.length === 11) phone = '7' + phone.slice(1);

    const overdue = getOverdueText(rental);
    const overdueMsg = overdue ? ` Срок аренды истек (просрочка ${overdue}).` : '';

    const text = `Здравствуйте, ${client.name}. Напоминаем, что до ${rental.endTime} ожидаем возврат автомобиля ${car.brand} ${car.model} (${car.plate}).${overdueMsg} Ждем вас!`;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      {user?.isTrial && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 rounded-[2.5rem] text-white flex flex-col md:flex-row justify-between items-center shadow-xl shadow-blue-500/20 relative overflow-hidden animate-slideDown">
           <div className="relative z-10 text-center md:text-left">
              <h3 className="text-2xl font-black mb-2 uppercase tracking-tight">Активен пробный период</h3>
              <p className="text-blue-100 font-medium max-w-lg">Осталось несколько дней бесплатного использования всех функций системы. Выберите тариф для бесперебойной работы.</p>
           </div>
           <button
             onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'TARIFFS' }))}
             className="relative z-10 mt-6 md:mt-0 px-8 py-4 bg-white text-blue-700 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-50 transition-all shadow-lg active:scale-95"
           >
             Выбрать тариф
           </button>
           <i className="fas fa-gift absolute -right-6 -bottom-6 text-9xl text-white/10 rotate-12"></i>
        </div>
      )}

      {/* Top Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard title="Выручка (₽)" value={totalRevenue.toLocaleString()} icon="fa-wallet" color="blue" />
        <StatCard title="Загрузка" value={`${utilizationRate}%`} icon="fa-chart-line" color="emerald" />
        <StatCard title="Клиенты" value={clients.length} icon="fa-users" color="purple" />
        <StatCard title="Автопарк" value={cars.length} icon="fa-car" color="amber" />
      </div>

      {/* Returns Today Section */}
      <div>
        <div className="flex items-center space-x-3 mb-6 px-2">
           <div className="w-10 h-10 bg-rose-100 rounded-xl flex items-center justify-center text-rose-600 shadow-sm">
             <i className="fas fa-clock"></i>
           </div>
           <div>
             <h3 className="text-2xl font-black text-slate-900">Возвраты и долги</h3>
             <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest">Автомобили, ожидающие возврата</p>
           </div>
        </div>

        {returningRentals.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
            {returningRentals.map(rental => {
              const car = cars.find(c => c.id === rental.carId);
              const client = clients.find(c => c.id === rental.clientId);

              if (!car || !client) return null;

              const overdue = getOverdueText(rental);

              return (
                <div key={rental.id} className="bg-white p-5 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-lg transition-all group relative overflow-hidden">
                  <div className="flex items-center gap-5">
                    {/* Car Image */}
                    <div className="w-20 h-20 bg-slate-100 rounded-2xl overflow-hidden flex-shrink-0 shadow-inner relative">
                      <img src={car.images[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt={car.model} />
                      {overdue && (
                        <div className="absolute top-1 left-1 bg-white rounded-full p-1 shadow-md z-10">
                           <div className="w-4 h-4 bg-rose-500 rounded-full flex items-center justify-center text-white text-[10px] animate-pulse">
                             <i className="fas fa-exclamation"></i>
                           </div>
                        </div>
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start">
                        <div>
                          <h4 className="font-black text-slate-900 truncate pr-2">{car.brand} {car.model}</h4>
                          <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest bg-slate-50 inline-block px-2 py-0.5 rounded-md mt-1">{car.plate}</div>
                        </div>
                        <div className="text-right flex flex-col items-end">
                           <div className="text-xs font-black text-slate-500 bg-slate-100 px-2 py-1 rounded-lg">
                             до {rental.endTime}
                           </div>
                           {overdue && (
                             <div className="text-[9px] font-black text-white bg-rose-600 px-2 py-1 rounded-lg mt-1 shadow-sm animate-pulse flex items-center gap-1">
                               <span>+{overdue}</span>
                             </div>
                           )}
                        </div>
                      </div>

                      <div className="mt-3 flex items-center justify-between gap-2">
                        <div className="flex items-center space-x-2 truncate">
                           <div className="w-6 h-6 bg-blue-100 rounded-full flex items-center justify-center text-[10px] font-black text-blue-600">
                             {client.name.charAt(0)}
                           </div>
                           <span className="text-xs font-bold text-slate-600 truncate max-w-[100px]">{client.name}</span>
                        </div>

                        <div className="flex gap-2">
                            <button
                              onClick={() => handleWhatsAppRemind(rental)}
                              className="bg-[#25D366] text-white w-8 h-8 rounded-xl hover:bg-[#20b858] transition-all shadow-lg shadow-emerald-100 flex items-center justify-center active:scale-95"
                              title="Напомнить в WhatsApp"
                            >
                              <i className="fab fa-whatsapp"></i>
                            </button>
                            <button
                              onClick={() => onCompleteRental(rental)}
                              className="bg-blue-600 text-white px-3 h-8 rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-100 flex items-center justify-center gap-1 active:scale-95"
                              title="Завершить аренду"
                            >
                              <i className="fas fa-check"></i>
                              <span className="text-[10px] font-black uppercase">Завершить</span>
                            </button>
                        </div>
                      </div>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-[2.5rem] p-12 text-center border border-slate-100 shadow-sm">
            <div className="w-20 h-20 bg-emerald-50 rounded-full flex items-center justify-center mx-auto mb-4 text-emerald-500 text-3xl">
              <i className="fas fa-check-circle"></i>
            </div>
            <h4 className="text-xl font-black text-slate-900">Возвратов не ожидается</h4>
            <p className="text-slate-400 text-sm font-medium mt-1">Все активные аренды продолжаются или заканчиваются в другие дни.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Dashboard;
