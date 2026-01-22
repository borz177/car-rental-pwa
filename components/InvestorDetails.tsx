
import React, { useState, useMemo } from 'react';
import { Investor, Car, Rental, Transaction, TransactionType } from '../backend/src/types.ts';

interface InvestorDetailsProps {
  investor: Investor;
  cars: Car[];
  rentals: Rental[];
  transactions: Transaction[];
  onBack: () => void;
}

const InvestorDetails: React.FC<InvestorDetailsProps> = ({ investor, cars, rentals, transactions, onBack }) => {
  const [dateRange, setDateRange] = useState({ start: '', end: '' });
  const [activeTab, setActiveTab] = useState<'INFO' | 'HISTORY'>('INFO');
  
  const investorCars = cars.filter(c => c.investorId === investor.id);
  const investorTransactions = transactions.filter(t => t.investorId === investor.id);

  // Фильтрация аренд по периоду
  const filteredRentals = useMemo(() => {
    return rentals.filter(rent => {
      const isInvestorCar = investorCars.some(c => c.id === rent.carId);
      if (!isInvestorCar || rent.paymentStatus !== 'PAID') return false;
      
      const rentDate = new Date(rent.startDate);
      const start = dateRange.start ? new Date(dateRange.start) : null;
      const end = dateRange.end ? new Date(dateRange.end) : null;
      
      if (start && rentDate < start) return false;
      if (end && rentDate > end) return false;
      
      return true;
    });
  }, [rentals, investorCars, dateRange]);

  const calculatePeriodEarnings = () => {
    return filteredRentals.reduce((acc, rent) => {
      const car = investorCars.find(c => c.id === rent.carId);
      if (car) {
        return acc + (rent.totalAmount * (car.investorShare || 0) / 100);
      }
      return acc;
    }, 0);
  };

  const periodEarnings = calculatePeriodEarnings();
  const totalPayouts = investorTransactions
    .filter(t => t.type === TransactionType.EXPENSE)
    .reduce((a, b) => a + b.amount, 0);

  return (
    <div className="space-y-8 animate-fadeIn pb-24 md:pb-0">
      <button onClick={onBack} className="flex items-center space-x-2 text-slate-500 font-bold hover:text-blue-600 transition-all">
        <i className="fas fa-arrow-left"></i> <span>Назад к списку</span>
      </button>

      <div className="bg-white rounded-[3rem] shadow-xl overflow-hidden border border-slate-100">
        <div className="p-8 md:p-12 bg-indigo-900 text-white flex flex-col md:flex-row justify-between items-center gap-8 relative">
          <div className="flex items-center space-x-6 relative z-10">
            <div className="w-24 h-24 rounded-[2.5rem] bg-indigo-500 flex items-center justify-center text-white text-4xl font-black shadow-2xl">
              {investor.name.charAt(0)}
            </div>
            <div>
              <h2 className="text-3xl font-black">{investor.name}</h2>
              <p className="text-indigo-300 font-medium mt-1">{investor.email || investor.phone}</p>
              <div className="inline-block mt-3 px-4 py-1.5 bg-indigo-800/50 rounded-full text-[10px] font-black uppercase tracking-widest border border-white/10">
                Партнер-инвестор
              </div>
            </div>
          </div>
          
          <div className="grid grid-cols-2 gap-4 relative z-10 w-full md:w-auto">
            <div className="bg-white/10 backdrop-blur-md px-6 py-4 rounded-2xl border border-white/10">
              <div className="text-[10px] font-black text-indigo-300 uppercase tracking-widest mb-1">Инвестировано</div>
              <div className="text-xl font-black text-white">{investor.totalInvested.toLocaleString()} ₽</div>
            </div>
            <div className="bg-rose-500/20 backdrop-blur-md px-6 py-4 rounded-2xl border border-rose-500/30">
              <div className="text-[10px] font-black text-rose-300 uppercase tracking-widest mb-1">Всего выплат</div>
              <div className="text-xl font-black text-rose-400">{totalPayouts.toLocaleString()} ₽</div>
            </div>
          </div>
          
          <i className="fas fa-handshake absolute -right-10 -bottom-10 text-[14rem] text-white/5 rotate-12"></i>
        </div>

        {/* Вкладки */}
        <div className="flex border-b border-slate-100 bg-slate-50/50">
          <button 
            onClick={() => setActiveTab('INFO')} 
            className={`flex-1 py-5 font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center space-x-2 ${activeTab === 'INFO' ? 'bg-white text-indigo-600 border-b-4 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <i className="fas fa-user-tie"></i>
            <span>Инвестор</span>
          </button>
          <button 
            onClick={() => setActiveTab('HISTORY')} 
            className={`flex-1 py-5 font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center space-x-2 ${activeTab === 'HISTORY' ? 'bg-white text-indigo-600 border-b-4 border-indigo-600' : 'text-slate-400 hover:text-slate-600'}`}
          >
            <i className="fas fa-history"></i>
            <span>История</span>
          </button>
        </div>

        <div className="p-8 md:p-12 space-y-12">
          {activeTab === 'INFO' ? (
            <>
              {/* Фильтр по периоду */}
              <div className="bg-slate-50 p-8 rounded-[2.5rem] border border-slate-100">
                <div className="flex flex-col md:flex-row justify-between items-center gap-6">
                  <div>
                    <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Доход за период</h3>
                    <p className="text-xs text-slate-400 font-bold uppercase tracking-widest mt-1">Анализ прибыльности ваших авто</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <input 
                      type="date" 
                      value={dateRange.start}
                      onChange={e => setDateRange({...dateRange, start: e.target.value})}
                      className="p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    <i className="fas fa-arrow-right text-slate-300"></i>
                    <input 
                      type="date" 
                      value={dateRange.end}
                      onChange={e => setDateRange({...dateRange, end: e.target.value})}
                      className="p-3 bg-white border border-slate-200 rounded-xl text-sm font-bold focus:ring-2 focus:ring-indigo-500 outline-none"
                    />
                    {(dateRange.start || dateRange.end) && (
                      <button onClick={() => setDateRange({start:'', end:''})} className="w-10 h-10 flex items-center justify-center text-rose-500 hover:bg-rose-50 rounded-full transition-all">
                        <i className="fas fa-times"></i>
                      </button>
                    )}
                  </div>
                </div>
                
                <div className="mt-8 grid grid-cols-1 md:grid-cols-2 gap-6">
                  <div className="bg-white p-6 rounded-[2rem] border border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Начислено за период</div>
                      <div className="text-3xl font-black text-indigo-600">{periodEarnings.toLocaleString()} ₽</div>
                    </div>
                    <div className="w-14 h-14 bg-indigo-50 rounded-2xl flex items-center justify-center text-indigo-600 text-xl">
                      <i className="fas fa-piggy-bank"></i>
                    </div>
                  </div>
                  <div className="bg-white p-6 rounded-[2rem] border border-slate-100 flex items-center justify-between">
                    <div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Сделок за период</div>
                      <div className="text-3xl font-black text-slate-900">{filteredRentals.length}</div>
                    </div>
                    <div className="w-14 h-14 bg-slate-50 rounded-2xl flex items-center justify-center text-slate-400 text-xl">
                      <i className="fas fa-file-contract"></i>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-6">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Авто в управлении</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                  {investorCars.map(car => (
                    <div key={car.id} className="bg-white p-6 rounded-[2rem] border border-slate-100 flex items-center space-x-5 group hover:border-indigo-200 transition-all shadow-sm">
                      <div className="w-20 h-20 rounded-2xl overflow-hidden shadow-inner flex-shrink-0">
                        <img src={car.images[0]} className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" alt="" />
                      </div>
                      <div className="flex-1 overflow-hidden">
                        <div className="font-bold text-slate-900 truncate">{car.brand} {car.model}</div>
                        <div className="text-[10px] text-slate-400 font-black tracking-widest uppercase">{car.plate}</div>
                        <div className="mt-2 flex items-center space-x-2">
                          <span className="text-[10px] font-black text-indigo-600 bg-indigo-50 px-2 py-1 rounded-lg">Доля: {car.investorShare}%</span>
                          <span className={`text-[8px] font-black px-2 py-1 rounded-lg uppercase ${car.status === 'Свободен' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'}`}>
                            {car.status}
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                  {investorCars.length === 0 && (
                    <div className="col-span-full p-12 text-center text-slate-400 bg-slate-50 border-2 border-dashed border-slate-100 rounded-[2.5rem] italic font-medium">
                      Нет закрепленных автомобилей
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            <div className="space-y-6 animate-fadeIn">
              <div className="flex justify-between items-center px-2">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">История операций</h3>
                <div className="flex gap-4">
                  <div className="text-right">
                    <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest">Всего выплачено</div>
                    <div className="text-lg font-black text-rose-600">{totalPayouts.toLocaleString()} ₽</div>
                  </div>
                </div>
              </div>
              <div className="space-y-3">
                {investorTransactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(t => (
                  <div key={t.id} className="p-6 bg-white rounded-[2rem] border border-slate-100 flex items-center justify-between hover:bg-slate-50 transition-all group">
                    <div className="flex items-center space-x-5">
                      <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${t.type === TransactionType.EXPENSE ? 'bg-rose-50 text-rose-500' : 'bg-emerald-50 text-emerald-500'}`}>
                        <i className={`fas ${t.type === TransactionType.EXPENSE ? 'fa-arrow-up' : 'fa-arrow-down'} text-xl`}></i>
                      </div>
                      <div>
                        <div className="font-bold text-slate-900 text-lg group-hover:text-indigo-600 transition-colors">{t.description || t.category}</div>
                        <div className="flex items-center space-x-3 mt-1">
                          <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{new Date(t.date).toLocaleDateString()}</div>
                          <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                          <div className="text-[10px] text-slate-400 font-black uppercase tracking-widest">{t.category}</div>
                        </div>
                      </div>
                    </div>
                    <div className={`text-right ${t.type === TransactionType.EXPENSE ? 'text-rose-600' : 'text-emerald-600'}`}>
                      <div className="font-black text-2xl">{t.type === TransactionType.EXPENSE ? '-' : '+'}{t.amount.toLocaleString()} ₽</div>
                      <div className="text-[10px] font-black uppercase tracking-tighter opacity-60">
                        {t.type === TransactionType.EXPENSE ? 'Выплата' : 'Начисление'}
                      </div>
                    </div>
                  </div>
                ))}
                {investorTransactions.length === 0 && (
                  <div className="p-20 text-center text-slate-400 bg-slate-50/50 border-2 border-dashed border-slate-100 rounded-[3rem] italic font-medium">
                    История операций пуста
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default InvestorDetails;
