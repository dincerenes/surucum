/**
 * Anasayfa kartlarının aritmetiği.
 *
 * Veritabanı bilmez: gün özetlerini ve dönem toplamlarını alır, kartların
 * gösterdiği sayıları üretir. Okuma `src/db/repo/home.ts` içinde.
 */

import { type BusinessDate, addDays } from './business-date.ts';
import type { Kurus } from './money.ts';
import type { DayEntry, PeriodTotals } from './stats.ts';

export interface DailyBar {
  date: BusinessDate;
  /** O günün cebe kalanı. Kaydı olmayan günde `null` — sıfır değil. */
  cashProfit: Kurus | null;
  isToday: boolean;
}

/**
 * Son `n` günün çubukları — en eski solda, bugün sağda.
 *
 * Kaydı olmayan gün de çubuk olarak duruyor (boş): yedi günün beşinde
 * çalışan sürücü iki boşluğu görmeli, grafik o günleri yutup beş günü
 * yan yana dizerse hafta olduğundan dolu görünür.
 */
export function lastDays(
  entries: readonly DayEntry[], today: BusinessDate, n = 7,
): DailyBar[] {
  const byDate = new Map(entries.map((e) => [e.date, e.summary]));
  return Array.from({ length: n }, (_, i) => {
    const date = addDays(today, i - (n - 1));
    const summary = byDate.get(date);
    return {
      date,
      cashProfit: summary?.hasActivity ? summary.profit.cashProfit : null,
      isToday: date === today,
    };
  });
}

export interface MonthlyAverages {
  /** Çalışılan gün sayısı — ortalamaların paydası. */
  workedDayCount: number;
  /** Gün başına cebe kalan — kartın büyük sayısı. */
  perDay: Kurus | null;
  revenuePerDay: Kurus | null;
  ridesPerDay: number | null;
  /**
   * Gün başına km — YALNIZCA km'si girilmiş günlerden. Km'si boş günü
   * paydaya katmak ortalamayı sessizce düşürürdü; hiç yoksa `null`.
   */
  kmPerDay: number | null;
  minutesPerDay: number | null;
}

/** Ayın gün başına ortalamaları. Çalışılmış gün yoksa hepsi `null`. */
export function monthlyAverages(t: PeriodTotals): MonthlyAverages {
  const days = t.workedDayCount;
  const per = (value: number) => (days > 0 ? value / days : null);
  return {
    workedDayCount: days,
    perDay: t.perDay,
    revenuePerDay: t.revenuePerDay,
    ridesPerDay: per(t.rideCount),
    kmPerDay: t.distanceKm != null && t.distanceDayCount > 0
      ? Math.round(t.distanceKm / t.distanceDayCount)
      : null,
    minutesPerDay: days > 0 ? Math.round(t.durationMinutes / days) : null,
  };
}

/** Çubuğun yüksekliği 0–1: en iyi güne göre. Zarar ve boş gün 0. */
export function barRatio(value: Kurus | null, bars: readonly DailyBar[]): number {
  const best = bars.reduce((acc, b) => Math.max(acc, b.cashProfit ?? 0), 0);
  if (value == null || value <= 0 || best <= 0) return 0;
  return value / best;
}
