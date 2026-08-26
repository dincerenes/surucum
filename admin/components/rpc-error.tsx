/**
 * Veritabanı hatasını okunur biçimde gösterir.
 *
 * Yetki hatası (42501) ayrı ele alınıyor: panelin en sık karşılaşacağı
 * hata bu ve "işlem başarısız" demek kullanıcıya hiçbir şey anlatmaz —
 * eksik olan yetkidir, sistem çalışıyordur.
 */
export function RpcError({ error }: { error: { code?: string; message: string } | null }) {
  if (!error) return null;

  const isPermission = error.code === '42501';

  return (
    <div className={`notice ${isPermission ? 'notice-warning' : 'notice-critical'}`}>
      <strong>{isPermission ? 'Bu veri için yetkiniz yok.' : 'Veri okunamadı.'}</strong>
      <div style={{ marginTop: 4, color: 'var(--text-soft)' }}>{error.message}</div>
    </div>
  );
}
