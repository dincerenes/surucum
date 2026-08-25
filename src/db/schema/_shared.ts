import { integer, text } from 'drizzle-orm/sqlite-core';
import type { BasisPoints, Kurus } from '../../lib/money';
import type { BusinessDate } from '../../lib/business-date';

/**
 * Unix zaman damgası, milisaniye. Ham sayı olarak tutuluyor:
 * senkronda karşılaştırma ve sıralama Date nesnesine çevirmeden yapılabilsin diye.
 */
export type UnixMs = number;

/**
 * Her senkronlanan tabloda bulunan sütunlar.
 *
 * `id` cihazda üretilir (UUID v7) — böylece kayıt çevrimdışıyken de kalıcı
 * kimliğine sahip olur ve ilişkiler ağ beklemeden kurulabilir.
 *
 * `deletedAt` yumuşak silme içindir. Sert silme senkronda kaydı diriltir:
 * cihaz A satırı siler, cihaz B eski hâlini geri gönderir.
 */
export const syncColumns = {
  id: text().primaryKey(),
  userId: text().notNull(),
  createdAt: integer().$type<UnixMs>().notNull(),
  updatedAt: integer().$type<UnixMs>().notNull(),
  deletedAt: integer().$type<UnixMs>(),
} as const;

/** Para sütunu. Her zaman tam sayı kuruş. */
export const kurus = () => integer().$type<Kurus>();

/** Oran sütunu. Baz puan: 2500 = %25,00. */
export const bps = () => integer().$type<BasisPoints>();

/** Varsayılan değerlerde kullanılan markalı sıfırlar. Çıplak 0 tip hatası verir. */
export const ZERO_KURUS = 0 as Kurus;
export const ZERO_BPS = 0 as BasisPoints;

/** İş günü sütunu: 'YYYY-MM-DD'. Saat ve saat dilimi taşımaz. */
export const businessDate = () => text().$type<BusinessDate>();

// ---------------------------------------------------------------------------
// Sabit listeler
// ---------------------------------------------------------------------------

/**
 * Yakıt tipleri. LPG ayrı bir tip: Türkiye'deki ticari araçların büyük kısmı
 * dönüşümlü LPG kullanıyor ve bu araçlar hem benzin hem LPG yakıyor —
 * bu yüzden yakıt tipi araca değil, `vehicleFuelTypes` satırına bağlı.
 */
export const FUEL_TYPES = ['gasoline', 'diesel', 'lpg', 'cng', 'electric'] as const;
export type FuelType = (typeof FUEL_TYPES)[number];

export const FUEL_TYPE_LABELS: Record<FuelType, string> = {
  gasoline: 'Benzin',
  diesel: 'Motorin',
  lpg: 'LPG',
  cng: 'CNG',
  electric: 'Elektrik',
};

/** Sıvı ve gaz yakıtta mililitre, elektrikte watt-saat. */
export const FUEL_UNIT_LABELS: Record<FuelType, string> = {
  gasoline: 'lt',
  diesel: 'lt',
  lpg: 'lt',
  cng: 'kg',
  electric: 'kWh',
};

/**
 * Araç sahiplik biçimi. Maliyet yapısını tamamen değiştirdiği için
 * ayrı bir alan: kiralık plakada aylık sabit gider, kendi aracında amortisman.
 */
export const OWNERSHIP_TYPES = [
  'owned',           // Kendi aracı, kendi plakası
  'rented_plate',    // Kendi aracı, kiralık plaka
  'rented_vehicle',  // Kiralık araç
  'employer',        // İşverene ait araç
] as const;
export type OwnershipType = (typeof OWNERSHIP_TYPES)[number];

export const OWNERSHIP_LABELS: Record<OwnershipType, string> = {
  owned: 'Kendi aracım',
  rented_plate: 'Kiralık plaka',
  rented_vehicle: 'Kiralık araç',
  employer: 'İşverenin aracı',
};

export const PAYMENT_METHODS = ['cash', 'card', 'app', 'other'] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  cash: 'Nakit',
  card: 'Kart',
  app: 'Uygulama',
  other: 'Diğer',
};

/** Giderin davranışı: değişken (kilometreyle artar) veya sabit (dönemsel). */
export const EXPENSE_KINDS = ['variable', 'fixed'] as const;
export type ExpenseKind = (typeof EXPENSE_KINDS)[number];

export const RECURRENCE_PERIODS = [
  'daily', 'weekly', 'monthly', 'quarterly', 'yearly',
] as const;
export type RecurrencePeriod = (typeof RECURRENCE_PERIODS)[number];

export const RECURRENCE_LABELS: Record<RecurrencePeriod, string> = {
  daily: 'Günlük',
  weekly: 'Haftalık',
  monthly: 'Aylık',
  quarterly: '3 Aylık',
  yearly: 'Yıllık',
};

export const GOAL_PERIODS = ['daily', 'weekly', 'monthly'] as const;
export type GoalPeriod = (typeof GOAL_PERIODS)[number];
