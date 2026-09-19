/**
 * Vardiya — günlük döngünün iskeleti.
 *
 * Vardiya BAŞLARKEN hiçbir şey sorulmaz: tek tuş, tek satır. Mesafe ve
 * süre vardiya BİTERKEN sürücünün ağzından alınır ve ikisi de isteğe
 * bağlıdır — hiçbir soru akışı bloklamaz.
 */

import { and, desc, eq, gte, isNull, lte } from 'drizzle-orm';
import { getDb } from '../client';
import { shifts, vehicles } from '../schema';
import { rememberStatedFuelFigures } from './fuel';
import { getCutoffHour } from './settings';
import type { Shift } from '../schema/earnings';
import {
  type UnixMs, alive, assertOwned, ownedById, softDeleteRow, stampNew, updateOwned, withOutbox,
} from './_base';
import { type BusinessDate, toBusinessDate } from '@/lib/business-date';
import type { Kurus } from '@/lib/money';

/**
 * Vardiyayı başlatır.
 *
 * Açık vardiya varsa YENİSİ AÇILMAZ, mevcut olan döner. Sürücü butona
 * iki kez basarsa ya da uygulama iki kez açılırsa iki vardiya oluşması
 * TL/saat hesabını bozar ve sürücü bunu fark edemez.
 *
 * Araç BU HESABIN olmalı: yıpranma payı vardiyanın aracından okunuyor ve
 * yabancı bir araç, sürücünün kârını başka birinin oranıyla hesaplatır.
 */
export function startShift(
  userId: string,
  vehicleId: string,
  cutoffHour?: number,
  now: UnixMs = Date.now(),
): Shift {
  assertOwned(vehicles, 'vehicles', userId, vehicleId);
  const open = getOpenShift(userId);
  if (open) return open;

  /** Kesme saati ayardan okunuyor — vardiyanın günü ona bağlı. */
  const cutoff = cutoffHour ?? getCutoffHour(userId);

  const stamp = stampNew(userId, now);
  return withOutbox('shifts', stamp.id, 'upsert', (tx) => (
    tx.insert(shifts).values({
      ...stamp,
      vehicleId,
      startedAt: now,
      endedAt: null,
      businessDate: toBusinessDate(now, cutoff),
    }).returning().get()
  ), now);
}

export interface EndShiftInput {
  /**
   * O gün uygulamaya ödenen toplam komisyon — TEK RAKAM, oran değil.
   * Sürücü yüzdesini bilmiyor; eline geçeni ve kesileni biliyor.
   */
  commissionKurus?: Kurus | null;

  /**
   * Vardiya boyunca kat edilen yol — kilometre SAYACI DEĞİL.
   * Boşsa yıpranma payı da yakıt maliyeti de hesaplanmaz, tahmin edilmez.
   */
  distanceKm?: number | null;

  /** Aracın ortalama tüketimi, 100 km başına mililitre (7,5 lt → 7500). */
  fuelConsumptionPer100Km?: number | null;

  /** O gün geçerli birim yakıt fiyatı, kuruş/litre. */
  fuelPriceKurus?: Kurus | null;

  /**
   * Fiilen çalışılan süre, dakika. Damga farkını EZER: sürücü mola verir
   * ve vardiyayı kapatmayı unutur. Boşsa damga farkına düşülür.
   */
  workedMinutes?: number | null;

  notes?: string | null;
}

/**
 * Vardiyayı bitirir.
 *
 * Zaten kapalı bir vardiyayı yeniden kapatmaz — `endedAt` korunur.
 * Sürücü geçmiş bir vardiyanın kilometresini sonradan düzeltebilmeli,
 * ama bitiş saati o düzeltmeyle kaymamalı.
 */
export function endShift(
  userId: string, id: string, input: EndShiftInput = {}, now: UnixMs = Date.now(),
): boolean {
  const current = getShift(userId, id);
  if (!current) return false;

  const changed = updateOwned(shifts, 'shifts', userId, id, {
    endedAt: current.endedAt ?? now,
    commissionKurus: sanitizeAmount(input.commissionKurus),
    fuelConsumptionPer100Km: sanitizePositive(input.fuelConsumptionPer100Km),
    fuelPriceKurus: sanitizeAmount(input.fuelPriceKurus),
    distanceKm: sanitizePositive(input.distanceKm),
    workedMinutes: sanitizePositive(input.workedMinutes),
    ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
  }, now);
  if (!changed) return false;

  // Bir dahaki vardiya sonunda alanlar dolu gelsin diye araca hatırlatılıyor.
  rememberStatedFuelFigures(
    userId, current.vehicleId, input.fuelConsumptionPer100Km, input.fuelPriceKurus, now,
  );
  return true;
}

/**
 * Kapanmış vardiyanın mesafe/süre bilgisini sonradan düzeltir.
 *
 * Tüketim ve fiyat burada da ARACA HATIRLATILIYOR, `endShift`'te olduğu
 * gibi. Hatırlatmasaydık: vardiyayı tüketim girmeden kapatıp sonradan
 * detaydan düzelten sürücünün aracında değer boş kalır ve bir sonraki
 * vardiya sonunda alan yine boş gelirdi — aynı sayıyı her seferinde
 * yeniden yazmak zorunda kalırdı.
 */
export function updateShiftTotals(
  userId: string, id: string, input: EndShiftInput, now: UnixMs = Date.now(),
): boolean {
  const current = getShift(userId, id);
  if (!current) return false;

  const changed = updateOwned(shifts, 'shifts', userId, id, {
    ...(input.commissionKurus !== undefined
      ? { commissionKurus: sanitizeAmount(input.commissionKurus) } : {}),
    ...(input.fuelConsumptionPer100Km !== undefined
      ? { fuelConsumptionPer100Km: sanitizePositive(input.fuelConsumptionPer100Km) } : {}),
    ...(input.fuelPriceKurus !== undefined
      ? { fuelPriceKurus: sanitizeAmount(input.fuelPriceKurus) } : {}),
    ...(input.distanceKm !== undefined
      ? { distanceKm: sanitizePositive(input.distanceKm) } : {}),
    ...(input.workedMinutes !== undefined
      ? { workedMinutes: sanitizePositive(input.workedMinutes) } : {}),
    ...(input.notes !== undefined ? { notes: input.notes?.trim() || null } : {}),
  }, now);
  if (!changed) return false;

  rememberStatedFuelFigures(
    userId, current.vehicleId, input.fuelConsumptionPer100Km, input.fuelPriceKurus, now,
  );
  return true;
}

export function deleteShift(userId: string, id: string, now: UnixMs = Date.now()): boolean {
  return softDeleteRow(shifts, 'shifts', userId, id, now);
}

// ---------------------------------------------------------------------------
// Okuma
// ---------------------------------------------------------------------------

/**
 * Açık vardiya. En fazla bir tane olmalı; yine de en yenisi alınıyor —
 * eski bir hatadan iki açık vardiya kaldıysa sürücü en azından kilitlenmez.
 */
export function getOpenShift(userId: string): Shift | undefined {
  return getDb().select().from(shifts)
    .where(and(alive(shifts, userId), isNull(shifts.endedAt)))
    .orderBy(desc(shifts.startedAt))
    .get();
}

export function getShift(userId: string, id: string): Shift | undefined {
  return getDb().select().from(shifts).where(ownedById(shifts, userId, id)).get();
}

/** Bir iş gününün vardiyaları. */
export function listShiftsOnDate(userId: string, date: BusinessDate): Shift[] {
  return getDb().select().from(shifts)
    .where(and(alive(shifts, userId), eq(shifts.businessDate, date)))
    .orderBy(desc(shifts.startedAt))
    .all();
}

/** İki iş günü arasındaki vardiyalar — uçlar dahil. */
export function listShiftsInRange(
  userId: string, from: BusinessDate, to: BusinessDate,
): Shift[] {
  return getDb().select().from(shifts)
    .where(and(
      alive(shifts, userId),
      gte(shifts.businessDate, from),
      lte(shifts.businessDate, to),
    ))
    .orderBy(desc(shifts.startedAt))
    .all();
}

/** Son kapanmış vardiya — arayüzde "geçen vardiyan" karşılaştırması için. */
export function getLastClosedShift(userId: string): Shift | undefined {
  return getDb().select().from(shifts)
    .where(alive(shifts, userId))
    .orderBy(desc(shifts.startedAt))
    .all()
    .find((s) => s.endedAt != null);
}

/**
 * Sıfır ve negatif değerleri `null`'a düşürür.
 *
 * Sürücü alanı boş bırakır ya da yanlışlıkla 0 yazarsa bu BİLİNMİYOR
 * demektir, "sıfır kilometre yaptı" demek değil. Sıfır yazsaydık
 * yıpranma payı sıfır çıkar ve rapor sessizce yanlış olurdu.
 */
function sanitizePositive(value: number | null | undefined): number | null {
  if (value == null) return null;
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

/**
 * Tutarı temizler: negatif ve sıfır `null` olur.
 *
 * Sıfır komisyon ile "komisyon girilmedi" arasındaki farkı korumak
 * gerekmiyor — ikisi de hesaba sıfır olarak giriyor. Ama negatif bir
 * tutar komisyonu GELİRE çevirirdi.
 */
function sanitizeAmount(value: Kurus | null | undefined): Kurus | null {
  if (value == null) return null;
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value) as Kurus;
}
