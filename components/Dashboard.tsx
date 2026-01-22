
import React from 'react';
import { Car, Rental, Client, User } from '../types.ts';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell, PieChart, Pie } from 'recharts';

interface DashboardProps {
  cars: Car[];
  rentals: Rental[];
  clients: Client[];
  user?: User | null;
}

const Dashboard: React.FC<DashboardProps> = ({ cars, rentals, clients, user }) => {
  const totalRevenue = rentals.reduce((sum, r) => sum + r.totalAmount, 0);
  const utilizationRate = Math.round((cars.filter(c => c.status === 'В аренде').length / cars.length) * 100) || 0;

  const revenueData = [
    { name: 'Янв', value: totalRevenue * 0.8 },
    { name: 'Фев', value: totalRevenue * 0.9 },
    { name: 'Мар', value: totalRevenue },
  ];

  const statusData = [
    { name: 'Свободно', value: cars.filter(c => c.status === 'Свободен').length, color: '#10B981' },
    { name: 'Аренда', value: cars.filter(c => c.status === 'В аренде').length, color: '#EF4444' },
    { name: 'Ремонт', value: cars.filter(c => c.status === 'В ремонте').length, color: '#64748B' },
  ];

  return (
    <div className="space-y-8">
      {user?.isTrial && (
        <div className="bg-gradient-to-r from-blue-600 to-indigo-700 p-8 rounded-[2.5rem] text-white flex flex-col md:flex-row justify-between items-center shadow-xl shadow-blue-500/20 relative overflow-hidden animate-slideDown">
           <div className="relative z-10 text-center md:text-left">
              <h3 className="text-2xl font-black mb-2 uppercase tracking-tight">Активен пробный период</h3>
              <p className="text-blue-100 font-medium max-w-lg">Осталось 3 дня бесплатного использования всех функций системы. Выберите тариф для бесперебойной работы.</p>
           </div>
           <button 
             onClick={() => window.dispatchEvent(new CustomEvent('navigate', { detail: 'TARIFFS' }))}
             className="relative z-10 mt-6 md:mt-0 px-8 py-4 bg-white text-blue-700 rounded-2xl font-black uppercase tracking-widest text-xs hover:bg-blue-50 transition-all shadow-lg active:scale-95"
           >
             Выбрать тариф
           </button>
           <i className="fas fa-gift absolute -right-6 -bottom-6 text-9xl text-white/10 rotate-12"></i>
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
        <StatCard title="Выручка (₽)" value={totalRevenue.toLocaleString()} icon="fa-wallet" color="blue" />
        <StatCard title="Загрузка" value={`${utilizationRate}%`} icon="fa-chart-line" color="emerald" />
        <StatCard title="Клиенты" value={clients.length} icon="fa-users" color="purple" />
        <StatCard title="Автопарк" value={cars.length} icon="fa-car" color="amber" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-6 text-gray-800">Динамика выручки</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={revenueData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="value" fill="#3B82F6" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
          <h3 className="text-lg font-bold mb-6 text-gray-800">Статус автопарка</h3>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={statusData} innerRadius={60} outerRadius={80} paddingAngle={5} dataKey="value">
                  {statusData.map((entry, index) => <Cell key={index} fill={entry.color} />)}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
          </div>
          <div className="flex justify-center space-x-6 text-sm">
            {statusData.map(s => (
              <div key={s.name} className="flex items-center">
                <span className="w-3 h-3 rounded-full mr-2" style={{backgroundColor: s.color}}></span>
                <span>{s.name}</span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};

const StatCard = ({ title, value, icon, color }: any) => (
  <div className="bg-white p-6 rounded-3xl shadow-sm border border-gray-100">
    <div className="flex items-center justify-between mb-2">
      <span className="text-gray-500 text-sm font-medium">{title}</span>
      <i className={`fas ${icon} text-${color}-500`}></i>
    </div>
    <div className="text-2xl font-bold text-gray-900">{value}</div>
  </div>
);

export default Dashboard;
