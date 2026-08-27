/**
 * Bir iş gününün özeti — üç satırın gerçek kayıtlardan üretildiği yer.
 *
 * Veritabanı bilmez: satırları alır, sayı üretir. Okuma sorguları
 * `src/db/repo/summary.ts` içinde; bu modül yalnızca aritmetik yapar ki
 * native SQLite kurmadan test edilebilsin.
 *
 * KİLOMETRE burada topluca ele alınıyor: bir iş gününde birden fazla
 * vardiya olabilir ve bazılarının kilometresi girilmemiş olabilir.
 * Girilmemiş olanı TAHMİN ETMİYORUZ — bilinen kilometreleri topluyor,
 * eksik vardiya sayısını ayrıca bildiriyoruz. Yıpranma payı o zaman
 * eksik hesaplanır ve arayüz bunu söylemek zorundadır.
 */

import { type Kurus, ZERO, add, multiply } from './money.ts';
import { calculateFuelBurned, calculateVolumeBurned } from './fuel-cost.ts';
import { type ProfitBreakdown, calculateProfit } from './profit.ts';
import {
  type ShiftTiming, type UnixMs, normalizeDistance, resolveShiftDuration,
  earningsPerHour, earningsPerKm, earningsPerRide,
} from './shift.ts';

/** Özetin sefer kayıtlarından ihtiyaç duyduğu alanlar. */
export interface RideRow {
  grossAmountKurus: Kurus;
  commissionKurus: Kurus;
  tipKurus: Kurus;
}

export interface AmountRow {
  amountKurus: Kurus;
}

export interface FuelRow {
  totalAmountKurus: Kurus;
}

/**
 * Vardiya satırı — süre/mesafe alanlarına ARACIN yıpranma oranı eklenmiş.
 *
 * Oran vardiyanın kendi üzerinde taşınıyor çünkü aynı iş gününde iki
 * farklı araçla çalışılabilir ve her aracın oranı farklıdır. Boşsa
 * `DaySummaryInput.wearPerKmKurus` kullanılır.
 */
export interface ShiftRow extends ShiftTiming {
  wearPerKmKurus?: Kurus | null;

  /**
   * O gün uygulamaya ödenen komisyon — sürücünün vardiya sonunda yazdığı
   * TEK RAKAM. Sefer başına oran kullanılmıyor.
   */
  commissionKurus?: Kurus | null;

  /** Aracın ortalama tüketimi, 100 km başına mililitre (7,5 lt → 7500). */
  fuelConsumptionPer100Km?: number | null;

  /** O gün geçerli birim yakıt fiyatı, kuruş/litre. */
  fuelPriceKurus?: Kurus | null;
}

export interface DaySummaryInput {
  rides: readonly RideRow[];
  expenses: readonly AmountRow[];
  fuelLogs: readonly FuelRow[];

  /** O iş gününün vardiyaları. Boş olabilir — vardiyasız sefer de olur. */
  shifts?: readonly ShiftRow[];

  /** Vardiyanın kendi oranı yoksa kullanılacak yıpranma payı. */
  wearPerKmKurus?: Kurus;

  /**
   * Sabit giderin o güne düşen payı. Bu modül HESAPLAMAZ, hazır alır —
   * tahakkuk motoru `allocate()` kullanmak zorunda ve kendi modülünde.
   */
  fixedShare?: Kurus;

  now: UnixMs;
}

export interface DaySummary {
  profit: ProfitBreakdown;

  rideCount: number;
  /** Bilinen kilometrelerin toplamı. Hiçbiri girilmemişse `null`. */
  distanceKm: number | null;
  /** Kilometresi girilmemiş vardiya sayısı — arayüz bunu söylemeli. */
  shiftsMissingDistance: number;

  /**
   * O gün yakılan yakıt, mililitre. Tüketim girilmemişse `null` —
   * arayüz "tüketim girilmediği için yakıt maliyeti hesaplanmadı" demeli.
   */
  volumeBurned: number | null;

  durationMinutes: number;
  /** Süre damgalardan mı türetildi? Sürücü yazdıysa `false`. */
  isDurationEstimated: boolean;

  /** Türetilmiş oranlar "cebe kalan" üzerinden. Payda yoksa `null`. */
  perHour: Kurus | null;
  perKm: Kurus | null;
  perRide: Kurus | null;
}

/**
 * Günün üç satırını ve türetilmiş sayılarını üretir.
 *
 * Oranların payı CEBE KALAN'dır, ciro değil. Sebebi: sürücü "saat başına
 * ne kazandım" diye sorduğunda kastettiği eline geçen paradır; ciro/saat
 * komisyonu ve yakıtı yok sayar ve sürücüyü olduğundan zengin gösterir.
 */
export function calculateDaySummary(input: DaySummaryInput): DaySummary {
  const shifts = input.shifts ?? [];
  const distance = collectDistance(shifts, input.wearPerKmKurus);
  const fuel = collectBurnedFuel(shifts);

  const profit = calculateProfit({
    grossAmounts: input.rides.map((r) => r.grossAmountKurus),
    /**
     * Komisyon İKİ KAYNAKTAN toplanıyor: vardiya sonunda girilen tek
     * rakam (asıl yol) ve sefer kayıtlarının kendi komisyonu (v1'de
     * daima sıfır, ileride sefer başına kesinti gerekirse diye açık).
     */
    commissionAmounts: [
      ...input.rides.map((r) => r.commissionKurus),
      ...shifts.map((s) => sanitizeCommission(s.commissionKurus)),
    ],
    tips: input.rides.map((r) => r.tipKurus),
    fuelAmounts: input.fuelLogs.map((f) => f.totalAmountKurus),
    expenseAmounts: input.expenses.map((e) => e.amountKurus),
    fixedShare: input.fixedShare ?? ZERO,
    /**
     * Tüketim hiç girilmemişse `undefined` gidiyor ve `calculateProfit`
     * ödenen yakıta düşüyor. Sıfır göndermek yakıtı bedava göstermek olurdu.
     */
    fuelBurned: fuel.cost ?? undefined,
    wearShare: distance.wearShare,
    isDistanceEstimated: distance.isPartial,
  });

  const duration = collectDuration(shifts, input.now);
  const rideCount = input.rides.length;

  return {
    profit,
    rideCount,
    distanceKm: distance.km,
    shiftsMissingDistance: distance.missing,
    volumeBurned: fuel.volume,
    durationMinutes: duration.minutes,
    isDurationEstimated: duration.isEstimated,
    perHour: earningsPerHour(profit.cashProfit, duration.minutes),
    perKm: earningsPerKm(profit.cashProfit, distance.km),
    perRide: earningsPerRide(profit.cashProfit, rideCount),
  };
}

/**
 * Vardiyaların kilometresini toplar.
 *
 * `isPartial`, kilometresi bilinen EN AZ BİR vardiya varken başka bir
 * vardiyanın kilometresinin eksik olduğu durumu işaretler: elimizdeki
 * toplam gerçeğin altında kalıyor demektir. Hiçbiri girilmemişse
 * `km` null olur ve yıpranma payı hiç hesaplanmaz — eksik değil, yok.
 */
function collectDistance(
  shifts: readonly ShiftRow[], fallbackRate: Kurus | undefined,
): { km: number | null; missing: number; isPartial: boolean; wearShare: Kurus } {
  let total = 0;
  let known = 0;
  let missing = 0;
  let wearShare = ZERO;

  for (const s of shifts) {
    const km = normalizeDistance(s.distanceKm);
    if (km == null) { missing += 1; continue; }

    total += km;
    known += 1;

    /**
     * Pay HER VARDİYA İÇİN AYRI hesaplanıp toplanıyor, toplam kilometreye
     * tek oran uygulanmıyor: iki farklı araçla çalışılan günde tek orana
     * indirgemek ortalama almak demektir ve ortalama kuruş kaybettirir.
     */
    const rate = s.wearPerKmKurus ?? fallbackRate;
    if (rate != null && rate > 0) {
      wearShare = add(wearShare, multiply(rate, km));
    }
  }

  if (known === 0) return { km: null, missing, isPartial: false, wearShare: ZERO };
  return { km: total, missing, isPartial: missing > 0, wearShare };
}

/** Vardiya sürelerini toplar; biri bile sürücü tarafından yazılmışsa... */
function collectDuration(shifts: readonly ShiftTiming[], now: UnixMs): {
  minutes: number; isEstimated: boolean;
} {
  let minutes = 0;
  let isEstimated = false;

  for (const s of shifts) {
    const d = resolveShiftDuration(s, now);
    minutes += d.minutes;
    /**
     * ...gün geneli yine de TAHMİNİ sayılır: karışık bir günde toplamın
     * güvenilirliği en zayıf halkası kadardır. Tersini yapıp "yazılmış"
     * demek, damgadan türetilmiş yarıyı da doğrulanmış gösterirdi.
     */
    if (d.isEstimated) isEstimated = true;
  }

  return { minutes, isEstimated };
}

/** Boş ve negatif komisyonu sıfıra düşürür — negatif komisyon gelir olurdu. */
function sanitizeCommission(value: Kurus | null | undefined): Kurus {
  if (value == null || !Number.isFinite(value) || value <= 0) return ZERO;
  return value;
}

/**
 * Vardiyalarda yakılan yakıtı toplar.
 *
 * Her vardiya KENDİ tüketimi ve KENDİ fiyatıyla hesaplanıyor, gün geneline
 * tek bir değer uygulanmıyor: fiyat gün içinde değişebilir ve iki farklı
 * araçla çalışılan günde tüketimler de farklıdır.
 *
 * Hiçbir vardiyada tüketim yoksa `cost` null döner — çağıran o zaman
 * ödenen yakıta düşüyor.
 */
function collectBurnedFuel(shifts: readonly ShiftRow[]): {
  cost: Kurus | null; volume: number | null;
} {
  let cost = ZERO;
  let volume = 0;
  let known = false;

  for (const s of shifts) {
    const burned = calculateFuelBurned(
      s.distanceKm, s.fuelConsumptionPer100Km, s.fuelPriceKurus,
    );
    if (burned <= 0) continue;

    cost = add(cost, burned);
    volume += calculateVolumeBurned(s.distanceKm, s.fuelConsumptionPer100Km) ?? 0;
    known = true;
  }

  return known ? { cost, volume } : { cost: null, volume: null };
}
