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
import { DATABASE_NAME } from './client';

/**
 * Veritabanı her değiştiğinde `read` fonksiyonunu yeniden çalıştırır.
 *
 * `read` SENKRON olmak zorunda — sürücü tutarı yazdığında ekran o an
 * güncellenmeli, bir tur beklememelidir.
 */
export function useDbValue<T>(read: () => T, deps: readonly unknown[] = []): T {
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const compute = useCallback(read, deps);
  const [value, setValue] = useState<T>(compute);

  useEffect(() => {
    setValue(compute());

    const sub = addDatabaseChangeListener((event) => {
      /**
       * Başka bir veritabanındaki değişiklik bizi ilgilendirmiyor.
       * Uygulama tek veritabanı açıyor ama sınama düzenekleri geçici
       * veritabanları açabiliyor.
       */
      if (event.databaseName && !event.databaseName.includes(DATABASE_NAME)) return;
      setValue(compute());
    });

    return () => sub.remove();
  }, [compute]);

  return value;
}
