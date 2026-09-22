import assert from 'node:assert/strict';
import { describe, it } from 'node:test';

import type { BusinessDate } from './business-date.ts';
import type { DaySummary } from './day-summary.ts';
import { barRatio, lastDays, monthlyAverages } from './home.ts';
import type { Kurus } from './money.ts';
import { type DayEntry, type PeriodTotals, calculatePeriodTotals } from './stats.ts';

const d = (s: string) => s as BusinessDate;
const k = (n: number) => n as Kurus;

function day(date: string, cashProfit: number, extra: Partial<DaySummary> = {}): DayEntry {
  return {
    date: d(date),
    summary: {
      hasActivity: true,
      isWorkedDay: true,
      profit: { cashProfit: k(cashProfit) },
      ...extra,
    } as DaySummary,
  };
}

describe('son 7 gün', () => {
  it('kaydı olmayan gün boş çubuk, bugün en sağda', () => {
    const bars = lastDays([day('2026-09-23', 1000), day('2026-09-20', 500)], d('2026-09-23'));
    assert.equal(bars.length, 7);
    assert.equal(bars[0].date, '2026-09-17');
    assert.equal(bars[6].date, '2026-09-23');
    assert.equal(bars[6].isToday, true);
    assert.equal(bars[6].cashProfit, 1000);
    assert.equal(bars[3].cashProfit, 500);
    assert.equal(bars[4].cashProfit, null);
  });

  it('çubuk oranı en iyi güne göre, zarar sıfır', () => {
    const bars = lastDays([day('2026-09-23', 1000), day('2026-09-22', -300), day('2026-09-21', 500)], d('2026-09-23'));
    assert.equal(barRatio(k(1000), bars), 1);
    assert.equal(barRatio(k(500), bars), 0.5);
    assert.equal(barRatio(k(-300), bars), 0);
    assert.equal(barRatio(null, bars), 0);
  });
});

describe('aylık ortalama', () => {
  const base = calculatePeriodTotals([]);

  it('çalışılmış gün yoksa hepsi boş', () => {
    const a = monthlyAverages(base);
    assert.equal(a.perDay, null);
    assert.equal(a.ridesPerDay, null);
    assert.equal(a.kmPerDay, null);
    assert.equal(a.minutesPerDay, null);
  });

  it('km ortalaması yalnızca km girilen günlerden', () => {
    const t: PeriodTotals = {
      ...base, workedDayCount: 4, rideCount: 50, durationMinutes: 4 * 600,
      distanceKm: 600, distanceDayCount: 2,
    };
    const a = monthlyAverages(t);
    assert.equal(a.ridesPerDay, 12.5);
    assert.equal(a.kmPerDay, 300);
    assert.equal(a.minutesPerDay, 600);
  });
});
