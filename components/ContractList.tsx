import React, { useState, useEffect, useMemo } from 'react';
import { Rental, Car, Client, RentalExtension } from '../types';

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

type SortOption = 'date-desc' | 'date-asc' | 'amount-desc' | 'name-asc';

const ContractList: React.FC<ContractListProps> = ({
  rentals, cars, clients, onUpdate, onDelete, onIssueFromBooking, onComplete,
  viewMode = 'CONTRACTS', brandName
}) => {
  const [extendingRental, setExtendingRental] = useState<Rental | null>(null);
  const [activeActions, setActiveActions] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<'PAID' | 'DEBT'>('PAID');
  const [extensionData, setExtensionData] = useState({ endDate: '', endTime: '', extraPrice: 0 });
  const [printingRental, setPrintingRental] = useState<Rental | null>(null);
  const [selectedRental, setSelectedRental] = useState<Rental | null>(null);
  const [sortBy, setSortBy] = useState<SortOption>('date-desc');

  const [filters, setFilters] = useState({ name: '', date: '', status: 'all' });

  const getCar = (id: string) => cars.find(c => c.id === id);
  const getClient = (id: string) => clients.find(c => c.id === id);

  const filteredRentals = useMemo(() => {
    let result = rentals.filter(rent => {
      let typeMatch = false;
      if (viewMode === 'BOOKINGS') typeMatch = rent.isReservation && rent.status === 'ACTIVE';
      else if (viewMode === 'ARCHIVE') typeMatch = rent.status === 'COMPLETED' || rent.status === 'CANCELLED';
      else typeMatch = !rent.isReservation && rent.status === 'ACTIVE';
      if (!typeMatch) return false;

      const client = getClient(rent.clientId);
      const nameMatch = !filters.name || client?.name.toLowerCase().includes(filters.name.toLowerCase());
      const dateMatch = !filters.date || rent.startDate.startsWith(filters.date) || rent.endDate.startsWith(filters.date);
      const statusMatch = filters.status === 'all' || rent.paymentStatus === filters.status;
      return nameMatch && dateMatch && statusMatch;
    });

    // Сортировка
    result.sort((a, b) => {
      if (sortBy === 'date-desc') return new Date(b.startDate).getTime() - new Date(a.startDate).getTime();
      if (sortBy === 'date-asc') return new Date(a.startDate).getTime() - new Date(b.startDate).getTime();
      if (sortBy === 'amount-desc') return (b.totalAmount || 0) - (a.totalAmount || 0);
      if (sortBy === 'name-asc') {
        const nameA = getClient(a.clientId)?.name || '';
        const nameB = getClient(b.clientId)?.name || '';
        return nameA.localeCompare(nameB);
      }
      return 0;
    });

    return result;
  }, [rentals, viewMode, filters, sortBy, clients]);

  // Расчет стоимости продления
  useEffect(() => {
    if (!extendingRental || !extensionData.endDate || !extensionData.endTime) return;
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
    };
  }, [extensionData.endDate, extensionData.endTime, extendingRental, cars]);

  const handleExtendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendingRental) return;
    const newExt: RentalExtension = {
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
      paymentStatus: extendingRental.paymentStatus === 'DEBT' || paymentMode === 'DEBT' ? 'DEBT' : 'PAID',
      extensions: [...(extendingRental.extensions || []), newExt]
    };
    onUpdate(updated);
    setExtendingRental(null);
  };

  const handlePrint = (rent: Rental) => {
    setPrintingRental(rent);
    setTimeout(() => { window.print(); setPrintingRental(null); }, 300);
  };

  const formatMoney = (n: number) => n.toLocaleString('ru-RU') + ' ₽';
  const formatDate = (d: string) => new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });

  // 🎯 Компактная карточка договора (для списка)
  const ContractCard = ({ rent, compact = false }: { rent: Rental; compact?: boolean }) => {
    const car = getCar(rent.carId);
    const client = getClient(rent.clientId);
    const extensionSum = (rent.extensions || []).reduce((s, e) => s + (e.amount || 0), 0);
    const remaining = Math.max(0, (rent.totalAmount || 0) - (rent.prepayment || 0));

    return (
      <div
        className={`bg-white rounded-2xl border border-slate-100 transition-all ${
          compact ? 'p-4' : 'p-5'
        } hover:shadow-md hover:border-slate-200 active:scale-[0.99]`}
        onClick={() => !compact && setSelectedRental(rent)}
      >
        {/* Заголовок карточки */}
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className={`w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 ${
              rent.isReservation ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'
            }`}>
              <i className={`fas ${rent.isReservation ? 'fa-calendar-check' : 'fa-file-contract'} text-sm`}></i>
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2">
                <h4 className="font-semibold text-slate-900 truncate">{client?.name}</h4>
                {rent.isReservation && (
                  <span className="px-2 py-0.5 bg-amber-100 text-amber-700 text-[10px] font-medium rounded-full">Бронь</span>
                )}
              </div>
              <p className="text-sm text-slate-500 truncate">{car?.brand} {car?.model} • {car?.plate}</p>
            </div>
          </div>
          
          {/* Кнопка действий */}
          <div className="relative">
            <button
              onClick={(e) => { e.stopPropagation(); setActiveActions(activeActions === rent.id ? null : rent.id); }}
              className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400 hover:text-slate-600 transition-colors"
            >
              <i className="fas fa-ellipsis-vertical"></i>
            </button>
            
            {/* Меню действий — мобильный стиль (снизу) / десктоп (выпадающее) */}
            {activeActions === rent.id && (
              <>
                <div className="fixed inset-0 z-40 md:absolute md:inset-auto" onClick={() => setActiveActions(null)} />
                <div className={`fixed bottom-0 left-0 right-0 md:absolute md:bottom-auto md:left-auto md:right-0 md:top-full md:w-56 bg-white rounded-t-3xl md:rounded-2xl shadow-2xl border border-slate-100 z-50 overflow-hidden animate-slideUp md:animate-scaleIn`}>
                  {/* Заголовок для мобильного меню */}
                  <div className="md:hidden p-4 border-b border-slate-100 flex items-center justify-between">
                    <span className="font-semibold text-slate-900">Действия</span>
                    <button onClick={() => setActiveActions(null)} className="p-2 -mr-2 text-slate-400">
                      <i className="fas fa-xmark"></i>
                    </button>
                  </div>
                  
                  <div className="p-2">
                    <ActionButton icon="fa-print" label="Печать" onClick={() => { handlePrint(rent); setActiveActions(null); }} />
                    {rent.isReservation && onIssueFromBooking && (
                      <ActionButton icon="fa-key" label="Выдать авто" onClick={() => { onIssueFromBooking(rent.id); setActiveActions(null); }} highlight="emerald" />
                    )}
                    {!rent.isReservation && rent.status === 'ACTIVE' && (
                      <>
                        <ActionButton icon="fa-calendar-plus" label="Продлить" onClick={() => { setExtendingRental(rent); setActiveActions(null); }} highlight="amber" />
                        <ActionButton icon="fa-check-circle" label="Завершить" onClick={() => { onComplete(rent); setActiveActions(null); }} highlight="blue" />
                      </>
                    )}
                    <ActionButton icon="fa-trash" label="Удалить" onClick={() => { if(confirm('Удалить договор?')) { onDelete(rent.id); setActiveActions(null); } }} highlight="rose" danger />
                  </div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Даты и статус */}
        <div className="flex items-center justify-between text-sm mb-3">
          <div className="flex items-center gap-1.5 text-slate-600">
            <span>{formatDate(rent.startDate)}</span>
            <i className="fas fa-arrow-right text-[10px] text-slate-300"></i>
            <span>{formatDate(rent.endDate)}</span>
          </div>
          <StatusBadge rent={rent} />
        </div>

        {/* Сумма */}
        <div className="flex items-end justify-between">
          <div>
            <div className="text-lg font-bold text-slate-900">{formatMoney(rent.totalAmount || 0)}</div>
            {extensionSum > 0 && <div className="text-[11px] text-blue-600">+{formatMoney(extensionSum)} продления</div>}
          </div>
          {rent.isReservation ? (
            <div className="text-right">
              <div className="text-[11px] text-slate-400">Предоплата</div>
              <div className="font-semibold text-amber-600">{formatMoney(rent.prepayment || 0)}</div>
              {remaining > 0 && <div className="text-[10px] text-slate-400">Остаток: {formatMoney(remaining)}</div>}
            </div>
          ) : (
            <PaymentBadge status={rent.paymentStatus} />
          )}
        </div>

        {/* Продления (если есть) */}
        {rent.extensions && rent.extensions.length > 0 && !compact && (
          <div className="mt-4 pt-3 border-t border-slate-100">
            <div className="text-[11px] font-medium text-slate-400 mb-2">Продления:</div>
            <div className="flex flex-wrap gap-1.5">
              {rent.extensions.slice(-3).map((ext, i) => (
                <span key={i} className={`px-2.5 py-1 rounded-lg text-[10px] font-medium ${
                  ext.paymentStatus === 'DEBT' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
                }`}>
                  {formatDate(ext.endDate)} • +{formatMoney(ext.amount || 0)}
                </span>
              ))}
              {rent.extensions.length > 3 && (
                <span className="px-2 py-1 text-[10px] text-slate-400">+{rent.extensions.length - 3} ещё</span>
              )}
            </div>
          </div>
        )}
      </div>
    );
  };

  // 🎯 Детальный вид договора (при тапе на мобильном)
  const RentalDetail = ({ rent }: { rent: Rental }) => {
    const car = getCar(rent.carId);
    const client = getClient(rent.clientId);
    
    return (
      <div className="fixed inset-0 z-50 bg-white overflow-y-auto animate-slideUp">
        {/* Хедер */}
        <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-slate-100 px-4 py-3 flex items-center justify-between">
          <button onClick={() => setSelectedRental(null)} className="p-2 -ml-2 text-slate-400 hover:text-slate-600">
            <i className="fas fa-arrow-left"></i>
          </button>
          <h2 className="font-semibold text-slate-900">{rent.contractNumber}</h2>
          <button onClick={() => handlePrint(rent)} className="p-2 text-slate-400 hover:text-slate-600">
            <i className="fas fa-print"></i>
          </button>
        </div>

        {/* Контент */}
        <div className="p-4 space-y-4">
          {/* Клиент + авто */}
          <div className="bg-slate-50 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600">
                <i className="fas fa-user"></i>
              </div>
              <div>
                <div className="font-semibold text-slate-900">{client?.name}</div>
                <div className="text-sm text-slate-500">{client?.phone}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <InfoRow label="Авто" value={`${car?.brand} ${car?.model}`} />
              <InfoRow label="Номер" value={car?.plate} />
              <InfoRow label="Начало" value={`${formatDate(rent.startDate)} ${rent.startTime}`} />
              <InfoRow label="Окончание" value={`${formatDate(rent.endDate)} ${rent.endTime}`} />
            </div>
          </div>

          {/* Финансы */}
          <div className="bg-white border border-slate-100 rounded-2xl p-4">
            <h4 className="font-semibold text-slate-900 mb-3">Оплата</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Сумма договора</span>
                <span className="font-semibold">{formatMoney(rent.totalAmount || 0)}</span>
              </div>
              {rent.prepayment && rent.prepayment > 0 && (
                <div className="flex justify-between">
                  <span className="text-slate-500">Предоплата</span>
                  <span className="text-amber-600">-{formatMoney(rent.prepayment)}</span>
                </div>
              )}
              <div className="flex justify-between pt-2 border-t border-slate-100">
                <span className="font-medium">К оплате</span>
                <span className="font-bold text-slate-900">{formatMoney(Math.max(0, (rent.totalAmount||0) - (rent.prepayment||0)))}</span>
              </div>
            </div>
          </div>

          {/* Продления */}
          {rent.extensions && rent.extensions.length > 0 && (
            <div className="bg-white border border-slate-100 rounded-2xl p-4">
              <h4 className="font-semibold text-slate-900 mb-3">История продлений</h4>
              <div className="space-y-2">
                {rent.extensions.map((ext, i) => (
                  <div key={i} className="flex items-center justify-between p-3 bg-slate-50 rounded-xl">
                    <div>
                      <div className="text-sm font-medium text-slate-900">{formatDate(ext.endDate)} {ext.endTime}</div>
                      <div className="text-xs text-slate-400">{new Date(ext.date).toLocaleDateString()}</div>
                    </div>
                    <div className="text-right">
                      <div className="font-semibold">{formatMoney(ext.amount || 0)}</div>
                      <span className={`text-[10px] px-2 py-0.5 rounded-full ${
                        ext.paymentStatus === 'DEBT' ? 'bg-rose-100 text-rose-600' : 'bg-emerald-100 text-emerald-600'
                      }`}>
                        {ext.paymentStatus === 'DEBT' ? 'Долг' : 'Оплачено'}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Кнопки действий */}
          <div className="grid grid-cols-2 gap-3 pt-2">
            {!rent.isReservation && rent.status === 'ACTIVE' && (
              <>
                <button onClick={() => setExtendingRental(rent)} className="py-3 bg-amber-100 text-amber-700 rounded-xl font-medium">
                  <i className="fas fa-calendar-plus mr-1"></i> Продлить
                </button>
                <button onClick={() => onComplete(rent)} className="py-3 bg-blue-100 text-blue-700 rounded-xl font-medium">
                  <i className="fas fa-check-circle mr-1"></i> Завершить
                </button>
              </>
            )}
            <button onClick={() => handlePrint(rent)} className="py-3 bg-slate-100 text-slate-700 rounded-xl font-medium col-span-2">
              <i className="fas fa-print mr-1"></i> Печать договора
            </button>
          </div>
        </div>
      </div>
    );
  };

  // 🎯 Фильтры (адаптивные)
  const renderFilters = () => (
    <div className="space-y-3 mb-4">
      {/* Поиск по имени — горизонтальный скролл на мобильных */}
      <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 scrollbar-hide">
        <div className="relative flex-1 min-w-[200px]">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-sm"></i>
          <input
            value={filters.name}
            onChange={e => setFilters(f => ({ ...f, name: e.target.value }))}
            placeholder="Поиск по имени..."
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-300 focus:ring-2 focus:ring-slate-100"
            style={{ minHeight: '44px' }}
          />
        </div>
        <input
          type="date"
          value={filters.date}
          onChange={e => setFilters(f => ({ ...f, date: e.target.value }))}
          className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-300"
          style={{ minHeight: '44px' }}
        />
      </div>
      
      {/* Сортировка и статус — в одну строку */}
      <div className="flex gap-2">
        <select
          value={sortBy}
          onChange={e => setSortBy(e.target.value as SortOption)}
          className="flex-1 px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-300"
          style={{ minHeight: '44px' }}
        >
          <option value="date-desc">Сначала новые</option>
          <option value="date-asc">Сначала старые</option>
          <option value="amount-desc">По сумме</option>
          <option value="name-asc">По имени</option>
        </select>
        {!viewMode.includes('BOOK') && (
          <select
            value={filters.status}
            onChange={e => setFilters(f => ({ ...f, status: e.target.value }))}
            className="px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-300"
            style={{ minHeight: '44px' }}
          >
            <option value="all">Все оплаты</option>
            <option value="PAID">Оплачено</option>
            <option value="DEBT">Долг</option>
          </select>
        )}
      </div>
    </div>
  );

  // 🎯 Модальное окно продления (полноэкранное на мобильных)
  const ExtensionModal = () => {
    if (!extendingRental) return null;
    const car = getCar(extendingRental.carId);
    
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4">
        <form onSubmit={handleExtendSubmit} className="bg-white w-full md:max-w-md md:rounded-3xl rounded-t-3xl max-h-[90vh] overflow-y-auto animate-slideUp">
          {/* Хедер */}
          <div className="sticky top-0 bg-white px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold text-slate-900">Продление аренды</h3>
            <button type="button" onClick={() => setExtendingRental(null)} className="p-2 text-slate-400">
              <i className="fas fa-xmark"></i>
            </button>
          </div>
          
          {/* Контент */}
          <div className="p-4 space-y-4">
            <div className="bg-slate-50 rounded-xl p-3 text-sm">
              <div className="font-medium text-slate-900">{getCar(extendingRental.carId)?.brand} {getCar(extendingRental.carId)?.model}</div>
              <div className="text-slate-500">до {formatDate(extendingRental.endDate)} {extendingRental.endTime}</div>
            </div>
            
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-400 uppercase mb-1 block">Новая дата</label>
                <input
                  type="date"
                  value={extensionData.endDate}
                  onChange={e => setExtensionData(d => ({ ...d, endDate: e.target.value }))}
                  required
                  min={extendingRental.endDate.split('T')[0]}
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-300"
                />
              </div>
              <div>
                <label className="text-[11px] font-medium text-slate-400 uppercase mb-1 block">Время</label>
                <input
                  type="time"
                  value={extensionData.endTime}
                  onChange={e => setExtensionData(d => ({ ...d, endTime: e.target.value }))}
                  required
                  className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-300"
                />
              </div>
            </div>
            
            {/* Оплата */}
            <div>
              <label className="text-[11px] font-medium text-slate-400 uppercase mb-2 block">Оплата продления</label>
              <div className="flex gap-2 p-1 bg-slate-100 rounded-xl">
                {(['PAID', 'DEBT'] as const).map(mode => (
                  <button
                    key={mode}
                    type="button"
                    onClick={() => setPaymentMode(mode)}
                    className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${
                      paymentMode === mode
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-500'
                    }`}
                  >
                    {mode === 'PAID' ? 'Оплачено' : 'В долг'}
                  </button>
                ))}
              </div>
            </div>
            
            {/* Итог */}
            <div className="bg-emerald-50 rounded-xl p-4 flex items-center justify-between">
              <div>
                <div className="text-[11px] text-emerald-600 font-medium uppercase">Доплата</div>
                <div className="text-xl font-bold text-emerald-700">+{formatMoney(extensionData.extraPrice)}</div>
              </div>
              <i className="fas fa-calculator text-emerald-300 text-xl"></i>
            </div>
          </div>
          
          {/* Кнопки */}
          <div className="sticky bottom-0 bg-white px-4 py-3 border-t border-slate-100 flex gap-2">
            <button type="button" onClick={() => setExtendingRental(null)} className="flex-1 py-3 text-slate-500 font-medium">
              Отмена
            </button>
            <button type="submit" className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-semibold">
              Сохранить
            </button>
          </div>
        </form>
      </div>
    );
  };

  // 🎯 Печать договора (упрощённый шаблон)
  const PrintTemplate = ({ rent }: { rent: Rental }) => {
    if (!rent) return null;
    const car = getCar(rent.carId);
    const client = getClient(rent.clientId);
    
    return (
      <div id="print-section" className="hidden print:block p-6 font-serif text-sm leading-relaxed">
        <div className="text-center mb-6">
          <div className="text-lg font-bold uppercase">{brandName || 'AutoPro'}</div>
          <div className="mt-2">ДОГОВОР № {rent.contractNumber}</div>
          <div className="text-xs text-slate-500">аренды транспортного средства</div>
        </div>
        
        <div className="mb-4">
          <p><span className="font-bold">Арендатор:</span> {client?.name}</p>
          <p><span className="font-bold">Телефон:</span> {client?.phone}</p>
          <p><span className="font-bold">Автомобиль:</span> {car?.brand} {car?.model}, гос. № {car?.plate}</p>
        </div>
        
        <div className="mb-4">
          <p className="font-bold mb-1">Срок аренды:</p>
          <p>{formatDate(rent.startDate)} {rent.startTime} — {formatDate(rent.endDate)} {rent.endTime}</p>
        </div>
        
        <div className="mb-4">
          <p className="font-bold mb-1">Стоимость:</p>
          <p>{formatMoney(rent.totalAmount || 0)} {rent.prepayment ? `(предоплата: ${formatMoney(rent.prepayment)})` : ''}</p>
          {rent.extensions && rent.extensions.length > 0 && (
            <p className="text-xs text-slate-500 mt-1">
              Включая продления: {formatMoney(rent.extensions.reduce((s,e) => s + (e.amount||0), 0))}
            </p>
          )}
        </div>
        
        <div className="mt-8 grid grid-cols-2 gap-8">
          <div>
            <div className="font-bold mb-8">АРЕНДОДАТЕЛЬ</div>
            <div className="border-b border-black pb-1">_________________</div>
            <div className="text-xs text-center mt-1">/ подпись /</div>
          </div>
          <div>
            <div className="font-bold mb-8">АРЕНДАТОР</div>
            <div className="border-b border-black pb-1">_________________</div>
            <div className="text-xs text-center mt-1">/ подпись /</div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto py-4 px-4">
      {/* Стили для печати и анимаций */}
      <style>{`
        @media print {
          body * { visibility: hidden; }
          #print-section, #print-section * { visibility: visible; }
          #print-section { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; }
          .no-print { display: none !important; }
        }
        @keyframes slideUp { from { transform: translateY(100%); } to { transform: translateY(0); } }
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
        .animate-scaleIn { animation: scaleIn 0.2s ease-out; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Заголовок */}
      <div className="mb-4">
        <h1 className="text-xl font-bold text-slate-900">
          {viewMode === 'BOOKINGS' ? 'Бронирования' : viewMode === 'ARCHIVE' ? 'Архив' : 'Договоры'}
        </h1>
        <p className="text-sm text-slate-400">{filteredRentals.length} записей</p>
      </div>

      {/* Фильтры */}
      <div className="no-print">{renderFilters()}</div>

      {/* Список */}
      <div className="space-y-3">
        {filteredRentals.map(rent => (
          <ContractCard key={rent.id} rent={rent} compact={!!selectedRental} />
        ))}
        {filteredRentals.length === 0 && (
          <div className="text-center py-12 text-slate-400 bg-slate-50 rounded-2xl">
            <i className="fas fa-file-contract text-3xl mb-2 opacity-30"></i>
            <p>Нет договоров</p>
            <p className="text-xs mt-1">Измените фильтры или создайте новый</p>
          </div>
        )}
      </div>

      {/* Детальный вид (мобильный) */}
      {selectedRental && <RentalDetail rent={selectedRental} />}

      {/* Модальное продление */}
      {extendingRental && <ExtensionModal />}

      {/* Печать */}
      {printingRental && <PrintTemplate rent={printingRental} />}
    </div>
  );
};

// 🎯 Вспомогательные компоненты

const ActionButton = ({ icon, label, onClick, highlight, danger }: any) => (
  <button
    onClick={onClick}
    className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm font-medium transition-colors ${
      danger ? 'text-rose-600 hover:bg-rose-50' :
      highlight === 'emerald' ? 'text-emerald-600 hover:bg-emerald-50' :
      highlight === 'amber' ? 'text-amber-600 hover:bg-amber-50' :
      highlight === 'blue' ? 'text-blue-600 hover:bg-blue-50' :
      'text-slate-600 hover:bg-slate-50'
    }`}
  >
    <i className={`fas ${icon} w-4 text-center`}></i>
    <span>{label}</span>
  </button>
);

const StatusBadge = ({ rent }: { rent: Rental }) => {
  if (rent.status === 'COMPLETED') return <Badge text="Завершён" color="slate" />;
  if (rent.status === 'CANCELLED') return <Badge text="Отменён" color="rose" />;
  if (rent.paymentStatus === 'DEBT') return <Badge text="Долг" color="rose" />;
  return <Badge text="Активен" color="emerald" />;
};

const PaymentBadge = ({ status }: { status?: 'PAID' | 'DEBT' }) => (
  <span className={`px-2.5 py-1 rounded-lg text-[11px] font-medium ${
    status === 'DEBT' ? 'bg-rose-50 text-rose-600' : 'bg-emerald-50 text-emerald-600'
  }`}>
    {status === 'DEBT' ? 'Долг' : 'Оплачено'}
  </span>
);

const Badge = ({ text, color }: { text: string; color: 'emerald' | 'rose' | 'slate' | 'amber' }) => (
  <span className={`px-2.5 py-1 rounded-lg text-[11px] font-medium ${
    color === 'emerald' ? 'bg-emerald-50 text-emerald-600' :
    color === 'rose' ? 'bg-rose-50 text-rose-600' :
    color === 'amber' ? 'bg-amber-50 text-amber-600' :
    'bg-slate-100 text-slate-600'
  }`}>
    {text}
  </span>
);

const InfoRow = ({ label, value }: { label: string; value?: string }) => (
  <div>
    <div className="text-[11px] text-slate-400 uppercase">{label}</div>
    <div className="font-medium text-slate-900">{value || '—'}</div>
  </div>
);

export default ContractList;