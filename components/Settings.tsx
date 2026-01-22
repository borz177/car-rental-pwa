
import React, { useState } from 'react';
import { User, AppView, UserRole } from '../backend/src/types.ts';

interface SettingsProps {
  user: User | null;
  onUpdate: (updates: Partial<User>) => void;
  onNavigate: (view: AppView) => void;
  onLogout: () => void;
  currentMode?: 'MENU' | 'BRANDING';
}

const Settings: React.FC<SettingsProps> = ({ user, onUpdate, onNavigate, onLogout, currentMode = 'MENU' }) => {
  const [copied, setCopied] = useState(false);
  const [localMode, setLocalMode] = useState<'MENU' | 'BRANDING'>(currentMode);
  const [contractsExpanded, setContractsExpanded] = useState(false);
  
  // Guard clause with fallback to prevent blank screen
  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-400">
        <i className="fas fa-circle-notch animate-spin text-3xl mb-4"></i>
        <p className="font-bold">Загрузка данных пользователя...</p>
      </div>
    );
  }

  const publicLink = `${window.location.origin}?fleet=${user.publicSlug || 'autopro'}`;

  const copyLink = () => {
    navigator.clipboard.writeText(publicLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN;

  const menuItems = [
    { id: 'BRANDING', label: 'Настройки бренда', icon: 'fa-paint-brush', color: 'bg-blue-100 text-blue-600', desktopShow: true, adminOnly: true },
    { id: 'TARIFFS', label: 'Управление подпиской', icon: 'fa-credit-card', color: 'bg-emerald-100 text-emerald-600', desktopShow: true, adminOnly: true },
    { id: 'CONTRACTS_SUB', label: 'Договоры', icon: 'fa-file-invoice-dollar', color: 'bg-indigo-100 text-indigo-600', expandable: true, desktopShow: false, adminOnly: true },
    { id: 'CLIENTS', label: 'Клиенты', icon: 'fa-users', color: 'bg-emerald-100 text-emerald-600', desktopShow: false, adminOnly: true },
    { id: 'STAFF', label: 'Сотрудники', icon: 'fa-user-tie', color: 'bg-indigo-100 text-indigo-600', desktopShow: false, adminOnly: true },
    { id: 'INVESTORS', label: 'Инвесторы', icon: 'fa-handshake', color: 'bg-amber-100 text-amber-600', desktopShow: false, adminOnly: true },
    { id: 'CASHBOX', label: 'Касса и Финансы', icon: 'fa-wallet', color: 'bg-rose-100 text-rose-600', desktopShow: false, adminOnly: true },
  ];

  if (localMode === 'BRANDING' && isAdmin) {
    return (
      <div className="max-w-4xl mx-auto space-y-8 animate-fadeIn pb-24 md:pb-0">
        <button 
          onClick={() => setLocalMode('MENU')} 
          className="flex items-center space-x-2 text-slate-500 font-bold hover:text-blue-600 transition-all mb-4"
        >
          <i className="fas fa-arrow-left"></i>
          <span>Назад</span>
        </button>

        <div className="bg-white p-8 md:p-12 rounded-[3rem] shadow-sm border border-slate-100">
          <h2 className="text-3xl font-black text-slate-900 mb-8">Брендинг компании</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-6">
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2">Название бренда</label>
                <input 
                  defaultValue={user.publicBrandName} 
                  placeholder="Напр. MyRentals"
                  className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-2xl font-bold focus:border-blue-500 outline-none transition-all"
                  onChange={(e) => onUpdate({ publicBrandName: e.target.value })}
                />
              </div>
              <div>
                <label className="block text-[10px] font-black text-slate-400 uppercase tracking-widest mb-3 ml-2">ID профиля (URL)</label>
                <input 
                  defaultValue={user.publicSlug} 
                  placeholder="my-fleet"
                  className="w-full p-5 bg-slate-50 border-2 border-transparent rounded-2xl font-bold focus:border-blue-500 outline-none transition-all"
                  onChange={(e) => onUpdate({ publicSlug: e.target.value })}
                />
              </div>
            </div>
            <div className="bg-blue-50 p-8 rounded-[2.5rem] border-2 border-blue-100 flex flex-col justify-center items-center text-center">
               <div className="w-16 h-16 bg-white rounded-2xl flex items-center justify-center text-blue-600 text-2xl shadow-sm mb-4">
                 <i className="fas fa-external-link-alt"></i>
               </div>
               <p className="text-xs font-bold text-blue-800 leading-relaxed">Название бренда будет отображаться в шапке мобильного приложения и в заголовке каталога.</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 p-8 md:p-12 rounded-[3rem] text-white relative overflow-hidden shadow-2xl">
          <div className="relative z-10">
            <h3 className="text-2xl font-black mb-4 flex items-center">
              <i className="fas fa-link mr-4 text-blue-400"></i> Ссылка каталога
            </h3>
            <p className="text-slate-400 font-medium mb-8 max-w-lg">Ваш персональный URL для бронирования клиентами. Разместите его в соцсетях или отправьте напрямую.</p>
            <div className="bg-white/5 border border-white/10 p-2 rounded-3xl flex flex-col md:flex-row items-center gap-4">
              <div className="flex-1 px-6 py-4 text-xs font-mono truncate opacity-60 w-full md:w-auto text-center md:text-left">{publicLink}</div>
              <button 
                onClick={copyLink}
                className={`w-full md:w-auto px-10 py-4 rounded-2xl font-black transition-all ${copied ? 'bg-emerald-500' : 'bg-blue-600 hover:bg-blue-700'} shadow-lg`}
              >
                {copied ? <><i className="fas fa-check mr-2"></i> Готово</> : 'Копировать ссылку'}
              </button>
            </div>
          </div>
          <i className="fas fa-globe absolute -right-10 -bottom-10 text-[15rem] text-white/5 rotate-12"></i>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6 animate-fadeIn pb-24 md:pb-0">
      <div className="px-2">
        <h2 className="text-3xl font-black text-slate-900">{isAdmin ? 'Настройки и управление' : 'Личный кабинет'}</h2>
        <p className="text-slate-400 font-bold mt-1 uppercase text-[10px] tracking-widest hidden md:block">
          {isAdmin ? 'Конфигурация вашей компании и аккаунта' : 'Управление вашим профилем и бронированиями'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Профиль и Выход */}
        <div className="bg-white p-8 rounded-[3rem] shadow-sm border border-slate-100 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center space-x-6">
              <div className="w-20 h-20 rounded-[1.8rem] bg-gradient-to-tr from-slate-800 to-slate-950 flex items-center justify-center text-white text-3xl font-black shadow-xl">
                {user.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-2xl font-black text-slate-900">{user.name}</h3>
                <p className="text-sm text-slate-400 font-bold uppercase tracking-widest">{user.role}</p>
                {isAdmin && (
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-black uppercase ${user.isTrial ? 'bg-blue-100 text-blue-600' : 'bg-emerald-100 text-emerald-600'}`}>
                      {user.activePlan || (user.isTrial ? 'Триал' : 'Базовый')}
                    </span>
                  </div>
                )}
              </div>
            </div>
            
            <div className="mt-8 p-6 bg-slate-50 rounded-2xl border border-slate-100">
               <div className="text-[10px] font-black text-slate-400 uppercase tracking-widest mb-1">Email аккаунта</div>
               <div className="font-bold text-slate-900 truncate">{user.email}</div>
            </div>
          </div>
          
          <button 
            onClick={onLogout}
            className="w-full mt-8 py-5 bg-rose-50 text-rose-500 rounded-2xl font-black flex items-center justify-center space-x-3 hover:bg-rose-100 transition-all border-2 border-transparent hover:border-rose-200"
          >
            <i className="fas fa-sign-out-alt"></i>
            <span>Выйти из системы</span>
          </button>
        </div>

        {/* Настройки на десктопе */}
        <div className="space-y-4">
          {menuItems.map(item => {
            const shouldShow = (item.desktopShow || (typeof window !== 'undefined' && window.innerWidth < 768)) && 
                             (!item.adminOnly || isAdmin);
            if (!shouldShow) return null;

            return (
              <div key={item.id} className="w-full">
                <button 
                  onClick={() => {
                    if (item.expandable) setContractsExpanded(!contractsExpanded);
                    else if (item.id === 'BRANDING') setLocalMode('BRANDING');
                    else onNavigate(item.id as AppView);
                  }}
                  className={`w-full bg-white p-6 rounded-[2rem] border border-slate-100 flex items-center justify-between group active:scale-[0.98] transition-all shadow-sm ${contractsExpanded && item.expandable ? 'mb-2' : ''}`}
                >
                  <div className="flex items-center space-x-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${item.color} shadow-sm transition-transform group-hover:scale-110`}>
                      <i className={`fas ${item.icon} text-lg`}></i>
                    </div>
                    <span className="font-black text-slate-700 uppercase tracking-tight text-sm">{item.label}</span>
                  </div>
                  <i className={`fas ${item.expandable ? (contractsExpanded ? 'fa-chevron-up' : 'fa-chevron-down') : 'fa-chevron-right'} text-slate-200 group-hover:text-blue-500 transition-colors`}></i>
                </button>

                {item.expandable && contractsExpanded && (
                  <div className="grid grid-cols-2 gap-3 px-2 mb-4 animate-slideDown">
                    <button 
                      onClick={() => onNavigate('CONTRACTS')}
                      className="bg-blue-50 p-5 rounded-2xl border-2 border-blue-100 flex flex-col items-center text-center space-y-2 active:scale-95 transition-all"
                    >
                      <i className="fas fa-play-circle text-blue-600 text-xl"></i>
                      <span className="text-[10px] font-black text-blue-800 uppercase tracking-widest">Активные</span>
                    </button>
                    <button 
                      onClick={() => onNavigate('CONTRACTS_ARCHIVE')}
                      className="bg-slate-50 p-5 rounded-2xl border-2 border-slate-200 flex flex-col items-center text-center space-y-2 active:scale-95 transition-all"
                    >
                      <i className="fas fa-history text-slate-600 text-xl"></i>
                      <span className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Архив</span>
                    </button>
                  </div>
                )}
              </div>
            );
          })}
          
          {user.role === UserRole.CLIENT && (
             <div className="bg-indigo-50 p-8 rounded-[2.5rem] border border-indigo-100 text-center">
               <i className="fas fa-star text-indigo-400 text-3xl mb-4"></i>
               <p className="text-xs font-bold text-indigo-700">Спасибо, что пользуетесь нашим сервисом!</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Settings;
