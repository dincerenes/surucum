/**
 * Gönderim — `outbox` kuyruğunu buluta boşaltır.
 *
 * Kuyrukta satırın kendisi değil KİMLİĞİ duruyor; gönderim anında kaydın
 * son hâli okunuyor. Sürücü aynı seferi beş kez düzelttiyse buluta tek
 * gönderim gider ve giden şey son hâlidir.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { asc, eq, inArray, isNull, lte, or } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { outbox } from '@/db/schema';
import { SYNC_TABLES, isSyncTable, toCloudRow } from './tables';

/** Tek turda gönderilecek en fazla kuyruk kaydı. */
const BATCH_SIZE = 400;

/** Geri çekilme tavanı — bir saatten uzun beklenmez. */
const MAX_BACKOFF_MS = 60 * 60 * 1000;
const BASE_BACKOFF_MS = 5_000;

export interface PushResult {
  sent: number;
  /** Kalıcı olarak gönderilemeyen — yeniden denenecek. */
  failed: number;
  /** Bu turda hiç denenmeyen (başka kullanıcıya ait ya da sıra gelmemiş). */
  skipped: number;
  errors: string[];
}

export async function pushOutbox(
  supabase: SupabaseClient, userId: string, now: number = Date.now(),
): Promise<PushResult> {
  const result: PushResult = { sent: 0, failed: 0, skipped: 0, errors: [] };

  const pending = getDb().select().from(outbox)
    .where(or(isNull(outbox.nextAttemptAt), lte(outbox.nextAttemptAt, now)))
    .orderBy(asc(outbox.id))
    .limit(BATCH_SIZE)
    .all();

  if (pending.length === 0) return result;

  // Tabloya göre grupla — gönderim sırası SYNC_TABLES'a göre.
  const byTable = new Map<string, typeof pending>();
  for (const entry of pending) {
    if (!isSyncTable(entry.tableName)) {
      // Tanınmayan tablo: kuyrukta kalmasının anlamı yok, hiç gitmeyecek.
      dropQueueEntries([entry.id]);
      result.skipped += 1;
      continue;
    }
    const list = byTable.get(entry.tableName) ?? [];
    list.push(entry);
    byTable.set(entry.tableName, list);
  }

  for (const table of SYNC_TABLES) {
    const entries = byTable.get(table);
    if (!entries || entries.length === 0) continue;

    try {
      const outcome = await pushTable(supabase, table, entries, userId);
      result.sent += outcome.sent;
      result.skipped += outcome.skipped;
    } catch (error) {
      const message = describe(error);
      result.failed += entries.length;
      result.errors.push(`${table}: ${message}`);
      backoff(entries, message, now);
    }
  }

  return result;
}

interface TableOutcome { sent: number; skipped: number }

async function pushTable(
  supabase: SupabaseClient,
  table: string,
  entries: readonly { id: number; rowId: string }[],
  userId: string,
): Promise<TableOutcome> {
  const ids = entries.map((e) => e.rowId);
  const localRows = readLocalRows(table, ids);
  const byId = new Map(localRows.map((r) => [String(r.id), r]));

  const upserts: Record<string, unknown>[] = [];
  const doneQueueIds: number[] = [];
  const hardDeleteIds: string[] = [];
  let skipped = 0;

  for (const entry of entries) {
    const row = byId.get(entry.rowId);

    if (!row) {
      /**
       * Yerelde satır yok. Yumuşak silme satırı yerinde bıraktığına göre
       * bu, kaydın gerçekten yok edildiği anlamına gelir — buluttan da
       * silinmeli. (Şu an yalnızca sınama temizliği böyle davranıyor.)
       */
      hardDeleteIds.push(entry.rowId);
      doneQueueIds.push(entry.id);
      continue;
    }

    /**
     * BAŞKA KULLANICININ SATIRI — dokunulmaz, kuyrukta bekler.
     *
     * Aynı cihazda A çıkıp B girdiğinde A'nın gönderilmemiş kayıtları
     * SQLite'ta duruyor olur. B'nin oturumuyla gönderilemezler (RLS
     * reddeder) ama silinmemeleri de gerekir: A tekrar giriş yaptığında
     * verisi hâlâ gitmeli.
     */
    if (row.user_id !== userId) {
      skipped += 1;
      continue;
    }

    /**
     * Yumuşak silinen satır da UPSERT ile gider — `deleted_at` damgalı
     * hâliyle. Sert silme senkronda kaydı diriltir: bu cihaz satırı
     * yok eder, diğer cihaz eski hâlini geri gönderir.
     */
    upserts.push(toCloudRow(table, row));
    doneQueueIds.push(entry.id);
  }

  if (upserts.length > 0) {
    const { error } = await supabase.from(table).upsert(upserts, {
      onConflict: 'id', defaultToNull: false,
    });
    if (error) throw new Error(error.message);
  }

  if (hardDeleteIds.length > 0) {
    const { error } = await supabase.from(table).delete().in('id', hardDeleteIds);
    if (error) throw new Error(error.message);
  }

  if (doneQueueIds.length > 0) dropQueueEntries(doneQueueIds);
  return { sent: upserts.length + hardDeleteIds.length, skipped };
}

/**
 * Yerel satırları HAM okur — `SELECT *`.
 *
 * Drizzle üzerinden okunsaydı anahtarlar camelCase gelirdi ve buluta
 * göndermek için geri çevirmek gerekirdi. Ham okumada anahtarlar zaten
 * SQLite sütun adları, yani buluttakiyle birebir aynı.
 */
function readLocalRows(table: string, ids: string[]): Record<string, any>[] {
  if (ids.length === 0) return [];
  const placeholders = ids.map(() => '?').join(',');
  return getDb().$client.getAllSync<Record<string, any>>(
    `SELECT * FROM "${table}" WHERE id IN (${placeholders})`, ids,
  );
}

function dropQueueEntries(ids: number[]): void {
  getDb().delete(outbox).where(inArray(outbox.id, ids)).run();
}

/**
 * Başarısız kayıtları üstel geri çekilmeyle erteler.
 *
 * Ertelenmezse kuyruk her turda aynı hatayı tekrarlar ve ağ kapalıyken
 * pil tüketir. Tavan bir saat: sürücü tünelden çıkınca uzun süre
 * beklemesin.
 */
function backoff(
  entries: readonly { id: number; attemptCount: number }[],
  message: string,
  now: number,
): void {
  const detail = message.slice(0, 500);

  /**
   * Bekleme süresi HER KAYDIN KENDİ deneme sayısından hesaplanıyor.
   * Toplu tek bir güncelleme yazmak, kuyruğa yeni girmiş bir kaydı
   * yıllardır başarısız olan bir kaydın gecikmesiyle cezalandırırdı.
   */
  const db = getDb();
  db.transaction((tx) => {
    for (const entry of entries) {
      const delay = Math.min(
        MAX_BACKOFF_MS, BASE_BACKOFF_MS * 2 ** entry.attemptCount,
      );
      tx.update(outbox).set({
        attemptCount: entry.attemptCount + 1,
        lastError: detail,
        lastAttemptAt: now,
        nextAttemptAt: now + delay,
      }).where(eq(outbox.id, entry.id)).run();
    }
  });
}

function describe(error: unknown): string {
  if (error instanceof Error) return error.message;
  return String(error);
}

/** Kuyrukta bekleyen kayıt sayısı — arayüzde "senkronlanmadı" rozeti için. */
export function pendingCount(): number {
  return getDb().select().from(outbox).all().length;
}
