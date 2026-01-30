
import React, { useState } from 'react';
import { Investor, Car, Rental, Transaction, TransactionType } from '../types';

interface InvestorListProps {
  investors: Investor[];
  cars: Car[];
  rentals: Rental[];
  transactions: Transaction[];
  onAdd: (i: Investor) => void;
  onUpdate: (i: Investor) => void;
  onDelete: (id: string) => void;
  onSelectInvestor: (id: string) => void;
}

const InvestorList: React.FC<InvestorListProps> = ({ investors, cars, rentals, transactions, onAdd, onUpdate, onDelete, onSelectInvestor }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingInvestor, setEditingInvestor] = useState<Investor | null>(null);
  const [showActions, setShowActions] = useState<string | null>(null);

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const data: Investor = {
      id: editingInvestor?.id || '', // Explicitly empty for new investors
      ownerId: editingInvestor?.ownerId || '',
      name: fd.get('name') as string,
      phone: fd.get('phone') as string,
      email: fd.get('email') as string,
      totalInvested: Number(fd.get('invested')) || 0,
      balance: editingInvestor?.balance || 0
    };

    if (editingInvestor) onUpdate(data);
    else onAdd(data);

    setIsModalOpen(false);
    setEditingInvestor(null);
  };

  const calculateEarnings = (investorId: string) => {
    return rentals.reduce((acc, rent) => {
      if (rent.paymentStatus !== 'PAID') return acc;
      const car = cars.find(c => c.id === rent.carId);
      if (car && car.investorId === investorId) {
        return acc + (rent.totalAmount * (car.investorShare || 0) / 100);
      }
      return acc;
    }, 0);
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-24 md:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm">
        <div>
          <h2 className="text-3xl font-black text-slate-900">Инвесторы</h2>
          <p className="text-slate-400 font-bold uppercase text-[10px] tracking-widest mt-1">Учет вложений и доходности партнеров</p>
        </div>
        <button
          onClick={() => { setEditingInvestor(null); setIsModalOpen(true); }}
          className="w-full md:w-auto bg-indigo-600 text-white px-8 py-4 rounded-2xl font-black hover:bg-indigo-700 shadow-xl shadow-indigo-500/20 transition-all flex items-center justify-center space-x-2 active:scale-95"
        >
          <i className="fas fa-plus"></i>
          <span>Новый партнер</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {investors.map(inv => {
          const rentalEarnings = calculateEarnings(inv.id);
          return (
            <div key={inv.id} className="bg-white p-8 rounded-[2rem] border border-slate-100 shadow-sm hover:shadow-md transition-all relative group">
              <div className="flex items-start justify-between mb-6">
                <div className="flex items-center space-x-4">
                  <div className="w-14 h-14 bg-indigo-50 text-indigo-600 rounded-2xl flex items-center justify-center text-xl font-black shadow-inner uppercase">
                    {inv.name.charAt(0)}
                  </div>
                  <div>
                    <h3 className="text-xl font-bold text-slate-900 tracking-tight">{inv.name}</h3>
                    <p className="text-sm text-slate-400 font-medium">{inv.phone}</p>
                  </div>
                </div>

                <div className="relative">
                  <button onClick={() => setShowActions(showActions === inv.id ? null : inv.id)} className="w-10 h-10 flex items-center justify-center text-slate-300 hover:text-slate-900 bg-slate-50 rounded-xl">
                    <i className="fas fa-ellipsis-v"></i>
                  </button>
                  {showActions === inv.id && (
                    <>
                      <div className="fixed inset-0 z-40" onClick={() => setShowActions(null)}></div>
                      <div className="absolute right-0 top-12 w-48 bg-white rounded-2xl shadow-2xl border border-slate-50 z-50 overflow-hidden animate-scaleIn">
                        <button onClick={() => { onSelectInvestor(inv.id); setShowActions(null); }} className="w-full px-5 py-3 text-left text-sm font-bold hover:bg-slate-50 flex items-center space-x-3 text-slate-600 border-b border-slate-50">
                          <i className="fas fa-id-card text-indigo-500"></i> <span>Инфо</span>
                        </button>
                        <button onClick={() => { setEditingInvestor(inv); setIsModalOpen(true); setShowActions(null); }} className="w-full px-5 py-3 text-left text-sm font-bold hover:bg-slate-50 flex items-center space-x-3 text-slate-600 border-b border-slate-50">
                          <i className="fas fa-edit text-amber-500"></i> <span>Изменить</span>
                        </button>
                        <button onClick={() => { if(window.confirm('Удалить инвестора?')) onDelete(inv.id); setShowActions(null); }} className="w-full px-5 py-3 text-left text-sm font-bold hover:bg-rose-50 text-rose-500 flex items-center space-x-3">
                          <i className="fas fa-trash-alt"></i> <span>Удалить</span>
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>

              <div className="grid grid-cols-1 gap-4">
                <div className="bg-slate-50 p-5 rounded-2xl border border-slate-100 flex justify-between items-center">
                   <div>
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Доход</div>
                      <div className="text-xl font-black text-indigo-700">{rentalEarnings.toLocaleString()} ₽</div>
                   </div>
                   <div className="text-right">
                      <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Вложено</div>
                      <div className="font-bold">{inv.totalInvested.toLocaleString()} ₽</div>
                   </div>
                </div>
              </div>
            </div>
          );
        })}
        {investors.length === 0 && (
          <div className="col-span-full py-20 bg-white rounded-[2.5rem] border-2 border-dashed border-slate-100 flex flex-col items-center justify-center text-slate-300">
            <i className="fas fa-handshake text-4xl mb-4 opacity-20"></i>
            <p className="font-bold uppercase tracking-widest text-sm">Инвесторы отсутствуют</p>
          </div>
        )}
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <form onSubmit={handleSubmit} className="bg-white rounded-[2.5rem] w-full max-w-lg p-10 shadow-2xl animate-scaleIn">
            <h2 className="text-2xl font-black mb-8 text-indigo-900">{editingInvestor ? 'Редактировать' : 'Новый партнер'}</h2>
            <div className="space-y-4 mb-10">
              <input name="name" defaultValue={editingInvestor?.name} placeholder="ФИО инвестора" required className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500 transition-all" />
              <input name="phone" defaultValue={editingInvestor?.phone} placeholder="Телефон" required className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500 transition-all" />
              <input name="email" defaultValue={editingInvestor?.email} type="email" placeholder="Email (необязательно)" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500 transition-all" />
              <input name="invested" defaultValue={editingInvestor?.totalInvested} type="number" placeholder="Сумма инвестиций" className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500 transition-all" />
            </div>
            <div className="flex gap-4">
              <button type="button" onClick={() => setIsModalOpen(false)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-bold text-slate-600 hover:bg-slate-200 transition-all">Отмена</button>
              <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-lg shadow-indigo-500/20 transition-all">Сохранить</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default InvestorList;
