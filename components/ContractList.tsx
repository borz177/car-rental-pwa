
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

  // Logic for calculating extension price
  useEffect(() => {
    if (extendingRental && extensionData.endDate && extensionData.endTime) {
      const car = getCar(extendingRental.carId);
      if (!car) return;

      // CRITICAL FIX: Ensure dates are clean YYYY-MM-DD strings before creating Date objects
      // extendingRental.endDate might be "2023-10-10T00:00:00.000Z"
      const currentEndDateStr = extendingRental.endDate.split('T')[0];
      const newEndDateStr = extensionData.endDate.split('T')[0];

      const currentEnd = new Date(`${currentEndDateStr}T${extendingRental.endTime}`);
      const newEnd = new Date(`${newEndDateStr}T${extensionData.endTime}`);

      const diffMs = newEnd.getTime() - currentEnd.getTime();

      if (diffMs > 0) {
        const totalHours = diffMs / (1000 * 60 * 60);
        let addedValue = 0;

        // Add minimal hour logic (e.g. if > 1 hour, charge full)
        if (extendingRental.bookingType === 'DAILY') {
          // For daily, we usually calculate by 24h blocks
          const days = Math.ceil(totalHours / 24);
          addedValue = days * car.pricePerDay;
        } else {
          // For hourly
          addedValue = Math.ceil(totalHours) * (car.pricePerHour || Math.round(car.pricePerDay / 24));
        }
        setExtensionData(prev => ({ ...prev, extraPrice: Math.max(0, Math.round(addedValue)) }));
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
      amount: Number(extensionData.extraPrice),
      date: new Date().toISOString(),
      paymentStatus: paymentMode
    };
    const updated: Rental = {
      ...extendingRental,
      endDate: extensionData.endDate,
      endTime: extensionData.endTime,
      totalAmount: Number(extendingRental.totalAmount || 0) + Number(extensionData.extraPrice),
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

  const openExtensionModal = (rent: Rental) => {
    setExtendingRental(rent);
    // Explicitly clean the date format to ensure input[type="date"] accepts it
    const cleanDate = rent.endDate ? rent.endDate.split('T')[0] : '';
    setExtensionData({ endDate: cleanDate, endTime: rent.endTime, extraPrice: 0 });
    setShowActions(null);
  };

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      {/* Print Styles */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 10mm;
          }
          body * {
            visibility: hidden;
          }
          #print-section, #print-section * {
            visibility: visible;
          }
          #print-section {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            font-family: "Times New Roman", Times, serif;
            font-size: 10pt; /* Smaller font for single page */
            line-height: 1.2; /* Tighter lines */
            color: black;
            background: white;
            padding: 0 10mm;
          }
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

          // Безопасный расчет суммы продлений
          const extensionSum = (rent.extensions || []).reduce((acc, ext) => acc + Number(ext.amount || 0), 0);

          // Для бронирований
          const prepayment = Number(rent.prepayment || 0);
          const totalAmount = Number(rent.totalAmount || 0);
          const remaining = Math.max(0, totalAmount - prepayment);

          return (
            <div key={rent.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm animate-fadeIn group relative">
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

                <div className="flex items-center space-x-6 w-full md:w-auto justify-between md:justify-end">
                  <div className="text-right">
                    <div className="text-2xl font-black text-slate-900">{totalAmount.toLocaleString()} ₽</div>

                    {rent.isReservation ? (
                      <div className="flex flex-col items-end">
                        <div className="text-[10px] font-bold uppercase text-amber-600 bg-amber-50 px-2 py-0.5 rounded-md mb-1">
                          Предоплата: {prepayment.toLocaleString()} ₽
                        </div>
                        {remaining > 0 && (
                          <div className="text-[9px] font-black uppercase text-slate-400">
                            Остаток: {remaining.toLocaleString()} ₽
                          </div>
                        )}
                      </div>
                    ) : (
                      <div className="flex flex-col items-end">
                        <div className={`text-[9px] font-black uppercase flex items-center space-x-1 ${rent.paymentStatus === 'DEBT' ? 'text-rose-500' : 'text-emerald-500'}`}>
                          <i className={`fas ${rent.paymentStatus === 'DEBT' ? 'fa-clock' : 'fa-check-circle'}`}></i>
                          <span>{rent.paymentStatus === 'DEBT' ? 'Долг' : 'Оплачено'}</span>
                        </div>
                        {extensionSum > 0 && (
                          <div className="text-[8px] font-bold text-blue-500 uppercase mt-0.5">
                            В т.ч. продления: {extensionSum.toLocaleString()} ₽
                          </div>
                        )}
                      </div>
                    )}
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
                                onClick={() => openExtensionModal(rent)}
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

              {/* Added Issue Button for Reservations */}
              {rent.isReservation && onIssueFromBooking && (
                  <button
                      onClick={() => onIssueFromBooking(rent.id)}
                      className="w-full mt-2 py-2 px-3 bg-emerald-500 text-white rounded-lg font-medium text-xs uppercase hover:bg-emerald-600 shadow-sm transition-colors flex items-center justify-center gap-1.5"
                  >
                    <i className="fas fa-key text-[12px]"></i>
                    <span>Оформить выдачу</span>
                  </button>
              )}

              {/* Хронология продлений */}
              {rent.extensions && rent.extensions.length > 0 && (
                  <div className="mt-4 pt-4 border-t border-dashed border-slate-100 space-y-3">
                    <div className="flex justify-between items-center">
                      <div className="text-[8px] font-black text-slate-400 uppercase tracking-widest">Хронология продлений:</div>
                    <div className="text-[10px] font-black text-emerald-600 uppercase">Всего доплат: {extensionSum.toLocaleString()} ₽</div>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {rent.extensions.map((ext, idx) => (
                      <div key={idx} className={`${ext.paymentStatus === 'DEBT' ? 'bg-rose-50 border-rose-100' : 'bg-emerald-50/50 border-emerald-100'} border rounded-xl px-4 py-2 flex items-center gap-3`}>
                        <div className={`text-[10px] font-black ${ext.paymentStatus === 'DEBT' ? 'text-rose-700' : 'text-emerald-700'}`}>+{(ext.amount || 0).toLocaleString()} ₽</div>
                        <div className="text-[10px] text-slate-400 font-bold">до {new Date(ext.endDate).toLocaleDateString()} {ext.endTime}</div>
                        {ext.paymentStatus === 'DEBT' && <i className="fas fa-clock text-rose-500 text-[9px]"></i>}
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

      {/* Extension Modal */}
      {extendingRental && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md no-print">
          <form onSubmit={handleExtendSubmit} className="bg-white rounded-[3rem] w-full max-w-lg p-10 shadow-2xl animate-scaleIn">
            <h2 className="text-2xl font-black mb-8 uppercase">Продление сделки</h2>
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Новая дата</label>
                  <input
                    type="date"
                    value={extensionData.endDate}
                    onChange={e => setExtensionData({...extensionData, endDate: e.target.value})}
                    required
                    className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-emerald-500"
                  />
                </div>
                <div>
                  <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Новое время</label>
                  <input
                    type="time"
                    value={extensionData.endTime}
                    onChange={e => setExtensionData({...extensionData, endTime: e.target.value})}
                    required
                    className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-emerald-500"
                  />
                </div>
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
                   <div className="text-2xl font-black">+{Number(extensionData.extraPrice).toLocaleString()} ₽</div>
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
