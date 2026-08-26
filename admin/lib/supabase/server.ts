import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

import { SUPABASE_KEY, SUPABASE_URL } from '../env';

/**
 * Sunucu tarafı Supabase istemcisi.
 *
 * TASARIM KARARI — panel service_role anahtarını KULLANMAZ.
 *
 * service_role RLS'i tamamen baypas eder. Kullanılsaydı, paneldeki her
 * hata veya her açık, tüm sürücülerin verisine sınırsız erişim demek
 * olurdu; is_admin(), rol ayrımı ve denetim kaydı da anlamını yitirirdi.
 * Panel, giriş yapmış yöneticinin KENDİ oturumuyla çalışır — yetkisini
 * veritabanı verir, uygulama değil.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          for (const { name, value, options } of cookiesToSet) {
            cookieStore.set(name, value, options);
          }
        } catch {
          // Sunucu bileşeninden çerez yazılamaz. Sorun değil: oturum
          // tazeleme middleware'de yapılıyor, burası yalnızca okuyor.
        }
      },
    },
  });
}
