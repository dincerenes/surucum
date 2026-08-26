/**
 * İşlem sonucu bildirimi.
 *
 * Sonuç, sunucu eyleminden sonra adres çubuğundaki parametreyle taşınıyor.
 * Böylece sayfa tamamen sunucuda çizilebiliyor ve form durumunu tutmak
 * için istemci tarafı duruma gerek kalmıyor; sayfa yenilense de mesaj
 * kaybolmuyor.
 */
export function Flash({ ok, error }: { ok?: string; error?: string }) {
  if (!ok && !error) return null;
  return (
    <div className={`notice ${error ? 'notice-critical' : 'notice-positive'}`}
         style={{ marginBottom: 14 }}>
      {error ?? ok}
    </div>
  );
}
