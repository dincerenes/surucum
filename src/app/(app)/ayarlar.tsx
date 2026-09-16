import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmountInput, Button, Card, Chip, ChipRow, PageHeader } from '@/components/ui';
import { useDbValue } from '@/db/use-db';
import {
  THEME_LABELS, THEME_PREFERENCES, getActiveGoal, getSettings, setGoal,
  updateSettings,
} from '@/db/repo';
import { useAuth } from '@/lib/auth/auth-context';
import { DEFAULT_CUTOFF_HOUR } from '@/lib/business-date';
import { parseAmount } from '@/lib/money';
import { requestSync } from '@/sync/scheduler';
import { HIT_SIZE, radius, space, type as typeScale, useTheme } from '@/theme/use-theme';
import { useState } from 'react';

/**
 * Seçilebilir kesme saatleri.
 *
 * SERBEST SAYI DEĞİL, LİSTE. Kesme saati her kaydın hangi güne yazıldığını
 * belirliyor; elle yazılan "25" ya da boş bir alan, sürücünün göremeyeceği
 * bir yerde her günü kaydırırdı. Aralık gece vardiyasının kapsadığı
 * saatler: kimse öğlen 14:00'te gün değiştirmek istemiyor.
 */
const CUTOFF_HOURS = [0, 1, 2, 3, 4, 5, 6, 7, 8] as const;

/**
 * Ayarlar — gün kesme saati, tema ve günlük hedef.
 *
 * Bu üçü birbirinden çok farklı yerlerde duruyor ve bu bilinçli:
 * kesme saati HESABA ait (buluta gider, cihazdan cihaza aynı olmalı),
 * tema CİHAZA ait (telefon koyu, tablet açık olabilir), hedef ise
 * sürücünün kendi kararı ve geçmişi var.
 */
export default function SettingsScreen() {
  const { colors, preference, setPreference } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const data = useDbValue(() => {
    if (!userId) return null;
    return {
      cutoff: getSettings(userId)?.dayCutoffHour ?? DEFAULT_CUTOFF_HOUR,
      goal: getActiveGoal(userId, 'daily') ?? null,
    };
  }, [userId]);

  const [goalText, setGoalText] = useState<string | null>(null);

  const cutoff = data?.cutoff ?? DEFAULT_CUTOFF_HOUR;
  const goalValue = goalText ?? amountInput(data?.goal?.targetNetKurus ?? null);

  function saatSec(hour: number) {
    if (!userId) return;
    updateSettings(userId, { dayCutoffHour: hour });
    requestSync();
  }

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

      <Card title="Gün kesme saati">
        <Text style={[typeScale.body, { color: colors.textSoft }]}>
          Bu saatten önce girilen kayıtlar bir önceki güne yazılır. Gece
          vardiyasında çalışıyorsan işi bitirdiğin saatten sonrasını seç.
        </Text>
        <View style={styles.hours}>
          {CUTOFF_HOURS.map((h) => (
            <Pressable
              key={h}
              onPress={() => saatSec(h)}
              accessibilityRole="button"
              accessibilityState={{ selected: cutoff === h }}
              style={({ pressed }) => [
                styles.hour,
                {
                  backgroundColor: cutoff === h ? colors.accent : colors.surface,
                  borderColor: cutoff === h ? colors.accent : colors.border,
                  opacity: pressed ? 0.85 : 1,
                },
              ]}
            >
              <Text
                style={[
                  typeScale.bodyStrong,
                  {
                    color: cutoff === h ? colors.accentText : colors.text,
                    fontVariant: ['tabular-nums'],
                  },
                ]}
              >
                {String(h).padStart(2, '0')}:00
              </Text>
            </Pressable>
          ))}
        </View>
        <Text style={[typeScale.caption, { color: colors.textFaint }]}>
          Bu ayar GEÇMİŞE İŞLEMEZ — yazılmış kayıtlar kendi gününde kalır.
          Değiştirmek yalnızca bundan sonrasını etkiler.
        </Text>
      </Card>

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

function amountInput(value: number | null): string {
  if (value == null) return '';
  const lira = value / 100;
  return (Number.isInteger(lira) ? String(lira) : lira.toFixed(2)).replace('.', ',');
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xxxl, gap: space.lg },
  hours: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  hour: {
    minHeight: HIT_SIZE,
    minWidth: 78,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
  },
});
