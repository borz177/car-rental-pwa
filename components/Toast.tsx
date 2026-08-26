
import React, { useEffect } from 'react';

export interface ToastMessage {
  id: number;
  text: string;
  kind: 'error' | 'success' | 'info';
}

const STYLES: Record<ToastMessage['kind'], { bg: string; icon: string }> = {
  error:   { bg: 'bg-rose-600',    icon: 'fa-triangle-exclamation' },
  success: { bg: 'bg-emerald-600', icon: 'fa-circle-check' },
  info:    { bg: 'bg-slate-800',   icon: 'fa-circle-info' }
};

const ToastItem: React.FC<{ toast: ToastMessage; onClose: (id: number) => void }> = ({ toast, onClose }) => {
  useEffect(() => {
    // Ошибку держим дольше: её нужно успеть прочитать.
    const timeout = setTimeout(() => onClose(toast.id), toast.kind === 'error' ? 7000 : 3500);
    return () => clearTimeout(timeout);
  }, [toast.id, toast.kind, onClose]);

  const style = STYLES[toast.kind];

  return (
    <div
      onClick={() => onClose(toast.id)}
      className={`${style.bg} text-white rounded-xl shadow-lg px-4 py-3 flex items-start gap-3 cursor-pointer animate-scaleIn pointer-events-auto`}
    >
      <i className={`fas ${style.icon} mt-0.5 flex-shrink-0`}></i>
      <span className="text-sm font-medium leading-snug flex-1">{toast.text}</span>
      <i className="fas fa-xmark text-white/50 mt-0.5 flex-shrink-0"></i>
    </div>
  );
};

const ToastContainer: React.FC<{ toasts: ToastMessage[]; onClose: (id: number) => void }> = ({ toasts, onClose }) => {
  if (!toasts.length) return null;
  return (
    // pt-safe — чтобы на телефоне не залезало под вырез экрана.
    <div className="fixed top-0 inset-x-0 z-[200] pt-safe p-4 flex flex-col items-center gap-2 pointer-events-none">
      <div className="w-full max-w-md space-y-2">
        {toasts.map(t => <ToastItem key={t.id} toast={t} onClose={onClose} />)}
      </div>
    </div>
  );
};

export default ToastContainer;
