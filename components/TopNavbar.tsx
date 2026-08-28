
import React from 'react';
import { AppNotification, AppView } from '../types';
import NotificationBell from './NotificationBell';

interface TopNavbarProps {
  brandName: string;
  notifications: AppNotification[];
  onMarkNotificationRead: (id: string) => void;
  onMarkAllNotificationsRead: () => void;
  onNavigate: (view: AppView) => void;
}

const TopNavbar: React.FC<TopNavbarProps> = ({ brandName, notifications, onMarkNotificationRead, onMarkAllNotificationsRead, onNavigate }) => {
  return (
    <div className="md:hidden fixed top-0 left-0 right-0 pt-safe min-h-[4.5rem] bg-white/80 dark:bg-slate-800 backdrop-blur-xl border-b border-slate-200 dark:border-slate-600 z-40 px-6 flex items-center justify-between shadow-sm">
      <div className="flex items-center space-x-3 py-3">
        <div className="w-8 h-8 bg-blue-600 rounded-lg flex items-center justify-center text-white shadow-lg">
          <i className="fas fa-car-side text-xs"></i>
        </div>
        <span className="font-semibold text-slate-800 dark:text-slate-100 tracking-tight truncate max-w-[200px]">
          {brandName || 'AutoPro AI'}
        </span>
      </div>
      <div className="flex items-center space-x-1 py-3">
        <NotificationBell
          notifications={notifications}
          onMarkRead={onMarkNotificationRead}
          onMarkAllRead={onMarkAllNotificationsRead}
          onNavigate={onNavigate}
          dark
        />
      </div>
    </div>
  );
};

export default TopNavbar;
