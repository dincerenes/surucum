import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, Card } from '@/components/ui';
import { useDbValue } from '@/db/use-db';
import {
  getActiveGoal, getKnownFuelFigures, getSettings, listActiveVehicles,
  listVehicleFuelTypes,
} from '@/db/repo';
import { getSyncStatus } from '@/sync/state';
import { FUEL_TYPE_LABELS } from '@/db/schema/_shared';
import { useAuth } from '@/lib/auth/auth-context';
import { formatDecimal, formatInteger, formatKurus } from '@/lib/money';
import { useDriver } from '@/lib/use-driver';
import { pendingCount } from '@/sync/push';
import { HIT_SIZE, radius, space, type as typeScale, useTheme } from '@/theme/use-theme';

/**
 * Profil — hesap, aktif araç ve menü.
 *
 * Menü satırları BİR SATIR ÖZET taşıyor: "Ayarlar" tek başına ne
 * bulacağını söylemiyor, "Kesme saati 04:00 · Koyu tema" söylüyor.
 * Sürücü çoğu zaman girmeden cevabını alıyor.
 */
export default function ProfileScreen() {
  const { colors, preference } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, signOut } = useAuth();
  const { vehicle } = useDriver();

  const info = useDbValue(() => {
    if (!user?.id) return null;
    return {
      fuels: vehicle
        ? listVehicleFuelTypes(vehicle.id)
            .map((f) => FUEL_TYPE_LABELS[f.fuelType]).join(' + ')
        : '',
      figures: vehicle ? getKnownFuelFigures(vehicle.id) : null,
      vehicleCount: listActiveVehicles(user.id).length,
      cutoff: getSettings(user.id)?.dayCutoffHour ?? 4,
      goal: getActiveGoal(user.id, 'daily')?.targetNetKurus ?? null,
      sync: getSyncStatus(),
      pending: pendingCount(),
    };
  }, [user?.id, vehicle?.id]);

  const themeLabel =
    preference === 'light' ? 'açık tema'
    : preference === 'dark' ? 'koyu tema'
    : 'cihazla aynı tema';

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
              <Tag text={`${formatInteger(vehicle.initialOdometerKm)} km`} />
            ) : null}
            {vehicle.wearPerKmKurus > 0 ? (
              <Tag text={`${formatKurus(vehicle.wearPerKmKurus)}/km yıpranma`} />
            ) : null}
          </View>
          {info?.figures?.consumptionPer100Km ? (
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>
              Ortalama tüketim {formatDecimal(info.figures.consumptionPer100Km / 1000)} lt/100km
              {info.figures.unitPriceKurus
                ? ` · son yakıt ${formatKurus(info.figures.unitPriceKurus)}/lt`
                : ''}
            </Text>
          ) : null}
        </Card>
      ) : null}

      <View style={[styles.menu, { borderColor: colors.border }]}>
        <MenuRow
          label="Araçlarım"
          detail={
            info && info.vehicleCount > 1
              ? `${info.vehicleCount} araç · aktif ${vehicle?.label ?? '—'}`
              : (vehicle?.label ?? 'Araç ekle')
          }
          onPress={() => router.push('/araclar')}
          first
        />
        <MenuRow
          label="Ayarlar"
          detail={
            `Kesme saati ${String(info?.cutoff ?? 4).padStart(2, '0')}:00 · ${themeLabel}`
            + (info?.goal ? ` · hedef ${formatKurus(info.goal, { decimals: false })}` : '')
          }
          onPress={() => router.push('/ayarlar')}
        />
      </View>

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

function MenuRow({
  label, detail, onPress, first = false,
}: { label: string; detail: string; onPress: () => void; first?: boolean }) {
  const { colors } = useTheme();

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      style={({ pressed }) => [
        styles.row,
        !first && { borderTopWidth: 1, borderTopColor: colors.border },
        { backgroundColor: pressed ? colors.surfaceSunken : colors.surface },
      ]}
    >
      <View style={styles.rowText}>
        <Text style={[typeScale.bodyStrong, { color: colors.text }]}>{label}</Text>
        <Text
          style={[typeScale.caption, { color: colors.textFaint }]}
          numberOfLines={1}
        >
          {detail}
        </Text>
      </View>
      <Text style={[typeScale.title, { color: colors.textFaint }]}>›</Text>
    </Pressable>
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
  menu: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    minHeight: HIT_SIZE,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  rowText: { flex: 1, gap: 2 },
});
