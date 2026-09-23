import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import { type SetupGateInput, resolveSetupGate } from './setup-gate.ts';

const base: SetupGateInput = {
  hasVehicle: false, syncedOnce: false, syncFailed: false, skipWait: false,
};

describe('kurulum kapısı', () => {
  it('araç varsa senkrondan bağımsız olarak uygulama açılır', () => {
    assert.equal(resolveSetupGate({ ...base, hasVehicle: true }), 'ready');
    assert.equal(resolveSetupGate({ ...base, hasVehicle: true, syncFailed: true }), 'ready');
  });

  it('boş cihazda ilk senkron bitmeden kurulum AÇILMAZ — çift araç hatası', () => {
    assert.equal(resolveSetupGate(base), 'waiting');
  });

  it('senkron bitti ve araç yoksa hesap yenidir, kurulum açılır', () => {
    assert.equal(resolveSetupGate({ ...base, syncedOnce: true }), 'setup');
  });

  it('senkron başarısızsa beklenir, sürücü isterse kuruluma geçer', () => {
    assert.equal(resolveSetupGate({ ...base, syncFailed: true }), 'sync_failed');
    assert.equal(resolveSetupGate({ ...base, syncFailed: true, skipWait: true }), 'setup');
  });
});
