/**
 * Gün özeti okuma yolu — üç satırın ekrana geldiği yer.
 *
 * Bu dosya YALNIZCA satırları okur; aritmetiğin tamamı
 * `src/lib/day-summary.ts` içinde ve native SQLite olmadan test ediliyor.
 * Buraya hesap yazılmaz.
 */

import { and, asc, eq, gte, lte } from 'drizzle-orm';
import { getDb } from '../client';
import { expenses, fuelLogs, rides, shifts, vehicles } from '../schema';
import { type UnixMs, alive } from './_base';
import { getCutoffHour } from './settings';
import type { Kurus } from '@/lib/money';
import { type DaySummary, type ShiftRow, calculateDaySummary } from '@/lib/day-summary';
import { type BusinessDate, todayBusinessDate } from '@/lib/business-date';

/**
 * Vardiyanın aracı — yalnızca AYNI HESABINSA.
 *
 * Kimlikle birleştirmek yetmiyor: başka bir hesabın aracına bağlanmış bir
 * vardiya (eski sürümde açılmış ya da buluttan öyle inmiş) o aracın
 * oranıyla hesaplanıyordu. Sürücünün kendi kiralık aracında sıfır olan
 * yıpranma payı, yabancı aracın 250 kuruşuyla düşülürdü. Böyle bir
 * vardiyada oran boş kalır ve pay hesaplanmaz — uydurulmaz.
 */
const ownVehicleOfShift = and(
  eq(shifts.vehicleId, vehicles.id),
  eq(vehicles.userId, shifts.userId),
);

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

/**
 * Aralıktaki her GÜNÜN ayrı özeti — istatistik ekranının girdisi.
 *
 * Gün gün `getDaySummary` çağırmıyoruz: altmış gün için üç yüz sorgu
 * demekti ve ekran açılırken donuyordu. Dört toplu okuma yapılıp satırlar
 * bellekte güne göre gruplanıyor, aritmetik yine aynı test edilmiş
 * fonksiyondan geçiyor.
 *
 * KAYDI OLMAYAN GÜN LİSTEDE YOK. Boş günü sıfır kazançlı bir gün gibi
 * döndürmek ortalamaları bozar: sürücü çalışmadığı Pazar'ı "0 ₺ kazandığı
 * gün" olarak saymaz ve haklıdır.
 */
export function listDaySummaries(
  userId: string, from: BusinessDate, to: BusinessDate, now: UnixMs = Date.now(),
): Array<{ date: BusinessDate; summary: DaySummary }> {
  const rides = groupByDate(readRidesByDay(userId, from, to));
  const expenses = groupByDate(readExpensesByDay(userId, from, to));
  const fuel = groupByDate(readFuelLogsByDay(userId, from, to));
  const shifts = groupByDate(readShiftRowsByDay(userId, from, to));

  const dates = new Set<BusinessDate>([
    ...rides.keys(), ...expenses.keys(), ...fuel.keys(), ...shifts.keys(),
  ]);

  return [...dates]
    .sort((a, b) => (a < b ? 1 : -1))
    .map((date) => ({
      date,
      summary: calculateDaySummary({
        rides: rides.get(date) ?? [],
        expenses: expenses.get(date) ?? [],
        fuelLogs: fuel.get(date) ?? [],
        shifts: shifts.get(date) ?? [],
        now,
      }),
    }));
}

/**
 * Kullanıcının EN ESKİ kaydının iş günü. Hiç kaydı yoksa `null`.
 *
 * "Tümü" dönemi bunu başlangıç alıyor. Sabit bir pencere (örneğin son iki
 * yıl) kullansaydık etiket "Tümü" derken daha eski kayıtlar sessizce
 * dışarıda kalırdı: sürücü sayının yanlış olduğunu değil, kayıtlarının
 * kaybolduğunu düşünür.
 */
export function getFirstRecordDate(userId: string): BusinessDate | null {
  const dates = [
    getDb().select({ d: rides.businessDate }).from(rides)
      .where(alive(rides, userId)).orderBy(asc(rides.businessDate)).get()?.d,
    getDb().select({ d: expenses.businessDate }).from(expenses)
      .where(alive(expenses, userId)).orderBy(asc(expenses.businessDate)).get()?.d,
    getDb().select({ d: fuelLogs.businessDate }).from(fuelLogs)
      .where(alive(fuelLogs, userId)).orderBy(asc(fuelLogs.businessDate)).get()?.d,
    getDb().select({ d: shifts.businessDate }).from(shifts)
      .where(alive(shifts, userId)).orderBy(asc(shifts.businessDate)).get()?.d,
  ].filter((d): d is BusinessDate => d != null);

  if (dates.length === 0) return null;
  return dates.reduce((a, b) => (a < b ? a : b));
}

/** İş gününe göre gruplar. Satırın kendi `businessDate`'i anahtardır. */
function groupByDate<T extends { businessDate: BusinessDate }>(
  rows: readonly T[],
): Map<BusinessDate, T[]> {
  const map = new Map<BusinessDate, T[]>();
  for (const row of rows) {
    const list = map.get(row.businessDate);
    if (list) list.push(row);
    else map.set(row.businessDate, [row]);
  }
  return map;
}

function readRidesByDay(userId: string, from: BusinessDate, to: BusinessDate) {
  return getDb().select({
    businessDate: rides.businessDate,
    grossAmountKurus: rides.grossAmountKurus,
    commissionKurus: rides.commissionKurus,
    tipKurus: rides.tipKurus,
  }).from(rides).where(and(
    alive(rides, userId),
    gte(rides.businessDate, from),
    lte(rides.businessDate, to),
  )).all();
}

function readExpensesByDay(userId: string, from: BusinessDate, to: BusinessDate) {
  return getDb().select({
    businessDate: expenses.businessDate,
    amountKurus: expenses.amountKurus,
  }).from(expenses).where(and(
    alive(expenses, userId),
    gte(expenses.businessDate, from),
    lte(expenses.businessDate, to),
  )).all();
}

function readFuelLogsByDay(userId: string, from: BusinessDate, to: BusinessDate) {
  return getDb().select({
    businessDate: fuelLogs.businessDate,
    totalAmountKurus: fuelLogs.totalAmountKurus,
  }).from(fuelLogs).where(and(
    alive(fuelLogs, userId),
    gte(fuelLogs.businessDate, from),
    lte(fuelLogs.businessDate, to),
  )).all();
}

function readShiftRowsByDay(
  userId: string, from: BusinessDate, to: BusinessDate,
): Array<ShiftRow & { businessDate: BusinessDate }> {
  return getDb().select({
    businessDate: shifts.businessDate,
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
    .leftJoin(vehicles, ownVehicleOfShift)
    .where(and(
      alive(shifts, userId),
      gte(shifts.businessDate, from),
      lte(shifts.businessDate, to),
    ))
    .all()
    .map((r) => ({
      ...r,
      commissionKurus: r.commissionKurus as Kurus | null,
      fuelPriceKurus: r.fuelPriceKurus as Kurus | null,
      wearPerKmKurus: r.wearPerKmKurus as Kurus | null,
    }));
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
 *
 * Birleştirme aracın SAHİBİNİ de koşula koyuyor (`ownVehicleOfShift`).
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
    .leftJoin(vehicles, ownVehicleOfShift)
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
