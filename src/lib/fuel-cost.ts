/**
 * O gün YAKILAN yakıtın parasal karşılığı.
 *
 * Sürücü vardiya sonunda iki şey yazıyor: kaç km yaptığı ve aracının
 * ortalama tüketimi. Üçüncüsü — birim fiyat — son dolumundan biliniyor.
 * Üçü çarpılınca o günün gerçek yakıt maliyeti çıkıyor.
 *
 * NEDEN ÖDENEN YAKIT YETMİYOR: sürücü pazartesi depo doldurup cumaya
 * kadar onunla gidiyor. Ödenen parayı pazartesiye yazmak o günü felaket,
 * diğer dört günü harika gösterir — oysa beş gün de aynı işi yaptı.
 * Ödenen para "cebe kalan" satırında (nakit gerçeği), yakılan yakıt
 * "gerçek kâr" satırında duruyor.
 *
 * Depo/sayaç takibi YOK. Tam depo yöntemi sürücüden her dolumda kilometre
 * sayacı istiyordu ve zincirdeki tek bir eksik kayıt ölçümü bozuyordu.
 */

import { type Kurus, ZERO, asKurus, roundHalfAwayFromZero } from './money.ts';

/** Yüz kilometrede tüketilen mililitre — 7,5 lt/100km → 7500. */
export type ConsumptionPer100Km = number;

/**
 * Yakılan yakıtın kuruş karşılığı.
 *
 * Üç girdiden biri bile eksikse SIFIR döner ve bu doğru davranış:
 * bilinmeyen maliyeti uydurmaktansa hesaba katmamak yeğdir. Arayüz
 * eksik girdiyi söylemek zorunda, yoksa sürücü kârını olduğundan
 * yüksek görür ve neden olduğunu anlamaz.
 */
export function calculateFuelBurned(
  distanceKm: number | null | undefined,
  consumptionPer100Km: ConsumptionPer100Km | null | undefined,
  unitPriceKurus: Kurus | null | undefined,
): Kurus {
  if (distanceKm == null || consumptionPer100Km == null || unitPriceKurus == null) {
    return ZERO;
  }
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return ZERO;
  if (!Number.isFinite(consumptionPer100Km) || consumptionPer100Km <= 0) return ZERO;
  if (!Number.isFinite(unitPriceKurus) || unitPriceKurus <= 0) return ZERO;

  /**
   * km × (ml/100km) → mililitre; ÷1000 → litre; × kuruş/litre → kuruş.
   * Tek ifadede toplanıyor ki ara adımlarda yuvarlama olmasın.
   */
  return asKurus(roundHalfAwayFromZero(
    (distanceKm * consumptionPer100Km * unitPriceKurus) / 100_000,
  ));
}

/** Yakılan mililitre — arayüzde "bugün ~15 lt yaktın" demek için. */
export function calculateVolumeBurned(
  distanceKm: number | null | undefined,
  consumptionPer100Km: ConsumptionPer100Km | null | undefined,
): number | null {
  if (distanceKm == null || consumptionPer100Km == null) return null;
  if (!Number.isFinite(distanceKm) || distanceKm <= 0) return null;
  if (!Number.isFinite(consumptionPer100Km) || consumptionPer100Km <= 0) return null;
  return Math.round((distanceKm * consumptionPer100Km) / 100);
}
