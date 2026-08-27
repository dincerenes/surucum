/**
 * Kazanç kaynakları — sürücünün parayı nereden kazandığı.
 *
 * BU LİSTE UYGULAMA TARAFINDAN DOLDURULMAZ. Kullanıcı kendi kaynaklarını
 * kendi adlandırır; uygulama hiçbir yerde üçüncü taraf marka adı taşımaz,
 * tohum veride bile taşımaz.
 */

import { asc, eq } from 'drizzle-orm';
import { getDb } from '../client';
import { earningSources } from '../schema';
import type { EarningSource } from '../schema/earnings';
import { type UnixMs, alive, aliveById, softDeleteRow, stampNew, withOutbox } from './_base';
import { type BasisPoints, clampBps } from '@/lib/money';

export interface NewEarningSourceInput {
  name: string;
  /** Komisyon oranı, baz puan: 2500 = %25,00. */
  defaultCommissionBps?: BasisPoints;
  colorHex?: string | null;
  sortOrder?: number;
}

export function createEarningSource(
  userId: string, input: NewEarningSourceInput, now: UnixMs = Date.now(),
): EarningSource {
  const stamp = stampNew(userId, now);
  return withOutbox('earning_sources', stamp.id, 'upsert', (tx) => (
    tx.insert(earningSources).values({
      ...stamp,
      name: input.name.trim(),
      defaultCommissionBps: clampBps(input.defaultCommissionBps ?? 0),
      colorHex: input.colorHex ?? null,
      sortOrder: input.sortOrder ?? 0,
    }).returning().get()
  ), now);
}

export type EarningSourcePatch = Partial<NewEarningSourceInput> & {
  isActive?: boolean;
};

/**
 * Kaynağı günceller.
 *
 * ORAN DEĞİŞİKLİĞİ GEÇMİŞE İŞLEMEZ. Her sefer kaydı, oluşturulduğu andaki
 * oranın kopyasını ve hesaplanmış tutarları kendi içinde taşıyor; buradaki
 * değişiklik yalnızca bundan sonraki seferleri etkiler.
 */
export function updateEarningSource(
  id: string, patch: EarningSourcePatch, now: UnixMs = Date.now(),
): void {
  withOutbox('earning_sources', id, 'upsert', (tx) => {
    tx.update(earningSources).set({
      ...(patch.name !== undefined ? { name: patch.name.trim() } : {}),
      ...(patch.defaultCommissionBps !== undefined
        ? { defaultCommissionBps: clampBps(patch.defaultCommissionBps) } : {}),
      ...(patch.colorHex !== undefined ? { colorHex: patch.colorHex } : {}),
      ...(patch.sortOrder !== undefined ? { sortOrder: patch.sortOrder } : {}),
      ...(patch.isActive !== undefined ? { isActive: patch.isActive } : {}),
      updatedAt: now,
    }).where(eq(earningSources.id, id)).run();
  }, now);
}

export function deleteEarningSource(id: string, now: UnixMs = Date.now()): void {
  softDeleteRow(earningSources, 'earning_sources', id, now);
}

export function listEarningSources(userId: string): EarningSource[] {
  return getDb().select().from(earningSources)
    .where(alive(earningSources, userId))
    .orderBy(asc(earningSources.sortOrder), asc(earningSources.createdAt))
    .all();
}

export function listActiveEarningSources(userId: string): EarningSource[] {
  return listEarningSources(userId).filter((s) => s.isActive);
}

export function getEarningSource(id: string): EarningSource | undefined {
  return getDb().select().from(earningSources)
    .where(aliveById(earningSources, id)).get();
}
