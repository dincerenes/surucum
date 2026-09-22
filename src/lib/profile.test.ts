import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import {
  MAX_DISPLAY_NAME, blankToNull, firstName, greetingFor, initialOf, normalizeDisplayName,
} from './profile.ts';

describe('selamlama', () => {
  it('saat aralıkları: alt sınır dahil, üst sınır hariç', () => {
    const cases: Array<[number, string]> = [
      [5, 'Günaydın'], [10, 'Günaydın'],
      [11, 'Tünaydın'], [16, 'Tünaydın'],
      [17, 'İyi akşamlar'], [21, 'İyi akşamlar'],
      [22, 'İyi geceler'], [23, 'İyi geceler'], [0, 'İyi geceler'], [4, 'İyi geceler'],
    ];
    for (const [hour, expected] of cases) assert.equal(greetingFor(hour), expected, `saat ${hour}`);
  });
});

describe('ad', () => {
  it('boşluklar temizleniyor, boş ad null', () => {
    assert.equal(normalizeDisplayName('  Enes   Dinçer '), 'Enes Dinçer');
    assert.equal(normalizeDisplayName('   '), null);
    assert.equal(normalizeDisplayName(null), null);
    assert.equal(blankToNull(' İzmir '), 'İzmir');
    assert.equal(blankToNull(''), null);
  });

  it('uzun ad kırpılıyor', () => {
    assert.equal(normalizeDisplayName('a'.repeat(100))!.length, MAX_DISPLAY_NAME);
  });

  it('selamlamada ilk ad', () => {
    assert.equal(firstName('Mehmet Ali Yılmaz'), 'Mehmet');
    assert.equal(firstName(null), null);
  });

  it('avatar harfi Türkçe büyük', () => {
    assert.equal(initialOf('ismail'), 'İ');
    assert.equal(initialOf('ırmak'), 'I');
    assert.equal(initialOf(''), null);
  });
});
