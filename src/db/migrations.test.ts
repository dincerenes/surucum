/**
 * Veri onaran yerel migration'lar — eski bir cihazın veritabanı kurulup
 * üzerine yeni migration koşuluyor.
 *
 * Şemayı değiştiren migration'ları `schema-parity.test.ts` denetliyor;
 * buradakiler VERİYE dokunanlar. Yanlış bir onarım geri alınamaz: cihaz
 * kaynak-doğruluk, bulut yalnızca yedek.
 */

import assert from 'node:assert/strict';
import { DatabaseSync } from 'node:sqlite';
import { describe, it } from 'node:test';
import { applyMigrations, migrationIndex } from '../../tools/test-db.ts';

const A = '0199a000-0000-7000-8000-00000000000a';

describe('0009 — tam sayı sütunlarında kalmış ondalıklar', () => {
  function oldDevice() {
    const db = new DatabaseSync(':memory:');
    const repair = migrationIndex('0009');
    applyMigrations(db, { until: repair });
    return { db, repair };
  }

  it('ondalık kilometre yuvarlanır, satır kuyruğa girer, takılmış denemesi sıfırlanır', () => {
    const { db, repair } = oldDevice();
    const insertShift = db.prepare(`INSERT INTO shifts
      (id, user_id, created_at, updated_at, vehicle_id, started_at, ended_at,
       distance_km, worked_minutes, business_date)
      VALUES (?, ?, 1, 100, 'v', 1, 2, ?, ?, '2026-09-18')`);
    insertShift.run('s-ondalik', A, 238.5, 90);
    insertShift.run('s-temiz', A, 120, 60);
    insertShift.run('s-yarim-dakika', A, 12, 30.5);

    // Gönderim bu satırı reddetmiş ve geri çekilmeye almış.
    db.prepare(`INSERT INTO outbox
      (table_name, row_id, user_id, operation, revision, attempt_count, last_error,
       next_attempt_at, created_at)
      VALUES ('shifts', 's-ondalik', ?, 'upsert', 3, 7, 'invalid input syntax', 999999, 1)`)
      .run(A);

    applyMigrations(db, { from: repair });

    const rows = db.prepare(`SELECT id, distance_km, typeof(distance_km) AS t,
      worked_minutes, updated_at FROM shifts ORDER BY id`).all().map((r) => ({ ...r }));
    assert.deepEqual(rows, [
      { id: 's-ondalik', distance_km: 239, t: 'integer', worked_minutes: 90, updated_at: 101 },
      { id: 's-temiz', distance_km: 120, t: 'integer', worked_minutes: 60, updated_at: 100 },
      { id: 's-yarim-dakika', distance_km: 12, t: 'integer', worked_minutes: 31, updated_at: 101 },
    ]);

    const queue = db.prepare(`SELECT row_id, user_id, operation, revision, attempt_count,
      last_error, next_attempt_at FROM outbox ORDER BY row_id`).all().map((r) => ({ ...r }));
    assert.deepEqual(queue, [
      {
        row_id: 's-ondalik', user_id: A, operation: 'upsert', revision: 4,
        attempt_count: 0, last_error: null, next_attempt_at: null,
      },
      {
        row_id: 's-yarim-dakika', user_id: A, operation: 'upsert', revision: 1,
        attempt_count: 0, last_error: null, next_attempt_at: null,
      },
    ]);
  });

  it('silinmiş satır silme olarak kuyruğa girer — dirilmez', () => {
    const { db, repair } = oldDevice();
    db.prepare(`INSERT INTO shifts
      (id, user_id, created_at, updated_at, deleted_at, vehicle_id, started_at,
       distance_km, business_date)
      VALUES ('s-silik', ?, 1, 5, 5, 'v', 1, 10.5, '2026-09-18')`).run(A);

    applyMigrations(db, { from: repair });

    const q = db.prepare('SELECT operation FROM outbox').get();
    assert.equal(q?.operation, 'delete');
    assert.equal(db.prepare('SELECT distance_km FROM shifts').get()?.distance_km, 11);
  });

  it('tam sayı veride hiçbir şey değişmez, kuyruk boş kalır', () => {
    const { db, repair } = oldDevice();
    db.prepare(`INSERT INTO vehicles
      (id, user_id, created_at, updated_at, label, ownership, wear_per_km_kurus)
      VALUES ('v', ?, 1, 1, 'Araç', 'owned', 250)`).run(A);
    applyMigrations(db, { from: repair });
    assert.equal(db.prepare('SELECT count(*) AS n FROM outbox').get()?.n, 0);
    assert.equal(db.prepare('SELECT updated_at FROM vehicles').get()?.updated_at, 1);
  });
});
