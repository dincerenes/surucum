'use client';

import { createBrowserClient } from '@supabase/ssr';

import { SUPABASE_KEY, SUPABASE_URL } from '../env';

/** Tarayıcı istemcisi. Yalnızca giriş/çıkış formları kullanır. */
export function createClient() {
  return createBrowserClient(SUPABASE_URL, SUPABASE_KEY);
}
