/**
 * Sefer kaydı — günde kırk kez çalışan yol.
 *
 * Buradaki tek amaç HIZ: sürücü tutarı yazar, kaydeder. Komisyon oranı
 * kaynaktan okunur, tutarlar hesaplanır ve ÜÇÜ DE saklanır. Kullanıcı
 * kaynağın oranını sonradan değiştirdiğinde geçmiş seferler değişmez.
 */

import { and, asc, desc, eq, gte, lte } from 'drizzle-orm';
import { getDb } from '../client';
import { rides, shifts } from '../schema';
import type { Ride } from '../schema/earnings';
import type { PaymentMethod } from '../schema/_shared';
import { type UnixMs, alive, aliveById, softDeleteRow, stampNew, withOutbox } from './_base';
import { ensureDefaultEarningSource } from './earning-sources';
import { getCutoffHour } from './settings';
import { type BasisPoints, type Kurus } from '@/lib/money';
import { calculateRideAmounts } from '@/lib/ride';
import { type BusinessDate, toBusinessDate } from '@/lib/business-date';

export interface NewRideInput {
  grossAmountKurus: Kurus;

  /**
   * Kazanç kaynağı. v1'de sürücüye sorulmuyor; verilmezse tek olan
   * kaynak kullanılıyor (yoksa açılıyor).
   */
  earningSourceId?: string;

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
  cutoffHour?: number,
  now: UnixMs = Date.now(),
): Ride {
  const occurredAt = input.occurredAt ?? now;
  /**
   * Kesme saati AYARDAN okunuyor, sabitten değil.
   *
   * Varsayılan parametre bırakıldığında her çağıranın ayarı elle
   * geçirmesi gerekiyordu ve hiçbiri geçirmiyordu: okuma yolu sürücünün
   * 06:00'sını kullanırken yazma yolu 04:00 varsayıyor, 05:00'te girilen
   * sefer bir güne yazılıp başka bir günün defterinde aranıyordu.
   */
  const cutoff = cutoffHour ?? getCutoffHour(userId);
  const earningSourceId = input.earningSourceId
    ?? ensureDefaultEarningSource(userId, now).id;

  /**
   * SEFER, VARDİYASININ İŞ GÜNÜNE YAZILIR — kendi saatinden türetilmez.
   *
   * Gece 22:00'de açılan vardiya sabah 06:00'da kapanıyor. Saat başına
   * gün hesaplansaydı aynı kesintisiz vardiya iki güne bölünürdü:
   * gece yarısından önceki seferler bir güne, sonrakiler diğerine.
   * Sürücü tek bir iş yaptı, tek bir günde görmeli.
   *
   * Vardiya dışında girilen sefer kendi saatinden gün alır.
   */
  const businessDate = resolveBusinessDate(input.shiftId, occurredAt, cutoff);

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
      earningSourceId,
      vehicleId: input.vehicleId ?? null,
      occurredAt,
      businessDate,
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

/** Vardiyaya bağlı kayıtlar vardiyanın gününü alır. */
function resolveBusinessDate(
  shiftId: string | null | undefined, occurredAt: UnixMs, cutoffHour: number,
): BusinessDate {
  if (shiftId) {
    const shift = getDb().select({ businessDate: shifts.businessDate })
      .from(shifts).where(eq(shifts.id, shiftId)).get();
    if (shift) return shift.businessDate;
  }
  return toBusinessDate(occurredAt, cutoffHour);
}
