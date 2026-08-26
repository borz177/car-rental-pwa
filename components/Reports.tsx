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
      // Сравниваем календарные даты строками YYYY-MM-DD.
      // Через new Date() было две ошибки: дата операции разбиралась как локальное
      // время, а граница фильтра — как полночь UTC (для Москвы это 03:00, и утренние
      // операции выпадали); и конечная дата бралась как её полночь, из-за чего
      // весь последний день диапазона в отчёт не попадал.
      const day = String(t.date).split('T')[0];
      if (filters.startDate && day < filters.startDate) return false;
      if (filters.endDate && day > filters.endDate) return false;

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

  // 🎯 Мобильный селектор категорий (горизонтальный скролл)
  const renderCategorySelector = () => {
    const categories = [
      { id: 'ALL', label: 'Все' },
      { id: 'FINES', label: 'Штрафы' },
      { id: 'INVESTORS', label: 'Инвесторы' },
      { id: 'CARS', label: 'Автопарк' },
      { id: 'CLIENTS', label: 'Клиенты' },
      { id: 'CATEGORIES', label: 'Категории' }
    ];

    return (
      <div className="mb-6">
        <div className="flex gap-2 overflow-x-auto pb-2 scrollbar-hide -mx-4 px-4">
          {categories.map((cat) => (
            <button
              key={cat.id}
              onClick={() => {
                setActiveCategory(cat.id as ReportCategory);
                setFilters(f => ({ ...f, searchId: '' }));
              }}
              className={`flex-shrink-0 px-4 py-2.5 text-sm font-medium rounded-xl transition-all active:scale-95 ${
                activeCategory === cat.id
                  ? 'bg-slate-900 text-white shadow-lg'
                  : 'bg-slate-100 text-slate-600 hover:bg-slate-200 active:bg-slate-300'
              }`}
              style={{ minHeight: '44px' }} // Минимальная тач-зона
            >
              {cat.label}
            </button>
          ))}
        </div>
        {/* Индикатор скролла для мобильных */}
        <div className="flex justify-center mt-1 md:hidden">
          <div className="w-12 h-1 bg-slate-200 rounded-full"></div>
        </div>
      </div>
    );
  };

  // 🎯 Селектор вариантов (компактный для мобильных)
  const renderVariantSelector = () => {
    const variants = [
      { id: 'SUMMARY', label: 'Сводка', icon: 'fa-chart-simple' },
      { id: 'CHART', label: 'График', icon: 'fa-chart-area' },
      { id: 'TABLE', label: 'Таблица', icon: 'fa-table' },
      { id: 'METRICS', label: 'Метрики', icon: 'fa-gauge' }
    ];

    return (
      <div className="flex gap-1 p-1 bg-slate-100 rounded-xl w-fit mb-4 overflow-x-auto">
        {variants.map((v) => (
          <button
            key={v.id}
            onClick={() => setActiveVariant(v.id as ReportVariant)}
            className={`flex items-center gap-1.5 px-3 py-2 text-xs font-medium rounded-lg transition-all whitespace-nowrap ${
              activeVariant === v.id
                ? 'bg-white text-slate-900 shadow-sm'
                : 'text-slate-500 hover:text-slate-700'
            }`}
            style={{ minHeight: '40px' }}
          >
            <i className={`fas ${v.icon} text-[10px]`}></i>
            <span className="hidden sm:inline">{v.label}</span>
          </button>
        ))}
      </div>
    );
  };

  // 🎯 Адаптивные фильтры
  const renderFilters = () => (
    <div className="bg-slate-50 rounded-2xl p-4 mb-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Начало</label>
          <input
            type="date"
            value={filters.startDate}
            onChange={e => setFilters({ ...filters, startDate: e.target.value })}
            className="px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
            style={{ minHeight: '44px' }}
          />
        </div>
        <div className="flex flex-col gap-1.5">
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Конец</label>
          <input
            type="date"
            value={filters.endDate}
            onChange={e => setFilters({ ...filters, endDate: e.target.value })}
            className="px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all"
            style={{ minHeight: '44px' }}
          />
        </div>
        <div className="flex flex-col gap-1.5 sm:col-span-2 lg:col-span-2">
          <label className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">Объект</label>
          <select
            value={filters.searchId}
            onChange={e => setFilters({ ...filters, searchId: e.target.value })}
            className="px-3 py-2.5 text-sm bg-white border border-slate-200 rounded-xl outline-none focus:border-slate-400 focus:ring-2 focus:ring-slate-100 transition-all appearance-none"
            style={{ minHeight: '44px' }}
          >
            <option value="">Все объекты</option>
            {activeCategory === 'INVESTORS' && investors.map(i => <option key={i.id} value={i.id}>{i.name}</option>)}
            {activeCategory === 'CARS' && cars.map(c => <option key={c.id} value={c.id}>{c.brand} {c.model}</option>)}
            {(activeCategory === 'CLIENTS' || activeCategory === 'FINES') && clients.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
      </div>
      {/* Кнопка сброса фильтров для мобильных */}
      <div className="mt-3 flex justify-end">
        <button
          onClick={() => setFilters({ startDate: '', endDate: '', searchId: '' })}
          className="text-xs text-slate-400 hover:text-slate-600 px-3 py-1.5 rounded-lg hover:bg-slate-100 transition-colors"
        >
          Сбросить фильтры
        </button>
      </div>
    </div>
  );

  // 🎯 Сводные метрики (адаптивная сетка)
  const renderSummary = () => (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
      <div className="bg-white p-4 rounded-2xl border border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-slate-400 font-medium">{stats.label1}</div>
          <div className="w-8 h-8 rounded-lg bg-emerald-50 flex items-center justify-center">
            <i className="fas fa-arrow-up text-emerald-500 text-xs"></i>
          </div>
        </div>
        <div className="text-lg font-bold text-emerald-600">{stats.income.toLocaleString()} ₽</div>
      </div>
      <div className="bg-white p-4 rounded-2xl border border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-slate-400 font-medium">{stats.label2}</div>
          <div className="w-8 h-8 rounded-lg bg-rose-50 flex items-center justify-center">
            <i className="fas fa-arrow-down text-rose-500 text-xs"></i>
          </div>
        </div>
        <div className="text-lg font-bold text-rose-600">{stats.expense.toLocaleString()} ₽</div>
      </div>
      <div className="bg-white p-4 rounded-2xl border border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <div className="text-xs text-slate-400 font-medium">{stats.label3}</div>
          <div className="w-8 h-8 rounded-lg bg-indigo-50 flex items-center justify-center">
            <i className="fas fa-chart-pie text-indigo-500 text-xs"></i>
          </div>
        </div>
        <div className="text-lg font-bold text-slate-900">{stats.profit.toLocaleString()} ₽</div>
      </div>
    </div>
  );

  // 🎯 График (адаптивная высота)
  const renderChart = () => (
    <div className="bg-white p-4 rounded-2xl border border-slate-100 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h4 className="text-sm font-semibold text-slate-700">Динамика</h4>
        <div className="flex gap-2 text-[10px]">
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-emerald-500"></span>Доход
          </span>
          <span className="flex items-center gap-1">
            <span className="w-2 h-2 rounded-full bg-rose-500"></span>Расход
          </span>
        </div>
      </div>
      <div className="h-48 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={chartData} margin={{ top: 10, right: 0, left: 0, bottom: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" vertical={false} />
            <XAxis
              dataKey="name"
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              interval="preserveStartEnd"
            />
            <YAxis
              tick={{ fontSize: 10, fill: '#94a3b8' }}
              axisLine={false}
              tickLine={false}
              width={40}
            />
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: 'none',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                fontSize: 12
              }}
            />
            <Area type="monotone" dataKey="income" stroke="#10b981" strokeWidth={2} fill="#10b981" fillOpacity={0.1} />
            <Area type="monotone" dataKey="expense" stroke="#f43f5e" strokeWidth={2} fill="#f43f5e" fillOpacity={0.1} />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );

  // 🎯 Круговая диаграмма
  const renderPie = () => (
    <div className="bg-white p-4 rounded-2xl border border-slate-100 mb-6">
      <h4 className="text-sm font-semibold text-slate-700 mb-4">Распределение</h4>
      <div className="h-48 sm:h-64">
        <ResponsiveContainer width="100%" height="100%">
          <PieChart>
            <Pie
              data={pieData}
              innerRadius={40}
              outerRadius={70}
              paddingAngle={2}
              dataKey="value"
              strokeWidth={0}
            >
              {pieData.map((_, index) => (
                <Cell key={index} fill={COLORS[index % COLORS.length]} />
              ))}
            </Pie>
            <Tooltip
              contentStyle={{
                borderRadius: 12,
                border: 'none',
                boxShadow: '0 4px 20px rgba(0,0,0,0.1)',
                fontSize: 12
              }}
            />
          </PieChart>
        </ResponsiveContainer>
      </div>
      {/* Легенда в виде списка для мобильных */}
      <div className="grid grid-cols-2 gap-2 mt-4 max-h-40 overflow-y-auto">
        {pieData.slice(0, 8).map((item, idx) => (
          <div key={item.name} className="flex items-center gap-2 text-xs p-2 rounded-lg hover:bg-slate-50">
            <div className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: COLORS[idx % COLORS.length] }} />
            <span className="text-slate-600 truncate flex-1">{item.name}</span>
            <span className="text-slate-400 font-medium">{item.value.toLocaleString()}</span>
          </div>
        ))}
      </div>
    </div>
  );

  // 🎯 Таблица (горизонтальный скролл для мобильных)
  const renderTable = () => (
    <div className="bg-white rounded-2xl border border-slate-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[600px]">
          <thead className="bg-slate-50">
            <tr className="text-left text-xs text-slate-400 font-semibold uppercase tracking-wide">
              <th className="px-4 py-3">Дата</th>
              <th className="px-4 py-3">Категория</th>
              <th className="px-4 py-3 text-right">Сумма</th>
              <th className="px-4 py-3">Тип</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {filteredData.slice(0, 20).map((t: any) => (
              <tr key={t.id} className="hover:bg-slate-50 transition-colors">
                <td className="px-4 py-3 text-slate-600 whitespace-nowrap">
                  {new Date(t.date).toLocaleDateString('ru-RU', { day: '2-digit', month: 'short' })}
                </td>
                <td className="px-4 py-3 text-slate-600 max-w-[150px] truncate">
                  {t.category || t.status || '—'}
                </td>
                <td className={`px-4 py-3 text-right font-semibold whitespace-nowrap ${
                  t.type === TransactionType.INCOME ? 'text-emerald-600' : 'text-rose-600'
                }`}>
                  {t.amount.toLocaleString()} ₽
                </td>
                <td className="px-4 py-3">
                  <span className={`inline-flex px-2.5 py-1 rounded-lg text-[10px] font-semibold ${
                    t.type === TransactionType.INCOME 
                      ? 'bg-emerald-50 text-emerald-700' 
                      : 'bg-rose-50 text-rose-700'
                  }`}>
                    {t.type === TransactionType.INCOME ? 'Доход' : 'Расход'}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {filteredData.length > 20 && (
        <div className="px-4 py-3 text-center text-xs text-slate-400 bg-slate-50 border-t border-slate-100">
          Показано 20 из {filteredData.length} • <button className="text-indigo-600 font-medium hover:underline">Показать все</button>
        </div>
      )}
    </div>
  );

  // 🎯 Метрики для авто
  const renderCarMetrics = () => {
    if (activeCategory !== 'CARS' || !filters.searchId) return null;
    const car = cars.find(c => c.id === filters.searchId);
    if (!car) return null;

    return (
      <div className="bg-gradient-to-br from-blue-50 to-indigo-50 p-4 rounded-2xl border border-blue-100 mb-6">
        <div className="flex items-start justify-between mb-3">
          <div>
            <div className="text-sm font-semibold text-slate-900">{car.brand} {car.model}</div>
            <div className="text-xs text-slate-400">{car.plate}</div>
          </div>
          <span className={`px-2.5 py-1 rounded-lg text-[10px] font-semibold ${
            car.status === CarStatus.AVAILABLE ? 'bg-emerald-100 text-emerald-700' :
            car.status === CarStatus.RENTED ? 'bg-blue-100 text-blue-700' :
            'bg-amber-100 text-amber-700'
          }`}>
            {car.status}
          </span>
        </div>
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="bg-white p-3 rounded-xl">
            <div className="text-[10px] text-slate-400 mb-1">В работе</div>
            <div className="text-base font-bold text-emerald-600">78%</div>
          </div>
          <div className="bg-white p-3 rounded-xl">
            <div className="text-[10px] text-slate-400 mb-1">Простой</div>
            <div className="text-base font-bold text-slate-600">15%</div>
          </div>
          <div className="bg-white p-3 rounded-xl">
            <div className="text-[10px] text-slate-400 mb-1">Ремонт</div>
            <div className="text-base font-bold text-rose-600">7%</div>
          </div>
        </div>
        {/* Визуальный прогресс-бар */}
        <div className="mt-3 h-2 bg-slate-200 rounded-full overflow-hidden flex">
          <div className="h-full bg-emerald-500" style={{ width: '78%' }}></div>
          <div className="h-full bg-slate-400" style={{ width: '15%' }}></div>
          <div className="h-full bg-rose-400" style={{ width: '7%' }}></div>
        </div>
      </div>
    );
  };

  // 🎯 Основной контент
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
    <div className="max-w-5xl mx-auto py-4 px-4 sm:px-6">
      {/* Заголовок */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-3">
          {activeCategory !== 'ALL' && (
            <button
              onClick={() => { setActiveCategory('ALL'); setFilters(f => ({...f, searchId: ''})); }}
              className="p-2 hover:bg-slate-100 rounded-xl transition-colors active:scale-95"
              style={{ minHeight: '44px', minWidth: '44px' }}
            >
              <i className="fas fa-arrow-left text-slate-400"></i>
            </button>
          )}
          <h1 className="text-lg sm:text-xl font-bold text-slate-900">
            {activeCategory === 'ALL' ? 'Отчёты' :
             activeCategory === 'CARS' ? 'Автопарк' :
             activeCategory === 'INVESTORS' ? 'Инвесторы' :
             activeCategory === 'FINES' ? 'Штрафы' :
             activeCategory === 'CLIENTS' ? 'Клиенты' : 'Категории'}
          </h1>
        </div>
        {activeCategory !== 'ALL' && <div className="hidden sm:block">{renderVariantSelector()}</div>}
      </div>

      {/* Селектор вариантов для мобильных (отдельно) */}
      <div className="sm:hidden mb-4">{renderVariantSelector()}</div>

      {/* Выбор категории или контент */}
      {activeCategory === 'ALL' ? (
        <>
          {renderCategorySelector()}
          <div className="text-center py-8 text-slate-400 text-sm">
            <i className="fas fa-chart-pie text-3xl mb-3 opacity-30"></i>
            <p>Выберите категорию отчёта выше</p>
          </div>
        </>
      ) : (
        <>
          {renderCategorySelector()}
          {renderReportContent()}
        </>
      )}

      {/* Модальное окно */}
      {selectedOperation && (
        <OperationModal item={selectedOperation} cars={cars} onClose={() => setSelectedOperation(null)} />
      )}
    </div>
  );
};

export default Reports;