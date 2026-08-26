import Link from 'next/link';

import { RpcError } from '@/components/rpc-error';
import { Badge, Empty, PageHead } from '@/components/ui';
import {
  ADMIN_ROLE_LABELS, formatDate, formatInt, formatKurus, formatRelative,
} from '@/lib/format';
import { requireAdmin } from '@/lib/guard';
import { createClient } from '@/lib/supabase/server';
import type { UserListRow } from '@/lib/types';

export const dynamic = 'force-dynamic';

const PAGE_SIZE = 50;

const SORTS: { value: string; label: string }[] = [
  { value: 'created_at', label: 'Kayıt tarihi' },
  { value: 'last_activity', label: 'Son etkinlik' },
  { value: 'last_sign_in', label: 'Son giriş' },
  { value: 'rides', label: 'Sefer sayısı' },
  { value: 'net', label: 'Net hasılat' },
];

export default async function KullanicilarPage({
  searchParams,
}: {
  searchParams: Promise<{ q?: string; sayfa?: string; sirala?: string }>;
}) {
  await requireAdmin();
  const params = await searchParams;

  const q = params.q?.trim() ?? '';
  const sort = SORTS.some((s) => s.value === params.sirala) ? params.sirala! : 'created_at';
  const page = Math.max(1, Number.parseInt(params.sayfa ?? '1', 10) || 1);

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_user_list', {
    p_search: q || null,
    p_limit: PAGE_SIZE,
    p_offset: (page - 1) * PAGE_SIZE,
    p_sort: sort,
  });

  const rows = (data ?? []) as UserListRow[];
  const total = rows[0]?.total_count ?? 0;
  const pageCount = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <>
      <PageHead
        title="Kullanıcılar"
        sub={error ? undefined : `${formatInt(total)} hesap`}
      />

      {/* Düz GET formu: arama ve sıralama adres çubuğunda kalıyor, böylece
          bir sonuç sayfası paylaşılabilir ve geri tuşu beklendiği gibi
          çalışır. Bunun için istemci tarafı duruma gerek yok. */}
      <form className="row" style={{ marginBottom: 14 }}>
        <div className="field" style={{ flex: '1 1 260px' }}>
          <label className="label" htmlFor="q">E-posta veya kullanıcı kimliği</label>
          <input id="q" name="q" type="search" defaultValue={q} placeholder="ornek@ornek.com" />
        </div>
        <div className="field" style={{ flex: '0 0 180px' }}>
          <label className="label" htmlFor="sirala">Sırala</label>
          <select id="sirala" name="sirala" defaultValue={sort}>
            {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
          </select>
        </div>
        <button className="btn" type="submit">Ara</button>
        {q ? <Link className="btn btn-secondary" href="/kullanicilar">Temizle</Link> : null}
      </form>

      <RpcError error={error} />

      {!error ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>E-posta</th>
                <th>Durum</th>
                <th className="right">Araç</th>
                <th className="right">Sefer</th>
                <th className="right">Net hasılat</th>
                <th>Son etkinlik</th>
                <th>Son giriş</th>
                <th>Kayıt</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((u) => (
                <tr key={u.user_id}>
                  <td>
                    <Link href={`/kullanicilar/${u.user_id}`} style={{ fontWeight: 600 }}>
                      {u.email ?? '(e-posta yok)'}
                    </Link>
                    {u.admin_role ? (
                      <span style={{ marginLeft: 6 }}>
                        <Badge tone="accent">{ADMIN_ROLE_LABELS[u.admin_role]}</Badge>
                      </span>
                    ) : null}
                  </td>
                  <td>
                    {u.banned ? <Badge tone="negative">Engelli</Badge>
                      : u.confirmed ? <Badge tone="positive">Doğrulanmış</Badge>
                      : <Badge tone="warning">Doğrulanmamış</Badge>}
                  </td>
                  <td className="right num">{formatInt(u.vehicle_count)}</td>
                  <td className="right num">{formatInt(u.ride_count)}</td>
                  <td className="right num">{formatKurus(u.net_total_kurus)}</td>
                  <td className="nowrap">{formatRelative(u.last_activity_at)}</td>
                  <td className="nowrap">{formatRelative(u.last_sign_in_at)}</td>
                  <td className="nowrap">{formatDate(u.created_at)}</td>
                </tr>
              ))}
              {rows.length === 0 ? (
                <tr>
                  <td colSpan={8}>
                    <Empty>
                      {q ? `"${q}" ile eşleşen hesap yok.` : 'Henüz kayıtlı kullanıcı yok.'}
                    </Empty>
                  </td>
                </tr>
              ) : null}
            </tbody>
          </table>
        </div>
      ) : null}

      {pageCount > 1 ? (
        <div className="row" style={{ marginTop: 14, justifyContent: 'space-between' }}>
          <span style={{ color: 'var(--text-soft)' }}>
            Sayfa {page} / {pageCount}
          </span>
          <div className="row-tight">
            {page > 1 ? (
              <Link
                className="btn btn-secondary btn-sm"
                href={`/kullanicilar?${new URLSearchParams({ q, sirala: sort, sayfa: String(page - 1) })}`}
              >
                Önceki
              </Link>
            ) : null}
            {page < pageCount ? (
              <Link
                className="btn btn-secondary btn-sm"
                href={`/kullanicilar?${new URLSearchParams({ q, sirala: sort, sayfa: String(page + 1) })}`}
              >
                Sonraki
              </Link>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
