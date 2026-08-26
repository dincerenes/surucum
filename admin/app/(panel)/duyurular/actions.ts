'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { istanbulLocalToIso } from '@/lib/parse';
import { createClient } from '@/lib/supabase/server';

const PATH = '/duyurular';

function back(params: Record<string, string>): never {
  redirect(`${PATH}?${new URLSearchParams(params)}`);
}

interface Payload {
  title: string;
  body: string;
  severity: string;
  platform: string;
  min_app_version: string | null;
  starts_at: string;
  ends_at: string | null;
  is_active: boolean;
}

function read(formData: FormData): Payload | string {
  const title = String(formData.get('title') ?? '').trim();
  const body = String(formData.get('body') ?? '').trim();
  if (!title || !body) return 'Başlık ve metin zorunlu.';

  const startsRaw = String(formData.get('starts_at') ?? '').trim();
  const endsRaw = String(formData.get('ends_at') ?? '').trim();

  const starts_at = startsRaw ? istanbulLocalToIso(startsRaw) : new Date().toISOString();
  if (!starts_at) return 'Başlangıç zamanı okunamadı.';

  let ends_at: string | null = null;
  if (endsRaw) {
    ends_at = istanbulLocalToIso(endsRaw);
    if (!ends_at) return 'Bitiş zamanı okunamadı.';
    if (new Date(ends_at) <= new Date(starts_at)) return 'Bitiş, başlangıçtan sonra olmalı.';
  }

  return {
    title,
    body,
    severity: String(formData.get('severity') ?? 'info'),
    platform: String(formData.get('platform') ?? 'all'),
    min_app_version: String(formData.get('min_app_version') ?? '').trim() || null,
    starts_at,
    ends_at,
    is_active: formData.get('is_active') === 'on',
  };
}

export async function createAnnouncement(formData: FormData) {
  const payload = read(formData);
  if (typeof payload === 'string') back({ hata: payload });

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('announcements')
    .insert({ ...payload, created_by: userData.user?.id ?? null });

  if (error) back({ hata: error.message });

  revalidatePath(PATH);
  back({ sonuc: 'Duyuru oluşturuldu.' });
}

export async function updateAnnouncement(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) back({ hata: 'Duyuru bulunamadı.' });

  const payload = read(formData);
  if (typeof payload === 'string') back({ hata: payload });

  const supabase = await createClient();
  const { error } = await supabase.from('announcements').update(payload).eq('id', id);
  if (error) back({ hata: error.message });

  revalidatePath(PATH);
  back({ sonuc: 'Duyuru güncellendi.' });
}

/** Yayından kaldırma / geri alma. Silmekten farklı: metin ve geçmiş kalır. */
export async function toggleAnnouncement(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  const next = formData.get('next') === '1';
  if (!id) back({ hata: 'Duyuru bulunamadı.' });

  const supabase = await createClient();
  const { error } = await supabase.from('announcements').update({ is_active: next }).eq('id', id);
  if (error) back({ hata: error.message });

  revalidatePath(PATH);
  back({ sonuc: next ? 'Duyuru yayına alındı.' : 'Duyuru yayından kaldırıldı.' });
}

export async function deleteAnnouncement(formData: FormData) {
  const id = String(formData.get('id') ?? '');
  if (!id) back({ hata: 'Duyuru bulunamadı.' });

  const supabase = await createClient();
  const { error } = await supabase.from('announcements').delete().eq('id', id);
  if (error) back({ hata: error.message });

  revalidatePath(PATH);
  back({ sonuc: 'Duyuru silindi.' });
}
