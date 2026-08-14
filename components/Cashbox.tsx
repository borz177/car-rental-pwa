
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

  const balance = transactions.reduce((acc, t) =>
    t.type === TransactionType.INCOME ? acc + t.amount : acc - t.amount, 0
  );
  const incomeMonth = transactions.filter(t => t.type === TransactionType.INCOME).reduce((acc, t) => acc + t.amount, 0);
  const expensesMonth = transactions.filter(t => t.type === TransactionType.EXPENSE).reduce((acc, t) => acc + t.amount, 0);

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

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-slate-900 p-5 rounded-2xl text-white shadow-md relative overflow-hidden">
          <div className="relative z-10">
            <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-2">Общий баланс</div>
            <div className="text-4xl font-bold">{balance.toLocaleString()} ₽</div>
          </div>
          <i className="fas fa-coins absolute -right-6 -bottom-6 text-7xl text-white/5 rotate-12"></i>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="text-xs font-semibold text-emerald-500 uppercase tracking-wide mb-2">Доход (мес)</div>
          <div className="text-4xl font-bold text-emerald-600">+{incomeMonth.toLocaleString()} ₽</div>
        </div>
        <div className="bg-white p-5 rounded-2xl border border-slate-100 shadow-sm">
          <div className="text-xs font-semibold text-rose-500 uppercase tracking-wide mb-2">Расход (мес)</div>
          <div className="text-4xl font-bold text-rose-600">-{expensesMonth.toLocaleString()} ₽</div>
        </div>
      </div>

      <div className="bg-white rounded-2xl border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-5 border-b border-slate-50 flex justify-between items-center bg-slate-50/30">
          <h3 className="text-xl font-semibold text-slate-800">История транзакций</h3>
          <button className="text-blue-600 font-bold text-sm hover:bg-blue-50 px-4 py-2 rounded-xl transition-all">Экспорт в CSV</button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-8 py-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Дата</th>
                <th className="px-8 py-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Описание</th>
                <th className="px-8 py-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Категория</th>
                <th className="px-8 py-4 text-[10px] font-semibold text-slate-400 uppercase tracking-wide text-right">Сумма</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {transactions.sort((a,b) => new Date(b.date).getTime() - new Date(a.date).getTime()).map(t => (
                <tr key={t.id} className="hover:bg-slate-50/50 transition-all group">
                  <td className="px-8 py-5 text-sm text-slate-400 font-medium">{new Date(t.date).toLocaleDateString()}</td>
                  <td className="px-8 py-5">
                    <div className="font-bold text-slate-900">{t.description || <span className="text-slate-300 italic font-medium">Без описания</span>}</div>
                  </td>
                  <td className="px-8 py-5">
                    <span className={`px-4 py-1.5 rounded-xl text-[10px] font-semibold uppercase tracking-tight ${
                      t.type === TransactionType.INCOME ? 'bg-emerald-50 text-emerald-700' : 
                      t.type === TransactionType.EXPENSE ? 'bg-rose-50 text-rose-700' : 'bg-indigo-50 text-indigo-700'
                    }`}>
                      {t.category}
                    </span>
                  </td>
                  <td className={`px-8 py-5 text-right font-bold text-xl ${
                    t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-rose-600'
                  }`}>
                    {t.type === TransactionType.INCOME ? '+' : '-'}{t.amount.toLocaleString()} ₽
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
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
