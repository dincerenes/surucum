import { BarChart, Card, KeyValue, PageHead, Stat } from '@/components/ui';
import { RpcError } from '@/components/rpc-error';
import {
  formatDateTime, formatDayMonth, formatInt, formatKurus, formatKurusCompact, formatRelative,
} from '@/lib/format';
import { requireAdmin } from '@/lib/guard';
import { createClient } from '@/lib/supabase/server';
import type { AdminOverview, GrowthPoint } from '@/lib/types';

export const dynamic = 'force-dynamic';

export default async function GenelBakisPage() {
  await requireAdmin();
  const supabase = await createClient();

  const [overviewRes, growthRes] = await Promise.all([
    supabase.rpc('admin_overview'),
    supabase.rpc('admin_growth', { p_days: 30 }),
  ]);

  if (overviewRes.error) {
    return (
      <>
        <PageHead title="Genel bakış" />
        <RpcError error={overviewRes.error} />
      </>
    );
  }

  const o = overviewRes.data as AdminOverview;
  const growth = (growthRes.data ?? []) as GrowthPoint[];

  // Komisyon, sürücünün kazancından kesilen pay. Uygulamanın geliri değil —
  // panelde bir gelir kalemi gibi görünmemesi için oran olarak veriliyor.
  const commissionRate =
    o.money.gross_kurus > 0 ? (o.money.commission_kurus / o.money.gross_kurus) * 100 : 0;

  return (
    <>
      <PageHead
        title="Genel bakış"
        sub={`${formatDateTime(o.generated_at)} itibarıyla`}
      />

      <div className="grid grid-4">
        <Stat
          title="Toplam kullanıcı"
          value={formatInt(o.users.total)}
          note={`son 7 günde +${formatInt(o.users.new_7d)} · ${formatInt(o.users.confirmed)} doğrulanmış`}
        />
        <Stat
          title="Günlük aktif"
          value={formatInt(o.activity.dau)}
          note={`haftalık ${formatInt(o.activity.wau)} · aylık ${formatInt(o.activity.mau)}`}
        />
        <Stat
          title="Toplam sefer"
          value={formatInt(o.records.rides)}
          note={`${formatInt(o.records.shifts)} vardiya · ${formatInt(o.records.vehicles)} araç`}
        />
        <Stat
          title="Son 24 saatte senkron"
          value={formatInt(o.sync.rows_24h)}
          note={`son yazma ${formatRelative(o.sync.last_write_at)}`}
          tone={o.sync.rows_24h === 0 ? 'warning' : undefined}
        />
      </div>

      {o.sync.rows_24h === 0 && o.users.total > 0 ? (
        <div className="notice notice-warning section">
          Son 24 saatte buluta hiç kayıt düşmedi. Kullanıcı varsa bu, senkron
          işçisinin durduğuna işaret olabilir.
        </div>
      ) : null}

      <section className="section">
        <h2 className="section-title">Son 30 gün</h2>
        <div className="grid grid-2">
          <Card title="Günlük aktif kullanıcı">
            <BarChart
              points={growth.map((g) => ({ label: formatDayMonth(g.day), value: g.active_users }))}
            />
          </Card>
          <Card title="Yeni kayıt">
            <BarChart
              points={growth.map((g) => ({ label: formatDayMonth(g.day), value: g.signups }))}
            />
          </Card>
          <Card title="Günlük sefer">
            <BarChart
              points={growth.map((g) => ({ label: formatDayMonth(g.day), value: g.rides }))}
            />
          </Card>
          <Card title="Günlük net hasılat">
            <BarChart
              points={growth.map((g) => ({ label: formatDayMonth(g.day), value: g.net_kurus }))}
              valueLabel={(v) => formatKurusCompact(v)}
            />
          </Card>
        </div>
      </section>

      <section className="section">
        <div className="grid grid-3">
          <Card title="Kullanıcı verisi toplamı">
            <KeyValue
              rows={[
                ['Brüt hasılat', formatKurus(o.money.gross_kurus)],
                ['Komisyon', formatKurus(o.money.commission_kurus)],
                ['Net hasılat', formatKurus(o.money.net_kurus)],
                ['Bahşiş', formatKurus(o.money.tip_kurus)],
                ['Gider', formatKurus(o.money.expense_kurus)],
                ['Yakıt', formatKurus(o.money.fuel_kurus)],
                ['Ortalama komisyon', `%${commissionRate.toFixed(2).replace('.', ',')}`],
              ]}
            />
          </Card>

          <Card title="Kayıt dağılımı">
            <KeyValue
              rows={[
                ['Sefer', formatInt(o.records.rides)],
                ['Vardiya', formatInt(o.records.shifts)],
                ['Gider', formatInt(o.records.expenses)],
                ['Yakıt kaydı', formatInt(o.records.fuel_logs)],
                ['Araç', formatInt(o.records.vehicles)],
                ['Kazanç kaynağı', formatInt(o.records.earning_sources)],
                ['Düzenli gider', formatInt(o.records.recurring_expenses)],
                ['Hedef', formatInt(o.records.goals)],
              ]}
            />
          </Card>

          <Card title="Hesaplar">
            <KeyValue
              rows={[
                ['Toplam', formatInt(o.users.total)],
                ['E-postası doğrulanmış', formatInt(o.users.confirmed)],
                ['Doğrulanmamış', formatInt(o.users.total - o.users.confirmed)],
                ['Engellenmiş', formatInt(o.users.banned)],
                ['Son 24 saatte yeni', formatInt(o.users.new_24h)],
                ['Son 7 günde yeni', formatInt(o.users.new_7d)],
                ['Son 30 günde yeni', formatInt(o.users.new_30d)],
              ]}
            />
          </Card>
        </div>
      </section>
    </>
  );
}
