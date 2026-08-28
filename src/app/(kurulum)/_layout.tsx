import { Redirect, Stack } from 'expo-router';

import { useAuth } from '@/lib/auth/auth-context';
import { useTheme } from '@/theme/use-theme';

/**
 * İlk kurulum yığını.
 *
 * Oturum şart: kurulumda üretilen araç ve ayarlar bir kullanıcıya
 * bağlanıyor. Geri jesti kapalı — sürücü ekranı kazara kaydırıp
 * yarım kalmış bir kurulumla uygulamaya düşmemeli.
 */
export default function SetupLayout() {
  const { session, cloudAvailable } = useAuth();
  const { colors } = useTheme();

  if (cloudAvailable && !session) return <Redirect href="/giris" />;

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        gestureEnabled: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    />
  );
}
