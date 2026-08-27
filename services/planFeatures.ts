import { User, UserRole } from '../types';

// Зеркало backend/server.ts (resolvePlanTier/PLAN_LIMITS/PLAN_FEATURES/getBlockedCarIds) —
// держать оба файла в синхроне при изменении лимитов или состава функций тарифа.
// Бэкенд — это настоящая граница (проверяется на каждый запрос), этот файл нужен
// только чтобы интерфейс не показывал недоступные разделы и заранее объяснял отказ.

export type PlanTier = 'START' | 'BUSINESS' | 'PREMIUM';

export const PLAN_LIMITS: Record<PlanTier, number> = { START: 5, BUSINESS: 10, PREMIUM: 9999 };

export interface PlanFeatures {
  carLimit: number;
  calendar: boolean;
  contractPrint: boolean;
  staff: boolean;
  investors: boolean;
}

const PLAN_FEATURES: Record<PlanTier, PlanFeatures> = {
  START:    { carLimit: PLAN_LIMITS.START,    calendar: false, contractPrint: false, staff: false, investors: false },
  BUSINESS: { carLimit: PLAN_LIMITS.BUSINESS, calendar: true,  contractPrint: true,  staff: false, investors: false },
  PREMIUM:  { carLimit: PLAN_LIMITS.PREMIUM,  calendar: true,  contractPrint: true,  staff: true,  investors: true },
};

type PlanUser = Pick<User, 'activePlan' | 'isTrial' | 'role'> | null | undefined;

export function resolvePlanTier(user: PlanUser): PlanTier {
  const plan = (user?.activePlan || (user?.isTrial ? 'Премиум' : 'Старт')).toUpperCase();
  if (plan.includes('ПРЕМИУМ') || plan.includes('PREMIUM')) return 'PREMIUM';
  if (plan.includes('БИЗНЕС') || plan.includes('BUSINESS')) return 'BUSINESS';
  return 'START';
}

export function getPlanFeatures(user: PlanUser): PlanFeatures {
  if (user?.role === UserRole.SUPERADMIN) return PLAN_FEATURES.PREMIUM;
  return PLAN_FEATURES[resolvePlanTier(user)];
}

// Автомобили сверх лимита тарифа не удаляются, а блокируются для новых сделок — самые
// недавно добавленные (по createdAt) считаются "лишними" при понижении тарифа, более
// старые продолжают работать. Итоговое решение всегда за бэкендом (getBlockedCarIds
// в server.ts); эта функция — только для подсветки в интерфейсе тем же правилом.
export function getBlockedCarIds<T extends { id: string; createdAt?: string }>(cars: T[], carLimit: number): Set<string> {
  if (cars.length <= carLimit) return new Set();
  const sorted = [...cars].sort((a, b) => new Date(a.createdAt || 0).getTime() - new Date(b.createdAt || 0).getTime());
  return new Set(sorted.slice(carLimit).map(c => c.id));
}
