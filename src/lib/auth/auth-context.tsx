import type { Session, User } from '@supabase/supabase-js';
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react';

import { getSupabase, isCloudConfigured } from '@/lib/supabase';
import { translateAuthError } from './auth-errors';

/**
 * Oturum durumu.
 *
 * `restoring` ilk açılışta cihazdaki oturumun okunduğu kısa andır. Bu anda
 * yönlendirme yapılmamalı — yoksa oturumu olan kullanıcı bir an giriş
 * ekranını görür ve sonra ana ekrana atlar.
 */
interface AuthState {
  session: Session | null;
  user: User | null;
  restoring: boolean;
  cloudAvailable: boolean;
}

interface AuthActions {
  signUp(email: string, password: string): Promise<AuthResult>;
  signIn(email: string, password: string): Promise<AuthResult>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<AuthResult>;
}

export type AuthResult =
  | { ok: true; needsEmailConfirmation?: boolean }
  | { ok: false; error: string };

const CLOUD_UNAVAILABLE: AuthResult = {
  ok: false,
  error: 'Bulut bağlantısı yapılandırılmamış.',
};

const AuthContext = createContext<(AuthState & AuthActions) | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [restoring, setRestoring] = useState(true);

  const cloudAvailable = isCloudConfigured();

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) {
      setRestoring(false);
      return;
    }

    let active = true;

    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setSession(data.session);
      setRestoring(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, next) => {
      setSession(next);
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
    };
  }, []);

  const signUp = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const supabase = getSupabase();
    if (!supabase) return CLOUD_UNAVAILABLE;

    const { data, error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    if (error) return { ok: false, error: translateAuthError(error) };

    // Oturum boş dönüyorsa proje e-posta doğrulaması istiyor demektir.
    return { ok: true, needsEmailConfirmation: data.session === null };
  }, []);

  const signIn = useCallback(async (email: string, password: string): Promise<AuthResult> => {
    const supabase = getSupabase();
    if (!supabase) return CLOUD_UNAVAILABLE;

    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    if (error) return { ok: false, error: translateAuthError(error) };
    return { ok: true };
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    if (!supabase) return;
    await supabase.auth.signOut();
    setSession(null);
  }, []);

  const sendPasswordReset = useCallback(async (email: string): Promise<AuthResult> => {
    const supabase = getSupabase();
    if (!supabase) return CLOUD_UNAVAILABLE;

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim());
    if (error) return { ok: false, error: translateAuthError(error) };
    return { ok: true };
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      restoring,
      cloudAvailable,
      signUp,
      signIn,
      signOut,
      sendPasswordReset,
    }),
    [session, restoring, cloudAvailable, signUp, signIn, signOut, sendPasswordReset],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalı');
  return ctx;
}
