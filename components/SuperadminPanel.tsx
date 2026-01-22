
import React, { useState } from 'react';
import { User, UserRole } from '../backend/src/types.ts';

interface SuperadminPanelProps {
  allUsers: User[];
  onUpdateUser: (userId: string, updates: Partial<User>) => void;
  onDeleteUser: (userId: string) => void;
}

const SuperadminPanel: React.FC<SuperadminPanelProps> = ({ allUsers, onUpdateUser, onDeleteUser }) => {
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  const filteredUsers = allUsers.filter(u => 
    u.name.toLowerCase().includes(searchQuery.toLowerCase()) || 
    u.email.toLowerCase().includes(searchQuery.toLowerCase())
  ).filter(u => u.role !== UserRole.SUPERADMIN); // Hide other superadmins for safety

  const stats = {
    totalUsers: allUsers.length,
    activeSubscribers: allUsers.filter(u => u.subscriptionUntil && new Date(u.subscriptionUntil) > new Date()).length,
    trialUsers: allUsers.filter(u => u.isTrial).length
  };

  const handleSubscriptionUpdate = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!editingUser) return;
    
    const fd = new FormData(e.currentTarget);
    const updates: Partial<User> = {
      subscriptionUntil: fd.get('until') as string,
      activePlan: fd.get('plan') as string,
      isTrial: fd.get('isTrial') === 'on'
    };
    
    onUpdateUser(editingUser.id, updates);
    setEditingUser(null);
  };

  return (
    <div className="space-y-8 animate-fadeIn">
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">System Control Panel</h2>
          <p className="text-slate-400 font-bold mt-1 uppercase text-[10px] tracking-widest">Global Management & Subscriptions</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <StatCard title="Всего компаний" value={stats.totalUsers} icon="fa-building" color="indigo" />
        <StatCard title="Активные подписки" value={stats.activeSubscribers} icon="fa-check-circle" color="emerald" />
        <StatCard title="В триале" value={stats.trialUsers} icon="fa-clock" color="amber" />
      </div>

      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-sm overflow-hidden">
        <div className="p-8 border-b border-slate-50 flex flex-col md:flex-row justify-between items-center gap-4">
          <h3 className="text-xl font-black text-slate-800">Реестр владельцев флота</h3>
          <div className="relative w-full md:w-64">
             <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-300"></i>
             <input 
               placeholder="Поиск по email или названию..." 
               className="w-full pl-10 pr-4 py-3 bg-slate-50 rounded-xl text-sm font-bold outline-none border-2 border-transparent focus:border-indigo-500"
               value={searchQuery}
               onChange={e => setSearchQuery(e.target.value)}
             />
          </div>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50/50">
              <tr>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Клиент / Компания</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Тариф</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest">Действует до</th>
                <th className="px-8 py-4 text-[10px] font-black text-slate-400 uppercase tracking-widest text-right">Управление</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.map(user => {
                const isExpired = user.subscriptionUntil && new Date(user.subscriptionUntil) < new Date();
                return (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-all group">
                    <td className="px-8 py-5">
                      <div className="font-bold text-slate-900">{user.name}</div>
                      <div className="text-xs text-slate-400 font-medium">{user.email}</div>
                    </td>
                    <td className="px-8 py-5">
                      <span className={`px-3 py-1 rounded-full text-[10px] font-black uppercase tracking-tight ${
                        user.isTrial ? 'bg-amber-100 text-amber-700' : 'bg-blue-100 text-blue-700'
                      }`}>
                        {user.activePlan || 'Base'} {user.isTrial && '(Trial)'}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      <div className={`font-bold text-sm ${isExpired ? 'text-rose-500' : 'text-slate-700'}`}>
                        {user.subscriptionUntil ? new Date(user.subscriptionUntil).toLocaleDateString() : '—'}
                      </div>
                      {isExpired && <span className="text-[8px] font-black uppercase text-rose-400">Истекла</span>}
                    </td>
                    <td className="px-8 py-5 text-right">
                      <div className="flex justify-end space-x-2">
                        <button 
                          onClick={() => setEditingUser(user)}
                          className="w-10 h-10 bg-indigo-50 text-indigo-600 rounded-xl hover:bg-indigo-600 hover:text-white transition-all flex items-center justify-center"
                          title="Активировать подписку"
                        >
                          <i className="fas fa-credit-card"></i>
                        </button>
                        <button 
                          onClick={() => confirm('Удалить пользователя навсегда?') && onDeleteUser(user.id)}
                          className="w-10 h-10 bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all flex items-center justify-center"
                        >
                          <i className="fas fa-trash-alt"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {editingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <form onSubmit={handleSubscriptionUpdate} className="bg-white rounded-[3rem] w-full max-w-lg p-10 shadow-2xl animate-scaleIn relative">
            <h2 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Подписка пользователя</h2>
            <p className="text-sm text-slate-400 font-bold mb-8">{editingUser.name} ({editingUser.email})</p>

            <div className="space-y-6 mb-10">
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Дата окончания</label>
                <input 
                  name="until" 
                  type="date" 
                  defaultValue={editingUser.subscriptionUntil ? editingUser.subscriptionUntil.split('T')[0] : ''} 
                  required 
                  className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500" 
                />
              </div>

              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Тарифный план</label>
                <select name="plan" defaultValue={editingUser.activePlan || 'Старт'} className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-indigo-500 appearance-none">
                  <option value="Старт">Старт</option>
                  <option value="Бизнес">Бизнес</option>
                  <option value="Премиум">Премиум</option>
                </select>
              </div>

              <div className="flex items-center space-x-3 p-4 bg-slate-50 rounded-2xl">
                <input type="checkbox" name="isTrial" defaultChecked={editingUser.isTrial} className="w-5 h-5 rounded border-slate-300 text-indigo-600 focus:ring-indigo-500" />
                <span className="text-sm font-bold text-slate-700">Пробный период активен</span>
              </div>
            </div>

            <div className="flex gap-4">
              <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-4 bg-slate-100 rounded-2xl font-bold text-slate-500">Отмена</button>
              <button type="submit" className="flex-1 py-4 bg-indigo-600 text-white rounded-2xl font-bold shadow-xl shadow-indigo-500/20">Активировать</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ title, value, icon, color }: any) => {
  const themes: any = {
    indigo: 'bg-indigo-50 text-indigo-600 border-indigo-100',
    emerald: 'bg-emerald-50 text-emerald-600 border-emerald-100',
    amber: 'bg-amber-50 text-amber-600 border-amber-100'
  };
  return (
    <div className={`p-8 rounded-[2.5rem] border ${themes[color]} shadow-sm flex items-center justify-between`}>
      <div>
        <div className="text-[10px] font-black uppercase tracking-widest opacity-60 mb-1">{title}</div>
        <div className="text-3xl font-black">{value}</div>
      </div>
      <i className={`fas ${icon} text-2xl opacity-30`}></i>
    </div>
  );
};

export default SuperadminPanel;
