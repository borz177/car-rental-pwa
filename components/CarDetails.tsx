
import React, { useState, useMemo } from 'react';
import { Car, CarStatus, Rental, Client, Transaction, TransactionType, Investor, Fine, FineStatus } from '../types';

interface CarDetailsProps {
  car: Car;
  rentals: Rental[];
  clients: Client[];
  transactions: Transaction[];
  investors: Investor[];
  fines: Fine[];
  onBack: () => void;
  onUpdate: (c: Car) => void;
  onEdit: () => void;
  onViewReport: () => void;
}

const OIL_CHANGE_WARNING_KM = 1000;

const moscowNow = () => new Date(new Date().toLocaleString('en-US', { timeZone: 'Europe/Moscow' }));

const daysBetween = (start: string, end: string) => {
  const s = new Date(String(start).split('T')[0]);
  const e = new Date(String(end).split('T')[0]);
  const diff = Math.round((e.getTime() - s.getTime()) / (1000 * 60 * 60 * 24));
  return diff > 0 ? diff : 1;
};

const Stat: React.FC<{ label: string; value: string; hint?: string; tone?: 'default' | 'emerald' | 'rose' | 'blue' }> =
  ({ label, value, hint, tone = 'default' }) => {
  const toneClass = tone === 'emerald' ? 'text-emerald-600'
    : tone === 'rose' ? 'text-rose-600'
    : tone === 'blue' ? 'text-blue-600'
    : 'text-slate-900';
  return (
    <div className="bg-white p-4 rounded-2xl border border-slate-100">
      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">{label}</div>
      <div className={`text-xl font-bold ${toneClass}`}>{value}</div>
      {hint && <div className="text-[10px] text-slate-400 font-medium mt-0.5">{hint}</div>}
    </div>
  );
};

const SpecRow: React.FC<{ icon: string; label: string; value: string }> = ({ icon, label, value }) => (
  <div className="flex items-center gap-3 p-3 rounded-xl bg-slate-50">
    <div className="w-9 h-9 rounded-xl bg-white flex items-center justify-center text-slate-400 border border-slate-100">
      <i className={`fas ${icon} text-xs`}></i>
    </div>
    <div className="min-w-0">
      <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{label}</div>
      <div className="font-semibold text-slate-800 text-sm truncate">{value}</div>
    </div>
  </div>
);

const CarDetails: React.FC<CarDetailsProps> = ({
  car, rentals, clients, transactions, investors, fines, onBack, onUpdate, onEdit, onViewReport
}) => {
  const [activeTab, setActiveTab] = useState<'OVERVIEW' | 'HISTORY' | 'FINANCE' | 'SERVICE'>('OVERVIEW');
  const [activeImage, setActiveImage] = useState(0);
  const [confirmOil, setConfirmOil] = useState(false);

  const carRentals = useMemo(
    () => rentals.filter(r => r.carId === car.id)
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime()),
    [rentals, car.id]
  );
  const carTransactions = useMemo(
    () => transactions.filter(t => t.carId === car.id)
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()),
    [transactions, car.id]
  );
  const carFines = useMemo(() => fines.filter(f => f.carId === car.id), [fines, car.id]);

  const activeRental = carRentals.find(r => r.status === 'ACTIVE');
  const client = clients.find(c => c.id === activeRental?.clientId);
  const investor = investors.find(i => i.id === car.investorId);

  const status = useMemo(() => {
    if (car.status === CarStatus.MAINTENANCE) return { label: 'В ремонте', color: 'bg-slate-700' };
    if (activeRental && !activeRental.isReservation) return { label: 'В аренде', color: 'bg-blue-600' };
    if (activeRental && activeRental.isReservation) return { label: 'Забронирован', color: 'bg-amber-500' };
    return { label: 'Свободен', color: 'bg-emerald-500' };
  }, [car.status, activeRental]);

  // Деньги: договоры — это начисления, транзакции кассы — фактические движения.
  const money = useMemo(() => {
    const accrued = carRentals.reduce((s, r) => s + (r.totalAmount || 0), 0);
    const income = carTransactions.filter(t => t.type === TransactionType.INCOME).reduce((s, t) => s + t.amount, 0);
    const expense = carTransactions.filter(t => t.type === TransactionType.EXPENSE).reduce((s, t) => s + t.amount, 0);
    return { accrued, income, expense, net: income - expense };
  }, [carRentals, carTransactions]);

  const usage = useMemo(() => {
    const realRentals = carRentals.filter(r => !r.isReservation);
    const totalDays = realRentals.reduce((s, r) => s + daysBetween(r.startDate, r.endDate), 0);

    // Загрузка за последние 30 дней
    const now = moscowNow();
    const windowStart = new Date(now);
    windowStart.setDate(windowStart.getDate() - 30);
    let busyDays = 0;
    realRentals.forEach(r => {
      const s = new Date(String(r.startDate).split('T')[0]);
      const e = new Date(String(r.endDate).split('T')[0]);
      const from = s > windowStart ? s : windowStart;
      const to = e < now ? e : now;
      const d = Math.round((to.getTime() - from.getTime()) / (1000 * 60 * 60 * 24));
      if (d > 0) busyDays += d;
    });
    const utilization = Math.min(100, Math.round((busyDays / 30) * 100));
    return { count: realRentals.length, totalDays, utilization };
  }, [carRentals]);

  const overdue = useMemo(() => {
    if (!activeRental || activeRental.isReservation) return null;
    const endDate = String(activeRental.endDate).split('T')[0];
    const end = new Date(`${endDate}T${activeRental.endTime || '00:00'}`);
    const diff = moscowNow().getTime() - end.getTime();
    if (diff <= 0) return null;
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const minutes = Math.floor((diff % (1000 * 60 * 60)) / (1000 * 60));
    const text = days > 0 ? `${days}д ${hours}ч` : hours > 0 ? `${hours}ч ${minutes}м` : `${minutes}м`;
    const pricePerHour = car.pricePerHour || Math.round(car.pricePerDay / 24);
    return { text, amount: Math.ceil(diff / (1000 * 60 * 60)) * pricePerHour };
  }, [activeRental, car]);

  // Обслуживание: считаем только если заданы оба параметра.
  const oil = useMemo(() => {
    const hasData = typeof car.lastOilChangeMileage === 'number' && !!car.oilChangeInterval;
    if (!hasData) return { configured: false as const };
    const interval = car.oilChangeInterval!;
    const driven = (car.mileage || 0) - car.lastOilChangeMileage!;
    const remaining = interval - driven;
    const percent = Math.max(0, Math.min(100, Math.round((driven / interval) * 100)));
    const state: 'OVERDUE' | 'SOON' | 'OK' =
      remaining <= 0 ? 'OVERDUE' : remaining <= OIL_CHANGE_WARNING_KM ? 'SOON' : 'OK';
    return { configured: true as const, interval, driven, remaining, percent, state };
  }, [car.mileage, car.lastOilChangeMileage, car.oilChangeInterval]);

  const handleOilChange = () => {
    onUpdate({
      ...car,
      lastOilChangeMileage: car.mileage || 0,
      oilChangeInterval: car.oilChangeInterval || 10000
    });
    setConfirmOil(false);
  };

  const unpaidFines = carFines.filter(f => f.status === FineStatus.UNPAID);

  const tabs = [
    { id: 'OVERVIEW', label: 'Обзор' },
    { id: 'HISTORY', label: 'История' },
    { id: 'FINANCE', label: 'Финансы' },
    { id: 'SERVICE', label: 'Обслуживание' }
  ] as const;

  return (
    <div className="space-y-4 animate-fadeIn pb-24 md:pb-0">
      <button onClick={onBack} className="flex items-center space-x-2 text-slate-500 font-bold hover:text-blue-600 transition-all">
        <i className="fas fa-arrow-left"></i> <span>Назад к автопарку</span>
      </button>

      <div className="bg-white rounded-2xl shadow-sm overflow-hidden border border-slate-100">
        {/* Шапка */}
        <div className="p-4 md:p-5 bg-slate-50 border-b border-slate-100 flex flex-col md:flex-row md:items-center gap-4">
          <div className="w-full md:w-40 h-28 rounded-xl overflow-hidden bg-slate-200 flex-shrink-0">
            <img
              src={car.images?.[0] || 'https://images.unsplash.com/photo-1494905998402-395d579af36f?q=80&w=400'}
              className="w-full h-full object-cover"
              alt={`${car.brand} ${car.model}`}
            />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-3 flex-wrap">
              <h2 className="text-2xl font-semibold text-slate-900 tracking-tight">{car.brand} {car.model}</h2>
              <span className={`px-3 py-1 rounded-full text-[9px] font-semibold uppercase tracking-wide text-white ${status.color}`}>
                {status.label}
              </span>
            </div>
            <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mt-1">
              {car.plate} • {car.year} г. • {car.category || 'без категории'}
            </p>
            <div className="flex items-center gap-4 mt-3">
              <div>
                <span className="text-blue-600 font-bold text-lg">{car.pricePerDay.toLocaleString()} ₽</span>
                <span className="text-[10px] text-slate-400 font-semibold uppercase ml-1">/ сутки</span>
              </div>
              {!!car.pricePerHour && (
                <div>
                  <span className="text-slate-700 font-bold">{car.pricePerHour.toLocaleString()} ₽</span>
                  <span className="text-[10px] text-slate-400 font-semibold uppercase ml-1">/ час</span>
                </div>
              )}
            </div>
          </div>
          <div className="flex md:flex-col gap-2">
            <button onClick={onEdit} className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-semibold text-[10px] uppercase tracking-wide hover:bg-slate-100 transition-all">
              <i className="fas fa-edit mr-1.5"></i>Изменить
            </button>
            <button onClick={onViewReport} className="px-4 py-2.5 bg-white border border-slate-200 text-slate-600 rounded-xl font-semibold text-[10px] uppercase tracking-wide hover:bg-slate-100 transition-all">
              <i className="fas fa-chart-line mr-1.5"></i>Отчёт
            </button>
          </div>
        </div>

        {/* Ключевые показатели */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 p-4 md:p-5 bg-slate-50/50 border-b border-slate-100">
          <Stat label="Получено в кассу" value={`${money.income.toLocaleString()} ₽`} tone="emerald" hint={`начислено ${money.accrued.toLocaleString()} ₽`} />
          <Stat label="Расходы" value={`${money.expense.toLocaleString()} ₽`} tone={money.expense > 0 ? 'rose' : 'default'} />
          <Stat label="Аренд всего" value={String(usage.count)} hint={`${usage.totalDays} дней в аренде`} />
          <Stat label="Загрузка 30 дней" value={`${usage.utilization}%`} tone="blue" />
        </div>

        {/* Вкладки */}
        <div className="flex border-b border-slate-100 overflow-x-auto">
          {tabs.map(t => (
            <button
              key={t.id}
              onClick={() => setActiveTab(t.id)}
              className={`flex-1 min-w-[110px] py-4 font-semibold text-[11px] uppercase tracking-wide transition-all ${
                activeTab === t.id ? 'bg-white text-blue-600 border-b-2 border-blue-600' : 'text-slate-400 hover:text-slate-600 bg-slate-50'
              }`}
            >
              {t.label}
              {t.id === 'SERVICE' && (oil.configured && oil.state !== 'OK' || unpaidFines.length > 0) && (
                <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-rose-500 align-middle"></span>
              )}
            </button>
          ))}
        </div>

        <div className="p-4 md:p-5">
          {/* ОБЗОР */}
          {activeTab === 'OVERVIEW' && (
            <div className="space-y-4 animate-fadeIn">
              {activeRental ? (
                <div className={`p-4 rounded-2xl border ${activeRental.isReservation ? 'bg-amber-50 border-amber-100' : 'bg-blue-50 border-blue-100'}`}>
                  <div className={`text-[10px] font-semibold uppercase tracking-wide mb-2 ${activeRental.isReservation ? 'text-amber-600' : 'text-blue-600'}`}>
                    {activeRental.isReservation ? 'Забронирован' : 'Сейчас в аренде'}
                  </div>
                  <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">
                    <div>
                      <div className="text-lg font-semibold text-slate-900">{client?.name || 'Клиент не найден'}</div>
                      <div className="text-sm font-medium text-slate-500">{client?.phone || '—'}</div>
                      <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wide mt-1">
                        Договор № {activeRental.contractNumber || '—'}
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-2 md:min-w-[280px]">
                      <div className="bg-white/70 p-3 rounded-xl">
                        <div className="text-[9px] font-semibold text-slate-400 uppercase">Начало</div>
                        <div className="font-semibold text-slate-800 text-sm">
                          {new Date(activeRental.startDate).toLocaleDateString()} {activeRental.startTime}
                        </div>
                      </div>
                      <div className="bg-white/70 p-3 rounded-xl">
                        <div className="text-[9px] font-semibold text-slate-400 uppercase">Окончание</div>
                        <div className="font-semibold text-slate-800 text-sm">
                          {new Date(activeRental.endDate).toLocaleDateString()} {activeRental.endTime}
                        </div>
                      </div>
                    </div>
                  </div>
                  {overdue && (
                    <div className="mt-3 p-3 bg-rose-50 border border-rose-100 rounded-xl flex items-center justify-between">
                      <div>
                        <div className="text-[10px] font-semibold text-rose-600 uppercase tracking-wide">Просрочка</div>
                        <div className="font-bold text-rose-700">{overdue.text}</div>
                      </div>
                      <div className="text-right">
                        <div className="text-[10px] font-semibold text-rose-600 uppercase tracking-wide">К доплате</div>
                        <div className="font-bold text-rose-700">{overdue.amount.toLocaleString()} ₽</div>
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="p-5 bg-emerald-50 border border-emerald-100 rounded-2xl flex items-center gap-3">
                  <i className="fas fa-circle-check text-2xl text-emerald-500"></i>
                  <div>
                    <div className="font-semibold text-emerald-800">
                      {car.status === CarStatus.MAINTENANCE ? 'Автомобиль в ремонте' : 'Автомобиль свободен'}
                    </div>
                    <div className="text-xs font-medium text-emerald-600/70">
                      {car.status === CarStatus.MAINTENANCE ? 'Недоступен для аренды' : 'Готов к выдаче'}
                    </div>
                  </div>
                </div>
              )}

              <div>
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Характеристики</div>
                <div className="grid grid-cols-2 lg:grid-cols-3 gap-2">
                  <SpecRow icon="fa-gauge-high" label="Пробег" value={`${(car.mileage || 0).toLocaleString()} км`} />
                  <SpecRow icon="fa-gas-pump" label="Топливо" value={car.fuel || '—'} />
                  <SpecRow icon="fa-gears" label="Коробка" value={car.transmission || '—'} />
                  <SpecRow icon="fa-calendar" label="Год выпуска" value={String(car.year)} />
                  <SpecRow icon="fa-layer-group" label="Категория" value={car.category || '—'} />
                  <SpecRow icon="fa-hashtag" label="Гос. номер" value={car.plate} />
                </div>
              </div>

              {investor && (
                <div className="p-4 rounded-2xl bg-indigo-50 border border-indigo-100">
                  <div className="text-[10px] font-semibold text-indigo-500 uppercase tracking-wide mb-2">Инвестор</div>
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <div className="font-semibold text-slate-900">{investor.name}</div>
                      <div className="text-xs font-medium text-slate-500">{investor.phone}</div>
                    </div>
                    <div className="text-right">
                      <div className="text-[10px] font-semibold text-indigo-400 uppercase tracking-wide">Доля</div>
                      <div className="font-bold text-indigo-700 text-lg">{car.investorShare || 0}%</div>
                    </div>
                  </div>
                </div>
              )}

              {car.images && car.images.length > 0 && (
                <div>
                  <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Фотографии</div>
                  <div className="rounded-2xl overflow-hidden bg-slate-100 aspect-video max-h-72">
                    <img src={car.images[activeImage]} className="w-full h-full object-cover" alt="" />
                  </div>
                  {car.images.length > 1 && (
                    <div className="flex gap-2 mt-2 overflow-x-auto pb-1">
                      {car.images.map((img, i) => (
                        <button
                          key={i}
                          onClick={() => setActiveImage(i)}
                          className={`w-16 h-16 rounded-xl overflow-hidden flex-shrink-0 border-2 transition-all ${
                            i === activeImage ? 'border-blue-500' : 'border-transparent opacity-60 hover:opacity-100'
                          }`}
                        >
                          <img src={img} className="w-full h-full object-cover" alt="" />
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* ИСТОРИЯ */}
          {activeTab === 'HISTORY' && (
            <div className="space-y-2 animate-fadeIn">
              {carRentals.map(r => {
                const c = clients.find(cl => cl.id === r.clientId);
                const isActive = r.status === 'ACTIVE';
                return (
                  <div key={r.id} className="p-3 rounded-xl border border-slate-100 hover:bg-slate-50 transition-all flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
                        r.isReservation ? 'bg-amber-100 text-amber-600' : isActive ? 'bg-blue-100 text-blue-600' : 'bg-slate-100 text-slate-500'
                      }`}>
                        <i className={`fas ${r.isReservation ? 'fa-calendar-check' : 'fa-key'} text-xs`}></i>
                      </div>
                      <div className="min-w-0">
                        <div className="font-semibold text-slate-900 text-sm truncate">{c?.name || 'Клиент удалён'}</div>
                        <div className="text-[11px] text-slate-400 font-medium">
                          {new Date(r.startDate).toLocaleDateString()} — {new Date(r.endDate).toLocaleDateString()}
                          <span className="mx-1">•</span>
                          дог. {r.contractNumber || '—'}
                        </div>
                      </div>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <div className="font-bold text-slate-900 text-sm">{(r.totalAmount || 0).toLocaleString()} ₽</div>
                      <div className={`text-[9px] font-semibold uppercase tracking-wide ${
                        isActive ? 'text-blue-500' : r.status === 'COMPLETED' ? 'text-emerald-500' : 'text-slate-400'
                      }`}>
                        {r.isReservation ? 'Бронь' : isActive ? 'Активна' : r.status === 'COMPLETED' ? 'Завершена' : 'Отменена'}
                      </div>
                    </div>
                  </div>
                );
              })}
              {carRentals.length === 0 && (
                <div className="p-12 text-center text-slate-300 font-medium">Аренд по этому автомобилю ещё не было</div>
              )}
            </div>
          )}

          {/* ФИНАНСЫ */}
          {activeTab === 'FINANCE' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div className="p-4 rounded-2xl bg-emerald-50 border border-emerald-100">
                  <div className="text-[10px] font-semibold text-emerald-600 uppercase tracking-wide">Доход</div>
                  <div className="text-2xl font-bold text-emerald-700 mt-1">{money.income.toLocaleString()} ₽</div>
                </div>
                <div className="p-4 rounded-2xl bg-rose-50 border border-rose-100">
                  <div className="text-[10px] font-semibold text-rose-600 uppercase tracking-wide">Расход</div>
                  <div className="text-2xl font-bold text-rose-700 mt-1">{money.expense.toLocaleString()} ₽</div>
                </div>
                <div className="p-4 rounded-2xl bg-slate-50 border border-slate-100">
                  <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wide">Чистыми</div>
                  <div className={`text-2xl font-bold mt-1 ${money.net >= 0 ? 'text-slate-900' : 'text-rose-700'}`}>
                    {money.net.toLocaleString()} ₽
                  </div>
                </div>
              </div>

              {money.accrued !== money.income && (
                <div className="p-3 rounded-xl bg-amber-50 border border-amber-100 text-xs font-medium text-amber-700">
                  <i className="fas fa-circle-info mr-1.5"></i>
                  Начислено по договорам {money.accrued.toLocaleString()} ₽, фактически проведено через кассу {money.income.toLocaleString()} ₽.
                  Разница — оплаты в долг или ещё не проведённые платежи.
                </div>
              )}

              <div>
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">Операции по автомобилю</div>
                <div className="space-y-2">
                  {carTransactions.map(t => (
                    <div key={t.id} className="p-3 rounded-xl border border-slate-100 flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 min-w-0">
                        <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                          t.type === TransactionType.INCOME ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
                        }`}>
                          <i className={`fas ${t.type === TransactionType.INCOME ? 'fa-arrow-down' : 'fa-arrow-up'} text-xs`}></i>
                        </div>
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 text-sm truncate">{t.description || t.category}</div>
                          <div className="text-[11px] text-slate-400 font-medium">{new Date(t.date).toLocaleDateString()} • {t.category}</div>
                        </div>
                      </div>
                      <div className={`font-bold text-sm flex-shrink-0 ${
                        t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {t.type === TransactionType.INCOME ? '+' : '−'}{t.amount.toLocaleString()} ₽
                      </div>
                    </div>
                  ))}
                  {carTransactions.length === 0 && (
                    <div className="p-12 text-center text-slate-300 font-medium">Операций по этому автомобилю нет</div>
                  )}
                </div>
              </div>
            </div>
          )}

          {/* ОБСЛУЖИВАНИЕ */}
          {activeTab === 'SERVICE' && (
            <div className="space-y-4 animate-fadeIn">
              <div className="p-4 rounded-2xl border border-slate-100">
                <div className="flex items-center justify-between gap-3 mb-3 flex-wrap">
                  <div className="flex items-center gap-3">
                    <div className={`w-11 h-11 rounded-2xl flex items-center justify-center ${
                      !oil.configured ? 'bg-slate-100 text-slate-400'
                        : oil.state === 'OVERDUE' ? 'bg-rose-100 text-rose-600'
                        : oil.state === 'SOON' ? 'bg-amber-100 text-amber-600'
                        : 'bg-emerald-100 text-emerald-600'
                    }`}>
                      <i className="fas fa-oil-can"></i>
                    </div>
                    <div>
                      <div className="font-semibold text-slate-900">Замена масла</div>
                      <div className="text-xs font-medium text-slate-400">
                        Текущий пробег {(car.mileage || 0).toLocaleString()} км
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => setConfirmOil(true)}
                    className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-[10px] uppercase tracking-wide hover:bg-blue-700 active:scale-95 transition-all"
                  >
                    Зафиксировать замену
                  </button>
                </div>

                {oil.configured ? (
                  <>
                    <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          oil.state === 'OVERDUE' ? 'bg-rose-500' : oil.state === 'SOON' ? 'bg-amber-500' : 'bg-emerald-500'
                        }`}
                        style={{ width: `${oil.percent}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center mt-2 text-[11px] font-semibold">
                      <span className="text-slate-400">
                        Пройдено {Math.max(0, oil.driven).toLocaleString()} из {oil.interval.toLocaleString()} км
                      </span>
                      <span className={
                        oil.state === 'OVERDUE' ? 'text-rose-600' : oil.state === 'SOON' ? 'text-amber-600' : 'text-emerald-600'
                      }>
                        {oil.state === 'OVERDUE'
                          ? `Просрочено на ${Math.abs(oil.remaining).toLocaleString()} км`
                          : `Осталось ${oil.remaining.toLocaleString()} км`}
                      </span>
                    </div>
                    <div className="text-[11px] text-slate-400 font-medium mt-2">
                      Последняя замена на пробеге {car.lastOilChangeMileage!.toLocaleString()} км
                    </div>
                  </>
                ) : (
                  <div className="p-3 rounded-xl bg-slate-50 text-xs font-medium text-slate-500">
                    Учёт замены масла не настроен. Нажмите «Зафиксировать замену», чтобы начать отсчёт от текущего пробега,
                    либо укажите пробег последней замены и интервал в карточке автомобиля.
                  </div>
                )}
              </div>

              <div>
                <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-2">
                  Штрафы по автомобилю {unpaidFines.length > 0 && (
                    <span className="text-rose-500">• {unpaidFines.length} неоплачено</span>
                  )}
                </div>
                <div className="space-y-2">
                  {carFines.map(f => {
                    const c = clients.find(cl => cl.id === f.clientId);
                    return (
                      <div key={f.id} className="p-3 rounded-xl border border-slate-100 flex items-center justify-between gap-3">
                        <div className="min-w-0">
                          <div className="font-semibold text-slate-800 text-sm truncate">{f.description || 'Штраф'}</div>
                          <div className="text-[11px] text-slate-400 font-medium">
                            {new Date(f.date).toLocaleDateString()} • {c?.name || 'Клиент удалён'}
                          </div>
                        </div>
                        <div className="text-right flex-shrink-0">
                          <div className="font-bold text-slate-900 text-sm">{f.amount.toLocaleString()} ₽</div>
                          <div className={`text-[9px] font-semibold uppercase tracking-wide ${
                            f.status === FineStatus.PAID ? 'text-emerald-500' : 'text-rose-500'
                          }`}>
                            {f.status}
                          </div>
                        </div>
                      </div>
                    );
                  })}
                  {carFines.length === 0 && (
                    <div className="p-12 text-center text-slate-300 font-medium">Штрафов по этому автомобилю нет</div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {confirmOil && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/70 backdrop-blur-sm">
          <div className="bg-white rounded-2xl p-6 w-full max-w-sm text-center animate-scaleIn">
            <div className="w-12 h-12 bg-emerald-50 text-emerald-500 mx-auto rounded-2xl flex items-center justify-center text-2xl mb-3">
              <i className="fas fa-oil-can"></i>
            </div>
            <h3 className="font-semibold text-lg mb-2">Зафиксировать замену масла?</h3>
            <p className="text-sm text-slate-500 mb-5">
              Отсчёт начнётся заново от текущего пробега <b className="text-slate-800">{(car.mileage || 0).toLocaleString()} км</b>.
              Следующая замена через <b className="text-slate-800">{(car.oilChangeInterval || 10000).toLocaleString()} км</b>.
            </p>
            <div className="flex gap-2">
              <button onClick={() => setConfirmOil(false)} className="flex-1 py-3 bg-slate-100 text-slate-600 rounded-xl font-semibold text-xs uppercase tracking-wide">Отмена</button>
              <button onClick={handleOilChange} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-semibold text-xs uppercase tracking-wide">Подтвердить</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default CarDetails;
