import Constants from 'expo-constants';
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';

import { getSupabase } from './supabase';

/**
 * Yönetim panelinden yayımlanan duyurular.
 *
 * Sunucu tarafında RLS zaten yalnızca YAYINDA olan duyuruları veriyor:
 * taslak ve ileri tarihli duyurular cihaza hiç inmiyor. Buradaki ek
 * süzgeç yalnızca platform ve sürüm içindir — onlar istemcinin kendi
 * bildiği şeyler.
 */

export interface Announcement {
  id: string;
  title: string;
  body: string;
  severity: 'info' | 'warning' | 'critical';
  platform: 'all' | 'ios' | 'android';
  min_app_version: string | null;
  starts_at: string;
}

const APP_VERSION = Constants.expoConfig?.version ?? '0.0.0';

/**
 * "0.2.0" ile "0.10.0" karşılaştırması.
 *
 * Metin karşılaştırması kullanılamaz: "0.10.0" < "0.2.0" çıkar ve
 * sürüm hedeflemesi ters döner. Parçalar sayıya çevrilip tek tek
 * karşılaştırılıyor.
 */
function versionAtLeast(current: string, required: string): boolean {
  const a = current.split('.').map((p) => Number.parseInt(p, 10) || 0);
  const b = required.split('.').map((p) => Number.parseInt(p, 10) || 0);
  const len = Math.max(a.length, b.length);

  for (let i = 0; i < len; i++) {
    const x = a[i] ?? 0;
    const y = b[i] ?? 0;
    if (x !== y) return x > y;
  }
  return true;
}

export async function fetchAnnouncements(): Promise<Announcement[]> {
  const supabase = getSupabase();
  if (!supabase) return [];

  const { data, error } = await supabase
    .from('announcements')
    .select('id, title, body, severity, platform, min_app_version, starts_at')
    .order('starts_at', { ascending: false })
    .limit(10);

  if (error || !data) return [];

  return (data as Announcement[]).filter((a) => {
    if (a.platform !== 'all' && a.platform !== Platform.OS) return false;
    if (a.min_app_version && !versionAtLeast(APP_VERSION, a.min_app_version)) return false;
    return true;
  });
}

/** Yayındaki duyurular. Ağ yoksa boş dizi döner, hata göstermez. */
export function useAnnouncements(): Announcement[] {
  const [items, setItems] = useState<Announcement[]>([]);

  useEffect(() => {
    let active = true;
    void fetchAnnouncements().then((next) => {
      if (active) setItems(next);
    });
    return () => {
      active = false;
    };
  }, []);

  return items;
}
