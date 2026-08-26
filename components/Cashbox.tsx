
import React, { useState, useMemo } from 'react';
import { Transaction, TransactionType, Client, Rental, User, Investor, Car, Staff } from '../types';

interface CashboxProps {
  transactions: Transaction[];
  clients: Client[];
  rentals: Rental[];
  // Fix: Changed staff prop to Staff[] to align with new type definition
  staff: Staff[];
  investors: Investor[];
  cars: Car[];
  onAddTransaction: (t: Partial<Transaction>, clientId?: string) => void;
}

const Cashbox: React.FC<CashboxProps> = ({ transactions, clients, rentals, staff, investors, cars, onAddTransaction }) => {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [txType, setTxType] = useState<TransactionType>(TransactionType.INCOME);
  const [selectedCategory, setSelectedCategory] = useState('');
  const [searchClient, setSearchClient] = useState('');
  const [selectedClientId, setSelectedClientId] = useState('');
  const [selectedInvestorId, setSelectedInvestorId] = useState('');
  const [selectedCarId, setSelectedCarId] = useState('');
  const [showClientList, setShowClientList] = useState(false);

  // Фильтры истории
  const [period, setPeriod] = useState<'TODAY' | 'WEEK' | 'MONTH' | 'ALL'>('MONTH');
  const [typeFilter, setTypeFilter] = useState<'ALL' | TransactionType>('ALL');
  const [historySearch, setHistorySearch] = useState('');

  const dateOnly = (v: string) => String(v).split('T')[0];
  const todayStr = new Date().toLocaleDateString('en-CA', { timeZone: 'Europe/Moscow' });

  const periodStart = useMemo(() => {
    if (period === 'ALL') return '';
    if (period === 'TODAY') return todayStr;
    const d = new Date(todayStr);
    d.setDate(d.getDate() - (period === 'WEEK' ? 6 : 29));
    return d.toLocaleDateString('en-CA');
  }, [period, todayStr]);

  const periodTransactions = useMemo(
    () => transactions.filter(t => !periodStart || dateOnly(t.date) >= periodStart),
    [transactions, periodStart]
  );

  // Баланс — по всей истории: это остаток кассы, он не зависит от выбранного периода.
  const balance = useMemo(() => transactions.reduce((acc, t) =>
    t.type === TransactionType.INCOME ? acc + t.amount : acc - t.amount, 0
  ), [transactions]);

  // Раньше эти суммы были подписаны «(мес)», но считались по всем транзакциям
  // за всё время — цифра не имела отношения к месяцу.
  const periodIncome = useMemo(
    () => periodTransactions.filter(t => t.type === TransactionType.INCOME).reduce((a, t) => a + t.amount, 0),
    [periodTransactions]
  );
  const periodExpenses = useMemo(
    () => periodTransactions.filter(t => t.type === TransactionType.EXPENSE).reduce((a, t) => a + t.amount, 0),
    [periodTransactions]
  );

  const visibleTransactions = useMemo(() => {
    const q = historySearch.trim().toLowerCase();
    return periodTransactions
      .filter(t => typeFilter === 'ALL' || t.type === typeFilter)
      .filter(t => !q || `${t.description || ''} ${t.category || ''}`.toLowerCase().includes(q))
      // Копия перед сортировкой: sort меняет массив на месте, а это пропс из состояния App.
      .slice()
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [periodTransactions, typeFilter, historySearch]);

  const periodLabels = { TODAY: 'сегодня', WEEK: 'за 7 дней', MONTH: 'за 30 дней', ALL: 'за всё время' };

  const exportCsv = () => {
    const rows = [
      ['Дата', 'Тип', 'Категория', 'Описание', 'Сумма'],
      ...visibleTransactions.map(t => [
        new Date(t.date).toLocaleDateString('ru-RU'),
        t.type,
        t.category || '',
        (t.description || '').replace(/"/g, '""'),
        String(t.amount)
      ])
    ];
    const csv = rows.map(r => r.map(cell => `"${cell}"`).join(';')).join('\r\n');
    // BOM, чтобы Excel открыл кириллицу без разбора кодировки
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `kassa-${todayStr}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const filteredClients = useMemo(() => {
    if (!searchClient) return clients;
    return clients.filter(c =>
      c.name.toLowerCase().includes(searchClient.toLowerCase()) ||
      c.phone.includes(searchClient)
    );
  }, [clients, searchClient]);

  const clientDebtRentals = useMemo(() => {
    if (!selectedClientId) return [];
    // Show rentals that are marked as DEBT to let user pay them off
    return rentals.filter(r => r.clientId === selectedClientId && r.paymentStatus === 'DEBT');
  }, [rentals, selectedClientId]);

  // Categories that require a car selection
  const carRelatedCategories = ['Мойка', 'Ремонт', 'Замена масла'];

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const fd = new FormData(e.currentTarget);
    const amount = Number(fd.get('amount'));

    let description = (fd.get('description') as string) || '';
    let invId = '';
    let category = (fd.get('category') || selectedCategory) as string;
    let carId = selectedCarId;

    if (txType === TransactionType.EXPENSE) {
      if (selectedCategory === 'Оклад') {
        const staffName = fd.get('staff_name');
        if (staffName) description = `Зарплата: ${staffName}${description ? ' - ' + description : ''}`;
      } else if (selectedCategory === 'Инвестиции') {
        const investor = investors.find(i => i.id === selectedInvestorId);
        if (investor) {
          description = `Выплата инвестору: ${investor.name}${description ? ' - ' + description : ''}`;
          invId = investor.id;
        }
      }

      // Add car info to description if selected
      if (carRelatedCategories.includes(selectedCategory) && selectedCarId) {
         const car = cars.find(c => c.id === selectedCarId);
         if (car) description = `${description ? description + ' | ' : ''}${car.brand} ${car.model} (${car.plate})`;
      }
    }

    onAddTransaction({
      amount,
      type: txType,
      category: category,
      description: description,
      date: new Date().toISOString(),
      investorId: invId || undefined,
      carId: carId || undefined // Link transaction to car for reports
    }, selectedClientId || undefined);

    setIsModalOpen(false);
    setSelectedClientId('');
    setSelectedInvestorId('');
    setSelectedCarId('');
    setSearchClient('');
    setSelectedCategory('');
    setShowClientList(false);
  };

  const expenseCategories = ['Мойка', 'Ремонт', 'Замена масла', 'Оклад', 'Инвестиции', 'Аренда', 'Прочее'];

  return (
    <div className="space-y-5 animate-fadeIn">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-3xl font-semibold text-slate-900">Касса и финансы</h2>
        <button
          onClick={() => setIsModalOpen(true)}
          className="w-full md:w-auto bg-blue-600 text-white px-8 py-4 rounded-2xl font-semibold hover:bg-blue-700 shadow-md transition-all flex items-center justify-center space-x-2"
        >
          <i className="fas fa-plus"></i>
          <span>Создать операцию</span>
        </button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
        <div className="bg-slate-900 p-4 rounded-2xl text-white relative overflow-hidden">
          <div className="relative z-10">
            <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Баланс кассы</div>
            <div className="text-2xl font-bold mt-1">{balance.toLocaleString()} ₽</div>
            <div className="text-[10px] font-medium text-slate-500 mt-0.5">за всё время</div>
          </div>
          <i className="fas fa-coins absolute -right-5 -bottom-5 text-6xl text-white/5 rotate-12"></i>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100">
          <div className="text-[10px] font-semibold text-emerald-500 uppercase tracking-wide">Доход</div>
          <div className="text-2xl font-bold text-emerald-600 mt-1">+{periodIncome.toLocaleString()} ₽</div>
          <div className="text-[10px] font-medium text-slate-400 mt-0.5">{periodLabels[period]}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100">
          <div className="text-[10px] font-semibold text-rose-500 uppercase tracking-wide">Расход</div>
          <div className="text-2xl font-bold text-rose-600 mt-1">-{periodExpenses.toLocaleString()} ₽</div>
          <div className="text-[10px] font-medium text-slate-400 mt-0.5">{periodLabels[period]}</div>
        </div>
        <div className="bg-white p-4 rounded-2xl border border-slate-100">
          <div className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Прибыль</div>
          <div className={`text-2xl font-bold mt-1 ${periodIncome - periodExpenses >= 0 ? 'text-slate-900' : 'text-rose-600'}`}>
            {(periodIncome - periodExpenses).toLocaleString()} ₽
          </div>
          <div className="text-[10px] font-medium text-slate-400 mt-0.5">{periodLabels[period]}</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-4 border-b border-slate-100 space-y-3">
          <div className="flex justify-between items-center gap-3 flex-wrap">
            <h3 className="text-lg font-semibold text-slate-800">
              История операций
              <span className="ml-2 text-xs font-medium text-slate-400">{visibleTransactions.length}</span>
            </h3>
            <button
              onClick={exportCsv}
              disabled={visibleTransactions.length === 0}
              className="text-blue-600 font-semibold text-xs uppercase tracking-wide hover:bg-blue-50 px-3 py-2 rounded-xl transition-all disabled:opacity-40"
            >
              <i className="fas fa-file-arrow-down mr-1.5"></i>Экспорт в CSV
            </button>
          </div>

          <div className="flex flex-wrap gap-2">
            {([['TODAY','Сегодня'],['WEEK','7 дней'],['MONTH','30 дней'],['ALL','Всё время']] as const).map(([id, label]) => (
              <button
                key={id}
                onClick={() => setPeriod(id)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                  period === id ? 'bg-slate-800 text-white' : 'bg-slate-50 text-slate-400 hover:text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
            <span className="w-px bg-slate-200 mx-1"></span>
            {([['ALL','Все'],[TransactionType.INCOME,'Доходы'],[TransactionType.EXPENSE,'Расходы']] as const).map(([id, label]) => (
              <button
                key={String(id)}
                onClick={() => setTypeFilter(id as any)}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-semibold uppercase tracking-wide transition-colors ${
                  typeFilter === id ? 'bg-blue-600 text-white' : 'bg-slate-50 text-slate-400 hover:text-slate-600'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          <div className="relative">
            <i className="fas fa-magnifying-glass absolute left-3 top-1/2 -translate-y-1/2 text-slate-300 text-xs"></i>
            <input
              value={historySearch}
              onChange={e => setHistorySearch(e.target.value)}
              placeholder="Поиск по описанию или категории"
              className="w-full pl-9 pr-3 py-2 bg-slate-50 rounded-xl text-sm font-medium outline-none border-2 border-transparent focus:border-blue-500 transition-all"
            />
          </div>
        </div>

        <div className="divide-y divide-slate-50">
          {visibleTransactions.map(t => (
            <div key={t.id} className="px-4 py-3 hover:bg-slate-50/50 transition-colors flex items-center gap-3">
              <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                t.type === TransactionType.INCOME ? 'bg-emerald-100 text-emerald-600' : 'bg-rose-100 text-rose-600'
              }`}>
                <i className={`fas ${t.type === TransactionType.INCOME ? 'fa-arrow-down' : 'fa-arrow-up'} text-xs`}></i>
              </div>
              <div className="flex-1 min-w-0">
                <div className="font-semibold text-slate-900 text-sm truncate">
                  {t.description || <span className="text-slate-300 italic font-medium">Без описания</span>}
                </div>
                <div className="text-[11px] text-slate-400 font-medium">
                  {new Date(t.date).toLocaleDateString('ru-RU')} • {t.category}
                </div>
              </div>
              <div className={`font-bold flex-shrink-0 ${
                t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-rose-600'
              }`}>
                {t.type === TransactionType.INCOME ? '+' : '−'}{t.amount.toLocaleString()} ₽
              </div>
            </div>
          ))}
          {visibleTransactions.length === 0 && (
            <div className="p-12 text-center">
              <i className="fas fa-receipt text-3xl text-slate-200 mb-3"></i>
              <div className="font-semibold text-slate-500">
                {historySearch || typeFilter !== 'ALL' ? 'Ничего не найдено' : `Нет операций ${periodLabels[period]}`}
              </div>
            </div>
          )}
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-[80] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md overflow-y-auto">
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl w-full max-w-lg p-6 shadow-md animate-scaleIn relative">
            <button
              type="button"
              onClick={() => setIsModalOpen(false)}
              className="absolute top-8 right-8 w-10 h-10 flex items-center justify-center text-slate-300 hover:text-slate-900 bg-slate-50 rounded-full transition-all"
            >
              <i className="fas fa-times"></i>
            </button>

            <h2 className="text-2xl font-semibold text-slate-900 mb-8">Новая операция</h2>

            <div className="grid grid-cols-2 gap-2 p-1.5 bg-slate-100 rounded-xl mb-8">
              <button
                type="button"
                onClick={() => { setTxType(TransactionType.INCOME); setSelectedClientId(''); setSearchClient(''); setSelectedCategory(''); setSelectedCarId(''); }}
                className={`py-3.5 rounded-xl font-semibold text-xs uppercase transition-all ${txType === TransactionType.INCOME ? 'bg-white shadow-md text-emerald-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Приход
              </button>
              <button
                type="button"
                onClick={() => { setTxType(TransactionType.EXPENSE); setSelectedClientId(''); setSearchClient(''); setSelectedCategory(''); setSelectedCarId(''); }}
                className={`py-3.5 rounded-xl font-semibold text-xs uppercase transition-all ${txType === TransactionType.EXPENSE ? 'bg-white shadow-md text-rose-600' : 'text-slate-400 hover:text-slate-600'}`}
              >
                Расход
              </button>
            </div>

            <div className="space-y-5 mb-10">
              {txType === TransactionType.INCOME && (
                <div className="relative">
                  <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-2 mb-1 block">Клиент (поиск по списку)</label>
                  <div
                    onClick={() => setShowClientList(true)}
                    className="w-full p-5 bg-slate-50 rounded-2xl font-bold border-2 border-transparent cursor-pointer flex justify-between items-center hover:bg-slate-100 transition-all text-slate-700"
                  >
                    <span className={searchClient ? 'text-slate-900' : 'text-slate-400'}>
                      {searchClient || 'Нажмите для выбора клиента'}
                    </span>
                    <i className="fas fa-search text-slate-300"></i>
                  </div>

                  {showClientList && (
                    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/40 backdrop-blur-sm">
                      <div className="bg-white rounded-2xl w-full max-w-md p-8 shadow-md animate-scaleIn flex flex-col max-h-[80vh]">
                        <div className="flex justify-between items-center mb-6">
                          <h4 className="font-semibold text-slate-900 uppercase tracking-tight text-xl">Выбор клиента</h4>
                          <button type="button" onClick={() => setShowClientList(false)} className="w-10 h-10 flex items-center justify-center text-slate-400 hover:bg-slate-50 rounded-full">
                            <i className="fas fa-times"></i>
                          </button>
                        </div>
                        <input
                          autoFocus
                          placeholder="Поиск..."
                          className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500 mb-4"
                          value={searchClient}
                          onChange={e => setSearchClient(e.target.value)}
                        />
                        <div className="flex-1 overflow-y-auto space-y-2 pr-2 custom-scrollbar">
                          {filteredClients.map(c => (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => {
                                setSelectedClientId(c.id);
                                setSearchClient(c.name);
                                setShowClientList(false);
                              }}
                              className="w-full text-left p-4 hover:bg-blue-600 hover:text-white rounded-2xl font-bold transition-all group"
                            >
                              <div className="text-slate-900 group-hover:text-white font-bold">{c.name}</div>
                              <div className="text-[10px] text-slate-400 group-hover:text-white/70 uppercase">{c.phone}</div>
                            </button>
                          ))}
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              )}

              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-2 mb-1 block">Сумма (₽)</label>
                <input name="amount" type="number" required placeholder="0" className="w-full p-5 bg-slate-50 rounded-2xl font-bold text-3xl text-slate-900 outline-none border-2 border-transparent focus:border-blue-500" />
              </div>

              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-2 mb-1 block">Категория</label>
                {txType === TransactionType.INCOME ? (
                  selectedClientId && clientDebtRentals.length > 0 ? (
                    <select name="category" required className="w-full p-5 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500 appearance-none text-slate-900">
                      <option value="">-- Оплата долга по договору --</option>
                      {clientDebtRentals.map(r => (
                        <option key={r.id} value={`Аренда ${r.contractNumber}`}>Погасить долг: дог. {r.contractNumber}</option>
                      ))}
                      <option value="Прочее">Прочее / Бонус</option>
                    </select>
                  ) : (
                    <input name="category" placeholder="Аренда, Бонус и т.д." required className="w-full p-5 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
                  )
                ) : (
                  <select
                    name="category"
                    required
                    value={selectedCategory}
                    onChange={(e) => { setSelectedCategory(e.target.value); setSelectedCarId(''); }}
                    className="w-full p-5 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500 appearance-none text-slate-900"
                  >
                    <option value="">-- Выберите категорию --</option>
                    {expenseCategories.map(cat => <option key={cat} value={cat}>{cat}</option>)}
                  </select>
                )}
              </div>

              {/* Conditional Fields based on Category */}
              {txType === TransactionType.EXPENSE && (
                <>
                  {selectedCategory === 'Оклад' && (
                    <div>
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-2 mb-1 block">Сотрудник</label>
                      <select name="staff_name" required className="w-full p-5 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500 appearance-none text-slate-900">
                        <option value="">-- Выберите сотрудника --</option>
                        {staff.map(s => <option key={s.id} value={s.name}>{s.name}</option>)}
                      </select>
                    </div>
                  )}

                  {selectedCategory === 'Инвестиции' && (
                    <div>
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-2 mb-1 block">Инвестор</label>
                      <select
                        value={selectedInvestorId}
                        onChange={(e) => setSelectedInvestorId(e.target.value)}
                        required
                        className="w-full p-5 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500 appearance-none text-slate-900"
                      >
                        <option value="">-- Выберите инвестора --</option>
                        {investors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
                      </select>
                    </div>
                  )}

                  {/* CAR SELECTION for Maintenance Categories */}
                  {carRelatedCategories.includes(selectedCategory) && (
                    <div className="animate-slideDown">
                      <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-2 mb-1 block">Выберите автомобиль</label>
                      <select
                        value={selectedCarId}
                        onChange={(e) => setSelectedCarId(e.target.value)}
                        required
                        className="w-full p-5 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500 appearance-none text-slate-900"
                      >
                        <option value="">-- Выберите авто --</option>
                        {cars.map(c => <option key={c.id} value={c.id}>{c.brand} {c.model} ({c.plate})</option>)}
                      </select>
                      <div className="mt-2 ml-2 text-[10px] text-blue-500 font-bold">
                        <i className="fas fa-info-circle mr-1"></i>
                        Расход будет учтен в отчете по выбранному авто.
                      </div>
                    </div>
                  )}
                </>
              )}

              <div>
                <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide ml-2 mb-1 block">Описание (необязательно)</label>
                <input name="description" placeholder="Детали для истории" className="w-full p-5 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500" />
              </div>
            </div>

            <button type="submit" className="w-full py-5 bg-blue-600 text-white rounded-xl font-semibold text-lg shadow-md hover:bg-blue-700 transition-all active:scale-[0.98]">
              Провести в кассе
            </button>
          </form>
        </div>
      )}
    </div>
  );
};

export default Cashbox;
