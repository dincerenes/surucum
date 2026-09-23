/**
 * Hesap silme — cihazdaki izin temizlenmesi.
 *
 * Bulutta hesap `delete-account` fonksiyonuyla silindikten SONRA çağrılır.
 * Önce çağrılsaydı ve bulut silmesi başarısız olsaydı, sürücü verisini
 * cihazdan kaybeder ama hesabı durmaya devam ederdi.
 *
 * TEK İSTİSNA YUMUŞAK SİLME KURALINA: burada satırlar SERT siliniyor ve
 * kuyruğa hiçbir şey yazılmıyor. Kuralın sebebi başka cihazın kaydı
 * diriltmesiydi; bulutta hesap artık yok, diriltecek bir yer de yok.
 * Kuyruk da temizleniyor — gidecek hesap olmayan kayıtlar her turda
 * boşuna denenirdi.
 *
 * YALNIZCA BU HESABIN satırları gider. Aynı cihazda başka hesap da
 * kullanılmış olabilir; onun verisi, kuyruğu ve imleçleri yerinde kalır.
 * `device_prefs` (tema) cihaza ait, hesaba değil — dokunulmuyor.
 *
 * Yerelde tablolar arasında yabancı anahtar yok; yine de çocuktan
 * ebeveyne doğru siliniyor, bir gün kısıt eklenirse çalışmaya devam etsin.
 */

import { sql } from 'drizzle-orm';
import { getDb } from '../client';
import { SYNC_TABLE_ORDER } from '../schema';

/**
 * `sync_state`'te hesaba bağlı anahtarlar (bkz. `sync/state.ts`,
 * `sync/recovery.ts`). Yeni bir hesap anahtarı eklenirse buraya da
 * eklenmeli — yoksa silinen hesabın imleci cihazda kalır.
 */
const accountStateKeys = (userId: string) => [
  `last_success_at:${userId}`,
  `last_error:${userId}`,
  `recovery_v2:${userId}`,
];

const accountStatePrefixes = (userId: string) => [
  `pull:${userId}:`,
  `recovery_v2:${userId}:`,
];

export function wipeLocalUserData(userId: string): void {
  getDb().transaction((tx) => {
    for (const table of [...SYNC_TABLE_ORDER].reverse()) {
      tx.run(sql`DELETE FROM ${sql.identifier(table)} WHERE user_id = ${userId}`);
    }
    tx.run(sql`DELETE FROM outbox WHERE user_id = ${userId}`);
    tx.run(sql`DELETE FROM sync_recovery_seen WHERE user_id = ${userId}`);

    for (const key of accountStateKeys(userId)) {
      tx.run(sql`DELETE FROM sync_state WHERE key = ${key}`);
    }
    // LIKE değil önek karşılaştırması: `_` ve `%` joker sayılmasın.
    for (const prefix of accountStatePrefixes(userId)) {
      tx.run(sql`DELETE FROM sync_state WHERE substr(key, 1, ${prefix.length}) = ${prefix}`);
    }
  });
}
