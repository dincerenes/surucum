import Link from 'next/link';

import { RpcError } from '@/components/rpc-error';
import { Badge, Card, Empty, KeyValue, PageHead } from '@/components/ui';
import {
  ADMIN_ROLE_LABELS, USER_TABLE_LABELS, formatCell, formatDate, formatDateTime,
  formatInt, formatKurus, formatRelative,
} from '@/lib/format';
import { canReadRawData, requireAdmin } from '@/lib/guard';
import { createClient } from '@/lib/supabase/server';
import type { UserDetail, UserRecords } from '@/lib/types';

export const dynamic = 'force-dynamic';

const RAW_ROW_LIMIT = 100;

export default async function KullaniciDetayPage({
  params, searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ tablo?: string }>;
}) {
  const session = await requireAdmin();
  const { id } = await params;
  const { tablo } = await searchParams;

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_user_detail', { p_user_id: id });

  if (error) {
    return (
      <>
        <PageHead title="Kullanıcı" />
        <RpcError error={error} />
        <p style={{ marginTop: 12 }}>
          <Link href="/kullanicilar">← Kullanıcı listesine dön</Link>
        </p>
      </>
    );
  }

  const d = data as UserDetail;
  const mayReadRaw = canReadRawData(session.role);

  // Ham kayıt YALNIZCA açıkça istendiğinde çekiliyor. Sayfa açılır açılmaz
  // getirilseydi, her kullanıcıya göz atmak bir ham veri erişimi olarak
  // loglanır ve denetim kaydı anlamsızlaşırdı.
  let records: UserRecords | null = null;
  let recordsError: { code?: string; message: string } | null = null;

  if (tablo && mayReadRaw) {
    const res = await supabase.rpc('admin_user_records', {
      p_user_id: id,
      p_table: tablo,
      p_limit: RAW_ROW_LIMIT,
      p_offset: 0,
    });
    records = (res.data ?? null) as UserRecords | null;
    recordsError = res.error;
  }

  const net = d.money.net_kurus + d.money.tip_kurus;
  const cost = d.money.expense_kurus + d.money.fuel_kurus;

  return (
    <>
      <PageHead
        title={d.user.email ?? '(e-posta yok)'}
        sub={`${formatDate(d.user.created_at)} tarihinde kaydoldu · son etkinlik ${formatRelative(d.range.last_activity_at)}`}
        action={<Link className="btn btn-secondary" href="/kullanicilar">← Liste</Link>}
      />

      <div className="row-tight" style={{ marginBottom: 16 }}>
        {d.user.admin_role ? <Badge tone="accent">{ADMIN_ROLE_LABELS[d.user.admin_role]}</Badge> : null}
        {d.user.email_confirmed_at
          ? <Badge tone="positive">E-posta doğrulanmış</Badge>
          : <Badge tone="warning">E-posta doğrulanmamış</Badge>}
        {d.user.banned_until ? <Badge tone="negative">Engelli</Badge> : null}
        <span className="mono" style={{ color: 'var(--text-faint)' }}>{d.user.id}</span>
      </div>

      <div className="grid grid-3">
        <Card title="Hesap">
          <KeyValue
            rows={[
              ['Kayıt', formatDateTime(d.user.created_at)],
              ['Son giriş', d.user.last_sign_in_at ? formatDateTime(d.user.last_sign_in_at) : 'hiç'],
              ['E-posta onayı', d.user.email_confirmed_at ? formatDateTime(d.user.email_confirmed_at) : '—'],
              ['Gün kesme saati', d.settings ? `${String(d.settings.day_cutoff_hour).padStart(2, '0')}:00` : '—'],
              ['Bölge', d.settings?.region_code ?? '—'],
              ['Kurulumu tamamladı', d.settings?.onboarding_completed_at ? 'Evet' : 'Hayır'],
            ]}
          />
        </Card>

        <Card title="Para">
          <KeyValue
            rows={[
              ['Brüt hasılat', formatKurus(d.money.gross_kurus)],
              ['Komisyon', formatKurus(d.money.commission_kurus)],
              ['Net + bahşiş', formatKurus(net)],
              ['Gider', formatKurus(d.money.expense_kurus)],
              ['Yakıt', formatKurus(d.money.fuel_kurus)],
              ['Net − maliyet', formatKurus(net - cost)],
            ]}
          />
        </Card>

        <Card title="Kayıtlar">
          <KeyValue
            rows={Object.entries(d.counts).map(([k, v]) => [
              USER_TABLE_LABELS[k] ?? k,
              formatInt(v),
            ])}
          />
        </Card>
      </div>

      {d.range.first_business_date ? (
        <p className="page-sub" style={{ marginTop: 14 }}>
          Sefer geçmişi {formatDate(d.range.first_business_date)} –{' '}
          {formatDate(d.range.last_business_date)} arasında.
        </p>
      ) : null}

      <section className="section">
        <h2 className="section-title">Ham kayıtlar</h2>

        {!mayReadRaw ? (
          <div className="notice notice-warning">
            Destek rolü ham kayıt açamaz. Bu ekranda yalnızca toplamlar
            görünür.
          </div>
        ) : (
          <>
            <div className="notice notice-warning" style={{ marginBottom: 12 }}>
              Bir tablo açmak, sürücünün kendi verisini görmek demektir. Her
              açılış <Link href="/denetim">denetim kaydına</Link> hesabınızla
              birlikte yazılır.
            </div>

            <div className="row-tight" style={{ marginBottom: 12 }}>
              {Object.entries(USER_TABLE_LABELS).map(([key, label]) => (
                <Link
                  key={key}
                  className={`btn btn-sm ${tablo === key ? '' : 'btn-secondary'}`}
                  href={`/kullanicilar/${id}?tablo=${key}`}
                >
                  {label}
                  {d.counts[key] !== undefined ? ` (${formatInt(d.counts[key])})` : ''}
                </Link>
              ))}
              {tablo ? (
                <Link className="btn btn-sm btn-secondary" href={`/kullanicilar/${id}`}>Kapat</Link>
              ) : null}
            </div>

            <RpcError error={recordsError} />

            {records ? <RawTable records={records} /> : null}
            {!records && !recordsError ? (
              <div className="table-wrap">
                <Empty>Görüntülemek için bir tablo seçin.</Empty>
              </div>
            ) : null}
          </>
        )}
      </section>
    </>
  );
}

function RawTable({ records }: { records: UserRecords }) {
  const rows = records.rows;

  if (rows.length === 0) {
    return (
      <div className="table-wrap">
        <Empty>Bu tabloda kayıt yok.</Empty>
      </div>
    );
  }

  // Sütunlar ilk satırdan türetiliyor; user_id her satırda aynı olduğu için
  // gösterilmiyor — sayfanın tamamı zaten o kullanıcıya ait.
  const columns = Object.keys(rows[0]).filter((c) => c !== 'user_id');

  return (
    <>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>{columns.map((c) => <th key={c}>{c}</th>)}</tr>
          </thead>
          <tbody>
            {rows.map((row, i) => (
              <tr key={String(row.id ?? i)}>
                {columns.map((c) => (
                  <td
                    key={c}
                    className={c.endsWith('_kurus') || c.endsWith('_km') ? 'right num nowrap' : 'nowrap'}
                  >
                    {formatCell(c, row[c])}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <p className="page-sub">
        {formatInt(records.total)} kaydın ilk {formatInt(rows.length)} tanesi
        gösteriliyor.
      </p>
    </>
  );
}
