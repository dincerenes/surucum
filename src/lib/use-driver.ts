/**
 * Ekranların ihtiyaç duyduğu ortak durum: kullanıcı, aktif araç, açık
 * vardiya ve bugünün özeti.
 *
 * Tek yerde toplanıyor çünkü her ekran aynı dört şeyi soruyor ve her
 * birinin ayrı ayrı hesaplaması hem tekrar hem de tutarsızlık riski.
 */

import { useMemo } from 'react';
import { useDbValue } from '@/db/use-db';
import {
  ensureSettings, getDailyGoalKurus, getDaySummary, getOpenShift,
  listActiveVehicles, listRidesInShift, listRidesOnDate,
} from '@/db/repo';
import { useAuth } from '@/lib/auth/auth-context';
import { type BusinessDate, todayBusinessDate } from '@/lib/business-date';
import type { DaySummary } from '@/lib/day-summary';
import { type GoalProgress, calculateGoalProgress } from '@/lib/goal';
import { type Kurus, ZERO, add } from '@/lib/money';
import { isShiftStale, resolveShiftDuration } from '@/lib/shift';
import type { Ride, Shift } from '@/db/schema/earnings';
import type { Vehicle } from '@/db/schema/vehicles';

export interface DriverState {
  userId: string | null;
  vehicle: Vehicle | null;
  /** Kurulum tamamlandı mı? Araç yoksa uygulama kullanılamaz. */
  needsSetup: boolean;
  openShift: Shift | null;
  /** Açık vardiya eşiği aştı mı? Arayüz sormak zorunda. */
  shiftIsStale: boolean;
  /** Açık vardiyanın şu ana kadarki süresi, dakika. */
  openShiftMinutes: number;
  /**
   * Ekranda gösterilen iş günü.
   *
   * Vardiya AÇIKSA onun günü — takvim günü dönse bile ekran vardiyayla
   * birlikte kalır. Gece 22:00'de başlayan vardiya sabah 05:00'te hâlâ
   * aynı defterde görünür; sürücü tek bir iş yaptı.
   */
  today: BusinessDate;
  summary: DaySummary | null;
  /** Gün defterinin seferleri — iş gününün tamamı. */
  rides: Ride[];

  /**
   * YALNIZCA açık vardiyanın seferleri.
   *
   * Günden ayrı tutuluyor: bir iş gününde iki vardiya olabilir ve canlı
   * ekran "CANLI VARDİYA" diyorsa oradaki her sayı o vardiyanın olmalı.
   * Karıştırıldığında sürücü, yeni başlattığı boş vardiyada bir önceki
   * vardiyanın parasını görüyor.
   */
  shiftRides: Ride[];

  /** Açık vardiyanın cirosu — brüt, hiçbir kesinti düşülmemiş. */
  shiftGross: Kurus;

  /**
   * Günlük hedefin durumu. Hedef konmamışsa `null` — hedefsiz sürücüye
   * boş bir çubuk göstermiyoruz.
   */
  goal: GoalProgress | null;
}

const EMPTY: DriverState = {
  userId: null, vehicle: null, needsSetup: true, openShift: null,
  shiftIsStale: false, openShiftMinutes: 0,
  today: todayBusinessDate(), summary: null, rides: [],
  shiftRides: [], shiftGross: ZERO, goal: null,
};

export function useDriver(): DriverState {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const value = useDbValue(() => {
    if (!userId) return EMPTY;

    const settings = ensureSettings(userId);
    const cutoff = settings.dayCutoffHour;
    const now = Date.now();
    const today = todayBusinessDate(cutoff, new Date(now));

    /**
     * Aktif araç AYARDAN geliyor, listenin ilkinden değil.
     *
     * Sürücü Araçlarım'dan başka bir aracı seçtiğinde vardiya ona
     * bağlanmalı ve yıpranma payı onun oranından gelmeli. Listenin ilkine
     * bakan bir okuma, sürücünün gördüğü araç ile kaydın gittiği aracı
     * ayırırdı. Ayardaki araç pasifleştirilmişse listenin ilkine düşülüyor.
     */
    const vehicles = listActiveVehicles(userId);
    const vehicle = vehicles.find((v) => v.id === settings.defaultVehicleId)
      ?? vehicles[0] ?? null;
    const openShift = getOpenShift(userId) ?? null;

    // Vardiya açıkken defter onun gününde kalır, takvim dönse bile.
    const activeDate = openShift?.businessDate ?? today;

    const shiftRides = openShift ? listRidesInShift(openShift.id) : [];
    const summary = getDaySummary(userId, activeDate, now);

    return {
      userId,
      vehicle,
      needsSetup: vehicle == null,
      openShift,
      shiftIsStale: openShift ? isShiftStale(openShift, now) : false,
      openShiftMinutes: openShift
        ? resolveShiftDuration({ ...openShift, distanceKm: openShift.distanceKm }, now).minutes
        : 0,
      today: activeDate,
      summary,
      rides: listRidesOnDate(userId, activeDate),
      shiftRides,
      shiftGross: shiftRides.reduce((sum, r) => add(sum, r.grossAmountKurus), ZERO),
      /**
       * Hedefin paydası CEBE KALAN. Ciro hedefi yakıtı ve komisyonu yok
       * sayar; gerçek kâr ise kilometre girilene kadar eksik.
       */
      goal: calculateGoalProgress(getDailyGoalKurus(userId), summary.profit.cashProfit),
    } satisfies DriverState;
  }, [userId]);

  return useMemo(() => value, [value]);
}
