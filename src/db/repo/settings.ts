/**
 * Kullanıcı ayarları — tek satır, cihazlar arası senkronlanır.
 *
 * Gün kesme saati burada duruyor ve iş günü hesabının tamamı buna bağlı.
 * Gece vardiyası çalışan sürücü için hayati: 04:00'ten önceki kayıtlar
 * bir önceki iş gününe yazılır.
 */

import { asc, eq } from 'drizzle-orm';
import { getDb } from '../client';
import { appSettings } from '../schema';
import type { AppSettings } from '../schema/system';
import { type UnixMs, alive, softDeleteRow, stampNew, withOutbox } from './_base';
import { DEFAULT_CUTOFF_HOUR } from '@/lib/business-date';
import { mergeSettingsRows } from '@/lib/settings-merge';

/**
 * Ayar satırını okur, yoksa oluşturur.
 *
 * Uygulamanın her yerinde kesme saati lazım ve "ayar satırı henüz yok"
 * durumunu her çağıranın ayrıca ele alması gereksiz karmaşa olurdu.
 */
export function ensureSettings(
  userId: string, now: UnixMs = Date.now(),
): AppSettings {
  /**
   * Önce ÇOĞALMA TEMİZLENİYOR. Ayar satırı mantıken tek ama pratikte
   * çoğalabiliyor: bu fonksiyon çekme tamamlanmadan yerel satırı açıyor,
   * hemen ardından senkron buluttakini indiriyor ve kimlik cihazda
   * üretildiği için ikisi aynı satır sayılmıyor.
   */
  consolidateSettings(userId, now);

  const existing = getSettings(userId);
  if (existing) return existing;

  const stamp = stampNew(userId, now);
  return withOutbox('app_settings', stamp.id, 'upsert', (tx) => (
    tx.insert(appSettings).values({
      ...stamp, dayCutoffHour: DEFAULT_CUTOFF_HOUR,
    }).returning().get()
  ), now);
}

/**
 * Ayar satırı — SIRALAMA ŞART.
 *
 * Sıralamasız `get()` çoğalmış satırlarda rastgele birini döndürüyordu ve
 * dönen satırın `onboarding_completed_at`'i boşsa sürücü kurulumu
 * bitirmiş olmasına rağmen kurulum ekranına atılıyordu. En eski satır
 * kanoniktir ve tüm cihazlarda aynıdır.
 */
export function getSettings(userId: string): AppSettings | undefined {
  return getDb().select().from(appSettings)
    .where(alive(appSettings, userId))
    .orderBy(asc(appSettings.createdAt), asc(appSettings.id))
    .get();
}

/**
 * Çoğalmış ayar satırlarını tek satıra indirir.
 *
 * Fazlalıklar YUMUŞAK siliniyor ve kuyruğa düşüyor — bulut da yakınsasın.
 * Sert silseydik bir sonraki çekmede geri gelirlerdi.
 *
 * Hesap `src/lib/settings-merge.ts` içinde ve test ediliyor; burada
 * yalnızca okuma ve yazma var.
 */
export function consolidateSettings(userId: string, now: UnixMs = Date.now()): void {
  const rows = getDb().select().from(appSettings)
    .where(alive(appSettings, userId))
    .orderBy(asc(appSettings.createdAt), asc(appSettings.id))
    .all();

  const merge = mergeSettingsRows(rows.map((r) => ({
    id: r.id,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    dayCutoffHour: r.dayCutoffHour,
    defaultVehicleId: r.defaultVehicleId,
    defaultEarningSourceId: r.defaultEarningSourceId,
    regionCode: r.regionCode,
    onboardingCompletedAt: r.onboardingCompletedAt ?? null,
  })));
  if (!merge) return;

  if (Object.keys(merge.patch).length > 0) {
    withOutbox('app_settings', merge.survivor.id, 'upsert', (tx) => {
      tx.update(appSettings)
        .set({ ...merge.patch, updatedAt: now })
        .where(eq(appSettings.id, merge.survivor.id)).run();
    }, now);
  }

  for (const id of merge.removeIds) {
    softDeleteRow(appSettings, 'app_settings', id, now);
  }
}

/**
 * Kesme saati.
 *
 * Ayar satırı henüz yoksa varsayılana düşer — okuma yolunda yazma
 * yapmıyoruz, çünkü bu fonksiyon sorgu içinden de çağrılabiliyor.
 */
export function getCutoffHour(userId: string): number {
  return getSettings(userId)?.dayCutoffHour ?? DEFAULT_CUTOFF_HOUR;
}

export interface SettingsPatch {
  dayCutoffHour?: number;
  defaultVehicleId?: string | null;
  defaultEarningSourceId?: string | null;
  regionCode?: string;
  onboardingCompletedAt?: UnixMs | null;
}

export function updateSettings(
  userId: string, patch: SettingsPatch, now: UnixMs = Date.now(),
): void {
  const current = ensureSettings(userId, now);

  withOutbox('app_settings', current.id, 'upsert', (tx) => {
    tx.update(appSettings).set({
      ...(patch.dayCutoffHour !== undefined
        ? { dayCutoffHour: clampHour(patch.dayCutoffHour) } : {}),
      ...(patch.defaultVehicleId !== undefined
        ? { defaultVehicleId: patch.defaultVehicleId } : {}),
      ...(patch.defaultEarningSourceId !== undefined
        ? { defaultEarningSourceId: patch.defaultEarningSourceId } : {}),
      ...(patch.regionCode !== undefined ? { regionCode: patch.regionCode } : {}),
      ...(patch.onboardingCompletedAt !== undefined
        ? { onboardingCompletedAt: patch.onboardingCompletedAt } : {}),
      updatedAt: now,
    }).where(eq(appSettings.id, current.id)).run();
  }, now);
}

/** İlk kurulumun tamamlandığını damgalar. */
export function completeOnboarding(userId: string, now: UnixMs = Date.now()): void {
  updateSettings(userId, { onboardingCompletedAt: now }, now);
}

export function isOnboardingComplete(userId: string): boolean {
  return getSettings(userId)?.onboardingCompletedAt != null;
}

/**
 * Kesme saatini 0–23 aralığına sıkıştırır.
 *
 * Aralık dışı bir değer `toBusinessDate` içinde sessizce yanlış gün
 * üretir — her kayıt yanlış güne yazılır ve sürücü sebebini bulamaz.
 */
function clampHour(hour: number): number {
  if (!Number.isFinite(hour)) return DEFAULT_CUTOFF_HOUR;
  return Math.min(23, Math.max(0, Math.floor(hour)));
}
