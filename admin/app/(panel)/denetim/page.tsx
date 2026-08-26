import Link from 'next/link';

import { RpcError } from '@/components/rpc-error';
import { Badge, Empty, PageHead } from '@/components/ui';
import { formatDateTime, formatInt } from '@/lib/format';
import { requireAdmin } from '@/lib/guard';
import { createClient } from '@/lib/supabase/server';
import type { AuditEntry } from '@/lib/types';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 100;

const ACTION_LABELS: Record<string, string> = {
  user_detail_view: 'Kullanıcı detayı görüntülendi',
  user_records_view: 'Ham kayıt açıldı',
  insert: 'Kayıt eklendi',
  update: 'Kayıt güncellendi',
  delete: 'Kayıt silindi',
};

const TARGET_LABELS: Record<string, string> = {
  user: 'Kullanıcı',
  admin_users: 'Yönetici yetkisi',
  announcements: 'Duyuru',
  feature_flags: 'Özellik bayrağı',
  fuel_prices: 'Yakıt fiyatı',
};

const ACTIONS = Object.keys(ACTION_LABELS);
const TARGETS = Object.keys(TARGET_LABELS);

export default async function DenetimPage({
  searchParams,
}: {
  searchParams: Promise<{ eylem?: string; hedef?: string; kaynak?: string; sayfa?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const action = ACTIONS.includes(params.eylem ?? '') ? params.eylem! : '';
  const target = TARGETS.includes(params.hedef ?? '') ? params.hedef! : '';
  const source = params.kaynak === 'admin' || params.kaynak === 'system' ? params.kaynak : '';
  const page = Math.max(1, Number.parseInt(params.sayfa ?? '1', 10) || 1);
  const from = (page - 1) * PAGE_SIZE;

  const supabase = await createClient();
  let query = supabase
    .from('admin_audit_log')
    .select('*', { count: 'exact' })
    .order('id', { ascending: false })
    .range(from, from + PAGE_SIZE - 1);

  if (action) query = query.eq('action', action);
  if (target) query = query.eq('target_type', target);
  if (source) query = query.eq('source', source);

  const { data, error, count } = await query;
  const rows = (data ?? []) as AuditEntry[];
  const total = count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  const linkFor = (next: Record<string, string>) => {
    const sp = new URLSearchParams({
      ...(action ? { eylem: action } : {}),
      ...(target ? { hedef: target } : {}),
      ...(source ? { kaynak: source } : {}),
      ...next,
    });
    return `/denetim?${sp}`;
  };

  return (
    <>
      <PageHead
        title="Denetim kaydı"
        sub={error ? undefined : `${formatInt(total)} kayıt`}
      />

      <div className="notice notice-info" style={{ marginBottom: 14 }}>
        Bu kayda yalnızca veritabanı yazar; panel üzerinden satır eklenemez,
        değiştirilemez ve silinemez. <strong>Sistem</strong> etiketli satırlar
        zamanlanmış işlerin yazdıklarıdır.
      </div>

      <form className="row" style={{ marginBottom: 14 }}>
        <div className="field" style={{ flex: '0 0 230px' }}>
          <label className="label" htmlFor="eylem">Eylem</label>
          <select id="eylem" name="eylem" defaultValue={action}>
            <option value="">Tümü</option>
            {ACTIONS.map((a) => <option key={a} value={a}>{ACTION_LABELS[a]}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '0 0 190px' }}>
          <label className="label" htmlFor="hedef">Hedef</label>
          <select id="hedef" name="hedef" defaultValue={target}>
            <option value="">Tümü</option>
            {TARGETS.map((t) => <option key={t} value={t}>{TARGET_LABELS[t]}</option>)}
          </select>
        </div>
        <div className="field" style={{ flex: '0 0 150px' }}>
          <label className="label" htmlFor="kaynak">Kaynak</label>
          <select id="kaynak" name="kaynak" defaultValue={source}>
            <option value="">Tümü</option>
            <option value="admin">Yönetici</option>
            <option value="system">Sistem</option>
          </select>
        </div>
        <button className="btn" type="submit">Filtrele</button>
        {action || target || source
          ? <Link className="btn btn-secondary" href="/denetim">Temizle</Link>
          : null}
      </form>

      <RpcError error={error} />

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Zaman</th>
              <th>Kim</th>
              <th>Eylem</th>
              <th>Hedef</th>
              <th>Ayrıntı</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((e) => (
              <tr key={e.id}>
                <td className="nowrap">{formatDateTime(e.created_at)}</td>
                <td className="nowrap">
                  {e.source === 'system'
                    ? <Badge tone="neutral">Sistem</Badge>
                    : (e.admin_email ?? <span className="mono">{e.admin_id ?? '—'}</span>)}
                </td>
                <td>{ACTION_LABELS[e.action] ?? e.action}</td>
                <td className="nowrap">
                  {e.target_type === 'user' && e.target_id ? (
                    <Link href={`/kullanicilar/${e.target_id}`}>
                      {TARGET_LABELS.user}
                    </Link>
                  ) : (
                    TARGET_LABELS[e.target_type ?? ''] ?? e.target_type ?? '—'
                  )}
                  {e.target_type !== 'user' && e.target_id ? (
                    <span className="mono" style={{ color: 'var(--text-faint)', marginLeft: 6 }}>
                      {e.target_id.length > 20 ? e.target_id.slice(0, 8) + '…' : e.target_id}
                    </span>
                  ) : null}
                </td>
                <td style={{ whiteSpace: 'normal', maxWidth: 380 }}>
                  {e.detail && Object.keys(e.detail).length > 0 ? (
                    <details>
                      <summary style={{ cursor: 'pointer', color: 'var(--text-soft)' }}>
                        Göster
                      </summary>
                      <pre className="mono" style={{
                        margin: '6px 0 0', whiteSpace: 'pre-wrap', overflowWrap: 'anywhere',
                        background: 'var(--sunken)', padding: 8, borderRadius: 6,
                      }}>
                        {JSON.stringify(e.detail, null, 2)}
                      </pre>
                    </details>
                  ) : '—'}
                </td>
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr><td colSpan={5}><Empty>Kayıt yok.</Empty></td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {pageCount > 1 ? (
        <div className="row" style={{ marginTop: 14, justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-soft)' }}>Sayfa {page} / {pageCount}</span>
          <div className="row-tight">
            {page > 1 ? (
              <Link className="btn btn-secondary btn-sm" href={linkFor({ sayfa: String(page - 1) })}>
                Önceki
              </Link>
            ) : null}
            {page < pageCount ? (
              <Link className="btn btn-secondary btn-sm" href={linkFor({ sayfa: String(page + 1) })}>
                Sonraki
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
