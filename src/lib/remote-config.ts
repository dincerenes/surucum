import AsyncStorage from '@react-native-async-storage/async-storage';

import { getSupabase } from './supabase';

/**
 * Uzaktan yapılandırma — özellik bayrakları.
 *
 * TASARIM KARARI — okuma EŞZAMANLI, tazeleme eşzamansız.
 *
 * Ekran çizimi asla ağ beklemez. Bayraklar açılışta cihaz belleğinden
 * okunur, arka planda buluttan tazelenir ve bir sonraki açılışta yeni
 * değerle çalışılır. Aksi hâlde her ekran, tünelde internetsiz kalmış bir
 * sürücüde boş boş beklerdi.
 *
 * ÇEVRİMDIŞI VARSAYILANI AÇIK. Bilinmeyen bir bayrak `true` döner:
 * uygulama v1'de tamamen ücretsiz ve bulut zorunlu değil. Varsayılan
 * `false` olsaydı, bulutu hiç yapılandırmamış bir kullanıcıda uygulamanın
 * yarısı kapalı açılırdı.
 *
 * Bayraklar bu yüzden ÖZELLİK KAPATMA ANAHTARIDIR: bozulan bir özelliği
 * sürüm çıkmadan kapatmaya yarar, ücretli katman kapısı değildir.
 */

const CACHE_KEY = 'remote_config_v1';

/** Bayat sayılma süresi. Bundan eskisi açılışta yeniden çekilir. */
const STALE_AFTER_MS = 6 * 60 * 60 * 1000;

export interface FlagState {
  isEnabled: boolean;
  rolloutPercent: number;
}

interface CachedConfig {
  flags: Record<string, FlagState>;
  fetchedAt: number;
}

let cache: CachedConfig = { flags: {}, fetchedAt: 0 };
let hydrated = false;
let currentUserId: string | null = null;

/**
 * Kullanıcıya sabit bir kova numarası verir (0–99).
 *
 * Rastgele sayı KULLANILMAZ: her açılışta farklı sonuç verir ve kademeli
 * açılıştaki bir özellik kullanıcının gözünde açılıp kapanır. Özet
 * fonksiyonu aynı kullanıcı için her zaman aynı kovayı üretir.
 *
 * Anahtar da özete giriyor — girmeseydi hep aynı %10'luk dilim bütün
 * kademeli açılışları görür, geri kalan hiçbirini görmezdi.
 */
function bucketOf(userId: string, key: string): number {
  const input = `${userId}:${key}`;
  // FNV-1a, 32 bit. Kriptografik değil; burada gereken tek şey dağılım.
  let hash = 0x811c9dc5;
  for (let i = 0; i < input.length; i++) {
    hash ^= input.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193) >>> 0;
  }
  return hash % 100;
}

/** Oturum açıldığında/kapandığında çağrılır; kademeli açılış bunu kullanır. */
export function setRemoteConfigUser(userId: string | null): void {
  currentUserId = userId;
}

/** Cihazdaki son bilinen yapılandırmayı belleğe alır. Açılışta bir kez. */
export async function hydrateRemoteConfig(): Promise<void> {
  if (hydrated) return;
  hydrated = true;

  try {
    const raw = await AsyncStorage.getItem(CACHE_KEY);
    if (!raw) return;
    const parsed = JSON.parse(raw) as CachedConfig;
    if (parsed && typeof parsed === 'object' && parsed.flags) {
      cache = { flags: parsed.flags, fetchedAt: parsed.fetchedAt ?? 0 };
    }
  } catch {
    // Bozuk önbellek, yapılandırmasız devam etmekten daha kötü değil.
    // Varsayılanlar zaten açık.
  }
}

/** Buluttan tazeler. Bulut yoksa veya ağ yoksa sessizce vazgeçer. */
export async function refreshRemoteConfig(options: { force?: boolean } = {}): Promise<boolean> {
  if (!options.force && Date.now() - cache.fetchedAt < STALE_AFTER_MS) return false;

  const supabase = getSupabase();
  if (!supabase) return false;

  const { data, error } = await supabase
    .from('feature_flags')
    .select('key, is_enabled, rollout_percent');

  if (error || !data) return false;

  const flags: Record<string, FlagState> = {};
  for (const row of data as { key: string; is_enabled: boolean; rollout_percent: number }[]) {
    flags[row.key] = {
      isEnabled: row.is_enabled,
      rolloutPercent: row.rollout_percent,
    };
  }

  cache = { flags, fetchedAt: Date.now() };

  try {
    await AsyncStorage.setItem(CACHE_KEY, JSON.stringify(cache));
  } catch {
    // Yazılamadıysa bu oturumda bellekteki değer geçerli kalır.
  }

  return true;
}

/**
 * Bayrağın bu cihazda açık olup olmadığı. EŞZAMANLI.
 *
 * Bayrak hiç tanımlı değilse `true` döner — bkz. dosya başındaki
 * çevrimdışı varsayılanı notu.
 */
export function isFlagEnabled(key: string): boolean {
  const flag = cache.flags[key];
  if (!flag) return true;
  if (!flag.isEnabled) return false;
  if (flag.rolloutPercent >= 100) return true;
  if (flag.rolloutPercent <= 0) return false;

  // Oturum yoksa kademeli açılış uygulanamaz; bayrak açık sayılır.
  if (!currentUserId) return true;

  return bucketOf(currentUserId, key) < flag.rolloutPercent;
}

/** Tanılama için: bellekteki yapılandırmanın anlık kopyası. */
export function remoteConfigSnapshot(): CachedConfig {
  return { flags: { ...cache.flags }, fetchedAt: cache.fetchedAt };
}
