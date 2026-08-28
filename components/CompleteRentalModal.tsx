
import React, { useState, useMemo } from 'react';
import { Rental, Car, Client } from '../types';

interface CompleteRentalModalProps {
  rental: Rental;
  car: Car;
  client: Client;
  onClose: () => void;
  onConfirm: (rental: Rental, amountReceived: number) => void;
}

const CompleteRentalModal: React.FC<CompleteRentalModalProps> = ({ rental, car, client, onClose, onConfirm }) => {
  const amountOwed = useMemo(() => {
    // If the entire rental is marked as DEBT, the outstanding amount is the total minus any prepayment.
    if (rental.paymentStatus === 'DEBT') {
        return (rental.totalAmount || 0) - (rental.prepayment || 0);
    }
    // If the rental was considered PAID, check if any extensions were added as DEBT.
    const debtFromExtensions = rental.extensions?.reduce((sum, ext) => {
        if (ext.paymentStatus === 'DEBT') {
            return sum + (ext.amount || 0);
        }
        return sum;
    }, 0) || 0;

    return debtFromExtensions;
  }, [rental]);

  const [amountReceived, setAmountReceived] = useState(amountOwed);

  const handleConfirm = () => {
    onConfirm(rental, amountReceived);
  };

  return (
    <div className="fixed inset-0 z-[110] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-md animate-scaleIn relative">
        <button
          onClick={onClose}
          className="absolute top-8 right-8 text-slate-300 dark:text-slate-600 hover:text-slate-900 transition-all"
        >
          <i className="fas fa-times"></i>
        </button>

        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2 uppercase tracking-tight">Завершение аренды</h2>
        <p className="text-sm font-medium text-slate-400 dark:text-slate-500 mb-8">
          Вы уверены, что хотите завершить договор №{rental.contractNumber}?
        </p>

        <div className="space-y-4">
          {/* Details */}
          <div className="bg-slate-50 dark:bg-slate-700 p-4 rounded-xl border border-slate-100 dark:border-slate-700 space-y-4">
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-blue-100 dark:bg-blue-500/15 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400">
                <i className="fas fa-car"></i>
              </div>
              <div>
                <div className="font-bold text-slate-900 dark:text-white">{car.brand} {car.model}</div>
                <div className="text-xs font-medium text-slate-400 dark:text-slate-500">{car.plate}</div>
              </div>
            </div>
            <div className="flex items-center space-x-4">
              <div className="w-12 h-12 bg-indigo-100 dark:bg-indigo-500/15 rounded-2xl flex items-center justify-center text-indigo-600 dark:text-indigo-400">
                <i className="fas fa-user"></i>
              </div>
              <div>
                <div className="font-bold text-slate-900 dark:text-white">{client.name}</div>
                <div className="text-xs font-medium text-slate-400 dark:text-slate-500">{client.phone}</div>
              </div>
            </div>
          </div>

          {/* Payment Section */}
          <div className="bg-emerald-50 dark:bg-emerald-500/10 p-4 rounded-xl border-2 border-emerald-100 dark:border-emerald-500/20">
            <div className="flex justify-between items-center">
              <div>
                <label className="text-[10px] font-semibold text-emerald-600 dark:text-emerald-400 uppercase tracking-wide mb-1 block">
                  Сумма к оприходованию (₽)
                </label>
                <input
                  type="number"
                  value={amountReceived}
                  onChange={(e) => setAmountReceived(Number(e.target.value))}
                  className="w-full bg-transparent text-4xl font-bold text-emerald-700 dark:text-emerald-400 outline-none p-0 border-none"
                />
              </div>
              <div className="text-right">
                <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Долг по сделке</div>
                <div className="text-lg font-bold text-slate-500 dark:text-slate-400">{amountOwed.toLocaleString()} ₽</div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex gap-4 mt-10">
          <button
            type="button"
            onClick={onClose}
            className="flex-1 py-5 bg-slate-100 dark:bg-slate-700 rounded-2xl font-bold text-slate-500 dark:text-slate-400 hover:bg-slate-200 transition-all"
          >
            Отмена
          </button>
          <button
            onClick={handleConfirm}
            className="flex-1 py-5 bg-blue-600 text-white rounded-2xl font-semibold uppercase tracking-wide text-sm shadow-md hover:bg-blue-700 active:scale-95 transition-all"
          >
            Подтвердить
          </button>
        </div>
      </div>
    </div>
  );
};

export default CompleteRentalModal;
