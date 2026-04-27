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
type ReportVariant = 'SUMMARY' | 'CHART' | 'TABLE' | 'METRICS';

const COLORS = ['#6366f1', '#10b981', '#f59e0b', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f43f5e'];

const Reports: React.FC<ReportsProps> = ({
  transactions, cars, investors, rentals, clients = [], staff = [], fines = [],
  initialSearchId, initialCategory = 'ALL'
}) => {
  const [activeCategory, setActiveCategory] = useState<ReportCategory>(initialCategory);
  const [activeVariant, setActiveVariant] = useState<ReportVariant>('SUMMARY');
  const [selectedOperation, setSelectedOperation] = useState<any | null>(null);
  const [filters, setFilters] = useState({
    startDate: '',
    endDate: '',
    searchId: initialSearchId || ''
  });

  // Синхронизация с пропсами
  useEffect(() => {
    if (initialCategory) setActiveCategory(initialCategory);
    if (initialSearchId) setFilters(f => ({ ...f, searchId: initialSearchId }));
    if (!initialSearchId) setFilters(f => ({ ...f, searchId: '' }));
  }, [initialCategory, initialSearchId]);

  const unifiedTransactions = useMemo(() => 
    [...transactions].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()), 
    [transactions]
  );

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
          const ownedCarIds = investorCarMap[filters.searchId] || [];
          return t.investorId === filters.searchId || (t.carId && ownedCarIds.includes(t.carId));
        }
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

  // 🎯 Минималистичный селектор категорий (вместо карточек)
  const renderCategorySelector = () => (
    <div className="flex flex-wrap gap-2 mb-8">
      {[
        { id: 'ALL', label: 'Все' },
        { id: 'FINES', label: 'Штрафы' },
        { id: 'INVESTORS', label: 'Инвесторы' },
        { id: 'CARS', label: 'Автопарк' },
        { id: 'CLIENTS', label: 'Клиенты' },
        { id: 'CATEGORIES', label: 'Категории' }
      ].map((cat) => (
        <button
          key={cat.id}
          onClick={() => {
            setActiveCategory(cat.id as ReportCategory);
            setFilters(f => ({ ...f, searchId: '' }));
          }}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-all ${
            activeCategory === cat.id
              ? 'bg-slate-900 text-white'
              : 'bg-slate-100 text-slate-600 hover:bg-slate-200'
          }`}
        >
          {cat.label}
        </button>
      ))}
    </div>
  );

  // 🎯 Селектор вариантов отчета
  const renderVariantSelector = () => (
    <div className="flex gap-1 mb-6 p-1 bg-slate-100 rounded-lg w-fit">
      {[
        { id: 'SUMMARY', label: 'Сводка' },
        { id: 'CHART', label: 'График' },
        { id: 'TABLE', label: 'Таблица' },
        { id: 'METRICS', label: 'Метрики' }
      ].map((v) => (
        <button
          key={v.id}
          onClick={() => setActiveVariant(v.id as ReportVariant)}
          className={`px-3 py-1.5 text-xs font-medium rounded-md transition-all ${
            activeVariant === v.id
              ? 'bg-white text-slate-900 shadow-sm'
              : 'text-slate-500 hover:text-slate-700'
          }`}
        >
          {v.label}
        </button>
      ))}
    </div>
  );

  // 🎯 Фильтры (компактно)
  const renderFilters = () => (
    <div className="flex flex-wrap gap-3 mb-6 items-end">
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-400 font-medium">Начало</label>
        <input
          type="date"
          value={filters.startDate}
          onChange={e => setFilters({ ...filters, startDate: e.target.value })}
          className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:border-slate-400"
        />
      </div>
      <div className="flex flex-col gap-1">
        <label className="text-xs text-slate-400 font-medium">Конец</label>
        <input
          type="date"
          value={filters.endDate}
          onChange={e => setFilters({ ...filters, endDate: e.target.value })}
          className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:border-slate-400"
        />
      </div>
      <div className="flex flex-col gap-1 min-w-[200px]">
        <label className="text-xs text-slate-400 font-medium">Объект</label>
        <select
          value={filters.searchId}
          onChange={e => setFilters({ ...filters, searchId: e.target.value })}
          className="px-3 py-2 text-sm bg-white border border-slate-200 rounded-lg outline-none focus:border-slate-400 appearance-none"
        >
          <option value="">Все</option>
          {activeCategory === 'INVESTORS' && investors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
          {activeCategory === 'CARS' && cars.map(c => <option key={c.id} value={c.id}>{c.brand} {c.model}</option>)}
          {(activeCategory === 'CLIENTS' || activeCategory === 'FINES') && clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>
    </div>
  );

  // 🎯 Сводные метрики (упрощённо)
  const renderSummary = () => (
    <div className="grid grid-cols-3 gap-4 mb-8">
      <div className="p-4">
        <div className="text-xs text-slate-400 mb-1">{stats.label1}</div>
        <div className="text-xl font-semibold text-emerald-600">{stats.income.toLocaleString()} ₽</div>
      </div>
      <div className="p-4">
        <div className="text-xs text-slate-400 mb-1">{stats.label2}</div>
        <div className="text-xl font-semibold text-rose-600">{stats.expense.toLocaleString()} ₽</div>
      </div>
      <div className="p-4">
        <div className="text-xs text-slate-400 mb-1">{stats.label3}</div>
        <div className="text-xl font-semibold text-slate-900">{stats.profit.toLocaleString()} ₽</div>
      </div>
    </div>
  );

  // 🎯 График (упрощённый)
  const renderChart = () => (
    <div className="h-64 mb-8">
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <YAxis tick={{ fontSize: 11 }} axisLine={false} tickLine={false} />
          <Tooltip contentStyle={{ borderRadius: 8, border: 'none', boxShadow: '0 4px 12px rgba(0,0,0,0.1)' }} />
          <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} fill="#10b981" fillOpacity={0.1} />
          <Area type="monotone" dataKey="expense" stroke="#f43f5e" strokeWidth={2} fill="#f43f5e" fillOpacity={0.1} />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );

  // 🎯 Круговая диаграмма
  const renderPie = () => (
    <div className="h-64 mb-8">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={pieData} innerRadius={50} outerRadius={80} paddingAngle={3} dataKey="value">
            {pieData.map((_, index) => <Cell key={index} fill={COLORS[index % COLORS.length]} />)}
          </Pie>
          <Tooltip contentStyle={{ borderRadius: 8, border: 'none' }} />
        </PieChart>
      </ResponsiveContainer>
      <div className="grid grid-cols-2 gap-2 mt-4">
        {pieData.slice(0, 6).map((item, idx) => (
          <div key={item.name} className="flex items-center gap-2 text-xs">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
            <span className="text-slate-600 truncate">{item.name}</span>
            <span className="text-slate-400 ml-auto">{item.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );

  // 🎯 Таблица транзакций
  const renderTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs text-slate-400 border-b border-slate-200">
            <th className="pb-3 font-medium">Дата</th>
            <th className="pb-3 font-medium">Категория</th>
            <th className="pb-3 font-medium">Сумма</th>
            <th className="pb-3 font-medium">Тип</th>
          </tr>
        </thead>
        <tbody>
          {filteredData.slice(0, 20).map((t: any) => (
            <tr key={t.id} className="border-b border-slate-100 hover:bg-slate-50">
              <td className="py-3 text-slate-600">{new Date(t.date).toLocaleDateString('ru-RU')}</td>
              <td className="py-3 text-slate-600">{t.category || t.status}</td>
              <td className={`py-3 font-medium ${t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-rose-600'}`}>
                {t.amount.toLocaleString()} ₽
              </td>
              <td className="py-3">
                <span className={`px-2 py-0.5 rounded text-xs ${
                  t.type === TransactionType.INCOME ? 'bg-emerald-50 text-emerald-700' : 'bg-rose-50 text-rose-700'
                }`}>
                  {t.type === TransactionType.INCOME ? 'Доход' : 'Расход'}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
      {filteredData.length > 20 && (
        <div className="text-center py-4 text-xs text-slate-400">
          Показано 20 из {filteredData.length} записей
        </div>
      )}
    </div>
  );

  // 🎯 Метрики для авто (если выбрано)
  const renderCarMetrics = () => {
    if (activeCategory !== 'CARS' || !filters.searchId) return null;
    const car = cars.find(c => c.id === filters.searchId);
    if (!car) return null;
    
    return (
      <div className="p-4 bg-slate-50 rounded-lg mb-6">
        <div className="text-sm font-medium text-slate-900 mb-2">{car.brand} {car.model} ({car.plate})</div>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <div className="text-xs text-slate-400">В работе</div>
            <div className="text-lg font-semibold text-emerald-600">78%</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Простой</div>
            <div className="text-lg font-semibold text-slate-600">15%</div>
          </div>
          <div>
            <div className="text-xs text-slate-400">Ремонт</div>
            <div className="text-lg font-semibold text-rose-600">7%</div>
          </div>
        </div>
      </div>
    );
  };

  // 🎯 Основной контент отчета
  const renderReportContent = () => {
    if (activeVariant === 'SUMMARY') return (
      <>
        {renderFilters()}
        {renderCarMetrics()}
        {renderSummary()}
        {renderChart()}
      </>
    );
    if (activeVariant === 'CHART') return (
      <>
        {renderFilters()}
        {renderChart()}
        {renderPie()}
      </>
    );
    if (activeVariant === 'TABLE') return (
      <>
        {renderFilters()}
        {renderTable()}
      </>
    );
    if (activeVariant === 'METRICS') return (
      <>
        {renderFilters()}
        {renderCarMetrics()}
        {renderSummary()}
      </>
    );
    return null;
  };

  return (
    <div className="max-w-5xl mx-auto py-6">
      {/* Заголовок с навигацией */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {activeCategory !== 'ALL' && (
            <button 
              onClick={() => { setActiveCategory('ALL'); setFilters(f => ({...f, searchId: ''})); }}
              className="p-2 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <i className="fas fa-arrow-left text-slate-400"></i>
            </button>
          )}
          <h1 className="text-xl font-semibold text-slate-900">
            {activeCategory === 'ALL' ? 'Отчёты' : 
             activeCategory === 'CARS' ? 'Автопарк' :
             activeCategory === 'INVESTORS' ? 'Инвесторы' :
             activeCategory === 'FINES' ? 'Штрафы' :
             activeCategory === 'CLIENTS' ? 'Клиенты' : 'Категории'}
          </h1>
        </div>
        {activeCategory !== 'ALL' && renderVariantSelector()}
      </div>

      {/* Выбор категории или контент отчета */}
      {activeCategory === 'ALL' ? (
        <>
          {renderCategorySelector()}
          <div className="text-slate-400 text-sm">
            Выберите категорию отчёта выше, чтобы начать анализ
          </div>
        </>
      ) : (
        renderReportContent()
      )}

      {/* Модальное окно операции */}
      {selectedOperation && (
        <OperationModal item={selectedOperation} cars={cars} onClose={() => setSelectedOperation(null)} />
      )}
    </div>
  );
};

export default Reports;