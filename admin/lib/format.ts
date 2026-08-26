/**
 * Biçimlendirme.
 *
 * Para burada da TAM SAYI KURUŞ. Mobil taraftaki kural panelde de geçerli:
 * hiçbir tutar lira cinsinden kayan noktaya çevrilip öyle biçimlendirilmez.
 * Kuruş, tam sayı bölme ve kalan ile ayrıştırılır — 1234567 kuruş her zaman
 * "12.345,67" olur, 12345.669999 gibi bir ara değer hiç oluşmaz.
 */

const TZ = 'Europe/Istanbul';

function groupThousands(digits: string): string {
  return digits.replace(/\B(?=(\d{3})+(?!\d))/g, '.');
}

export function formatKurus(
  kurus: number | null | undefined,
  options: { symbol?: boolean; decimals?: boolean } = {},
): string {
  const { symbol = true, decimals = true } = options;
  if (kurus === null || kurus === undefined || !Number.isFinite(kurus)) return '—';

  const negative = kurus < 0;
  const magnitude = Math.abs(Math.trunc(kurus));

  const lira = Math.floor(magnitude / 100);
  const cents = magnitude % 100;

  let out = groupThousands(String(lira));
  if (decimals) out += ',' + String(cents).padStart(2, '0');
  if (negative) out = '−' + out;
  if (symbol) out += ' ₺';
  return out;
}

/** Panodaki büyük sayılar için: 1.234.567 kuruş → "12,3 B ₺" */
export function formatKurusCompact(kurus: number | null | undefined): string {
  if (kurus === null || kurus === undefined || !Number.isFinite(kurus)) return '—';
  const lira = Math.abs(kurus) / 100;
  const sign = kurus < 0 ? '−' : '';

  if (lira >= 1_000_000) return `${sign}${(lira / 1_000_000).toFixed(1).replace('.', ',')} M ₺`;
  if (lira >= 10_000) return `${sign}${(lira / 1000).toFixed(1).replace('.', ',')} B ₺`;
  return formatKurus(kurus, { decimals: false });
}

export function formatInt(n: number | null | undefined): string {
  if (n === null || n === undefined || !Number.isFinite(n)) return '—';
  const negative = n < 0;
  return (negative ? '−' : '') + groupThousands(String(Math.abs(Math.trunc(n))));
}

export function formatPercent(value: number | null | undefined, digits = 1): string {
  if (value === null || value === undefined || !Number.isFinite(value)) return '—';
  return `%${value.toFixed(digits).replace('.', ',')}`;
}

const dateTimeFormat = new Intl.DateTimeFormat('tr-TR', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
});

const dateFormat = new Intl.DateTimeFormat('tr-TR', {
  timeZone: TZ,
  day: '2-digit',
  month: '2-digit',
  year: 'numeric',
});

const dayMonthFormat = new Intl.DateTimeFormat('tr-TR', {
  timeZone: TZ,
  day: '2-digit',
  month: 'short',
});

export function formatDateTime(value: string | null | undefined): string {
  if (!value) return '—';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return dateTimeFormat.format(d);
}

export function formatDate(value: string | null | undefined): string {
  if (!value) return '—';
  // 'YYYY-MM-DD' saatsizdir; Date onu UTC gece yarısı sayar ve
  // Europe/Istanbul'a çevrilince bir gün kayabilirdi. Bu yüzden
  // saat dilimi dönüşümüne hiç sokmadan elle çeviriyoruz.
  const plain = /^\d{4}-\d{2}-\d{2}$/.exec(value);
  if (plain) {
    const [y, m, d] = value.split('-');
    return `${d}.${m}.${y}`;
  }
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '—';
  return dateFormat.format(d);
}

export function formatDayMonth(value: string): string {
  const [y, m, d] = value.split('-').map(Number);
  return dayMonthFormat.format(new Date(Date.UTC(y, m - 1, d, 12)));
}

/** "3 saat önce", "dün", "2 gün önce" */
export function formatRelative(value: string | null | undefined): string {
  if (!value) return 'hiç';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return 'hiç';

  const diffMs = Date.now() - d.getTime();
  const minutes = Math.floor(diffMs / 60_000);

  if (minutes < 1) return 'az önce';
  if (minutes < 60) return `${minutes} dk önce`;

  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} sa önce`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'dün';
  if (days < 30) return `${days} gün önce`;

  const months = Math.floor(days / 30);
  if (months < 12) return `${months} ay önce`;
  return `${Math.floor(months / 12)} yıl önce`;
}

export const FUEL_TYPE_LABELS: Record<string, string> = {
  gasoline: 'Benzin',
  diesel: 'Motorin',
  lpg: 'LPG',
  cng: 'CNG',
  electric: 'Elektrik',
};

export const FUEL_UNIT_LABELS: Record<string, string> = {
  gasoline: 'lt',
  diesel: 'lt',
  lpg: 'lt',
  cng: 'kg',
  electric: 'kWh',
};

export const ADMIN_ROLE_LABELS: Record<string, string> = {
  owner: 'Sahip',
  admin: 'Yönetici',
  support: 'Destek',
};

/** Sürücü tablolarının panelde gösterilen adları. */
export const USER_TABLE_LABELS: Record<string, string> = {
  app_settings: 'Ayarlar',
  vehicles: 'Araçlar',
  vehicle_fuel_types: 'Araç yakıt tipleri',
  earning_sources: 'Kazanç kaynakları',
  expense_categories: 'Gider kategorileri',
  shifts: 'Vardiyalar',
  rides: 'Seferler',
  expenses: 'Giderler',
  recurring_expenses: 'Düzenli giderler',
  fuel_logs: 'Yakıt kayıtları',
  goals: 'Hedefler',
};

/**
 * Ham satır hücresi.
 *
 * Sütun adından tipi çıkarıyoruz çünkü ham görünüm on bir farklı tabloyu
 * tek bileşenle gösteriyor ve her tablo için ayrı şema tutmak, şema
 * değiştikçe unutulacak bir ikinci kaynak yaratırdı. Adlandırma kuralı
 * (`*_kurus`, `*_at`) veri katmanında zaten tutarlı.
 */
const UNIX_MS_COLUMNS = new Set([
  'created_at', 'updated_at', 'deleted_at', 'occurred_at',
  'started_at', 'ended_at', 'onboarding_completed_at', 'fetched_at',
]);

export function formatCell(key: string, value: unknown): string {
  if (value === null || value === undefined) return '—';

  if (typeof value === 'boolean') return value ? 'Evet' : 'Hayır';

  if (typeof value === 'number') {
    if (key.endsWith('_kurus')) return formatKurus(value);
    if (key.endsWith('_bps')) return `%${(value / 100).toFixed(2).replace('.', ',')}`;
    // Unix milisaniye — saniye sanılıp 1970'e düşmesin diye sütun adından
    // ayırt ediliyor.
    if (UNIX_MS_COLUMNS.has(key)) return formatDateTime(new Date(value).toISOString());
    return formatInt(value);
  }

  if (typeof value === 'string') {
    if (key === 'server_updated_at') return formatDateTime(value);
    if (key === 'business_date' || key.endsWith('_date')) return formatDate(value);
    return value;
  }

  return JSON.stringify(value);
}
