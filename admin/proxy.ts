import type { NextRequest } from 'next/server';

import { updateSession } from './lib/supabase/proxy';

/**
 * Next 16'da bu dosyanın adı `proxy`, eskiden `middleware`'di.
 * Dışa aktarılan fonksiyonun adı da `proxy` olmak zorunda — `middleware`
 * adı yalnızca eski dosya adıyla eşleşiyor.
 */
export async function proxy(request: NextRequest) {
  return updateSession(request);
}

export const config = {
  matcher: [
    // Statik dosyalar ve görseller hariç her yol. Bunlar için oturum
    // tazelemek gereksiz istek üretir.
    '/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)',
  ],
};
