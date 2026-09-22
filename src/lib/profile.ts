/**
 * Profil yardımcıları — ad, selamlama, hazır avatarın harfi.
 *
 * Veritabanı ve arayüz bilmez; test edilir.
 */

import { upperTr } from './text.ts';

/** Adın en fazla uzunluğu. Bulutta 60 karakter sınırı var, pay bırakıldı. */
export const MAX_DISPLAY_NAME = 40;

/** Boş ya da yalnızca boşluk olan metin `null` — "girilmedi" demek. */
export function blankToNull(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
}

/**
 * Adı saklanacak hâle getirir: baştaki/sondaki ve aradaki fazla boşluk
 * gidiyor, uzunluk kırpılıyor. Boşsa `null`.
 */
export function normalizeDisplayName(value: string | null | undefined): string | null {
  const clean = blankToNull(value?.replace(/\s+/g, ' '));
  return clean == null ? null : clean.slice(0, MAX_DISPLAY_NAME).trim();
}

/**
 * Selamlamada kullanılan ad — İLK AD. "Günaydın Mehmet Ali Yılmaz"
 * ekrana sığmıyor ve kimse kendine tam adıyla seslenmiyor.
 */
export function firstName(displayName: string | null | undefined): string | null {
  const clean = normalizeDisplayName(displayName);
  return clean ? clean.split(' ')[0] : null;
}

/**
 * Saate göre selamlama.
 *
 *   05–11 Günaydın · 11–17 Tünaydın · 17–22 İyi akşamlar · 22–05 İyi geceler
 *
 * Alt sınır dahil, üst sınır hariç: 11:00 artık Tünaydın.
 */
export function greetingFor(hour: number): string {
  if (hour >= 5 && hour < 11) return 'Günaydın';
  if (hour >= 11 && hour < 17) return 'Tünaydın';
  if (hour >= 17 && hour < 22) return 'İyi akşamlar';
  return 'İyi geceler';
}

/** Hazır avatarın harfi — adın baş harfi, Türkçe büyük. Ad yoksa `null`. */
export function initialOf(displayName: string | null | undefined): string | null {
  const clean = normalizeDisplayName(displayName);
  return clean ? upperTr(clean.charAt(0)) : null;
}
