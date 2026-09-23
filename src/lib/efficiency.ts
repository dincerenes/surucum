/**
 * Verimlilik puanı — sürücünün KENDİ geçmişine göre, 0–100.
 *
 * Başka sürücülerle karşılaştırılmıyor (sürücünün kararı, 23 Eylül 2026):
 * şehir, araç ve platform o kadar farklı ki İstanbul'daki sürücüyle
 * Konya'dakini aynı cetvelle ölçmek adil değil. Ölçü, sürücünün o günden
 * önceki 30 gündeki NORMAL günü.
 *
 * NASIL HESAPLANIYOR
 * - Bir günün saat başına cebe kalanı, önceki 30 günün ORTANCA saat başına
 *   cebe kalanına bölünür. Ortalama değil ortanca: tek bir bayram günü
 *   ya da yarım kalmış bir vardiya "normal"i kaydırmasın.
 * - Kilometre biliniyorsa aynı oran km başına da alınır; ikisi 60/40
 *   harmanlanır. Saat ağır basıyor çünkü sürücünün elindeki asıl kaynak
 *   zaman; km her vardiyada girilmiyor.
 * - Oran 1 ise puan 50: "normal günün". 1,4 → 70, 2 → 100 (tavan),
 *   0,6 → 30. Zarar edilen gün 0.
 *
 * PUANLANMAYAN GÜN
 * - Açık vardiyası olan gün: açık vardiyanın süresi yok (vardiya bitince
 *   soruluyor), yolcuları ise sayılıyor — saat başına oran şişer.
 * - Önceki 30 günde puanlanabilir en az `MIN_BASELINE_DAYS` gün yoksa:
 *   iki günlük geçmişe "normalin" demek sürücüye bilmediğimiz bir şeyi
 *   biliyormuş gibi söylemek olur.
 *
 * Veritabanı bilmez; gün özetlerini alır.
 */

import { type BusinessDate, addDays } from './business-date.ts';
import type { Kurus } from './money.ts';
import type { DayEntry } from './stats.ts';

/** Ölçünün geriye baktığı gün sayısı. */
export const BASELINE_WINDOW_DAYS = 30;
/** Ölçü için gereken en az puanlanabilir gün. */
export const MIN_BASELINE_DAYS = 5;

const HOUR_WEIGHT = 0.6;
const KM_WEIGHT = 0.4;
/** Oran 1 (normal gün) → 50 puan. */
const POINTS_PER_RATIO = 50;

/**
 * Puanlanabilir gün mü: çalışılmış, açık vardiyası yok, süresi var.
 * Saat başına oran yoksa gün ne ölçü olur ne ölçülür.
 */
export function isScorable(entry: DayEntry): boolean {
  const s = entry.summary;
  return s.isWorkedDay
    && s.completeness.openShiftCount === 0
    && s.perHour != null;
}

/** Ortanca. Boş dizide `null`. */
export function median(values: readonly number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 1
    ? sorted[mid]
    : (sorted[mid - 1] + sorted[mid]) / 2;
}

export interface Baseline {
  /** Kaç günden çıkarıldı. */
  dayCount: number;
  /** Normal gününün saat başına cebe kalanı (ortanca). */
  perHour: Kurus;
  /** Normal gününün km başına cebe kalanı. Yeterli km yoksa `null`. */
  perKm: Kurus | null;
}

/**
 * `date`'ten ÖNCEKİ 30 günün ölçüsü. O günün kendisi dahil değil: bir
 * günü kendisiyle karşılaştırmak onu hep "normale" çeker.
 *
 * Ortanca sıfır ya da negatifse ölçü yok: zararlı bir "normal"e bölmek
 * işareti ters çevirir, kötü günü iyi gösterir.
 */
export function baselineFor(
  entries: readonly DayEntry[], date: BusinessDate,
): Baseline | null {
  const from = addDays(date, -BASELINE_WINDOW_DAYS);
  const window = entries.filter((e) => e.date >= from && e.date < date && isScorable(e));
  if (window.length < MIN_BASELINE_DAYS) return null;

  const perHour = median(window.map((e) => e.summary.perHour!));
  if (perHour == null || perHour <= 0) return null;

  const kms = window
    .map((e) => e.summary.perKm)
    .filter((v): v is Kurus => v != null);
  const perKm = kms.length >= MIN_BASELINE_DAYS ? median(kms) : null;

  return {
    dayCount: window.length,
    perHour: Math.round(perHour) as Kurus,
    perKm: perKm != null && perKm > 0 ? Math.round(perKm) as Kurus : null,
  };
}

/** Oranı puana çevirir: 1 → 50, 2 ve üstü → 100, zarar → 0. */
export function ratioToScore(ratio: number): number {
  if (!Number.isFinite(ratio) || ratio <= 0) return 0;
  return Math.min(100, Math.round(ratio * POINTS_PER_RATIO));
}

export interface DayScore {
  date: BusinessDate;
  score: number;
  /** Günün saat başına cebe kalanı. */
  perHour: Kurus;
  perKm: Kurus | null;
  baseline: Baseline;
  /** Km oranı harmana girdi mi? */
  usedKm: boolean;
}

/** Tek günün puanı. Puanlanamıyorsa `null`. */
export function scoreDay(entry: DayEntry, baseline: Baseline | null): DayScore | null {
  if (!baseline || !isScorable(entry)) return null;
  const s = entry.summary;
  const hourRatio = s.perHour! / baseline.perHour;
  const usedKm = s.perKm != null && baseline.perKm != null;
  const ratio = usedKm
    ? HOUR_WEIGHT * hourRatio + KM_WEIGHT * (s.perKm! / baseline.perKm!)
    : hourRatio;

  /**
   * Zarar edilen gün her durumda 0: km oranı pozitif kalıp saat oranının
   * eksisini örtmesin.
   */
  const score = s.profit.cashProfit <= 0 ? 0 : ratioToScore(ratio);
  return { date: entry.date, score, perHour: s.perHour!, perKm: s.perKm, baseline, usedKm };
}

/**
 * Aralıktaki her günün puanı — her gün KENDİ önceki 30 gününe göre.
 *
 * `entries` aralıktan 30 gün öncesini de içermeli; yoksa aralığın ilk
 * günleri ölçüsüz kalır. Eskiden yeniye sıralı döner.
 */
export function scoreDays(
  entries: readonly DayEntry[], from: BusinessDate, to: BusinessDate,
): DayScore[] {
  return entries
    .filter((e) => e.date >= from && e.date <= to)
    .map((e) => scoreDay(e, baselineFor(entries, e.date)))
    .filter((s): s is DayScore => s != null)
    .sort((a, b) => (a.date < b.date ? -1 : 1));
}

/** Puanların ortalaması, tam sayı. Puan yoksa `null`. */
export function averageScore(scores: readonly DayScore[]): number | null {
  if (scores.length === 0) return null;
  return Math.round(scores.reduce((acc, s) => acc + s.score, 0) / scores.length);
}

export type ScoreBand = 'great' | 'good' | 'normal' | 'low' | 'poor';

export function scoreBand(score: number): ScoreBand {
  if (score >= 70) return 'great';
  if (score >= 56) return 'good';
  if (score >= 45) return 'normal';
  if (score >= 30) return 'low';
  return 'poor';
}

export const SCORE_BAND_LABELS: Record<ScoreBand, string> = {
  great: 'Harika',
  good: 'Normalin üstünde',
  normal: 'Normal',
  low: 'Normalin altında',
  poor: 'Zayıf',
};

/**
 * Puan henüz yoksa kaç puanlanabilir gün daha gerekiyor — "puanın 3 gün
 * sonra hesaplanacak". Son 30 güne bakılıyor, bugün dahil.
 */
export function daysUntilScore(entries: readonly DayEntry[], today: BusinessDate): number {
  const from = addDays(today, -BASELINE_WINDOW_DAYS);
  const have = entries.filter((e) => e.date >= from && e.date <= today && isScorable(e)).length;
  /** Ölçü 5 gün + puanlanacak 1 gün. */
  return Math.max(0, MIN_BASELINE_DAYS + 1 - have);
}
