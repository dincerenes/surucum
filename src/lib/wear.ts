/**
 * Kilometre başına yıpranma payı — sürücünün kendi cevaplarından.
 *
 * Eskiden tek bir sabit katsayıydı (2,50 ₺/km) ve sürücüye hiçbir şey
 * sorulmuyordu. Artık kurulum üç kalemi soruyor ve pay onlardan çıkıyor:
 *
 *   bakım/km       = bakım maliyeti ÷ bakım aralığı
 *   lastik/km      = lastik maliyeti ÷ lastik ömrü
 *   değer kaybı/km = aracın ikinci el değeri × %0,90 ÷ 10.000 km
 *
 * Örnek: 8.000 ₺ / 10.000 km = 0,80 ₺; 16.000 ₺ / 40.000 km = 0,40 ₺;
 * 900.000 ₺'lik araç 0,81 ₺. Toplam 2,01 ₺/km.
 *
 * DEĞER KAYBI ORANI BİLEREK DÜŞÜK. İlk öneri 10.000 km'de %2'ydi; sürücü
 * sonucu yüksek buldu ve düşürülmesini istedi. Yüksek bir pay kârı
 * olduğundan kötü gösterir, sürücü sayıya inanmaz. Oran yayın sonrası
 * gerçek veriyle ayarlanacak.
 *
 * BİLİNMEYEN KALEM VARSAYILANDAN gelir: sürücü lastiğini bilmiyorsa o
 * kalem sıfır sayılmaz, eski sabit katsayının payı kullanılır. Kalemlerin
 * varsayılanlarının toplamı eski sabit katsayıya (250 kuruş) eşit — hiçbir
 * şey bilmeyen sürücünün payı değişmiyor.
 */

import { DEFAULT_WEAR_PER_KM, type OwnershipType } from '../db/schema/_shared.ts';
import { type Kurus, roundHalfAwayFromZero } from './money.ts';

/** Değer kaybı: her 10.000 km'de ikinci el değerin baz puanı (90 = %0,90). */
export const DEPRECIATION_BPS_PER_10K_KM = 90;

/** Kalem bilinmediğinde kullanılan pay, kuruş/km. Toplamı eski sabit (250). */
export const FALLBACK_WEAR_KURUS = {
  maintenance: 60,
  tires: 40,
  depreciation: 150,
} as const;

export interface WearInputs {
  maintenanceIntervalKm?: number | null;
  maintenanceCostKurus?: number | null;
  tireIntervalKm?: number | null;
  tireCostKurus?: number | null;
  marketValueKurus?: number | null;
}

export interface WearPart {
  /** Kuruş/km, KESİRLİ — yuvarlama yalnızca toplamda. */
  perKm: number;
  /** Sürücünün cevabı yok, varsayılan kullanıldı. */
  estimated: boolean;
}

export interface WearBreakdown {
  maintenance: WearPart;
  tires: WearPart;
  depreciation: WearPart;
  /** Aracın saklanan katsayısı: kalemlerin toplamı, tam kuruşa yuvarlı. */
  total: Kurus;
}

function positive(n: number | null | undefined): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n > 0;
}

function perInterval(cost: number | null | undefined, km: number | null | undefined,
  fallback: number): WearPart {
  // Maliyeti sıfır giren sürücü de "bilmiyorum" sayılmaz: 0 geçerli bir cevap.
  if (typeof cost === 'number' && cost >= 0 && positive(km)) {
    return { perKm: cost / km, estimated: false };
  }
  return { perKm: fallback, estimated: true };
}

export function calculateWear(inputs: WearInputs): WearBreakdown {
  const maintenance = perInterval(
    inputs.maintenanceCostKurus, inputs.maintenanceIntervalKm, FALLBACK_WEAR_KURUS.maintenance,
  );
  const tires = perInterval(
    inputs.tireCostKurus, inputs.tireIntervalKm, FALLBACK_WEAR_KURUS.tires,
  );
  const depreciation: WearPart = positive(inputs.marketValueKurus)
    ? {
      perKm: (inputs.marketValueKurus * DEPRECIATION_BPS_PER_10K_KM) / 10_000 / 10_000,
      estimated: false,
    }
    : { perKm: FALLBACK_WEAR_KURUS.depreciation, estimated: true };

  const total = roundHalfAwayFromZero(
    maintenance.perKm + tires.perKm + depreciation.perKm,
  ) as Kurus;
  return { maintenance, tires, depreciation, total };
}

/**
 * Aracın saklanacak katsayısı.
 *
 * Kiralık araçta ve işveren aracında SIFIR — aracın değer kaybı ve bakımı
 * sürücünün cebinden çıkmıyor, o maliyet kira bedelinde. Sürücü bu
 * kalemleri girmiş olsa bile sayılmıyor; yoksa aynı maliyet iki kez düşer.
 */
export function wearFor(ownership: OwnershipType, inputs: WearInputs): Kurus {
  if (DEFAULT_WEAR_PER_KM[ownership] === 0) return 0 as Kurus;
  return calculateWear(inputs).total;
}
