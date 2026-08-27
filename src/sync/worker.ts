/**
 * Senkron işçisi.
 *
 * ARAYÜZ BUNU BEKLEMEZ. Yazma yerel SQLite'a düşer, ekran anında
 * güncellenir; bu modül arka planda çalışır. Senkron hiç çalışmasa da
 * uygulama eksiksiz işler — bulut yedek ve cihaz değiştirme içindir,
 * çalışmanın önkoşulu değil.
 */

import type { SupabaseClient } from '@supabase/supabase-js';
import { getSupabase, isCloudConfigured } from '@/lib/supabase';
import { type PullResult, pullChanges } from './pull';
import { type PushResult, clearTransientBackoff, pendingCount, pushOutbox } from './push';
import { markError, markSuccess } from './state';

export type SyncSkipReason =
  | 'cloud_not_configured'
  | 'not_signed_in'
  | 'already_running';

export interface SyncOutcome {
  ran: boolean;
  skipped?: SyncSkipReason;
  push?: PushResult;
  pull?: PullResult;
  errors: string[];
  pending: number;
}

/**
 * Aynı anda iki tur çalışmasını engeller.
 *
 * Uygulama öne geldiğinde ve zamanlayıcı tetiklendiğinde ikisi birden
 * başlayabilir; ikinci tur ilkinin sildiği kuyruk kayıtlarını okuyup
 * aynı satırları iki kez göndermeye çalışırdı.
 */
let inFlight: Promise<SyncOutcome> | null = null;

export interface RunSyncOptions {
  /**
   * Geçici hatalardan doğan beklemeleri iptal eder.
   *
   * Uygulama öne geldiğinde ve sürücü elle senkron istediğinde `true`
   * verilir: ikisi de bağlantının döndüğüne dair güçlü işaret. Otomatik
   * aralık turlarında `false` — orada beklemenin amacı zaten ağ kapalıyken
   * boşuna istek atmamak.
   */
  force?: boolean;
}

export function runSync(options: RunSyncOptions = {}): Promise<SyncOutcome> {
  if (inFlight) {
    return Promise.resolve({
      ran: false, skipped: 'already_running', errors: [], pending: pendingCount(),
    });
  }

  inFlight = execute(options).finally(() => { inFlight = null; });
  return inFlight;
}

async function execute(options: RunSyncOptions): Promise<SyncOutcome> {
  if (!isCloudConfigured()) {
    return {
      ran: false, skipped: 'cloud_not_configured', errors: [],
      pending: pendingCount(),
    };
  }

  const supabase = getSupabase();
  if (!supabase) {
    return {
      ran: false, skipped: 'cloud_not_configured', errors: [],
      pending: pendingCount(),
    };
  }

  const userId = await currentUserId(supabase);
  if (!userId) {
    return {
      ran: false, skipped: 'not_signed_in', errors: [], pending: pendingCount(),
    };
  }

  if (options.force) clearTransientBackoff();

  /**
   * ÖNCE GÖNDER, SONRA ÇEK.
   *
   * Ters sırada, buluttan gelen eski bir sürüm cihazdaki gönderilmemiş
   * düzeltmenin üzerine yazabilirdi. Gönderim önce çalışınca yerel
   * değişiklikler sunucuya ulaşmış olur ve dönen kayıt zaten en günceli
   * taşır.
   */
  const push = await pushOutbox(supabase, userId);
  const pull = await pullChanges(supabase, userId);

  const errors = [...push.errors, ...pull.errors];
  if (errors.length === 0) markSuccess();
  else markError(errors.join(' · '));

  return { ran: true, push, pull, errors, pending: pendingCount() };
}

async function currentUserId(supabase: SupabaseClient): Promise<string | null> {
  const { data, error } = await supabase.auth.getSession();
  if (error) return null;
  return data.session?.user.id ?? null;
}

export { pendingCount };
export { getSyncStatus, resetPullCursor } from './state';
