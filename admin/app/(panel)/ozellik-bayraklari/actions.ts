'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

const PATH = '/ozellik-bayraklari';

function back(params: Record<string, string>): never {
  redirect(`${PATH}?${new URLSearchParams(params)}`);
}

export async function saveFlag(formData: FormData) {
  const key = String(formData.get('key') ?? '').trim();
  if (!key) back({ hata: 'Anahtar zorunlu.' });

  const rolloutRaw = String(formData.get('rollout_percent') ?? '100').trim();
  const rollout = Number.parseInt(rolloutRaw, 10);
  if (!Number.isInteger(rollout) || rollout < 0 || rollout > 100) {
    back({ hata: 'Kademeli açılış oranı 0 ile 100 arasında bir tam sayı olmalı.' });
  }

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  const { error } = await supabase.from('feature_flags').upsert(
    {
      key,
      description: String(formData.get('description') ?? '').trim(),
      is_enabled: formData.get('is_enabled') === 'on',
      rollout_percent: rollout,
      updated_by: userData.user?.id ?? null,
    },
    { onConflict: 'key' },
  );

  if (error) back({ hata: error.message });

  revalidatePath(PATH);
  back({ sonuc: `"${key}" kaydedildi.` });
}

export async function toggleFlag(formData: FormData) {
  const key = String(formData.get('key') ?? '');
  const next = formData.get('next') === '1';
  if (!key) back({ hata: 'Anahtar bulunamadı.' });

  const supabase = await createClient();
  const { data: userData } = await supabase.auth.getUser();

  const { error } = await supabase
    .from('feature_flags')
    .update({ is_enabled: next, updated_by: userData.user?.id ?? null })
    .eq('key', key);

  if (error) back({ hata: error.message });

  revalidatePath(PATH);
  back({ sonuc: `"${key}" ${next ? 'açıldı' : 'kapatıldı'}.` });
}

export async function deleteFlag(formData: FormData) {
  const key = String(formData.get('key') ?? '');
  if (!key) back({ hata: 'Anahtar bulunamadı.' });

  const supabase = await createClient();
  const { error } = await supabase.from('feature_flags').delete().eq('key', key);
  if (error) back({ hata: error.message });

  revalidatePath(PATH);
  back({ sonuc: `"${key}" silindi.` });
}
