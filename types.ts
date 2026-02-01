
export enum UserRole {
  SUPERADMIN = 'SUPERADMIN',
  ADMIN = 'ADMIN',
  STAFF = 'STAFF',
  CLIENT = 'CLIENT'
}

export interface User {
  id: string;
  name: string;
  email: string;
  password?: string;
  role: UserRole;
  publicBrandName?: string;
  publicSlug?: string;
  subscriptionUntil?: string;
  isTrial?: boolean;
  activePlan?: string;
}

export interface Staff {
  id: string;
  ownerId: string;
  name: string;
  login: string;
  password?: string;
  role: UserRole;
  createdAt: string;
}

export interface Investor {
  id: string;
  ownerId: string;
  name: string;
  phone: string;
  email: string;
  totalInvested: number;
  balance: number;
}

export enum CarStatus {
  AVAILABLE = 'Свободен',
  RENTED = 'В аренде',
  MAINTENANCE = 'В ремонте',
  RESERVED = 'Забронирован'
}

export enum TransactionType {
  INCOME = 'Доход',
  EXPENSE = 'Расход',
  PAYOUT = 'Выплата'
}

export interface Transaction {
  id: string;
  ownerId: string;
  amount: number;
  type: TransactionType;
  category: string;
  description: string;
  date: string;
  investorId?: string;
  clientId?: string;
  carId?: string;
}

export enum FineStatus {
  PAID = 'Оплачен',
  UNPAID = 'Не оплачен'
}

export interface Fine {
  id: string;
  ownerId: string;
  clientId: string;
  carId: string;
  amount: number;
  description: string;
  date: string;
  status: FineStatus;
  source?: string;
}

export enum RequestStatus {
  PENDING = 'PENDING',
  APPROVED = 'APPROVED',
  REJECTED = 'REJECTED'
}

export interface BookingRequest {
  id: string;
  ownerId: string;
  carId: string;
  clientId: string | null;
  clientName: string;
  clientPhone: string;
  clientDob: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  status: RequestStatus;
  createdAt: string;
}

export enum FuelType {
  PETROL = 'Бензин',
  DIESEL = 'Дизель',
  ELECTRIC = 'Электро',
  HYBRID = 'Гибрид'
}

export enum Transmission {
  AUTO = 'АКПП',
  MANUAL = 'МКПП'
}

export interface Client {
  id: string;
  ownerId: string;
  name: string;
  phone: string;
  email: string;
  passport: string;
  driverLicense: string;
  debt?: number;
  createdAt: string;
}

export interface Car {
  id: string;
  ownerId: string;
  brand: string;
  model: string;
  year: number;
  plate: string;
  status: CarStatus;
  pricePerDay: number;
  pricePerHour: number;
  category: string;
  mileage: number;
  fuel: FuelType;
  transmission: Transmission;
  images: string[];
  investorId?: string;
  investorShare?: number;
}

export interface RentalExtension {
  endDate: string;
  endTime: string;
  amount: number;
  date: string;
  paymentStatus?: 'PAID' | 'DEBT';
}

export interface Rental {
  id: string;
  ownerId: string;
  carId: string;
  clientId: string;
  startDate: string;
  startTime: string;
  endDate: string;
  endTime: string;
  totalAmount: number;
  prepayment?: number;
  status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
  contractNumber: string;
  paymentStatus?: 'PAID' | 'DEBT';
  isReservation: boolean;
  bookingType: 'DAILY' | 'HOURLY';
  extensions?: RentalExtension[];
}

export type AppView =
  | 'DASHBOARD'
  | 'CARS'
  | 'CLIENTS'
  | 'CALENDAR'
  | 'REQUESTS'
  | 'MANUAL_BOOKING'
  | 'CONTRACTS'
  | 'BOOKINGS'
  | 'CONTRACTS_ARCHIVE'
  | 'INVESTORS'
  | 'CASHBOX'
  | 'REPORTS'
  | 'STAFF'
  | 'SETTINGS'
  | 'BRANDING_SETTINGS'
  | 'CLIENT_CATALOG'
  | 'CLIENT_MY_BOOKINGS'
  | 'CLIENT_DETAILS'
  | 'STAFF_DETAILS'
  | 'INVESTOR_DETAILS'
  | 'TARIFFS'
  | 'SUPERADMIN_PANEL';
