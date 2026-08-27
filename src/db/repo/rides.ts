/**
 * Sefer kaydı — günde kırk kez çalışan yol.
 *
 * Buradaki tek amaç HIZ: sürücü tutarı yazar, kaydeder. Komisyon oranı
 * kaynaktan okunur, tutarlar hesaplanır ve ÜÇÜ DE saklanır. Kullanıcı
 * kaynağın oranını sonradan değiştirdiğinde geçmiş seferler değişmez.
 */

import { and, asc, desc, eq, gte, lte } from 'drizzle-orm';
import { getDb } from '../client';
import { rides } from '../schema';
import type { Ride } from '../schema/earnings';
import type { PaymentMethod } from '../schema/_shared';
import { type UnixMs, alive, aliveById, softDeleteRow, stampNew, withOutbox } from './_base';
import { type BasisPoints, type Kurus } from '@/lib/money';
import { calculateRideAmounts } from '@/lib/ride';
import { type BusinessDate, DEFAULT_CUTOFF_HOUR, toBusinessDate } from '@/lib/business-date';

export interface NewRideInput {
  earningSourceId: string;
  grossAmountKurus: Kurus;

  /** Açık vardiya varsa kimliği. Vardiya dışında da sefer olabilir. */
  shiftId?: string | null;
  vehicleId?: string | null;

  /** Sürücü kesintiyi rakam olarak biliyorsa — oranı ezer. */
  commissionOverrideKurus?: Kurus;

  /** Oranı elle vermek için. Boşsa kaynağın o anki oranı okunur. */
  commissionBps?: BasisPoints;

  tipKurus?: Kurus;
  paymentMethod?: PaymentMethod;
  distanceMeters?: number | null;
  durationSeconds?: number | null;
  notes?: string | null;

  /** Geçmişe kayıt için. Boşsa şimdi. */
  occurredAt?: UnixMs;
}

/**
 * Sefer ekler.
 *
 * KOMİSYON KESİLMEZ. Sefer kaydı yalnızca sürücünün eline geçen brüt
 * tutarı taşır; komisyon vardiya sonunda tek rakam olarak giriliyor
 * (`shifts.commission_kurus`). Sefer başına oran hem girişi
 * yavaşlatıyordu hem de sürücünün doğrulayamadığı bir sayı üretiyordu.
 *
 * `commissionBps` ve `commissionOverrideKurus` alanları duruyor ve
 * varsayılanları sıfır — açıkça verilirse yine çalışırlar, kapı açık.
 */
export function addRide(
  userId: string,
  input: NewRideInput,
  cutoffHour: number = DEFAULT_CUTOFF_HOUR,
  now: UnixMs = Date.now(),
): Ride {
  const occurredAt = input.occurredAt ?? now;

  const amounts = calculateRideAmounts({
    grossAmountKurus: input.grossAmountKurus,
    commissionBps: input.commissionBps ?? (0 as BasisPoints),
    commissionOverrideKurus: input.commissionOverrideKurus,
    tipKurus: input.tipKurus,
  });

  const stamp = stampNew(userId, now);
  return withOutbox('rides', stamp.id, 'upsert', (tx) => (
    tx.insert(rides).values({
      ...stamp,
      shiftId: input.shiftId ?? null,
      earningSourceId: input.earningSourceId,
      vehicleId: input.vehicleId ?? null,
      occurredAt,
      businessDate: toBusinessDate(occurredAt, cutoffHour),
      grossAmountKurus: amounts.grossAmountKurus,
      commissionKurus: amounts.commissionKurus,
      netAmountKurus: amounts.netAmountKurus,
      commissionBps: amounts.commissionBps,
      tipKurus: amounts.tipKurus,
      paymentMethod: input.paymentMethod ?? 'app',
      distanceMeters: input.distanceMeters ?? null,
      durationSeconds: input.durationSeconds ?? null,
      notes: input.notes?.trim() || null,
    }).returning().get()
  ), now);
}

/**
 * Seferi günceller ve tutarları YENİDEN HESAPLAR.
 *
 * Oran, kaydın kendi içindeki kopyadan alınır — kaynağın bugünkü oranından
 * değil. Sürücü bir seferin tutarını düzeltiyorsa o günkü şartlar geçerli
 * olmalı; aradan geçen sürede oran değiştiyse düzeltme onu getirmemeli.
 */
export function updateRide(
  id: string, patch: Partial<NewRideInput>, now: UnixMs = Date.now(),
): void {
  const current = getRide(id);
  if (!current) return;

  const amounts = calculateRideAmounts({
    grossAmountKurus: patch.grossAmountKurus ?? current.grossAmountKurus,
    commissionBps: patch.commissionBps ?? current.commissionBps,
    commissionOverrideKurus: patch.commissionOverrideKurus,
    tipKurus: patch.tipKurus ?? current.tipKurus,
  });

  withOutbox('rides', id, 'upsert', (tx) => {
    tx.update(rides).set({
      ...(patch.earningSourceId !== undefined
        ? { earningSourceId: patch.earningSourceId } : {}),
      ...(patch.paymentMethod !== undefined
        ? { paymentMethod: patch.paymentMethod } : {}),
      ...(patch.distanceMeters !== undefined
        ? { distanceMeters: patch.distanceMeters } : {}),
      ...(patch.durationSeconds !== undefined
        ? { durationSeconds: patch.durationSeconds } : {}),
      ...(patch.notes !== undefined ? { notes: patch.notes?.trim() || null } : {}),
      grossAmountKurus: amounts.grossAmountKurus,
      commissionKurus: amounts.commissionKurus,
      netAmountKurus: amounts.netAmountKurus,
      commissionBps: amounts.commissionBps,
      tipKurus: amounts.tipKurus,
      updatedAt: now,
    }).where(eq(rides.id, id)).run();
  }, now);
}

export function deleteRide(id: string, now: UnixMs = Date.now()): void {
  softDeleteRow(rides, 'rides', id, now);
}

// ---------------------------------------------------------------------------
// Okuma
// ---------------------------------------------------------------------------

export function getRide(id: string): Ride | undefined {
  return getDb().select().from(rides).where(aliveById(rides, id)).get();
}

/** Bir iş gününün seferleri — en yeni üstte. */
export function listRidesOnDate(userId: string, date: BusinessDate): Ride[] {
  return getDb().select().from(rides)
    .where(and(alive(rides, userId), eq(rides.businessDate, date)))
    .orderBy(desc(rides.occurredAt))
    .all();
}

/** Bir vardiyanın seferleri — eskiden yeniye, girildiği sırayla. */
export function listRidesInShift(shiftId: string): Ride[] {
  return getDb().select().from(rides)
    .where(eq(rides.shiftId, shiftId))
    .orderBy(asc(rides.occurredAt))
    .all()
    .filter((r) => r.deletedAt == null);
}

export function listRidesInRange(
  userId: string, from: BusinessDate, to: BusinessDate,
): Ride[] {
  return getDb().select().from(rides)
    .where(and(
      alive(rides, userId),
      gte(rides.businessDate, from),
      lte(rides.businessDate, to),
    ))
    .orderBy(desc(rides.occurredAt))
    .all();
}
