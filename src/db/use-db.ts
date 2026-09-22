/**
 * Ekranların veritabanına bağlandığı yer.
 *
 * `useLiveQuery` yerine ham değişiklik dinleyicisi kullanılıyor: gün özeti
 * tek bir sorgu değil, beş tablodan okuyup hesaplayan bir fonksiyon.
 * `useLiveQuery` tek sorguya bağlanıyor ve diğer tablolardaki değişimi
 * kaçırıyor — sürücü gider eklediğinde özet güncellenmezdi.
 *
 * Dinleyicinin çalışması için veritabanı `enableChangeListener: true` ile
 * açılmış olmalı; `client.ts` bunu yapıyor.
 */

import { useCallback, useEffect, useState } from 'react';
import { addDatabaseChangeListener } from 'expo-sqlite';
import { isOwnDatabaseEvent } from './change-events';

/**
 * Veritabanı her değiştiğinde `read` fonksiyonunu yeniden çalıştırır.
 *
 * `read` SENKRON olmak zorunda — sürücü tutarı yazdığında ekran o an
 * güncellenmeli, bir tur beklememelidir.
 */
export function useDbValue<T>(read: () => T, deps: readonly unknown[] = []): T {
  /**
   * Bağımlılık listesi ÇAĞIRANDAN geliyor — `useDbValue`'nun kendisi bir
   * kanca sarmalayıcısı; derleyici kuralları dizinin burada sabit
   * yazılmasını istiyor ama o zaman her ekran kendi kancasını yazardı.
   */
  // eslint-disable-next-line react-hooks/exhaustive-deps, react-hooks/use-memo
  const compute = useCallback(read, deps);
  const [value, setValue] = useState<T>(compute);

  useEffect(() => {
    /**
     * Bağımlılıklar değişince (ör. İstatistik'te dönem seçimi) değer o an
     * yeniden okunmalı; dinleyici ancak bir sonraki yazmada tetiklenir.
     */
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setValue(compute());

    const sub = addDatabaseChangeListener((event) => {
      /**
       * Başka bir veritabanındaki değişiklik bizi ilgilendirmiyor.
       * Uygulama tek veritabanı açıyor ama sınama düzenekleri geçici
       * veritabanları açabiliyor.
       */
      if (!isOwnDatabaseEvent(event)) return;
      setValue(compute());
    });

    return () => sub.remove();
  }, [compute]);

  return value;
}
