
import React, { useState } from 'react';
import { AppView, UserRole, User } from '../backend/src/types.ts';
import { NAVIGATION_ITEMS } from '../constants';

interface SidebarProps {
  currentView: AppView;
  userRole: UserRole;
  onNavigate: (view: AppView) => void;
  onLogout: () => void;
  userName: string;
  requestCount?: number;
  user?: User | null;
}

const Sidebar: React.FC<SidebarProps> = ({ currentView, userRole, onNavigate, onLogout, userName, requestCount, user }) => {
  const [contractsOpen, setContractsOpen] = useState(currentView === 'CONTRACTS' || currentView === 'CONTRACTS_ARCHIVE');
  
  const isSuperadmin = userRole === UserRole.SUPERADMIN;

  const filteredNav = NAVIGATION_ITEMS.filter(item => 
    item.roles.includes(userRole) && 
    item.id !== 'CONTRACTS_ARCHIVE' 
  );

  const getTrialDaysLeft = () => {
    if (!user?.subscriptionUntil) return 0;
    const now = new Date();
    const expiry = new Date(user.subscriptionUntil);
    const diff = expiry.getTime() - now.getTime();
    return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
  };

  const trialDays = getTrialDaysLeft();

  return (
    <div className="hidden md:flex fixed inset-y-0 left-0 w-64 bg-slate-900 text-white flex-col z-50 transition-transform duration-300">
      <div className="p-6 border-b border-slate-800 flex items-center space-x-3">
        <div className={`w-10 h-10 rounded-xl flex items-center justify-center shadow-lg ${isSuperadmin ? 'bg-amber-500 shadow-amber-500/20' : 'bg-blue-600 shadow-blue-500/20'}`}>
          <i className={`fas ${isSuperadmin ? 'fa-user-shield' : 'fa-car-side'} text-xl`}></i>
        </div>
        <div>
          <h1 className="font-bold text-lg tracking-tight">AutoPro AI</h1>
          <p className="text-[10px] text-slate-500 uppercase tracking-widest font-bold">{isSuperadmin ? 'Master Control' : 'Admin Panel'}</p>
        </div>
      </div>

      <nav className="flex-1 mt-6 px-4 space-y-1 overflow-y-auto custom-scrollbar">
        {user?.isTrial && trialDays > 0 && (
          <div className="mb-6 p-4 bg-blue-600/10 border border-blue-600/30 rounded-2xl">
             <div className="text-[10px] font-black text-blue-400 uppercase tracking-widest mb-2 flex items-center justify-between">
               <span>Пробный период</span>
               <i className="fas fa-info-circle"></i>
             </div>
             <div className="text-sm font-bold text-white mb-2">Осталось {trialDays} дн.</div>
             <button 
               onClick={() => onNavigate('TARIFFS')}
               className="w-full py-2 bg-blue-600 text-white text-[10px] font-black uppercase tracking-widest rounded-xl hover:bg-blue-700 transition-all shadow-lg shadow-blue-500/20"
             >
               Купить тариф
             </button>
          </div>
        )}

        {filteredNav.map(item => {
          if (item.id === 'CONTRACTS') {
            const isActive = currentView === 'CONTRACTS' || currentView === 'CONTRACTS_ARCHIVE';
            return (
              <div key={item.id} className="space-y-1">
                <button
                  onClick={() => setContractsOpen(!contractsOpen)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
                    isActive && !contractsOpen
                      ? 'bg-blue-600 text-white shadow-lg' 
                      : 'text-slate-400 hover:bg-slate-800 hover:text-white'
                  }`}
                >
                  <div className="flex items-center space-x-3">
                    <i className={`fas ${item.icon} w-5`}></i>
                    <span className="font-medium text-sm">{item.label}</span>
                  </div>
                  <i className={`fas fa-chevron-down text-[10px] transition-transform ${contractsOpen ? 'rotate-180' : ''}`}></i>
                </button>
                
                {contractsOpen && (
                  <div className="pl-9 space-y-1 animate-fadeIn">
                    <button
                      onClick={() => onNavigate('CONTRACTS')}
                      className={`w-full text-left px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                        currentView === 'CONTRACTS' ? 'text-blue-400 bg-blue-400/10' : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <i className="fas fa-play-circle mr-2 opacity-50"></i>
                      Активные
                    </button>
                    <button
                      onClick={() => onNavigate('CONTRACTS_ARCHIVE')}
                      className={`w-full text-left px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                        currentView === 'CONTRACTS_ARCHIVE' ? 'text-blue-400 bg-blue-400/10' : 'text-slate-500 hover:text-slate-300'
                      }`}
                    >
                      <i className="fas fa-history mr-2 opacity-50"></i>
                      Архив
                    </button>
                  </div>
                )}
              </div>
            );
          }

          const isSystemControl = item.id === 'SUPERADMIN_PANEL';
          const isActive = currentView === item.id;

          return (
            <button
              key={item.id}
              onClick={() => onNavigate(item.id as AppView)}
              className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
                isActive 
                  ? (isSystemControl ? 'bg-amber-500 text-white shadow-lg shadow-amber-900/50' : 'bg-blue-600 text-white shadow-lg shadow-blue-900/50')
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              } ${isSystemControl && !isActive ? 'border border-amber-500/20 text-amber-400/70' : ''}`}
            >
              <div className="flex items-center space-x-3">
                <i className={`fas ${item.icon} w-5`}></i>
                <span className="font-medium text-sm">{item.label}</span>
              </div>
              {item.badge && requestCount && requestCount > 0 && (
                <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">
                  {requestCount}
                </span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4 border-t border-slate-800">
        <div className="flex items-center space-x-3 mb-4 px-2">
          <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold shadow-inner ${isSuperadmin ? 'bg-gradient-to-tr from-amber-400 to-amber-600' : 'bg-gradient-to-tr from-blue-500 to-indigo-500'}`}>
            {userName.charAt(0)}
          </div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-semibold truncate">{userName}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-widest">{userRole}</p>
          </div>
        </div>
        <button 
          onClick={onLogout}
          className="w-full flex items-center space-x-3 px-4 py-3 rounded-2xl text-rose-400 hover:bg-rose-500/10 transition-all font-bold"
        >
          <i className="fas fa-sign-out-alt"></i>
          <span className="text-sm">Выйти</span>
        </button>
      </div>
    </div>
  );
};

export default Sidebar;
