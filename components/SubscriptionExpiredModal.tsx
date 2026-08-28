
import React from 'react';

interface SubscriptionExpiredModalProps {
  onRenew: () => void;
  onClose: () => void;
  title?: string;
  message?: string;
}

const SubscriptionExpiredModal: React.FC<SubscriptionExpiredModalProps> = ({
  onRenew,
  onClose,
  title = "Доступ ограничен",
  message = "Ваша подписка истекла или достигнут лимит тарифа. Для выполнения этого действия необходимо обновить тариф."
}) => {
  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-8 shadow-md animate-scaleIn relative overflow-hidden text-center border border-slate-200 dark:border-slate-600">

        <button
          onClick={onClose}
          className="absolute top-6 right-6 w-8 h-8 flex items-center justify-center bg-slate-100 dark:bg-slate-700 rounded-full text-slate-400 dark:text-slate-500 hover:bg-slate-200 hover:text-slate-900 transition-all z-20"
        >
          <i className="fas fa-times"></i>
        </button>

        {/* Decor elements */}
        <div className="absolute top-0 left-0 right-0 h-1.5 bg-gradient-to-r from-rose-500 to-orange-500"></div>
        <div className="absolute -top-10 -right-10 w-32 h-32 bg-rose-50 dark:bg-rose-500/10 rounded-full blur-2xl opacity-50 pointer-events-none"></div>
        <div className="absolute -bottom-10 -left-10 w-32 h-32 bg-orange-50 rounded-full blur-2xl opacity-50 pointer-events-none"></div>

        <div className="relative z-10 pt-4">
          <div className="w-14 h-14 mx-auto mb-6 bg-rose-50 dark:bg-rose-500/10 rounded-xl flex items-center justify-center shadow-inner">
            <i className="fas fa-lock text-3xl text-rose-500 dark:text-rose-400"></i>
          </div>

          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white mb-3 tracking-tight">
            {title}
          </h2>

          <p className="text-slate-500 dark:text-slate-400 text-sm font-medium mb-8 leading-relaxed px-4">
            {message}
          </p>

          <div className="space-y-3">
            <button
              onClick={onRenew}
              className="w-full py-4 bg-gradient-to-r from-slate-900 to-slate-800 text-white rounded-2xl font-semibold uppercase tracking-wide text-xs hover:shadow-md hover:scale-[1.02] transition-all flex items-center justify-center gap-3"
            >
              <span>Выбрать тариф</span>
              <i className="fas fa-arrow-right"></i>
            </button>

            <button
              onClick={onClose}
              className="w-full py-4 bg-transparent text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wide text-[10px] hover:text-slate-600 transition-colors"
            >
              Отмена
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default SubscriptionExpiredModal;
