
import React, { useState } from 'react';
import { createPortal } from 'react-dom';
import { AppNotification, AppView } from '../types';

interface NotificationBellProps {
  notifications: AppNotification[];
  onMarkRead: (id: string) => void;
  onMarkAllRead: () => void;
  onNavigate: (view: AppView) => void;
  dark?: boolean; // тёмная тема иконки (для светлой шапки на десктопе используется по умолчанию)
}

const ICONS: Record<string, string> = {
  NEW_REQUEST: 'fa-clipboard-list',
  SUPPORT_MESSAGE: 'fa-headset'
};

const timeAgo = (iso: string) => {
  const diff = Date.now() - new Date(iso).getTime();
  const min = Math.floor(diff / 60000);
  if (min < 1) return 'только что';
  if (min < 60) return `${min} мин назад`;
  const hours = Math.floor(min / 60);
  if (hours < 24) return `${hours} ч назад`;
  const days = Math.floor(hours / 24);
  return `${days} дн назад`;
};

const NotificationBell: React.FC<NotificationBellProps> = ({ notifications, onMarkRead, onMarkAllRead, onNavigate, dark }) => {
  const [open, setOpen] = useState(false);
  const unreadCount = notifications.filter(n => !n.isRead).length;

  const handleClick = (n: AppNotification) => {
    if (!n.isRead) onMarkRead(n.id);
    if (n.link) onNavigate(n.link as AppView);
    setOpen(false);
  };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen(o => !o)}
        className={`relative p-2 transition-colors ${dark ? 'text-slate-400 dark:text-slate-500 hover:text-blue-600 dark:hover:text-blue-400' : 'text-white/70 hover:text-white'}`}
      >
        <i className="fas fa-bell"></i>
        {unreadCount > 0 && (
          <span className="absolute top-0.5 right-0.5 min-w-[16px] h-4 px-1 bg-rose-500 text-white text-[9px] font-bold rounded-full flex items-center justify-center">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {/* Портал — TopNavbar сам fixed+z-40 и создаёт свой стекинг-контекст: без портала
          выпадающая панель оказалась бы заперта внутри него и могла уйти под BottomNav
          (z-50), несмотря на собственный z-index. */}
      {open && createPortal(
        <>
          <div className="fixed inset-0 z-[94] bg-slate-900/20 md:bg-transparent" onClick={() => setOpen(false)} />
          <div
            className="fixed left-4 right-4 top-20 md:left-auto md:right-4 md:top-16 md:w-96 bg-white dark:bg-slate-800 rounded-2xl shadow-lg border border-slate-100 dark:border-slate-700 z-[95] overflow-hidden animate-scaleIn"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center justify-between">
              <span className="font-semibold text-slate-900 dark:text-white text-sm">Уведомления</span>
              {unreadCount > 0 && (
                <button onClick={onMarkAllRead} className="text-[10px] font-semibold text-blue-600 dark:text-blue-400 uppercase tracking-wide hover:text-blue-700 dark:hover:text-blue-400">
                  Прочитать все
                </button>
              )}
            </div>

            <div className="max-h-[60vh] overflow-y-auto divide-y divide-slate-50 dark:divide-slate-800">
              {notifications.map(n => (
                <button
                  key={n.id}
                  onClick={() => handleClick(n)}
                  className={`w-full px-4 py-3 flex items-start gap-3 text-left hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${!n.isRead ? 'bg-blue-50/40 dark:bg-blue-500/10' : ''}`}
                >
                  <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${
                    n.type === 'SUPPORT_MESSAGE' ? 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400' : 'bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400'
                  }`}>
                    <i className={`fas ${ICONS[n.type] || 'fa-bell'} text-xs`}></i>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-slate-900 dark:text-white text-sm truncate">{n.title}</span>
                      {!n.isRead && <span className="w-1.5 h-1.5 bg-blue-500 rounded-full flex-shrink-0"></span>}
                    </div>
                    <div className="text-xs text-slate-500 dark:text-slate-400 truncate">{n.body}</div>
                    <div className="text-[10px] text-slate-400 dark:text-slate-500 font-medium mt-0.5">{timeAgo(n.createdAt)}</div>
                  </div>
                </button>
              ))}

              {notifications.length === 0 && (
                <div className="py-12 text-center">
                  <i className="fas fa-bell-slash text-2xl text-slate-200 dark:text-slate-700 mb-2"></i>
                  <div className="text-xs font-semibold text-slate-400 dark:text-slate-500">Уведомлений пока нет</div>
                </div>
              )}
            </div>
          </div>
        </>,
        document.body
      )}
    </div>
  );
};

export default NotificationBell;
