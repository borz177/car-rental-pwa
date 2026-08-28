
import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType, AppView } from '../types';

interface CashboxProps {
  transactions: Transaction[];
  onNavigate: (view: AppView) => void;
}

// Касса — обзорный хаб: баланс, динамика за период и переход на отдельные
// страницы Приход/Расход (см. TransactionTypePage.tsx), где и происходит
// вся работа с операциями конкретного типа. Сам хаб операции не создаёт.
const Cashbox: React.FC<CashboxProps> = ({ transactions, onNavigate }) => {
  const [period, setPeriod] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'ALL'>('MONTH');

  const dateOnly = (v: string) => String(v).split('T')[0];
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' });

  const periodStart = useMemo(() => {
    if (period === 'ALL') return '';
    if (period === 'TODAY') return todayStr;
    const d = new Date(todayStr);
    d.setDate(d.getDate() - (period === 'WEEK' ? 6 : 29));
    return d.toLocaleDateString('en-CA');
  }, [period, todayStr]);

  const periodLabels = { TODAY: 'сегодня', WEEK: 'за 7 дней', MONTH: 'за 30 дней', ALL: 'за всё время' };

  const periodTransactions = useMemo(
    () => transactions.filter(t => !periodStart || dateOnly(t.date) >= periodStart),
    [transactions, periodStart]
  );

  // Баланс — по всей истории: это остаток кассы, он не зависит от выбранного периода.
  const balance = useMemo(() => transactions.reduce((acc, t) =>
    t.type === TransactionType.INCOME ? acc + t.amount : acc - t.amount, 0
  ), [transactions]);

  const periodIncome = useMemo(
    () => periodTransactions.filter(t => t.type === TransactionType.INCOME),
    [periodTransactions]
  );
  const periodExpenses = useMemo(
    () => periodTransactions.filter(t => t.type === TransactionType.EXPENSE),
    [periodTransactions]
  );
  const incomeTotal = periodIncome.reduce((a, t) => a + t.amount, 0);
  const expenseTotal = periodExpenses.reduce((a, t) => a + t.amount, 0);
  const profit = incomeTotal - expenseTotal;

  const recentActivity = useMemo(
    () => transactions.slice().sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()).slice(0, 6),
    [transactions]
  );

  return (
    <div className="space-y-5 animate-fadeIn pb-24 md:pb-0">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-semibold text-slate-900 dark:text-white">Касса и финансы</h2>
          <p className="text-slate-400 dark:text-slate-500 font-bold mt-1 uppercase text-[10px] tracking-wide hidden md:block">Обзор кассы вашей компании</p>
        </div>
        <div className="flex flex-wrap gap-2">
          {([['TODAY', 'Сегодня'], ['WEEK', '7 дней'], ['MONTH', '30 дней'], ['ALL', 'Всё время']] as const).map(([id, label]) => (
            <button
              key={id}
              onClick={() => setPeriod(id)}
              className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                period === id ? 'bg-slate-800 text-white' : 'bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        <div className="bg-slate-900 p-5 rounded-2xl text-white relative overflow-hidden">
          <div className="relative z-10">
            <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Баланс кассы</div>
            <div className="text-3xl font-bold mt-1">{balance.toLocaleString()} ₽</div>
            <div className="text-[10px] font-medium text-slate-500 dark:text-slate-400 mt-0.5">за всё время</div>
          </div>
          <i className="fas fa-coins absolute -right-5 -bottom-5 text-7xl text-white/5 rotate-12"></i>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700">
          <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Прибыль</div>
          <div className={`text-3xl font-bold mt-1 ${profit >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'}`}>{profit.toLocaleString()} ₽</div>
          <div className="text-[10px] font-medium text-slate-400 dark:text-slate-500 mt-0.5">{periodLabels[period]}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl border border-slate-100 dark:border-slate-700 flex items-center justify-center gap-6">
          <div className="text-center">
            <div className="text-[10px] font-semibold text-emerald-500 dark:text-emerald-400 uppercase tracking-wide">Доход</div>
            <div className="text-xl font-bold text-emerald-600 dark:text-emerald-400 mt-1">+{incomeTotal.toLocaleString()} ₽</div>
          </div>
          <div className="w-px h-10 bg-slate-100 dark:bg-slate-700"></div>
          <div className="text-center">
            <div className="text-[10px] font-semibold text-rose-500 dark:text-rose-400 uppercase tracking-wide">Расход</div>
            <div className="text-xl font-bold text-rose-600 dark:text-rose-400 mt-1">−{expenseTotal.toLocaleString()} ₽</div>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <button
          onClick={() => onNavigate('INCOME')}
          className="group bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-emerald-200 dark:hover:border-emerald-500/30 transition-all text-left flex items-center gap-4"
        >
          <div className="w-14 h-14 rounded-2xl bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition-transform">
            <i className="fas fa-arrow-down"></i>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-slate-900 dark:text-white text-lg">Приход</div>
            <div className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5">{periodIncome.length} операций · {periodLabels[period]}</div>
            <div className="text-emerald-600 dark:text-emerald-400 font-bold mt-1">+{incomeTotal.toLocaleString()} ₽</div>
          </div>
          <i className="fas fa-chevron-right text-slate-300 dark:text-slate-600 group-hover:text-emerald-500 dark:group-hover:text-emerald-400 transition-colors"></i>
        </button>

        <button
          onClick={() => onNavigate('EXPENSE')}
          className="group bg-white dark:bg-slate-800 p-6 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm hover:shadow-md hover:border-rose-200 dark:hover:border-rose-500/30 transition-all text-left flex items-center gap-4"
        >
          <div className="w-14 h-14 rounded-2xl bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400 flex items-center justify-center text-2xl shrink-0 group-hover:scale-105 transition-transform">
            <i className="fas fa-arrow-up"></i>
          </div>
          <div className="flex-1 min-w-0">
            <div className="font-semibold text-slate-900 dark:text-white text-lg">Расход</div>
            <div className="text-xs text-slate-400 dark:text-slate-500 font-medium mt-0.5">{periodExpenses.length} операций · {periodLabels[period]}</div>
            <div className="text-rose-600 dark:text-rose-400 font-bold mt-1">−{expenseTotal.toLocaleString()} ₽</div>
          </div>
          <i className="fas fa-chevron-right text-slate-300 dark:text-slate-600 group-hover:text-rose-500 dark:group-hover:text-rose-400 transition-colors"></i>
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 flex justify-between items-center gap-3">
          <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">Последние операции</h3>
          <button onClick={() => onNavigate('TRANSACTIONS')} className="text-blue-600 dark:text-blue-400 font-semibold text-xs uppercase tracking-wide hover:bg-blue-50 dark:hover:bg-blue-500/10 px-3 py-2 rounded-xl transition-all whitespace-nowrap">
            Все операции <i className="fas fa-arrow-right ml-1"></i>
          </button>
        </div>
        <div className="divide-y divide-slate-50 dark:divide-slate-800">
          {recentActivity.map(t => (
            <div key={t.id} className="px-4 py-3 flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                t.type === TransactionType.INCOME ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400'
              }`}>
                <i className={`fas ${t.type === TransactionType.INCOME ? 'fa-arrow-down' : 'fa-arrow-up'} text-xs`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                  {t.description || <span className="text-slate-300 dark:text-slate-600 italic font-medium">Без описания</span>}
                </div>
                <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                  {new Date(t.date).toLocaleDateString('ru-RU')} • {t.category}
                </div>
              </div>
              <div className={`font-bold flex-shrink-0 ${t.type === TransactionType.INCOME ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                {t.type === TransactionType.INCOME ? '+' : '−'}{t.amount.toLocaleString()} ₽
              </div>
            </div>
          ))}
          {recentActivity.length === 0 && (
            <div className="p-12 text-center">
              <i className="fas fa-receipt text-3xl text-slate-200 dark:text-slate-700 mb-3"></i>
              <div className="font-semibold text-slate-500 dark:text-slate-400">Операций пока нет</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Cashbox;
