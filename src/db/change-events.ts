/**
 * Veritabanı değişiklik olaylarının süzgeci — YERLİ BAĞIMLILIĞI YOK.
 *
 * `expo-sqlite` import etmiyor; böylece `node --test` altında doğrudan
 * koşabiliyor. Bu dosyadaki hata bir kez arayüzün tamamını sessizce
 * dondurdu, bir daha testsiz bırakılmıyor.
 */

export const DATABASE_NAME = 'surucum.db';

/** `addDatabaseChangeListener` olayının bize gereken alanları. */
export interface DatabaseChangeEventLike {
  /**
   * SQLite'ın MANTIKSAL veritabanı adı — neredeyse her zaman `"main"`.
   * Dosya adı DEĞİL; süzgeçte kullanılmaz.
   */
  databaseName?: string | null;
  /** Açık veritabanının dosya yolu. Süzgeç buna bakar. */
  databaseFilePath?: string | null;
}

/**
 * Olay bizim veritabanımızdan mı geliyor?
 *
 * DOSYA YOLUNA bakılır, `databaseName`'e DEĞİL. `databaseName` `"main"`
 * geldiği için ona bakan bir süzgeç HER OLAYI eler: veri doğru yazılır,
 * ekran hiç güncellenmez, hata da vermez.
 *
 * Yol boşsa olay GEÇİRİLİR. Fazladan bir okuma ucuz; kaçırılan bir
 * güncelleme sürücünün gördüğü sayıyı yanlış yapar.
 */
export function isOwnDatabaseEvent(
  event: DatabaseChangeEventLike,
  databaseName: string = DATABASE_NAME,
): boolean {
  if (!event.databaseFilePath) return true;
  return event.databaseFilePath.includes(databaseName);
}
