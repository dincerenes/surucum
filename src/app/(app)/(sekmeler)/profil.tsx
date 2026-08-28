import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card } from '@/components/ui';
import { useDbValue } from '@/db/use-db';
import { getKnownFuelFigures, listVehicleFuelTypes } from '@/db/repo';
import { getSyncStatus } from '@/sync/state';
import { FUEL_TYPE_LABELS } from '@/db/schema/_shared';
import { useAuth } from '@/lib/auth/auth-context';
import { formatKurus } from '@/lib/money';
import { useDriver } from '@/lib/use-driver';
import { pendingCount } from '@/sync/push';
import { radius, space, type as typeScale, useTheme } from '@/theme/use-theme';

/** Profil — araç, hesap, senkron durumu. */
export default function ProfileScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { vehicle } = useDriver();

  const info = useDbValue(() => {
    if (!vehicle) return null;
    const fuels = listVehicleFuelTypes(vehicle.id);
    return {
      fuels: fuels.map((f) => FUEL_TYPE_LABELS[f.fuelType]).join(' + '),
      figures: getKnownFuelFigures(vehicle.id),
      sync: getSyncStatus(),
      pending: pendingCount(),
    };
  }, [vehicle?.id]);

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.lg }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[typeScale.display, { color: colors.text }]}>Profil</Text>

      {vehicle ? (
        <Card title="Aracın">
          <Text style={[typeScale.title, { color: colors.text }]}>{vehicle.label}</Text>
          <View style={styles.chips}>
            {info?.fuels ? <Tag text={info.fuels} /> : null}
            {vehicle.initialOdometerKm ? (
              <Tag text={`${vehicle.initialOdometerKm.toLocaleString('tr-TR')} km`} />
            ) : null}
          </View>
          {info?.figures.consumptionPer100Km ? (
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>
              Ortalama tüketim {(info.figures.consumptionPer100Km / 1000).toFixed(1)} lt/100km
              {info.figures.unitPriceKurus
                ? ` · son yakıt ${formatKurus(info.figures.unitPriceKurus)}/lt`
                : ''}
            </Text>
          ) : null}
        </Card>
      ) : null}

      <Card title="Hesap">
        <Text style={[typeScale.body, { color: colors.text }]}>
          {user?.email ?? 'Yerel mod — hesap yok'}
        </Text>
        <Text style={[typeScale.caption, { color: colors.textFaint }]}>
          {info?.pending
            ? `${info.pending} kayıt yedeklenmeyi bekliyor`
            : info?.sync.lastSuccessAt
              ? 'Tüm kayıtlar yedeklendi'
              : 'Kayıtların cihazında tutuluyor, bulut yalnızca yedek.'}
        </Text>
      </Card>

      {user ? <Button label="Çıkış yap" variant="secondary" onPress={signOut} /> : null}
    </ScrollView>
  );
}

function Tag({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.tag, { backgroundColor: colors.surfaceSunken }]}>
      <Text style={[typeScale.caption, { color: colors.textSoft }]}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xxxl, gap: space.lg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  tag: { borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 4 },
});
