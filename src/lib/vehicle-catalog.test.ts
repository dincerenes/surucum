import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import {
  OTHER_OPTION, VEHICLE_MAKES, modelYears, modelsFor,
} from './vehicle-catalog.ts';

describe('araç kataloğu', () => {
  it('marka listesi dolu ve tekrarsız', () => {
    assert.ok(VEHICLE_MAKES.length > 20);
    assert.equal(new Set(VEHICLE_MAKES).size, VEHICLE_MAKES.length);
  });

  it('"Diğer" her zaman son sırada — listeye takılan olmasın', () => {
    assert.equal(VEHICLE_MAKES[VEHICLE_MAKES.length - 1], OTHER_OPTION);
  });

  it('bilinen markanın modelleri geliyor ve sonunda "Diğer" var', () => {
    const models = modelsFor('Renault');
    assert.ok(models.includes('Symbol'));
    assert.equal(models[models.length - 1], OTHER_OPTION);
  });

  it('bilinmeyen markada yalnızca serbest giriş kalıyor', () => {
    assert.deepEqual(modelsFor('Bilinmeyen'), [OTHER_OPTION]);
    assert.deepEqual(modelsFor(OTHER_OPTION), [OTHER_OPTION]);
  });

  it('marka seçilmemişse model listesi boş', () => {
    assert.deepEqual(modelsFor(null), []);
  });

  it('her markanın en az bir modeli var', () => {
    for (const make of VEHICLE_MAKES) {
      if (make === OTHER_OPTION) continue;
      assert.ok(modelsFor(make).length > 1, make);
    }
  });

  it('yıl listesi yeniden eskiye ve gelecek yılı içeriyor', () => {
    const years = modelYears(new Date(2026, 5, 1));
    assert.equal(years[0], '2027');
    assert.equal(years[years.length - 1], '1998');
    assert.ok(years.indexOf('2026') < years.indexOf('2020'));
  });
});
