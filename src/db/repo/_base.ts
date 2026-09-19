/**
 * Yazma katmanının ortak parçaları.
 *
 * BURADAKİ TEK KURAL: senkronlanan bir tabloya yapılan her yazma, AYNI
 * İŞLEM İÇİNDE `outbox`'a da düşer. Yazma başarılı olup kuyruğa girmezse
 * kayıt buluta hiç gitmez ve bunu kimse fark etmez — bu yüzden ikisi
 * ayrılamaz, `withOutbox` dışında ham insert/update yazılmaz.
 *
 * Fonksiyonlar SENKRONDUR. `expo-sqlite` sürücüsü senkron çalışıyor ve
 * arayüzün ağ değil, veritabanı bile beklememesi gerekiyor: sürücü
 * tutarı yazar, ekran o an güncellenir.
 */

import { and, eq, isNull, sql } from 'drizzle-orm';
import { getDb } from '../client';
import { newId } from '@/lib/id';

/** Milisaniye cinsinden unix damgası. */
export type UnixMs = number;

export type OutboxOperation = 'upsert' | 'delete';

/** İşlem içindeki veritabanı tutamacı. */
export type Tx = Parameters<Parameters<ReturnType<typeof getDb>['transaction']>[0]>[0];

/**
 * Buluta senkronlanan tablolar.
 *
 * `outbox` ve `sync_state` yereldir. `fuel_prices` TEK YÖNLÜDÜR —
 * sunucudan iner, cihazdan çıkmaz; kullanıcıya ait veri değil, ortak
 * referans veridir.
 */
export const SYNCED_TABLES = [
  'vehicles', 'vehicle_fuel_types', 'earning_sources', 'shifts', 'rides',
  'expense_categories', 'expenses', 'recurring_expenses', 'fuel_logs',
  'app_settings', 'goals',
] as const;

export type SyncedTableName = (typeof SYNCED_TABLES)[number];

/** Senkron sütunlarının yeni kayıt için doldurulmuş hâli. */
export interface NewRowStamp {
  id: string;
  userId: string;
  createdAt: UnixMs;
  updatedAt: UnixMs;
  deletedAt: null;
}

/**
 * Yeni kaydın kimlik ve zaman damgaları.
 *
 * Kimlik CİHAZDA üretilir — kayıt çevrimdışıyken de kalıcı kimliğine
 * sahip olur ve ilişkiler ağ beklemeden kurulabilir.
 */
export function stampNew(userId: string, now: UnixMs = Date.now()): NewRowStamp {
  return { id: newId(), userId, createdAt: now, updatedAt: now, deletedAt: null };
}

/**
 * Yazma işlemini ve kuyruğa eklemeyi TEK İŞLEMDE çalıştırır.
 *
 * `write`'ın döndürdüğü değer aynen geri döner — böylece çağıran,
 * ürettiği kaydı beklemeden kullanabilir.
 */
export function withOutbox<T>(
  tableName: SyncedTableName,
  rowId: string,
  operation: OutboxOperation,
  write: (tx: Tx) => T,
  now: UnixMs = Date.now(),
): T {
  return getDb().transaction((tx) => {
    const result = write(tx);
    enqueue(tx, tableName, rowId, operation, now);
    return result;
  });
}

/**
 * Kuyruğa ekler.
 *
 * Satırın kendisi değil YALNIZCA KİMLİĞİ tutulur: sürücü aynı seferi beş
 * kez düzeltirse kuyrukta yine tek satır olur ve gönderim anında kaydın
 * son hâli okunur.
 *
 * Çakışmada `operation` GÜNCELLENİR — silme, bekleyen bir güncellemeyi
 * ezmeli; yoksa silinen kayıt buluta güncelleme olarak gider ve dirilir.
 * Deneme sayacı da sıfırlanır: kayıt değişti, eski hata artık geçersiz.
 * `revision` BİR ARTAR: gönderim o sırada eski hâli taşıyan bir isteği
 * bekliyorsa, onayı bu kaydı silemesin (bkz. `outbox.revision`).
 *
 * Sahip (`user_id`) satırın kendisinden, AYNI İŞLEMDE okunur. Satır yoksa
 * — var olmayan bir kimlik güncellendi ya da silindi — kuyruğa HİÇBİR
 * ŞEY yazılmaz: gönderilecek bir şey yok. Eskiden böyle bir girdi
 * kuyruğa düşüyor, gönderim de yerelde satır bulamayınca kaydı buluttan
 * sert siliyordu.
 */
export function enqueue(
  tx: Pick<Tx, 'run'>,
  tableName: SyncedTableName,
  rowId: string,
  operation: OutboxOperation,
  now: UnixMs = Date.now(),
): void {
  tx.run(sql`
    INSERT INTO outbox
      (table_name, row_id, user_id, operation, revision, attempt_count, created_at)
    SELECT ${tableName}, id, user_id, ${operation}, 1, 0, ${now}
    FROM ${sql.identifier(tableName)} WHERE id = ${rowId}
    ON CONFLICT (table_name, row_id) DO UPDATE SET
      operation = excluded.operation,
      user_id = excluded.user_id,
      revision = outbox.revision + 1,
      attempt_count = 0,
      last_error = NULL,
      next_attempt_at = NULL
  `);
}

/**
 * Silinmemiş kayıt koşulu — her okuma sorgusu bunu taşımak zorunda.
 *
 * Yumuşak silinen satırlar tabloda durmaya devam ediyor; koşulu unutan
 * sorgu silinmiş kaydı geri getirir.
 */
export function alive<T extends { userId: any; deletedAt: any }>(
  table: T, userId: string,
) {
  return and(eq(table.userId, userId), isNull(table.deletedAt));
}

/** Tek kaydın silinmemiş hâli için koşul. */
export function aliveById<T extends { id: any; deletedAt: any }>(
  table: T, id: string,
) {
  return and(eq(table.id, id), isNull(table.deletedAt));
}

/**
 * Yumuşak silme — `deleted_at` damgalanır, satır tabloda durur.
 *
 * SERT SİLME YAPILMAZ. Cihaz A satırı gerçekten silerse, cihaz B kaydın
 * eski hâlini geri gönderir ve silinen kayıt dirilir.
 *
 * Tablo tipi burada genelleştirilemiyor: Drizzle'ın `update().set()`
 * imzası tabloya özgü. Tek yerde, açıkça daraltıyoruz — çağıranların
 * tamamı `schema` içindeki gerçek tablo nesnelerini veriyor.
 */
export function softDeleteRow<T extends { id: any; deletedAt: any }>(
  table: T,
  tableName: SyncedTableName,
  id: string,
  now: UnixMs = Date.now(),
): void {
  withOutbox(tableName, id, 'delete', (tx) => {
    (tx.update(table as any) as any)
      .set({ deletedAt: now, updatedAt: now })
      .where(eq(table.id, id))
      .run();
  }, now);
}
