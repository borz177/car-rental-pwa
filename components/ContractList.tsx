import React, { useState, useEffect, useMemo } from 'react';
import { Rental, Car, Client, RentalExtension } from '../types';
import Pagination from './Pagination';

interface ContractListProps {
  rentals: Rental[];
  cars: Car[];
  clients: Client[];
  onUpdate: (rental: Rental) => void;
  onDelete: (id: string) => void;
  onIssueFromBooking?: (id: string) => void;
  onComplete: (rental: Rental) => void;
  viewMode?: 'CONTRACTS' | 'BOOKINGS' | 'ARCHIVE';
  brandName?: string;
}

type StatusFilter = 'ALL' | 'PAID' | 'DEBT' | 'OVERDUE';

// Приложение работает по московскому времени (сервер тоже выставляет TZ=Europe/Moscow).
const getMoscowNow = () => {
  const iso = new Date().toLocaleString('en-CA', {
    timeZone: 'Europe/Moscow', hour12: false,
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', second: '2-digit'
  }).replace(', ', 'T');
  return new Date(iso);
};

const dateOnly = (v: string) => String(v).split('T')[0];

// Фактически полученные деньги по договору: у брони это предоплата,
// у аренды в долг — тоже только предоплата, остальное висит долгом.
const paidOf = (r: Rental) =>
  r.isReservation || r.paymentStatus === 'DEBT' ? (r.prepayment || 0) : (r.totalAmount || 0);
const debtOf = (r: Rental) => Math.max(0, (r.totalAmount || 0) - paidOf(r));

const ContractList: React.FC<ContractListProps> = ({
  rentals, cars, clients, onUpdate, onDelete, onIssueFromBooking, onComplete,
  viewMode = 'CONTRACTS', brandName
}) => {
  const [extendingRental, setExtendingRental] = useState<Rental | null>(null);
  const [showActions, setShowActions] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<'PAID' | 'DEBT'>('PAID');
  const [extensionData, setExtensionData] = useState({ endDate: '', endTime: '', extraPrice: 0 });
  const [printingRental, setPrintingRental] = useState<Rental | null>(null);
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null);

  const [search, setSearch] = useState('');
  const [searchDate, setSearchDate] = useState('');
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('ALL');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

  const moscowNow = getMoscowNow();

  const getCar = (id: string) => cars.find(c => c.id === id);
  const getClient = (id: string) => clients.find(c => c.id === id);

  // Просрочка: только для выданных авто (не броней) в активном статусе.
  const overdueOf = (rent: Rental) => {
    if (rent.isReservation || rent.status !== 'ACTIVE') return null;
    const end = new Date(`${dateOnly(rent.endDate)}T${rent.endTime || '00:00'}`);
    const diff = moscowNow.getTime() - end.getTime();
    if (diff <= 0) return null;
    const days = Math.floor(diff / 86400000);
    const hours = Math.floor((diff % 86400000) / 3600000);
    const minutes = Math.floor((diff % 3600000) / 60000);
    return days > 0 ? `${days}д ${hours}ч` : hours > 0 ? `${hours}ч ${minutes}м` : `${minutes}м`;
  };

  const scopedRentals = useMemo(() => rentals.filter(rent => {
    if (viewMode === 'BOOKINGS') return rent.isReservation && rent.status === 'ACTIVE';
    if (viewMode === 'ARCHIVE') return rent.status === 'COMPLETED' || rent.status === 'CANCELLED';
    return !rent.isReservation && rent.status === 'ACTIVE';
  }), [rentals, viewMode]);

  const filteredRentals = useMemo(() => {
    const q = search.trim().toLowerCase();
    return scopedRentals.filter(rent => {
      if (q) {
        const client = getClient(rent.clientId);
        const car = getCar(rent.carId);
        // Ищем по ФИО, номеру договора и госномеру — именно так договор обычно и разыскивают.
        // Договоры с удалённым клиентом раньше выпадали из списка целиком: undefined из
        // client?.name делал условие ложным, и найти их было невозможно.
        const haystack = [
          client?.name, rent.contractNumber, car?.plate, car?.brand, car?.model, client?.phone
        ].filter(Boolean).join(' ').toLowerCase();
        if (!haystack.includes(q)) return false;
      }
      if (searchDate && !(dateOnly(rent.startDate) <= searchDate && searchDate <= dateOnly(rent.endDate))) return false;

      if (statusFilter === 'PAID' && debtOf(rent) > 0) return false;
      if (statusFilter === 'DEBT' && debtOf(rent) === 0) return false;
      if (statusFilter === 'OVERDUE' && !overdueOf(rent)) return false;
      return true;
    }).sort((a, b) => {
      // Просроченные — наверх, дальше по дате возврата: сначала то, что горит.
      const aOver = overdueOf(a) ? 1 : 0;
      const bOver = overdueOf(b) ? 1 : 0;
      if (aOver !== bOver) return bOver - aOver;
      if (viewMode === 'ARCHIVE') return new Date(b.endDate).getTime() - new Date(a.endDate).getTime();
      return new Date(a.endDate).getTime() - new Date(b.endDate).getTime();
    });
  }, [scopedRentals, search, searchDate, statusFilter, clients, cars, viewMode]);

  // Страница отрисовки. Итоги ниже намеренно считаются по всей выборке,
  // а не по странице: иначе суммы прыгали бы при листании.
  const pagedRentals = useMemo(
    () => filteredRentals.slice((page - 1) * pageSize, page * pageSize),
    [filteredRentals, page, pageSize]
  );

  // Возврат на первую страницу при смене фильтров, иначе можно остаться
  // на несуществующей странице и увидеть пустой список.
  useEffect(() => { setPage(1); }, [search, searchDate, statusFilter, viewMode, pageSize]);

  const summary = useMemo(() => {
    const total = filteredRentals.reduce((s, r) => s + (r.totalAmount || 0), 0);
    const paid = filteredRentals.reduce((s, r) => s + paidOf(r), 0);
    const debt = filteredRentals.reduce((s, r) => s + debtOf(r), 0);
    const overdue = filteredRentals.filter(r => overdueOf(r)).length;
    return { total, paid, debt, overdue, count: filteredRentals.length };
  }, [filteredRentals]);

  // Расчет стоимости продления
  useEffect(() => {
    if (extendingRental && extensionData.endDate && extensionData.endTime) {
      const car = getCar(extendingRental.carId);
      if (!car) return;
      const currentEnd = new Date(`${extendingRental.endDate.split('T')[0]}T${extendingRental.endTime}`);
      const newEnd = new Date(`${extensionData.endDate}T${extensionData.endTime}`);
      const diffHours = (newEnd.getTime() - currentEnd.getTime()) / (1000 * 60 * 60);
      if (diffHours > 0) {
        const price = extendingRental.bookingType === 'DAILY'
          ? Math.ceil(diffHours / 24) * car.pricePerDay
          : Math.ceil(diffHours) * (car.pricePerHour || Math.round(car.pricePerDay / 24));
        setExtensionData(prev => ({ ...prev, extraPrice: Math.round(price) }));
      } else {
        setExtensionData(prev => ({ ...prev, extraPrice: 0 }));
      }
    }
  }, [extensionData.endDate, extensionData.endTime, extendingRental, cars]);

  const extensionIsValid = useMemo(() => {
    if (!extendingRental || !extensionData.endDate || !extensionData.endTime) return false;
    const currentEnd = new Date(`${dateOnly(extendingRental.endDate)}T${extendingRental.endTime}`);
    const newEnd = new Date(`${extensionData.endDate}T${extensionData.endTime}`);
    return newEnd.getTime() > currentEnd.getTime();
  }, [extendingRental, extensionData.endDate, extensionData.endTime]);

  const handleExtendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendingRental) return;
    // Без этой проверки можно было выбрать более раннее время: доплата выходила 0,
    // а срок аренды молча сокращался.
    if (!extensionIsValid) return;
    const newExtension: RentalExtension = {
      endDate: extensionData.endDate,
      endTime: extensionData.endTime,
      amount: extensionData.extraPrice,
      date: new Date().toISOString(),
      paymentStatus: paymentMode
    };
    const updated: Rental = {
      ...extendingRental,
      endDate: extensionData.endDate,
      endTime: extensionData.endTime,
      totalAmount: (extendingRental.totalAmount || 0) + extensionData.extraPrice,
      paymentStatus: (extendingRental.paymentStatus === 'DEBT' || paymentMode === 'DEBT') ? 'DEBT' : 'PAID',
      extensions: [...(extendingRental.extensions || []), newExtension]
    };
    onUpdate(updated);
    setExtendingRental(null);
  };

  const handlePrint = (rent: Rental) => {
    setPrintingRental(rent);
    setTimeout(() => { window.print(); setPrintingRental(null); }, 300);
  };

  const handleDelete = (rent: Rental) => {
    const client = getClient(rent.clientId);
    const car = getCar(rent.carId);
    // Договор — финансовый документ, поэтому в подтверждении показываем, что именно удаляем.
    const ok = confirm(
      `Удалить договор № ${rent.contractNumber || '—'}?\n\n` +
      `Клиент: ${client?.name || 'удалён'}\n` +
      `Авто: ${car ? `${car.brand} ${car.model} (${car.plate})` : 'удалено'}\n` +
      `Сумма: ${(rent.totalAmount || 0).toLocaleString('ru-RU')} ₽\n\n` +
      `Действие необратимо.`
    );
    if (ok) onDelete(rent.id);
  };

  const formatMoney = (n: number) => n.toLocaleString('ru-RU') + ' ₽';
  // Год обязателен: в архиве без него не отличить прошлогодний договор от свежего.
  const formatDate = (d: string) =>
    new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit', year: '2-digit' });

  const titles = { BOOKINGS: 'Бронирования', ARCHIVE: 'Архив договоров', CONTRACTS: 'Действующие договоры' };

  const ContractRow: React.FC<{ rent: Rental }> = ({ rent }) => {
    const car = getCar(rent.carId);
    const client = getClient(rent.clientId);
    const overdue = overdueOf(rent);
    const debt = debtOf(rent);
    const extensionSum = (rent.extensions || []).reduce((s, e) => s + (e.amount || 0), 0);

    return (
      <div
        onClick={() => setSelectedRental(rent)}
        className={`bg-white rounded-2xl border p-3 cursor-pointer transition-all hover:shadow-sm relative ${
          overdue ? 'border-rose-200 bg-rose-50/40' : 'border-slate-100'
        }`}
      >
        <div className="flex items-center gap-3">
          <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
            overdue ? 'bg-rose-100 text-rose-600'
              : rent.isReservation ? 'bg-amber-50 text-amber-600'
              : rent.status === 'ACTIVE' ? 'bg-blue-50 text-blue-600'
              : 'bg-slate-100 text-slate-500'
          }`}>
            <i className={`fas ${rent.isReservation ? 'fa-calendar-check' : 'fa-file-contract'} text-sm`}></i>
          </div>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="font-semibold text-slate-900 truncate">
                {client?.name || <span className="text-slate-400 italic">клиент удалён</span>}
              </span>
              <span className="text-[10px] font-semibold text-slate-400 flex-shrink-0">
                № {rent.contractNumber || '—'}
              </span>
            </div>
            <div className="text-[11px] text-slate-500 font-medium truncate">
              {car ? `${car.brand} ${car.model} • ${car.plate}` : 'авто удалено'}
            </div>
            <div className="text-[11px] text-slate-400 font-medium mt-0.5">
              {formatDate(rent.startDate)} {rent.startTime} → {formatDate(rent.endDate)} {rent.endTime}
            </div>
          </div>

          <div className="text-right flex-shrink-0">
            <div className="font-bold text-slate-900">{formatMoney(rent.totalAmount || 0)}</div>
            {debt > 0
              ? <div className="text-[11px] font-semibold text-rose-600">долг {formatMoney(debt)}</div>
              : <div className="text-[11px] font-semibold text-emerald-600">оплачено</div>}
            {extensionSum > 0 && (
              <div className="text-[10px] font-medium text-blue-500">+{formatMoney(extensionSum)} продления</div>
            )}
          </div>

          <button
            onClick={(e) => { e.stopPropagation(); setShowActions(showActions === rent.id ? null : rent.id); }}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 flex-shrink-0"
          >
            <i className="fas fa-ellipsis-vertical"></i>
          </button>
        </div>

        {overdue && (
          <div className="mt-2 flex items-center gap-1.5 text-[11px] font-bold text-rose-600">
            <i className="fas fa-triangle-exclamation"></i>
            <span>Просрочка {overdue}</span>
          </div>
        )}

        {showActions === rent.id && (
          <>
            {/* z-[59]/z-[60]: нижняя навигация занимает z-50, а её подменю z-[55],
                и раньше лист действий уходил под них. pb-safe — под жест-бар телефона. */}
            <div className="fixed inset-0 z-[59] bg-slate-900/20 md:bg-transparent md:absolute md:inset-auto" onClick={(e) => { e.stopPropagation(); setShowActions(null); }} />
            <div
              onClick={(e) => e.stopPropagation()}
              className="fixed bottom-0 left-0 right-0 pb-safe md:pb-0 md:absolute md:bottom-auto md:left-auto md:right-0 md:top-full md:w-56 bg-white rounded-t-2xl md:rounded-2xl shadow-lg border border-slate-100 z-[60] overflow-hidden animate-slideUp"
            >
              <div className="md:hidden px-4 pt-3 pb-2 border-b border-slate-100 flex items-center justify-between">
                <span className="font-semibold">Действия</span>
                <button onClick={() => setShowActions(null)} className="p-2 -mr-2 text-slate-400"><i className="fas fa-xmark"></i></button>
              </div>
              <div className="p-2">
                <button onClick={() => { handlePrint(rent); setShowActions(null); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm hover:bg-slate-50">
                  <i className="fas fa-print w-4"></i> Печать договора
                </button>
                {rent.isReservation && onIssueFromBooking && (
                  <button onClick={() => { onIssueFromBooking(rent.id); setShowActions(null); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm text-emerald-600 hover:bg-emerald-50">
                    <i className="fas fa-key w-4"></i> Выдать авто
                  </button>
                )}
                {!rent.isReservation && rent.status === 'ACTIVE' && (
                  <>
                    <button onClick={() => { setExtendingRental(rent); setExtensionData({ endDate: '', endTime: '', extraPrice: 0 }); setShowActions(null); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm text-amber-600 hover:bg-amber-50">
                      <i className="fas fa-calendar-plus w-4"></i> Продлить
                    </button>
                    <button onClick={() => { onComplete(rent); setShowActions(null); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm text-blue-600 hover:bg-blue-50">
                      <i className="fas fa-check-circle w-4"></i> Завершить
                    </button>
                  </>
                )}
                <button onClick={() => { handleDelete(rent); setShowActions(null); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm text-rose-600 hover:bg-rose-50">
                  <i className="fas fa-trash w-4"></i> Удалить
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  const RentalDetail: React.FC<{ rent: Rental }> = ({ rent }) => {
    const car = getCar(rent.carId);
    const client = getClient(rent.clientId);
    const overdue = overdueOf(rent);
    const debt = debtOf(rent);

    // z-[70] — выше нижней навигации (z-50) и её подменю (z-[55]).
    // pt-safe в шапке: без него на телефонах с вырезом заголовок уезжал
    // под системную строку и кнопка «назад» оказывалась под часами.
    return (
      <div className="fixed inset-0 z-[70] bg-white overflow-y-auto animate-slideUp">
        <div className="sticky top-0 z-10 bg-white/95 backdrop-blur-sm border-b border-slate-100 pt-safe px-4 flex items-center justify-between">
          <button onClick={() => setSelectedRental(null)} className="p-3 -ml-2 text-slate-400"><i className="fas fa-arrow-left"></i></button>
          <h2 className="font-semibold text-sm truncate px-2">Договор № {rent.contractNumber || '—'}</h2>
          <button onClick={() => handlePrint(rent)} className="p-3 -mr-2 text-slate-400"><i className="fas fa-print"></i></button>
        </div>

        <div className="p-4 pb-24 space-y-3 max-w-2xl mx-auto">
          {overdue && (
            <div className="p-3 rounded-xl bg-rose-50 border border-rose-200 flex items-center gap-2">
              <i className="fas fa-triangle-exclamation text-rose-500"></i>
              <span className="text-sm font-semibold text-rose-700">Просрочка возврата: {overdue}</span>
            </div>
          )}

          <div className="bg-slate-50 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600"><i className="fas fa-user"></i></div>
              <div className="min-w-0">
                <div className="font-semibold truncate">{client?.name || 'Клиент удалён'}</div>
                <div className="text-sm text-slate-500">{client?.phone || '—'}</div>
              </div>
              {client?.phone && (
                <a
                  href={`https://wa.me/${client.phone.replace(/\D/g, '').replace(/^8/, '7')}`}
                  target="_blank" rel="noreferrer"
                  className="ml-auto w-10 h-10 bg-[#25D366] text-white rounded-xl flex items-center justify-center"
                >
                  <i className="fab fa-whatsapp"></i>
                </a>
              )}
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><div className="text-[11px] text-slate-400 uppercase">Авто</div><div className="font-medium">{car ? `${car.brand} ${car.model}` : '—'}</div></div>
              <div><div className="text-[11px] text-slate-400 uppercase">Номер</div><div className="font-medium">{car?.plate || '—'}</div></div>
              <div><div className="text-[11px] text-slate-400 uppercase">Начало</div><div className="font-medium">{formatDate(rent.startDate)} {rent.startTime}</div></div>
              <div><div className="text-[11px] text-slate-400 uppercase">Окончание</div><div className="font-medium">{formatDate(rent.endDate)} {rent.endTime}</div></div>
            </div>
          </div>

          <div className="bg-white border border-slate-100 rounded-2xl p-4">
            <h4 className="font-semibold mb-3">Оплата</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Сумма договора</span><span className="font-semibold">{formatMoney(rent.totalAmount || 0)}</span></div>
              {!!rent.prepayment && rent.prepayment > 0 && (
                <div className="flex justify-between"><span className="text-slate-500">Предоплата</span><span className="text-amber-600">{formatMoney(rent.prepayment)}</span></div>
              )}
              <div className="flex justify-between pt-2 border-t border-slate-100">
                <span className="font-medium">{debt > 0 ? 'Осталось получить' : 'Получено полностью'}</span>
                <span className={`font-bold ${debt > 0 ? 'text-rose-600' : 'text-emerald-600'}`}>{formatMoney(debt > 0 ? debt : (rent.totalAmount || 0))}</span>
              </div>
            </div>
          </div>

          {!!rent.extensions?.length && (
            <div className="bg-white border border-slate-100 rounded-2xl p-4">
              <h4 className="font-semibold mb-3">Продления</h4>
              <div className="space-y-2">
                {rent.extensions.map((ext, i) => (
                  <div key={i} className="flex items-center justify-between text-sm py-2 border-b border-slate-50 last:border-0">
                    <div>
                      <div className="font-medium text-slate-700">до {formatDate(ext.endDate)} {ext.endTime}</div>
                      <div className="text-[11px] text-slate-400">{new Date(ext.date).toLocaleDateString('ru-RU')}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatMoney(ext.amount || 0)}</div>
                      <div className={`text-[10px] font-semibold uppercase ${ext.paymentStatus === 'DEBT' ? 'text-rose-500' : 'text-emerald-500'}`}>
                        {ext.paymentStatus === 'DEBT' ? 'в долг' : 'оплачено'}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-2 gap-2 pb-6">
            {rent.isReservation && onIssueFromBooking && (
              <button onClick={() => { onIssueFromBooking(rent.id); setSelectedRental(null); }} className="py-3 bg-emerald-100 text-emerald-700 rounded-xl font-semibold text-sm col-span-2">
                <i className="fas fa-key mr-1"></i> Выдать авто
              </button>
            )}
            {!rent.isReservation && rent.status === 'ACTIVE' && (
              <>
                <button onClick={() => { setExtendingRental(rent); setExtensionData({ endDate: '', endTime: '', extraPrice: 0 }); }} className="py-3 bg-amber-100 text-amber-700 rounded-xl font-semibold text-sm"><i className="fas fa-calendar-plus mr-1"></i> Продлить</button>
                <button onClick={() => { onComplete(rent); setSelectedRental(null); }} className="py-3 bg-blue-100 text-blue-700 rounded-xl font-semibold text-sm"><i className="fas fa-check-circle mr-1"></i> Завершить</button>
              </>
            )}
            <button onClick={() => handlePrint(rent)} className="py-3 bg-slate-100 text-slate-700 rounded-xl font-semibold text-sm col-span-2"><i className="fas fa-print mr-1"></i> Печать</button>
          </div>
        </div>
      </div>
    );
  };

  const ExtensionModal = () => {
    if (!extendingRental) return null;
    const car = getCar(extendingRental.carId);
    return (
      <div className="fixed inset-0 z-[80] bg-slate-900/50 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4">
        <form onSubmit={handleExtendSubmit} className="bg-white w-full md:max-w-md md:rounded-xl rounded-t-2xl max-h-[90vh] overflow-y-auto animate-slideUp pb-safe md:pb-0">
          <div className="sticky top-0 bg-white px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold">Продление аренды</h3>
            <button type="button" onClick={() => setExtendingRental(null)} className="p-2 text-slate-400"><i className="fas fa-xmark"></i></button>
          </div>
          <div className="p-4 space-y-4">
            <div className="bg-slate-50 rounded-xl p-3 text-sm">
              <div className="font-medium">{car ? `${car.brand} ${car.model}` : '—'}</div>
              <div className="text-slate-500">сейчас до {formatDate(extendingRental.endDate)} {extendingRental.endTime}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-400 uppercase mb-1 block">Новая дата</label>
                <input type="date" value={extensionData.endDate} onChange={e => setExtensionData(d => ({ ...d, endDate: e.target.value }))} required min={dateOnly(extendingRental.endDate)} className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-400 uppercase mb-1 block">Время</label>
                <input type="time" value={extensionData.endTime} onChange={e => setExtensionData(d => ({ ...d, endTime: e.target.value }))} required className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm" />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium text-slate-400 uppercase mb-2 block">Оплата</label>
              <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                {(['PAID', 'DEBT'] as const).map(mode => (
                  <button key={mode} type="button" onClick={() => setPaymentMode(mode)} className={`flex-1 py-2 rounded-lg text-sm font-medium ${paymentMode === mode ? 'bg-white text-slate-900 shadow-sm' : 'text-slate-500'}`}>
                    {mode === 'PAID' ? 'Оплачено' : 'В долг'}
                  </button>
                ))}
              </div>
            </div>
            {extensionData.endDate && extensionData.endTime && !extensionIsValid ? (
              <div className="bg-rose-50 rounded-xl p-4 text-sm font-semibold text-rose-700">
                <i className="fas fa-triangle-exclamation mr-1"></i>
                Новый срок должен быть позже текущего окончания аренды
              </div>
            ) : (
              <div className="bg-emerald-50 rounded-xl p-4 flex items-center justify-between">
                <div>
                  <div className="text-[11px] text-emerald-600 font-medium uppercase">Доплата</div>
                  <div className="text-xl font-bold text-emerald-700">+{formatMoney(extensionData.extraPrice)}</div>
                </div>
                <i className="fas fa-calculator text-emerald-300 text-xl"></i>
              </div>
            )}
          </div>
          <div className="sticky bottom-0 bg-white px-4 py-3 border-t border-slate-100 flex gap-2">
            <button type="button" onClick={() => setExtendingRental(null)} className="flex-1 py-3 text-slate-500 font-medium">Отмена</button>
            <button type="submit" disabled={!extensionIsValid} className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-semibold disabled:opacity-40 disabled:cursor-not-allowed">Сохранить</button>
          </div>
        </form>
      </div>
    );
  };

  const filters: { id: StatusFilter; label: string }[] = [
    { id: 'ALL', label: 'Все' },
    { id: 'DEBT', label: 'С долгом' },
    { id: 'PAID', label: 'Оплачены' },
    ...(viewMode === 'CONTRACTS' ? [{ id: 'OVERDUE' as StatusFilter, label: 'Просрочены' }] : [])
  ];

  return (
    <div className="space-y-4 animate-fadeIn pb-24 md:pb-0">
      <style>{`
        @media print {
          @page { size: A4; margin: 10mm; }
          body * { visibility: hidden; }
          #print-section, #print-section * { visibility: visible; }
          #print-section { position: absolute; left: 0; top: 0; width: 100%; font-family: "Times New Roman", Times, serif; font-size: 10pt; line-height: 1.2; color: black; background: white; padding: 0 10mm; }
          .no-print { display: none !important; }
          .print-header { font-size: 16pt; font-weight: bold; text-transform: uppercase; margin-bottom: 10px; text-align: center; }
          .print-subheader { font-size: 12pt; font-weight: bold; margin-top: 10px; margin-bottom: 5px; text-transform: uppercase; text-align: center; }
          .print-bold { font-weight: bold; }
          .print-underline { border-bottom: 1px solid black; padding-bottom: 1px; display: inline-block; }
          .print-row { display: flex; justify-content: space-between; margin-bottom: 5px; }
          .print-list { padding-left: 20px; margin-bottom: 10px; }
          .print-list li { margin-bottom: 2px; }
          .print-signatures { margin-top: 40px; }
          .print-table { width: 100%; border-collapse: collapse; margin-bottom: 15px; font-size: 9pt; }
          .print-table th, .print-table td { border: 1px solid black; padding: 4px; text-align: left; }
        }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
      `}</style>

      {/* Итоги: для учётной страницы это главное, раньше их не было вовсе */}
      <div className="no-print grid grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-white p-4 rounded-2xl border border-slate-100">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">{titles[viewMode]}</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{summary.count}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Сумма</div>
          <div className="text-2xl font-bold text-slate-900 mt-1">{summary.total.toLocaleString('ru-RU')} ₽</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Получено</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">{summary.paid.toLocaleString('ru-RU')} ₽</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Долг</div>
          <div className={`text-2xl font-bold mt-1 ${summary.debt > 0 ? 'text-rose-600' : 'text-slate-900'}`}>
            {summary.debt.toLocaleString('ru-RU')} ₽
          </div>
          {summary.overdue > 0 && (
            <div className="text-[10px] font-semibold text-rose-500 mt-0.5">просрочено: {summary.overdue}</div>
          )}
        </div>
      </div>

      {/* Поиск и фильтры */}
      <div className="no-print bg-white p-4 rounded-2xl border border-slate-100 space-y-3">
        <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-3">
          <div className="relative">
            <i className="fas fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="ФИО, номер договора, госномер, телефон"
              className="w-full pl-9 pr-9 py-2.5 bg-slate-50 rounded-xl text-sm font-medium outline-none border-2 border-transparent focus:border-blue-500 transition-all"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-300 hover:text-slate-600">
                <i className="fas fa-xmark text-xs"></i>
              </button>
            )}
          </div>
          <div className="relative">
            <input
              type="date"
              value={searchDate}
              onChange={e => setSearchDate(e.target.value)}
              title="Договоры, действующие в этот день"
              className="w-full sm:w-44 px-3 py-2.5 bg-slate-50 rounded-xl text-sm font-medium outline-none border-2 border-transparent focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {filters.map(f => (
            <button
              key={f.id}
              onClick={() => setStatusFilter(f.id)}
              className={`px-3.5 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wide transition-all ${
                statusFilter === f.id ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400 hover:text-slate-600'
              }`}
            >
              {f.label}
            </button>
          ))}
          {(search || searchDate || statusFilter !== 'ALL') && (
            <button
              onClick={() => { setSearch(''); setSearchDate(''); setStatusFilter('ALL'); }}
              className="px-3.5 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wide text-blue-600 hover:bg-blue-50"
            >
              Сбросить
            </button>
          )}
        </div>
      </div>

      {/* Список */}
      <div className="no-print grid gap-2">
        {pagedRentals.map(rent => <ContractRow key={rent.id} rent={rent} />)}
        {filteredRentals.length === 0 && (
          <div className="p-12 text-center bg-white rounded-2xl border border-slate-100">
            <i className="fas fa-file-contract text-3xl text-slate-200 mb-3"></i>
            <div className="font-semibold text-slate-500">
              {search || searchDate || statusFilter !== 'ALL' ? 'Ничего не найдено' : `Нет записей в разделе «${titles[viewMode]}»`}
            </div>
          </div>
        )}
      </div>

      {filteredRentals.length > 0 && (
        <div className="no-print bg-white rounded-2xl border border-slate-100">
          <Pagination
            page={page}
            pageSize={pageSize}
            totalItems={filteredRentals.length}
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      )}

      {selectedRental && <RentalDetail rent={selectedRental} />}
      {extendingRental && <ExtensionModal />}

      {/* 🔥 ТВОЙ ОРИГИНАЛЬНЫЙ ШАБЛОН ПЕЧАТИ — БЕЗ ИЗМЕНЕНИЙ 🔥 */}
      {printingRental && (
        <div id="print-section">
          <div className="text-center print-header">
            {brandName || 'AutoPro'}
          </div>
          <div className="text-center" style={{fontSize: '11pt', marginBottom: '15px'}}>
             Договор № {printingRental.contractNumber} аренды транспортного средства
          </div>
          <p className="mb-2">
             Арендодатель на основании Устава с одной стороны и гражданин:
          </p>
          <div className="print-row mb-2">
             <div><span className="print-bold">Ф.И.О.:</span> <span className="print-underline" style={{minWidth: '250px'}}>{getClient(printingRental.clientId)?.name}</span></div>
             <div><span className="print-bold">Тел:</span> {getClient(printingRental.clientId)?.phone}</div>
          </div>
          <div className="mb-4">
             <span className="print-bold">Место проживания:</span> <span className="print-underline" style={{width: '70%'}}></span>
          </div>
          <div className="print-subheader">1. ПРЕДМЕТ ДОГОВОРА</div>
          <p className="mb-2">1.1. Согласно настоящему договору Арендодатель предоставляет арендатору следующий автомобиль:</p>
          <div className="mb-4" style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '5px'}}>
             <div><span className="print-bold">Марка/Модель:</span> {getCar(printingRental.carId)?.brand} {getCar(printingRental.carId)?.model}</div>
             <div><span className="print-bold">Год выпуска:</span> {getCar(printingRental.carId)?.year}</div>
             <div><span className="print-bold">Гос. номер:</span> {getCar(printingRental.carId)?.plate}</div>
             <div><span className="print-bold">Цвет:</span> _______________</div>
          </div>
          <div className="print-subheader">2. УСЛОВИЯ ПРОКАТА</div>
          <ol className="print-list" style={{listStyleType: 'decimal'}}>
             <li>Арендодатель обязуется предоставить автомобиль в полном исправном состоянии.</li>
             <li>Полная мойка автотранспорта при возврате.</li>
             <li>Бензин не ниже АИ-95.</li>
             <li>Арендодатель не несет ответственность за действия арендатора, которыми причинен ущерб третьим лицам.</li>
          </ol>
          <div className="print-subheader">3. ОБЯЗАННОСТИ АРЕНДАТОРА</div>
          <ul className="print-list" style={{listStyleType: 'disc'}}>
             <li>Арендатор несет 100% ответственность во время проката автомобиля.</li>
             <li>Мойка автотранспорта при возвращении обязательна или штраф 1 000 рублей.</li>
             <li>Не известив Арендодателя о поломке — штраф 15 000 р.</li>
             <li>Опоздание более чем на 30 мин — оплата как за час.</li>
             <li>Передача руля третьим лицам запрещена — штраф до 35 000 р.</li>
             <li>Штрафы ГИБДД оплачивает Арендатор в 100% размере.</li>
             <li>При ДТП — полная компенсация ущерба и простоя автомобиля.</li>
             <li>За курение в салоне — штраф 2 000 р.</li>
             <li>Превышение скорости &gt;150 км/ч — штраф 2 000 р.</li>
             <li>Вождение в нетрезвом виде — штраф 50 000 р.</li>
             <li>Дергать ручник — штраф 2 000 р.</li>
          </ul>
          <div className="print-subheader">4. СРОК ДЕЙСТВИЯ И ОПЛАТА</div>
          <div className="mb-2" style={{display: 'flex', justifyContent: 'space-between', paddingRight: '20px'}}>
             <div>
               <span className="print-bold">Начало аренды:</span><br/>
               {new Date(printingRental.startDate).toLocaleDateString()} в {printingRental.startTime}
             </div>
             <div>
               <span className="print-bold">Окончание аренды:</span><br/>
               {new Date(printingRental.endDate).toLocaleDateString()} в {printingRental.endTime}
             </div>
          </div>
          <div className="mb-4">
            <span className="print-bold">Общая стоимость:</span> {printingRental.totalAmount.toLocaleString()} ₽<br/>
            {printingRental.isReservation ? (
               <>
                 <span className="print-bold">Внесена предоплата:</span> {printingRental.prepayment ? printingRental.prepayment.toLocaleString() : '0'} ₽<br/>
                 <span className="print-bold">Остаток к оплате:</span> {(printingRental.totalAmount - (printingRental.prepayment || 0)).toLocaleString()} ₽
               </>
            ) : (
               <><span className="print-bold">Статус оплаты:</span> {printingRental.paymentStatus === 'DEBT' ? 'Имеется задолженность' : 'Оплачено полностью'}</>
            )}
          </div>
          {printingRental.extensions && printingRental.extensions.length > 0 && (
            <>
              <div className="print-subheader">5. ПРОДЛЕНИЕ АРЕНДЫ (ДОП. СОГЛАШЕНИЯ)</div>
              <table className="print-table">
                <thead>
                  <tr>
                    <th>Дата продления</th>
                    <th>Новый срок</th>
                    <th>Сумма</th>
                    <th>Статус</th>
                  </tr>
                </thead>
                <tbody>
                  {printingRental.extensions.map((ext, idx) => (
                    <tr key={idx}>
                      <td>{new Date(ext.date).toLocaleDateString()}</td>
                      <td>до {new Date(ext.endDate).toLocaleDateString()} {ext.endTime}</td>
                      <td>{ext.amount.toLocaleString()} ₽</td>
                      <td>{ext.paymentStatus === 'DEBT' ? 'В долг' : 'Оплачено'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <div style={{textAlign: 'right', fontWeight: 'bold', marginBottom: '10px'}}>
                Итого продлений: {printingRental.extensions.reduce((acc, e) => acc + (e.amount || 0), 0).toLocaleString()} ₽
              </div>
            </>
          )}
          <div className="print-signatures" style={{display: 'flex', justifyContent: 'space-between', marginTop: '40px'}}>
             <div style={{width: '40%'}}>
                <div className="print-bold mb-6">АРЕНДОДАТЕЛЬ:</div>
                <div style={{borderBottom: '1px solid black', width: '100%', height: '20px'}}></div>
                <div style={{textAlign: 'center', fontSize: '9pt', marginTop: '5px'}}>/ Подпись /</div>
             </div>
             <div style={{width: '40%'}}>
                <div className="print-bold mb-6">АРЕНДАТОР:</div>
                <div style={{borderBottom: '1px solid black', width: '100%', height: '20px'}}></div>
                <div style={{textAlign: 'center', fontSize: '9pt', marginTop: '5px'}}>/ Подпись /</div>
             </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ContractList;
