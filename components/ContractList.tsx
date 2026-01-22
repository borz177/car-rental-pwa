
import React, { useState, useEffect, useMemo } from 'react';
import { Rental, Car, Client } from '../types.ts';

interface ContractListProps {
  rentals: Rental[];
  cars: Car[];
  clients: Client[];
  onUpdate: (rental: Rental) => void;
  onDelete: (id: string) => void;
  isArchive?: boolean;
}

const ContractList: React.FC<ContractListProps> = ({ rentals, cars, clients, onUpdate, onDelete, isArchive = false }) => {
  const [editingRental, setEditingRental] = useState<Rental | null>(null);
  const [extendingRental, setExtendingRental] = useState<Rental | null>(null);
  const [showActions, setShowActions] = useState<string | null>(null);
  const [paymentMode, setPaymentMode] = useState<'PAID' | 'DEBT'>('PAID');
  const [extensionData, setExtensionData] = useState({ endDate: '', endTime: '', extraPrice: 0 });
  
  // Фильтры
  const [searchName, setSearchName] = useState('');
  const [searchDate, setSearchDate] = useState('');

  const getCar = (id: string) => cars.find(c => c.id === id);
  const getClient = (id: string) => clients.find(c => c.id === id);

  // Фильтрация данных
  const filteredRentals = useMemo(() => {
    return rentals
      .filter(rent => {
        const isCorrectStatus = isArchive 
          ? (rent.status === 'COMPLETED' || rent.status === 'CANCELLED')
          : rent.status === 'ACTIVE';
        
        if (!isCorrectStatus) return false;

        const client = getClient(rent.clientId);
        const nameMatch = client?.name.toLowerCase().includes(searchName.toLowerCase());
        const dateMatch = !searchDate || rent.startDate === searchDate || rent.endDate === searchDate;

        return nameMatch && dateMatch;
      })
      .sort((a, b) => new Date(b.startDate).getTime() - new Date(a.startDate).getTime());
  }, [rentals, isArchive, searchName, searchDate, clients]);

  useEffect(() => {
    if (extendingRental && extensionData.endDate && extensionData.endTime) {
      const car = getCar(extendingRental.carId);
      if (!car) return;

      const currentEnd = new Date(`${extendingRental.endDate}T${extendingRental.endTime}`);
      const newEnd = new Date(`${extensionData.endDate}T${extensionData.endTime}`);
      
      const diffMs = newEnd.getTime() - currentEnd.getTime();
      if (diffMs > 0) {
        const totalHours = diffMs / (1000 * 60 * 60);
        const days = Math.floor(totalHours / 24);
        const remainingHours = Math.ceil(totalHours % 24);
        const hourPrice = car.pricePerHour || Math.round(car.pricePerDay / 24);
        const addedValue = (days * car.pricePerDay) + (remainingHours * hourPrice);
        setExtensionData(prev => ({ ...prev, extraPrice: Math.round(addedValue) }));
      } else {
        setExtensionData(prev => ({ ...prev, extraPrice: 0 }));
      }
    }
  }, [extensionData.endDate, extensionData.endTime, extendingRental]);

  const handleExtendSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!extendingRental) return;

    const updated: Rental = {
      ...extendingRental,
      endDate: extensionData.endDate,
      endTime: extensionData.endTime,
      totalAmount: extendingRental.totalAmount + extensionData.extraPrice,
      paymentStatus: paymentMode
    };

    onUpdate(updated);
    setExtendingRental(null);
  };

  const handleStatusChange = (rent: Rental, newStatus: 'ACTIVE' | 'COMPLETED' | 'CANCELLED') => {
    onUpdate({ ...rent, status: newStatus });
    setShowActions(null);
  };

  return (
    <div className="space-y-6 pb-24 md:pb-0">
      <div className="px-2">
        <h2 className="text-3xl font-black text-slate-900">{isArchive ? 'Архив договоров' : 'Реестр договоров'}</h2>
        <p className="text-slate-400 font-bold mt-1 uppercase text-[10px] tracking-widest">
          {isArchive ? 'Завершенные и отмененные сделки' : 'Текущие активные аренды'}
        </p>
      </div>

      {/* Панель фильтров */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 px-2">
        <div className="relative group">
          <i className="fas fa-search absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors"></i>
          <input 
            value={searchName}
            onChange={e => setSearchName(e.target.value)}
            placeholder="Поиск по ФИО клиента..." 
            className="w-full pl-12 pr-6 py-4 bg-white border border-slate-100 rounded-2xl font-bold shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
        </div>
        <div className="relative group">
          <i className="fas fa-calendar absolute left-5 top-1/2 -translate-y-1/2 text-slate-300 group-focus-within:text-blue-500 transition-colors"></i>
          <input 
            type="date"
            value={searchDate}
            onChange={e => setSearchDate(e.target.value)}
            className="w-full pl-12 pr-6 py-4 bg-white border border-slate-100 rounded-2xl font-bold shadow-sm focus:ring-2 focus:ring-blue-500 outline-none transition-all"
          />
          {searchDate && (
            <button onClick={() => setSearchDate('')} className="absolute right-4 top-1/2 -translate-y-1/2 text-slate-300 hover:text-rose-500">
              <i className="fas fa-times-circle"></i>
            </button>
          )}
        </div>
      </div>
      
      <div className="grid gap-4 px-2">
        {filteredRentals.map(rent => {
          const car = getCar(rent.carId);
          const client = getClient(rent.clientId);
          return (
            <div key={rent.id} className="bg-white p-6 md:p-8 rounded-[2rem] border border-slate-100 flex flex-col md:flex-row items-center justify-between gap-6 hover:shadow-md transition-all relative group animate-fadeIn">
              <div className="flex items-center space-x-6 w-full md:w-auto">
                <div className={`w-16 h-16 rounded-2xl flex items-center justify-center text-2xl shadow-inner ${isArchive ? 'bg-slate-50 text-slate-400' : 'bg-blue-50 text-blue-600'}`}>
                  <i className={`fas ${rent.status === 'COMPLETED' ? 'fa-check-double' : (rent.status === 'CANCELLED' ? 'fa-times-circle' : 'fa-file-contract')}`}></i>
                </div>
                <div className="overflow-hidden">
                  <div className="flex items-center space-x-2 mb-1">
                    <div className="text-[10px] font-black text-blue-600 uppercase tracking-widest truncate">{rent.contractNumber}</div>
                    <span className={`text-[8px] font-black px-2 py-0.5 rounded-full uppercase ${rent.status === 'ACTIVE' ? 'bg-emerald-100 text-emerald-600' : 'bg-slate-100 text-slate-500'}`}>
                      {rent.status === 'ACTIVE' ? 'Активен' : (rent.status === 'COMPLETED' ? 'Завершен' : 'Отменен')}
                    </span>
                  </div>
                  <h3 className="text-lg font-bold text-slate-900 truncate">{client?.name || 'Клиент удален'}</h3>
                  <p className="text-sm text-slate-400 font-medium truncate">{car?.brand} {car?.model} • {car?.plate}</p>
                </div>
              </div>

              <div className="flex-1 flex flex-col items-center md:items-start space-y-1">
                <div className="text-[10px] text-slate-400 uppercase font-black tracking-widest">Период аренды</div>
                <div className="text-sm font-bold text-slate-700 bg-slate-50 px-4 py-2 rounded-xl border border-slate-100 flex items-center space-x-2">
                  <span>{new Date(rent.startDate).toLocaleDateString()}</span>
                  <i className="fas fa-arrow-right text-[10px] text-slate-300"></i>
                  <span>{new Date(rent.endDate).toLocaleDateString()}</span>
                </div>
              </div>

              <div className="flex items-center space-x-6 w-full md:w-auto justify-between md:justify-end">
                <div className="text-right">
                  <div className="text-2xl font-black text-slate-900">{rent.totalAmount.toLocaleString()} ₽</div>
                  <div className={`text-[10px] font-black uppercase flex items-center justify-end space-x-1 ${rent.paymentStatus === 'DEBT' ? 'text-amber-500' : 'text-emerald-500'}`}>
                    <i className={`fas ${rent.paymentStatus === 'DEBT' ? 'fa-clock' : 'fa-check-circle'}`}></i>
                    <span>{rent.paymentStatus === 'DEBT' ? 'В долг' : 'Оплачено'}</span>
                  </div>
                </div>

                <div className="relative">
                  <button 
                    onClick={() => setShowActions(showActions === rent.id ? null : rent.id)}
                    className="w-12 h-12 flex items-center justify-center text-slate-300 hover:text-slate-900 hover:bg-slate-50 rounded-2xl transition-all"
                  >
                    <i className="fas fa-ellipsis-v"></i>
                  </button>
                  
                  {showActions === rent.id && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowActions(null)}></div>
                      <div className="absolute right-0 top-14 w-52 bg-white rounded-3xl shadow-2xl border border-slate-50 z-50 overflow-hidden animate-scaleIn">
                        {!isArchive && (
                          <>
                            <button onClick={() => { 
                              setExtendingRental(rent); 
                              setExtensionData({ endDate: rent.endDate, endTime: rent.endTime, extraPrice: 0 });
                              setPaymentMode('PAID');
                              setShowActions(null); 
                            }} className="w-full px-6 py-4 text-left text-sm font-black hover:bg-emerald-50 flex items-center space-x-3 text-emerald-600 border-b border-slate-50">
                              <i className="fas fa-calendar-plus"></i> <span>Продлить</span>
                            </button>
                            <button onClick={() => handleStatusChange(rent, 'COMPLETED')} className="w-full px-6 py-4 text-left text-sm font-black hover:bg-blue-50 flex items-center space-x-3 text-blue-600 border-b border-slate-50">
                              <i className="fas fa-check-circle"></i> <span>Завершить</span>
                            </button>
                          </>
                        )}
                        {isArchive && (
                          <button onClick={() => handleStatusChange(rent, 'ACTIVE')} className="w-full px-6 py-4 text-left text-sm font-black hover:bg-emerald-50 flex items-center space-x-3 text-emerald-600 border-b border-slate-50">
                            <i className="fas fa-undo"></i> <span>Вернуть в реестр</span>
                          </button>
                        )}
                        <button onClick={() => { if(window.confirm('Удалить договор навсегда?')) onDelete(rent.id); setShowActions(null); }} className="w-full px-6 py-4 text-left text-sm font-black hover:bg-rose-50 text-rose-500 flex items-center space-x-3">
                          <i className="fas fa-trash-alt"></i> <span>Удалить</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            </div>
          );
        })}
        {filteredRentals.length === 0 && (
          <div className="p-20 text-center text-slate-400 bg-white rounded-[2rem] border-2 border-dashed border-slate-100 italic font-medium">
            {isArchive ? 'Архив пуст' : 'Активных договоров не найдено'}
          </div>
        )}
      </div>

      {/* Модалка продления */}
      {extendingRental && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <form onSubmit={handleExtendSubmit} className="bg-white rounded-[3rem] w-full max-w-lg p-8 md:p-12 shadow-2xl animate-scaleIn">
            <div className="flex justify-between items-start mb-6">
              <div>
                <h2 className="text-3xl font-black text-slate-900">Продление</h2>
                <p className="text-xs font-black text-emerald-600 uppercase tracking-widest mt-1">{extendingRental.contractNumber}</p>
              </div>
              <button type="button" onClick={() => setExtendingRental(null)} className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-slate-900 bg-slate-50 rounded-full">
                <i className="fas fa-times"></i>
              </button>
            </div>
            
            <div className="space-y-6">
              <div className="grid grid-cols-2 gap-4">
                <div className="col-span-2 text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Новая дата и время возврата</div>
                <input 
                  type="date" 
                  value={extensionData.endDate} 
                  onChange={e => setExtensionData({...extensionData, endDate: e.target.value})}
                  required className="p-5 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-emerald-500" 
                />
                <input 
                  type="time" 
                  value={extensionData.endTime} 
                  onChange={e => setExtensionData({...extensionData, endTime: e.target.value})}
                  required className="p-5 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-emerald-500" 
                />
              </div>

              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2">Оплата продления</label>
                <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-2xl">
                  <button 
                    type="button"
                    onClick={() => setPaymentMode('PAID')}
                    className={`py-3.5 rounded-xl font-black text-xs uppercase transition-all flex items-center justify-center space-x-2 ${paymentMode === 'PAID' ? 'bg-white text-emerald-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <i className="fas fa-money-bill-wave"></i>
                    <span>Оплачено</span>
                  </button>
                  <button 
                    type="button"
                    onClick={() => setPaymentMode('DEBT')}
                    className={`py-3.5 rounded-xl font-black text-xs uppercase transition-all flex items-center justify-center space-x-2 ${paymentMode === 'DEBT' ? 'bg-white text-amber-600 shadow-md' : 'text-slate-400 hover:text-slate-600'}`}
                  >
                    <i className="fas fa-clock"></i>
                    <span>В долг</span>
                  </button>
                </div>
              </div>

              <div className="p-8 bg-emerald-50 rounded-[2.5rem] border-2 border-emerald-100 relative overflow-hidden">
                <div className="relative z-10">
                  <div className="flex justify-between items-center mb-4">
                    <span className="text-xs font-black text-emerald-700 uppercase tracking-widest">Доплата за период</span>
                    <span className="text-3xl font-black text-emerald-600">+{extensionData.extraPrice.toLocaleString()} ₽</span>
                  </div>
                  <div className="flex justify-between items-center pt-4 border-t border-emerald-100">
                    <span className="text-xs font-black text-slate-500 uppercase tracking-widest">Новый итог</span>
                    <span className="text-xl font-black text-slate-900">{(extendingRental.totalAmount + extensionData.extraPrice).toLocaleString()} ₽</span>
                  </div>
                </div>
                <i className="fas fa-clock absolute -right-4 -bottom-4 text-6xl text-emerald-200/40 rotate-12"></i>
              </div>
            </div>

            <div className="grid grid-cols-1 gap-4 mt-10">
              <button type="submit" className={`w-full py-5 text-white rounded-3xl font-black text-lg shadow-xl transition-all active:scale-[0.98] ${paymentMode === 'PAID' ? 'bg-emerald-600 shadow-emerald-500/30' : 'bg-amber-500 shadow-amber-500/30'}`}>
                {paymentMode === 'PAID' ? 'Оплатить и продлить' : 'Продлить в долг'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default ContractList;
