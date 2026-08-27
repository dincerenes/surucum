import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/lib/auth/auth-context';
import { useSync } from '@/sync/use-sync';
import { useTheme } from '@/theme/use-theme';

export default function AppLayout() {
  const { session, restoring, cloudAvailable } = useAuth();
  const { colors } = useTheme();

  /**
   * Senkron zamanlayıcısı oturum açıkken çalışır.
   *
   * Burada, giriş ekranlarının dışındaki yerleşimde başlatılıyor: kullanıcı
   * uygulamanın içindeyken açık, çıkış yapınca kendiliğinden duruyor.
   */
  useSync(Boolean(session));

  if (restoring) {
    return (
      <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background }}>
        <ActivityIndicator color={colors.accent} />
      </View>
    );
  }

  // Bulut yapılandırılmışsa oturum şart; değilse yerel mod.
  if (cloudAvailable && !session) {
    return <Redirect href="/giris" />;
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
