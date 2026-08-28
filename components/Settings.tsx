
import React, { useState, useEffect } from 'react';
import { User, AppView, UserRole } from '../types';
import BackendAPI from '../services/offlineApi';
import { isPushSupported, getPushSubscriptionState, enablePush, disablePush } from '../services/push';
import { getPlanFeatures } from '../services/planFeatures';

export type SettingsSubView = 'MENU' | 'BRANDING' | 'INTERFACE' | 'NOTIFICATIONS' | 'DATA';

interface SettingsProps {
  user: User | null;
  onUpdate: (updates: Partial<User>) => Promise<void>;
  onNavigate: (view: AppView) => void;
  onLogout: () => void;
  isOnline: boolean;
  onGetPendingSyncCount: () => Promise<number>;
  onClearLocalData: () => Promise<void>;
  onSyncNow: () => Promise<void>;
  themePref: 'system' | 'light' | 'dark';
  onSetThemePref: (pref: 'system' | 'light' | 'dark') => void;
  subView: SettingsSubView;
  onOpenSubView: (sub: SettingsSubView) => void;
  onBackToMenu: () => void;
}

const Settings: React.FC<SettingsProps> = ({ user, onUpdate, onNavigate, onLogout, isOnline, onGetPendingSyncCount, onClearLocalData, onSyncNow, themePref, onSetThemePref, subView, onOpenSubView, onBackToMenu }) => {
  const view = subView;
  const [contractsExpanded, setContractsExpanded] = useState(false);

  // Бренд
  const [copied, setCopied] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [brandName, setBrandName] = useState(user?.publicBrandName || '');
  const [slug, setSlug] = useState(user?.publicSlug || '');

  useEffect(() => {
    if (user) {
      setBrandName(user.publicBrandName || '');
      setSlug(user.publicSlug || '');
    }
  }, [user]);

  // Смена пароля
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordSaving, setPasswordSaving] = useState(false);
  const [passwordMessage, setPasswordMessage] = useState<{ ok: boolean; text: string } | null>(null);

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setPasswordMessage(null);
    if (newPassword !== confirmPassword) {
      setPasswordMessage({ ok: false, text: 'Новые пароли не совпадают' });
      return;
    }
    setPasswordSaving(true);
    try {
      const res = await BackendAPI.changePassword(currentPassword, newPassword);
      setPasswordMessage({ ok: true, text: res.message || 'Пароль изменён' });
      setCurrentPassword(''); setNewPassword(''); setConfirmPassword('');
      setTimeout(() => { setShowPasswordForm(false); setPasswordMessage(null); }, 2000);
    } catch (err: any) {
      setPasswordMessage({ ok: false, text: err.message || 'Не удалось сменить пароль' });
    } finally {
      setPasswordSaving(false);
    }
  };

  // Push-уведомления
  const [pushEnabled, setPushEnabled] = useState(false);
  const [pushSupported, setPushSupported] = useState<boolean | null>(null);
  const [pushBusy, setPushBusy] = useState(false);

  useEffect(() => {
    if (!isPushSupported()) { setPushSupported(false); return; }
    getPushSubscriptionState().then(state => {
      setPushSupported(state !== 'unsupported');
      setPushEnabled(state === 'subscribed');
    });
  }, []);

  const handleTogglePush = async (next: boolean) => {
    setPushBusy(true);
    try {
      if (next) {
        const ok = await enablePush();
        if (!ok) {
          alert('Разрешите уведомления в браузере, чтобы включить эту функцию');
          setPushEnabled(false);
        } else {
          setPushEnabled(true);
        }
      } else {
        await disablePush();
        setPushEnabled(false);
      }
    } catch {
      alert('Не удалось изменить настройку push-уведомлений');
    } finally {
      setPushBusy(false);
    }
  };

  // Данные и хранилище
  const [pendingCount, setPendingCount] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [showClearConfirm, setShowClearConfirm] = useState(false);
  const [clearing, setClearing] = useState(false);

  const refreshPendingCount = () => {
    onGetPendingSyncCount().then(setPendingCount).catch(() => setPendingCount(null));
  };

  useEffect(() => {
    if (view === 'DATA') refreshPendingCount();
  }, [view]);

  const handleSyncNow = async () => {
    setSyncing(true);
    try {
      await onSyncNow();
      refreshPendingCount();
    } finally {
      setSyncing(false);
    }
  };

  const handleConfirmClear = async () => {
    setClearing(true);
    try {
      await onClearLocalData();
    } catch {
      setClearing(false);
      setShowClearConfirm(false);
      alert('Не удалось очистить локальные данные');
    }
  };

  if (!user) {
    return (
      <div className="flex flex-col items-center justify-center p-20 text-slate-400 dark:text-slate-500">
        <i className="fas fa-circle-notch animate-spin text-3xl mb-4"></i>
        <p className="font-bold">Загрузка данных пользователя...</p>
      </div>
    );
  }

  const publicLink = `${window.location.origin}?fleet=${slug || 'autopro'}`;

  const copyLink = () => {
    navigator.clipboard.writeText(publicLink);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSaveBranding = async () => {
    setIsSaving(true);
    try {
      await onUpdate({ publicBrandName: brandName, publicSlug: slug });
      alert('Настройки бренда сохранены!');
    } catch (e) {
      alert('Ошибка при сохранении');
    } finally {
      setIsSaving(false);
    }
  };

  const handleSettingToggle = (key: 'showAddCarButton' | 'showDeleteCarButton', value: boolean) => {
    onUpdate({
      settings: {
        ...user.settings,
        [key]: value
      }
    });
  };

  const isAdmin = user.role === UserRole.ADMIN || user.role === UserRole.SUPERADMIN;
  const canViewDocs = user.role !== UserRole.STAFF || user.permissions?.canViewDocs;
  const planFeatures = getPlanFeatures(user);

  const managementItems = [
    { id: 'TARIFFS' as const, label: 'Управление подпиской', icon: 'fa-credit-card', color: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', desktopShow: true },
    { id: 'CONTRACTS_SUB' as const, label: 'Договоры', icon: 'fa-file-invoice-dollar', color: 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400', expandable: true, desktopShow: false },
    { id: 'CLIENTS' as const, label: 'Клиенты', icon: 'fa-users', color: 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400', desktopShow: false },
    { id: 'STAFF' as const, label: 'Сотрудники', icon: 'fa-user-tie', color: 'bg-indigo-100 dark:bg-indigo-500/15 text-indigo-600 dark:text-indigo-400', desktopShow: false, hideForStaff: true, needsFeature: 'staff' as const },
    { id: 'INVESTORS' as const, label: 'Инвесторы', icon: 'fa-handshake', color: 'bg-amber-100 dark:bg-amber-500/15 text-amber-600 dark:text-amber-400', desktopShow: false, needsFeature: 'investors' as const },
    { id: 'CASHBOX' as const, label: 'Касса и Финансы', icon: 'fa-wallet', color: 'bg-rose-100 dark:bg-rose-500/15 text-rose-600 dark:text-rose-400', desktopShow: false, needsDocs: true },
  ];

  // ---------- BRANDING ----------
  if (view === 'BRANDING' && isAdmin) {
    return (
      <div className="max-w-4xl mx-auto space-y-5 animate-fadeIn pb-24 md:pb-0">
        <SubPageHeader title="Бренд и каталог" onBack={onBackToMenu} />

        <div className="bg-white dark:bg-slate-800 p-5 md:p-8 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700">
          <div className="flex justify-between items-center mb-8">
            <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">Брендинг компании</h2>
            <button
              onClick={handleSaveBranding}
              disabled={isSaving}
              className="bg-blue-600 text-white px-6 py-3 rounded-2xl font-semibold hover:bg-blue-700 transition-all disabled:opacity-50 flex items-center gap-2"
            >
              {isSaving ? <i className="fas fa-spinner animate-spin"></i> : <i className="fas fa-save"></i>}
              <span>Сохранить</span>
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="space-y-4">
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3 ml-2">Название бренда</label>
                <input
                  value={brandName}
                  placeholder="Напр. MyRentals"
                  className="w-full p-5 bg-slate-50 dark:bg-slate-700 border-2 border-transparent rounded-2xl font-bold focus:border-blue-500 outline-none transition-all"
                  onChange={(e) => setBrandName(e.target.value)}
                />
              </div>
              <div>
                <label className="block text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-3 ml-2">ID профиля (URL)</label>
                <input
                  value={slug}
                  placeholder="my-fleet"
                  className="w-full p-5 bg-slate-50 dark:bg-slate-700 border-2 border-transparent rounded-2xl font-bold focus:border-blue-500 outline-none transition-all"
                  onChange={(e) => setSlug(e.target.value)}
                />
              </div>
            </div>
            <div className="bg-blue-50 dark:bg-blue-500/10 p-5 rounded-2xl border-2 border-blue-100 dark:border-blue-500/20 flex flex-col justify-center items-center text-center">
               <div className="w-12 h-12 bg-white dark:bg-slate-800 rounded-2xl flex items-center justify-center text-blue-600 dark:text-blue-400 text-2xl shadow-sm mb-4">
                 <i className="fas fa-external-link-alt"></i>
               </div>
               <p className="text-xs font-bold text-blue-800 dark:text-blue-300 leading-relaxed">Название бренда будет отображаться в шапке мобильного приложения и в заголовке каталога.</p>
            </div>
          </div>
        </div>

        <div className="bg-slate-900 p-5 md:p-8 rounded-2xl text-white relative overflow-hidden shadow-md">
          <div className="relative z-10">
            <h3 className="text-xl font-semibold mb-4 flex items-center">
              <i className="fas fa-link mr-4 text-blue-400"></i> Ссылка каталога
            </h3>
            <p className="text-slate-400 font-medium mb-8 max-w-lg">Ваш персональный URL для бронирования клиентами. Разместите его в соцсетях или отправьте напрямую.</p>
            <div className="bg-white/5 border border-white/10 p-2 rounded-xl flex flex-col md:flex-row items-center gap-4">
              <div className="flex-1 px-6 py-4 text-xs font-mono truncate opacity-60 w-full md:w-auto text-center md:text-left">{publicLink}</div>
              <button
                onClick={copyLink}
                className={`w-full md:w-auto px-10 py-4 rounded-2xl font-semibold transition-all ${copied ? 'bg-emerald-500' : 'bg-blue-600 hover:bg-blue-700'} shadow-lg`}
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

  // ---------- INTERFACE ----------
  if (view === 'INTERFACE') {
    return (
      <div className="max-w-2xl mx-auto space-y-5 animate-fadeIn pb-24 md:pb-0">
        <SubPageHeader title="Интерфейс" onBack={onBackToMenu} />

        <SettingsGroup title="Тема">
          <div className="p-4">
            <div className="grid grid-cols-3 gap-2 p-1 bg-slate-100 dark:bg-slate-900 rounded-xl">
              {([
                ['system', 'fa-circle-half-stroke', 'Система'],
                ['light', 'fa-sun', 'Светлая'],
                ['dark', 'fa-moon', 'Тёмная'],
              ] as const).map(([id, icon, label]) => (
                <button
                  key={id}
                  onClick={() => onSetThemePref(id)}
                  className={`py-3 rounded-lg font-semibold text-xs flex flex-col items-center gap-1.5 transition-all ${
                    themePref === id ? 'bg-white dark:bg-slate-700 text-blue-600 dark:text-blue-400 shadow-sm' : 'text-slate-400 dark:text-slate-500'
                  }`}
                >
                  <i className={`fas ${icon}`}></i>
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </SettingsGroup>

        {isAdmin && (
          <SettingsGroup title="Автопарк">
            <ToggleRow
              icon="fa-plus" iconColor="bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
              label="Кнопка «Добавить авто»"
              description="Скрыть кнопку для ограничения добавления авто сотрудниками."
              checked={user.settings?.showAddCarButton ?? true}
              onChange={(val) => handleSettingToggle('showAddCarButton', val)}
            />
            <ToggleRow
              icon="fa-trash" iconColor="bg-rose-50 dark:bg-rose-500/10 text-rose-600 dark:text-rose-400"
              label="Кнопка «Удалить авто»"
              description="Защита от случайного удаления автомобилей из автопарка."
              checked={user.settings?.showDeleteCarButton ?? true}
              onChange={(val) => handleSettingToggle('showDeleteCarButton', val)}
            />
          </SettingsGroup>
        )}
      </div>
    );
  }

  // ---------- NOTIFICATIONS ----------
  if (view === 'NOTIFICATIONS') {
    return (
      <div className="max-w-2xl mx-auto space-y-5 animate-fadeIn pb-24 md:pb-0">
        <SubPageHeader title="Уведомления" onBack={onBackToMenu} />
        <SettingsGroup>
          <ToggleRow
            icon="fa-bell" iconColor="bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400"
            label="Push-уведомления"
            description={
              pushSupported === false
                ? 'Браузер не поддерживает push-уведомления'
                : 'О новых заявках и сообщениях от поддержки — даже когда приложение закрыто'
            }
            checked={pushEnabled}
            disabled={pushSupported === false || pushBusy}
            onChange={handleTogglePush}
          />
        </SettingsGroup>
      </div>
    );
  }

  // ---------- DATA & STORAGE ----------
  if (view === 'DATA') {
    return (
      <div className="max-w-2xl mx-auto space-y-5 animate-fadeIn pb-24 md:pb-0">
        <SubPageHeader title="Данные и хранилище" onBack={onBackToMenu} />

        <SettingsGroup title="Синхронизация">
          <SettingsRow
            icon={isOnline ? 'fa-wifi' : 'fa-wifi-slash'}
            iconColor={isOnline ? 'bg-emerald-50 dark:bg-emerald-500/10 text-emerald-600 dark:text-emerald-400' : 'bg-slate-100 dark:bg-slate-700 text-slate-400 dark:text-slate-500'}
            label={isOnline ? 'Подключение есть' : 'Нет подключения'}
            description={
              pendingCount === null ? 'Проверка...' :
              pendingCount === 0 ? 'Все изменения синхронизированы' :
              `Ожидают отправки: ${pendingCount}`
            }
          />
          {isOnline && (pendingCount ?? 0) > 0 && (
            <SettingsRow
              icon="fa-rotate" iconColor="bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
              label={syncing ? 'Синхронизация...' : 'Синхронизировать сейчас'}
              onClick={syncing ? undefined : handleSyncNow}
              trailing={syncing ? <i className="fas fa-circle-notch animate-spin text-slate-300 dark:text-slate-600"></i> : <i className="fas fa-chevron-right text-slate-300 dark:text-slate-600 text-xs"></i>}
            />
          )}
        </SettingsGroup>

        <SettingsGroup title="Локальный кэш">
          <SettingsRow
            icon="fa-trash-can" iconColor="bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400"
            label="Очистить локальные данные"
            description={isOnline ? 'Удалит офлайн-кэш этого устройства' : 'Требуется подключение к интернету'}
            destructive
            onClick={isOnline ? () => setShowClearConfirm(true) : undefined}
            trailing={<i className="fas fa-chevron-right text-slate-300 dark:text-slate-600 text-xs"></i>}
          />
        </SettingsGroup>

        {showClearConfirm && (
          <div className="fixed inset-0 z-[100] flex items-center justify-center p-4 bg-slate-900/60 backdrop-blur-md">
            <div className="bg-white dark:bg-slate-800 rounded-2xl w-full max-w-sm p-6 shadow-md animate-scaleIn">
              <div className="w-12 h-12 rounded-2xl bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400 flex items-center justify-center text-xl mb-4">
                <i className="fas fa-triangle-exclamation"></i>
              </div>
              <h3 className="text-lg font-semibold text-slate-900 dark:text-white mb-2">Очистить локальные данные?</h3>
              <p className="text-sm text-slate-500 dark:text-slate-400 leading-relaxed mb-3">
                Локальный кэш автомобилей, клиентов, договоров и других данных на этом устройстве будет удалён.
                После очистки приложение перезагрузится и заново загрузит данные с сервера.
              </p>
              {(pendingCount ?? 0) > 0 && (
                <div className="bg-rose-50 dark:bg-rose-500/10 border border-rose-100 dark:border-rose-500/20 text-rose-700 dark:text-rose-400 text-xs font-semibold rounded-xl p-3 mb-3">
                  У вас {pendingCount} несинхронизированных изменений — они будут потеряны безвозвратно.
                </div>
              )}
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => setShowClearConfirm(false)}
                  disabled={clearing}
                  className="flex-1 py-3 bg-slate-100 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-xl font-semibold text-sm disabled:opacity-50"
                >
                  Отмена
                </button>
                <button
                  onClick={handleConfirmClear}
                  disabled={clearing}
                  className="flex-1 py-3 bg-rose-600 text-white rounded-xl font-semibold text-sm hover:bg-rose-700 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                >
                  {clearing ? <i className="fas fa-circle-notch animate-spin"></i> : <i className="fas fa-trash-can"></i>}
                  <span>Да, очистить</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    );
  }

  // ---------- MENU ----------
  return (
    <div className="max-w-4xl mx-auto space-y-4 animate-fadeIn pb-24 md:pb-0">
      <div className="px-2">
        <h2 className="text-3xl font-semibold text-slate-900 dark:text-white">{isAdmin ? 'Настройки и управление' : 'Личный кабинет'}</h2>
        <p className="text-slate-400 dark:text-slate-500 font-bold mt-1 uppercase text-[10px] tracking-wide hidden md:block">
          {isAdmin ? 'Конфигурация вашей компании и аккаунта' : 'Управление вашим профилем и бронированиями'}
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
        {/* Profile & Logout */}
        <div className="bg-white dark:bg-slate-800 p-5 rounded-2xl shadow-sm border border-slate-100 dark:border-slate-700 flex flex-col justify-between h-full">
          <div>
            <div className="flex items-center space-x-6">
              <div className="w-14 h-14 rounded-xl bg-gradient-to-tr from-slate-800 to-slate-950 flex items-center justify-center text-white text-3xl font-semibold shadow-md">
                {user.name.charAt(0)}
              </div>
              <div>
                <h3 className="text-2xl font-semibold text-slate-900 dark:text-white">{user.name}</h3>
                <p className="text-sm text-slate-400 dark:text-slate-500 font-bold uppercase tracking-wide">{user.role}</p>
                {isAdmin && (
                  <div className="flex items-center space-x-2 mt-1">
                    <span className={`px-2 py-0.5 rounded-full text-[8px] font-semibold uppercase ${user.isTrial ? 'bg-blue-100 dark:bg-blue-500/15 text-blue-600 dark:text-blue-400' : 'bg-emerald-100 dark:bg-emerald-500/15 text-emerald-600 dark:text-emerald-400'}`}>
                      {user.activePlan || (user.isTrial ? 'Триал' : 'Базовый')}
                    </span>
                  </div>
                )}
              </div>
            </div>

            <div className="mt-8 p-4 bg-slate-50 dark:bg-slate-700 rounded-2xl border border-slate-100 dark:border-slate-700">
               <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Email аккаунта</div>
               <div className="font-bold text-slate-900 dark:text-white truncate">{user.email}</div>
            </div>

            {!showPasswordForm ? (
              <button
                onClick={() => setShowPasswordForm(true)}
                className="w-full mt-3 py-3 bg-slate-50 dark:bg-slate-700 text-slate-600 dark:text-slate-300 rounded-2xl font-semibold text-xs uppercase tracking-wide flex items-center justify-center gap-2 hover:bg-slate-100 dark:hover:bg-slate-700 transition-all border border-slate-100 dark:border-slate-700"
              >
                <i className="fas fa-key"></i>
                <span>Сменить пароль</span>
              </button>
            ) : (
              <form onSubmit={handleChangePassword} className="mt-3 p-4 bg-slate-50 dark:bg-slate-700 rounded-2xl border border-slate-100 dark:border-slate-700 space-y-2">
                <div className="text-[10px] font-semibold text-slate-400 dark:text-slate-500 uppercase tracking-wide mb-1">Смена пароля</div>
                <input
                  type="password" value={currentPassword} onChange={e => setCurrentPassword(e.target.value)}
                  placeholder="Текущий пароль" required autoComplete="current-password"
                  className="w-full p-3 bg-white dark:bg-slate-800 rounded-xl font-medium text-sm outline-none border-2 border-transparent focus:border-blue-500 transition-all"
                />
                <input
                  type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                  placeholder="Новый пароль (от 6 символов)" required minLength={6} autoComplete="new-password"
                  className="w-full p-3 bg-white dark:bg-slate-800 rounded-xl font-medium text-sm outline-none border-2 border-transparent focus:border-blue-500 transition-all"
                />
                <input
                  type="password" value={confirmPassword} onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Повторите новый пароль" required autoComplete="new-password"
                  className="w-full p-3 bg-white dark:bg-slate-800 rounded-xl font-medium text-sm outline-none border-2 border-transparent focus:border-blue-500 transition-all"
                />
                {passwordMessage && (
                  <div className={`text-xs font-semibold px-1 ${passwordMessage.ok ? 'text-emerald-600 dark:text-emerald-400' : 'text-rose-600 dark:text-rose-400'}`}>
                    {passwordMessage.text}
                  </div>
                )}
                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => { setShowPasswordForm(false); setPasswordMessage(null); setCurrentPassword(''); setNewPassword(''); setConfirmPassword(''); }}
                    className="flex-1 py-2.5 bg-white dark:bg-slate-800 text-slate-500 dark:text-slate-400 rounded-xl font-semibold text-xs uppercase tracking-wide"
                  >
                    Отмена
                  </button>
                  <button
                    type="submit" disabled={passwordSaving}
                    className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl font-semibold text-xs uppercase tracking-wide disabled:opacity-50"
                  >
                    {passwordSaving ? 'Сохранение…' : 'Сохранить'}
                  </button>
                </div>
              </form>
            )}
          </div>

          <button
            onClick={onLogout}
            className="w-full mt-8 py-5 bg-rose-50 dark:bg-rose-500/10 text-rose-500 dark:text-rose-400 rounded-2xl font-semibold flex items-center justify-center space-x-3 hover:bg-rose-100 dark:hover:bg-rose-500/15 transition-all border-2 border-transparent hover:border-rose-200 dark:hover:border-rose-500/30"
          >
            <i className="fas fa-sign-out-alt"></i>
            <span>Выйти из системы</span>
          </button>
        </div>

        {/* Grouped settings */}
        <div className="space-y-4">
          <SettingsGroup title="Приложение">
            {isAdmin && (
              <SettingsRow
                icon="fa-paint-brush" iconColor="bg-blue-50 dark:bg-blue-500/10 text-blue-600 dark:text-blue-400"
                label="Бренд и каталог"
                onClick={() => onOpenSubView('BRANDING')}
                trailing={<i className="fas fa-chevron-right text-slate-300 dark:text-slate-600 text-xs"></i>}
              />
            )}
            <SettingsRow
              icon="fa-palette" iconColor="bg-purple-50 text-purple-600"
              label="Интерфейс"
              onClick={() => onOpenSubView('INTERFACE')}
              trailing={<i className="fas fa-chevron-right text-slate-300 dark:text-slate-600 text-xs"></i>}
            />
            {user.role !== UserRole.CLIENT && (
              <SettingsRow
                icon="fa-bell" iconColor="bg-amber-50 dark:bg-amber-500/10 text-amber-600 dark:text-amber-400"
                label="Уведомления"
                onClick={() => onOpenSubView('NOTIFICATIONS')}
                trailing={<i className="fas fa-chevron-right text-slate-300 dark:text-slate-600 text-xs"></i>}
              />
            )}
            <SettingsRow
              icon="fa-database" iconColor="bg-slate-100 dark:bg-slate-700 text-slate-500 dark:text-slate-400"
              label="Данные и хранилище"
              onClick={() => onOpenSubView('DATA')}
              trailing={<i className="fas fa-chevron-right text-slate-300 dark:text-slate-600 text-xs"></i>}
            />
          </SettingsGroup>

          {isAdmin && (
            <SettingsGroup title="Управление">
              {managementItems.map(item => {
                const shouldShow = item.desktopShow || (typeof window !== 'undefined' && window.innerWidth < 768);
                if (!shouldShow) return null;
                if (item.hideForStaff && user.role === UserRole.STAFF) return null;
                if (item.needsDocs && !canViewDocs) return null;
                if (item.needsFeature && !planFeatures[item.needsFeature]) return null;

                return (
                  <React.Fragment key={item.id}>
                    <SettingsRow
                      icon={item.icon} iconColor={item.color}
                      label={item.label}
                      onClick={() => item.expandable ? setContractsExpanded(!contractsExpanded) : onNavigate(item.id as AppView)}
                      trailing={
                        <i className={`fas ${item.expandable ? (contractsExpanded ? 'fa-chevron-up' : 'fa-chevron-down') : 'fa-chevron-right'} text-slate-300 dark:text-slate-600 text-xs`}></i>
                      }
                    />
                    {item.expandable && contractsExpanded && (
                      <div className="grid grid-cols-3 gap-2 p-3 bg-slate-50 dark:bg-slate-700 animate-slideDown">
                        <button onClick={() => onNavigate('BOOKINGS')} className="bg-amber-50 dark:bg-amber-500/10 p-3 rounded-xl border border-amber-100 dark:border-amber-500/20 flex flex-col items-center text-center gap-1.5 active:scale-95 transition-all">
                          <i className="fas fa-calendar-alt text-amber-600 dark:text-amber-400"></i>
                          <span className="text-[9px] font-semibold text-amber-800 uppercase tracking-wide">Брони</span>
                        </button>
                        <button onClick={() => onNavigate('CONTRACTS')} className="bg-blue-50 dark:bg-blue-500/10 p-3 rounded-xl border border-blue-100 dark:border-blue-500/20 flex flex-col items-center text-center gap-1.5 active:scale-95 transition-all">
                          <i className="fas fa-play-circle text-blue-600 dark:text-blue-400"></i>
                          <span className="text-[9px] font-semibold text-blue-800 dark:text-blue-300 uppercase tracking-wide">Активные</span>
                        </button>
                        <button onClick={() => onNavigate('CONTRACTS_ARCHIVE')} className="bg-white dark:bg-slate-800 p-3 rounded-xl border border-slate-200 dark:border-slate-600 flex flex-col items-center text-center gap-1.5 active:scale-95 transition-all">
                          <i className="fas fa-history text-slate-600 dark:text-slate-300"></i>
                          <span className="text-[9px] font-semibold text-slate-700 dark:text-slate-200 uppercase tracking-wide">Архив</span>
                        </button>
                      </div>
                    )}
                  </React.Fragment>
                );
              })}
            </SettingsGroup>
          )}

          {user.role === UserRole.CLIENT && (
             <div className="bg-indigo-50 dark:bg-indigo-500/10 p-5 rounded-2xl border border-indigo-100 dark:border-indigo-500/20 text-center">
               <i className="fas fa-star text-indigo-400 text-3xl mb-4"></i>
               <p className="text-xs font-bold text-indigo-700 dark:text-indigo-400">Спасибо, что пользуетесь нашим сервисом!</p>
             </div>
          )}
        </div>
      </div>
    </div>
  );
};

const SubPageHeader: React.FC<{ title: string; onBack: () => void }> = ({ title, onBack }) => (
  <div className="flex items-center gap-3 px-1">
    <button
      onClick={onBack}
      className="w-10 h-10 rounded-full bg-white dark:bg-slate-800 border border-slate-100 dark:border-slate-700 shadow-sm text-slate-500 dark:text-slate-400 flex items-center justify-center hover:text-blue-600 dark:hover:text-blue-400 hover:border-blue-100 dark:hover:border-blue-500/30 transition-all"
      aria-label="Назад"
    >
      <i className="fas fa-arrow-left"></i>
    </button>
    <h2 className="text-2xl font-semibold text-slate-900 dark:text-white">{title}</h2>
  </div>
);

const SettingsGroup: React.FC<{ title?: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="space-y-2">
    {title && <div className="px-3 text-[10px] font-semibold uppercase tracking-wide text-slate-400 dark:text-slate-500">{title}</div>}
    <div className="bg-white dark:bg-slate-800 rounded-2xl border border-slate-100 dark:border-slate-700 shadow-sm divide-y divide-slate-100 dark:divide-slate-700 overflow-hidden">
      {children}
    </div>
  </div>
);

const SettingsRow: React.FC<{
  icon: string;
  iconColor: string;
  label: string;
  description?: string;
  onClick?: () => void;
  trailing?: React.ReactNode;
  destructive?: boolean;
}> = ({ icon, iconColor, label, description, onClick, trailing, destructive }) => {
  const Tag: any = onClick ? 'button' : 'div';
  return (
    <Tag
      onClick={onClick}
      className={`w-full flex items-center gap-3 px-4 py-3.5 text-left transition-colors ${onClick ? 'hover:bg-slate-50 dark:hover:bg-slate-700 active:bg-slate-100 dark:active:bg-slate-700' : ''} ${!onClick && !description ? 'opacity-90' : ''}`}
    >
      <div className={`w-9 h-9 rounded-lg flex items-center justify-center shrink-0 ${iconColor}`}>
        <i className={`fas ${icon} text-sm`}></i>
      </div>
      <div className="flex-1 min-w-0">
        <div className={`font-semibold text-sm ${destructive ? 'text-rose-600 dark:text-rose-400' : 'text-slate-800 dark:text-slate-100'}`}>{label}</div>
        {description && <div className="text-xs text-slate-400 dark:text-slate-500 mt-0.5">{description}</div>}
      </div>
      {trailing}
    </Tag>
  );
};

const Switch: React.FC<{ checked: boolean; disabled?: boolean; onChange: (v: boolean) => void }> = ({ checked, disabled, onChange }) => (
  <button
    onClick={(e) => { e.stopPropagation(); if (!disabled) onChange(!checked); }}
    disabled={disabled}
    className={`w-11 h-6 rounded-full flex items-center px-0.5 transition-colors shrink-0 ${checked ? 'bg-blue-600 justify-end' : 'bg-slate-200 dark:bg-slate-600 justify-start'} ${disabled ? 'opacity-40 cursor-not-allowed' : ''}`}
  >
    <div className="w-5 h-5 bg-white dark:bg-slate-800 rounded-full shadow"></div>
  </button>
);

const ToggleRow: React.FC<{
  icon: string;
  iconColor: string;
  label: string;
  description?: string;
  checked: boolean;
  disabled?: boolean;
  onChange: (v: boolean) => void;
}> = ({ icon, iconColor, label, description, checked, disabled, onChange }) => (
  <SettingsRow
    icon={icon} iconColor={iconColor} label={label} description={description}
    trailing={<Switch checked={checked} disabled={disabled} onChange={onChange} />}
  />
);

export default Settings;
