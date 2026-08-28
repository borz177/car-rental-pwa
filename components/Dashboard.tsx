
import React, { useMemo } from 'react';
import { Car, CarStatus, Rental, Client, User, Transaction, TransactionType, Fine, FineStatus, AppView } from '../types';
import { CAR_PLACEHOLDER_IMAGE } from '../constants';

interface DashboardProps {
  cars: Car[];
  rentals: Rental[];
  clients: Client[];
  transactions: Transaction[];
  fines: Fine[];
  user?: User | null;
  onCompleteRental: (rental: Rental) => void;
  onNavigate: (view: AppView) => void;
  onSelectCar: (carId: string) => void;
}

const OIL_CHANGE_WARNING_KM = 1000;

// Приложение работает по московскому времени (сервер тоже выставляет TZ=Europe/Moscow).
const getMoscowNow = () => {
  const iso = new Date().toLocaleString('en-CA', {
    timeZone: 'Europe/Moscow', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).replace(', ', 'T');
  return new Date(iso);
};

const dateOnly = (value: string) => String(value).split('T')[0];

const Money: React.FC<{
  label: string; value: number; hint?: string;
  tone?: 'default' | 'emerald' | 'rose'; onClick?: () => void;
}> = ({ label, value, hint, tone = 'default', onClick }) => (
  <div
    onClick={onClick}
    className={`bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 ${onClick ? 'cursor-pointer hover:border-slate-300 transition-colors' : ''}`}
  >
    <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{label}</div>
    <div className={`text-2xl font-bold mt-1 ${
      tone === 'emerald' ? 'text-emerald-600 dark:text-emerald-400' : tone === 'rose' ? 'text-rose-600 dark:text-rose-400' : 'text-slate-900 dark:text-white'
    }`}>
      {value.toLocaleString()} ₽
    </div>
    {hint && <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">{hint}</div>}
  </div>
);

const Dashboard: React.FC<DashboardProps> = ({
  cars, rentals, clients, transactions, fines, user, onCompleteRental, onNavigate, onSelectCar
}) => {
  const moscowNow = getMoscowNow();
  const todayStr = moscowNow.toISOString().split('T')[0];
  const monthPrefix = todayStr.slice(0, 7);

  // --- Деньги: считаем по фактическим движениям кассы, а не по сумме договоров.
  // Сумма всех договоров за всё время только растёт и ни о чём не говорит.
  const money = useMemo(() => {
    let incomeToday = 0, incomeMonth = 0, expenseMonth = 0;
    transactions.forEach(t => {
      const d = dateOnly(t.date);
      if (t.type === TransactionType.INCOME) {
        if (d === todayStr) incomeToday += t.amount;
        if (d.startsWith(monthPrefix)) incomeMonth += t.amount;
      } else if (t.type === TransactionType.EXPENSE && d.startsWith(monthPrefix)) {
        expenseMonth += t.amount;
      }
    });
    const debt = clients.reduce((s, c) => s + (c.debt || 0), 0);
    return { incomeToday, incomeMonth, expenseMonth, netMonth: incomeMonth - expenseMonth, debt };
  }, [transactions, clients, todayStr, monthPrefix]);

  // --- Автопарк: статус выводим из активных аренд, как в разделе «Автопарк».
  // Поле car.status для этого не годится — оно расходится с реальными арендами.
  const fleet = useMemo(() => {
    const rentedIds = new Set(rentals.filter(r => r.status === 'ACTIVE' && !r.isReservation).map(r => r.carId));
    const reservedIds = new Set(rentals.filter(r => r.status === 'ACTIVE' && r.isReservation).map(r => r.carId));
    const maintenance = cars.filter(c => c.status === CarStatus.MAINTENANCE).length;
    const rented = cars.filter(c => rentedIds.has(c.id) && c.status !== CarStatus.MAINTENANCE).length;
    const reserved = cars.filter(c => reservedIds.has(c.id) && !rentedIds.has(c.id) && c.status !== CarStatus.MAINTENANCE).length;
    const free = cars.length - rented - reserved - maintenance;
    const utilization = cars.length ? Math.round((rented / cars.length) * 100) : 0;
    return { total: cars.length, free, rented, reserved, maintenance, utilization };
  }, [cars, rentals]);

  const overdueOf = (rental: Rental) => {
    const end = new Date(`${dateOnly(rental.endDate)}T${rental.endTime || '00:00'}`);
    const diff = moscowNow.getTime() - end.getTime();
    if (diff <= 0) return null;
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return days > 0 ? `${days}д ${hours}ч` : hours > 0 ? `${hours}ч ${minutes}м` : `${minutes}м`;
  };

  // Возвраты: сегодня и всё просроченное.
  const returns = useMemo(() =>
    rentals
      .filter(r => r.status === 'ACTIVE' && !r.isReservation && dateOnly(r.endDate) <= todayStr)
      .sort((a, b) => (a.endDate + a.endTime).localeCompare(b.endDate + b.endTime)),
    [rentals, todayStr]
  );

  // Выдачи: брони, которые начинаются сегодня. Раньше их на главной не было вовсе,
  // хотя это половина операционного дня.
  const pickups = useMemo(() =>
    rentals
      .filter(r => r.status === 'ACTIVE' && r.isReservation && dateOnly(r.startDate) === todayStr)
      .sort((a, b) => (a.startTime || '').localeCompare(b.startTime || '')),
    [rentals, todayStr]
  );

  const alerts = useMemo(() => {
    const items: { icon: string; text: string; tone: 'rose' | 'amber'; action: () => void }[] = [];

    const unpaid = fines.filter(f => f.status === FineStatus.UNPAID);
    if (unpaid.length) {
      const sum = unpaid.reduce((s, f) => s + f.amount, 0);
      items.push({
        icon: 'fa-file-invoice-dollar', tone: 'amber',
        text: `Неоплаченных штрафов: ${unpaid.length} на ${sum.toLocaleString()} ₽`,
        action: () => onNavigate('CLIENTS')
      });
    }

    const oilDue = cars.filter(c => {
      if (typeof c.lastOilChangeMileage !== 'number' || !c.oilChangeInterval) return false;
      return (c.mileage || 0) - c.lastOilChangeMileage >= c.oilChangeInterval - OIL_CHANGE_WARNING_KM;
    });
    if (oilDue.length) {
      items.push({
        icon: 'fa-oil-can', tone: 'amber',
        text: `Требуется замена масла: ${oilDue.length} авто`,
        action: () => onNavigate('CARS')
      });
    }

    if (user?.subscriptionUntil) {
      const left = Math.ceil((new Date(user.subscriptionUntil).getTime() - moscowNow.getTime()) / 86400000);
      if (left <= 7) {
        items.push({
          icon: 'fa-crown', tone: left <= 0 ? 'rose' : 'amber',
          text: left <= 0 ? 'Подписка истекла' : `Подписка заканчивается через ${left} дн.`,
          action: () => onNavigate('TARIFFS')
        });
      }
    }
    return items;
  }, [fines, cars, user, moscowNow, onNavigate]);

  const whatsapp = (rental: Rental, kind: 'RETURN' | 'PICKUP') => {
    const client = clients.find(c => c.id === rental.clientId);
    const car = cars.find(c => c.id === rental.carId);
    if (!client || !car) return;
    let phone = client.phone.replace(/\D/g, '');
    if (phone.startsWith('8') && phone.length === 11) phone = '7' + phone.slice(1);

    const overdue = kind === 'RETURN' ? overdueOf(rental) : null;
    const text = kind === 'RETURN'
      ? `Здравствуйте, ${client.name}. Напоминаем, что до ${rental.endTime} ожидаем возврат автомобиля ${car.brand} ${car.model} (${car.plate}).${overdue ? ` Срок аренды истек (просрочка ${overdue}).` : ''} Ждем вас!`
      : `Здравствуйте, ${client.name}. Напоминаем о брони автомобиля ${car.brand} ${car.model} (${car.plate}) сегодня в ${rental.startTime}. Ждем вас!`;

    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const overdueCount = returns.filter(r => overdueOf(r)).length;

  const AgendaRow: React.FC<{ rental: Rental; kind: 'RETURN' | 'PICKUP' }> = ({ rental, kind }) => {
    const car = cars.find(c => c.id === rental.carId);
    const client = clients.find(c => c.id === rental.clientId);
    if (!car || !client) return null;
    const overdue = kind === 'RETURN' ? overdueOf(rental) : null;

    return (
      <div className={`p-3 rounded-xl border flex items-center gap-3 ${
        overdue ? 'border-rose-200 dark:border-rose-500/20 bg-rose-50/50 dark:bg-rose-500/10' : 'border-slate-100 dark:border-slate-700 hover:bg-slate-50'
      } transition-colors`}>
        <div
          onClick={() => onSelectCar(car.id)}
          className="w-12 h-12 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-700 flex-shrink-0 cursor-pointer"
        >
          <img src={car.images?.[0] || CAR_PLACEHOLDER_IMAGE} className="w-full h-full object-cover" alt="" />
        </div>

        <div className="flex-1 min-w-0">
          <div className="font-semibold text-slate-900 dark:text-white text-sm truncate">{client.name}</div>
          <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate">
            {car.brand} {car.model} • {car.plate}
          </div>
        </div>

        <div className="text-right flex-shrink-0">
          <div className={`text-xs font-bold ${overdue ? 'text-rose-600 dark:text-rose-400' : 'text-slate-700 dark:text-slate-200'}`}>
            {kind === 'RETURN' ? rental.endTime : rental.startTime}
          </div>
          {overdue && <div className="text-[9px] font-bold text-rose-600 dark:text-rose-400 uppercase">+{overdue}</div>}
        </div>

        <div className="flex gap-1.5 flex-shrink-0">
          <button
            onClick={() => whatsapp(rental, kind)}
            title="Написать в WhatsApp"
            className="w-8 h-8 bg-[#25D366] text-white rounded-lg flex items-center justify-center hover:bg-[#20b858] active:scale-95 transition-all"
          >
            <i className="fab fa-whatsapp text-sm"></i>
          </button>
          {kind === 'RETURN' && (
            <button
              onClick={() => onCompleteRental(rental)}
              title="Завершить аренду"
              className="px-2.5 h-8 bg-blue-600 text-white rounded-lg flex items-center justify-center hover:bg-blue-700 active:scale-95 transition-all"
            >
              <i className="fas fa-check text-xs"></i>
            </button>
          )}
        </div>
      </div>
    );
  };

  const EmptyState: React.FC<{ icon: string; text: string }> = ({ icon, text }) => (
    <div className="py-10 text-center">
      <i className={`fas ${icon} text-2xl text-slate-200 dark:text-slate-700 mb-2`}></i>
      <div className="text-xs font-semibold text-slate-400 dark:text-slate-500">{text}</div>
    </div>
  );

  return (
    <div className="space-y-4 animate-fadeIn">
      {/* Деньги */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Money
          label="Доход за месяц"
          value={money.incomeMonth}
          tone="emerald"
          hint={money.expenseMonth > 0 ? `расходы ${money.expenseMonth.toLocaleString()} ₽ • чистыми ${money.netMonth.toLocaleString()} ₽` : 'расходов нет'}
          onClick={() => onNavigate('REPORTS')}
        />
        <Money label="Доход сегодня" value={money.incomeToday} onClick={() => onNavigate('CASHBOX')} />
        <Money
          label="Долги клиентов"
          value={money.debt}
          tone={money.debt > 0 ? 'rose' : 'default'}
          hint={money.debt > 0 ? 'требуют внимания' : 'все рассчитались'}
          onClick={() => onNavigate('CLIENTS')}
        />
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
          <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Загрузка автопарка</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{fleet.utilization}%</div>
          <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden mt-2">
            <div className="h-full bg-blue-500 rounded-full transition-all" style={{ width: `${fleet.utilization}%` }}></div>
          </div>
        </div>
      </div>

      {/* Автопарк */}
      <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
        <div className="flex items-center justify-between mb-3">
          <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Автопарк — {fleet.total} авто</div>
          <button onClick={() => onNavigate('CARS')} className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide hover:text-blue-700">
            Открыть <i className="fas fa-arrow-right ml-1"></i>
          </button>
        </div>
        <div className="grid grid-cols-4 gap-2">
          {[
            { label: 'Свободны', value: fleet.free, color: 'text-emerald-600 dark:text-emerald-400', bg: 'bg-emerald-50 dark:bg-emerald-500/10' },
            { label: 'В аренде', value: fleet.rented, color: 'text-blue-600 dark:text-blue-400', bg: 'bg-blue-50 dark:bg-blue-500/10' },
            { label: 'Бронь', value: fleet.reserved, color: 'text-amber-600 dark:text-amber-400', bg: 'bg-amber-50 dark:bg-amber-500/10' },
            { label: 'Ремонт', value: fleet.maintenance, color: 'text-slate-600 dark:text-slate-300', bg: 'bg-slate-100 dark:bg-slate-700' }
          ].map(s => (
            <button key={s.label} onClick={() => onNavigate('CARS')} className={`${s.bg} p-3 rounded-xl text-center hover:opacity-80 transition-opacity`}>
              <div className={`text-xl font-bold ${s.color}`}>{s.value}</div>
              <div className="text-[9px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mt-0.5">{s.label}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Оповещения */}
      {alerts.length > 0 && (
        <div className="space-y-2">
          {alerts.map((a, i) => (
            <button
              key={i}
              onClick={a.action}
              className={`w-full p-3 rounded-xl border flex items-center gap-3 text-left transition-colors ${
                a.tone === 'rose' ? 'bg-rose-50 dark:bg-rose-500/10 border-rose-100 dark:border-rose-500/20 hover:bg-rose-100/60' : 'bg-amber-50 dark:bg-amber-500/10 border-amber-100 dark:border-amber-500/20 hover:bg-amber-100/60'
              }`}
            >
              <i className={`fas ${a.icon} ${a.tone === 'rose' ? 'text-rose-500 dark:text-rose-400' : 'text-amber-500 dark:text-amber-400'}`}></i>
              <span className={`text-xs font-semibold flex-1 ${a.tone === 'rose' ? 'text-rose-700 dark:text-rose-400' : 'text-amber-700 dark:text-amber-400'}`}>{a.text}</span>
              <i className={`fas fa-chevron-right text-[10px] ${a.tone === 'rose' ? 'text-rose-400' : 'text-amber-400'}`}></i>
            </button>
          ))}
        </div>
      )}

      {/* План на день */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400 flex items-center justify-center">
                <i className="fas fa-arrow-rotate-left text-xs"></i>
              </div>
              <div>
                <div className="font-semibold text-slate-900 dark:text-white text-sm">Возвраты</div>
                <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500">
                  {overdueCount > 0 ? `${returns.length} всего • ${overdueCount} просрочено` : 'на сегодня'}
                </div>
              </div>
            </div>
            {returns.length > 0 && (
              <span className={`px-2 py-1 rounded-lg text-xs font-bold ${overdueCount > 0 ? 'bg-rose-100 dark:bg-rose-500/15 text-rose-700 dark:text-rose-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
                {returns.length}
              </span>
            )}
          </div>
          <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
            {returns.length > 0
              ? returns.map(r => <AgendaRow key={r.id} rental={r} kind="RETURN" />)
              : <EmptyState icon="fa-circle-check" text="Возвратов не ожидается" />}
          </div>
        </div>

        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="w-8 h-8 rounded-xl bg-blue-50 dark:bg-blue-500/10 text-blue-500 dark:text-blue-400 flex items-center justify-center">
                <i className="fas fa-key text-xs"></i>
              </div>
              <div>
                <div className="font-semibold text-slate-900 dark:text-white text-sm">Выдачи</div>
                <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500">брони на сегодня</div>
              </div>
            </div>
            {pickups.length > 0 && (
              <span className="px-2 py-1 rounded-lg text-xs font-bold bg-blue-100 dark:bg-blue-500/15 text-blue-700 dark:text-blue-400">{pickups.length}</span>
            )}
          </div>
          <div className="p-3 space-y-2 max-h-96 overflow-y-auto">
            {pickups.length > 0
              ? pickups.map(r => <AgendaRow key={r.id} rental={r} kind="PICKUP" />)
              : <EmptyState icon="fa-calendar-check" text="Выдач на сегодня нет" />}
          </div>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
