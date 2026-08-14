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

  const [searchName, setSearchName] = useState('');
  const [searchDate, setSearchDate] = useState('');

  const getCar = (id: string) => cars.find(c => c.id === id);
  const getClient = (id: string) => clients.find(c => c.id === id);

  const filteredRentals = useMemo(() => {
    return rentals.filter(rent => {
      let isCorrectType = false;
      if (viewMode === 'BOOKINGS') isCorrectType = rent.isReservation && rent.status === 'ACTIVE';
      else if (viewMode === 'ARCHIVE') isCorrectType = rent.status === 'COMPLETED' || rent.status === 'CANCELLED';
      else isCorrectType = !rent.isReservation && rent.status === 'ACTIVE';

      if (!isCorrectType) return false;

      const client = getClient(rent.clientId);
      const nameMatch = client?.name.toLowerCase().includes(searchName.toLowerCase());
      const dateMatch = !searchDate || rent.startDate.startsWith(searchDate) || rent.endDate.startsWith(searchDate);
      return nameMatch && dateMatch;
    }).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [rentals, viewMode, searchName, searchDate, clients]);

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

  const handleExtendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendingRental) return;
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

  const formatMoney = (n: number) => n.toLocaleString('ru-RU') + ' ₽';
  const formatDate = (d: string) => new Date(d).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' });

  // 🎯 Компактная карточка (мобильная)
  const ContractCard = ({ rent }: { rent: Rental }) => {
    const car = getCar(rent.carId);
    const client = getClient(rent.clientId);
    const extensionSum = (rent.extensions || []).reduce((s, e) => s + (e.amount || 0), 0);

    return (
      <div
        className="bg-white rounded-2xl border border-slate-100 p-4 transition-all hover:shadow-md active:scale-[0.99]"
        onClick={() => setSelectedRental(rent)}
      >
        {/* Шапка карточки */}
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
          <button
            onClick={(e) => { e.stopPropagation(); setShowActions(showActions === rent.id ? null : rent.id); }}
            className="w-9 h-9 flex items-center justify-center rounded-xl hover:bg-slate-100 text-slate-400"
          >
            <i className="fas fa-ellipsis-vertical"></i>
          </button>
        </div>

        {/* Даты и статус */}
        <div className="flex items-center justify-between text-sm mb-3">
          <div className="flex items-center gap-1.5 text-slate-600">
            <span>{formatDate(rent.startDate)}</span>
            <i className="fas fa-arrow-right text-[10px] text-slate-300"></i>
            <span>{formatDate(rent.endDate)}</span>
          </div>
          <span className={`px-2.5 py-1 rounded-lg text-[11px] font-medium ${
            rent.status === 'COMPLETED' ? 'bg-slate-100 text-slate-600' :
            rent.paymentStatus === 'DEBT' ? 'bg-rose-50 text-rose-600' :
            'bg-emerald-50 text-emerald-600'
          }`}>
            {rent.status === 'COMPLETED' ? 'Завершён' : rent.paymentStatus === 'DEBT' ? 'Долг' : 'Оплачено'}
          </span>
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
            </div>
          ) : null}
        </div>

        {/* Меню действий (bottom sheet на мобильных) */}
        {showActions === rent.id && (
          <>
            <div className="fixed inset-0 z-40 md:absolute md:inset-auto" onClick={() => setShowActions(null)} />
            <div className="fixed bottom-0 left-0 right-0 md:absolute md:bottom-auto md:left-auto md:right-0 md:top-full md:w-56 bg-white rounded-t-xl md:rounded-2xl shadow-md border border-slate-100 z-50 overflow-hidden animate-slideUp">
              <div className="md:hidden p-4 border-b border-slate-100 flex items-center justify-between">
                <span className="font-semibold">Действия</span>
                <button onClick={() => setShowActions(null)} className="p-2 text-slate-400"><i className="fas fa-xmark"></i></button>
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
                    <button onClick={() => { setExtendingRental(rent); setShowActions(null); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm text-amber-600 hover:bg-amber-50">
                      <i className="fas fa-calendar-plus w-4"></i> Продлить
                    </button>
                    <button onClick={() => { onComplete(rent); setShowActions(null); }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm text-blue-600 hover:bg-blue-50">
                      <i className="fas fa-check-circle w-4"></i> Завершить
                    </button>
                  </>
                )}
                <button onClick={() => { if(confirm('Удалить?')) { onDelete(rent.id); setShowActions(null); } }} className="w-full flex items-center gap-3 px-4 py-3 rounded-xl text-left text-sm text-rose-600 hover:bg-rose-50">
                  <i className="fas fa-trash w-4"></i> Удалить
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    );
  };

  // 🎯 Детальный вид (мобильный)
  const RentalDetail = ({ rent }: { rent: Rental }) => {
    const car = getCar(rent.carId);
    const client = getClient(rent.clientId);

    return (
      <div className="fixed inset-0 z-50 bg-white overflow-y-auto animate-slideUp">
        <div className="sticky top-0 bg-white/80 backdrop-blur-sm border-b border-slate-100 px-4 py-3 flex items-center justify-between">
          <button onClick={() => setSelectedRental(null)} className="p-2 -ml-2 text-slate-400"><i className="fas fa-arrow-left"></i></button>
          <h2 className="font-semibold">{rent.contractNumber}</h2>
          <button onClick={() => handlePrint(rent)} className="p-2 text-slate-400"><i className="fas fa-print"></i></button>
        </div>
        <div className="p-4 space-y-4">
          <div className="bg-slate-50 rounded-2xl p-4">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-xl bg-blue-100 flex items-center justify-center text-blue-600"><i className="fas fa-user"></i></div>
              <div>
                <div className="font-semibold">{client?.name}</div>
                <div className="text-sm text-slate-500">{client?.phone}</div>
              </div>
            </div>
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><div className="text-[11px] text-slate-400 uppercase">Авто</div><div className="font-medium">{car?.brand} {car?.model}</div></div>
              <div><div className="text-[11px] text-slate-400 uppercase">Номер</div><div className="font-medium">{car?.plate}</div></div>
              <div><div className="text-[11px] text-slate-400 uppercase">Начало</div><div className="font-medium">{formatDate(rent.startDate)} {rent.startTime}</div></div>
              <div><div className="text-[11px] text-slate-400 uppercase">Окончание</div><div className="font-medium">{formatDate(rent.endDate)} {rent.endTime}</div></div>
            </div>
          </div>
          <div className="bg-white border border-slate-100 rounded-2xl p-4">
            <h4 className="font-semibold mb-3">Оплата</h4>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between"><span className="text-slate-500">Сумма</span><span className="font-semibold">{formatMoney(rent.totalAmount || 0)}</span></div>
              {rent.prepayment && rent.prepayment > 0 && (
                <div className="flex justify-between"><span className="text-slate-500">Предоплата</span><span className="text-amber-600">-{formatMoney(rent.prepayment)}</span></div>
              )}
              <div className="flex justify-between pt-2 border-t border-slate-100">
                <span className="font-medium">К оплате</span>
                <span className="font-bold">{formatMoney(Math.max(0, (rent.totalAmount||0) - (rent.prepayment||0)))}</span>
              </div>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            {!rent.isReservation && rent.status === 'ACTIVE' && (
              <>
                <button onClick={() => setExtendingRental(rent)} className="py-3 bg-amber-100 text-amber-700 rounded-xl font-medium"><i className="fas fa-calendar-plus mr-1"></i> Продлить</button>
                <button onClick={() => onComplete(rent)} className="py-3 bg-blue-100 text-blue-700 rounded-xl font-medium"><i className="fas fa-check-circle mr-1"></i> Завершить</button>
              </>
            )}
            <button onClick={() => handlePrint(rent)} className="py-3 bg-slate-100 text-slate-700 rounded-xl font-medium col-span-2"><i className="fas fa-print mr-1"></i> Печать</button>
          </div>
        </div>
      </div>
    );
  };

  // 🎯 Модальное окно продления
  const ExtensionModal = () => {
    if (!extendingRental) return null;
    return (
      <div className="fixed inset-0 z-50 bg-slate-900/50 backdrop-blur-sm flex items-end md:items-center justify-center p-0 md:p-4">
        <form onSubmit={handleExtendSubmit} className="bg-white w-full md:max-w-md md:rounded-xl rounded-t-xl max-h-[90vh] overflow-y-auto animate-slideUp">
          <div className="sticky top-0 bg-white px-4 py-3 border-b border-slate-100 flex items-center justify-between">
            <h3 className="font-semibold">Продление аренды</h3>
            <button type="button" onClick={() => setExtendingRental(null)} className="p-2 text-slate-400"><i className="fas fa-xmark"></i></button>
          </div>
          <div className="p-4 space-y-4">
            <div className="bg-slate-50 rounded-xl p-3 text-sm">
              <div className="font-medium">{getCar(extendingRental.carId)?.brand} {getCar(extendingRental.carId)?.model}</div>
              <div className="text-slate-500">до {formatDate(extendingRental.endDate)} {extendingRental.endTime}</div>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-slate-400 uppercase mb-1 block">Новая дата</label>
                <input type="date" value={extensionData.endDate} onChange={e => setExtensionData(d => ({ ...d, endDate: e.target.value }))} required min={extendingRental.endDate.split('T')[0]} className="w-full px-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm" />
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
            <div className="bg-emerald-50 rounded-xl p-4 flex items-center justify-between">
              <div><div className="text-[11px] text-emerald-600 font-medium uppercase">Доплата</div><div className="text-xl font-bold text-emerald-700">+{formatMoney(extensionData.extraPrice)}</div></div>
              <i className="fas fa-calculator text-emerald-300 text-xl"></i>
            </div>
          </div>
          <div className="sticky bottom-0 bg-white px-4 py-3 border-t border-slate-100 flex gap-2">
            <button type="button" onClick={() => setExtendingRental(null)} className="flex-1 py-3 text-slate-500 font-medium">Отмена</button>
            <button type="submit" className="flex-1 py-3 bg-emerald-600 text-white rounded-xl font-semibold">Сохранить</button>
          </div>
        </form>
      </div>
    );
  };

  return (
    <div className="max-w-4xl mx-auto py-4 px-4">
      {/* Стили для печати и анимаций */}
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
        @keyframes scaleIn { from { opacity: 0; transform: scale(0.95); } to { opacity: 1; transform: scale(1); } }
        .animate-slideUp { animation: slideUp 0.3s ease-out; }
        .animate-scaleIn { animation: scaleIn 0.2s ease-out; }
        .scrollbar-hide::-webkit-scrollbar { display: none; }
        .scrollbar-hide { -ms-overflow-style: none; scrollbar-width: none; }
      `}</style>

      {/* Заголовок и фильтры */}
      <div className="px-2 no-print mb-4">
        <h2 className="text-xl font-bold text-slate-900">
          {viewMode === 'BOOKINGS' ? 'Бронирования' : (viewMode === 'ARCHIVE' ? 'Архив' : 'Договоры')}
        </h2>
        <p className="text-sm text-slate-400">{filteredRentals.length} записей</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 px-2 no-print mb-4">
        <div className="relative">
          <i className="fas fa-search absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-sm"></i>
          <input
            value={searchName}
            onChange={e => setSearchName(e.target.value)}
            placeholder="Поиск по ФИО..."
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-300"
            style={{ minHeight: '44px' }}
          />
        </div>
        <div className="relative">
          <i className="fas fa-calendar absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-sm"></i>
          <input
            type="date"
            value={searchDate}
            onChange={e => setSearchDate(e.target.value)}
            className="w-full pl-9 pr-3 py-2.5 bg-white border border-slate-200 rounded-xl text-sm outline-none focus:border-slate-300"
            style={{ minHeight: '44px' }}
          />
        </div>
      </div>

      {/* Список договоров */}
      <div className="grid gap-3 px-2 no-print">
        {filteredRentals.map(rent => (
          <ContractCard key={rent.id} rent={rent} />
        ))}
        {filteredRentals.length === 0 && (
          <div className="p-8 text-center text-slate-400 bg-slate-50 rounded-2xl">
            <i className="fas fa-file-contract text-3xl mb-2 opacity-30"></i>
            <p>Нет договоров</p>
          </div>
        )}
      </div>

      {/* Детальный вид (мобильный) */}
      {selectedRental && <RentalDetail rent={selectedRental} />}

      {/* Модальное продление */}
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