
import React, { useState, useMemo } from 'react';
import { Transaction, Car, Investor, TransactionType, Rental, Client, Staff, Fine, FineStatus } from '../types.ts';
import { PieChart, Pie, Cell, ResponsiveContainer, Tooltip, AreaChart, Area, XAxis, YAxis, CartesianGrid } from 'recharts';
import OperationModal from './OperationModal';

interface ReportsProps {
  transactions: Transaction[];
  cars: Car[];
  investors: Investor[];
  rentals: Rental[];
  clients?: Client[];
  staff?: Staff[];
  fines?: Fine[];
}

type ReportCategory = 'ALL' | 'INVESTORS' | 'CARS' | 'CATEGORIES' | 'CLIENTS' | 'STAFF' | 'FINES';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f43f5e'];

const Reports: React.FC<ReportsProps> = ({ transactions, cars, investors, rentals, clients = [], staff = [], fines = [] }) => {
  const [activeCategory, setActiveCategory] = useState<ReportCategory>('ALL');
  const [selectedOperation, setSelectedOperation] = useState<any | null>(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    searchId: '' 
  });

  const unifiedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions]);

  // УЛУЧШЕННАЯ ФИЛЬТРАЦИЯ
  const filteredData = useMemo(() => {
    if (activeCategory === 'FINES') {
      return fines.filter(f => {
        const date = new Date(f.date);
        const start = filters.startDate ? new Date(filters.startDate) : null;
        const end = filters.endDate ? new Date(filters.endDate) : null;
        if (start && date < start) return false;
        if (end && date > end) return false;
        if (filters.searchId && f.clientId !== filters.searchId) return false;
        return true;
      });
    }

    return unifiedTransactions.filter(t => {
      const date = new Date(t.date);
      const start = filters.startDate ? new Date(filters.startDate) : null;
      const end = filters.endDate ? new Date(filters.endDate) : null;

      // 1. Фильтр по датам
      if (start && date < start) return false;
      if (end && date > end) return false;

      // 2. Глубокая логика категорий
      if (activeCategory === 'INVESTORS') {
        if (filters.searchId) {
          // Ищем транзакции этого инвестора ИЛИ транзакции машин этого инвестора
          const isDirect = t.investorId === filters.searchId;
          const carOfInvestor = t.carId ? cars.find(c => c.id === t.carId)?.investorId === filters.searchId : false;
          if (!isDirect && !carOfInvestor) return false;
        } else {
          // Если инвестор не выбран, показываем только то, что относится хоть к какому-то инвестору
          if (!t.investorId && (!t.carId || !cars.find(c => c.id === t.carId)?.investorId)) return false;
        }
      }

      if (activeCategory === 'CARS') {
        if (filters.searchId) {
          if (t.carId !== filters.searchId) return false;
        } else {
          // Если машина не выбрана, показываем все транзакции, привязанные к ЛЮБЫМ машинам
          if (!t.carId) return false;
        }
      }

      if (activeCategory === 'CLIENTS') {
        if (filters.searchId && t.clientId !== filters.searchId) return false;
        if (!filters.searchId && !t.clientId) return false; // Показываем только клиентские платежи в этом режиме
      }

      if (activeCategory === 'STAFF' && filters.searchId) {
        const staffMember = staff.find(s => s.id === filters.searchId);
        if (staffMember && !t.description.includes(staffMember.name) && t.category !== 'Оклад') return false;
      }

      return true;
    });
  }, [unifiedTransactions, filters, activeCategory, staff, fines, cars]);

  const stats = useMemo(() => {
    if (activeCategory === 'FINES') {
      const total = filteredData.reduce((s, f: any) => s + f.amount, 0);
      const paid = filteredData.filter((f: any) => f.status === FineStatus.PAID).reduce((s, f: any) => s + f.amount, 0);
      return { income: paid, expense: total - paid, profit: paid, label1: 'Оплачено', label2: 'Не оплачено', label3: 'Всего выставлено' };
    }
    const income = filteredData.filter(t => (t as any).type === TransactionType.INCOME).reduce((s, t) => s + (t as any).amount, 0);
    const expense = filteredData.filter(t => (t as any).type === TransactionType.EXPENSE).reduce((s, t) => s + (t as any).amount, 0);
    const payout = filteredData.filter(t => (t as any).type === TransactionType.PAYOUT).reduce((s, t) => s + (t as any).amount, 0);
    return { income, expense: expense + payout, profit: income - (expense + payout), label1: 'Выручка', label2: 'Расходы', label3: 'Чистая прибыль' };
  }, [filteredData, activeCategory]);

  const chartData = useMemo(() => {
    const daily: Record<string, any> = {};
    [...filteredData].reverse().forEach((t: any) => {
      const d = new Date(t.date).toLocaleDateString('ru-RU', { day: '2-digit', month: '2-digit' });
      if (!daily[d]) daily[d] = { name: d, income: 0, expense: 0 };
      if (activeCategory === 'FINES') {
         if (t.status === FineStatus.PAID) daily[d].income += t.amount;
         else daily[d].expense += t.amount;
      } else {
        if (t.type === TransactionType.INCOME) daily[d].income += t.amount;
        else daily[d].expense += t.amount;
      }
    });
    return Object.values(daily);
  }, [filteredData, activeCategory]);

  const pieData = useMemo(() => {
    if (activeCategory === 'FINES') {
      const paid = filteredData.filter((f: any) => f.status === FineStatus.PAID).length;
      const unpaid = filteredData.filter((f: any) => f.status === FineStatus.UNPAID).length;
      return [
        { name: 'Оплачено', value: paid },
        { name: 'Не оплачено', value: unpaid }
      ];
    }
    const map: Record<string, number> = {};
    filteredData.forEach((t: any) => {
      map[t.category] = (map[t.category] || 0) + t.amount;
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredData, activeCategory]);

  const renderHome = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn">
      <ReportCard title="Все транзакции" icon="fa-globe" desc="Полная финансовая картина бизнеса" color="bg-indigo-600" onClick={() => setActiveCategory('ALL')} />
      <ReportCard title="Штрафы" icon="fa-gavel" desc="Контроль ГИБДД и парковок" color="bg-rose-600" onClick={() => { setActiveCategory('FINES'); setFilters(f => ({...f, searchId: ''})); }} />
      <ReportCard title="Инвесторы" icon="fa-handshake" desc="Доходы и выплаты по партнерам" color="bg-amber-500" onClick={() => { setActiveCategory('INVESTORS'); setFilters(f => ({...f, searchId: ''})); }} />
      <ReportCard title="Автопарк" icon="fa-car" desc="Прибыльность конкретных машин" color="bg-blue-500" onClick={() => { setActiveCategory('CARS'); setFilters(f => ({...f, searchId: ''})); }} />
      <ReportCard title="Клиенты (LTV)" icon="fa-users" desc="Ценность клиентов и история оплат" color="bg-emerald-500" onClick={() => { setActiveCategory('CLIENTS'); setFilters(f => ({...f, searchId: ''})); }} />
      <ReportCard title="Категории" icon="fa-tags" desc="Анализ расходов по статьям" color="bg-rose-500" onClick={() => setActiveCategory('CATEGORIES')} />
    </div>
  );

  return (
    <div className="space-y-8 pb-24 md:pb-0 animate-fadeIn">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 flex items-center tracking-tight">
            {activeCategory !== 'ALL' && (
              <button onClick={() => { setActiveCategory('ALL'); setFilters(f => ({...f, searchId: ''})); }} className="mr-4 text-slate-300 hover:text-indigo-600 transition-colors">
                <i className="fas fa-chevron-left text-2xl"></i>
              </button>
            )}
            {
              activeCategory === 'ALL' ? 'Общий финансовый отчет' : 
              activeCategory === 'FINES' ? 'Отчет по штрафам' :
              activeCategory === 'INVESTORS' ? 'Доходы инвесторов' :
              activeCategory === 'CARS' ? 'Рентабельность автопарка' :
              activeCategory === 'CLIENTS' ? 'Аналитика по клиентам' :
              activeCategory === 'STAFF' ? 'Отчет по сотрудникам' : 'Анализ категорий'
            }
          </h2>
          <p className="text-slate-400 font-bold mt-1 uppercase text-[10px] tracking-widest">
            {activeCategory === 'ALL' ? 'Выберите категорию для детального анализа' : 'Используйте фильтры для уточнения данных'}
          </p>
        </div>
      </div>

      {activeCategory !== 'ALL' && (
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-end animate-slideDown">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">С даты</label>
            <input type="date" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="space-y-1">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">По дату</label>
            <input type="date" value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <div className="space-y-1 md:col-span-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Выбор объекта</label>
            <select value={filters.searchId} onChange={e => setFilters({...filters, searchId: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold border-none outline-none focus:ring-2 focus:ring-indigo-500 appearance-none text-slate-900">
              <option value="">Все {
                activeCategory === 'INVESTORS' ? 'инвесторы' : 
                activeCategory === 'CARS' ? 'автомобили' : 
                activeCategory === 'CLIENTS' ? 'клиенты' : 'объекты'
              }</option>
              {(activeCategory === 'INVESTORS') && investors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              {(activeCategory === 'CARS') && cars.map(c => <option key={c.id} value={c.id}>{c.brand} {c.model} ({c.plate})</option>)}
              {(activeCategory === 'CLIENTS' || activeCategory === 'FINES') && clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              {activeCategory === 'STAFF' && staff.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {activeCategory !== 'ALL' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 animate-scaleIn">
          <StatCard title={stats.label1} value={stats.income} color="emerald" icon="fa-arrow-up" />
          <StatCard title={stats.label2} value={stats.expense} color="rose" icon="fa-arrow-down" />
          <StatCard title={stats.label3} value={stats.profit} color="indigo" icon="fa-chart-pie" />
        </div>
      )}

      {activeCategory === 'ALL' ? renderHome() : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-8">
            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm h-[400px]">
              <h3 className="text-xl font-black text-slate-900 mb-6 uppercase tracking-tight">График операций</h3>
              {chartData.length > 0 ? (
                <ResponsiveContainer width="100%" height="90%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorInc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/><stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} />
                    <YAxis axisLine={false} tickLine={false} tick={{fontSize: 10, fontWeight: 'bold', fill: '#94a3b8'}} />
                    <Tooltip contentStyle={{borderRadius: '1rem', border: 'none', boxShadow: '0 10px 15px -3px rgb(0 0 0 / 0.1)'}} />
                    <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorInc)" />
                    <Area type="monotone" dataKey="expense" stroke="#f43f5e" strokeWidth={3} fill="transparent" />
                  </AreaChart>
                </ResponsiveContainer>
              ) : (
                <div className="flex items-center justify-center h-full text-slate-300 font-bold italic">Нет данных для графика</div>
              )}
            </div>

            <div className="bg-white rounded-[3rem] border border-slate-100 shadow-sm overflow-hidden">
              <div className="p-8 border-b border-slate-50 flex justify-between items-center">
                <h3 className="text-xl font-black text-slate-900 uppercase tracking-tight">Транзакции</h3>
                <span className="text-[10px] font-black text-slate-400 uppercase tracking-widest">{filteredData.length} зап.</span>
              </div>
              <div className="divide-y divide-slate-50 max-h-[500px] overflow-y-auto custom-scrollbar">
                {filteredData.map((t: any) => {
                  const isFine = 'status' in t;
                  return (
                    <div key={t.id} 
                      onClick={() => !isFine && setSelectedOperation(t)}
                      className={`p-6 flex items-center justify-between hover:bg-slate-50 transition-all group ${!isFine ? 'cursor-pointer' : ''}`}
                    >
                      <div className="flex items-center space-x-5">
                        <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${
                          (isFine ? t.status === FineStatus.PAID : t.type === TransactionType.INCOME) ? 'bg-emerald-50 text-emerald-600' : 'bg-rose-50 text-rose-600'
                        }`}>
                          <i className={`fas ${isFine ? 'fa-gavel' : (t.category === 'Аренда' ? 'fa-file-invoice-dollar' : (t.type === TransactionType.INCOME ? 'fa-plus' : 'fa-minus'))}`}></i>
                        </div>
                        <div>
                          <div className="font-bold text-slate-900 group-hover:text-indigo-600 transition-colors">{t.description || t.category}</div>
                          <div className="flex items-center space-x-2 mt-0.5">
                            <span className="text-[10px] font-black text-slate-400 uppercase tracking-tighter">{new Date(t.date).toLocaleDateString()}</span>
                            <span className="w-1 h-1 bg-slate-200 rounded-full"></span>
                            <span className="text-[10px] font-black text-indigo-500 uppercase tracking-tighter">
                              {t.carId ? `${cars.find(c => c.id === t.carId)?.brand || 'Авто'} (${cars.find(c => c.id === t.carId)?.plate || '???'})` : t.category}
                            </span>
                          </div>
                        </div>
                      </div>
                      <div className={`text-right font-black text-lg ${
                         (isFine ? t.status === FineStatus.PAID : t.type === TransactionType.INCOME) ? 'text-emerald-600' : 'text-rose-600'
                      }`}>
                        {isFine ? '' : (t.type === TransactionType.INCOME ? '+' : '-')}{t.amount.toLocaleString()} ₽
                      </div>
                    </div>
                  );
                })}
                {filteredData.length === 0 && (
                  <div className="p-20 text-center text-slate-300 italic font-medium">Нет записей за выбранный период</div>
                )}
              </div>
            </div>
          </div>

          <div className="space-y-8">
            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm">
              <h3 className="text-sm font-black text-slate-400 mb-6 uppercase tracking-widest">Распределение</h3>
              {pieData.length > 0 ? (
                <>
                  <div className="h-[250px]">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Pie data={pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                          {pieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                        </Pie>
                        <Tooltip />
                      </PieChart>
                    </ResponsiveContainer>
                  </div>
                  <div className="space-y-2 mt-4">
                    {pieData.map((item, idx) => (
                      <div key={item.name} className="flex justify-between items-center text-xs">
                        <div className="flex items-center space-x-2"><div className="w-2 h-2 rounded-full" style={{backgroundColor: COLORS[idx % COLORS.length]}}></div><span className="font-bold text-slate-600">{item.name}</span></div>
                        <span className="font-black text-slate-900">{item.value.toLocaleString()} {activeCategory === 'FINES' ? 'шт' : '₽'}</span>
                      </div>
                    ))}
                  </div>
                </>
              ) : (
                <div className="py-20 text-center text-slate-300 italic text-sm">Нет данных</div>
              )}
            </div>
          </div>
        </div>
      )}

      {selectedOperation && (
        <OperationModal item={selectedOperation} cars={cars} onClose={() => setSelectedOperation(null)} />
      )}
    </div>
  );
};

const ReportCard = ({ title, icon, desc, color, onClick }: any) => (
  <button onClick={onClick} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-xl hover:-translate-y-1 transition-all text-left group">
    <div className={`w-16 h-16 rounded-[1.8rem] ${color} text-white flex items-center justify-center text-2xl mb-6 shadow-lg shadow-blue-500/10 transition-transform group-hover:scale-110`}><i className={`fas ${icon}`}></i></div>
    <h3 className="text-xl font-black text-slate-900 mb-2 uppercase tracking-tight">{title}</h3>
    <p className="text-sm text-slate-400 font-medium leading-relaxed">{desc}</p>
    <div className="mt-6 flex items-center text-indigo-600 font-black text-[10px] uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-all">Открыть отчет <i className="fas fa-arrow-right ml-2"></i></div>
  </button>
);

const StatCard = ({ title, value, color, icon }: { title: string, value: number, color: 'emerald' | 'rose' | 'indigo', icon: string }) => {
  const themes = { emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100', rose: 'bg-rose-50 text-rose-600 border-rose-100', indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100' };
  return (
    <div className={`bg-white p-8 rounded-[2.5rem] border ${themes[color]} shadow-sm`}>
      <div className="flex justify-between items-center mb-4"><div className="text-[10px] font-black uppercase tracking-widest opacity-60">{title}</div><i className={`fas ${icon} opacity-30`}></i></div>
      <div className="text-3xl font-black truncate">{value.toLocaleString()} ₽</div>
    </div>
  );
};

export default Reports;
