import { createServerClient } from '@supabase/ssr';
import { NextResponse, type NextRequest } from 'next/server';

import { SUPABASE_KEY, SUPABASE_URL } from '../env';

/**
 * Oturumu tazeler ve yetkisiz isteği giriş ekranına yollar.
 *
 * Neden middleware: erişim jetonu kısa ömürlü. Tazeleme yalnızca sayfa
 * bileşenlerinde yapılsaydı, çerez yazamayan bir sunucu bileşeni tazelenmiş
 * jetonu tarayıcıya geri veremez ve yönetici birkaç dakikada bir dışarı
 * atılırdı.
 *
 * Buradaki denetim yalnızca OTURUM denetimidir, yetki denetimi değil.
 * Yetkiyi veritabanı verir: admin olmayan biri çerezini taşısa bile
 * her RPC `is_admin()` duvarına çarpar.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient(SUPABASE_URL, SUPABASE_KEY, {
    cookies: {
      getAll() {
        return request.cookies.getAll();
      },
      setAll(cookiesToSet) {
        for (const { name, value } of cookiesToSet) {
          request.cookies.set(name, value);
        }
        response = NextResponse.next({ request });
        for (const { name, value, options } of cookiesToSet) {
          response.cookies.set(name, value, options);
        }
      },
    },
  });

  // getUser() jetonu sunucuda doğrular. getSession() çerezdeki veriyi
  // doğrulamadan döner ve middleware'de güvenilmez.
  const { data } = await supabase.auth.getUser();

  const path = request.nextUrl.pathname;
  const isPublic = path === '/giris' || path.startsWith('/auth');

  if (!data.user && !isPublic) {
    const url = request.nextUrl.clone();
    url.pathname = '/giris';
    // Girişten sonra kullanıcıyı gitmek istediği sayfaya geri götür.
    url.searchParams.set('hedef', path);
    return NextResponse.redirect(url);
  }

  if (data.user && path === '/giris') {
    const url = request.nextUrl.clone();
    url.pathname = '/';
    url.search = '';
    return NextResponse.redirect(url);
  }

  return response;
}
