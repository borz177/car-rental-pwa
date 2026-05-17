import React from 'react';
import { Car, Rental, Client, User } from '../types';

interface DashboardProps {
  cars: Car[];
  rentals: Rental[];
  clients: Client[];
  user?: User | null;
  onCompleteRental: (rental: Rental) => void;
}

interface StatCardProps {
  title: string;
  value: string | number;
  icon: string;
  color: string;
}

const StatCard: React.FC<StatCardProps> = ({ title, value, icon, color }) => (
  <div className="bg-white p-5 rounded-xl border border-slate-200 flex items-center justify-between">
    <div>
      <span className="text-slate-500 text-xs font-medium uppercase tracking-wide block mb-1">{title}</span>
      <div className="text-xl font-semibold text-slate-900">{value}</div>
    </div>
    <div className={`w-10 h-10 rounded-lg flex items-center justify-center text-base bg-${color}-50 text-${color}-600`}>
      <i className={`fas ${icon}`}></i>
    </div>
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({ cars, rentals, clients, user, onCompleteRental }) => {
  const totalRevenue = rentals.reduce((sum, r) => sum + r.totalAmount, 0);
  const utilizationRate = Math.round((cars.filter(c => c.status === 'В аренде').length / cars.length) * 100) || 0;

  const getMoscowCurrentTime = () => {
    const now = new Date();
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
    return r.status === 'ACTIVE' && !r.isReservation && rentEndDate <= todayStr;
  }).sort((a, b) => {
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
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard title="Выручка" value={`${totalRevenue.toLocaleString()} ₽`} icon="fa-wallet" color="blue" />
        <StatCard title="Загрузка" value={`${utilizationRate}%`} icon="fa-chart-line" color="emerald" />
        <StatCard title="Клиенты" value={clients.length} icon="fa-users" color="purple" />
        <StatCard title="Автопарк" value={cars.length} icon="fa-car" color="amber" />
      </div>

      {/* Returns Section */}
      <section>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
            <i className="fas fa-clock-rotate-left"></i>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-slate-900">Возвраты сегодня</h2>
            <p className="text-xs text-slate-500">Автомобили, ожидающие возврата</p>
          </div>
        </div>

        {returningRentals.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
            {returningRentals.map(rental => {
              const car = cars.find(c => c.id === rental.carId);
              const client = clients.find(c => c.id === rental.clientId);
              if (!car || !client) return null;
              const overdue = getOverdueText(rental);

              return (
                <article key={rental.id} className="bg-white p-4 rounded-xl border border-slate-200 hover:border-slate-300 transition-colors">
                  <div className="flex gap-4">
                    {/* Car Image */}
                    <div className="w-16 h-16 bg-slate-100 rounded-lg overflow-hidden flex-shrink-0">
                      <img src={car.images[0]} className="w-full h-full object-cover" alt={car.model} />
                    </div>

                    {/* Content */}
                    <div className="flex-1 min-w-0">
                      <div className="flex justify-between items-start gap-2">
                        <div className="min-w-0">
                          <h3 className="font-medium text-slate-900 truncate">{client.name}</h3>
                          <p className="text-xs text-slate-500 mt-0.5">{car.brand} {car.model} • {car.plate}</p>
                        </div>
                        <div className="text-right flex flex-col items-end gap-1">
                          <span className="text-xs text-slate-600 bg-slate-100 px-2 py-0.5 rounded">
                            до {rental.endTime}
                          </span>
                          {overdue && (
                            <span className="text-[10px] font-medium text-white bg-rose-500 px-1.5 py-0.5 rounded">
                              +{overdue}
                            </span>
                          )}
                        </div>
                      </div>

                      {/* Actions */}
                      <div className="flex justify-end gap-2 mt-3">
                        <button
                          onClick={() => handleWhatsAppRemind(rental)}
                          className="w-8 h-8 rounded-lg bg-[#25D366] text-white hover:bg-[#20b858] transition-colors flex items-center justify-center"
                          title="Напомнить в WhatsApp"
                        >
                          <i className="fab fa-whatsapp text-sm"></i>
                        </button>
                        <button
                          onClick={() => onCompleteRental(rental)}
                          className="px-3 h-8 rounded-lg bg-blue-600 text-white text-xs font-medium hover:bg-blue-700 transition-colors flex items-center gap-1.5"
                          title="Завершить аренду"
                        >
                          <i className="fas fa-check text-[10px]"></i>
                          Завершить
                        </button>
                      </div>
                    </div>
                  </div>
                </article>
              );
            })}
          </div>
        ) : (
          <div className="bg-white rounded-xl border border-slate-200 p-8 text-center">
            <div className="w-12 h-12 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-3 text-emerald-600">
              <i className="fas fa-check"></i>
            </div>
            <p className="font-medium text-slate-900">Возвратов не ожидается</p>
            <p className="text-sm text-slate-500 mt-0.5">Все активные аренды продолжаются</p>
          </div>
        )}
      </section>
    </div>
  );
};

export default Dashboard;