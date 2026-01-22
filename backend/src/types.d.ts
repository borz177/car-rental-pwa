export declare enum UserRole {
    SUPERADMIN = "SUPERADMIN",
    ADMIN = "ADMIN",
    STAFF = "STAFF",
    CLIENT = "CLIENT"
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
export declare enum CarStatus {
    AVAILABLE = "\u0421\u0432\u043E\u0431\u043E\u0434\u0435\u043D",
    RENTED = "\u0412 \u0430\u0440\u0435\u043D\u0434\u0435",
    MAINTENANCE = "\u0412 \u0440\u0435\u043C\u043E\u043D\u0442\u0435",
    RESERVED = "\u0417\u0430\u0431\u0440\u043E\u043D\u0438\u0440\u043E\u0432\u0430\u043D"
}
export declare enum TransactionType {
    INCOME = "\u0414\u043E\u0445\u043E\u0434",
    EXPENSE = "\u0420\u0430\u0441\u0445\u043E\u0434",
    PAYOUT = "\u0412\u044B\u043F\u043B\u0430\u0442\u0430"
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
export declare enum FineStatus {
    PAID = "\u041E\u043F\u043B\u0430\u0447\u0435\u043D",
    UNPAID = "\u041D\u0435 \u043E\u043F\u043B\u0430\u0447\u0435\u043D"
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
export declare enum RequestStatus {
    PENDING = "\u041E\u0436\u0438\u0434\u0430\u0435\u0442",
    APPROVED = "\u041E\u0434\u043E\u0431\u0440\u0435\u043D\u043E",
    REJECTED = "\u041E\u0442\u043A\u043B\u043E\u043D\u0435\u043D\u043E"
}
export interface BookingRequest {
    id: string;
    ownerId: string;
    carId: string;
    clientId: string;
    clientName: string;
    startDate: string;
    startTime: string;
    endDate: string;
    endTime: string;
    status: RequestStatus;
    createdAt: string;
}
export declare enum FuelType {
    PETROL = "\u0411\u0435\u043D\u0437\u0438\u043D",
    DIESEL = "\u0414\u0438\u0437\u0435\u043B\u044C",
    ELECTRIC = "\u042D\u043B\u0435\u043A\u0442\u0440\u043E",
    HYBRID = "\u0413\u0438\u0431\u0440\u0438\u0434"
}
export declare enum Transmission {
    AUTO = "\u0410\u041A\u041F\u041F",
    MANUAL = "\u041C\u041A\u041F\u041F"
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
    status: 'ACTIVE' | 'COMPLETED' | 'CANCELLED';
    contractNumber: string;
    paymentStatus?: 'PAID' | 'DEBT';
}
export type AppView = 'DASHBOARD' | 'CARS' | 'CLIENTS' | 'CALENDAR' | 'REQUESTS' | 'MANUAL_BOOKING' | 'CONTRACTS' | 'CONTRACTS_ARCHIVE' | 'INVESTORS' | 'CASHBOX' | 'REPORTS' | 'STAFF' | 'SETTINGS' | 'BRANDING_SETTINGS' | 'AI_ADVISOR' | 'CLIENT_CATALOG' | 'CLIENT_MY_BOOKINGS' | 'CLIENT_DETAILS' | 'STAFF_DETAILS' | 'INVESTOR_DETAILS' | 'TARIFFS' | 'SUPERADMIN_PANEL';
//# sourceMappingURL=types.d.ts.map