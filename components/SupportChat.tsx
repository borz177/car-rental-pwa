
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { User, UserRole, SupportMessage, SupportThread } from '../types';
import BackendAPI from '../services/offlineApi';

interface SupportChatProps {
  currentUser: User;
}

const timeLabel = (iso: string) =>
  new Date(iso).toLocaleString('ru-RU', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' });

// Полноэкранная лента сообщений — общая для админа (один тред с поддержкой)
// и суперадмина (тред с конкретным выбранным владельцем автопарка).
const MessageThread: React.FC<{
  messages: SupportMessage[];
  currentUserId: string;
  onSend: (body: string) => Promise<void>;
  placeholder: string;
}> = ({ messages, currentUserId, onSend, placeholder }) => {
  const [text, setText] = useState('');
  const [sending, setSending] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ block: 'end' });
  }, [messages.length]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = text.trim();
    if (!body || sending) return;
    setSending(true);
    setText('');
    try {
      await onSend(body);
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.map(m => {
          const mine = m.fromUserId === currentUserId;
          return (
            <div key={m.id} className={`flex ${mine ? 'justify-end' : 'justify-start'}`}>
              <div className={`max-w-[75%] px-4 py-2.5 rounded-2xl ${
                mine ? 'bg-blue-600 text-white rounded-br-md' : 'bg-slate-100 dark:bg-slate-700 text-slate-900 dark:text-white rounded-bl-md'
              }`}>
                {m.isBroadcast && (
                  <div className={`text-[9px] font-bold uppercase tracking-wide mb-1 ${mine ? 'text-blue-200' : 'text-slate-400 dark:text-slate-500'}`}>
                    Всем владельцам
                  </div>
                )}
                <div className="text-sm whitespace-pre-wrap break-words">{m.body}</div>
                <div className={`text-[10px] mt-1 text-right ${mine ? 'text-blue-200' : 'text-slate-400 dark:text-slate-500'}`}>{timeLabel(m.createdAt)}</div>
              </div>
            </div>
          );
        })}
        {messages.length === 0 && (
          <div className="h-full flex flex-col items-center justify-center text-center py-12">
            <i className="fas fa-comments text-3xl text-slate-200 dark:text-slate-700 mb-3"></i>
            <div className="text-sm font-semibold text-slate-400 dark:text-slate-500">Сообщений пока нет</div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>

      <form onSubmit={handleSend} className="p-3 border-t border-slate-100 dark:border-slate-700 flex items-center gap-2 flex-shrink-0">
        <input
          value={text}
          onChange={e => setText(e.target.value)}
          placeholder={placeholder}
          className="flex-1 px-4 py-3 bg-slate-50 dark:bg-slate-700 rounded-xl text-sm font-medium outline-none border-2 border-transparent focus:border-blue-500 transition-all"
        />
        <button
          type="submit"
          disabled={!text.trim() || sending}
          className="w-11 h-11 bg-blue-600 text-white rounded-xl flex items-center justify-center disabled:opacity-40 active:scale-95 transition-all flex-shrink-0"
        >
          <i className="fas fa-paper-plane text-sm"></i>
        </button>
      </form>
    </div>
  );
};

const SupportChat: React.FC<SupportChatProps> = ({ currentUser }) => {
  const isSuperadmin = currentUser.role === UserRole.SUPERADMIN;

  const [messages, setMessages] = useState<SupportMessage[]>([]);
  const [threads, setThreads] = useState<SupportThread[]>([]);
  const [selectedAdminId, setSelectedAdminId] = useState<string | null>(null);
  const [showBroadcast, setShowBroadcast] = useState(false);
  const [broadcastText, setBroadcastText] = useState('');
  const [broadcastSending, setBroadcastSending] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadThreads = useCallback(async () => {
    const data = await BackendAPI.getSupportThreads();
    setThreads(data);
  }, []);

  const loadMessages = useCallback(async (adminId?: string) => {
    const data = await BackendAPI.getSupportMessages(adminId);
    setMessages(data);
  }, []);

  // Первичная загрузка
  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        if (isSuperadmin) await loadThreads();
        else await loadMessages();
      } finally {
        setLoading(false);
      }
    })();
  }, [isSuperadmin, loadThreads, loadMessages]);

  // Открытие треда суперадмином
  useEffect(() => {
    if (isSuperadmin && selectedAdminId) {
      loadMessages(selectedAdminId);
      BackendAPI.markSupportRead(selectedAdminId).then(loadThreads).catch(() => {});
    }
  }, [isSuperadmin, selectedAdminId, loadMessages, loadThreads]);

  // Обычный пользователь читает свой единственный тред сразу.
  useEffect(() => {
    if (!isSuperadmin) BackendAPI.markSupportRead().catch(() => {});
  }, [isSuperadmin]);

  // Лёгкий поллинг, пока чат открыт — приложение не держит WebSocket-соединения.
  useEffect(() => {
    const interval = setInterval(() => {
      if (isSuperadmin) {
        loadThreads();
        if (selectedAdminId) loadMessages(selectedAdminId);
      } else {
        loadMessages();
      }
    }, 15000);
    return () => clearInterval(interval);
  }, [isSuperadmin, selectedAdminId, loadThreads, loadMessages]);

  const handleSend = async (body: string) => {
    await BackendAPI.sendSupportMessage(body, isSuperadmin ? { toUserId: selectedAdminId! } : undefined);
    await loadMessages(selectedAdminId || undefined);
  };

  const handleBroadcast = async (e: React.FormEvent) => {
    e.preventDefault();
    const body = broadcastText.trim();
    if (!body || broadcastSending) return;
    setBroadcastSending(true);
    try {
      await BackendAPI.sendSupportMessage(body, { broadcast: true });
      setBroadcastText('');
      setShowBroadcast(false);
      await loadThreads();
    } finally {
      setBroadcastSending(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24 text-slate-300 dark:text-slate-600">
        <i className="fas fa-circle-notch fa-spin text-2xl"></i>
      </div>
    );
  }

  // --- ADMIN: один тред с поддержкой ---
  if (!isSuperadmin) {
    return (
      <div className="animate-fadeIn h-[calc(100vh-11rem)] md:h-[calc(100vh-8rem)]">
        <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 h-full flex flex-col overflow-hidden">
          <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3 flex-shrink-0">
            <div className="w-10 h-10 rounded-xl bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 flex items-center justify-center">
              <i className="fas fa-headset"></i>
            </div>
            <div>
              <div className="font-semibold text-slate-900 dark:text-white">Техподдержка</div>
              <div className="text-[11px] text-slate-400 dark:text-slate-500 font-medium">Обычно отвечаем в течение дня</div>
            </div>
          </div>
          <MessageThread
            messages={messages}
            currentUserId={currentUser.id}
            onSend={handleSend}
            placeholder="Напишите сообщение…"
          />
        </div>
      </div>
    );
  }

  // --- SUPERADMIN: инбокс тредов + выбранный тред ---
  const selectedThread = threads.find(t => t.userId === selectedAdminId);

  return (
    <div className="animate-fadeIn space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Поддержка</h2>
          <p className="text-slate-400 dark:text-slate-500 font-semibold uppercase text-[10px] tracking-wide mt-0.5">Переписка с владельцами автопарков</p>
        </div>
        <button
          onClick={() => setShowBroadcast(true)}
          className="px-4 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-xs uppercase tracking-wide hover:bg-blue-700 active:scale-95 transition-all flex items-center gap-2"
        >
          <i className="fas fa-bullhorn"></i>
          <span>Всем</span>
        </button>
      </div>

      <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 h-[calc(100vh-14rem)] md:h-[calc(100vh-11rem)] flex overflow-hidden">
        {/* Список тредов */}
        <div className={`w-full md:w-80 border-r border-slate-100 dark:border-slate-700 flex-shrink-0 overflow-y-auto ${selectedAdminId ? 'hidden md:block' : ''}`}>
          {threads.map(t => (
            <button
              key={t.userId}
              onClick={() => setSelectedAdminId(t.userId)}
              className={`w-full px-4 py-3 flex items-center gap-3 text-left border-b border-slate-50 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-700 transition-colors ${
                selectedAdminId === t.userId ? 'bg-blue-50 dark:bg-blue-500/10' : ''
              }`}
            >
              <div className="w-10 h-10 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 font-semibold uppercase flex-shrink-0">
                {t.name.charAt(0)}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-semibold text-slate-900 dark:text-white text-sm truncate">{t.name}</span>
                  {t.unread > 0 && (
                    <span className="w-5 h-5 bg-rose-500 text-white text-[10px] font-bold rounded-full flex items-center justify-center flex-shrink-0">
                      {t.unread}
                    </span>
                  )}
                </div>
                <div className="text-xs text-slate-400 dark:text-slate-500 truncate">{t.lastMessage || 'Нет сообщений'}</div>
              </div>
            </button>
          ))}
          {threads.length === 0 && (
            <div className="p-8 text-center text-sm font-medium text-slate-400 dark:text-slate-500">Владельцев автопарков пока нет</div>
          )}
        </div>

        {/* Выбранный тред */}
        <div className={`flex-1 flex-col ${selectedAdminId ? 'flex' : 'hidden md:flex'}`}>
          {selectedThread ? (
            <>
              <div className="px-4 py-3 border-b border-slate-100 dark:border-slate-700 flex items-center gap-3 flex-shrink-0">
                <button onClick={() => setSelectedAdminId(null)} className="md:hidden p-1 -ml-1 text-slate-400 dark:text-slate-500">
                  <i className="fas fa-arrow-left"></i>
                </button>
                <div className="w-9 h-9 rounded-xl bg-slate-100 dark:bg-slate-700 flex items-center justify-center text-slate-500 dark:text-slate-400 font-semibold uppercase">
                  {selectedThread.name.charAt(0)}
                </div>
                <div className="min-w-0">
                  <div className="font-semibold text-slate-900 dark:text-white text-sm truncate">{selectedThread.name}</div>
                  <div className="text-[11px] text-slate-400 dark:text-slate-500 truncate">{selectedThread.email}</div>
                </div>
              </div>
              <MessageThread
                messages={messages}
                currentUserId={currentUser.id}
                onSend={handleSend}
                placeholder={`Ответить ${selectedThread.name}…`}
              />
            </>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <i className="fas fa-comments text-3xl text-slate-200 dark:text-slate-700 mb-3"></i>
              <div className="text-sm font-semibold text-slate-400 dark:text-slate-500">Выберите переписку слева</div>
            </div>
          )}
        </div>
      </div>

      {showBroadcast && (
        <div className="fixed inset-0 z-[90] bg-slate-900/60 backdrop-blur-sm flex items-center justify-center p-4">
          <form onSubmit={handleBroadcast} className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-md p-6 shadow-lg animate-scaleIn">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-2xl bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400 flex items-center justify-center">
                <i className="fas fa-bullhorn"></i>
              </div>
              <div>
                <h3 className="font-semibold text-lg text-slate-900 dark:text-white">Сообщение всем</h3>
                <p className="text-xs text-slate-400 dark:text-slate-500">Получат все владельцы автопарков ({threads.length})</p>
              </div>
            </div>
            <textarea
              value={broadcastText}
              onChange={e => setBroadcastText(e.target.value)}
              placeholder="Текст объявления…"
              rows={4}
              autoFocus
              className="w-full p-3 bg-slate-50 dark:bg-slate-700 rounded-xl text-sm font-medium outline-none border-2 border-transparent focus:border-blue-500 transition-all resize-none"
            />
            <div className="flex gap-2 mt-4">
              <button type="button" onClick={() => setShowBroadcast(false)} className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-semibold text-xs uppercase tracking-wide">
                Отмена
              </button>
              <button type="submit" disabled={!broadcastText.trim() || broadcastSending} className="flex-1 py-3 bg-blue-600 text-white rounded-xl font-semibold text-xs uppercase tracking-wide disabled:opacity-50">
                {broadcastSending ? 'Отправка…' : 'Отправить всем'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export default SupportChat;
