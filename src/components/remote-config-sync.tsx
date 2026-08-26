import { useEffect } from 'react';

import { useAuth } from '@/lib/auth/auth-context';
import { hydrateRemoteConfig, refreshRemoteConfig, setRemoteConfigUser } from '@/lib/remote-config';

/**
 * Uzaktan yapılandırmayı açılışta hazırlar. Hiçbir şey çizmez.
 *
 * Ağaçta AuthProvider'ın içinde durmalı: kademeli açılış hesabı kullanıcı
 * kimliğine dayanıyor ve o kimlik oturum kurulduktan sonra belli oluyor.
 *
 * Çizim bu işi BEKLEMEZ. Tazeleme başarısız olursa (ağ yok, bulut
 * yapılandırılmamış) uygulama son bilinen değerlerle, o da yoksa açık
 * varsayılanlarla çalışmaya devam eder.
 */
export function RemoteConfigSync() {
  const { user } = useAuth();

  useEffect(() => {
    setRemoteConfigUser(user?.id ?? null);
  }, [user?.id]);

  useEffect(() => {
    void hydrateRemoteConfig().then(() => refreshRemoteConfig());
  }, []);

  return null;
}
