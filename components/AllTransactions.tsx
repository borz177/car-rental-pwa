
import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, TransactionType, Investor, Car, Staff } from '../types';
import { INCOME_CATEGORIES, EXPENSE_CATEGORIES } from './TransactionTypePage';
import Pagination from './Pagination';

interface AllTransactionsProps {
  transactions: Transaction[];
  cars: Car[];
  investors: Investor[];
  staff: Staff[];
  onAddTransaction: (t: Partial<Transaction>, clientId?: string) => void;
  onDeleteTransaction: (id: string) => void;
  onBack: () => void;
}

type EntityFilter = { kind: 'car' | 'staff' | 'investor'; id: string } | null;
type Period = 'TODAY' | 'WEEK' | 'MONTH' | 'ALL';

const PERIOD_LABELS: Record<Period, string> = { TODAY: 'сегодня', WEEK: 'за 7 дней', MONTH: 'за 30 дней', ALL: 'за всё время' };
const PERIOD_DAYS: Record<Period, number | null> = { TODAY: 1, WEEK: 7, MONTH: 30, ALL: null };

// Полный финансовый журнал: оба типа вместе, фильтры по категории/авто/сотруднику/
// инвестору, сравнение с прошлым периодом, исправление через сторно (отменяющая +
// новая корректная запись — исходная строка в истории не трогается) и удаление.
// Приход/Расход (TransactionTypePage.tsx) остаются узкими экранами для создания —
// разбор и правки живут здесь, потому что фильтр "все операции по этой машине"
// осмысленен только вместе для обоих типов сразу.
const AllTransactions: React.FC<AllTransactionsProps> = ({
  transactions, cars, investors, staff, onAddTransaction, onDeleteTransaction, onBack
}) => {
  const [period, setPeriod] = useState<Period>('MONTH');
  const [typeFilter, setTypeFilter] = useState<'ALL' | TransactionType>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [entityFilter, setEntityFilter] = useState<EntityFilter>(null);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [menuOpenId, setMenuOpenId] = useState<string | null>(null);
  const [correctingTx, setCorrectingTx] = useState<Transaction | null>(null);

  const dateOnly = (v: string) => String(v).split('T')[0];
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' });

  const rangeFor = (p: Period, endExclusive: string) => {
    const days = PERIOD_DAYS[p];
    if (days === null) return { start: '', end: endExclusive };
    const end = new Date(endExclusive);
    const start = new Date(end);
    start.setDate(start.getDate() - days);
    return { start: start.toLocaleDateString('en-CA'), end: endExclusive };
  };

  const current = rangeFor(period, new Date(new Date(todayStr).getTime() + 86400000).toLocaleDateString('en-CA'));
  const previous = period === 'ALL' ? null : rangeFor(period, current.start);

  const inRange = (t: Transaction, range: { start: string; end: string }) =>
    (!range.start || dateOnly(t.date) >= range.start) && dateOnly(t.date) < range.end;

  const periodTransactions = useMemo(() => transactions.filter(t => inRange(t, current)), [transactions, current]);
  const prevPeriodTransactions = useMemo(() => previous ? transactions.filter(t => inRange(t, previous)) : [], [transactions, previous]);

  const sumBy = (list: Transaction[], type: TransactionType) => list.filter(t => t.type === type).reduce((a, t) => a + t.amount, 0);

  const income = sumBy(periodTransactions, TransactionType.INCOME);
  const expense = sumBy(periodTransactions, TransactionType.EXPENSE);
  const profit = income - expense;
  const prevIncome = sumBy(prevPeriodTransactions, TransactionType.INCOME);
  const prevExpense = sumBy(prevPeriodTransactions, TransactionType.EXPENSE);
  const prevProfit = prevIncome - prevExpense;

  const pctChange = (curr: number, prev: number): number | null => {
    if (!previous) return null;
    if (prev === 0) return curr === 0 ? 0 : null;
    return Math.round(((curr - prev) / Math.abs(prev)) * 100);
  };

  const breakdownOf = (type: TransactionType) => {
    const map = new Map<string, number>();
    periodTransactions.filter(t => t.type === type).forEach(t => {
      const key = t.category || 'Без категории';
      map.set(key, (map.get(key) || 0) + t.amount);
    });
    const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]).slice(0, 4);
    const max = sorted.length > 0 ? sorted[0][1] : 0;
    return sorted.map(([category, amount]) => ({ category, amount, pct: max > 0 ? Math.round((amount / max) * 100) : 0 }));
  };
  const incomeBreakdown = useMemo(() => breakdownOf(TransactionType.INCOME), [periodTransactions]);
  const expenseBreakdown = useMemo(() => breakdownOf(TransactionType.EXPENSE), [periodTransactions]);

  const visibleTransactions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return periodTransactions
      .filter(t => typeFilter === 'ALL' || t.type === typeFilter)
      .filter(t => !categoryFilter || t.category === categoryFilter)
      .filter(t => {
        if (!entityFilter) return true;
        if (entityFilter.kind === 'car') return t.carId === entityFilter.id;
        if (entityFilter.kind === 'staff') return t.staffId === entityFilter.id;
        return t.investorId === entityFilter.id;
      })
      .filter(t => !q || `${t.description || ''} ${t.category || ''}`.toLowerCase().includes(q))
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [periodTransactions, typeFilter, categoryFilter, entityFilter, search]);

  const pagedTransactions = useMemo(
    () => visibleTransactions.slice((page - 1) * pageSize, page * pageSize),
    [visibleTransactions, page, pageSize]
  );

  useEffect(() => { setPage(1); }, [period, typeFilter, categoryFilter, entityFilter, search, pageSize]);

  const exportCsv = () => {
    const rows = [
      ['Дата', 'Тип', 'Категория', 'Описание', 'Сумма'],
      ...visibleTransactions.map(t => [
        new Date(t.date).toLocaleDateString('ru-RU'), t.type, t.category || '',
        (t.description || '').replace(/"/g, '""'), String(t.amount)
      ])
    ];
    const csv = rows.map(r => r.map(cell => `"${cell}"`).join(';')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `operacii-${todayStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleDelete = (t: Transaction) => {
    setMenuOpenId(null);
    if (confirm(`Удалить операцию "${t.description || t.category}" на ${t.amount.toLocaleString()} ₽? Действие необратимо.`)) {
      onDeleteTransaction(t.id);
    }
  };

  const getCarLabel = (id?: string) => { const c = cars.find(x => x.id === id); return c ? `${c.brand} ${c.model} (${c.plate})` : null; };
  const getStaffLabel = (id?: string) => staff.find(x => x.id === id)?.name || null;
  const getInvestorLabel = (id?: string) => investors.find(x => x.id === id)?.name || null;

  return (
    <div className="space-y-5 animate-fadeIn pb-24 md:pb-0">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm text-slate-500 dark:text-slate-400 flex items-center justify-center hover:text-blue-600 hover:border-blue-100 transition-all">
          <i className="fas fa-arrow-left"></i>
        </button>
        <h2 className="text-3xl font-semibold text-slate-900 dark:text-white flex-1">Все операции</h2>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <StatCard label="Доход" value={`+${income.toLocaleString()} ₽`} valueClass="text-emerald-600 dark:text-emerald-400" sub={PERIOD_LABELS[period]} delta={pctChange(income, prevIncome)} deltaGoodDirection="up" />
        <StatCard label="Расход" value={`−${expense.toLocaleString()} ₽`} valueClass="text-rose-600 dark:text-rose-400" sub={PERIOD_LABELS[period]} delta={pctChange(expense, prevExpense)} deltaGoodDirection="down" />
        <StatCard label="Прибыль" value={`${profit.toLocaleString()} ₽`} valueClass={profit >= 0 ? 'text-slate-900 dark:text-white' : 'text-rose-600 dark:text-rose-400'} sub={PERIOD_LABELS[period]} delta={pctChange(profit, prevProfit)} deltaGoodDirection="up" />
        <StatCard label="Операций" value={String(periodTransactions.length)} valueClass="text-slate-900 dark:text-white" sub={PERIOD_LABELS[period]} />
      </div>

      {(incomeBreakdown.length > 0 || expenseBreakdown.length > 0) && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          <BreakdownCard title="Топ статей дохода" items={incomeBreakdown} accent="emerald"
            onSelect={(cat) => { setTypeFilter(TransactionType.INCOME); setCategoryFilter(cat); }} />
          <BreakdownCard title="Топ статей расхода" items={expenseBreakdown} accent="rose"
            onSelect={(cat) => { setTypeFilter(TransactionType.EXPENSE); setCategoryFilter(cat); }} />
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 space-y-3">
          <div className="flex justify-between items-center gap-3 flex-wrap">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              История
              <span className="ml-2 text-xs font-medium text-slate-400 dark:text-slate-500">{visibleTransactions.length}</span>
            </h3>
            <button onClick={exportCsv} disabled={visibleTransactions.length === 0} className="text-blue-600 dark:text-blue-400 font-semibold text-xs uppercase tracking-wide hover:bg-blue-50 px-3 py-2 rounded-xl transition-all disabled:opacity-40">
              <i className="fas fa-file-arrow-down mr-1.5"></i>Экспорт в CSV
            </button>
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            {(Object.keys(PERIOD_LABELS) as Period[]).map(id => (
              <button key={id} onClick={() => setPeriod(id)} className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wide transition-colors ${period === id ? 'bg-slate-800 text-white' : 'bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-slate-600'}`}>
                {PERIOD_LABELS[id]}
              </button>
            ))}
            <span className="w-px bg-slate-200 dark:bg-slate-600 mx-1 self-stretch"></span>
            {([['ALL', 'Все'], [TransactionType.INCOME, 'Доходы'], [TransactionType.EXPENSE, 'Расходы']] as const).map(([id, label]) => (
              <button key={String(id)} onClick={() => setTypeFilter(id as any)} className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wide transition-colors ${typeFilter === id ? 'bg-blue-600 text-white' : 'bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-slate-600'}`}>
                {label}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={entityFilter ? `${entityFilter.kind}:${entityFilter.id}` : ''}
              onChange={(e) => {
                const v = e.target.value;
                if (!v) return setEntityFilter(null);
                const [kind, id] = v.split(':');
                setEntityFilter({ kind: kind as 'car' | 'staff' | 'investor', id });
              }}
              className="px-3 py-2 bg-slate-50 dark:bg-slate-700 rounded-xl text-xs font-semibold outline-none border-2 border-transparent focus:border-blue-500 text-slate-700 dark:text-slate-200"
            >
              <option value="">Все привязки</option>
              {cars.length > 0 && (
                <optgroup label="Автомобили">
                  {cars.map(c => <option key={c.id} value={`car:${c.id}`}>{c.brand} {c.model} ({c.plate})</option>)}
                </optgroup>
              )}
              {staff.length > 0 && (
                <optgroup label="Сотрудники">
                  {staff.map(s => <option key={s.id} value={`staff:${s.id}`}>{s.name}</option>)}
                </optgroup>
              )}
              {investors.length > 0 && (
                <optgroup label="Инвесторы">
                  {investors.map(i => <option key={i.id} value={`investor:${i.id}`}>{i.name}</option>)}
                </optgroup>
              )}
            </select>

            {categoryFilter && (
              <button onClick={() => setCategoryFilter(null)} className="px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wide bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400 flex items-center gap-2">
                {categoryFilter} <i className="fas fa-times"></i>
              </button>
            )}
          </div>

          <div className="relative">
            <i className="fas fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 text-xs"></i>
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Поиск по описанию или категории"
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-700 rounded-xl text-sm font-medium outline-none border-2 border-transparent focus:border-blue-500 transition-all" />
          </div>
        </div>

        <div className="divide-y divide-slate-50 dark:divide-slate-800">
          {pagedTransactions.map(t => {
            const linkLabel = getCarLabel(t.carId) || getStaffLabel(t.staffId) || getInvestorLabel(t.investorId);
            return (
              <div key={t.id} className="px-4 py-3 hover:bg-slate-50/50 transition-colors flex items-center gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${t.type === TransactionType.INCOME ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400'}`}>
                  <i className={`fas ${t.type === TransactionType.INCOME ? 'fa-arrow-down' : 'fa-arrow-up'} text-xs`}></i>
                </div>
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                    {t.description || <span className="text-slate-300 dark:text-slate-600 italic font-medium">Без описания</span>}
                  </div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium truncate">
                    {new Date(t.date).toLocaleDateString('ru-RU')} • {t.category}{linkLabel ? ` • ${linkLabel}` : ''}
                  </div>
                </div>
                <div className={`font-bold flex-shrink-0 ${t.type === TransactionType.INCOME ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                  {t.type === TransactionType.INCOME ? '+' : '−'}{t.amount.toLocaleString()} ₽
                </div>
                <div className="relative">
                  <button onClick={() => setMenuOpenId(menuOpenId === t.id ? null : t.id)} className="w-8 h-8 flex items-center justify-center text-slate-300 dark:text-slate-600 hover:text-slate-600 hover:bg-slate-100 rounded-lg transition-all">
                    <i className="fas fa-ellipsis-v text-xs"></i>
                  </button>
                  {menuOpenId === t.id && (
                    <>
                      <div className="fixed inset-0 z-20" onClick={() => setMenuOpenId(null)}></div>
                      <div className="absolute top-9 right-0 w-44 bg-white dark:bg-slate-800 rounded-xl shadow-md border border-slate-100 dark:border-slate-700 z-30 py-1 animate-scaleIn">
                        <button onClick={() => { setCorrectingTx(t); setMenuOpenId(null); }} className="w-full px-4 py-2.5 text-left text-xs font-bold hover:bg-slate-50 flex items-center gap-2 text-amber-600 dark:text-amber-400">
                          <i className="fas fa-rotate-left w-4"></i> Исправить
                        </button>
                        <button onClick={() => handleDelete(t)} className="w-full px-4 py-2.5 text-left text-xs font-bold hover:bg-rose-50 flex items-center gap-2 text-rose-500 dark:text-rose-400">
                          <i className="fas fa-trash-alt w-4"></i> Удалить
                        </button>
                      </div>
                    </>
                  )}
                </div>
              </div>
            );
          })}
          {visibleTransactions.length === 0 && (
            <div className="p-12 text-center">
              <i className="fas fa-receipt text-3xl text-slate-200 dark:text-slate-700 mb-3"></i>
              <div className="font-semibold text-slate-500 dark:text-slate-400">Ничего не найдено</div>
            </div>
          )}
        </div>

        <Pagination page={page} pageSize={pageSize} totalItems={visibleTransactions.length} onPageChange={setPage} onPageSizeChange={setPageSize} />
      </div>

      {correctingTx && (
        <CorrectionModal
          tx={correctingTx}
          onClose={() => setCorrectingTx(null)}
          onSubmit={(fixed) => {
            const opposite = correctingTx.type === TransactionType.INCOME ? TransactionType.EXPENSE : TransactionType.INCOME;
            const nowIso = new Date().toISOString();
            // 1. Отменяющая запись — гасит эффект оригинала на баланс, сам оригинал не трогаем.
            onAddTransaction({
              amount: correctingTx.amount,
              type: opposite,
              category: 'Корректировка',
              description: `Отмена операции от ${new Date(correctingTx.date).toLocaleDateString('ru-RU')}: ${correctingTx.description || correctingTx.category}`,
              date: nowIso,
              carId: correctingTx.carId,
              investorId: correctingTx.investorId,
              staffId: correctingTx.staffId
            });
            // 2. Новая запись с исправленными данными — та же привязка (авто/сотрудник/инвестор), что у оригинала.
            onAddTransaction({
              amount: fixed.amount,
              type: correctingTx.type,
              category: fixed.category,
              description: fixed.description,
              date: new Date(`${fixed.date}T12:00:00`).toISOString(),
              carId: correctingTx.carId,
              investorId: correctingTx.investorId,
              staffId: correctingTx.staffId
            }, correctingTx.clientId);
            setCorrectingTx(null);
          }}
        />
      )}
    </div>
  );
};

const StatCard: React.FC<{ label: string; value: string; valueClass: string; sub: string; delta?: number | null; deltaGoodDirection?: 'up' | 'down' }> = ({ label, value, valueClass, sub, delta, deltaGoodDirection }) => {
  const showDelta = delta !== undefined && delta !== null;
  const isUp = (delta || 0) >= 0;
  const isGood = showDelta && (deltaGoodDirection === 'up' ? isUp : !isUp);
  return (
    <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
      <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">{label}</div>
      <div className={`text-xl md:text-2xl font-bold mt-1 ${valueClass}`}>{value}</div>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-[10px] font-medium text-slate-400 dark:text-slate-500">{sub}</span>
        {showDelta && delta !== 0 && (
          <span className={`text-[10px] font-bold flex items-center gap-0.5 ${isGood ? 'text-emerald-500 dark:text-emerald-400' : 'text-rose-500 dark:text-rose-400'}`}>
            <i className={`fas ${isUp ? 'fa-arrow-up' : 'fa-arrow-down'}`}></i>{Math.abs(delta!)}%
          </span>
        )}
      </div>
    </div>
  );
};

const BreakdownCard: React.FC<{ title: string; items: { category: string; amount: number; pct: number }[]; accent: 'emerald' | 'rose'; onSelect: (cat: string) => void }> = ({ title, items, accent, onSelect }) => (
  <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-4">
    <h3 className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-3">{title}</h3>
    {items.length === 0 ? (
      <div className="text-xs text-slate-300 dark:text-slate-600 font-medium py-4 text-center">Нет данных</div>
    ) : (
      <div className="space-y-2.5">
        {items.map(it => (
          <button key={it.category} onClick={() => onSelect(it.category)} className="w-full text-left group">
            <div className="flex justify-between items-baseline text-xs mb-1">
              <span className="font-semibold text-slate-700 dark:text-slate-200 group-hover:text-blue-600 transition-colors">{it.category}</span>
              <span className="text-slate-400 dark:text-slate-500 font-medium">{it.amount.toLocaleString()} ₽</span>
            </div>
            <div className="h-1.5 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
              <div className={`h-full rounded-full ${accent === 'emerald' ? 'bg-emerald-500' : 'bg-rose-500'}`} style={{ width: `${Math.max(it.pct, 4)}%` }}></div>
            </div>
          </button>
        ))}
      </div>
    )}
  </div>
);

const CorrectionModal: React.FC<{
  tx: Transaction;
  onClose: () => void;
  onSubmit: (fixed: { amount: number; category: string; description: string; date: string }) => void;
}> = ({ tx, onClose, onSubmit }) => {
  const categories = tx.type === TransactionType.INCOME ? INCOME_CATEGORIES : EXPENSE_CATEGORIES;
  const initialDate = String(tx.date).split('T')[0];

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    onSubmit({
      amount: Number(fd.get('amount')),
      category: (fd.get('category') as string) || tx.category,
      description: (fd.get('description') as string) || '',
      date: (fd.get('date') as string) || initialDate
    });
  };

  return (
    <div className="fixed inset-0 z-[90] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
      <form onSubmit={handleSubmit} className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-lg p-6 shadow-md animate-scaleIn relative">
        <button type="button" onClick={onClose} className="absolute top-8 right-8 w-10 h-10 flex items-center justify-center text-slate-300 dark:text-slate-600 hover:text-slate-900 bg-slate-50 dark:bg-slate-700 rounded-full transition-all">
          <i className="fas fa-times"></i>
        </button>

        <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-2">Исправить операцию</h2>
        <p className="text-xs text-slate-400 dark:text-slate-500 font-medium mb-6 leading-relaxed">
          Будут добавлены 2 новые операции: отмена старой суммы и новая — с исправленными данными.
          Исходная запись останется в истории без изменений — это честный способ править кассу задним числом.
        </p>

        <div className="bg-slate-50 dark:bg-slate-700 rounded-2xl p-4 mb-6 text-xs">
          <div className="font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wide mb-1">Было</div>
          <div className="font-bold text-slate-900 dark:text-white">{tx.amount.toLocaleString()} ₽ · {tx.category}</div>
          {tx.description && <div className="text-slate-400 dark:text-slate-500 mt-0.5">{tx.description}</div>}
        </div>

        <div className="space-y-4 mb-8">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide ml-2 mb-1 block">Сумма (₽)</label>
              <input name="amount" type="number" required defaultValue={tx.amount} className="w-full p-4 bg-slate-50 dark:bg-slate-700 rounded-2xl font-bold text-xl text-slate-900 dark:text-white outline-none border-2 border-transparent focus:border-blue-500" />
            </div>
            <div>
              <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide ml-2 mb-1 block">Дата</label>
              <input name="date" type="date" required defaultValue={initialDate} max={new Date().toLocaleDateString('en-CA')} className="w-full p-4 bg-slate-50 dark:bg-slate-700 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500 text-slate-900 dark:text-white" />
            </div>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide ml-2 mb-1 block">Категория</label>
            <select name="category" required defaultValue={categories.includes(tx.category) ? tx.category : ''} className="w-full p-4 bg-slate-50 dark:bg-slate-700 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500 appearance-none text-slate-900 dark:text-white">
              {!categories.includes(tx.category) && <option value={tx.category}>{tx.category}</option>}
              {categories.map(c => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide ml-2 mb-1 block">Описание</label>
            <input name="description" defaultValue={tx.description} placeholder="Детали для истории" className="w-full p-4 bg-slate-50 dark:bg-slate-700 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
          </div>
          {(tx.carId || tx.staffId || tx.investorId) && (
            <div className="text-[10px] text-blue-500 dark:text-blue-400 font-bold ml-2">
              <i className="fas fa-info-circle mr-1"></i>
              Привязка к авто/сотруднику/инвестору сохранится без изменений. Чтобы поменять саму привязку — удалите операцию и создайте новую.
            </div>
          )}
        </div>

        <button type="submit" className="w-full py-4 bg-amber-500 text-white rounded-xl font-semibold text-base shadow-md hover:bg-amber-600 transition-all active:scale-[0.98]">
          Провести исправление
        </button>
      </form>
    </div>
  );
};

export default AllTransactions;
