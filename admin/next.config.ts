import type { NextConfig } from 'next';

/**
 * Panel Expo projesinin İÇİNDE ama ondan bağımsız bir uygulama.
 *
 * `outputFileTracingRoot` bu klasöre sabitleniyor: Next varsayılan olarak
 * en yakın lockfile'ı arayıp kökü oradan türetir ve üstteki Expo
 * package-lock.json'ı bulup tüm mobil bağımlılıkları izlemeye alır.
 */
const config: NextConfig = {
  outputFileTracingRoot: __dirname,

  /*
   * Next 16 geliştirme sunucusu, `_next/*` altındaki geliştirme
   * kaynaklarını çapraz kökenli isteklere kapatıyor. Sunucu `localhost`
   * dinlediği için `127.0.0.1` ve LAN adresi FARKLI KÖKEN sayılıyor ve
   * bir JS parçası 403 dönüyor. Tek parça bile eksik kalınca hydration
   * tamamlanmıyor: sayfa çizilir ama hiçbir düğme çalışmaz — teşhis
   * edilmesi zor bir hata, çünkü ekran doğru görünüyor.
   *
   * Yalnızca `next dev` içindir; üretimde bu ayarın hiçbir etkisi yok.
   */
  allowedDevOrigins: ['127.0.0.1', 'localhost'],

  // Next 16 açılışta AGENTS.md ve CLAUDE.md üretiyor. Bu projede CLAUDE.md
  // bilinçli olarak depo dışında tutuluyor (bkz. .gitignore), o yüzden
  // otomatik üretim kapalı.
  agentRules: false,

  // Panelde kullanıcı verisi var: arama motoru da, tarayıcı önbelleği de
  // burada bir şey tutmamalı.
  async headers() {
    return [
      {
        source: '/:path*',
        headers: [
          { key: 'X-Robots-Tag', value: 'noindex, nofollow' },
          { key: 'Referrer-Policy', value: 'no-referrer' },
          { key: 'X-Content-Type-Options', value: 'nosniff' },
          { key: 'X-Frame-Options', value: 'DENY' },
        ],
      },
    ];
  },
};

export default config;
