import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { isAfter, nextCursor } from './cursor.ts';

const EPOCH = '1970-01-01T00:00:00.000Z';
const T1 = '2026-08-27T10:00:00.000+00:00';
const T2 = '2026-08-27T11:00:00.000+00:00';
const T3 = '2026-08-27T12:00:00.000+00:00';

describe('isAfter', () => {
  it('Z ile +00:00 biçimleri doğru karşılaştırılır', () => {
    // Metin karşılaştırması burada yanılırdı
    assert.equal(isAfter('2026-08-27T10:00:00.000+00:00', '2026-08-27T09:00:00.000Z'), true);
    assert.equal(isAfter('2026-08-27T09:00:00.000Z', '2026-08-27T10:00:00.000+00:00'), false);
  });

  it('aynı an daha yeni sayılmaz', () => {
    assert.equal(isAfter('2026-08-27T10:00:00.000Z', '2026-08-27T10:00:00.000+00:00'), false);
  });

  it('çözümlenemeyen damga daha yeni sayılmaz — imleç yerinde kalır', () => {
    assert.equal(isAfter('bozuk', T1), false);
    assert.equal(isAfter(T1, 'bozuk'), false);
    assert.equal(isAfter('', T1), false);
  });
});

describe('nextCursor', () => {
  it('hiçbir tablo kesilmediyse en yüksek damgaya taşınır', () => {
    const next = nextCursor(EPOCH, [
      { lastSeen: T1, truncated: false },
      { lastSeen: T3, truncated: false },
    ], false);
    assert.equal(next, T3);
  });

  it('KESİLEN tablo imleci kendi son damgasında tutar', () => {
    // A tablosu T1'de kesildi, B tablosu T3'e kadar indi.
    // İmleç T3'e taşınsaydı A'nın T1–T3 arası satırları kaybolurdu.
    const next = nextCursor(EPOCH, [
      { lastSeen: T1, truncated: true },
      { lastSeen: T3, truncated: false },
    ], false);
    assert.equal(next, T1);
  });

  it('birden fazla tablo kesildiyse EN DÜŞÜK son damga kazanır', () => {
    const next = nextCursor(EPOCH, [
      { lastSeen: T2, truncated: true },
      { lastSeen: T1, truncated: true },
      { lastSeen: T3, truncated: false },
    ], false);
    assert.equal(next, T1);
  });

  it('hata varsa imleç HİÇ ilerlemez', () => {
    const next = nextCursor(EPOCH, [
      { lastSeen: T3, truncated: false },
    ], true);
    assert.equal(next, EPOCH);
  });

  it('hiç veri gelmediyse imleç yerinde kalır', () => {
    assert.equal(nextCursor(T2, [], false), T2);
    assert.equal(nextCursor(T2, [{ lastSeen: null, truncated: false }], false), T2);
  });

  it('imleç GERİ gitmez', () => {
    const next = nextCursor(T3, [{ lastSeen: T1, truncated: false }], false);
    assert.equal(next, T3);
  });

  it('bozuk damga imleci kaydırmaz', () => {
    assert.equal(nextCursor(T2, [{ lastSeen: 'bozuk', truncated: false }], false), T2);
  });
});
