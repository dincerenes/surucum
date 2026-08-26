/**
 * Ortam değişkenleri.
 *
 * Eksik değişken hatası, ilk Supabase çağrısında anlaşılmaz bir "fetch
 * failed" olarak değil, burada açık bir mesajla patlasın diye tek yerde
 * okunuyor.
 */

function required(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(
      `${name} tanımlı değil. admin/.env.example dosyasını .env.local olarak kopyalayıp doldurun.`,
    );
  }
  return value;
}

// Next derleme anında process.env.X ifadelerini metin olarak değiştirir;
// bu yüzden değişken adları dinamik değil, düz yazılmak zorunda.
export const SUPABASE_URL = required(
  'NEXT_PUBLIC_SUPABASE_URL',
  process.env.NEXT_PUBLIC_SUPABASE_URL,
);

export const SUPABASE_KEY = required(
  'NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY',
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
);
