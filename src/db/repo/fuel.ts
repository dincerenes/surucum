/**
 * Yakıt dolumu.
 *
 * `isFullTank` işaretli iki kayıt arasındaki kilometre ve hacim, aracın
 * GERÇEK tüketimini verir (tam depo yöntemi). Bu yüzden dolum ekranı
 * kilometre sayacını sorar: sürücü zaten pompanın başında, göstergeye
 * bakıyor. Vardiya akışı sayaç sormuyor, burası soruyor.
 */

import { and, desc, eq, gte, lte } from 'drizzle-orm';
import { getDb } from '../client';
import { fuelLogs, vehicleFuelTypes } from '../schema';
import type { FuelLog } from '../schema/fuel';
import type { FuelType } from '../schema/_shared';
import { type UnixMs, alive, aliveById, softDeleteRow, stampNew, withOutbox } from './_base';
import type { Kurus } from '@/lib/money';
import { type BusinessDate, DEFAULT_CUTOFF_HOUR, toBusinessDate } from '@/lib/business-date';

export interface NewFuelLogInput {
  vehicleId: string;
  fuelType: FuelType;

  /** Sıvı/gaz yakıtta MİLİLİTRE, elektrikte WATT-SAAT. Tam sayı. */
  volumePer1000: number;

  /** Birim başına kuruş: litre, kg veya kWh. */
  unitPriceKurus: Kurus;
  totalAmountKurus: Kurus;

  /** Gerçek tüketim hesabının şartı. */
  isFullTank?: boolean;

  odometerKm?: number | null;
  /** Kullanıcının yazdığı istasyon adı — bu onun kendi verisi. */
  stationName?: string | null;
  receiptPath?: string | null;
  notes?: string | null;
  occurredAt?: UnixMs;

  /**
   * İş günü. Açık vardiya varsa ÇAĞIRAN vardiyanın gününü verir; yoksa
   * kaydın saatinden türetilir. Gece vardiyası gün ortasında dönmesin.
   */
  businessDate?: BusinessDate;
}

/**
 * Dolum kaydeder ve aracın son bilinen birim fiyatını günceller.
 *
 * Son fiyat çevrimdışıyken tahmini maliyet için lazım — yakıt fiyatı
 * kaynağı henüz seçilmedi ve sürücünün kendi son dolumu, dışarıdan
 * gelen herhangi bir fiyattan daha doğru.
 */
export function addFuelLog(
  userId: string,
  input: NewFuelLogInput,
  cutoffHour: number = DEFAULT_CUTOFF_HOUR,
  now: UnixMs = Date.now(),
): FuelLog {
  const occurredAt = input.occurredAt ?? now;
  const stamp = stampNew(userId, now);

  const row = withOutbox('fuel_logs', stamp.id, 'upsert', (tx) => (
    tx.insert(fuelLogs).values({
      ...stamp,
      vehicleId: input.vehicleId,
      fuelType: input.fuelType,
      occurredAt,
      businessDate: input.businessDate ?? toBusinessDate(occurredAt, cutoffHour),
      volumePer1000: Math.round(input.volumePer1000),
      unitPriceKurus: input.unitPriceKurus,
      totalAmountKurus: input.totalAmountKurus,
      odometerKm: input.odometerKm ?? null,
      isFullTank: input.isFullTank ?? true,
      stationName: input.stationName?.trim() || null,
      receiptPath: input.receiptPath ?? null,
      notes: input.notes?.trim() || null,
    }).returning().get()
  ), now);

  rememberUnitPrice(input.vehicleId, input.fuelType, input.unitPriceKurus, now);
  return row;
}

export function updateFuelLog(
  id: string, patch: Partial<NewFuelLogInput>, now: UnixMs = Date.now(),
): void {
  withOutbox('fuel_logs', id, 'upsert', (tx) => {
    tx.update(fuelLogs).set({
      ...(patch.volumePer1000 !== undefined
        ? { volumePer1000: Math.round(patch.volumePer1000) } : {}),
      ...(patch.unitPriceKurus !== undefined
        ? { unitPriceKurus: patch.unitPriceKurus } : {}),
      ...(patch.totalAmountKurus !== undefined
        ? { totalAmountKurus: patch.totalAmountKurus } : {}),
      ...(patch.odometerKm !== undefined ? { odometerKm: patch.odometerKm } : {}),
      ...(patch.isFullTank !== undefined ? { isFullTank: patch.isFullTank } : {}),
      ...(patch.stationName !== undefined
        ? { stationName: patch.stationName?.trim() || null } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes?.trim() || null } : {}),
      updatedAt: now,
    }).where(eq(fuelLogs.id, id)).run();
  }, now);
}

export function deleteFuelLog(id: string, now: UnixMs = Date.now()): void {
  softDeleteRow(fuelLogs, 'fuel_logs', id, now);
}

// ---------------------------------------------------------------------------
// Okuma
// ---------------------------------------------------------------------------

export function getFuelLog(id: string): FuelLog | undefined {
  return getDb().select().from(fuelLogs).where(aliveById(fuelLogs, id)).get();
}

export function listFuelLogsOnDate(userId: string, date: BusinessDate): FuelLog[] {
  return getDb().select().from(fuelLogs)
    .where(and(alive(fuelLogs, userId), eq(fuelLogs.businessDate, date)))
    .orderBy(desc(fuelLogs.occurredAt))
    .all();
}

export function listFuelLogsInRange(
  userId: string, from: BusinessDate, to: BusinessDate,
): FuelLog[] {
  return getDb().select().from(fuelLogs)
    .where(and(
      alive(fuelLogs, userId),
      gte(fuelLogs.businessDate, from),
      lte(fuelLogs.businessDate, to),
    ))
    .orderBy(desc(fuelLogs.occurredAt))
    .all();
}

/** Aracın dolumları, yeniden eskiye. Tüketim hesabının girdisi. */
export function listFuelLogsForVehicle(vehicleId: string): FuelLog[] {
  return getDb().select().from(fuelLogs)
    .where(eq(fuelLogs.vehicleId, vehicleId))
    .orderBy(desc(fuelLogs.occurredAt))
    .all()
    .filter((r) => r.deletedAt == null);
}

/**
 * Aracın yakıt tipi satırına son bilinen birim fiyatı yazar.
 *
 * Satır yoksa hiçbir şey yapmaz: araç o yakıtı kullanmıyor olarak
 * tanımlanmış demektir ve dolum kaydı yine de duruyor — sürücünün
 * girdiği veriyi reddetmiyoruz, sadece tahmine katmıyoruz.
 */
function rememberUnitPrice(
  vehicleId: string, fuelType: FuelType, unitPriceKurus: Kurus, now: UnixMs,
): void {
  const row = getDb().select({ id: vehicleFuelTypes.id })
    .from(vehicleFuelTypes)
    .where(and(
      eq(vehicleFuelTypes.vehicleId, vehicleId),
      eq(vehicleFuelTypes.fuelType, fuelType),
    ))
    .get();
  if (!row) return;

  withOutbox('vehicle_fuel_types', row.id, 'upsert', (tx) => {
    tx.update(vehicleFuelTypes)
      .set({ lastUnitPriceKurus: unitPriceKurus, updatedAt: now })
      .where(eq(vehicleFuelTypes.id, row.id)).run();
  }, now);
}

/**
 * Sürücünün vardiya sonunda yazdığı tüketimi ve fiyatı ARACA hatırlatır.
 *
 * Amaç yalnızca ÖNCEDEN DOLDURMAK: bir dahaki vardiya sonunda alanlar dolu
 * gelsin, sürücü çoğu gün onaylayıp geçsin. Hesap bu değerden değil,
 * vardiyaya kopyalanan değerden yapılıyor — geçmiş günler bugün girilen
 * yeni bir tüketimle kaymasın.
 *
 * `isConsumptionMeasured` FALSE kalıyor: bu değer ölçülmedi, sürücü
 * beyan etti. Arayüz ikisini aynı şekilde göstermemeli.
 */
export function rememberStatedFuelFigures(
  vehicleId: string,
  consumptionPer100Km: number | null | undefined,
  unitPriceKurus: Kurus | null | undefined,
  now: UnixMs = Date.now(),
): void {
  const hasConsumption = consumptionPer100Km != null
    && Number.isFinite(consumptionPer100Km) && consumptionPer100Km > 0;
  const hasPrice = unitPriceKurus != null
    && Number.isFinite(unitPriceKurus) && unitPriceKurus > 0;
  if (!hasConsumption && !hasPrice) return;

  /**
   * Birincil yakıt tipine yazılıyor. Çift yakıtlı araçta sürücü hangi
   * yakıtla gittiğini söylemiyor; birincil olan en sık kullandığıdır ve
   * ön dolgu için yeterli. Hesap zaten vardiyadaki kopyadan yapılıyor.
   */
  const row = getDb().select({ id: vehicleFuelTypes.id })
    .from(vehicleFuelTypes)
    .where(eq(vehicleFuelTypes.vehicleId, vehicleId))
    .orderBy(desc(vehicleFuelTypes.isPrimary))
    .get();
  if (!row) return;

  withOutbox('vehicle_fuel_types', row.id, 'upsert', (tx) => {
    tx.update(vehicleFuelTypes).set({
      ...(hasConsumption
        ? {
            avgConsumptionPer100Km: Math.round(consumptionPer100Km),
            isConsumptionMeasured: false,
          }
        : {}),
      ...(hasPrice ? { lastUnitPriceKurus: unitPriceKurus } : {}),
      updatedAt: now,
    }).where(eq(vehicleFuelTypes.id, row.id)).run();
  }, now);
}

/** Vardiya sonu sihirbazının ön dolgusu: son bilinen tüketim ve fiyat. */
export function getKnownFuelFigures(vehicleId: string): {
  consumptionPer100Km: number | null;
  unitPriceKurus: Kurus | null;
  isMeasured: boolean;
} {
  const row = getDb().select().from(vehicleFuelTypes)
    .where(eq(vehicleFuelTypes.vehicleId, vehicleId))
    .orderBy(desc(vehicleFuelTypes.isPrimary))
    .get();

  return {
    consumptionPer100Km: row?.avgConsumptionPer100Km ?? null,
    unitPriceKurus: row?.lastUnitPriceKurus ?? null,
    isMeasured: row?.isConsumptionMeasured ?? false,
  };
}
