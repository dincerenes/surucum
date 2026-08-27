/**
 * Senkron durumu — çekme imleci ve son sonuç.
 *
 * `sync_state` YEREL KALIR, buluta gitmez: imleç cihaza özgüdür. İki
 * cihaz aynı imleci paylaşsaydı, biri çektiğinde diğeri aynı kayıtları
 * hiç görmezdi.
 */

import { eq } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { syncState } from '@/db/schema';

/**
 * Artımlı çekmenin imleci — `server_updated_at` değeri, ISO metin olarak.
 *
 * CİHAZ SAATİNE GÜVENİLMEZ: imleç her zaman sunucudan gelen damgadır.
 * Cihaz saati ileri alınmış olsaydı, aradaki tüm kayıtlar hiç çekilmezdi.
 */
const PULL_CURSOR = 'pull_cursor';
const LAST_SUCCESS = 'last_success_at';
const LAST_ERROR = 'last_error';

export function readState(key: string): string | null {
  const row = getDb().select({ value: syncState.value })
    .from(syncState).where(eq(syncState.key, key)).get();
  return row?.value ?? null;
}

export function writeState(key: string, value: string | null): void {
  getDb().insert(syncState)
    .values({ key, value, updatedAt: Date.now() })
    .onConflictDoUpdate({
      target: syncState.key,
      set: { value, updatedAt: Date.now() },
    })
    .run();
}

/**
 * Çekme imleci.
 *
 * Hiç çekilmemişse epoch döner — ilk senkron her şeyi indirir. Bu
 * cihaz değiştirme senaryosunun ta kendisi: yeni telefonda veritabanı
 * boş ve tüm geçmişin inmesi gerekiyor.
 */
export function getPullCursor(): string {
  return readState(PULL_CURSOR) ?? '1970-01-01T00:00:00.000Z';
}

export function setPullCursor(serverUpdatedAt: string): void {
  writeState(PULL_CURSOR, serverUpdatedAt);
}

export function markSuccess(at: number = Date.now()): void {
  writeState(LAST_SUCCESS, String(at));
  writeState(LAST_ERROR, null);
}

export function markError(message: string): void {
  writeState(LAST_ERROR, message.slice(0, 500));
}

export interface SyncStatus {
  lastSuccessAt: number | null;
  lastError: string | null;
  cursor: string;
}

export function getSyncStatus(): SyncStatus {
  const raw = readState(LAST_SUCCESS);
  return {
    lastSuccessAt: raw ? Number(raw) : null,
    lastError: readState(LAST_ERROR),
    cursor: getPullCursor(),
  };
}

/**
 * Çekme imlecini sıfırlar — bir sonraki senkron her şeyi baştan indirir.
 *
 * Yerel veriyi silmez. Kayıp bir kaydın buluttan geri gelmesi gerektiğinde
 * ya da imlecin bozulduğundan şüphelenildiğinde kullanılır.
 */
export function resetPullCursor(): void {
  writeState(PULL_CURSOR, null);
}
