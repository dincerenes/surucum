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
