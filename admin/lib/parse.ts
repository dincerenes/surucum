/**
 * Kullanıcı girdisinden kuruş üretir.
 *
 * TASARIM KARARI — dönüşüm METİN üzerinde yapılıyor, sayı üzerinden değil.
 * `Number('48.99') * 100` JavaScript'te 4898.999999999999 verir ve
 * yuvarlama bir kuruş kaydırır. Tam sayı kuruş kuralı, girdinin okunduğu
 * bu sınırda korunmazsa hiç korunmamış olur.
 *
 * Türkçe girdide ondalık ayırıcı virgül, binlik ayırıcı noktadır. Ama
 * klavye alışkanlığı karışık: "48.99" yazan da olur. Kural:
 *   - iki ayırıcı da varsa, en sağdaki ondalıktır
 *   - yalnız virgül varsa ondalıktır
 *   - yalnız nokta varsa ve ardından tam üç hane geliyorsa binliktir
 *     ("1.234" = bin iki yüz otuz dört), değilse ondalıktır ("48.99")
 */
export function parseKurus(input: string): number | null {
  const cleaned = input.replace(/[\s₺]/g, '').trim();
  if (!cleaned) return null;

  const negative = cleaned.startsWith('-');
  const body = negative ? cleaned.slice(1) : cleaned;

  if (!/^[\d.,]+$/.test(body)) return null;

  const lastComma = body.lastIndexOf(',');
  const lastDot = body.lastIndexOf('.');

  let decimalPos = -1;
  if (lastComma >= 0 && lastDot >= 0) {
    decimalPos = Math.max(lastComma, lastDot);
  } else if (lastComma >= 0) {
    decimalPos = lastComma;
  } else if (lastDot >= 0) {
    decimalPos = body.length - lastDot - 1 === 3 ? -1 : lastDot;
  }

  const whole = (decimalPos >= 0 ? body.slice(0, decimalPos) : body).replace(/[.,]/g, '');
  const fractionRaw = decimalPos >= 0 ? body.slice(decimalPos + 1).replace(/[.,]/g, '') : '';

  if (!/^\d*$/.test(whole) || !/^\d*$/.test(fractionRaw)) return null;
  if (whole === '' && fractionRaw === '') return null;
  if (fractionRaw.length > 6) return null;

  // İki haneye tamamla; üçüncü hane varsa sıfırdan uzağa yuvarla.
  const fraction = fractionRaw.padEnd(2, '0');
  let kurus = Number(whole || '0') * 100 + Number(fraction.slice(0, 2) || '0');
  if (fraction.length > 2 && Number(fraction[2]) >= 5) kurus += 1;

  if (!Number.isSafeInteger(kurus)) return null;
  return negative ? -kurus : kurus;
}

/** Kuruşu form alanına yazılacak düzenlenebilir metne çevirir: 4899 → "48,99" */
export function kurusToInput(kurus: number): string {
  const negative = kurus < 0;
  const magnitude = Math.abs(Math.trunc(kurus));
  const text = `${Math.floor(magnitude / 100)},${String(magnitude % 100).padStart(2, '0')}`;
  return negative ? `-${text}` : text;
}

/**
 * Tarayıcının <input type="datetime-local"> değerini kesin bir ana çevirir.
 *
 * "2026-08-25T14:30" saat dilimi taşımaz. Doğrudan veritabanına verilseydi
 * Postgres onu sunucunun saat dilimine (Supabase'de UTC) göre yorumlar ve
 * yönetici saat 14:30 diye girdiği duyuru 17:30'da yayına girerdi.
 *
 * Türkiye 2016'dan beri yaz saati uygulamıyor ve sabit UTC+03'te; bu yüzden
 * ofset doğrudan eklenebiliyor. Yaz saati olsaydı bu kısayol yılda iki kez
 * bir saat hata verirdi.
 */
const ISTANBUL_OFFSET = '+03:00';

export function istanbulLocalToIso(value: string): string | null {
  if (!value) return null;
  const m = /^(\d{4}-\d{2}-\d{2})T(\d{2}:\d{2})(?::(\d{2}))?$/.exec(value.trim());
  if (!m) return null;
  return `${m[1]}T${m[2]}:${m[3] ?? '00'}${ISTANBUL_OFFSET}`;
}

/** timestamptz → <input type="datetime-local"> değeri (Istanbul yerel saati) */
export function isoToIstanbulLocal(value: string | null | undefined): string {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Europe/Istanbul',
    year: 'numeric', month: '2-digit', day: '2-digit',
    hour: '2-digit', minute: '2-digit', hour12: false,
  }).formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? '';
  // en-CA saati 24:00 olarak verebiliyor; datetime-local bunu kabul etmez.
  const hour = get('hour') === '24' ? '00' : get('hour');
  return `${get('year')}-${get('month')}-${get('day')}T${hour}:${get('minute')}`;
}
