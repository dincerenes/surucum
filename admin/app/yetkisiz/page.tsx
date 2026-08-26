import { signOutAction } from '../actions';
import { createClient } from '@/lib/supabase/server';

export default async function YetkisizPage() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getUser();

  return (
    <main className="auth-page">
      <div className="auth-card">
        <div>
          <div className="brand-name">Yetkiniz yok</div>
          <div className="brand-sub">Sürücüm yönetim paneli</div>
        </div>

        <p style={{ margin: 0, color: 'var(--text-soft)' }}>
          <strong>{data.user?.email ?? 'Bu hesap'}</strong> yönetim paneline
          kayıtlı değil. Erişim için bir panel sahibinin hesabınıza yetki
          vermesi gerekiyor.
        </p>

        <form action={signOutAction}>
          <button className="btn btn-secondary" type="submit">Çıkış yap</button>
        </form>
      </div>
    </main>
  );
}
