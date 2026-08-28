
import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, TransactionType, Client, Rental, Investor, Car, Staff } from '../types';
import Pagination from './Pagination';

interface TransactionTypePageProps {
  type: TransactionType.INCOME | TransactionType.EXPENSE;
  transactions: Transaction[];
  clients: Client[];
  rentals: Rental[];
  staff: Staff[];
  investors: Investor[];
  cars: Car[];
  onAddTransaction: (t: Partial<Transaction>, clientId?: string) => void;
  onBack: () => void;
}

export const INCOME_CATEGORIES = ['Аренда', 'Продажа', 'Бонус', 'Возврат долга', 'Прочее'];
export const EXPENSE_CATEGORIES = ['Мойка', 'Ремонт', 'Замена масла', 'Оклад', 'Инвестиции', 'Аренда', 'Прочее'];
export const CAR_RELATED_EXPENSE_CATEGORIES = ['Мойка', 'Ремонт', 'Замена масла'];

// Единая страница для Приход/Расход — тип фиксирован пропсом (без переключателя внутри),
// это и есть разделение на отдельные страницы. Общая механика (фильтры, история,
// пагинация, CSV, разбивка по категориям) вынесена сюда, чтобы не дублировать её дважды —
// отличаются только состав полей формы и набор категорий.
const TransactionTypePage: React.FC<TransactionTypePageProps> = ({
  type, transactions, clients, rentals, staff, investors, cars, onAddTransaction, onBack
}) => {
  const isIncome = type === TransactionType.INCOME;
  const theme = isIncome
    ? { accent: 'emerald', label: 'Приход', verb: 'прихода', icon: 'fa-arrow-down', sign: '+' }
    : { accent: 'rose', label: 'Расход', verb: 'расхода', icon: 'fa-arrow-up', sign: '−' };

  const [justAdded, setJustAdded] = useState(false);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [customCategory, setCustomCategory] = useState('');
  const [searchClient, setSearchClient] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedInvestorId, setSelectedInvestorId] = useState('');
  const [selectedCarId, setSelectedCarId] = useState('');
  const [selectedStaffId, setSelectedStaffId] = useState('');
  const [showClientList, setShowClientList] = useState(false);

  const [period, setPeriod] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'ALL'>('MONTH');
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);

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

  const typeTransactions = useMemo(() => transactions.filter(t => t.type === type), [transactions, type]);

  const periodTransactions = useMemo(
    () => typeTransactions.filter(t => !periodStart || dateOnly(t.date) >= periodStart),
    [typeTransactions, periodStart]
  );

  const total = useMemo(() => periodTransactions.reduce((a, t) => a + t.amount, 0), [periodTransactions]);
  const avg = periodTransactions.length > 0 ? Math.round(total / periodTransactions.length) : 0;

  const categoryBreakdown = useMemo(() => {
    const map = new Map<string, number>();
    periodTransactions.forEach(t => {
      const key = t.category || 'Без категории';
      map.set(key, (map.get(key) || 0) + t.amount);
    });
    const sorted = Array.from(map.entries()).sort((a, b) => b[1] - a[1]);
    const top = sorted.slice(0, 5);
    const restTotal = sorted.slice(5).reduce((a, [, v]) => a + v, 0);
    if (restTotal > 0) top.push(['Остальное', restTotal]);
    const max = top.length > 0 ? top[0][1] : 0;
    return top.map(([category, amount]) => ({ category, amount, pct: max > 0 ? Math.round((amount / max) * 100) : 0, share: total > 0 ? Math.round((amount / total) * 100) : 0 }));
  }, [periodTransactions, total]);

  const visibleTransactions = useMemo(() => {
    const q = search.trim().toLowerCase();
    return periodTransactions
      .filter(t => !q || `${t.description || ''} ${t.category || ''}`.toLowerCase().includes(q))
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [periodTransactions, search]);

  const pagedTransactions = useMemo(
    () => visibleTransactions.slice((page - 1) * pageSize, page * pageSize),
    [visibleTransactions, page, pageSize]
  );

  useEffect(() => { setPage(1); }, [period, search, pageSize]);

  const exportCsv = () => {
    const rows = [
      ['Дата', 'Категория', 'Описание', 'Сумма'],
      ...visibleTransactions.map(t => [
        new Date(t.date).toLocaleDateString('ru-RU'),
        t.category || '',
        (t.description || '').replace(/"/g, '""'),
        String(t.amount)
      ])
    ];
    const csv = rows.map(r => r.map(cell => `"${cell}"`).join(';')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `${isIncome ? 'prihod' : 'rashod'}-${todayStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredClients = useMemo(() => {
    if (!searchClient) return clients;
    return clients.filter(c => c.name.toLowerCase().includes(searchClient.toLowerCase()) || c.phone.includes(searchClient));
  }, [clients, searchClient]);

  const clientDebtRentals = useMemo(() => {
    if (!selectedClientId) return [];
    return rentals.filter(r => r.clientId === selectedClientId && r.paymentStatus === 'DEBT');
  }, [rentals, selectedClientId]);

  const resetFormState = () => {
    setSelectedClientId(''); setSearchClient(''); setSelectedCategory(''); setCustomCategory('');
    setSelectedInvestorId(''); setSelectedCarId(''); setSelectedStaffId(''); setShowClientList(false);
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get('amount'));
    const enteredDate = (fd.get('date') as string) || todayStr;

    let description = (fd.get('description') as string) || '';
    let invId = '';
    let staffId = '';
    let category = (fd.get('category') || selectedCategory) as string;
    let carId = selectedCarId;

    if (!isIncome) {
      if (selectedCategory === 'Оклад') {
        const staffMember = staff.find(s => s.id === selectedStaffId);
        if (staffMember) {
          description = `Зарплата: ${staffMember.name}${description ? ' - ' + description : ''}`;
          staffId = staffMember.id;
        }
      } else if (selectedCategory === 'Инвестиции') {
        const investor = investors.find(i => i.id === selectedInvestorId);
        if (investor) {
          description = `Выплата инвестору: ${investor.name}${description ? ' - ' + description : ''}`;
          invId = investor.id;
        }
      }
      if (CAR_RELATED_EXPENSE_CATEGORIES.includes(selectedCategory) && selectedCarId) {
        const car = cars.find(c => c.id === selectedCarId);
        if (car) description = `${description ? description + ' | ' : ''}${car.brand} ${car.model} (${car.plate})`;
      }
    } else if (selectedCategory === 'Прочее' && customCategory.trim()) {
      category = customCategory.trim();
    }

    onAddTransaction({
      amount,
      type,
      category,
      description,
      // Полдень выбранной даты — чтобы конвертация в UTC при сохранении не сдвинула
      // календарную дату при отображении (важно у границ суток по МСК).
      date: new Date(`${enteredDate}T12:00:00`).toISOString(),
      investorId: invId || undefined,
      carId: carId || undefined,
      staffId: staffId || undefined
    }, selectedClientId || undefined);

    e.currentTarget.reset();
    resetFormState();
    setJustAdded(true);
    setTimeout(() => setJustAdded(false), 2500);
  };

  const iconBg = isIncome ? 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' : 'bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400';
  const accentText = isIncome ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400';
  const accentBar = isIncome ? 'bg-emerald-500' : 'bg-rose-500';
  const btnBg = isIncome ? 'bg-emerald-600 hover:bg-emerald-700' : 'bg-rose-600 hover:bg-rose-700';

  return (
    <div className="space-y-5 animate-fadeIn pb-24 md:pb-0">
      <div className="flex items-center gap-3">
        <button onClick={onBack} className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm text-slate-500 dark:text-slate-400 flex items-center justify-center hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-100 dark:hover:border-blue-500/30 transition-all">
          <i className="fas fa-arrow-left"></i>
        </button>
        <div className={`w-10 h-10 rounded-2xl flex items-center justify-center ${iconBg}`}>
          <i className={`fas ${theme.icon}`}></i>
        </div>
        <h2 className="text-3xl font-semibold text-slate-900 dark:text-white flex-1">{theme.label}</h2>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-6 relative">
        <form onSubmit={handleSubmit}>
          <div className="flex items-center justify-between mb-6">
            <h3 className="text-xl font-semibold text-slate-900 dark:text-white">Новый {theme.verb === 'прихода' ? 'приход' : 'расход'}</h3>
            {justAdded && (
              <span className={`text-xs font-semibold flex items-center gap-1.5 animate-fadeIn ${accentText}`}>
                <i className="fas fa-check-circle"></i> Операция добавлена
              </span>
            )}
          </div>

          <div className="space-y-5 mb-8">
            {isIncome && (
              <div className="relative">
                <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide ml-2 mb-1 block">Клиент (необязательно)</label>
                <div
                  onClick={() => setShowClientList(true)}
                  className="w-full p-5 bg-slate-50 dark:bg-slate-700 rounded-2xl font-bold border-2 border-transparent cursor-pointer flex justify-between items-center hover:bg-slate-100 dark:hover:bg-slate-700 transition-all text-slate-700 dark:text-slate-200"
                >
                  <span className={searchClient ? 'text-slate-900 dark:text-white' : 'text-slate-400 dark:text-slate-500'}>
                    {searchClient || 'Нажмите для выбора клиента'}
                  </span>
                  <i className="fas fa-search text-slate-300 dark:text-slate-600"></i>
                </div>

                {showClientList && (
                  <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                    <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-8 shadow-md animate-scaleIn flex flex-col max-h-[80vh]">
                      <div className="flex justify-between items-center mb-6">
                        <h4 className="font-semibold text-slate-900 dark:text-white uppercase tracking-tight text-xl">Выбор клиента</h4>
                        <button type="button" onClick={() => setShowClientList(false)} className="w-10 h-10 flex items-center justify-center text-slate-400 dark:text-slate-500 hover:bg-slate-50 dark:hover:bg-slate-700 rounded-full">
                          <i className="fas fa-times"></i>
                        </button>
                      </div>
                      <input
                        autoFocus
                        placeholder="Поиск..."
                        className="w-full p-4 bg-slate-50 dark:bg-slate-700 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500 mb-4"
                        value={searchClient}
                        onChange={e => setSearchClient(e.target.value)}
                      />
                      <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                        {filteredClients.map(c => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => { setSelectedClientId(c.id); setSearchClient(c.name); setShowClientList(false); }}
                            className="w-full text-left p-4 hover:bg-blue-600 hover:text-white rounded-2xl font-bold transition-all group"
                          >
                            <div className="text-slate-900 dark:text-white group-hover:text-white font-bold">{c.name}</div>
                            <div className="text-[10px] text-slate-400 dark:text-slate-500 group-hover:text-white/70 uppercase">{c.phone}</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide ml-2 mb-1 block">Сумма (₽)</label>
                <input name="amount" type="number" required placeholder="0" className="w-full p-5 bg-slate-50 dark:bg-slate-700 rounded-2xl font-bold text-2xl text-slate-900 dark:text-white outline-none border-2 border-transparent focus:border-blue-500" />
              </div>
              <div>
                <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide ml-2 mb-1 block">Дата</label>
                <input name="date" type="date" required defaultValue={todayStr} max={todayStr} className="w-full p-5 bg-slate-50 dark:bg-slate-700 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500 text-slate-900 dark:text-white" />
              </div>
            </div>

            <div>
              <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide ml-2 mb-1 block">Категория</label>
              {isIncome && selectedClientId && clientDebtRentals.length > 0 ? (
                <select name="category" required className="w-full p-5 bg-slate-50 dark:bg-slate-700 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500 appearance-none text-slate-900 dark:text-white">
                  <option value="">-- Оплата долга по договору --</option>
                  {clientDebtRentals.map(r => (
                    <option key={r.id} value={`Аренда ${r.contractNumber}`}>Погасить долг: дог. {r.contractNumber}</option>
                  ))}
                  <option value="Прочее">Прочее / Бонус</option>
                </select>
              ) : (
                <select
                  name="category"
                  required
                  value={selectedCategory}
                  onChange={(e) => { setSelectedCategory(e.target.value); setSelectedCarId(''); }}
                  className="w-full p-5 bg-slate-50 dark:bg-slate-700 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500 appearance-none text-slate-900 dark:text-white"
                >
                  <option value="">-- Выберите категорию --</option>
                  {(isIncome ? INCOME_CATEGORIES : EXPENSE_CATEGORIES).map(cat => <option key={cat} value={cat}>{cat}</option>)}
                </select>
              )}
            </div>

            {isIncome && selectedCategory === 'Прочее' && (
              <div className="animate-slideDown">
                <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide ml-2 mb-1 block">Уточните категорию (необязательно)</label>
                <input
                  value={customCategory}
                  onChange={e => setCustomCategory(e.target.value)}
                  placeholder="Напр. Продажа шин"
                  className="w-full p-5 bg-slate-50 dark:bg-slate-700 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500"
                />
              </div>
            )}

            {!isIncome && (
              <>
                {selectedCategory === 'Оклад' && (
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide ml-2 mb-1 block">Сотрудник</label>
                    <select
                      value={selectedStaffId}
                      onChange={(e) => setSelectedStaffId(e.target.value)}
                      required
                      className="w-full p-5 bg-slate-50 dark:bg-slate-700 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500 appearance-none text-slate-900 dark:text-white"
                    >
                      <option value="">-- Выберите сотрудника --</option>
                      {staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                  </div>
                )}

                {selectedCategory === 'Инвестиции' && (
                  <div>
                    <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide ml-2 mb-1 block">Инвестор</label>
                    <select
                      value={selectedInvestorId}
                      onChange={(e) => setSelectedInvestorId(e.target.value)}
                      required
                      className="w-full p-5 bg-slate-50 dark:bg-slate-700 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500 appearance-none text-slate-900 dark:text-white"
                    >
                      <option value="">-- Выберите инвестора --</option>
                      {investors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                    </select>
                  </div>
                )}

                {CAR_RELATED_EXPENSE_CATEGORIES.includes(selectedCategory) && (
                  <div className="animate-slideDown">
                    <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide ml-2 mb-1 block">Выберите автомобиль</label>
                    <select
                      value={selectedCarId}
                      onChange={(e) => setSelectedCarId(e.target.value)}
                      required
                      className="w-full p-5 bg-slate-50 dark:bg-slate-700 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500 appearance-none text-slate-900 dark:text-white"
                    >
                      <option value="">-- Выберите авто --</option>
                      {cars.map(c => <option key={c.id} value={c.id}>{c.brand} {c.model} ({c.plate})</option>)}
                    </select>
                    <div className="mt-2 ml-2 text-[10px] text-blue-500 dark:text-blue-400 font-bold">
                      <i className="fas fa-info-circle mr-1"></i>
                      Расход будет учтён в отчёте по выбранному авто.
                    </div>
                  </div>
                )}
              </>
            )}

            <div>
              <label className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide ml-2 mb-1 block">Описание (необязательно)</label>
              <input name="description" placeholder="Детали для истории" className="w-full p-5 bg-slate-50 dark:bg-slate-700 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
            </div>
          </div>

          <button type="submit" className={`w-full py-5 text-white rounded-xl font-semibold text-lg shadow-md transition-all active:scale-[0.98] ${btnBg}`}>
            Провести {theme.verb === 'прихода' ? 'приход' : 'расход'}
          </button>
        </form>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
          <div className={`text-[10px] font-semibold uppercase tracking-wide ${accentText}`}>Итого {periodLabels[period]}</div>
          <div className={`text-2xl font-bold mt-1 ${accentText}`}>{theme.sign}{total.toLocaleString()} ₽</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700">
          <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Операций</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{periodTransactions.length}</div>
        </div>
        <div className="bg-white dark:bg-slate-800 p-4 rounded-2xl border border-slate-100 dark:border-slate-700 col-span-2 md:col-span-1">
          <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide">Средний чек</div>
          <div className="text-2xl font-bold text-slate-900 dark:text-white mt-1">{avg.toLocaleString()} ₽</div>
        </div>
      </div>

      {categoryBreakdown.length > 0 && (
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm p-4 md:p-5">
          <h3 className="text-sm font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide mb-4">По категориям — {periodLabels[period]}</h3>
          <div className="space-y-3">
            {categoryBreakdown.map(c => (
              <div key={c.category}>
                <div className="flex justify-between items-baseline text-xs mb-1">
                  <span className="font-semibold text-slate-700 dark:text-slate-200">{c.category}</span>
                  <span className="text-slate-400 dark:text-slate-500 font-medium">{c.amount.toLocaleString()} ₽ · {c.share}%</span>
                </div>
                <div className="h-2 bg-slate-100 dark:bg-slate-700 rounded-full overflow-hidden">
                  <div className={`h-full rounded-full ${accentBar}`} style={{ width: `${Math.max(c.pct, 4)}%` }}></div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 dark:border-slate-700 space-y-3">
          <div className="flex justify-between items-center gap-3 flex-wrap">
            <h3 className="text-lg font-semibold text-slate-800 dark:text-slate-100">
              История
              <span className="ml-2 text-xs font-medium text-slate-400 dark:text-slate-500">{visibleTransactions.length}</span>
            </h3>
            <button
              onClick={exportCsv}
              disabled={visibleTransactions.length === 0}
              className="text-blue-600 dark:text-blue-400 font-semibold text-xs uppercase tracking-wide hover:bg-blue-50 dark:hover:bg-blue-500/10 px-3 py-2 rounded-xl transition-all disabled:opacity-40"
            >
              <i className="fas fa-file-arrow-down mr-1.5"></i>Экспорт в CSV
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {([['TODAY', 'Сегодня'], ['WEEK', '7 дней'], ['MONTH', '30 дней'], ['ALL', 'Всё время']] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setPeriod(id)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                  period === id ? 'bg-slate-800 text-white' : 'bg-slate-50 dark:bg-slate-700 text-slate-400 dark:text-slate-500 hover:text-slate-600 dark:hover:text-slate-300'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative">
            <i className="fas fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 dark:text-slate-600 text-xs"></i>
            <input
              value={search}
              onChange={e => setSearch(e.target.value)}
              placeholder="Поиск по описанию или категории"
              className="w-full pl-9 pr-3 py-2 bg-slate-50 dark:bg-slate-700 rounded-xl text-sm font-medium outline-none border-2 border-transparent focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        <div className="divide-y divide-slate-50 dark:divide-slate-800">
          {pagedTransactions.map(t => (
            <div key={t.id} className="px-4 py-3 hover:bg-slate-50/50 dark:hover:bg-slate-700 transition-colors flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${iconBg}`}>
                <i className={`fas ${theme.icon} text-xs`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 dark:text-white text-sm truncate">
                  {t.description || <span className="text-slate-300 dark:text-slate-600 italic font-medium">Без описания</span>}
                </div>
                <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">
                  {new Date(t.date).toLocaleDateString('ru-RU')} • {t.category}
                </div>
              </div>
              <div className={`font-bold flex-shrink-0 ${accentText}`}>
                {theme.sign}{t.amount.toLocaleString()} ₽
              </div>
            </div>
          ))}
          {visibleTransactions.length === 0 && (
            <div className="p-12 text-center">
              <i className={`fas ${theme.icon} text-3xl text-slate-200 dark:text-slate-700 mb-3`}></i>
              <div className="font-semibold text-slate-500 dark:text-slate-400">
                {search ? 'Ничего не найдено' : `Нет операций ${periodLabels[period]}`}
              </div>
            </div>
          )}
        </div>

        <Pagination
          page={page}
          pageSize={pageSize}
          totalItems={visibleTransactions.length}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

    </div>
  );
};

export default TransactionTypePage;
