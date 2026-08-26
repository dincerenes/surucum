import { redirect } from 'next/navigation';

import { createClient } from './supabase/server';
import type { AdminRole } from './types';

export interface AdminSession {
  userId: string;
  email: string;
  role: AdminRole;
}

/**
 * Sayfanın yönetici oturumu.
 *
 * Buradaki denetim KULLANIM KOLAYLIĞI içindir, güvenlik sınırı değildir.
 * Gerçek sınır veritabanında: her RPC ve her politika `is_admin()` sorar.
 * Bu fonksiyon yalnızca, yetkisi olmayan birine boş tablolar ve yetki
 * hataları yerine anlaşılır bir sayfa göstermeyi sağlar.
 */
export async function requireAdmin(): Promise<AdminSession> {
  const supabase = await createClient();

  const { data: userData } = await supabase.auth.getUser();
  if (!userData.user) redirect('/giris');

  const { data: role, error } = await supabase.rpc('admin_role');
  if (error || !role) redirect('/yetkisiz');

  return {
    userId: userData.user.id,
    email: userData.user.email ?? '',
    role: role as AdminRole,
  };
}

/** Ham sürücü verisi açmaya yetkili mi? 'support' değildir. */
export function canReadRawData(role: AdminRole): boolean {
  return role === 'owner' || role === 'admin';
}

/** Yönetim tablolarını düzenleyebilir mi? */
export function canWrite(role: AdminRole): boolean {
  return role === 'owner' || role === 'admin';
}
