/**
 * Dönemler — Kayıtlar ve İstatistik'in filtre çubuğu, aylık arşiv.
 *
 * İki ekran AYNI dönemleri AYNI sınırlarla görmeli: "Bu ay" Kayıtlar'da
 * 1 Eylül'den, İstatistik'te son 30 günden başlasaydı sürücü iki ekranda
 * iki farklı ciro görürdü ve hangisine inanacağını bilemezdi.
 *
 * Veritabanı bilmez.
 */

import {
  type BusinessDate, addDays, asBusinessDate, endOfMonth, formatBusinessDate,
  isBusinessDate, startOfMonth, startOfWeek, startOfYear,
} from './business-date.ts';

export type PeriodKey = 'week' | 'month' | 'year' | 'all';

export const PERIOD_KEYS: readonly PeriodKey[] = ['week', 'month', 'year', 'all'];

export const PERIOD_LABELS: Record<PeriodKey, string> = {
  week: 'Bu hafta',
  month: 'Bu ay',
  year: 'Bu yıl',
  all: 'Tüm zamanlar',
};

/** Karşılaştırma kartının başlığı — "Tüm zamanlar"ın öncesi yok. */
export const PREVIOUS_PERIOD_LABELS: Record<Exclude<PeriodKey, 'all'>, string> = {
  week: 'Geçen hafta',
  month: 'Geçen ay',
  year: 'Geçen yıl',
};

export interface PeriodRange {
  from: BusinessDate;
  to: BusinessDate;
  /** Karşılaştırılacak önceki dönem; "Tüm zamanlar"da yok. */
  previousFrom: BusinessDate | null;
  previousTo: BusinessDate | null;
}

/**
 * Dönemin sınırları ve karşılaştırılacak önceki dönem.
 *
 * Bitiş her zaman BUGÜN: yarısı geçmiş bir ayı tam ay gibi göstermek,
 * sürücüye ayın kötü geçtiğini düşündürür. Önceki dönem TAM alınıyor ve
 * karşılaştırma notunda gün sayısı yazılıyor.
 *
 * "Tüm zamanlar" ilk kayıttan başlar; sabit bir pencere eski günleri
 * sessizce yutardı. Hiç kayıt yoksa bugün — sorgu boş döner.
 */
export function periodBounds(
  period: PeriodKey, today: BusinessDate, oldest: BusinessDate | null,
): PeriodRange {
  if (period === 'week') {
    const from = startOfWeek(today);
    return { from, to: today, previousFrom: addDays(from, -7), previousTo: addDays(from, -1) };
  }
  if (period === 'month') {
    const from = startOfMonth(today);
    const previousTo = addDays(from, -1);
    return { from, to: today, previousFrom: startOfMonth(previousTo), previousTo };
  }
  if (period === 'year') {
    const from = startOfYear(today);
    const previousTo = addDays(from, -1);
    return { from, to: today, previousFrom: startOfYear(previousTo), previousTo };
  }
  const from = oldest != null && oldest < today ? oldest : today;
  return { from, to: today, previousFrom: null, previousTo: null };
}

// ---------------------------------------------------------------------------
// Aylık arşiv
// ---------------------------------------------------------------------------

/** 'YYYY-MM' — arşivde bir ayın anahtarı ve adresteki parametresi. */
export type MonthKey = string & { readonly __month: true };

const MONTH_KEY = /^(\d{4})-(0[1-9]|1[0-2])$/;

export function isMonthKey(value: unknown): value is MonthKey {
  return typeof value === 'string' && MONTH_KEY.test(value);
}

export function monthKeyOf(d: BusinessDate): MonthKey {
  return d.slice(0, 7) as MonthKey;
}

/** Ayın ilk ve son günü. Bozuk anahtarda `null` — adresten geliyor. */
export function monthRange(key: string): { from: BusinessDate; to: BusinessDate } | null {
  if (!isMonthKey(key)) return null;
  const first = `${key}-01`;
  if (!isBusinessDate(first)) return null;
  const from = asBusinessDate(first);
  return { from, to: endOfMonth(from) };
}

/** "Haziran 2026". */
export function formatMonthKey(key: MonthKey): string {
  return formatBusinessDate(asBusinessDate(`${key}-01`), 'monthYear');
}

/**
 * `from` ile `to` arasındaki aylar, EN YENİ ÖNCE, iki uç dahil.
 * `from` `to`'dan sonraysa boş.
 */
export function monthsBetween(from: BusinessDate, to: BusinessDate): MonthKey[] {
  const first = monthKeyOf(from);
  const out: MonthKey[] = [];
  let cursor = startOfMonth(to);
  while (monthKeyOf(cursor) >= first) {
    out.push(monthKeyOf(cursor));
    cursor = startOfMonth(addDays(cursor, -1));
  }
  return out;
}
