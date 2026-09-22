import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmountInput, Button, Card, Chip, ChipRow, PageHeader } from '@/components/ui';
import { useDbValue } from '@/db/use-db';
import {
  THEME_LABELS, THEME_PREFERENCES, getActiveGoal, setGoal,
} from '@/db/repo';
import { useAuth } from '@/lib/auth/auth-context';
import { formatAmountForInput, parseAmount } from '@/lib/money';
import { requestSync } from '@/sync/scheduler';
import { space, type as typeScale, useTheme } from '@/theme/use-theme';
import { useState } from 'react';

/**
 * Ayarlar — tema ve günlük hedef.
 *
 * İkisi farklı yerlerde duruyor ve bu bilinçli: tema CİHAZA ait (telefon
 * koyu, tablet açık olabilir), hedef ise sürücünün kendi kararı ve
 * geçmişi var. Gün kesme saati artık ayar değil (bkz.
 * `DEFAULT_CUTOFF_HOUR`).
 */
export default function SettingsScreen() {
  const { colors, preference, setPreference } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const data = useDbValue(() => {
    if (!userId) return null;
    return { goal: getActiveGoal(userId, 'daily') ?? null };
  }, [userId]);

  const [goalText, setGoalText] = useState<string | null>(null);

  const goalValue = goalText ?? formatAmountForInput(data?.goal?.targetNetKurus ?? null);

  function hedefKaydet() {
    if (!userId) return;
    setGoal(userId, parseAmount(goalValue));
    requestSync();
    router.back();
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.lg }]}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <PageHeader />

      <Text style={[typeScale.display, { color: colors.text }]}>Ayarlar</Text>

      <Card title="Tema">
        <ChipRow>
          {THEME_PREFERENCES.map((t) => (
            <Chip
              key={t}
              label={THEME_LABELS[t]}
              selected={preference === t}
              onPress={() => setPreference(t)}
            />
          ))}
        </ChipRow>
        <Text style={[typeScale.caption, { color: colors.textFaint }]}>
          Tema bu cihazda kalır, diğer cihazına geçmez.
        </Text>
      </Card>

      <Card title="Günlük hedef">
        <AmountInput
          label="Cebe kalan hedefi"
          value={goalValue}
          onChangeText={setGoalText}
          hint="Boş bırakırsan hedef gösterilmez. Hedef ciroya değil cebe kalana konur."
        />
        <Button label="Hedefi kaydet" onPress={hedefKaydet} />
      </Card>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xxxl, gap: space.lg },
});
