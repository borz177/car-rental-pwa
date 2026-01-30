
import React, { useState } from 'react';
import { AppView, UserRole } from '../types';
import { NAVIGATION_ITEMS } from '../constants';

interface BottomNavProps {
  currentView: AppView;
  userRole: UserRole;
  onNavigate: (view: AppView) => void;
  requestCount?: number;
  isClientMode?: boolean;
}

const BottomNav: React.FC<BottomNavProps> = ({ currentView, userRole, onNavigate, requestCount, isClientMode }) => {
  const [showMenu, setShowMenu] = useState(false);

  const handleNavigate = (view: AppView) => {
    onNavigate(view);
    setShowMenu(false);
  };

  const menuItems = NAVIGATION_ITEMS.filter(item =>
    item.roles.includes(userRole) &&
    !['DASHBOARD', 'CARS', 'REQUESTS', 'SETTINGS', 'CONTRACTS', 'CONTRACTS_ARCHIVE', 'AI_ADVISOR'].includes(item.id) &&
    item.id !== 'CLIENT_CATALOG' &&
    item.id !== 'CLIENT_MY_BOOKINGS'
  );

  return (
    <>
      {showMenu && !isClientMode && (
        <div className="md:hidden fixed inset-0 z-[55] flex flex-col justify-end p-4">
          <div
            className="absolute inset-0 bg-slate-900/60 backdrop-blur-sm animate-fadeIn"
            onClick={() => setShowMenu(false)}
          ></div>
          <div className="relative bg-white rounded-[3rem] p-8 shadow-2xl animate-slideUp overflow-hidden transition-all duration-500">
            <div className="flex justify-between items-center mb-8 px-2">
              <h3 className="font-black text-slate-900 uppercase tracking-widest text-xs">Быстрые действия</h3>
              <button onClick={() => setShowMenu(false)} className="w-10 h-10 flex items-center justify-center text-slate-400 bg-slate-50 rounded-full">
                <i className="fas fa-times"></i>
              </button>
            </div>

            <div className="grid grid-cols-3 gap-y-8 gap-x-4">
              <button onClick={() => handleNavigate('CASHBOX')} className="flex flex-col items-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-emerald-500 text-white flex items-center justify-center shadow-lg"><i className="fas fa-plus-circle text-xl"></i></div>
                <span className="text-[10px] font-black text-emerald-600 uppercase text-center">Приход</span>
              </button>
              <button onClick={() => handleNavigate('CASHBOX')} className="flex flex-col items-center space-y-3">
                <div className="w-14 h-14 rounded-2xl bg-rose-500 text-white flex items-center justify-center shadow-lg"><i className="fas fa-minus-circle text-xl"></i></div>
                <span className="text-[10px] font-black text-rose-600 uppercase text-center">Расход</span>
              </button>
              {menuItems.map(item => (
                <button key={item.id} onClick={() => handleNavigate(item.id as AppView)} className="flex flex-col items-center space-y-3">
                  <div className="w-14 h-14 rounded-2xl bg-slate-50 text-slate-400 flex items-center justify-center active:scale-90 transition-all"><i className={`fas ${item.icon} text-xl`}></i></div>
                  <span className="text-[10px] font-bold text-slate-500 text-center uppercase tracking-tighter">{item.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-white/90 backdrop-blur-xl border-t border-slate-200 z-50 px-2 pb-safe shadow-[0_-4px_20px_-5px_rgba(0,0,0,0.1)]">
        <div className={`flex justify-between items-center h-20 pb-2 ${isClientMode ? 'px-8' : ''}`}>
          {!isClientMode ? (
            <>
              <NavItem id="DASHBOARD" icon="fa-chart-pie" label="Дашборд" currentView={currentView} onNavigate={handleNavigate} />
              <NavItem id="CARS" icon="fa-car" label="Автопарк" currentView={currentView} onNavigate={handleNavigate} />
              <div className="relative -top-5">
                <button onClick={() => setShowMenu(!showMenu)} className="w-14 h-14 rounded-2xl bg-blue-600 text-white shadow-xl shadow-blue-500/40 flex items-center justify-center transform active:scale-90 transition-all duration-300">
                  <i className={`fas ${showMenu ? 'fa-times' : 'fa-plus'} text-xl`}></i>
                </button>
              </div>
              <NavItem id="REQUESTS" icon="fa-clipboard-list" label="Заявки" currentView={currentView} onNavigate={handleNavigate} badge={requestCount} />
              <NavItem id="SETTINGS" icon="fa-cog" label="Еще" currentView={currentView} onNavigate={handleNavigate} />
            </>
          ) : (
            <>
              <NavItem id="CLIENT_CATALOG" icon="fa-search" label="Каталог" currentView={currentView} onNavigate={handleNavigate} />
              <NavItem id="CLIENT_MY_BOOKINGS" icon="fa-calendar-check" label="Брони" currentView={currentView} onNavigate={handleNavigate} />
              <NavItem id="SETTINGS" icon="fa-user-circle" label="Кабинет" currentView={currentView} onNavigate={handleNavigate} />
            </>
          )}
        </div>
      </div>
    </>
  );
};

const NavItem = ({ id, icon, label, currentView, onNavigate, badge }: any) => {
  const isActive = currentView === id || (id === 'SETTINGS' && (currentView === 'CONTRACTS' || currentView === 'CONTRACTS_ARCHIVE' || currentView === 'BRANDING_SETTINGS'));
  
  return (
    <button
      onClick={() => onNavigate(id)}
      className={`flex flex-col items-center justify-center flex-1 h-full space-y-1 transition-all ${
        isActive ? 'text-blue-600' : 'text-slate-400'
      }`}
    >
      <div className="relative">
        <i className={`fas ${icon} text-lg`}></i>
        {badge && badge > 0 && (
          <span className="absolute -top-1 -right-2 bg-rose-500 text-white text-[8px] w-4 h-4 flex items-center justify-center rounded-full font-bold">
            {badge}
          </span>
        )}
      </div>
      <span className="text-[10px] font-bold uppercase tracking-widest">{label}</span>
    </button>
  );
};

export default BottomNav;
