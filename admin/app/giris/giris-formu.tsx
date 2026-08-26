'use client';

import { useRouter } from 'next/navigation';
import { useState, type FormEvent } from 'react';

import { createClient } from '@/lib/supabase/client';

/**
 * Giriş formu.
 *
 * Hata metinleri kasıtlı olarak belirsiz: "e-posta bulunamadı" ile "şifre
 * yanlış" ayrı ayrı söylenirse, form bir hesap numaralandırma aracına
 * dönüşür — hangi adreslerin kayıtlı olduğu tek tek öğrenilebilir.
 */
export function GirisFormu({ hedef }: { hedef: string | null }) {
  const router = useRouter();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });

    if (signInError) {
      setError('E-posta veya şifre hatalı.');
      setBusy(false);
      return;
    }

    // Yalnızca kendi içimizdeki yollara dönüyoruz. Dışarıdan gelen tam bir
    // adres kabul edilseydi, giriş bağlantısı açık yönlendirme açığına
    // dönüşür ve kimlik avı için kullanılabilirdi.
    const safe = hedef && hedef.startsWith('/') && !hedef.startsWith('//') ? hedef : '/';

    router.replace(safe);
    router.refresh();
  }

  return (
    <form className="auth-card" onSubmit={onSubmit}>
      <div>
        <div className="brand-name">Sürücüm</div>
        <div className="brand-sub">Yönetim paneli</div>
      </div>

      <div className="field">
        <label className="label" htmlFor="email">E-posta</label>
        <input
          id="email"
          type="email"
          autoComplete="username"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
      </div>

      <div className="field">
        <label className="label" htmlFor="password">Şifre</label>
        <input
          id="password"
          type="password"
          autoComplete="current-password"
          required
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
      </div>

      {error ? <div className="notice notice-critical">{error}</div> : null}

      <button className="btn" type="submit" disabled={busy}>
        {busy ? 'Giriş yapılıyor…' : 'Giriş yap'}
      </button>

      <p style={{ margin: 0, fontSize: 12, color: 'var(--text-faint)' }}>
        Bu panel yalnızca yetkili hesaplara açıktır. Sürücü hesabıyla giriş
        yapılabilir ama hiçbir yönetim ekranı görünmez.
      </p>
    </form>
  );
}
