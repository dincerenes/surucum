/**
 * Gün özeti okuma yolu — üç satırın ekrana geldiği yer.
 *
 * Bu dosya YALNIZCA satırları okur; aritmetiğin tamamı
 * `src/lib/day-summary.ts` içinde ve native SQLite olmadan test ediliyor.
 * Buraya hesap yazılmaz.
 */

import { and, eq, gte, lte } from 'drizzle-orm';
import { getDb } from '../client';
import { expenses, fuelLogs, rides, shifts, vehicles } from '../schema';
import { type UnixMs, alive } from './_base';
import { getCutoffHour } from './settings';
import type { Kurus } from '@/lib/money';
import { type DaySummary, type ShiftRow, calculateDaySummary } from '@/lib/day-summary';
import { type BusinessDate, todayBusinessDate } from '@/lib/business-date';

/**
 * Bir iş gününün özeti.
 *
 * `fixedShare` SIFIR ve v1'de öyle kalıyor: sabit gider tahakkuku yayın
 * sonrasına ertelendi (27 Ağustos 2026 kapsam kararı). Sürücü plaka kirası
 * gibi ödemeleri sıradan gider olarak giriyor; o gün "cebe kalan"dan
 * düşüyorlar. Gerçek kâr satırı yalnızca km yıpranma payını düşüyor.
 */
export function getDaySummary(
  userId: string, date: BusinessDate, now: UnixMs = Date.now(),
): DaySummary {
  return calculateDaySummary({
    rides: readRides(userId, date),
    expenses: readExpenses(userId, date),
    fuelLogs: readFuelLogs(userId, date),
    shifts: readShiftRows(userId, date),
    now,
  });
}

export function getTodaySummary(
  userId: string, now: UnixMs = Date.now(),
): DaySummary {
  const date = todayBusinessDate(getCutoffHour(userId), new Date(now));
  return getDaySummary(userId, date, now);
}

/**
 * Bir iş günü aralığının özeti — hafta, ay, "tümü".
 *
 * Günlere bölünmez, aralığın tamamı tek seferde toplanır: gün gün
 * toplayıp sonra birleştirmek her günde bir yuvarlama yapar ve aylık
 * toplam, günlerin toplamıyla tutmaz.
 */
export function getRangeSummary(
  userId: string, from: BusinessDate, to: BusinessDate, now: UnixMs = Date.now(),
): DaySummary {
  return calculateDaySummary({
    rides: readRides(userId, from, to),
    expenses: readExpenses(userId, from, to),
    fuelLogs: readFuelLogs(userId, from, to),
    shifts: readShiftRows(userId, from, to),
    now,
  });
}

// ---------------------------------------------------------------------------
// Okuma — hepsi yalnızca özetin ihtiyaç duyduğu sütunları çekiyor
// ---------------------------------------------------------------------------

function readRides(userId: string, from: BusinessDate, to: BusinessDate = from) {
  return getDb().select({
    grossAmountKurus: rides.grossAmountKurus,
    commissionKurus: rides.commissionKurus,
    tipKurus: rides.tipKurus,
  }).from(rides).where(and(
    alive(rides, userId),
    gte(rides.businessDate, from),
    lte(rides.businessDate, to),
  )).all();
}

function readExpenses(userId: string, from: BusinessDate, to: BusinessDate = from) {
  return getDb().select({ amountKurus: expenses.amountKurus })
    .from(expenses).where(and(
      alive(expenses, userId),
      gte(expenses.businessDate, from),
      lte(expenses.businessDate, to),
    )).all();
}

function readFuelLogs(userId: string, from: BusinessDate, to: BusinessDate = from) {
  return getDb().select({ totalAmountKurus: fuelLogs.totalAmountKurus })
    .from(fuelLogs).where(and(
      alive(fuelLogs, userId),
      gte(fuelLogs.businessDate, from),
      lte(fuelLogs.businessDate, to),
    )).all();
}

/**
 * Vardiyaları ARACIN yıpranma oranıyla birlikte okur.
 *
 * Oran vardiyanın üzerinde taşınıyor: aynı iş gününde iki farklı araçla
 * çalışılabilir ve her aracın oranı farklıdır. Araç silinmişse oran boş
 * gelir ve o vardiyanın payı hesaplanmaz — uydurulmaz.
 */
function readShiftRows(
  userId: string, from: BusinessDate, to: BusinessDate = from,
): ShiftRow[] {
  return getDb().select({
    startedAt: shifts.startedAt,
    endedAt: shifts.endedAt,
    workedMinutes: shifts.workedMinutes,
    distanceKm: shifts.distanceKm,
    commissionKurus: shifts.commissionKurus,
    fuelConsumptionPer100Km: shifts.fuelConsumptionPer100Km,
    fuelPriceKurus: shifts.fuelPriceKurus,
    wearPerKmKurus: vehicles.wearPerKmKurus,
  })
    .from(shifts)
    .leftJoin(vehicles, eq(shifts.vehicleId, vehicles.id))
    .where(and(
      alive(shifts, userId),
      gte(shifts.businessDate, from),
      lte(shifts.businessDate, to),
    ))
    .all()
    .map((r) => ({
      startedAt: r.startedAt,
      endedAt: r.endedAt,
      workedMinutes: r.workedMinutes,
      distanceKm: r.distanceKm,
      commissionKurus: r.commissionKurus as Kurus | null,
      fuelConsumptionPer100Km: r.fuelConsumptionPer100Km,
      fuelPriceKurus: r.fuelPriceKurus as Kurus | null,
      wearPerKmKurus: r.wearPerKmKurus as Kurus | null,
    }));
}
