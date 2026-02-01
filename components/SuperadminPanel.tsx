
import React, { useState, useMemo } from 'react';
import { User, UserRole } from '../types';

interface SuperadminPanelProps {
  allUsers: User[];
  onUpdateUser: (userId: string, updates: Partial<User>) => void;
  onDeleteUser: (userId: string) => void;
}

const PLANS = ['Старт', 'Бизнес', 'Премиум'];

const SuperadminPanel: React.FC<SuperadminPanelProps> = ({ allUsers, onUpdateUser, onDeleteUser }) => {
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'ALL' | 'ACTIVE' | 'EXPIRED' | 'TRIAL'>('ALL');

  // Helpers for Date
  const isExpired = (dateStr?: string) => !dateStr || new Date(dateStr) < new Date();
  const formatDate = (dateStr?: string) => dateStr ? new Date(dateStr).toLocaleDateString() : '—';

  // Filter Users
  const filteredUsers = useMemo(() => {
    return allUsers.filter(u => {
      // Allow showing Superadmin so the table isn't empty if only 1 user exists
      // But we will disable actions for them in the render loop

      const matchesSearch =
        u.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        u.email.toLowerCase().includes(searchQuery.toLowerCase()) ||
        (u.publicBrandName || '').toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchesSearch) return false;

      const expired = isExpired(u.subscriptionUntil);

      if (filterStatus === 'ACTIVE') return !expired && !u.isTrial;
      if (filterStatus === 'EXPIRED') return expired;
      if (filterStatus === 'TRIAL') return !expired && u.isTrial;

      return true;
    });
  }, [allUsers, searchQuery, filterStatus]);

  // Statistics
  const stats = useMemo(() => {
    const total = allUsers.length;
    const active = allUsers.filter(u => u.subscriptionUntil && new Date(u.subscriptionUntil) > new Date() && !u.isTrial).length;
    const trial = allUsers.filter(u => u.isTrial && u.subscriptionUntil && new Date(u.subscriptionUntil) > new Date()).length;
    const expired = allUsers.filter(u => u.role !== UserRole.SUPERADMIN && (!u.subscriptionUntil || new Date(u.subscriptionUntil) < new Date())).length;
    return { total, active, trial, expired };
  }, [allUsers]);

  // Handle Manual Activation
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

  const quickSetDate = (months: number) => {
    const date = new Date();
    date.setMonth(date.getMonth() + months);
    const dateStr = date.toISOString().split('T')[0]; // YYYY-MM-DD

    // Update the input value directly in DOM or re-render form logic
    const input = document.getElementById('sub-until') as HTMLInputElement;
    if (input) input.value = dateStr;
  };

  return (
    <div className="space-y-8 animate-fadeIn pb-24">
      {/* Header & Stats */}
      <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-4 px-2">
        <div>
          <h2 className="text-3xl font-black text-slate-900 tracking-tight">Панель Владельца</h2>
          <p className="text-slate-400 font-bold mt-1 uppercase text-[10px] tracking-widest">Управление клиентами SaaS</p>
        </div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard title="Всего клиентов" value={stats.total} icon="fa-users" color="bg-blue-50 text-blue-600" />
        <StatCard title="Активные подписки" value={stats.active} icon="fa-check-circle" color="bg-emerald-50 text-emerald-600" />
        <StatCard title="На триале" value={stats.trial} icon="fa-clock" color="bg-amber-50 text-amber-600" />
        <StatCard title="Истекли / Неактивны" value={stats.expired} icon="fa-times-circle" color="bg-rose-50 text-rose-600" />
      </div>

      {/* Filters & Table */}
      <div className="bg-white rounded-[2.5rem] border border-slate-100 shadow-xl overflow-hidden">
        <div className="p-6 border-b border-slate-50 flex flex-col lg:flex-row justify-between items-center gap-4 bg-slate-50/50">
          <div className="flex bg-slate-200/50 p-1 rounded-2xl">
             {([
               { id: 'ALL', label: 'Все' },
               { id: 'ACTIVE', label: 'Активные' },
               { id: 'TRIAL', label: 'Триал' },
               { id: 'EXPIRED', label: 'Истекшие' }
             ] as const).map(tab => (
               <button
                 key={tab.id}
                 onClick={() => setFilterStatus(tab.id)}
                 className={`px-6 py-2 rounded-xl text-xs font-black uppercase transition-all ${filterStatus === tab.id ? 'bg-white shadow-md text-slate-900' : 'text-slate-500 hover:text-slate-700'}`}
               >
                 {tab.label}
               </button>
             ))}
          </div>

          <div className="relative w-full lg:w-72">
             <i className="fas fa-search absolute left-4 top-1/2 -translate-y-1/2 text-slate-400"></i>
             <input
               placeholder="Поиск клиента..."
               className="w-full pl-10 pr-4 py-3 bg-white rounded-xl text-sm font-bold outline-none border border-slate-200 focus:border-blue-500 transition-all"
               value={searchQuery}
               onChange={e => setSearchQuery(e.target.value)}
             />
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left">
            <thead className="bg-slate-50 text-slate-400 text-[10px] font-black uppercase tracking-widest">
              <tr>
                <th className="px-8 py-4">Клиент / Компания</th>
                <th className="px-8 py-4">Тариф</th>
                <th className="px-8 py-4">Статус</th>
                <th className="px-8 py-4">Истекает</th>
                <th className="px-8 py-4 text-right">Действия</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredUsers.map(user => {
                const expired = isExpired(user.subscriptionUntil);
                const isSuper = user.role === UserRole.SUPERADMIN;
                return (
                  <tr key={user.id} className="hover:bg-slate-50/50 transition-all group">
                    <td className="px-8 py-5">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 rounded-xl bg-gradient-to-br from-slate-100 to-slate-200 flex items-center justify-center text-slate-500 font-black text-sm">
                          {user.name.charAt(0)}
                        </div>
                        <div>
                          <div className="font-bold text-slate-900">{user.publicBrandName || user.name}</div>
                          <div className="text-xs text-slate-400 font-medium">{user.email}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-8 py-5">
                      <span className={`px-3 py-1 rounded-lg text-[10px] font-black uppercase tracking-tight border ${
                        user.activePlan === 'Премиум' ? 'bg-indigo-50 text-indigo-600 border-indigo-100' :
                        user.activePlan === 'Бизнес' ? 'bg-blue-50 text-blue-600 border-blue-100' :
                        'bg-slate-50 text-slate-600 border-slate-100'
                      }`}>
                        {user.activePlan || 'Нет'}
                      </span>
                    </td>
                    <td className="px-8 py-5">
                      {expired ? (
                        <span className="flex items-center space-x-1 text-rose-500 text-xs font-bold">
                          <i className="fas fa-times-circle"></i> <span>Истек</span>
                        </span>
                      ) : user.isTrial ? (
                        <span className="flex items-center space-x-1 text-amber-500 text-xs font-bold">
                          <i className="fas fa-clock"></i> <span>Триал</span>
                        </span>
                      ) : (
                        <span className="flex items-center space-x-1 text-emerald-500 text-xs font-bold">
                          <i className="fas fa-check-circle"></i> <span>Активен</span>
                        </span>
                      )}
                    </td>
                    <td className="px-8 py-5">
                      <div className={`font-bold text-sm ${expired ? 'text-rose-400' : 'text-slate-700'}`}>
                        {formatDate(user.subscriptionUntil)}
                      </div>
                    </td>
                    <td className="px-8 py-5 text-right">
                      {!isSuper && (
                        <div className="flex justify-end space-x-2 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button
                            onClick={() => setEditingUser(user)}
                            className="px-4 py-2 bg-blue-600 text-white rounded-xl text-xs font-bold hover:bg-blue-700 transition-all shadow-lg shadow-blue-200"
                          >
                            Управление
                          </button>
                          <button
                            onClick={() => confirm('Удалить пользователя навсегда? Это действие необратимо.') && onDeleteUser(user.id)}
                            className="w-8 h-8 flex items-center justify-center bg-rose-50 text-rose-500 rounded-xl hover:bg-rose-500 hover:text-white transition-all"
                            title="Удалить"
                          >
                            <i className="fas fa-trash-alt text-xs"></i>
                          </button>
                        </div>
                      )}
                      {isSuper && <span className="text-[10px] font-black text-slate-300 uppercase">Это Вы</span>}
                    </td>
                  </tr>
                );
              })}
              {filteredUsers.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-8 py-12 text-center text-slate-400 italic">
                    Пользователи не найдены
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Manual Activation Modal */}
      {editingUser && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
          <form onSubmit={handleSubscriptionUpdate} className="bg-white rounded-[3rem] w-full max-w-lg p-10 shadow-2xl animate-scaleIn relative overflow-hidden">
            <div className="absolute top-0 left-0 right-0 h-3 bg-gradient-to-r from-blue-500 to-indigo-600"></div>

            <h2 className="text-2xl font-black text-slate-900 mb-2 uppercase tracking-tight">Настройка доступа</h2>
            <p className="text-sm text-slate-400 font-bold mb-8 flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500"></span>
              {editingUser.name} ({editingUser.email})
            </p>

            <div className="space-y-6 mb-10">
              {/* Plan Selector */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Тарифный план</label>
                <div className="grid grid-cols-3 gap-2">
                  {PLANS.map(plan => (
                    <label key={plan} className="cursor-pointer">
                      <input
                        type="radio"
                        name="plan"
                        value={plan}
                        defaultChecked={editingUser.activePlan === plan || (!editingUser.activePlan && plan === 'Старт')}
                        className="peer hidden"
                      />
                      <div className="py-3 text-center bg-slate-50 border-2 border-slate-100 rounded-xl text-xs font-bold text-slate-500 peer-checked:border-blue-500 peer-checked:bg-blue-50 peer-checked:text-blue-600 transition-all">
                        {plan}
                      </div>
                    </label>
                  ))}
                </div>
              </div>

              {/* Date & Quick Actions */}
              <div>
                <label className="text-[10px] font-black text-slate-400 uppercase tracking-widest ml-2 mb-1 block">Дата окончания</label>
                <input
                  id="sub-until"
                  name="until"
                  type="date"
                  defaultValue={editingUser.subscriptionUntil ? editingUser.subscriptionUntil.split('T')[0] : ''}
                  className="w-full p-4 bg-slate-50 rounded-2xl font-bold outline-none border-2 border-transparent focus:border-blue-500 mb-3"
                />
                <div className="flex gap-2">
                  <button type="button" onClick={() => quickSetDate(1)} className="flex-1 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-100">+1 Месяц</button>
                  <button type="button" onClick={() => quickSetDate(3)} className="flex-1 py-2 bg-emerald-50 text-emerald-600 rounded-xl text-[10px] font-black uppercase hover:bg-emerald-100">+3 Месяца</button>
                  <button type="button" onClick={() => quickSetDate(12)} className="flex-1 py-2 bg-indigo-50 text-indigo-600 rounded-xl text-[10px] font-black uppercase hover:bg-indigo-100">+1 Год</button>
                </div>
              </div>

              {/* Trial Switch */}
              <label className="flex items-center space-x-4 p-4 bg-slate-50 rounded-2xl border border-slate-100 cursor-pointer hover:bg-slate-100 transition-colors">
                <input type="checkbox" name="isTrial" defaultChecked={editingUser.isTrial} className="w-5 h-5 rounded text-blue-600 focus:ring-blue-500 border-gray-300" />
                <div>
                  <div className="text-sm font-bold text-slate-900">Режим "Пробный период"</div>
                  <div className="text-[10px] text-slate-400 font-medium">Если включено, отображается уведомление о триале</div>
                </div>
              </label>
            </div>

            <div className="flex gap-4 pt-4 border-t border-slate-100">
              <button type="button" onClick={() => setEditingUser(null)} className="flex-1 py-4 bg-white border-2 border-slate-100 rounded-2xl font-bold text-slate-500 hover:bg-slate-50">Отмена</button>
              <button type="submit" className="flex-1 py-4 bg-blue-600 text-white rounded-2xl font-bold shadow-xl shadow-blue-500/30 hover:bg-blue-700 active:scale-95 transition-all">
                Сохранить доступ
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

const StatCard = ({ title, value, icon, color }: any) => (
  <div className="bg-white p-6 rounded-[2rem] border border-slate-100 shadow-sm flex items-center justify-between">
    <div>
      <div className="text-[10px] font-black uppercase text-slate-400 tracking-widest mb-1">{title}</div>
      <div className="text-3xl font-black text-slate-900">{value}</div>
    </div>
    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center text-xl ${color}`}>
      <i className={`fas ${icon}`}></i>
    </div>
  </div>
);

export default SuperadminPanel;
