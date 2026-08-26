import { signOutAction } from '../actions';
import { Nav } from '@/components/nav';
import { ADMIN_ROLE_LABELS } from '@/lib/format';
import { requireAdmin } from '@/lib/guard';

export default async function PanelLayout({ children }: { children: React.ReactNode }) {
  const session = await requireAdmin();

  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <span className="brand-name">Sürücüm</span>
          <span className="brand-sub">Yönetim</span>
        </div>

        <Nav />

        <div className="sidebar-foot">
          <span>{session.email}</span>
          <span className="badge badge-accent" style={{ alignSelf: 'flex-start' }}>
            {ADMIN_ROLE_LABELS[session.role] ?? session.role}
          </span>
          <form action={signOutAction}>
            <button className="btn btn-secondary btn-sm" type="submit">Çıkış</button>
          </form>
        </div>
      </aside>

      <main className="main">{children}</main>
    </div>
  );
}
