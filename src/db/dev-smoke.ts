/**
 * Veri katmanının gerçek cihazda uçtan uca sınanması.
 *
 * GEÇİCİ. Faz 2'nin gerçek ekranları geldiğinde bu dosya silinecek.
 * Şu anki işi: repo katmanının ürettiği SQL'in Hermes + expo-sqlite
 * üzerinde gerçekten koştuğunu göstermek. Tip denetimi bunu göstermez —
 * yanlış sütun adı, bozuk join ve başarısız işlem ancak çalışınca çıkar.
 *
 * Kendi verisini `SMOKE_USER_ID` altında yazar ve sonunda SERT SİLER.
 * Sert silme yalnızca burada meşru: bu satırlar cihazdan hiç çıkmadı,
 * senkronlanmadı ve gerçek bir kullanıcıya ait değil.
 */

import { eq, inArray } from 'drizzle-orm';
import { getDb } from './client';
import {
  earningSources, expenseCategories, expenses, fuelLogs, outbox, rides,
  shifts, appSettings, vehicleFuelTypes, vehicles,
} from './schema';
import {
  addExpense, addFuelLog, addRide, createEarningSource, createVehicle,
  endShift, ensureSettings, getDaySummary, getOpenShift, listRidesInShift,
  seedSystemCategories, startShift,
} from './repo';
import { asKurus, formatKurus, percentToBps } from '@/lib/money';
import { toBusinessDate } from '@/lib/business-date';

/** Gerçek bir kullanıcı kimliğiyle asla çakışmayacak sabit. */
const SMOKE_USER_ID = '__smoke__';

export interface SmokeCheck {
  label: string;
  ok: boolean;
  detail: string;
}

export function runDataLayerSmoke(): SmokeCheck[] {
  const checks: SmokeCheck[] = [];
  const now = Date.now();
  const record = (label: string, ok: boolean, detail: string) => {
    checks.push({ label, ok, detail });
  };

  try {
    cleanup();

    // --- Kurulum -----------------------------------------------------------
    const settings = ensureSettings(SMOKE_USER_ID, now);
    record('Ayar satırı', settings.dayCutoffHour === 4,
      `kesme saati ${settings.dayCutoffHour}:00`);

    const categories = seedSystemCategories(SMOKE_USER_ID, now);
    const hasFuelCategory = categories.some((c) => c.name === 'Yakıt');
    record('Gider kategorileri', categories.length > 0 && !hasFuelCategory,
      `${categories.length} kategori, "Yakıt" yok (çift sayım kapalı)`);

    const vehicle = createVehicle(SMOKE_USER_ID, {
      label: 'Sınama aracı', ownership: 'rented_plate',
      fuelTypes: ['gasoline', 'lpg'],
    }, now);
    record('Araç + yıpranma payı', vehicle.wearPerKmKurus === 300,
      `kiralık plaka → ${vehicle.wearPerKmKurus} kuruş/km`);

    const fuelRows = getDb().select().from(vehicleFuelTypes)
      .where(eq(vehicleFuelTypes.vehicleId, vehicle.id)).all();
    record('Çift yakıt', fuelRows.length === 2 && fuelRows[0].isPrimary,
      `${fuelRows.length} yakıt tipi, ilki birincil`);

    const source = createEarningSource(SMOKE_USER_ID, {
      name: 'Uygulama 1', defaultCommissionBps: percentToBps(20),
    }, now);
    record('Kazanç kaynağı', source.defaultCommissionBps === 2000,
      `%${source.defaultCommissionBps / 100} komisyon`);

    // --- Günlük döngü ------------------------------------------------------
    const shift = startShift(SMOKE_USER_ID, vehicle.id, 4, now);
    const again = startShift(SMOKE_USER_ID, vehicle.id, 4, now + 1000);
    record('Vardiya tek açılır', shift.id === again.id,
      'ikinci basış yeni vardiya açmadı');

    const ride1 = addRide(SMOKE_USER_ID, {
      earningSourceId: source.id, shiftId: shift.id, vehicleId: vehicle.id,
      grossAmountKurus: asKurus(24000),
    }, 4, now + 2000);
    record('Sefer — oran kaynaktan okundu',
      ride1.commissionKurus === 4800 && ride1.netAmountKurus === 19200,
      `brüt 240,00 → komisyon ${formatKurus(ride1.commissionKurus)} → net ${formatKurus(ride1.netAmountKurus)}`);

    addRide(SMOKE_USER_ID, {
      earningSourceId: source.id, shiftId: shift.id, vehicleId: vehicle.id,
      grossAmountKurus: asKurus(18750), tipKurus: asKurus(2000),
    }, 4, now + 3000);

    const ride3 = addRide(SMOKE_USER_ID, {
      earningSourceId: source.id, shiftId: shift.id, vehicleId: vehicle.id,
      grossAmountKurus: asKurus(52000), commissionOverrideKurus: asKurus(13000),
    }, 4, now + 4000);
    record('Girilen kesinti oranı ezdi',
      ride3.commissionKurus === 13000 && ride3.commissionBps === 2500,
      `13.000 kuruş kesinti → geriye hesaplanan oran %25`);

    addExpense(SMOKE_USER_ID, {
      categoryId: categories[0].id, amountKurus: asKurus(15000),
    }, 4, now + 5000);

    addFuelLog(SMOKE_USER_ID, {
      vehicleId: vehicle.id, fuelType: 'gasoline',
      volumePer1000: 21400, unitPriceKurus: asKurus(2430),
      totalAmountKurus: asKurus(52002), odometerKm: 184320, isFullTank: true,
    }, 4, now + 6000);

    const priceRow = getDb().select().from(vehicleFuelTypes)
      .where(eq(vehicleFuelTypes.id, fuelRows[0].id)).get();
    record('Son yakıt fiyatı araca yazıldı',
      priceRow?.lastUnitPriceKurus === 2430,
      `${formatKurus(asKurus(priceRow?.lastUnitPriceKurus ?? 0))}/lt`);

    const inShift = listRidesInShift(shift.id);
    record('Vardiyanın seferleri', inShift.length === 3,
      `${inShift.length} sefer bağlı`);

    endShift(shift.id, { distanceKm: 238, workedMinutes: 462 }, now + 7000);
    record('Vardiya kapandı', getOpenShift(SMOKE_USER_ID) === undefined,
      'açık vardiya kalmadı');

    // --- Üç satır ----------------------------------------------------------
    const date = toBusinessDate(now, 4);
    const summary = getDaySummary(SMOKE_USER_ID, date, now + 8000);

    // ciro 240,00 + 187,50 + 520,00 + 20,00 bahşiş = 967,50
    // komisyon 48,00 + 37,50 + 130,00 = 215,50
    // yakıt 520,02 · gider 150,00 → cebe kalan 82,  yıpranma 238 × 3,00 = 714,00
    record('Ciro', summary.profit.revenue === 96750,
      formatKurus(summary.profit.revenue));
    record('Komisyon', summary.profit.commission === 21550,
      formatKurus(summary.profit.commission));
    record('Cebe kalan', summary.profit.cashProfit === 96750 - 21550 - 52002 - 15000,
      formatKurus(summary.profit.cashProfit));
    record('Yıpranma — aracın kendi oranıyla', summary.profit.wearShare === 71400,
      `238 km × 3,00 ₺ = ${formatKurus(summary.profit.wearShare)}`);
    record('Gerçek kâr negatif olabiliyor', summary.profit.trueProfit < 0,
      formatKurus(summary.profit.trueProfit));
    record('Süre sürücünün yazdığı', !summary.isDurationEstimated,
      `${summary.durationMinutes} dk`);
    record('TL/saat cebe kalan üzerinden',
      summary.perHour !== null && summary.perKm !== null,
      `${formatKurus(summary.perHour ?? 0)}/saat · ${formatKurus(summary.perKm ?? 0)}/km`);

    // --- Senkron kuyruğu ---------------------------------------------------
    const queued = getDb().select().from(outbox).all();
    const uniqueRows = new Set(queued.map((q) => `${q.tableName}:${q.rowId}`));
    record('Her yazma kuyruğa düştü', queued.length > 0,
      `${queued.length} kayıt, ${uniqueRows.size} benzersiz satır`);
    record('Aynı satır kuyrukta tek kez', queued.length === uniqueRows.size,
      'tekrar düzenlemeler çakışmadı');

    const allInteger = [
      summary.profit.revenue, summary.profit.commission, summary.profit.cashProfit,
      summary.profit.wearShare, summary.profit.trueProfit,
    ].every(Number.isInteger);
    record('Hermes\'te tutarlar tam sayı', allInteger, 'kayan nokta yok');
  } catch (error) {
    record('ÇALIŞMA HATASI', false, String(error));
  } finally {
    cleanup();
  }

  return checks;
}

/**
 * Sınama verisini SERT SİLER — yalnızca kendi ürettiği satırları.
 *
 * Kuyruk temizliği KİMLİĞE GÖRE yapılıyor, toptan değil: `outbox` satırı
 * kullanıcı taşımıyor, dolayısıyla "hepsini sil" demek gerçek kullanıcının
 * bekleyen senkron kuyruğunu yok etmek olurdu — o kayıtlar buluta hiç
 * gitmez ve kimse fark etmez.
 *
 * Yumuşak silme de burada yanlış: satırlar tabloda kalır, veritabanını
 * şişirir ve bir sonraki sınama "zaten kayıt var" diye erken çıkar.
 */
function cleanup(): void {
  const db = getDb();
  const tables = [
    rides, shifts, expenses, fuelLogs, expenseCategories,
    earningSources, vehicleFuelTypes, vehicles, appSettings,
  ];

  // Silinecek satırların kimlikleri — kuyruktan yalnızca bunlar çıkacak.
  const ids: string[] = [];
  for (const table of tables) {
    const rows = db.select({ id: (table as any).id }).from(table as any)
      .where(eq((table as any).userId, SMOKE_USER_ID)).all() as { id: string }[];
    ids.push(...rows.map((r) => r.id));
  }

  db.transaction((tx) => {
    for (const table of tables) {
      tx.delete(table as any).where(eq((table as any).userId, SMOKE_USER_ID)).run();
    }
    if (ids.length > 0) {
      tx.delete(outbox).where(inArray(outbox.rowId, ids)).run();
    }
  });
}
