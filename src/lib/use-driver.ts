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
  ensureSettings, getCutoffHour, getDaySummary, getOpenShift,
  listActiveVehicles, listRidesOnDate,
} from '@/db/repo';
import { useAuth } from '@/lib/auth/auth-context';
import { type BusinessDate, todayBusinessDate } from '@/lib/business-date';
import type { DaySummary } from '@/lib/day-summary';
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
  rides: Ride[];
}

const EMPTY: DriverState = {
  userId: null, vehicle: null, needsSetup: true, openShift: null,
  shiftIsStale: false, openShiftMinutes: 0,
  today: todayBusinessDate(), summary: null, rides: [],
};

export function useDriver(): DriverState {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const value = useDbValue(() => {
    if (!userId) return EMPTY;

    ensureSettings(userId);
    const cutoff = getCutoffHour(userId);
    const now = Date.now();
    const today = todayBusinessDate(cutoff, new Date(now));

    const vehicles = listActiveVehicles(userId);
    const vehicle = vehicles[0] ?? null;
    const openShift = getOpenShift(userId) ?? null;

    // Vardiya açıkken defter onun gününde kalır, takvim dönse bile.
    const activeDate = openShift?.businessDate ?? today;

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
      summary: getDaySummary(userId, activeDate, now),
      rides: listRidesOnDate(userId, activeDate),
    } satisfies DriverState;
  }, [userId]);

  return useMemo(() => value, [value]);
}
