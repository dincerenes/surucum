/**
 * Araç ve araç yakıt tipleri.
 *
 * Sahiplik biçimi burada İKİ İŞ birden yapıyor: hem sabit gider yapısını
 * belirliyor (kiralık plakada aylık bedel var, kendi aracında yok) hem de
 * kilometre yıpranma payını atıyor. Bu yüzden sihirbazda tek soru,
 * modelde iki sonuç.
 */

import { and, asc, eq } from 'drizzle-orm';
import { getDb } from '../client';
import {
  type FuelType, type OwnershipType, defaultWearPerKm,
} from '../schema/_shared';
import { vehicleFuelTypes, vehicles } from '../schema';
import type { Vehicle, VehicleFuelType } from '../schema/vehicles';
import {
  type Tx, type UnixMs, alive, enqueue, ownedById, softDeleteRow, stampNew, updateOwned,
} from './_base';
import { newId } from '@/lib/id';
import { toWholePositive } from '@/lib/whole-number';

export interface NewVehicleInput {
  label: string;
  ownership: OwnershipType;
  /** İlk sıradaki yakıt birincil kabul edilir. */
  fuelTypes: readonly FuelType[];
  plate?: string | null;
  make?: string | null;
  model?: string | null;
  modelYear?: number | null;
  initialOdometerKm?: number | null;
  notes?: string | null;
}

/**
 * Araç oluşturur ve yakıt tiplerini aynı işlemde yazar.
 *
 * Yıpranma payı sahiplik biçiminden ATANIR, kullanıcıya sorulmaz.
 * Kiralık araçta ve işveren aracında sıfırdır — aracın değer kaybı
 * sürücünün cebinden çıkmıyor, o maliyet zaten kira bedeli olarak
 * sayılıyor. Sıfırlanmazsa aynı maliyet iki kez düşülür.
 */
export function createVehicle(
  userId: string, input: NewVehicleInput, now: UnixMs = Date.now(),
): Vehicle {
  const stamp = stampNew(userId, now);

  return getDb().transaction((tx) => {
    const row = tx.insert(vehicles).values({
      ...stamp,
      label: input.label.trim(),
      plate: normalize(input.plate),
      make: normalize(input.make),
      model: normalize(input.model),
      // Yıl ve kilometre bulutta integer — ondalık gelirse burada yuvarlanır.
      modelYear: toWholePositive(input.modelYear),
      ownership: input.ownership,
      initialOdometerKm: toWholePositive(input.initialOdometerKm),
      wearPerKmKurus: defaultWearPerKm(input.ownership),
      notes: normalize(input.notes),
    }).returning().get();

    enqueue(tx, 'vehicles', stamp.id, 'upsert', now);
    insertFuelTypes(tx, userId, stamp.id, input.fuelTypes, now);
    return row;
  });
}

/** Araca yakıt tipi satırlarını yazar; ilki birincil olur. */
function insertFuelTypes(
  tx: Tx, userId: string, vehicleId: string,
  fuelTypes: readonly FuelType[], now: UnixMs,
): void {
  const unique = [...new Set(fuelTypes)];
  unique.forEach((fuelType, index) => {
    const id = newId();
    tx.insert(vehicleFuelTypes).values({
      id, userId, createdAt: now, updatedAt: now, deletedAt: null,
      vehicleId, fuelType, isPrimary: index === 0,
    }).run();
    enqueue(tx, 'vehicle_fuel_types', id, 'upsert', now);
  });
}

export type VehiclePatch = Partial<Omit<NewVehicleInput, 'fuelTypes'>>;

/**
 * Aracı günceller.
 *
 * SAHİPLİK DEĞİŞİRSE YIPRANMA PAYI DA DEĞİŞİR. Bu bilinçli: sahiplik
 * alanı sürücünün aracın bugünkü durumu hakkındaki beyanıdır. Kiralık
 * aracı satın aldıysa yıpranma artık onun cebinden çıkıyor demektir ve
 * maliyet modeli buna uymak zorunda.
 *
 * (Bu, sütunun var olma sebebiyle çelişmiyor: sütun, İLERİDE VARSAYILAN
 * SABİTİ biz değiştirirsek geçmiş kayıtlar kaymasın diye duruyor.)
 */
export function updateVehicle(
  userId: string, id: string, patch: VehiclePatch, now: UnixMs = Date.now(),
): boolean {
  return updateOwned(vehicles, 'vehicles', userId, id, {
    ...(patch.label !== undefined ? { label: patch.label.trim() } : {}),
    ...(patch.plate !== undefined ? { plate: normalize(patch.plate) } : {}),
    ...(patch.make !== undefined ? { make: normalize(patch.make) } : {}),
    ...(patch.model !== undefined ? { model: normalize(patch.model) } : {}),
    ...(patch.modelYear !== undefined ? { modelYear: toWholePositive(patch.modelYear) } : {}),
    ...(patch.initialOdometerKm !== undefined
      ? { initialOdometerKm: toWholePositive(patch.initialOdometerKm) } : {}),
    ...(patch.notes !== undefined ? { notes: normalize(patch.notes) } : {}),
    ...(patch.ownership !== undefined ? {
      ownership: patch.ownership,
      wearPerKmKurus: defaultWearPerKm(patch.ownership),
    } : {}),
  }, now);
}

/**
 * Aracın yakıt tiplerini yeniden kurar.
 *
 * Çıkarılan tip YUMUŞAK SİLİNİYOR, satır tablodan kaldırılmıyor: geçmiş
 * dolum kayıtları o tipe bağlı ve sert silme senkronda kaydı diriltir.
 * Kalan tipler korunuyor — yeniden yazsaydık her düzenlemede ölçülmüş
 * tüketim ve son bilinen fiyat sıfırlanırdı.
 *
 * Araç bu hesabın değilse `false` döner ve hiçbir şey yazılmaz.
 */
export function setVehicleFuelTypes(
  userId: string, vehicleId: string, fuelTypes: readonly FuelType[],
  now: UnixMs = Date.now(),
): boolean {
  /**
   * Araç BU HESABIN olmalı. Denetlenmeden önce başka bir hesabın aracına
   * bu hesabın adıyla yakıt satırı açılabiliyordu: sahibi B, aracı A'nın
   * olan bir satır ne A'nın ne B'nin ekranında doğru görünür.
   */
  if (!getVehicle(userId, vehicleId)) return false;

  // Boş liste yok sayılır: araç yakıtsız kalamaz.
  const wanted = [...new Set(fuelTypes)];
  if (wanted.length === 0) return true;

  const current = listVehicleFuelTypes(userId, vehicleId);

  for (const row of current) {
    if (!wanted.includes(row.fuelType)) {
      softDeleteRow(vehicleFuelTypes, 'vehicle_fuel_types', userId, row.id, now);
    }
  }

  getDb().transaction((tx) => {
    wanted.forEach((fuelType, index) => {
      const existing = current.find((r) => r.fuelType === fuelType);
      const primary = index === 0;

      if (existing) {
        if (existing.isPrimary === primary) return;
        tx.update(vehicleFuelTypes)
          .set({ isPrimary: primary, updatedAt: now })
          .where(ownedById(vehicleFuelTypes, userId, existing.id)).run();
        enqueue(tx, 'vehicle_fuel_types', existing.id, 'upsert', now);
        return;
      }

      const id = newId();
      tx.insert(vehicleFuelTypes).values({
        id, userId, createdAt: now, updatedAt: now, deletedAt: null,
        vehicleId, fuelType, isPrimary: primary,
      }).run();
      enqueue(tx, 'vehicle_fuel_types', id, 'upsert', now);
    });
  });
  return true;
}

/**
 * Aracı pasifleştirir — SİLMEZ.
 *
 * Araç silinirse ona bağlı geçmiş vardiya ve yakıt kayıtları sahipsiz
 * kalır ve raporlar bozulur. Sürücü araç değiştirdiğinde eskisi
 * listeden çıkar, geçmişi durur.
 */
export function deactivateVehicle(
  userId: string, id: string, now: UnixMs = Date.now(),
): boolean {
  return updateOwned(vehicles, 'vehicles', userId, id, { isActive: false }, now);
}

export function activateVehicle(
  userId: string, id: string, now: UnixMs = Date.now(),
): boolean {
  return updateOwned(vehicles, 'vehicles', userId, id, { isActive: true }, now);
}

// ---------------------------------------------------------------------------
// Okuma
// ---------------------------------------------------------------------------

export function listVehicles(userId: string): Vehicle[] {
  return getDb().select().from(vehicles)
    .where(alive(vehicles, userId))
    .orderBy(asc(vehicles.sortOrder), asc(vehicles.createdAt))
    .all();
}

export function listActiveVehicles(userId: string): Vehicle[] {
  return listVehicles(userId).filter((v) => v.isActive);
}

/**
 * Kullanımdaki araç — TEK ÇÖZÜMLEME YOLU.
 *
 * Ayardaki varsayılan pasifleştirilmiş olabilir; o zaman listenin ilkine
 * düşülüyor. Bu kural iki yerde ayrı ayrı yazılmıştı ve ayrışmışlardı:
 * `useDriver` ilk aracı kullanıp vardiyayı ona bağlarken Araçlarım ekranı
 * ham kimliğe baktığı için hiçbir karta AKTİF rozeti basmıyordu — sürücü
 * hangi aracın kullanıldığını göremiyordu.
 */
export function resolveActiveVehicle(
  vehicles: readonly Vehicle[], defaultVehicleId: string | null | undefined,
): Vehicle | null {
  return vehicles.find((v) => v.id === defaultVehicleId) ?? vehicles[0] ?? null;
}

export function getVehicle(userId: string, id: string): Vehicle | undefined {
  return getDb().select().from(vehicles).where(ownedById(vehicles, userId, id)).get();
}

export function listVehicleFuelTypes(userId: string, vehicleId: string): VehicleFuelType[] {
  return getDb().select().from(vehicleFuelTypes)
    .where(and(alive(vehicleFuelTypes, userId), eq(vehicleFuelTypes.vehicleId, vehicleId)))
    .orderBy(asc(vehicleFuelTypes.createdAt))
    .all();
}

/** Boş ve yalnızca boşluktan oluşan metni `null`'a düşürür. */
function normalize(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}
