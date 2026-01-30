import React, { useState, useEffect, useMemo, useRef } from 'react';
import { Rental, Car, Client, RentalExtension } from '../types';

interface ContractListProps {
  rentals: Rental[];
  cars: Car[];
  clients: Client[];
  onUpdate: (rental: Rental) => void;
  onDelete: (id: string) => void;
  onIssueFromBooking?: (id: string) => void;
  viewMode?: 'CONTRACTS' | 'BOOKINGS' | 'ARCHIVE';
  brandName?: string;
}

const ContractList: React.FC<ContractListProps> = ({ 
  rentals, 
  cars, 
  clients, 
  onUpdate, 
  onDelete, 
  onIssueFromBooking, 
  viewMode = 'CONTRACTS', 
  brandName 
}) => {
  const [extendingRental, setExtendingRental] = useState<Rental | null>(null);
  const [showActions, setShowActions] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<'PAID' | 'DEBT'>('PAID');
  const [extensionData, setExtensionData] = useState({ endDate: '', endTime: '', extraPrice: 0 });
  const [printingRental, setPrintingRental] = useState<Rental | null>(null);

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
      const dateMatch = !searchDate || rent.startDate === searchDate || rent.endDate === searchDate;
      return nameMatch && dateMatch;
    }).sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [rentals, viewMode, searchName, searchDate, clients]);

  useEffect(() => {
    if (extendingRental && extensionData.endDate && extensionData.endTime) {
      const car = getCar(extendingRental.carId);
      if (!car) return;
      const currentEnd = new Date(`${extendingRental.endDate}T${extendingRental.endTime}`);
      const newEnd = new Date(`${extensionData.endDate}T${extensionData.endTime}`);
      const diffMs = newEnd.getTime() - currentEnd.getTime();
      if (diffMs > 0) {
        const totalHours = diffMs / (1000 * 60 * 60);
        let addedValue = 0;
        if (extendingRental.bookingType === 'DAILY') addedValue = Math.ceil(totalHours / 24) * car.pricePerDay;
        else addedValue = Math.ceil(totalHours) * (car.pricePerHour || Math.round(car.pricePerDay / 24));
        setExtensionData(prev => ({ ...prev, extraPrice: Math.round(addedValue) }));
      } else { setExtensionData(prev => ({ ...prev, extraPrice: 0 })); }
    }
  }, [extensionData.endDate, extensionData.endTime, extendingRental, cars]);

  const handleExtendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendingRental) return;
    const newExtension: RentalExtension = {
      endDate: extensionData.endDate,
      endTime: extensionData.endTime,
      amount: extensionData.extraPrice,
      date: new Date().toISOString()
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
    setTimeout(() => {
      window.print();
      setPrintingRental(null);
    }, 500);
  };

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 0;
          }
          body {
            background: white !important;
            margin: 0 !important;
            padding: 0 !important;
            -webkit-print-color-adjust: exact !important;
            color-adjust: exact !important;
          }
          /* Скрываем ВСЁ, кроме печатной секции */
          * {
            visibility: hidden !important;
          }
          #print-section, #print-section * {
            visibility: visible !important;
          }
          #print-section {
            position: absolute !important;
            left: 0 !important;
            top: 0 !important;
            width: 210mm !important; /* A4 width */
            height: auto !important;
            margin: 0 !important;
            padding: 15mm !important; /* A4 margins */
            font-size: 8.5pt !important;
            line-height: 1.3 !important;
            color: black !important;
            background: white !important;
            z-index: 999999 !important;
            box-sizing: border-box !important;
            page-break-after: avoid !important;
          }
          .h-px {
            height: 1px !important;
            margin: 3pt 0 !important;
            background: black !important;
          }
          .border-b {
            border-bottom: 1pt solid black !important;
          }
        }
      `}</style>

      {/* UI Controls - ONLY VISIBLE ON SCREEN */}
      <div className="px-2 no-print">
        <h2 className="text-3xl font-black text-slate-900">
          {viewMode === 'BOOKINGS' ? 'Бронирования' : (viewMode === 'ARCHIVE' ? 'Архив' : 'Реестр договоров')}
        </h2>
        <p className="text-slate-400 font-bold mt-1 uppercase text-[10px] tracking-widest">
          {viewMode === 'BOOKINGS' ? 'Предварительные заказы' : 'Текущие активные сделки'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-2 no-print">
        <div className="relative">
          <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-300"></i>
          <input 
            value={searchName} 
            onChange={e => setSearchName(e.target.value)} 
            placeholder="Поиск по ФИО..." 
            className="w-full pl-12 pr-6 py-4 bg-white border border-slate-100 rounded-2xl font-bold shadow-sm outline-none" 
          />
        </div>
        <div className="relative">
          <i className="fas fa-calendar absolute left-5 top-1/2 -translate-y-1/2 text-slate-300"></i>
          <input 
            type="date" 
            value={searchDate} 
            onChange={e => setSearchDate(e.target.value)} 
            className="w-full pl-12 pr-6 py-4 bg-white border border-slate-100 rounded-2xl font-bold shadow-sm outline-none" 
          />
        </div>
      </div>

      <div className="grid gap-4 px-2 no-print">
        {filteredRentals.map(rent => {
          const car = getCar(rent.carId);
          const client = getClient(rent.clientId);
          const extensionSum = rent.extensions?.reduce((acc, ext) => acc + (ext.amount || 0), 0) || 0;

          return (
            <div key={rent.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm animate-fadeIn group">
              <div className="flex flex-col md:flex-row items-center justify-between gap-6 mb-4">
                <div className="flex items-center space-x-6 w-full md:w-auto">
                  <div className={`w-14 h-14 rounded-2xl flex items-center justify-center text-xl ${rent.isReservation ? 'bg-amber-50 text-amber-600' : 'bg-blue-50 text-blue-600'}`}>
                    <i className={`fas ${rent.isReservation ? 'fa-calendar-check' : 'fa-file-contract'}`}></i>
                  </div>
                  <div>
                    <div className="text-[10px] font-black uppercase tracking-widest text-slate-400 mb-0.5">
                      {rent.contractNumber} • {rent.bookingType === 'DAILY' ? 'Сутки' : 'Часы'}
                    </div>
                    <h3 className="text-lg font-bold text-slate-900">{client?.name || '---'}</h3>
                    <p className="text-sm text-slate-400 font-medium">{car?.brand} {car?.model} ({car?.plate})</p>
                  </div>
                </div>

                <div className="flex items-center space-x-3 text-sm font-bold bg-slate-50 px-5 py-2.5 rounded-2xl border border-slate-100">
                  <span>{new Date(rent.startDate).toLocaleDateString()}</span>
                  <i className="fas fa-arrow-right text-[10px] text-slate-300"></i>
                  <span>{new Date(rent.endDate).toLocaleDateString()}</span>
                </div>

                <div className="flex items-center space-x-6">
                  <div className="text-right">
                    <div className="text-2xl font-black text-slate-900">{(rent.totalAmount || 0).toLocaleString()} ₽</div>
                    <div className={`text-[9px] font-black uppercase flex items-center justify-end space-x-1 ${rent.paymentStatus === 'DEBT' ? 'text-rose-500' : 'text-emerald-500'}`}>
                      <i className={`fas ${rent.paymentStatus === 'DEBT' ? 'fa-clock' : 'fa-check-circle'}`}></i>
                      <span>{rent.paymentStatus === 'DEBT' ? 'Долг' : 'Оплачено'}</span>
                    </div>
                  </div>

                  <div className="relative">
                    <button 
                      onClick={() => setShowActions(showActions === rent.id ? null : rent.id)} 
                      className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-slate-900 hover:bg-slate-50 rounded-xl transition-all"
                    >
                      <i className="fas fa-ellipsis-v"></i>
                    </button>
                    {showActions === rent.id && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowActions(null)}></div>
                        <div className="absolute right-0 top-12 w-52 bg-white rounded-3xl shadow-2xl border border-slate-50 z-50 overflow-hidden animate-scaleIn">
                          <button 
                            onClick={() => { handlePrint(rent); setShowActions(null); }} 
                            className="w-full px-6 py-4 text-left text-sm font-black hover:bg-slate-50 text-slate-600 flex items-center space-x-3 border-b border-slate-50"
                          >
                            <i className="fas fa-print"></i> <span>Печать договора</span>
                          </button>
                          {rent.isReservation && onIssueFromBooking && (
                            <button 
                              onClick={() => { onIssueFromBooking(rent.id); setShowActions(null); }} 
                              className="w-full px-6 py-4 text-left text-sm font-black hover:bg-emerald-50 text-emerald-600 flex items-center space-x-3 border-b border-slate-50"
                            >
                              <i className="fas fa-key"></i> <span>Выдать авто</span>
                            </button>
                          )}
                          {!rent.isReservation && rent.status === 'ACTIVE' && (
                            <>
                              <button 
                                onClick={() => { 
                                  setExtendingRental(rent); 
                                  setExtensionData({ endDate: rent.endDate, endTime: rent.endTime, extraPrice: 0 }); 
                                  setShowActions(null); 
                                }} 
                                className="w-full px-6 py-4 text-left text-sm font-black hover:bg-emerald-50 text-emerald-600 flex items-center space-x-3 border-b border-slate-50"
                              >
                                <i className="fas fa-calendar-plus"></i> <span>Продлить</span>
                              </button>
                              <button 
                                onClick={() => { onUpdate({...rent, status: 'COMPLETED'}); setShowActions(null); }} 
                                className="w-full px-6 py-4 text-left text-sm font-black hover:bg-blue-50 text-blue-600 flex items-center space-x-3 border-b border-slate-50"
                              >
                                <i className="fas fa-check-circle"></i> <span>Завершить</span>
                              </button>
                            </>
                          )}
                          <button 
                            onClick={() => { if(confirm('Удалить?')) onDelete(rent.id); setShowActions(null); }} 
                            className="w-full px-6 py-4 text-left text-sm font-black hover:bg-rose-50 text-rose-500 flex items-center space-x-3"
                          >
                            <i className="fas fa-trash-alt"></i> <span>Удалить</span>
                          </button>
                        </div>
                      </>
                    )}
                  </div>
                </div>
              </div>

              {/* Хронология продлений */}
              {rent.extensions && rent.extensions.length > 0 && (
                <div className="mt-4 pt-4 border-t border-dashed border-slate-100 space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Хронология продлений:</div>
                    <div className="text-[10px] font-black text-emerald-600 uppercase">Всего доплат: {extensionSum.toLocaleString()} ₽</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {rent.extensions.map((ext, idx) => (
                      <div key={idx} className="bg-emerald-50/50 border border-emerald-100 rounded-xl px-4 py-2 flex items-center gap-3">
                        <div className="text-[10px] font-black text-emerald-700">+{(ext.amount || 0).toLocaleString()} ₽</div>
                        <div className="text-[10px] text-slate-400 font-bold">до {new Date(ext.endDate).toLocaleDateString()} {ext.endTime}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          );
        })}
        {filteredRentals.length === 0 && (
          <div className="p-20 text-center text-slate-400 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100 italic">
            Список пуст
          </div>
        )}
      </div>

      {/* Hidden Print Template */}
      {printingRental && (
        <div id="print-section" className="font-serif">
          <div className="text-center mb-2 print-header">
            <h1 className="text-2xl font-black mb-0.5 uppercase tracking-tight">
              {brandName || 'AutoPro'}
            </h1>
            <div className="h-px bg-black w-full mb-1"></div>
            <p className="text-sm font-bold">Договор № {printingRental.contractNumber} аренды транспортного средства</p>
          </div>

          <p className="mb-1 text-[8pt]">Арендодатель на основании Устава с одной стороны и гражданин:</p>
          <div className="mb-1 flex gap-2 border-b border-black pb-0.5 text-[8.5pt]">
             <span className="font-bold min-w-[35px]">Ф.И.О.:</span>
             <span className="flex-1 italic">{getClient(printingRental.clientId)?.name}</span>
             <span className="font-bold">Тел:</span>
             <span className="italic">{getClient(printingRental.clientId)?.phone}</span>
          </div>

          <div className="mb-2 flex border-b border-black pb-0.5 text-[8.5pt]">
             <span className="font-bold whitespace-nowrap">Место проживания:</span>
             <span className="italic ml-2 flex-1">_____________________________________________________________</span>
          </div>

          <p className="mb-0.5 font-bold text-[8.5pt]">1. ПРЕДМЕТ ДОГОВОРА:</p>
          <p className="mb-1 ml-3 text-[8pt]">1.1 Арендодатель предоставляет Арендатору во временное пользование автомобиль:</p>

          <div className="mb-2 grid grid-cols-3 gap-2 border-b border-black pb-0.5 px-3 text-[8pt]">
             <div><span className="font-bold">Авто:</span> {getCar(printingRental.carId)?.brand} {getCar(printingRental.carId)?.model}</div>
             <div><span className="font-bold">Цвет:</span> ________</div>
             <div><span className="font-bold">Гос. номер:</span> {getCar(printingRental.carId)?.plate}</div>
          </div>

          <p className="mb-0.5 font-bold uppercase text-[8.5pt]">2. Условия проката:</p>
          <ol className="list-decimal ml-6 mb-2 text-[7.5pt] space-y-0.5">
             <li>Автомобиль передается в исправном состоянии, чистым, с 10л бензина АИ-95.</li>
             <li>Арендодатель не несет ответственности за ущерб, причиненный Арендатором третьим лицам.</li>
          </ol>

          <p className="mb-0.5 font-bold uppercase text-[8.5pt]">3. Обязанности Арендатора:</p>
          <ul className="list-disc ml-6 mb-2 text-[7pt] leading-tight grid grid-cols-1 gap-0.5 print-list">
             <li>100% ответственность за сохранность ТС.</li>
             <li>Возврат в чистом виде (мойка) или штраф 1000 р.</li>
             <li>Замена деталей без уведомления — штраф 15 000 р.</li>
             <li>Опоздание более 30 мин — 1000 р./час.</li>
             <li>Передача руля третьим лицам запрещена — штраф до 35 000 р.</li>
             <li>Штрафы ГИБДД оплачиваются Арендатором в 100% объеме.</li>
             <li>При ДТП — полная компенсация ущерба + оплата простоя.</li>
             <li>Курение — 2000 р. Превышение скорости (&gt;150 км/ч) — 2000 р. Пьяное вождение — 50 000 р.</li>
             <li>Отключение видеорегистратора — 5000 р.</li>
             <li>Резкий старт/ручник — по 2500 р.</li>
             <li>Штраф за повреждение каждой кузовной детали — от 30 000 р.</li>
          </ul>

          <p className="mb-0.5 font-bold uppercase text-[8.5pt]">4. Срок действия договора:</p>
          <div className="mb-2 space-y-0.5 text-[8.5pt] px-3">
             <p>с «{new Date(printingRental.startDate).getDate()}» {new Date(printingRental.startDate).toLocaleString('ru-RU', {month: 'long'})} {new Date(printingRental.startDate).getFullYear()} г. {printingRental.startTime}</p>
             <p>до «{new Date(printingRental.endDate).getDate()}» {new Date(printingRental.endDate).toLocaleString('ru-RU', {month: 'long'})} {new Date(printingRental.endDate).getFullYear()} г. {printingRental.endTime}</p>
          </div>

          <div className="grid grid-cols-2 gap-10 mt-2 print-signatures">
             <div className="border-t border-black pt-1">
                <p className="font-bold text-[7.5pt]">АРЕНДОДАТЕЛЬ:</p>
                <div className="flex justify-between items-end mt-1.5">
                   <div className="border-b border-black w-20 h-3"></div>
                   <div className="text-[7pt]">/Б. И. Масхудович/</div>
                </div>
             </div>
             <div className="border-t border-black pt-1">
                <p className="font-bold text-[7.5pt]">АРЕНДАТОР:</p>
                <div className="flex justify-between items-end mt-1.5">
                   <div className="border-b border-black w-20 h-3 text-center text-[6pt]">подпись</div>
                   <div className="text-[7pt] flex-1 text-center border-b border-black">( Фамилия )</div>
                </div>
             </div>
          </div>
        </div>
      )}

      {/* Extension Modal */}
      {extendingRental && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md no-print">
          <form onSubmit={handleExtendSubmit} className="bg-white rounded-[3rem] w-full max-w-lg p-10 shadow-2xl animate-scaleIn">
            <h2 className="text-2xl font-black mb-8 uppercase">Продление сделки</h2>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <input 
                  type="date" 
                  value={extensionData.endDate} 
                  onChange={e => setExtensionData({...extensionData, endDate: e.target.value})} 
                  required 
                  className="p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-emerald-500" 
                />
                <input 
                  type="time" 
                  value={extensionData.endTime} 
                  onChange={e => setExtensionData({...extensionData, endTime: e.target.value})} 
                  required 
                  className="p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-emerald-500" 
                />
              </div>
              <div className="grid grid-cols-2 gap-2 p-1 bg-slate-100 rounded-2xl">
                 <button 
                   type="button" 
                   onClick={() => setPaymentMode('PAID')} 
                   className={`py-3 rounded-xl font-black text-xs uppercase ${paymentMode === 'PAID' ? 'bg-white text-emerald-600 shadow-sm' : 'text-slate-400'}`}
                 >
                   Оплачено
                 </button>
                 <button 
                   type="button" 
                   onClick={() => setPaymentMode('DEBT')} 
                   className={`py-3 rounded-xl font-black text-xs uppercase ${paymentMode === 'DEBT' ? 'bg-white text-rose-600 shadow-sm' : 'text-slate-400'}`}
                 >
                   В долг
                 </button>
              </div>
              <div className="p-6 bg-emerald-50 rounded-3xl border border-emerald-100 flex justify-between items-center">
                 <div>
                   <div className="text-[10px] font-black text-emerald-600 uppercase">Сумма доплаты</div>
                   <div className="text-2xl font-black">+{extensionData.extraPrice.toLocaleString()} ₽</div>
                 </div>
                 <i className="fas fa-plus-circle text-emerald-300 text-2xl"></i>
              </div>
              <button 
                type="submit" 
                className="w-full py-5 bg-emerald-600 text-white rounded-3xl font-black uppercase shadow-xl"
              >
                Сохранить
              </button>
              <button 
                type="button" 
                onClick={() => setExtendingRental(null)} 
                className="w-full text-slate-400 font-bold uppercase text-xs"
              >
                Отмена
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ContractList;