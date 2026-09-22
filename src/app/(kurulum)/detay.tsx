import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AboveKeyboard, AmountInput, Button, Chip, ChipGrid } from '@/components/ui';
import { completeOnboarding, createVehicle, updateSettings } from '@/db/repo';
import { FUEL_TYPE_LABELS, type FuelType } from '@/db/schema/_shared';
import { useAuth } from '@/lib/auth/auth-context';
import { toggleFuelSelection } from '@/lib/fuel-selection';
import { parseWholeKm } from '@/lib/whole-number';
import { requestSync } from '@/sync/scheduler';
import { space, type as typeScale, useTheme } from '@/theme/use-theme';

const SELECTABLE: FuelType[] = ['gasoline', 'diesel', 'lpg', 'electric'];

/**
 * Kurulum 2/2 — yakıt ve kilometre. Son adım: "Devam" kurulumu bitirir.
 *
 * YIPRANMA PAYI BURADA NE SORULUYOR NE GÖSTERİLİYOR. Sürücü aracının kaç
 * kilometrede ne kadar değer kaybettiğini bilmiyor; ilk dakikada ona
 * "2,50 ₺/km" gibi bir katsayı göstermek soru sormadan kafa karıştırıyordu.
 * Değer araç düzenlemede, sahiplik biçiminin yanında okunabiliyor.
 *
 * Günlük hedef de sorulmuyor — isteyen sonradan Profil'den ekliyor.
 * Eskiden üçüncü bir adımdı ve sürücüyü uygulamayı görmeden önce bir
 * karar vermeye zorluyordu.
 */
export default function DetailStep() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const params = useLocalSearchParams<{
    make: string; model: string; year: string; label: string;
  }>();

  const [fuels, setFuels] = useState<FuelType[]>(['gasoline']);
  const [odometer, setOdometer] = useState('');

  const label = params.label || 'Aracım';
  const valid = fuels.length > 0;

  function devam() {
    if (!user?.id || !valid) return;

    const vehicle = createVehicle(user.id, {
      label,
      ownership: 'owned',
      fuelTypes: fuels,
      make: params.make ?? null,
      model: params.model ?? null,
      modelYear: params.year ? Number(params.year) : null,
      initialOdometerKm: parseWholeKm(odometer),
    });
    updateSettings(user.id, { defaultVehicleId: vehicle.id });
    completeOnboarding(user.id);
    requestSync();
    router.replace('/');
  }

  return (
    <AboveKeyboard>
      <View style={[styles.page, { paddingTop: insets.top + space.xxl }]}>
        <ScrollView contentContainerStyle={styles.body} keyboardShouldPersistTaps="handled">
          <Text style={[typeScale.display, { color: colors.text }]}>{label}</Text>
          <Text style={[typeScale.body, { color: colors.textSoft }]}>
            Yakıt tipini bilmeden gerçek kâr hesaplanamaz.
          </Text>

          <View style={styles.block}>
            <Text style={[styles.label, { color: colors.textSoft }]}>YAKIT</Text>
            <ChipGrid>
              {SELECTABLE.map((f) => (
                <Chip
                  key={f}
                  label={FUEL_TYPE_LABELS[f]}
                  selected={fuels.includes(f)}
                  onPress={() => setFuels((cur) => toggleFuelSelection(cur, f))}
                />
              ))}
            </ChipGrid>
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>
              {'Birini seç. Dönüşümlü LPG\'li araçta benzine LPG\'yi de ekleyebilirsin.'}
            </Text>
          </View>

          <AmountInput
            label="Aracın kilometresi" value={odometer} onChangeText={setOdometer}
            unit="km" keyboard="number-pad" hint="Zorunlu değil."
          />
        </ScrollView>

        <Button label="Başla" onPress={devam} disabled={!valid} />
      </View>
    </AboveKeyboard>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: space.xl, paddingBottom: space.xl },
  body: { gap: space.lg, paddingBottom: space.xl },
  block: { gap: space.sm },
  label: { ...typeScale.label, textTransform: 'uppercase' },
});
