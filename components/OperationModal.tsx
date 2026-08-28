
import React from 'react';
import { Transaction, Rental, TransactionType, Car } from '../types.ts';

interface OperationModalProps {
  item: Transaction | Rental | any;
  cars: Car[];
  onClose: () => void;
}

const OperationModal: React.FC<OperationModalProps> = ({ item, cars, onClose }) => {
  const isRental = 'contractNumber' in item;
  const car = cars.find(c => c.id === item.carId);

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-md animate-scaleIn relative overflow-hidden">
        <div className={`absolute top-0 left-0 right-0 h-2 ${isRental ? 'bg-blue-600' : (item.type === TransactionType.INCOME ? 'bg-emerald-500' : 'bg-rose-500')}`}></div>
        
        <button onClick={onClose} className="absolute top-8 right-8 text-slate-300 dark:text-slate-600 hover:text-slate-900 dark:hover:text-white transition-all">
          <i className="fas fa-times"></i>
        </button>

        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-8 uppercase tracking-tight">Детали операции</h2>

        <div className="space-y-4">
          <div className="flex items-center space-x-6">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-2xl ${isRental ? 'bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400' : 'bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300'}`}>
              <i className={`fas ${isRental ? 'fa-file-contract' : 'fa-receipt'}`}></i>
            </div>
            <div>
              <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">ID Операции</div>
              <div className="font-bold text-slate-900 dark:text-white">{item.id.slice(-8)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="bg-slate-50 dark:bg-slate-700 p-5 rounded-2xl">
              <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Сумма</div>
              <div className={`text-xl font-bold ${!isRental && item.type === TransactionType.EXPENSE ? 'text-rose-600 dark:text-rose-400' : 'text-emerald-600 dark:text-emerald-400'}`}>
                {item.totalAmount?.toLocaleString() || item.amount?.toLocaleString()} ₽
              </div>
            </div>
            <div className="bg-slate-50 dark:bg-slate-700 p-5 rounded-2xl">
              <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Дата</div>
              <div className="text-sm font-bold text-slate-900 dark:text-white">{new Date(item.date || item.startDate).toLocaleDateString()}</div>
            </div>
          </div>

          {isRental && (
            <div className="bg-blue-50 dark:bg-blue-500/10 p-5 rounded-2xl border border-blue-100 dark:border-blue-500/20">
              <div className="text-[10px] font-semibold text-blue-400 uppercase tracking-wide mb-2">Автомобиль</div>
              <div className="font-bold text-blue-900">{car?.brand} {car?.model}</div>
              <div className="text-xs font-medium text-blue-400">{car?.plate}</div>
            </div>
          )}

          <div className="bg-slate-50 dark:bg-slate-700 p-5 rounded-2xl">
            <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Описание</div>
            <div className="text-sm font-bold text-slate-800 dark:text-slate-100 leading-relaxed">
              {isRental ? `Договор аренды ${item.contractNumber}. Период: ${item.startDate} - ${item.endDate}` : (item.description || 'Нет деталей')}
            </div>
          </div>

          {!isRental && (
             <div className="flex items-center space-x-2">
               <span className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Категория:</span>
               <span className="px-3 py-1 bg-slate-100 dark:bg-slate-700 rounded-full text-[10px] font-semibold text-slate-600 dark:text-slate-300 uppercase tracking-tight">{item.category}</span>
             </div>
          )}
        </div>

        <button onClick={onClose} className="w-full mt-10 py-4 bg-slate-900 text-white rounded-2xl font-semibold hover:bg-slate-800 transition-all">
          Закрыть
        </button>
      </div>
    </div>
  );
};

export default OperationModal;
