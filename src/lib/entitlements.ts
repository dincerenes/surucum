/**
 * Özellik yetkileri.
 *
 * v1'de uygulama tamamen ücretsiz. Yine de ekranlar özelliği doğrudan açıp
 * kapatmak yerine `hasFeature()` soruyor: ileride bir ödeme katmanı
 * gelirse yalnızca bu dosya değişir, kırk ekran değil.
 *
 * Yetki artık iki kaynaktan geliyor:
 *  1. Uzaktan özellik bayrakları (yönetim paneli) — bozulan bir özelliği
 *     sürüm çıkmadan kapatmaya yarayan acil durum anahtarı.
 *  2. İleride: ödeme durumu. Henüz yok.
 *
 * `hasFeature` EŞZAMANLI kalmak zorunda; bayrak durumu önbellekten okunur,
 * ekran çizimi ağ çağrısı beklemez. Bkz. `remote-config.ts`.
 */

import { isFlagEnabled } from './remote-config';

export const FEATURES = [
  'unlimitedHistory',  // 30 günden eski kayıtlara erişim
  'advancedReports',   // kârlılık ısı haritası, kaynak karşılaştırma
  'export',            // Excel / PDF dışa aktarım
  'cloudBackup',       // bulut yedek ve cihaz değiştirme
  'multiVehicle',      // birden fazla araç
] as const;

export type Feature = (typeof FEATURES)[number];

export function hasFeature(feature: Feature): boolean {
  // Bayrak tanımlı değilse veya bulut yoksa açık kabul edilir —
  // uygulama bulutsuz da eksiksiz çalışmak zorunda.
  return isFlagEnabled(feature);
}

/** Kilitli bir özelliğe dokunulduğunda gösterilecek metin. */
export function featureLockMessage(feature: Feature): string | null {
  if (hasFeature(feature)) return null;
  return 'Bu özellik şu anda geçici olarak kapalı. Kısa süre içinde açılacak.';
}
