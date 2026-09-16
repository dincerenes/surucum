import { useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AboveKeyboard, AmountInput, Button } from '@/components/ui';
import { completeOnboarding, setGoal, startShift } from '@/db/repo';
import { useAuth } from '@/lib/auth/auth-context';
import { parseAmount } from '@/lib/money';
import { useDriver } from '@/lib/use-driver';
import { requestSync } from '@/sync/scheduler';
import { radius, space, type as typeScale, useTheme } from '@/theme/use-theme';

/**
 * Kurulum 3/3 — hedef ve ilk vardiya.
 *
 * Hedef CİROYA DEĞİL cebe kalana konuyor: sürücünün önemsediği kaç para
 * döndürdüğü değil, kaç para kaldığı. Ciroya hedef koymak, yakıt ve
 * komisyonu görmezden gelen bir başarı ölçüsü yaratır.
 */
export default function ReadyStep() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const { vehicle } = useDriver();
  const [goalText, setGoalText] = useState('');

  function bitir(startNow: boolean) {
    if (!user?.id) return;
    /**
     * Hedef boş bırakılabilir — `setGoal` okunamayan girdiyi hedefsiz
     * sayıyor. Soruyu sorup cevabı atmak, hiç sormamaktan kötü.
     */
    setGoal(user.id, parseAmount(goalText));
    completeOnboarding(user.id);
    if (startNow && vehicle) startShift(user.id, vehicle.id);
    requestSync();
    router.replace('/');
  }

  return (
    <AboveKeyboard>
      <View style={[styles.page, { paddingTop: insets.top + space.xxl }]}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={[typeScale.display, { color: colors.text }]}>Hazırsın</Text>
          <Text style={[typeScale.body, { color: colors.textSoft }]}>
            Son bir ayar. Sonradan profilden değiştirebilirsin.
          </Text>

          <AmountInput
            label="Günlük hedef · cebe kalan"
            value={goalText}
            onChangeText={setGoalText}
            hint="Hedefi ciroya değil cebe kalana koyuyoruz — kaç para kazandığın, kaç para döndürdüğün değil."
          />

          <View style={[styles.note, { backgroundColor: colors.surfaceSunken }]}>
            <Text style={[typeScale.bodyStrong, { color: colors.text }]}>
              Nasıl çalışıyor
            </Text>
            <Text style={[typeScale.body, { color: colors.textSoft }]}>
              Vardiyayı başlat, gün boyu aldığın paraları tek tek yaz.
              Bitirirken kaç km yaptığını ve uygulamaya ödediğin komisyonu
              sor, gerisini ben hesaplarım.
            </Text>
          </View>

          {vehicle ? (
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>
              Aracın: {vehicle.label}
            </Text>
          ) : null}
        </ScrollView>

        <View style={styles.foot}>
          <Button label="İlk vardiyayı başlat" onPress={() => bitir(true)} />
          <Button
            label="Şimdilik sadece gezmek istiyorum"
            variant="ghost"
            onPress={() => bitir(false)}
          />
        </View>
      </View>
    </AboveKeyboard>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: space.xl, paddingBottom: space.xl },
  body: { gap: space.lg, paddingBottom: space.xl },
  note: { borderRadius: radius.md, padding: space.lg, gap: space.xs },
  foot: { gap: space.sm },
});
