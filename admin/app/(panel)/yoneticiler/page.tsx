import Link from 'next/link';

import { Flash } from '@/components/flash';
import { RpcError } from '@/components/rpc-error';
import { Badge, Card, Empty, PageHead } from '@/components/ui';
import { ADMIN_ROLE_LABELS, formatDate, formatRelative } from '@/lib/format';
import { requireAdmin } from '@/lib/guard';
import { createClient } from '@/lib/supabase/server';
import type { AdminRole } from '@/lib/types';

import { grantRole, revokeRole } from './actions';

export const dynamic = 'force-dynamic';

interface AdminRow {
  user_id: string;
  email: string | null;
  role: AdminRole;
  note: string | null;
  created_at: string;
  last_sign_in_at: string | null;
}

const ROLE_HELP: Record<AdminRole, string> = {
  owner: 'Yetki atar ve kaldırır, ham sürücü verisi açar, her şeyi düzenler.',
  admin: 'Ham sürücü verisi açar, yakıt/duyuru/bayrak düzenler. Yetki atayamaz.',
  support: 'Yalnızca toplamları ve denetim kaydını görür. Ham veri açamaz, hiçbir şey düzenleyemez.',
};

export default async function YoneticilerPage({
  searchParams,
}: {
  searchParams: Promise<{ sonuc?: string; hata?: string }>;
}) {
  const session = await requireAdmin();
  const { sonuc, hata } = await searchParams;
  const isOwner = session.role === 'owner';

  const supabase = await createClient();
  const { data, error } = await supabase.rpc('admin_list_admins');
  const rows = (data ?? []) as AdminRow[];

  return (
    <>
      <PageHead title="Yöneticiler" sub="Panele erişebilen hesaplar ve yetki düzeyleri" />

      <Flash ok={sonuc} error={hata} />
      <RpcError error={error} />

      <div className="grid grid-3" style={{ marginBottom: 16 }}>
        {(Object.keys(ROLE_HELP) as AdminRole[]).map((role) => (
          <div className="card" key={role}>
            <h3 className="card-title">{ADMIN_ROLE_LABELS[role]}</h3>
            <p style={{ margin: 0, color: 'var(--text-soft)' }}>{ROLE_HELP[role]}</p>
          </div>
        ))}
      </div>

      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>E-posta</th>
              <th>Rol</th>
              <th>Not</th>
              <th>Son giriş</th>
              <th>Yetki tarihi</th>
              {isOwner ? <th /> : null}
            </tr>
          </thead>
          <tbody>
            {rows.map((a) => (
              <tr key={a.user_id}>
                <td>
                  <Link href={`/kullanicilar/${a.user_id}`} style={{ fontWeight: 600 }}>
                    {a.email ?? '(e-posta yok)'}
                  </Link>
                  {a.user_id === session.userId ? (
                    <span style={{ marginLeft: 6 }}><Badge tone="neutral">siz</Badge></span>
                  ) : null}
                </td>
                <td><Badge tone="accent">{ADMIN_ROLE_LABELS[a.role]}</Badge></td>
                <td>{a.note ?? '—'}</td>
                <td className="nowrap">{formatRelative(a.last_sign_in_at)}</td>
                <td className="nowrap">{formatDate(a.created_at)}</td>
                {isOwner ? (
                  <td className="right">
                    <form action={revokeRole}>
                      <input type="hidden" name="user_id" value={a.user_id} />
                      <button className="btn btn-danger btn-sm" type="submit">
                        Yetkiyi kaldır
                      </button>
                    </form>
                  </td>
                ) : null}
              </tr>
            ))}
            {rows.length === 0 ? (
              <tr><td colSpan={isOwner ? 6 : 5}><Empty>Kayıtlı yönetici yok.</Empty></td></tr>
            ) : null}
          </tbody>
        </table>
      </div>

      {isOwner ? (
        <section className="section">
          <Card title="Yetki ver">
            <form action={grantRole} className="row">
              <div className="field" style={{ flex: '1 1 260px' }}>
                <label className="label" htmlFor="email">E-posta</label>
                <input id="email" name="email" type="email" required
                       placeholder="ornek@ornek.com" />
              </div>
              <div className="field" style={{ flex: '0 0 160px' }}>
                <label className="label" htmlFor="role">Rol</label>
                <select id="role" name="role" defaultValue="support">
                  <option value="support">Destek</option>
                  <option value="admin">Yönetici</option>
                  <option value="owner">Sahip</option>
                </select>
              </div>
              <button className="btn" type="submit">Yetki ver</button>
            </form>
            <p className="page-sub" style={{ marginTop: 8 }}>
              Kişinin uygulamada zaten bir hesabı olmalı. Var olan bir
              yöneticinin rolü girilirse rolü değiştirilir.
            </p>
          </Card>
        </section>
      ) : (
        <div className="notice notice-warning section">
          Yetki atamak yalnızca <strong>Sahip</strong> rolündeki hesaplara
          açıktır.
        </div>
      )}
    </>
  );
}
