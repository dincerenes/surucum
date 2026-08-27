/**
 * Senkron zamanlayıcısını uygulamanın yaşam döngüsüne bağlayan kanca.
 *
 * Oturum açıkken çalışır, kapanınca durur. Oturum yokken zamanlayıcıyı
 * açık bırakmak her turda "not_signed_in" ile dönen boş çağrılar demek
 * olurdu.
 */

import { useEffect, useState } from 'react';
import { getSyncStatus } from './state';
import { onSyncResult, startSyncScheduler } from './scheduler';
import { pendingCount } from './push';
import type { SyncOutcome } from './worker';

export interface SyncSnapshot {
  /** Kuyrukta bekleyen kayıt — arayüzdeki "senkronlanmadı" rozeti. */
  pending: number;
  lastSuccessAt: number | null;
  lastError: string | null;
  /** Son turda gerçekten ağa çıkıldı mı? */
  lastRan: boolean;
}

function snapshot(lastRan = false): SyncSnapshot {
  const status = getSyncStatus();
  return {
    pending: pendingCount(),
    lastSuccessAt: status.lastSuccessAt,
    lastError: status.lastError,
    lastRan,
  };
}

/**
 * Zamanlayıcıyı `enabled` olduğu sürece çalıştırır ve son durumu döner.
 *
 * `enabled` genellikle "oturum var mı" sorusudur. Kanca durumu yalnızca
 * tur bittiğinde güncelliyor; her yazmada değil. Sürücü sefer eklediğinde
 * ekranın kendisi zaten anında güncelleniyor — rozet birkaç saniye geç
 * kalabilir, arayüz senkronu beklemiyor.
 */
export function useSync(enabled: boolean): SyncSnapshot {
  const [state, setState] = useState<SyncSnapshot>(() => snapshot());

  useEffect(() => {
    if (!enabled) return;

    const stop = startSyncScheduler();
    const unsubscribe = onSyncResult((outcome: SyncOutcome) => {
      setState(snapshot(outcome.ran));
    });

    return () => { unsubscribe(); stop(); };
  }, [enabled]);

  return state;
}
