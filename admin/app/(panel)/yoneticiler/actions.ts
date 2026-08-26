'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';

import { createClient } from '@/lib/supabase/server';

const PATH = '/yoneticiler';

function back(params: Record<string, string>): never {
  redirect(`${PATH}?${new URLSearchParams(params)}`);
}

export async function grantRole(formData: FormData) {
  const email = String(formData.get('email') ?? '').trim();
  const role = String(formData.get('role') ?? '').trim();

  if (!email) back({ hata: 'E-posta zorunlu.' });

  const supabase = await createClient();
  // Rol atama RPC üzerinden: e-posta → kullanıcı kimliği çözümlemesi
  // sunucuda yapılıyor, panelin auth.users'a erişimi yok.
  const { error } = await supabase.rpc('admin_grant_role', { p_email: email, p_role: role });

  if (error) back({ hata: error.message });

  revalidatePath(PATH);
  back({ sonuc: `${email} için yetki verildi.` });
}

export async function revokeRole(formData: FormData) {
  const userId = String(formData.get('user_id') ?? '');
  if (!userId) back({ hata: 'Kullanıcı bulunamadı.' });

  const supabase = await createClient();
  const { error } = await supabase.rpc('admin_revoke_role', { p_user_id: userId });

  if (error) back({ hata: error.message });

  revalidatePath(PATH);
  back({ sonuc: 'Yetki kaldırıldı.' });
}
