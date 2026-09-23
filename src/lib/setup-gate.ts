/**
 * Kurulum kapısı — sürücü kuruluma mı, uygulamaya mı gidecek?
 *
 * ESKİ HATA: karar yalnızca "cihazda araç var mı" sorusuna bakıyordu.
 * Yeni telefonda, uygulama yeniden kurulunca ya da cihaz verisi
 * silinince veritabanı boş açılıyor; araçlar buluttan henüz inmeden
 * kapı "araç yok" deyip kurulumu açıyordu. Sürücü aracını yeniden
 * giriyor, bulut da eskisini indirince aynı araç iki kez oluyordu —
 * her girişte bir tane daha.
 *
 * Şimdi araç yoksa önce bu cihazda bu hesabın EN AZ BİR TAM senkronu
 * bitmiş mi diye bakılıyor. Bitmemişse beklenir; bittiyse ve araç hâlâ
 * yoksa hesap gerçekten yeni demektir, kurulum açılır.
 */

export type SetupGate =
  /** Araç var, uygulama açılır. */
  | 'ready'
  /** Araç yok ama bulut henüz sorulmadı — kayıtlar iniyor olabilir. */
  | 'waiting'
  /** Bulut sorulamadı (bağlantı yok ya da hata); karar verilemiyor. */
  | 'sync_failed'
  /** Bulut da boş: hesap yeni, kurulum açılır. */
  | 'setup';

export interface SetupGateInput {
  hasVehicle: boolean;
  /** Bu cihazda bu hesabın tamamlanmış bir senkronu var mı? */
  syncedOnce: boolean;
  /** Son senkron turu hatayla mı bitti? */
  syncFailed: boolean;
  /** Sürücü "yine de kuruluma geç" dedi mi? Yalnızca hata durumunda sunuluyor. */
  skipWait: boolean;
}

export function resolveSetupGate(input: SetupGateInput): SetupGate {
  if (input.hasVehicle) return 'ready';
  if (input.syncedOnce || input.skipWait) return 'setup';
  return input.syncFailed ? 'sync_failed' : 'waiting';
}
