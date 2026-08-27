
import React, { useState } from 'react';
import { AppView, UserRole, User, AppNotification } from '../types';
import { NAVIGATION_ITEMS } from '../constants';
import NotificationBell from './NotificationBell';
import { getPlanFeatures } from '../services/planFeatures';

interface SidebarProps {
  currentView: AppView;
  onNavigate: (view: AppView) => void;
  onLogout: () => void;
  userName: string;
  requestCount?: number;
  rentalCount?: number;
  bookingCount?: number;
  user?: User | null;
  notifications: AppNotification[];
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
}

const Sidebar: React.FC<SidebarProps> = ({
  currentView, onNavigate, onLogout, userName, requestCount, rentalCount, bookingCount, user,
  notifications, onMarkNotificationRead, onMarkAllNotificationsRead
}) => {
  const [contractsOpen, setContractsOpen] = useState(currentView === 'CONTRACTS' || currentView === 'CONTRACTS_ARCHIVE' || currentView === 'BOOKINGS');
  const [showUserMenu, setShowUserMenu] = useState(false);

  const userRole = user?.role || UserRole.CLIENT;
  const isSuperadmin = userRole === UserRole.SUPERADMIN;
  const isStaff = userRole === UserRole.STAFF;
  const permissions = user?.permissions;
  const planFeatures = getPlanFeatures(user);

  const filteredNav = NAVIGATION_ITEMS.filter(item => {
    if (!item.roles.includes(userRole)) return false;
    if (['CONTRACTS_ARCHIVE', 'BOOKINGS'].includes(item.id)) return false;

    // Tariff-based visibility — календарь и печать с тарифа "Бизнес", сотрудники и инвесторы только с "Премиум"
    if (item.id === 'CALENDAR' && !planFeatures.calendar) return false;
    if (item.id === 'STAFF' && !planFeatures.staff) return false;
    if (item.id === 'INVESTORS' && !planFeatures.investors) return false;

    // Role-based visibility
    if (isStaff) {
      if (item.id === 'STAFF') return false; // Staff can't see staff list
      if (['REPORTS', 'CASHBOX', 'INVESTORS'].includes(item.id) && !permissions?.canViewDocs) return false;
    }

    return true;
  });

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
      <div className="p-4 border-b border-slate-800 relative flex items-center gap-1">
        <button
          onClick={() => setShowUserMenu(!showUserMenu)}
          className="flex-1 min-w-0 flex items-center space-x-3 text-left p-2 rounded-2xl hover:bg-slate-800 transition-all"
        >
          <div className={`w-10 h-10 rounded-full flex-shrink-0 flex items-center justify-center text-sm font-bold shadow-inner ${isSuperadmin ? 'bg-gradient-to-tr from-amber-400 to-amber-600' : 'bg-gradient-to-tr from-blue-500 to-indigo-500'}`}>{userName.charAt(0)}</div>
          <div className="flex-1 overflow-hidden">
            <p className="text-sm font-semibold truncate text-white">{userName}</p>
            <p className="text-[10px] text-slate-500 uppercase tracking-wide">{userRole}</p>
          </div>
          <i className={`fas fa-chevron-down text-slate-500 text-xs transition-transform ${showUserMenu ? 'rotate-180' : ''}`}></i>
        </button>

        <NotificationBell
          notifications={notifications}
          onMarkRead={onMarkNotificationRead}
          onMarkAllRead={onMarkAllNotificationsRead}
          onNavigate={onNavigate}
        />

        {showUserMenu && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)}></div>
            <div className="absolute top-full left-4 right-4 mt-2 bg-slate-700 rounded-2xl shadow-md z-50 overflow-hidden animate-scaleIn py-2">
              <button
                onClick={() => { onNavigate('SETTINGS'); setShowUserMenu(false); }}
                className="w-full px-4 py-3 text-left text-sm font-medium hover:bg-slate-600 text-slate-300 flex items-center space-x-3"
              >
                <i className="fas fa-cog w-4"></i> <span>Настройки</span>
              </button>
              <button
                onClick={onLogout}
                className="w-full px-4 py-3 text-left text-sm font-bold hover:bg-rose-500/20 text-rose-400 flex items-center space-x-3"
              >
                <i className="fas fa-sign-out-alt w-4"></i> <span>Выйти</span>
              </button>
            </div>
          </>
        )}
      </div>

      <nav className="flex-1 mt-4 px-4 space-y-1 overflow-y-auto custom-scrollbar">
        {user?.isTrial && trialDays > 0 && (
          <div className="mb-4 p-4 bg-blue-600/10 border border-blue-600/30 rounded-2xl">
             <div className="text-[10px] font-semibold text-blue-400 uppercase tracking-wide mb-2 flex items-center justify-between">
               <span>Пробный период</span>
               <i className="fas fa-info-circle"></i>
             </div>
             <div className="text-sm font-bold text-white mb-2">Осталось {trialDays} дн.</div>
             <button onClick={() => onNavigate('TARIFFS')} className="w-full py-2 bg-blue-600 text-white text-[10px] font-semibold uppercase tracking-wide rounded-xl hover:bg-blue-700 transition-all shadow-lg">Купить тариф</button>
          </div>
        )}

        {filteredNav.map(item => {
          if (item.id === 'CONTRACTS') {
            const isActive = currentView === 'CONTRACTS' || currentView === 'CONTRACTS_ARCHIVE' || currentView === 'BOOKINGS';
            return (
              <div key={item.id} className="space-y-1">
                <button
                  onClick={() => setContractsOpen(!contractsOpen)}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-all ${
                    isActive && !contractsOpen ? 'bg-blue-600 text-white shadow-lg' : 'text-slate-400 hover:bg-slate-800 hover:text-white'
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
                    <button onClick={() => onNavigate('BOOKINGS')} className={`w-full text-left px-4 py-2 rounded-lg text-xs font-bold transition-all flex justify-between items-center ${currentView === 'BOOKINGS' ? 'text-amber-400 bg-amber-400/10' : 'text-slate-500 hover:text-slate-300'}`}>
                      <span><i className="fas fa-calendar-alt mr-2 opacity-50"></i>Бронирования</span>
                      {bookingCount && bookingCount > 0 ? <span className="bg-amber-500 text-white px-1.5 py-0.5 rounded text-[8px]">{bookingCount}</span> : null}
                    </button>
                    <button onClick={() => onNavigate('CONTRACTS')} className={`w-full text-left px-4 py-2 rounded-lg text-xs font-bold transition-all flex justify-between items-center ${currentView === 'CONTRACTS' ? 'text-blue-400 bg-blue-400/10' : 'text-slate-500 hover:text-slate-300'}`}>
                      <span><i className="fas fa-play-circle mr-2 opacity-50"></i>Активные</span>
                      {rentalCount && rentalCount > 0 ? <span className="bg-blue-500 text-white px-1.5 py-0.5 rounded text-[8px]">{rentalCount}</span> : null}
                    </button>
                    <button onClick={() => onNavigate('CONTRACTS_ARCHIVE')} className={`w-full text-left px-4 py-2 rounded-lg text-xs font-bold transition-all ${currentView === 'CONTRACTS_ARCHIVE' ? 'text-blue-400 bg-blue-400/10' : 'text-slate-500 hover:text-slate-300'}`}>
                      <i className="fas fa-history mr-2 opacity-50"></i>Архив
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
                  ? (isSystemControl ? 'bg-amber-500 text-white shadow-lg' : 'bg-blue-600 text-white shadow-lg')
                  : 'text-slate-400 hover:bg-slate-800 hover:text-white'
              }`}
            >
              <div className="flex items-center space-x-3">
                <i className={`fas ${item.icon} w-5`}></i>
                <span className="font-medium text-sm">{item.label}</span>
              </div>
              {item.badge && requestCount && requestCount > 0 && (
                <span className="bg-rose-500 text-white text-[10px] px-2 py-0.5 rounded-full font-bold">{requestCount}</span>
              )}
            </button>
          );
        })}
      </nav>

      <div className="p-4">
        <div className="text-center text-[9px] text-slate-600 font-bold uppercase tracking-wide">
           AutoPro AI &copy; 2024
        </div>
      </div>
    </div>
  );
};

export default Sidebar;