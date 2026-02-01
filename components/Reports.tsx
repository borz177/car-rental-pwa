
import React, { useState, useMemo, useEffect } from 'react';
import { Transaction, Car, Investor, TransactionType, Rental, Client, Staff, Fine, FineStatus, CarStatus } from '../types';
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
  initialSearchId?: string | null;
  initialCategory?: 'ALL' | 'INVESTORS' | 'CARS' | 'CLIENTS' | 'FINES';
}

type ReportCategory = 'ALL' | 'INVESTORS' | 'CARS' | 'CATEGORIES' | 'CLIENTS' | 'STAFF' | 'FINES';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f43f5e'];

const Reports: React.FC<ReportsProps> = ({
  transactions, cars, investors, rentals, clients = [], staff = [], fines = [],
  initialSearchId, initialCategory = 'ALL'
}) => {
  const [activeCategory, setActiveCategory] = useState<ReportCategory>(initialCategory);
  const [selectedOperation, setSelectedOperation] = useState<any | null>(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    searchId: initialSearchId || ''
  });

  // Sync with initial props if they change
  useEffect(() => {
    if (initialCategory) setActiveCategory(initialCategory);
    if (initialSearchId) setFilters(f => ({ ...f, searchId: initialSearchId }));
    // If ID is cleared (navigation reset), ensure filter is cleared too
    if (!initialSearchId) setFilters(f => ({ ...f, searchId: '' }));
  }, [initialCategory, initialSearchId]);

  const unifiedTransactions = useMemo(() => {
    return [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [transactions]);

  // Performance optimization: Pre-map investor cars
  const investorCarMap = useMemo(() => {
    const map: Record<string, string[]> = {};
    investors.forEach(inv => {
        map[inv.id] = cars.filter(c => c.investorId === inv.id).map(c => c.id);
    });
    return map;
  }, [cars, investors]);

  const filteredData = useMemo(() => {
    let base = activeCategory === 'FINES' ? fines : unifiedTransactions;

    return base.filter((t: any) => {
      const date = new Date(t.date);
      const start = filters.startDate ? new Date(filters.startDate) : null;
      const end = filters.endDate ? new Date(filters.endDate) : null;

      if (start && date < start) return false;
      if (end && date > end) return false;

      if (activeCategory === 'INVESTORS') {
        if (filters.searchId) {
            // Include Direct Payouts (investorId matched) OR Income from cars owned by investor
            const ownedCarIds = investorCarMap[filters.searchId] || [];
            return t.investorId === filters.searchId || (t.carId && ownedCarIds.includes(t.carId));
        }
        // General Investor View: Has explicit investor ID or is linked to a car with an investor
        return (t.investorId !== undefined && t.investorId !== null) || (t.carId && cars.find(c => c.id === t.carId)?.investorId);
      }

      if (activeCategory === 'CARS') {
        if (filters.searchId) return t.carId === filters.searchId;
        return t.carId !== undefined && t.carId !== null;
      }

      if (activeCategory === 'CLIENTS') {
        if (filters.searchId) return t.clientId === filters.searchId;
        return t.clientId !== undefined && t.clientId !== null;
      }

      if (activeCategory === 'FINES') {
        if (filters.searchId) return t.clientId === filters.searchId;
      }

      return true;
    });
  }, [unifiedTransactions, filters, activeCategory, fines, investorCarMap, cars]);

  const carMetrics = useMemo(() => {
    if (activeCategory !== 'CARS' || !filters.searchId) return null;

    const carId = filters.searchId;
    const car = cars.find(c => c.id === carId);
    if (!car) return null;

    const now = new Date();
    const startRange = filters.startDate ? new Date(filters.startDate) : new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
    const endRange = filters.endDate ? new Date(filters.endDate) : now;

    const totalDays = Math.ceil((endRange.getTime() - startRange.getTime()) / (1000 * 60 * 60 * 24)) || 1;

    let workingDays = 0;
    const carRentals = rentals.filter(r => r.carId === carId && r.status !== 'CANCELLED');

    carRentals.forEach(r => {
      const rStart = new Date(r.startDate);
      const rEnd = new Date(r.endDate);
      const actualStart = rStart > startRange ? rStart : startRange;
      const actualEnd = rEnd < endRange ? rEnd : endRange;
      if (actualEnd > actualStart) {
        workingDays += (actualEnd.getTime() - actualStart.getTime()) / (1000 * 60 * 60 * 24);
      }
    });

    workingDays = Math.min(totalDays, Math.round(workingDays * 10) / 10);
    const maintenanceDays = car.status === CarStatus.MAINTENANCE ? Math.min(totalDays - workingDays, 4.5) : 0;
    const idleDays = Math.max(0, totalDays - workingDays - maintenanceDays);

    return {
      workingDays,
      idleDays,
      maintenanceDays,
      totalDays,
      utilization: Math.round((workingDays / totalDays) * 100),
      carInfo: `${car.brand} ${car.model} (${car.plate})`
    };
  }, [activeCategory, filters, cars, rentals]);

  const stats = useMemo(() => {
    if (activeCategory === 'FINES') {
      const total = filteredData.reduce((s, f: any) => s + f.amount, 0);
      const paid = filteredData.filter((f: any) => f.status === FineStatus.PAID).reduce((s, f: any) => s + f.amount, 0);
      return { income: paid, expense: total - paid, profit: paid, label1: 'Оплачено', label2: 'Не оплачено', label3: 'Всего' };
    }
    const income = filteredData.filter(t => (t as any).type === TransactionType.INCOME).reduce((s, t) => s + (t as any).amount, 0);
    const expense = filteredData.filter(t => (t as any).type === TransactionType.EXPENSE).reduce((s, t) => s + (t as any).amount, 0);
    return { income, expense, profit: income - expense, label1: 'Выручка', label2: 'Расходы', label3: 'Прибыль' };
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
    const map: Record<string, number> = {};
    filteredData.forEach((t: any) => {
      const label = activeCategory === 'FINES' ? t.status : t.category;
      map[label] = (map[label] || 0) + (activeCategory === 'FINES' ? 1 : t.amount);
    });
    return Object.entries(map).map(([name, value]) => ({ name, value }));
  }, [filteredData, activeCategory]);

  const renderHome = () => (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 animate-fadeIn">
      <ReportCard title="Общий отчет" icon="fa-globe" desc="Все транзакции" color="bg-indigo-600" onClick={() => setActiveCategory('ALL')} />
      <ReportCard title="Штрафы" icon="fa-gavel" desc="Контроль ГИБДД" color="bg-rose-600" onClick={() => { setActiveCategory('FINES'); setFilters(f => ({...f, searchId: ''})); }} />
      <ReportCard title="Инвесторы" icon="fa-handshake" desc="Доход по партнерам" color="bg-amber-500" onClick={() => { setActiveCategory('INVESTORS'); setFilters(f => ({...f, searchId: ''})); }} />
      <ReportCard title="Автопарк" icon="fa-car" desc="Доход по машинам" color="bg-blue-500" onClick={() => { setActiveCategory('CARS'); setFilters(f => ({...f, searchId: ''})); }} />
      <ReportCard title="Клиенты" icon="fa-users" desc="Анализ по арендаторам" color="bg-emerald-500" onClick={() => { setActiveCategory('CLIENTS'); setFilters(f => ({...f, searchId: ''})); }} />
      <ReportCard title="Категории" icon="fa-tags" desc="Анализ статей" color="bg-purple-500" onClick={() => setActiveCategory('CATEGORIES')} />
    </div>
  );

  return (
    <div className="space-y-8 pb-24 md:pb-0 animate-fadeIn">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <h2 className="text-3xl font-black text-slate-900 tracking-tight">
          {activeCategory !== 'ALL' && (
            <button onClick={() => { setActiveCategory('ALL'); setFilters(f => ({...f, searchId: ''})); }} className="mr-4 text-slate-300 hover:text-indigo-600 transition-colors">
              <i className="fas fa-chevron-left"></i>
            </button>
          )}
          {activeCategory === 'ALL' ? 'Финансовая аналитика' :
           activeCategory === 'CARS' ? 'Отчет по автопарку' :
           activeCategory === 'INVESTORS' ? 'Отчет по инвесторам' :
           activeCategory === 'FINES' ? 'Штрафы ГИБДД' : 'Детальный отчет'}
        </h2>
      </div>

      {activeCategory !== 'ALL' && (
        <div className="bg-white p-6 rounded-[2.5rem] border border-slate-100 shadow-sm grid grid-cols-1 md:grid-cols-4 gap-4 items-end">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Начало</label>
            <input type="date" value={filters.startDate} onChange={e => setFilters({...filters, startDate: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500" />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Конец</label>
            <input type="date" value={filters.endDate} onChange={e => setFilters({...filters, endDate: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500" />
          </div>
          <div className="md:col-span-2 space-y-2">
            <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2">Объект анализа</label>
            <select value={filters.searchId} onChange={e => setFilters({...filters, searchId: e.target.value})} className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500 appearance-none text-slate-900">
              <option value="">Все объекты</option>
              {activeCategory === 'INVESTORS' && investors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
              {activeCategory === 'CARS' && cars.map(c => <option key={c.id} value={c.id}>{c.brand} {c.model} ({c.plate})</option>)}
              {(activeCategory === 'CLIENTS' || activeCategory === 'FINES') && clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
        </div>
      )}

      {activeCategory === 'ALL' ? renderHome() : (
        <div className="space-y-8">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <StatCard title={stats.label1} value={stats.income} color="emerald" icon="fa-arrow-up" />
            <StatCard title={stats.label2} value={stats.expense} color="rose" icon="fa-arrow-down" />
            <StatCard title={stats.label3} value={stats.profit} color="indigo" icon="fa-chart-pie" />
          </div>

          {activeCategory === 'CARS' && carMetrics && (
            <div className="bg-white p-8 md:p-12 rounded-[3rem] border border-slate-100 shadow-sm animate-slideUp">
               <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6 mb-10">
                 <div>
                   <h3 className="text-2xl font-black text-slate-900 uppercase tracking-tight">Эффективность ТС</h3>
                   <p className="text-slate-400 font-bold text-sm mt-1">{carMetrics.carInfo}</p>
                 </div>
                 <div className="flex items-center space-x-4 bg-blue-50 px-6 py-4 rounded-[1.8rem] border border-blue-100">
                    <div>
                      <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest">Утилизация</div>
                      <div className="text-2xl font-black text-blue-600">{carMetrics.utilization}%</div>
                    </div>
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center text-blue-600 shadow-sm">
                      <i className="fas fa-bolt"></i>
                    </div>
                 </div>
               </div>

               <div className="space-y-4">
                 <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-2">Статистика по дням за период ({carMetrics.totalDays} дн.)</div>
                 <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                   <MetricTileRow label="В работе" value={carMetrics.workingDays} suffix="дн." color="text-emerald-600" bg="bg-emerald-50" icon="fa-play" percent={Math.round((carMetrics.workingDays/carMetrics.totalDays)*100)} />
                   <MetricTileRow label="Простой" value={carMetrics.idleDays} suffix="дн." color="text-slate-400" bg="bg-slate-50" icon="fa-pause" percent={Math.round((carMetrics.idleDays/carMetrics.totalDays)*100)} />
                   <MetricTileRow label="В ремонте" value={carMetrics.maintenanceDays} suffix="дн." color="text-rose-500" bg="bg-rose-50" icon="fa-tools" percent={Math.round((carMetrics.maintenanceDays/carMetrics.totalDays)*100)} />
                 </div>
               </div>

               {/* Visual distribution bar */}
               <div className="mt-8 h-4 w-full bg-slate-100 rounded-full overflow-hidden flex">
                  <div className="h-full bg-emerald-500 transition-all duration-700" style={{ width: `${(carMetrics.workingDays/carMetrics.totalDays)*100}%` }}></div>
                  <div className="h-full bg-slate-300 transition-all duration-700" style={{ width: `${(carMetrics.idleDays/carMetrics.totalDays)*100}%` }}></div>
                  <div className="h-full bg-rose-400 transition-all duration-700" style={{ width: `${(carMetrics.maintenanceDays/carMetrics.totalDays)*100}%` }}></div>
               </div>
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 min-h-[350px]">
              <div className="flex justify-between items-center mb-8">
                <h4 className="font-black text-slate-800 uppercase tracking-widest text-xs">График транзакций</h4>
              </div>
              <div className="h-[250px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={chartData}>
                    <defs>
                      <linearGradient id="colorInc" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                      </linearGradient>
                      <linearGradient id="colorExp" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#f43f5e" stopOpacity={0.1}/>
                        <stop offset="95%" stopColor="#f43f5e" stopOpacity={0}/>
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                    <XAxis dataKey="name" tick={{fontSize: 10, fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                    <YAxis tick={{fontSize: 10, fontWeight: 'bold'}} axisLine={false} tickLine={false} />
                    <Tooltip contentStyle={{borderRadius: '20px', border: 'none', boxShadow: '0 10px 15px -3px rgba(0,0,0,0.1)'}} />
                    <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorInc)" />
                    <Area type="monotone" dataKey="expense" stroke="#f43f5e" strokeWidth={3} fillOpacity={1} fill="url(#colorExp)" />
                  </AreaChart>
                </ResponsiveContainer>
              </div>
            </div>

            <div className="bg-white p-8 rounded-[3rem] border border-slate-100 flex flex-col items-center">
              <h4 className="font-black text-slate-800 uppercase tracking-widest text-xs self-start mb-8">Распределение по категориям</h4>
              <div className="h-[200px] w-full">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                      {pieData.map((_, index) => <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />)}
                    </Pie>
                    <Tooltip contentStyle={{borderRadius: '20px', border: 'none'}} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="grid grid-cols-2 gap-x-8 gap-y-3 mt-6 w-full px-4">
                {pieData.map((item, idx) => (
                  <div key={item.name} className="flex items-center justify-between text-[10px] font-bold border-b border-slate-50 pb-2">
                    <div className="flex items-center space-x-2 truncate mr-2">
                      <div className="w-2 h-2 rounded-full flex-shrink-0" style={{backgroundColor: COLORS[idx % COLORS.length]}}></div>
                      <span className="text-slate-400 truncate">{item.name}</span>
                    </div>
                    <span className="text-slate-900">{item.value.toLocaleString()}</span>
                  </div>
                ))}
              </div>
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

const MetricTileRow = ({ label, value, suffix, color, bg, icon, percent }: any) => (
  <div className={`${bg} p-6 rounded-[2rem] border border-transparent hover:border-slate-100 transition-all flex items-center justify-between group`}>
    <div className="flex items-center space-x-4">
      <div className={`w-12 h-12 bg-white rounded-2xl flex items-center justify-center ${color} shadow-sm transition-transform group-hover:scale-110`}>
        <i className={`fas ${icon}`}></i>
      </div>
      <div>
        <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-0.5">{label}</div>
        <div className={`text-2xl font-black ${color}`}>{value}{suffix}</div>
      </div>
    </div>
    <div className="text-right">
       <div className="text-[10px] font-black text-slate-400">{percent}%</div>
    </div>
  </div>
);

const ReportCard = ({ title, icon, desc, color, onClick }: any) => (
  <button onClick={onClick} className="bg-white p-8 rounded-[3rem] border border-slate-100 shadow-sm hover:shadow-xl transition-all text-left group">
    <div className={`w-14 h-14 rounded-2xl ${color} text-white flex items-center justify-center text-xl mb-6 shadow-lg transition-transform group-hover:scale-110`}><i className={`fas ${icon}`}></i></div>
    <h3 className="text-xl font-black text-slate-900 mb-2">{title}</h3>
    <p className="text-xs text-slate-400 font-medium leading-relaxed">{desc}</p>
  </button>
);

const StatCard = ({ title, value, color, icon }: any) => (
  <div className={`bg-white p-8 rounded-[2.5rem] border border-slate-100 shadow-sm`}>
    <div className="flex justify-between items-center mb-4">
      <div className="text-[10px] font-black uppercase opacity-40 tracking-widest">{title}</div>
      <div className={`w-10 h-10 rounded-xl bg-${color}-50 flex items-center justify-center text-${color}-500 opacity-60`}>
        <i className={`fas ${icon}`}></i>
      </div>
    </div>
    <div className="text-3xl font-black">{value.toLocaleString()} ₽</div>
  </div>
);

export default Reports;
