import { strict as assert } from 'node:assert';
import { describe, it } from 'node:test';

import { DATABASE_NAME, isOwnDatabaseEvent } from './change-events.ts';

const PATH = `/var/mobile/Containers/Data/Application/ABC/Documents/SQLite/${DATABASE_NAME}`;

describe('isOwnDatabaseEvent', () => {
  it('kendi veritabanımızın olayını geçirir', () => {
    assert.equal(
      isOwnDatabaseEvent({ databaseName: 'main', databaseFilePath: PATH }),
      true,
    );
  });

  /**
   * ASIL KORUNAN DAVRANIŞ.
   *
   * `databaseName` her zaman `"main"` gelir. Süzgeç ona bakarsa hiçbir
   * olay geçmez ve arayüz sessizce donar — vardiya kapanır, ekran hâlâ
   * "canlı vardiya" gösterir. Bu bir kez yaşandı.
   */
  it("mantıksal ad 'main' olsa da eleme yapmaz", () => {
    assert.equal(
      isOwnDatabaseEvent({ databaseName: 'main', databaseFilePath: PATH }),
      true,
    );
    assert.equal(
      isOwnDatabaseEvent({ databaseName: DATABASE_NAME, databaseFilePath: PATH }),
      true,
    );
  });

  it('başka bir veritabanının olayını eler', () => {
    assert.equal(
      isOwnDatabaseEvent({ databaseName: 'main', databaseFilePath: '/tmp/sinama.db' }),
      false,
    );
  });

  /** Yol yoksa geçirilir: fazladan okuma, kaçırılan güncellemeden ucuzdur. */
  it('dosya yolu boşsa geçirir', () => {
    assert.equal(isOwnDatabaseEvent({ databaseName: 'main' }), true);
    assert.equal(isOwnDatabaseEvent({ databaseFilePath: null }), true);
    assert.equal(isOwnDatabaseEvent({ databaseFilePath: '' }), true);
  });
});
