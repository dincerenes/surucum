import { Redirect, Stack } from 'expo-router';
import { ActivityIndicator, View } from 'react-native';

import { useAuth } from '@/lib/auth/auth-context';
import { useTheme } from '@/theme/use-theme';

export default function AppLayout() {
  const { session, restoring, cloudAvailable } = useAuth();
  const { colors } = useTheme();

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
