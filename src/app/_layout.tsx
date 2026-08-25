// Bu import HER ŞEYDEN ÖNCE gelmeli: uuid'in ihtiyaç duyduğu
// globalThis.crypto.getRandomValues'ı kuruyor.
import '@/lib/crypto-polyfill';

import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';
import { useMigrations } from 'drizzle-orm/expo-sqlite/migrator';

import { getDb } from '@/db/client';
import migrations from '../../drizzle/migrations';

export default function RootLayout() {
  const { success, error } = useMigrations(getDb(), migrations);

  if (error) {
    return (
      <View style={styles.center}>
        <Text style={styles.errorTitle}>Veritabanı hazırlanamadı</Text>
        <Text style={styles.errorBody}>{error.message}</Text>
        <Text style={styles.hint}>
          Uygulamayı kapatıp yeniden açın. Sorun sürerse verileriniz cihazda
          duruyor, kaybolmadı.
        </Text>
      </View>
    );
  }

  if (!success) {
    return (
      <View style={styles.center}>
        <ActivityIndicator />
        <Text style={styles.loading}>Hazırlanıyor…</Text>
      </View>
    );
  }

  return (
    <>
      <StatusBar style="auto" />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 32,
    gap: 12,
  },
  loading: { fontSize: 15, opacity: 0.6 },
  errorTitle: { fontSize: 18, fontWeight: '600' },
  errorBody: { fontSize: 14, opacity: 0.8, textAlign: 'center' },
  hint: { fontSize: 13, opacity: 0.55, textAlign: 'center', marginTop: 8 },
});
