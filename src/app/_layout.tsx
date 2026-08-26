// Bu import HER ŞEYDEN ÖNCE gelmeli: uuid'in ihtiyaç duyduğu
// globalThis.crypto.getRandomValues'ı kuruyor.
import '@/lib/crypto-polyfill';

import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';
import { Slot } from 'expo-router';
import { useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { getDb } from '@/db/client';
import { runDataLayerSmoke } from '@/db/dev-smoke';
import { AuthProvider } from '@/lib/auth/auth-context';
import { space, useTheme } from '@/theme/use-theme';
import migrations from '../../drizzle/migrations';

export default function RootLayout() {
  const { colors, scheme } = useTheme();
  const { success, error } = useMigrations(getDb(), migrations);

  /**
   * GEÇİCİ — veri katmanının cihazda koştuğunu doğrulayan sınama.
   * Oturumdan bağımsız çalışır ve kendi verisini siler. Faz 2'nin
   * gerçek ekranları geldiğinde bu blok da `dev-smoke.ts` de silinecek.
   */
  useEffect(() => {
    if (!success || !__DEV__) return;
    const checks = runDataLayerSmoke();
    const failed = checks.filter((c) => !c.ok);
    console.log(`SMOKE_BASLADI ${checks.length - failed.length}/${checks.length}`);
    for (const c of checks) console.log(`SMOKE ${c.ok ? 'OK ' : 'FAIL'} ${c.label} :: ${c.detail}`);
    console.log('SMOKE_BITTI');
  }, [success]);

  if (error) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <Text style={[styles.errorTitle, { color: colors.text }]}>
          Veritabanı hazırlanamadı
        </Text>
        <Text style={[styles.errorBody, { color: colors.textSoft }]}>{error.message}</Text>
        <Text style={[styles.hint, { color: colors.textFaint }]}>
          Uygulamayı kapatıp yeniden açın. Verileriniz cihazda duruyor, kaybolmadı.
        </Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View style={[styles.center, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} />
        <Text style={[styles.hint, { color: colors.textSoft }]}>Hazırlanıyor…</Text>
      </View>
    );
  }

  return (
    <AuthProvider>
      <StatusBar style={scheme === 'dark' ? 'light' : 'dark'} />
      <Slot />
    </AuthProvider>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: space.xxl,
    gap: space.md,
  },
  errorTitle: { fontSize: 18, fontWeight: '600' },
  errorBody: { fontSize: 14, textAlign: 'center' },
  hint: { fontSize: 13, textAlign: 'center' },
});
