
import { UserRole, FuelType, Transmission } from './types';

export const CAR_CATEGORIES = ['Эконом', 'Комфорт', 'Бизнес', 'Внедорожник', 'Спорт', 'Минивэн'];

// Единственный источник значений — types.ts. Раньше здесь объявлялся свой enum
// FuelType со значениями 'petrol'/'diesel', который перекрывал импортированный
// с русскими значениями. В базе и в интерфейсе используются русские, так что
// любое использование локального варианта дало бы расхождение данных.
export const FUEL_TYPES = Object.values(FuelType);
export const TRANSMISSIONS = Object.values(Transmission);

// Раньше заглушкой для авто без фото была картинка с images.unsplash.com — внешняя
// зависимость, которая рвётся у части пользователей (недоступность конкретного CDN
// в их сети) и совершенно не нужна для простого "фото нет". Инлайновый SVG работает
// всегда, без сети.
export const CAR_PLACEHOLDER_IMAGE = `data:image/svg+xml,${encodeURIComponent(
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 300">
    <rect width="400" height="300" fill="#f1f5f9"/>
    <path d="M100 178 L128 128 Q138 118 153 118 L247 118 Q262 118 272 128 L300 178 Z" fill="#cbd5e1"/>
    <rect x="78" y="173" width="244" height="38" rx="12" fill="#cbd5e1"/>
    <circle cx="140" cy="215" r="23" fill="#cbd5e1"/>
    <circle cx="260" cy="215" r="23" fill="#cbd5e1"/>
    <circle cx="140" cy="215" r="9" fill="#f1f5f9"/>
    <circle cx="260" cy="215" r="9" fill="#f1f5f9"/>
  </svg>`
)}`;

export const NAVIGATION_ITEMS = [
  // Панель Суперадмина (Система)
  { id: 'SUPERADMIN_PANEL', label: 'Контроль системы', icon: 'fa-user-shield', roles: [UserRole.SUPERADMIN] },

  // Админ-панель
  { id: 'DASHBOARD', label: 'Дашборд', icon: 'fa-chart-pie', roles: [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.STAFF] },
  { id: 'CARS', label: 'Автопарк', icon: 'fa-car', roles: [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.STAFF] },
  { id: 'REQUESTS', label: 'Заявки', icon: 'fa-clipboard-list', roles: [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.STAFF], badge: true },
  { id: 'MANUAL_BOOKING', label: 'Оформить', icon: 'fa-file-signature', roles: [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.STAFF] },
  { id: 'CONTRACTS', label: 'Договоры', icon: 'fa-file-invoice-dollar', roles: [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.STAFF] },
  { id: 'REPORTS', label: 'Отчеты', icon: 'fa-chart-simple', roles: [UserRole.SUPERADMIN, UserRole.ADMIN] },
  { id: 'CASHBOX', label: 'Касса', icon: 'fa-cash-register', roles: [UserRole.SUPERADMIN, UserRole.ADMIN] },
  { id: 'INVESTORS', label: 'Инвесторы', icon: 'fa-handshake', roles: [UserRole.SUPERADMIN, UserRole.ADMIN] },
  { id: 'STAFF', label: 'Сотрудники', icon: 'fa-user-tie', roles: [UserRole.SUPERADMIN, UserRole.ADMIN] },
  { id: 'CLIENTS', label: 'Клиенты', icon: 'fa-users', roles: [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.STAFF] },
  { id: 'CALENDAR', label: 'Календарь', icon: 'fa-calendar-alt', roles: [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.STAFF] },
  { id: 'SUPPORT_CHAT', label: 'Поддержка', icon: 'fa-headset', roles: [UserRole.SUPERADMIN, UserRole.ADMIN] },
  { id: 'SETTINGS', label: 'Настройки', icon: 'fa-cog', roles: [UserRole.SUPERADMIN, UserRole.ADMIN, UserRole.STAFF] },
  
  // Клиент-панель
  { id: 'CLIENT_CATALOG', label: 'Каталог', icon: 'fa-search', roles: [UserRole.CLIENT] },
  { id: 'CLIENT_MY_BOOKINGS', label: 'Мои брони', icon: 'fa-calendar-check', roles: [UserRole.CLIENT] },
];

// Разделы верхнего уровня — то, что доступно из меню. Переход между ними это смена
// раздела, а не шаг вперёд: стек возврата сбрасывается и анимации нет (как переключение
// вкладок в нативных приложениях). Всё остальное — карточки, подстраницы — кладётся
// в стек и возвращается свайпом от левого края (см. components/SwipeNavigator.tsx).
export const ROOT_VIEWS = new Set<string>(NAVIGATION_ITEMS.map(item => item.id));
