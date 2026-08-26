import { Flash } from '@/components/flash';
import { RpcError } from '@/components/rpc-error';
import { Badge, Card, Empty, PageHead } from '@/components/ui';
import {
  FUEL_TYPE_LABELS, FUEL_UNIT_LABELS, formatDate, formatKurus, formatRelative,
} from '@/lib/format';
import { canWrite, requireAdmin } from '@/lib/guard';
import { createClient } from '@/lib/supabase/server';
import type { FuelPrice } from '@/lib/types';

import { deleteFuelPrice, upsertFuelPrice } from './actions';

export const dynamic = 'force-dynamic';

const FUEL_TYPES = ['gasoline', 'diesel', 'lpg', 'cng', 'electric'] as const;

// Ülke geneli + il plaka kodları. Sürücü ayarlarındaki region_code ile
// aynı alfabe: orada da 'TR' veya iki haneli plaka kodu tutuluyor.
const REGIONS = ['TR', ...Array.from({ length: 81 }, (_, i) => String(i + 1).padStart(2, '0'))];

export default async function YakitFiyatlariPage({
  searchParams,
}: {
  searchParams: Promise<{ sonuc?: string; hata?: string }>;
}) {
  const session = await requireAdmin();
  const { sonuc, hata } = await searchParams;
  const editable = canWrite(session.role);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from('fuel_prices')
    .select('*')
    .order('effective_date', { ascending: false })
    .order('region_code')
    .limit(300);

  const prices = (data ?? []) as FuelPrice[];

  // Her bölge+yakıt için yalnızca en güncel satır "yürürlükte" sayılır.
  // Liste tarihe göre sıralı geldiği için ilk görülen o kombinasyonun
  // en günceli oluyor.
  const seen = new Set<string>();
  const current: FuelPrice[] = [];
  const history: FuelPrice[] = [];
  for (const p of prices) {
    const key = `${p.region_code}|${p.fuel_type}`;
    if (seen.has(key)) history.push(p);
    else { seen.add(key); current.push(p); }
  }

  const today = new Date().toISOString().slice(0, 10);

  return (
    <>
      <PageHead
        title="Yakıt fiyatları"
        sub="Sürücüye çevrimdışı maliyet tahmini için inen ortak referans veri"
      />

      <Flash ok={sonuc} error={hata} />
      <RpcError error={error} />

      {editable ? (
        <Card title="Fiyat ekle veya güncelle">
          <form action={upsertFuelPrice} className="row">
            <div className="field" style={{ flex: '0 0 120px' }}>
              <label className="label" htmlFor="region_code">Bölge</label>
              <select id="region_code" name="region_code" defaultValue="TR" required>
                {REGIONS.map((r) => (
                  <option key={r} value={r}>{r === 'TR' ? 'TR (genel)' : r}</option>
                ))}
              </select>
            </div>

            <div className="field" style={{ flex: '0 0 150px' }}>
              <label className="label" htmlFor="fuel_type">Yakıt</label>
              <select id="fuel_type" name="fuel_type" defaultValue="gasoline" required>
                {FUEL_TYPES.map((f) => (
                  <option key={f} value={f}>{FUEL_TYPE_LABELS[f]}</option>
                ))}
              </select>
            </div>

            <div className="field" style={{ flex: '0 0 150px' }}>
              <label className="label" htmlFor="unit_price">Birim fiyat (₺)</label>
              <input id="unit_price" name="unit_price" type="text" inputMode="decimal"
                     placeholder="48,99" required />
            </div>

            <div className="field" style={{ flex: '0 0 170px' }}>
              <label className="label" htmlFor="effective_date">Geçerlilik tarihi</label>
              <input id="effective_date" name="effective_date" type="date"
                     defaultValue={today} required />
            </div>

            <button className="btn" type="submit">Kaydet</button>
          </form>

          <p className="page-sub" style={{ marginTop: 10 }}>
            Aynı bölge, yakıt ve tarih için kayıt varsa üzerine yazılır.
            Fiyat kuruş olarak saklanır: 48,99 ₺ → 4899.
          </p>
        </Card>
      ) : (
        <div className="notice notice-warning">
          Destek rolü fiyat düzenleyemez.
        </div>
      )}

      <section className="section">
        <h2 className="section-title">Yürürlükteki fiyatlar</h2>
        <PriceTable rows={current} editable={editable} showDelete />
      </section>

      {history.length > 0 ? (
        <section className="section">
          <h2 className="section-title">Geçmiş kayıtlar</h2>
          <PriceTable rows={history} editable={editable} showDelete />
        </section>
      ) : null}
    </>
  );
}

function PriceTable({
  rows, editable, showDelete,
}: {
  rows: FuelPrice[];
  editable: boolean;
  showDelete?: boolean;
}) {
  if (rows.length === 0) {
    return (
      <div className="table-wrap">
        <Empty>Kayıt yok.</Empty>
      </div>
    );
  }

  return (
    <div className="table-wrap">
      <table>
        <thead>
          <tr>
            <th>Bölge</th>
            <th>Yakıt</th>
            <th className="right">Birim fiyat</th>
            <th>Geçerlilik</th>
            <th>Kaynak</th>
            <th>Çekim</th>
            {editable && showDelete ? <th /> : null}
          </tr>
        </thead>
        <tbody>
          {rows.map((p) => (
            <tr key={p.id}>
              <td className="mono">{p.region_code}</td>
              <td>{FUEL_TYPE_LABELS[p.fuel_type] ?? p.fuel_type}</td>
              <td className="right num nowrap">
                {formatKurus(p.unit_price_kurus)} / {FUEL_UNIT_LABELS[p.fuel_type] ?? 'br'}
              </td>
              <td className="nowrap">{formatDate(p.effective_date)}</td>
              <td>
                <Badge tone={p.source === 'panel' ? 'accent' : 'neutral'}>{p.source}</Badge>
              </td>
              <td className="nowrap">{formatRelative(new Date(p.fetched_at).toISOString())}</td>
              {editable && showDelete ? (
                <td className="right">
                  <form action={deleteFuelPrice}>
                    <input type="hidden" name="id" value={p.id} />
                    <button className="btn btn-danger btn-sm" type="submit">Sil</button>
                  </form>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
