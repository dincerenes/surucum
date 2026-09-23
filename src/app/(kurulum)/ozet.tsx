import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { SetupStep } from '@/components/setup-step';
import { BrandBadge, Card } from '@/components/ui';
import {
  completeOnboarding, createVehicle, listActiveVehicles, updateSettings,
} from '@/db/repo';
import { FUEL_TYPE_LABELS, TRANSMISSION_LABELS } from '@/db/schema/_shared';
import { useAuth } from '@/lib/auth/auth-context';
import { formatKurus } from '@/lib/money';
import { draftLabel, draftWearInputs, useSetupDraft } from '@/lib/setup-draft';
import { type WearPart, calculateWear } from '@/lib/wear';
import { parseWholeKm } from '@/lib/whole-number';
import { requestSync } from '@/sync/scheduler';
import { space, type as typeScale, useTheme } from '@/theme/use-theme';

const perKm = (part: WearPart) => `${formatKurus(Math.round(part.perKm))}/km`;

/**
 * Kurulum 7 — özet ve başla.
 *
 * Sürücü cevaplarından çıkan yıpranma payını KALEM KALEM görüyor: tek bir
 * "2,01 ₺/km" sayısına güvenmesi, nereden geldiğini görmesiyle mümkün.
 * Atlanan kalemler "tahmini" diye işaretli.
 *
 * Araç BURADA yazılıyor — önceki adımlar yalnızca taslağı dolduruyor.
 */
export default function SummaryStep() {
  const { colors } = useTheme();
  const { user } = useAuth();
  const { draft } = useSetupDraft();

  const label = draftLabel(draft);
  const inputs = draftWearInputs(draft);
  const wear = calculateWear(inputs);

  const rows: { title: string; part: WearPart }[] = [
    { title: 'Bakım', part: wear.maintenance },
    { title: 'Lastik', part: wear.tires },
    { title: 'Değer kaybı', part: wear.depreciation },
  ];

  const facts = [
    draft.fuels.map((f) => FUEL_TYPE_LABELS[f]).join(' + '),
    draft.transmission ? TRANSMISSION_LABELS[draft.transmission] : null,
  ].filter(Boolean).join(' · ');

  function basla() {
    if (!user?.id) return;

    // Araç bu arada buluttan indiyse yenisi açılmaz — çift araç olmasın.
    if (listActiveVehicles(user.id).length > 0) {
      router.replace('/');
      return;
    }

    const vehicle = createVehicle(user.id, {
      label,
      ownership: 'owned',
      fuelTypes: draft.fuels,
      make: draft.make,
      model: draft.model,
      modelYear: draft.year ? Number(draft.year) : null,
      initialOdometerKm: parseWholeKm(draft.odometer),
      transmission: draft.transmission,
      ...inputs,
      hasAccidentRecord: draft.accident,
    });
    updateSettings(user.id, { defaultVehicleId: vehicle.id });
    const signupName = user.user_metadata?.display_name;
    completeOnboarding(user.id, typeof signupName === 'string' ? signupName : null);
    requestSync();
    router.replace('/');
  }

  return (
    <SetupStep
      step={7}
      title="Her şey hazır"
      subtitle="Kontrol et, sonra başla. Hepsini sonradan Profil → Araçlarım'dan değiştirebilirsin."
      primary={{ label: 'Başla', onPress: basla }}
    >
      <Card>
        <View style={styles.vehicle}>
          <BrandBadge make={draft.make} size={52} />
          <View style={styles.flex}>
            <Text style={[typeScale.title, { color: colors.text }]}>{label}</Text>
            <Text style={[typeScale.caption, { color: colors.textSoft }]}>{facts}</Text>
          </View>
        </View>
      </Card>

      <Card title="Aracın her km'de ne kadar eriyor?" icon={{ ios: 'gauge.with.dots.needle.33percent', android: 'speed' }}
      >
        <View style={styles.rows}>
          {rows.map(({ title, part }) => (
            <View key={title} style={styles.row}>
              <Text style={[typeScale.body, { color: colors.textSoft }]}>
                {title}
                {part.estimated ? (
                  <Text style={{ color: colors.textFaint }}> (tahmini)</Text>
                ) : null}
              </Text>
              <Text style={[typeScale.bodyStrong, { color: colors.text }]}>{perKm(part)}</Text>
            </View>
          ))}
          <View style={[styles.row, styles.total, { borderTopColor: colors.border }]}>
            <Text style={[typeScale.bodyStrong, { color: colors.text }]}>Toplam</Text>
            <Text style={[typeScale.title, { color: colors.accent }]}>
              {`${formatKurus(wear.total)}/km`}
            </Text>
          </View>
        </View>
        <Text style={[typeScale.caption, { color: colors.textFaint }]}>
          Yakıt bu hesaba dahil değil, girdiğin dolumlardan ayrıca hesaplanıyor.
          Bu pay her vardiyada gittiğin km ile çarpılıp gerçek kârından düşülür.
        </Text>
      </Card>
    </SetupStep>
  );
}

const styles = StyleSheet.create({
  vehicle: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  flex: { flex: 1, gap: space.xs },
  rows: { gap: space.sm },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  total: { borderTopWidth: StyleSheet.hairlineWidth, paddingTop: space.sm, marginTop: space.xs },
});
