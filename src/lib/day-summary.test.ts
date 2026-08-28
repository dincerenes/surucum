import assert from 'node:assert/strict';
import { describe, it } from 'node:test';
import { calculateDaySummary } from './day-summary.ts';
import { type Kurus, fromLira } from './money.ts';
import { defaultWearPerKm } from '../db/schema/_shared.ts';

const k = (lira: number) => fromLira(lira);
const T0 = 1_787_700_000_000;
const H = 3_600_000;

const ride = (gross: number, commission: number, tip = 0) => ({
  grossAmountKurus: k(gross),
  commissionKurus: k(commission),
  tipKurus: k(tip),
});

const shift = (o: Partial<{
  startedAt: number; endedAt: number | null;
  workedMinutes: number | null; distanceKm: number | null;
}> = {}) => ({
  startedAt: T0, endedAt: null, workedMinutes: null, distanceKm: null, ...o,
});

describe('calculateDaySummary', () => {
  it('kiralık plakalı sürücünün tam bir günü', () => {
    const s = calculateDaySummary({
      rides: Array.from({ length: 14 }, () => ride(165, 41.25)),
      expenses: [{ amountKurus: k(150) }],
      fuelLogs: [{ totalAmountKurus: k(1100) }],
      shifts: [shift({ endedAt: T0 + 8 * H, workedMinutes: 462, distanceKm: 280 })],
      wearPerKmKurus: defaultWearPerKm('rented_plate'),
      fixedShare: k(1200),
      now: T0 + 9 * H,
    });

    assert.equal(s.profit.revenue, k(2310));
    assert.equal(s.profit.commission, k(577.5));
    assert.equal(s.profit.cashProfit, k(482.5));
    assert.equal(s.profit.wearShare, k(700));      // 280 km × 2,50 ₺
    assert.equal(s.profit.trueProfit, k(-1417.5));

    // Cebinde para var ama gün zararda — ürünün varlık sebebi
    assert.ok(s.profit.cashProfit > 0);
    assert.ok(s.profit.trueProfit < 0);

    assert.equal(s.rideCount, 14);
    assert.equal(s.distanceKm, 280);
    assert.equal(s.durationMinutes, 462);
    assert.equal(s.isDurationEstimated, false);
  });

  it('kilometre hiç girilmemişse yıpranma payı YOK, sıfır değil tahmin de değil', () => {
    const s = calculateDaySummary({
      rides: [ride(1000, 200)],
      expenses: [], fuelLogs: [],
      shifts: [shift({ endedAt: T0 + 5 * H })],
      wearPerKmKurus: defaultWearPerKm('owned'),
      now: T0 + 6 * H,
    });
    assert.equal(s.distanceKm, null);
    assert.equal(s.profit.wearShare, 0);
    assert.equal(s.perKm, null);
    assert.equal(s.shiftsMissingDistance, 1);
    // Eksik değil, hiç yok — kısmi damgası vurulmaz
    assert.equal(s.profit.isDistanceEstimated, false);
  });

  it('bazı vardiyaların kilometresi eksikse toplam KISMİ damgalanır', () => {
    const s = calculateDaySummary({
      rides: [ride(1000, 0)],
      expenses: [], fuelLogs: [],
      shifts: [
        shift({ endedAt: T0 + 4 * H, distanceKm: 120 }),
        shift({ startedAt: T0 + 6 * H, endedAt: T0 + 10 * H }),
      ],
      wearPerKmKurus: defaultWearPerKm('owned'),
      now: T0 + 11 * H,
    });
    assert.equal(s.distanceKm, 120);
    assert.equal(s.shiftsMissingDistance, 1);
    assert.equal(s.profit.isDistanceEstimated, true);
    assert.equal(s.profit.wearShare, k(300)); // 120 km × 2,50 ₺
  });

  it('kiralık araçta yıpranma sıfır — kira zaten sabit giderde sayılıyor', () => {
    const s = calculateDaySummary({
      rides: [ride(2000, 400)],
      expenses: [], fuelLogs: [],
      shifts: [shift({ endedAt: T0 + 8 * H, distanceKm: 300 })],
      wearPerKmKurus: defaultWearPerKm('rented_vehicle'),
      fixedShare: k(500),
      now: T0 + 9 * H,
    });
    assert.equal(s.profit.wearShare, 0);
    assert.equal(s.profit.trueProfit, k(1100)); // 1600 − 500
  });

  it('birden fazla vardiya toplanır', () => {
    const s = calculateDaySummary({
      rides: [ride(500, 100), ride(700, 140)],
      expenses: [], fuelLogs: [],
      shifts: [
        shift({ endedAt: T0 + 4 * H, workedMinutes: 240, distanceKm: 90 }),
        shift({ startedAt: T0 + 6 * H, endedAt: T0 + 9 * H, workedMinutes: 180, distanceKm: 70 }),
      ],
      wearPerKmKurus: defaultWearPerKm('owned'),
      now: T0 + 10 * H,
    });
    assert.equal(s.distanceKm, 160);
    assert.equal(s.durationMinutes, 420);
    assert.equal(s.isDurationEstimated, false);
    assert.equal(s.shiftsMissingDistance, 0);
  });

  it('bir vardiya bile damgadan türetilmişse gün tahmini sayılır', () => {
    const s = calculateDaySummary({
      rides: [ride(500, 0)],
      expenses: [], fuelLogs: [],
      shifts: [
        shift({ endedAt: T0 + 4 * H, workedMinutes: 240 }),
        shift({ startedAt: T0 + 6 * H, endedAt: T0 + 9 * H }),
      ],
      now: T0 + 10 * H,
    });
    assert.equal(s.isDurationEstimated, true);
  });

  it('vardiyasız gün — sefer var, vardiya yok', () => {
    const s = calculateDaySummary({
      rides: [ride(300, 60)],
      expenses: [], fuelLogs: [], shifts: [],
      now: T0,
    });
    assert.equal(s.profit.cashProfit, k(240));
    assert.equal(s.durationMinutes, 0);
    assert.equal(s.distanceKm, null);
    assert.equal(s.perHour, null);
    assert.equal(s.perKm, null);
    assert.equal(s.perRide, k(240));
  });

  it('boş gün hiçbir yerde patlamaz', () => {
    const s = calculateDaySummary({
      rides: [], expenses: [], fuelLogs: [], now: T0,
    });
    assert.equal(s.profit.revenue, 0);
    assert.equal(s.profit.cashProfit, 0);
    assert.equal(s.profit.trueProfit, 0);
    assert.equal(s.rideCount, 0);
    assert.equal(s.perRide, null);
  });

  it('bahşiş ciroya girer ama komisyona girmez', () => {
    const s = calculateDaySummary({
      rides: [ride(200, 50, 30)],
      expenses: [], fuelLogs: [], now: T0,
    });
    assert.equal(s.profit.revenue, k(230));
    assert.equal(s.profit.commission, k(50));
    assert.equal(s.profit.cashProfit, k(180));
  });

  it('oranların paydası cebe kalan — ciro değil', () => {
    const s = calculateDaySummary({
      rides: [ride(1000, 200)],
      expenses: [], fuelLogs: [{ totalAmountKurus: k(300) }],
      shifts: [shift({ endedAt: T0 + 5 * H, workedMinutes: 300, distanceKm: 100 })],
      now: T0 + 6 * H,
    });
    assert.equal(s.profit.cashProfit, k(500));
    assert.equal(s.perHour, k(100));  // 500 / 5 saat
    assert.equal(s.perKm, k(5));      // 500 / 100 km
  });

  it('dönen her tutar tam sayı kalır', () => {
    const s = calculateDaySummary({
      rides: [ride(187.5, 32.81), ride(99.99, 17.5)],
      expenses: [{ amountKurus: k(13.37) }],
      fuelLogs: [{ totalAmountKurus: k(77.77) }],
      shifts: [shift({ endedAt: T0 + 3 * H, distanceKm: 47.3 })],
      wearPerKmKurus: defaultWearPerKm('owned'),
      fixedShare: k(41.67),
      now: T0 + 4 * H,
    });
    for (const v of Object.values(s.profit)) {
      if (typeof v === 'number') assert.ok(Number.isInteger(v));
    }
    for (const v of [s.perHour, s.perKm, s.perRide]) {
      if (v !== null) assert.ok(Number.isInteger(v));
    }
  });
});

describe('çok araçlı gün', () => {
  it('her vardiyanın yıpranma payı KENDİ aracının oranıyla hesaplanır', () => {
    const s = calculateDaySummary({
      rides: [ride(2000, 0)],
      expenses: [], fuelLogs: [],
      shifts: [
        // Kendi aracı: 200 km × 2,50 ₺ = 500 ₺
        { ...shift({ endedAt: T0 + 5 * H, distanceKm: 200 }),
          wearPerKmKurus: defaultWearPerKm('owned') },
        // Kiralık araç: 150 km × 0 = 0 ₺
        { ...shift({ startedAt: T0 + 7 * H, endedAt: T0 + 11 * H, distanceKm: 150 }),
          wearPerKmKurus: defaultWearPerKm('rented_vehicle') },
      ],
      now: T0 + 12 * H,
    });
    assert.equal(s.distanceKm, 350);
    assert.equal(s.profit.wearShare, k(500));
    // Toplam kilometreye tek oran uygulansaydı 350 × 2,50 = 875 çıkardı
    assert.notEqual(s.profit.wearShare, k(875));
  });

  it('vardiyanın kendi oranı yoksa gün geneli orana düşülür', () => {
    const s = calculateDaySummary({
      rides: [ride(1000, 0)],
      expenses: [], fuelLogs: [],
      shifts: [shift({ endedAt: T0 + 5 * H, distanceKm: 100 })],
      wearPerKmKurus: defaultWearPerKm('owned'),
      now: T0 + 6 * H,
    });
    assert.equal(s.profit.wearShare, k(250));
  });

  it('vardiyanın kendi oranı gün geneli oranı EZER', () => {
    const s = calculateDaySummary({
      rides: [ride(1000, 0)],
      expenses: [], fuelLogs: [],
      shifts: [
        { ...shift({ endedAt: T0 + 5 * H, distanceKm: 100 }),
          wearPerKmKurus: defaultWearPerKm('employer') },
      ],
      wearPerKmKurus: defaultWearPerKm('owned'),
      now: T0 + 6 * H,
    });
    assert.equal(s.profit.wearShare, 0);
  });
});

describe('komisyon vardiya sonunda tek rakam', () => {
  it('vardiyaya yazılan komisyon cebe kalandan düşer', () => {
    const s = calculateDaySummary({
      rides: [ride(1000, 0), ride(500, 0)],   // seferlerde komisyon yok
      expenses: [], fuelLogs: [],
      shifts: [{
        ...shift({ endedAt: T0 + 8 * H, workedMinutes: 480 }),
        commissionKurus: k(340),
      }],
      now: T0 + 9 * H,
    });
    assert.equal(s.profit.revenue, k(1500));
    assert.equal(s.profit.commission, k(340));
    assert.equal(s.profit.cashProfit, k(1160));
  });

  it('komisyon girilmemişse sıfır sayılır, tahmin edilmez', () => {
    const s = calculateDaySummary({
      rides: [ride(1000, 0)],
      expenses: [], fuelLogs: [],
      shifts: [shift({ endedAt: T0 + 5 * H })],
      now: T0 + 6 * H,
    });
    assert.equal(s.profit.commission, 0);
    assert.equal(s.profit.cashProfit, k(1000));
  });

  it('negatif komisyon geliri BÜYÜTMEZ', () => {
    const s = calculateDaySummary({
      rides: [ride(1000, 0)],
      expenses: [], fuelLogs: [],
      shifts: [{ ...shift({ endedAt: T0 + 5 * H }), commissionKurus: k(-500) }],
      now: T0 + 6 * H,
    });
    assert.equal(s.profit.commission, 0);
    assert.equal(s.profit.cashProfit, k(1000));
  });

  it('birden fazla vardiyanın komisyonu toplanır', () => {
    const s = calculateDaySummary({
      rides: [ride(2000, 0)],
      expenses: [], fuelLogs: [],
      shifts: [
        { ...shift({ endedAt: T0 + 4 * H }), commissionKurus: k(200) },
        { ...shift({ startedAt: T0 + 6 * H, endedAt: T0 + 10 * H }), commissionKurus: k(150) },
      ],
      now: T0 + 11 * H,
    });
    assert.equal(s.profit.commission, k(350));
  });

  it('sefer komisyonu ile vardiya komisyonu birlikte toplanır', () => {
    // v1'de sefer komisyonu daima sıfır; kapının açık kaldığını doğruluyoruz
    const s = calculateDaySummary({
      rides: [ride(1000, 50)],
      expenses: [], fuelLogs: [],
      shifts: [{ ...shift({ endedAt: T0 + 5 * H }), commissionKurus: k(100) }],
      now: T0 + 6 * H,
    });
    assert.equal(s.profit.commission, k(150));
  });
});

describe('yakıt tek sayı', () => {
  const gun = (tuketimVar: boolean, odenen = 0) => calculateDaySummary({
    rides: [ride(2000, 0)],
    expenses: [],
    fuelLogs: odenen > 0 ? [{ totalAmountKurus: k(odenen) }] : [],
    shifts: [{
      ...shift({ endedAt: T0 + 8 * H, workedMinutes: 480, distanceKm: 200 }),
      commissionKurus: k(400),
      wearPerKmKurus: defaultWearPerKm('owned'),
      ...(tuketimVar
        ? { fuelConsumptionPer100Km: 7500, fuelPriceKurus: k(50) }
        : {}),
    }],
    now: T0 + 9 * H,
  });

  it('tüketimden hesaplanıyor: 200 km × 7,5 lt × 50 ₺ = 750 ₺', () => {
    const s = gun(true);
    assert.equal(s.profit.fuelPaid, k(750));
    assert.equal(s.fuelVolume, 15000);
  });

  it('tek fark yıpranma: gerçek kâr = cebe kalan − yıpranma', () => {
    const s = gun(true);
    assert.equal(s.profit.cashProfit, k(850));    // 2000 − 400 − 750
    assert.equal(s.profit.wearShare, k(500));     // 200 km × 2,50
    assert.equal(s.profit.trueProfit, k(350));    // 850 − 500
    assert.equal(s.profit.trueProfit, s.profit.cashProfit - s.profit.wearShare);
  });

  it('tüketim girilmemişse kaydedilen dolum kullanılıyor', () => {
    const s = gun(false, 1000);
    assert.equal(s.profit.fuelPaid, k(1000));
    assert.equal(s.fuelVolume, null);
    assert.equal(s.profit.cashProfit, k(600));    // 2000 − 400 − 1000
    assert.equal(s.profit.trueProfit, k(100));    // 600 − 500
  });

  it('tüketim varsa dolum kaydı AYRICA sayılmıyor — iki kez düşülmez', () => {
    const s = gun(true, 1000);
    assert.equal(s.profit.fuelPaid, k(750));      // 1750 değil
    assert.equal(s.profit.cashProfit, k(850));
  });

  it('her vardiya kendi tüketimi ve fiyatıyla hesaplanır', () => {
    const s = calculateDaySummary({
      rides: [ride(3000, 0)],
      expenses: [], fuelLogs: [],
      shifts: [
        { ...shift({ endedAt: T0 + 4 * H, distanceKm: 100 }),
          fuelConsumptionPer100Km: 7500, fuelPriceKurus: k(50) },   // 375 ₺
        { ...shift({ startedAt: T0 + 6 * H, endedAt: T0 + 10 * H, distanceKm: 100 }),
          fuelConsumptionPer100Km: 12000, fuelPriceKurus: k(22) },  // 264 ₺
      ],
      now: T0 + 11 * H,
    });
    assert.equal(s.profit.fuelPaid, k(639));
    assert.equal(s.fuelVolume, 19500);
  });

  it('mesafe yoksa yakıt hesaplanmaz, dolum kaydına düşülür', () => {
    const s = calculateDaySummary({
      rides: [ride(1000, 0)],
      expenses: [], fuelLogs: [{ totalAmountKurus: k(300) }],
      shifts: [{
        ...shift({ endedAt: T0 + 5 * H }),
        fuelConsumptionPer100Km: 7500, fuelPriceKurus: k(50),
      }],
      now: T0 + 6 * H,
    });
    assert.equal(s.fuelVolume, null);
    assert.equal(s.profit.fuelPaid, k(300));
  });
});
