/**
 * Senkronun GERÇEK ağ yolunu uçtan uca sınar.
 *
 * GEÇİCİ. Faz 2'nin gerçek ekranları geldiğinde silinecek.
 *
 * Oturum açılmış hesabın KENDİ kimliğiyle çalışır — sahte kullanıcıyla
 * çalışamaz, RLS reddeder. Bu yüzden ürettiği kayıtlar gerçek hesabın
 * bulut verisine yazılıyor ve SONUNDA HER İKİ TARAFTAN DA SİLİNİYOR.
 */

import { eq, like } from 'drizzle-orm';
import { getDb } from '@/db/client';
import { earningSources, outbox, rides, shifts, vehicles } from '@/db/schema';
import { addRide, createEarningSource, createVehicle, endShift, startShift } from '@/db/repo';
import { getSupabase } from '@/lib/supabase';
import { asKurus, percentToBps } from '@/lib/money';
import { getPullCursor, resetPullCursor } from './state';
import { pendingCount } from './push';
import { runSync } from './worker';

export interface SyncCheck { label: string; ok: boolean; detail: string }

/** Sınama kayıtlarını ayırt eden işaret — temizlik buna göre yapılıyor. */
const MARK = 'SENKRON_SINAMASI';

export async function runSyncSmoke(): Promise<SyncCheck[]> {
  const checks: SyncCheck[] = [];
  const add = (label: string, ok: boolean, detail: string) =>
    checks.push({ label, ok, detail });

  const supabase = getSupabase();
  if (!supabase) {
    add('Bulut yapılandırılmamış', false, 'senkron sınanamıyor');
    return checks;
  }

  const { data: sessionData } = await supabase.auth.getSession();
  const userId = sessionData.session?.user.id;
  if (!userId) {
    add('Oturum yok', false, 'giriş yapılmadan senkron sınanamıyor');
    return checks;
  }
  add('Oturum bulundu', true, userId.slice(0, 8) + '…');

  try {
    await purge(supabase, userId);

    // --- 1. Yerel kayıt üret --------------------------------------------
    const now = Date.now();
    const vehicle = createVehicle(userId, {
      label: `${MARK} aracı`, ownership: 'owned', fuelTypes: ['gasoline'],
    }, now);
    const source = createEarningSource(userId, {
      name: `${MARK} kaynağı`, defaultCommissionBps: percentToBps(20),
    }, now);
    const shift = startShift(userId, vehicle.id, 4, now);
    const ride = addRide(userId, {
      earningSourceId: source.id, shiftId: shift.id, vehicleId: vehicle.id,
      grossAmountKurus: asKurus(24000),
    }, 4, now + 1000);
    endShift(shift.id, { distanceKm: 120, workedMinutes: 300 }, now + 2000);

    const queuedBefore = pendingCount();
    add('Kayıtlar kuyruğa girdi', queuedBefore >= 5, `${queuedBefore} kayıt`);

    // --- 2. Gönder -------------------------------------------------------
    const first = await runSync();
    add('Senkron çalıştı', first.ran && first.errors.length === 0,
      first.errors.join(' · ') || `${first.push?.sent ?? 0} gönderildi`);
    add('Kuyruk boşaldı', pendingCount() === 0, `${pendingCount()} kayıt kaldı`);

    // --- 3. Bulutta gerçekten var mı ------------------------------------
    const cloudRide = await supabase.from('rides')
      .select('gross_amount_kurus, commission_kurus, net_amount_kurus, commission_bps, business_date')
      .eq('id', ride.id).single();
    add('Sefer buluta ulaştı', !cloudRide.error && cloudRide.data != null,
      cloudRide.error?.message ?? 'bulundu');
    add('Kuruş tutarları bozulmadan gitti',
      cloudRide.data?.gross_amount_kurus === 24000
      && cloudRide.data?.commission_kurus === 4800
      && cloudRide.data?.net_amount_kurus === 19200,
      `${cloudRide.data?.gross_amount_kurus} / ${cloudRide.data?.commission_kurus} / ${cloudRide.data?.net_amount_kurus}`);

    const cloudShift = await supabase.from('shifts')
      .select('distance_km, worked_minutes').eq('id', shift.id).single();
    add('Yeni sütunlar gitti (0002)',
      cloudShift.data?.distance_km === 120 && cloudShift.data?.worked_minutes === 300,
      `${cloudShift.data?.distance_km} km · ${cloudShift.data?.worked_minutes} dk`);

    const cloudVehicle = await supabase.from('vehicles')
      .select('is_active, wear_per_km_kurus, label').eq('id', vehicle.id).single();
    add('Boolean çevrimi doğru — 1 değil true gitti',
      cloudVehicle.data?.is_active === true,
      `is_active = ${JSON.stringify(cloudVehicle.data?.is_active)}`);
    add('Yıpranma payı gitti (0001)',
      cloudVehicle.data?.wear_per_km_kurus === 300,
      `${cloudVehicle.data?.wear_per_km_kurus} kuruş/km`);

    // vehicle_fuel_types — 0003'te adı düzeltilen sütunun tablosu
    const cloudFuel = await supabase.from('vehicle_fuel_types')
      .select('fuel_type, is_primary, avg_consumption_per_100km')
      .eq('vehicle_id', vehicle.id);
    add('Sütun adı düzeltilen tablo senkronlandı (0003)',
      !cloudFuel.error && (cloudFuel.data?.length ?? 0) === 1,
      cloudFuel.error?.message ?? `${cloudFuel.data?.length} satır`);

    // --- 4. İmleç ilerledi mi -------------------------------------------
    const cursor = getPullCursor();
    add('Çekme imleci ilerledi', cursor > '1970-01-02', cursor.slice(0, 19));

    // --- 5. Bayat yazma reddi -------------------------------------------
    /**
     * Yerel satırın `updated_at`'ini GERİYE alıp gönderiyoruz. Sunucudaki
     * tetikleyici bunu reddetmeli — etiket değişmemeli. Reddetmezse
     * eski bir cihaz, yeni düzeltmeyi sessizce ezebilir demektir.
     */
    getDb().$client.runSync(
      `UPDATE vehicles SET label = ?, updated_at = ? WHERE id = ?`,
      [`${MARK} BAYAT`, now - 60_000, vehicle.id],
    );
    getDb().insert(outbox).values({
      tableName: 'vehicles', rowId: vehicle.id, operation: 'upsert',
      createdAt: Date.now(), attemptCount: 0,
    }).onConflictDoUpdate({
      target: [outbox.tableName, outbox.rowId],
      set: { operation: 'upsert', attemptCount: 0, nextAttemptAt: null },
    }).run();

    await runSync();
    const afterStale = await supabase.from('vehicles')
      .select('label').eq('id', vehicle.id).single();
    add('Bayat yazma sunucuda reddedildi',
      afterStale.data?.label === `${MARK} aracı`,
      `bulut etiketi: ${afterStale.data?.label}`);

    // --- 6. Geri çekme ---------------------------------------------------
    /**
     * Yerel satırı KUYRUĞA DÜŞÜRMEDEN yok edip imleci sıfırlıyoruz.
     * Cihaz değiştirme senaryosunun küçük hâli: kayıt buluttan geri
     * inmeli.
     */
    getDb().$client.runSync(`DELETE FROM rides WHERE id = ?`, [ride.id]);
    const goneLocally = getDb().select().from(rides).where(eq(rides.id, ride.id)).get();
    add('Sefer yerelden silindi', goneLocally === undefined, 'hazırlık');

    resetPullCursor();
    const second = await runSync();
    const restored = getDb().select().from(rides).where(eq(rides.id, ride.id)).get();
    add('Sefer buluttan geri indi',
      restored !== undefined && restored.grossAmountKurus === 24000,
      restored ? `brüt ${restored.grossAmountKurus} kuruş` : 'inmedi');
    add('Geri inen kayıt kuyruğa DÜŞMEDİ', pendingCount() === 0,
      `${pendingCount()} kayıt — sonsuz gidiş-geliş yok`);
    add('İkinci tur hatasız', second.errors.length === 0,
      second.errors.join(' · ') || `${second.pull?.applied ?? 0} satır uygulandı`);
  } catch (error) {
    add('ÇALIŞMA HATASI', false, String(error));
  } finally {
    const left = await purge(supabase, userId);
    add('Sınama verisi iki taraftan da silindi', left === 0, `${left} kalıntı`);
  }

  return checks;
}

/**
 * Sınama kayıtlarını hem cihazdan hem buluttan SERT SİLER.
 *
 * Sert silme burada meşru: bu satırlar sınama için üretildi, gerçek
 * kullanıcının verisi değil ve hesabında kalmamalı. Silme sırası
 * çocuktan ebeveyne — bir gün yabancı anahtar eklenirse çalışsın.
 */
async function purge(
  supabase: ReturnType<typeof getSupabase>, userId: string,
): Promise<number> {
  if (!supabase) return 0;
  const db = getDb();

  const vehicleIds = db.select({ id: vehicles.id }).from(vehicles)
    .where(like(vehicles.label, `${MARK}%`)).all().map((r) => r.id);
  const sourceIds = db.select({ id: earningSources.id }).from(earningSources)
    .where(like(earningSources.name, `${MARK}%`)).all().map((r) => r.id);
  const shiftIds = vehicleIds.length
    ? db.select({ id: shifts.id, vehicleId: shifts.vehicleId }).from(shifts).all()
        .filter((s) => vehicleIds.includes(s.vehicleId)).map((s) => s.id)
    : [];
  const rideIds = sourceIds.length
    ? db.select({ id: rides.id, sourceId: rides.earningSourceId }).from(rides).all()
        .filter((r) => sourceIds.includes(r.sourceId)).map((r) => r.id)
    : [];

  for (const [table, ids] of [
    ['rides', rideIds], ['shifts', shiftIds],
    ['earning_sources', sourceIds], ['vehicles', vehicleIds],
  ] as const) {
    if (ids.length === 0) continue;
    await supabase.from(table).delete().in('id', ids);
    const list = ids.map(() => '?').join(',');
    db.$client.runSync(`DELETE FROM "${table}" WHERE id IN (${list})`, ids);
    db.$client.runSync(
      `DELETE FROM outbox WHERE row_id IN (${list})`, ids,
    );
  }

  // Yakıt tipleri araca bağlı, ayrıca temizleniyor.
  if (vehicleIds.length > 0) {
    const list = vehicleIds.map(() => '?').join(',');
    await supabase.from('vehicle_fuel_types').delete().in('vehicle_id', vehicleIds);
    db.$client.runSync(
      `DELETE FROM outbox WHERE row_id IN (SELECT id FROM vehicle_fuel_types WHERE vehicle_id IN (${list}))`,
      vehicleIds,
    );
    db.$client.runSync(
      `DELETE FROM vehicle_fuel_types WHERE vehicle_id IN (${list})`, vehicleIds,
    );
  }

  const remaining = await supabase.from('vehicles')
    .select('id').eq('user_id', userId).like('label', `${MARK}%`);
  return remaining.data?.length ?? 0;
}
