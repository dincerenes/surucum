import { GirisFormu } from './giris-formu';

/**
 * Giriş hedefi burada, SUNUCUDA okunuyor.
 *
 * İstemci tarafında useSearchParams ile okunsaydı, formun bulunduğu alt
 * ağaç sunucuda çizilemez ve kullanıcı önce boş bir "Yükleniyor…" görürdü.
 * Giriş ekranı, uygulamanın ilk izlenimi — orada bir yükleme takılması
 * en görünür yerde oluyor.
 */
export default async function GirisPage({
  searchParams,
}: {
  searchParams: Promise<{ hedef?: string }>;
}) {
  const { hedef } = await searchParams;

  return (
    <main className="auth-page">
      <GirisFormu hedef={hedef ?? null} />
    </main>
  );
}
