import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/lib/auth/auth-context';
import { useDriver } from '@/lib/use-driver';
import { useSync } from '@/sync/use-sync';
import { useTheme } from '@/theme/use-theme';

/**
 * Oturum bekçisi ve modal yığını.
 *
 * Sekmeler kendi grubunda (`(sekmeler)`); sefer ekleme, gider, yakıt ve
 * vardiya bitirme sihirbazı BU yığında duruyor. Sekme dizinine konsalardı
 * expo-router her birini ayrı bir sekme yapardı.
 */
export default function AppLayout() {
  const { session, restoring, cloudAvailable } = useAuth();
  const { colors } = useTheme();

  /** Senkron zamanlayıcısı oturum açıkken çalışır, çıkışta durur. */
  useSync(Boolean(session));

  const { needsSetup } = useDriver();

  if (restoring) {
    return (
      <View style={{
        flex: 1, alignItems: 'center', justifyContent: 'center',
        backgroundColor: colors.background,
      }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  // Bulut yapılandırılmışsa oturum şart; değilse yerel mod.
  if (cloudAvailable && !session) return <Redirect href="/giris" />;

  /**
   * Araç yoksa uygulama kullanılamaz: vardiya bir araca bağlanıyor,
   * yıpranma payı ondan geliyor. Kurulum atlanabilir bir adım değil.
   */
  if (needsSetup) return <Redirect href="/arac" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="(sekmeler)" />
      <Stack.Screen name="sefer" options={{ presentation: 'modal' }} />
      <Stack.Screen name="gider" options={{ presentation: 'modal' }} />
      <Stack.Screen name="yakit" options={{ presentation: 'modal' }} />
      <Stack.Screen name="kayit" options={{ presentation: 'modal' }} />
      <Stack.Screen name="vardiya" options={{ presentation: 'modal' }} />
      <Stack.Screen
        name="vardiya-bitir"
        options={{ presentation: 'fullScreenModal', gestureEnabled: false }}
      />
    </Stack>
  );
}
