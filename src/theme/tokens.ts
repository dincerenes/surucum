/**
 * Tasarım belirteçleri.
 *
 * İki kısıt biçimi belirliyor:
 * 1. Sürücü ekrana güneş altında ve gece bakıyor — kontrast yüksek olmalı,
 *    karanlık tema sonradan eklenen bir süs değil, birinci sınıf durum.
 * 2. Girişler tek elle, araç hareket hâlindeyken yapılıyor — dokunma
 *    hedefleri büyük, yazı tipleri okunaklı.
 *
 * Vurgu rengi kasıtlı olarak yeşil DEĞİL: yeşil ve kırmızı anlamsal olarak
 * kazanç ve gidere ayrılmış durumda. Etkileşim rengi bunlarla çakışırsa
 * "bu buton mu yoksa kâr mı" belirsizliği doğar.
 */

export interface Colors {
  background: string;
  surface: string;
  surfaceSunken: string;

  text: string;
  textSoft: string;
  textFaint: string;

  border: string;
  borderStrong: string;

  accent: string;
  accentText: string;
  accentSoft: string;

  positive: string;
  positiveSoft: string;
  negative: string;
  negativeSoft: string;
  warning: string;
  warningSoft: string;
}

export type ColorScheme = 'light' | 'dark';

export const palette: Record<ColorScheme, Colors> = {
  light: {
    background: '#F4F6F4',
    surface: '#FFFFFF',
    surfaceSunken: '#EAEEEB',

    text: '#141C18',
    textSoft: '#586460',
    textFaint: '#8B9691',

    border: '#D6DDD8',
    borderStrong: '#B4BEB8',

    accent: '#0E5A63',
    accentText: '#FFFFFF',
    accentSoft: '#DCEDEF',

    positive: '#15803D',
    positiveSoft: '#DCF3E4',
    negative: '#B3261E',
    negativeSoft: '#FADEDC',
    warning: '#8A5D14',
    warningSoft: '#F6E9CF',
  },
  dark: {
    background: '#101512',
    surface: '#191F1B',
    surfaceSunken: '#0B0F0D',

    text: '#E6EBE7',
    textSoft: '#9AA5A0',
    textFaint: '#6D7873',

    border: '#2A332E',
    borderStrong: '#3D4842',

    accent: '#4FC3D0',
    accentText: '#062327',
    accentSoft: '#0E3238',

    positive: '#5CC98A',
    positiveSoft: '#12301F',
    negative: '#F2837C',
    negativeSoft: '#3A1A18',
    warning: '#D8A94E',
    warningSoft: '#33280F',
  },
};

/** 4'ün katları — ölçek tutarlı kalsın diye ara değer kullanılmıyor. */
export const space = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 24,
  xxl: 32,
  xxxl: 48,
} as const;

export const radius = {
  sm: 6,
  md: 10,
  lg: 14,
  pill: 999,
} as const;

export const type = {
  display: { fontSize: 30, fontWeight: '700', letterSpacing: -0.6 },
  title: { fontSize: 22, fontWeight: '700', letterSpacing: -0.3 },
  heading: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 16, fontWeight: '400' },
  bodyStrong: { fontSize: 16, fontWeight: '600' },
  caption: { fontSize: 13, fontWeight: '400' },
  label: { fontSize: 12, fontWeight: '600', letterSpacing: 0.8 },
} as const;

/**
 * Dokunma hedefi alt sınırı. Apple 44pt öneriyor; sürücü hareket hâlindeki
 * bir araçta dokunduğu için 52'ye çıkarıldı.
 */
export const HIT_SIZE = 52;
