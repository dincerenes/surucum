import { RpcError } from '@/components/rpc-error';
import { Badge, Card, KeyValue, PageHead, Stat } from '@/components/ui';
import { formatDate, formatDateTime, formatInt, formatRelative } from '@/lib/format';
import { requireAdmin } from '@/lib/guard';
import { createClient } from '@/lib/supabase/server';
import type { HealthCheck, HealthSeverity, SystemHealth } from '@/lib/types';

export const dynamic = 'force-dynamic';

const SEVERITY_TONE: Record<HealthSeverity, 'negative' | 'warning' | 'neutral'> = {
  critical: 'negative',
  warning: 'warning',
  info: 'neutral',
};

const SEVERITY_LABEL: Record<HealthSeverity, string> = {
  critical: 'Kritik',
  warning: 'Uyarı',
  info: 'Bilgi',
};

/**
 * Her denetimin ne anlama geldiği ve ne yapılması gerektiği.
 *
 * Sayı tek başına işe yaramaz: "3 sefer" gören yönetici ne yapacağını
 * bilmez. Panelin işi sorunu göstermek değil, eyleme çevirmek.
 */
const REMEDY: Record<string, string> = {
  money_mismatch:
    'Brüt, komisyon ve net ayrı ayrı saklanıyor. Uyuşmazlık, kaydı yazan kodda bir hata olduğunu gösterir — sürücünün raporu yanlış çıkar.',
  negative_ride:
    'Negatif hasılat mümkün değil. Girdi doğrulamasının atlandığı bir yol var demektir.',
  orphan_ride_source:
    'Sürücü kazanç kaynağını silmiş ama seferler ona bağlı kalmış. Raporda "kaynak yok" satırı çıkar.',
  orphan_ride_shift:
    'Sefer, var olmayan bir vardiyaya bağlı. Senkron sırası bozulmuş olabilir: çocuk kayıt ebeveyninden önce gitmiş.',
  orphan_expense_category:
    'Gider, silinmiş bir kategoriye bağlı. Kategori bazlı raporda görünmez.',
  orphan_fuel_vehicle:
    'Yakıt kaydı var olmayan bir araca bağlı. Tüketim hesabı bu aracı bulamaz.',
  orphan_shift_vehicle:
    'Vardiya var olmayan bir araca bağlı. Kilometre ve maliyet dağıtımı bozulur.',
  ride_date_drift:
    'business_date ile gerçek zaman uyuşmuyor. Gün kesme saati hesabı hatalı olabilir — gece vardiyası yanlış güne yazılıyor.',
  future_ride:
    'Gelecek tarihli kayıt. Cihaz saati yanlış ayarlanmış; senkronda son-yazan-kazanır kuralını da bozar.',
  stale_open_shift:
    'Sürücü vardiyayı kapatmayı unutmuş. TL/saat hesabının paydası şişer, kazanç olduğundan düşük görünür.',
  invalid_fuel_log:
    'Hacmi veya birim fiyatı sıfır olan dolum. Tüketim kalibrasyonunu bozar.',
  duplicate_settings:
    'Kullanıcı başına tek ayar satırı olmalı. Birden fazlaysa cihazlar farklı gün kesme saati kullanıyor olabilir.',
  ride_without_vehicle:
    'Araç kaydı olmadan sefer girilmiş. Kilometre başına maliyet hesaplanamaz.',
};

export default async function SistemSagligiPage() {
  await requireAdmin();
  const supabase = await createClient();

  const { data, error } = await supabase.rpc('admin_system_health');

  if (error) {
    return (
      <>
        <PageHead title="Sistem sağlığı" />
        <RpcError error={error} />
      </>
    );
  }

  const h = data as SystemHealth;
  const checks = h.checks;
  const failing = checks.filter((c) => c.count > 0);
  const critical = failing.filter((c) => c.severity === 'critical');

  const fuelStale = (h.fuel_prices.hours_since_fetch ?? Infinity) > 36;

  return (
    <>
      <PageHead
        title="Sistem sağlığı"
        sub={`${formatDateTime(h.generated_at)} itibarıyla · ${checks.length} denetim`}
      />

      {failing.length === 0 ? (
        <div className="notice notice-positive">
          Tüm bütünlük denetimleri temiz. Veri katmanında bilinen bir sorun yok.
        </div>
      ) : (
        <div className={`notice ${critical.length > 0 ? 'notice-critical' : 'notice-warning'}`}>
          <strong>
            {formatInt(failing.length)} denetim bulgu üretti
            {critical.length > 0 ? `, ${formatInt(critical.length)} tanesi kritik` : ''}.
          </strong>
        </div>
      )}

      <section className="section">
        <div className="grid grid-4">
          <Stat title="Son 24 saat — sefer" value={formatInt(h.volumes.rides_24h)} />
          <Stat title="Son 24 saat — vardiya" value={formatInt(h.volumes.shifts_24h)} />
          <Stat title="Son 24 saat — gider + yakıt"
                value={formatInt(h.volumes.expenses_24h + h.volumes.fuel_logs_24h)} />
          <Stat title="Yumuşak silinmiş kayıt" value={formatInt(h.volumes.soft_deleted)} />
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Bütünlük denetimleri</h2>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Denetim</th>
                <th className="right">Kayıt</th>
                <th>Önem</th>
                <th>Örnek kimlikler</th>
              </tr>
            </thead>
            <tbody>
              {[...checks]
                .sort((a, b) => Number(b.count > 0) - Number(a.count > 0) || b.count - a.count)
                .map((c) => <CheckRow key={c.key} check={c} />)}
            </tbody>
          </table>
        </div>
      </section>

      <section className="section">
        <h2 className="section-title">Yakıt fiyatı beslemesi</h2>
        <div className="grid grid-2">
          <Card title="Durum">
            <KeyValue
              rows={[
                ['Bölge sayısı', formatInt(h.fuel_prices.regions)],
                ['Fiyat satırı', formatInt(h.fuel_prices.rows)],
                ['En güncel tarih', h.fuel_prices.latest_effective_date
                  ? formatDate(h.fuel_prices.latest_effective_date) : '—'],
                ['Son çekim', formatRelative(h.fuel_prices.last_fetched_at)],
                ['Bayat kombinasyon', formatInt(h.fuel_prices.stale_combinations)],
              ]}
            />
          </Card>

          <Card title="Değerlendirme">
            {h.fuel_prices.rows === 0 ? (
              <div className="notice notice-warning">
                Hiç yakıt fiyatı yok. Çevrimdışı maliyet tahmini son bilinen
                fiyata dayanıyor — o da yoksa sürücü tahmini göremez.
                Fiyatları <a href="/yakit-fiyatlari">elle girebilirsiniz</a>.
              </div>
            ) : fuelStale ? (
              <div className="notice notice-warning">
                Son çekim 36 saatten eski. Zamanlanmış iş çalışmıyor olabilir;
                fiyat beslemesi günde iki kez çalışacak şekilde tasarlanmıştı.
              </div>
            ) : (
              <div className="notice notice-positive">
                Besleme güncel. Son çekimin üzerinden{' '}
                {h.fuel_prices.hours_since_fetch?.toString().replace('.', ',')} saat geçti.
              </div>
            )}
          </Card>
        </div>
      </section>
    </>
  );
}

function CheckRow({ check }: { check: HealthCheck }) {
  const clean = check.count === 0;

  return (
    <tr>
      <td style={{ maxWidth: 420, whiteSpace: 'normal' }}>
        <div style={{ fontWeight: 600 }}>{check.label}</div>
        {!clean && REMEDY[check.key] ? (
          <div style={{ color: 'var(--text-soft)', marginTop: 3 }}>{REMEDY[check.key]}</div>
        ) : null}
        <div className="mono" style={{ color: 'var(--text-faint)', marginTop: 3 }}>{check.key}</div>
      </td>
      <td className="right num" style={{ fontWeight: 700 }}>
        {clean ? <span style={{ color: 'var(--positive)' }}>0</span> : formatInt(check.count)}
      </td>
      <td>
        {clean
          ? <Badge tone="positive">Temiz</Badge>
          : <Badge tone={SEVERITY_TONE[check.severity]}>{SEVERITY_LABEL[check.severity]}</Badge>}
      </td>
      <td className="mono" style={{ color: 'var(--text-faint)', whiteSpace: 'normal', maxWidth: 300 }}>
        {clean ? '—' : check.samples.join(', ')}
      </td>
    </tr>
  );
}
