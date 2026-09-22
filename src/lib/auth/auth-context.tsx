import type { Session, User } from '@supabase/supabase-js';
import * as Linking from 'expo-linking';
import {
  createContext, useCallback, useContext, useEffect, useMemo, useState,
  type ReactNode,
} from 'react';

import { getSupabase, isCloudConfigured } from '@/lib/supabase';
import { translateAuthError, validatePassword } from './auth-errors';

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
  /** Şifre sıfırlama bağlantısıyla gelindi; yeni şifre ekranı gösterilmeli. */
  recovery: boolean;
  /**
   * Bağlantıdaki kod oturuma çevrildi, yeni şifre yazılabilir. Çevrilene
   * kadar telefonda kalmış ESKİ bir oturum olabilir; şifre ona yazılırsa
   * başka bir hesabın şifresi değişirdi.
   */
  recoveryReady: boolean;
  recoveryError: string | null;
}

interface AuthActions {
  signUp(email: string, password: string): Promise<AuthResult>;
  signIn(email: string, password: string): Promise<AuthResult>;
  signOut(): Promise<void>;
  sendPasswordReset(email: string): Promise<AuthResult>;
  updatePassword(password: string): Promise<AuthResult>;
  cancelRecovery(): void;
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
  /**
   * Bulut yoksa geri yüklenecek oturum da yok: `restoring` baştan kapalı.
   * Açık başlasaydı düzenler yükleme göstergesinde sonsuza kadar kalır ve
   * "Uygulama yapılandırılmamış" ekranı hiç görünmezdi.
   */
  const [restoring, setRestoring] = useState(() => getSupabase() != null);
  const [recovery, setRecovery] = useState(false);
  const [recoveryReady, setRecoveryReady] = useState(false);
  const [recoveryError, setRecoveryError] = useState<string | null>(null);

  const cloudAvailable = isCloudConfigured();

  useEffect(() => {
    const supabase = getSupabase();
    if (!supabase) return;

    let active = true;

    async function processRecoveryLink(url: string | null) {
      if (!url || !url.startsWith('surucum://sifre-yenile')) return;
      /**
       * `new URL(...).searchParams` React Native'de her sürümde yok;
       * expo-linking'in ayrıştırıcısı her platformda aynı çalışıyor.
       */
      const raw = Linking.parse(url).queryParams?.code;
      const code = typeof raw === 'string' ? raw : null;
      setRecovery(true);
      setRecoveryReady(false);
      setRecoveryError(null);
      if (!code) {
        setRecoveryError('Bağlantı geçersiz. Yeni bir şifre sıfırlama bağlantısı iste.');
        return;
      }
      const { error } = await supabase!.auth.exchangeCodeForSession(code);
      if (error) setRecoveryError(translateAuthError(error));
      else setRecoveryReady(true);
    }

    const linkSubscription = Linking.addEventListener('url', ({ url }) => {
      void processRecoveryLink(url);
    });

    void Promise.all([
      supabase.auth.getSession(),
      Linking.getInitialURL().then(processRecoveryLink),
    ]).then(([{ data }]) => {
      if (!active) return;
      setSession(data.session);
      setRestoring(false);
    }).catch(() => {
      if (active) setRestoring(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((event, next) => {
      setSession(next);
      if (event === 'PASSWORD_RECOVERY') {
        setRecovery(true);
        setRecoveryReady(true);
      }
    });

    return () => {
      active = false;
      sub.subscription.unsubscribe();
      linkSubscription.remove();
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

    const { error } = await supabase.auth.resetPasswordForEmail(email.trim(), {
      redirectTo: 'surucum://sifre-yenile',
    });
    if (error) return { ok: false, error: translateAuthError(error) };
    return { ok: true };
  }, []);

  const updatePassword = useCallback(async (password: string): Promise<AuthResult> => {
    const supabase = getSupabase();
    if (!supabase) return CLOUD_UNAVAILABLE;
    if (!recovery || !recoveryReady) {
      return { ok: false, error: 'Şifre sıfırlama bağlantısı gerekli.' };
    }
    const problem = validatePassword(password);
    if (problem) return { ok: false, error: problem };
    const { error } = await supabase.auth.updateUser({ password });
    if (error) return { ok: false, error: translateAuthError(error) };
    setRecovery(false);
    setRecoveryReady(false);
    setRecoveryError(null);
    return { ok: true };
  }, [recovery, recoveryReady]);

  const cancelRecovery = useCallback(() => {
    setRecovery(false);
    setRecoveryReady(false);
    setRecoveryError(null);
  }, []);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      restoring,
      cloudAvailable,
      recovery,
      recoveryReady,
      recoveryError,
      signUp,
      signIn,
      signOut,
      sendPasswordReset,
      updatePassword,
      cancelRecovery,
    }),
    [
      session, restoring, cloudAvailable, recovery, recoveryReady, recoveryError,
      signUp, signIn, signOut, sendPasswordReset, updatePassword, cancelRecovery,
    ],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth, AuthProvider içinde kullanılmalı');
  return ctx;
}
