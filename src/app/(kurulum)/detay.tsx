import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AboveKeyboard, AmountInput, Button, Chip, ChipGrid } from '@/components/ui';
import { createVehicle, updateSettings } from '@/db/repo';
import {
  FUEL_TYPE_LABELS, type FuelType, defaultWearPerKm,
} from '@/db/schema/_shared';
import { useAuth } from '@/lib/auth/auth-context';
import { formatKurus } from '@/lib/money';
import { requestSync } from '@/sync/scheduler';
import { radius, space, type as typeScale, useTheme } from '@/theme/use-theme';

const SELECTABLE: FuelType[] = ['gasoline', 'diesel', 'lpg', 'electric'];

/**
 * Kurulum 2/3 — yakıt ve kilometre.
 *
 * YIPRANMA PAYI BURADA SORULMUYOR. Tasarım onu düzenlenebilir bir alan
 * yapmıştı; kural bunun tersini söylüyor. Sürücü aracının kaç kilometrede
 * ne kadar değer kaybettiğini bilmiyor — sorarsak ya boş bırakır ya
 * rastgele bir sayı yazar, ikisi de raporu kirletir.
 *
 * Yine de GİZLENMİYOR: atanan değer okunabilir bir satır olarak duruyor,
 * çünkü sürücü sonradan "bu 500 lira nereden çıktı" diye sorduğunda
 * cevabı görmüş olmalı.
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
  const wear = defaultWearPerKm('owned');
  const valid = fuels.length > 0;

  function toggle(f: FuelType) {
    setFuels((cur) => (cur.includes(f)
      ? cur.filter((x) => x !== f)
      : [...cur, f]));
  }

  function devam() {
    if (!user?.id || !valid) return;
    const km = Number(odometer.replace(/[.\s]/g, '').replace(',', '.'));

    const vehicle = createVehicle(user.id, {
      label,
      ownership: 'owned',
      fuelTypes: fuels,
      make: params.make ?? null,
      model: params.model ?? null,
      modelYear: params.year ? Number(params.year) : null,
      initialOdometerKm: Number.isFinite(km) && km > 0 ? Math.round(km) : null,
    });
    updateSettings(user.id, { defaultVehicleId: vehicle.id });
    requestSync();
    router.push('/hazir');
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
                  onPress={() => toggle(f)}
                />
              ))}
            </ChipGrid>
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>
              Dönüşümlü LPG'li araçta hem benzini hem LPG'yi seç.
            </Text>
          </View>

          <AmountInput
            label="Kilometre" value={odometer} onChangeText={setOdometer}
            unit="km" hint="Zorunlu değil."
          />

          <View style={[styles.wear, { backgroundColor: colors.surfaceSunken }]}>
            <View style={styles.wearRow}>
              <Text style={[typeScale.body, { color: colors.textSoft }]}>Yıpranma payı</Text>
              <Text style={[typeScale.bodyStrong, { color: colors.text }]}>
                {formatKurus(wear)}/km
              </Text>
            </View>
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>
              Amortisman, lastik, bakım, sigorta ve vergiyi kapsayan tek
              katsayı. Bilerek düşük tuttuk; senden bir şey istemiyoruz.
            </Text>
          </View>
        </ScrollView>

        <Button label="Devam" onPress={devam} disabled={!valid} />
      </View>
    </AboveKeyboard>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: space.xl, paddingBottom: space.xl },
  body: { gap: space.lg, paddingBottom: space.xl },
  block: { gap: space.sm },
  label: { ...typeScale.label, textTransform: 'uppercase' },
  wear: { borderRadius: radius.md, padding: space.md, gap: space.xs },
  wearRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
  },
});
