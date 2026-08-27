/**
 * Çekme — buluttan değişen kayıtları indirir.
 *
 * ARTIMLIDIR: her tur yalnızca `server_updated_at > imleç` olan satırları
 * ister. İmleç sunucudan gelen damgadır, cihaz saati değil — cihaz saati
 * ileri alınmış olsaydı aradaki tüm kayıtlar hiç indirilmezdi.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getDb } from '@/db/client';
import { SYNC_TABLES, toLocalRow } from './tables';
import { type TableProgress, nextCursor } from './cursor';
import { getPullCursor, setPullCursor } from './state';

/** Tek istekte indirilecek en fazla satır. */
const PAGE_SIZE = 500;

export interface PullResult {
  applied: number;
  /** Yerelde daha yeni sürüm olduğu için atlanan satır sayısı. */
  skippedStale: number;
  cursor: string;
  errors: string[];
}

export async function pullChanges(
  supabase: SupabaseClient, userId: string,
): Promise<PullResult> {
  const startCursor = getPullCursor();
  const result: PullResult = {
    applied: 0, skippedStale: 0, cursor: startCursor, errors: [],
  };

  const progress: TableProgress[] = [];

  for (const table of SYNC_TABLES) {
    try {
      /**
       * `user_id` süzgeci RLS'in üstüne EK bir güvence. RLS zaten
       * başkasının satırını vermiyor; ama aynı cihazda birden fazla
       * hesap kullanılmışsa yerel veritabanında başka kullanıcının
       * satırları duruyor olabilir ve onların üzerine yazmamalıyız.
       */
      const { data, error } = await supabase
        .from(table)
        .select('*')
        .eq('user_id', userId)
        .gt('server_updated_at', startCursor)
        .order('server_updated_at', { ascending: true })
        .limit(PAGE_SIZE);

      if (error) throw new Error(error.message);
      if (!data || data.length === 0) continue;

      const outcome = applyRows(table, data as Record<string, unknown>[]);
      result.applied += outcome.applied;
      result.skippedStale += outcome.skippedStale;

      const last = (data[data.length - 1] as { server_updated_at?: string })
        .server_updated_at;
      if (!last) continue;

      progress.push({ lastSeen: last, truncated: data.length >= PAGE_SIZE });
    } catch (error) {
      result.errors.push(`${table}: ${describe(error)}`);
    }
  }

  const next = nextCursor(startCursor, progress, result.errors.length > 0);
  if (next !== startCursor) {
    setPullCursor(next);
    result.cursor = next;
  }

  return result;
}

interface ApplyOutcome { applied: number; skippedStale: number }

/**
 * Gelen satırları yerele yazar.
 *
 * ÇAKIŞMA KURALI: yerel `updated_at` gelenden BÜYÜKSE yazma atlanır.
 * Gönderim çekmeden önce çalıştığı için normalde bu olmaz; ama gönderim
 * başarısız olduysa cihazda henüz iletilmemiş daha yeni bir düzeltme
 * duruyor olabilir ve onu ezmek sürücünün yazdığını yok etmek olurdu.
 *
 * Yazma `outbox`'a DÜŞMEZ: bu satır buluttan geldi, geri göndermek
 * sonsuz bir gidiş-geliş üretirdi.
 */
function applyRows(table: string, rows: Record<string, unknown>[]): ApplyOutcome {
  const db = getDb();
  let applied = 0;
  let skippedStale = 0;

  db.transaction(() => {
    for (const remote of rows) {
      const local = db.$client.getFirstSync<{ updated_at: number }>(
        `SELECT updated_at FROM "${table}" WHERE id = ?`, [String(remote.id)],
      );

      if (local && local.updated_at > Number(remote.updated_at)) {
        skippedStale += 1;
        continue;
      }

      const row = toLocalRow(table, remote);
      const columns = Object.keys(row);
      const placeholders = columns.map(() => '?').join(',');
      const assignments = columns
        .filter((c) => c !== 'id')
        .map((c) => `"${c}" = excluded."${c}"`)
        .join(', ');

      db.$client.runSync(
        `INSERT INTO "${table}" (${columns.map((c) => `"${c}"`).join(',')})
         VALUES (${placeholders})
         ON CONFLICT(id) DO UPDATE SET ${assignments}`,
        columns.map((c) => row[c] as never),
      );
      applied += 1;
    }
  });

  return { applied, skippedStale };
}

function describe(error: unknown): string {
  return error instanceof Error ? error.message : String(error);
}
