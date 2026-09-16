import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, PageHeader } from '@/components/ui';
import { useDbValue } from '@/db/use-db';
import {
  getSettings, listActiveVehicles, listVehicleFuelTypes, updateSettings,
} from '@/db/repo';
import { FUEL_TYPE_LABELS, OWNERSHIP_LABELS } from '@/db/schema/_shared';
import { useAuth } from '@/lib/auth/auth-context';
import { formatKurus } from '@/lib/money';
import { requestSync } from '@/sync/scheduler';
import { radius, space, type as typeScale, useTheme } from '@/theme/use-theme';

/**
 * Araçlarım — liste ve AKTİF ARAÇ seçimi.
 *
 * Aktif araç yalnızca bir etiket değil: yeni vardiya ona bağlanıyor ve
 * yıpranma payı onun oranından geliyor. Sürücü aracını değiştirdiğinde
 * seçimi yapabilmeli, yoksa yeni aracın kilometreleri eski aracın
 * oranıyla hesaplanır.
 *
 * Araç SİLİNMEZ, pasifleşir — silinseydi ona bağlı geçmiş vardiya ve
 * yakıt kayıtları sahipsiz kalır ve geçmiş raporlar bozulurdu.
 */
export default function VehiclesScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const data = useDbValue(() => {
    if (!userId) return null;
    const vehicles = listActiveVehicles(userId);
    return {
      /**
       * Varsayılan araç ayarda boşsa listenin ilki geçerli — `useDriver`
       * da öyle davranıyor. İki yerin farklı araç seçmesi, sürücünün
       * gördüğü aracı ile kaydın gittiği aracın ayrışması demekti.
       */
      activeId: getSettings(userId)?.defaultVehicleId ?? vehicles[0]?.id ?? null,
      vehicles: vehicles.map((v) => ({
        vehicle: v,
        fuels: listVehicleFuelTypes(v.id)
          .map((f) => FUEL_TYPE_LABELS[f.fuelType]).join(' + '),
      })),
    };
  }, [userId]);

  function sec(vehicleId: string) {
    if (!userId) return;
    updateSettings(userId, { defaultVehicleId: vehicleId });
    requestSync();
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.lg }]}
      showsVerticalScrollIndicator={false}
    >
      <PageHeader />

      <Text style={[typeScale.display, { color: colors.text }]}>Araçlarım</Text>

      {data?.vehicles.map(({ vehicle, fuels }) => {
        const active = data.activeId === vehicle.id;

        return (
          <Pressable
            key={vehicle.id}
            onPress={() => sec(vehicle.id)}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            style={({ pressed }) => [
              styles.card,
              {
                backgroundColor: colors.surface,
                borderColor: active ? colors.accent : colors.border,
                borderWidth: active ? 2 : 1,
                opacity: pressed ? 0.9 : 1,
              },
            ]}
          >
            <View style={styles.cardHead}>
              <Text style={[typeScale.title, { color: colors.text }]}>
                {vehicle.label}
              </Text>
              {active ? (
                <Text style={[styles.badge, { color: colors.accent }]}>AKTİF</Text>
              ) : null}
            </View>

            <Text style={[typeScale.caption, { color: colors.textFaint }]}>
              {OWNERSHIP_LABELS[vehicle.ownership]}
              {fuels ? ` · ${fuels}` : ''}
            </Text>

            <Text style={[typeScale.caption, { color: colors.textFaint }]}>
              {vehicle.wearPerKmKurus > 0
                ? `Yıpranma payı ${formatKurus(vehicle.wearPerKmKurus)}/km`
                : 'Yıpranma payı yok — aracın değer kaybı senin cebinden çıkmıyor'}
            </Text>

            <Pressable
              onPress={() => router.push({
                pathname: '/arac-duzenle', params: { id: vehicle.id },
              })}
              accessibilityRole="button"
              hitSlop={space.sm}
              style={styles.edit}
            >
              <Text style={[typeScale.bodyStrong, { color: colors.accent }]}>
                Düzenle
              </Text>
            </Pressable>
          </Pressable>
        );
      })}

      <Button
        label="Araç ekle"
        variant="secondary"
        plus
        onPress={() => router.push('/arac-duzenle')}
      />

      <Text style={[typeScale.caption, { color: colors.textFaint }]}>
        Araca dokunmak onu aktif yapar. Yeni vardiyalar aktif araca
        yazılır; geçmiş kayıtlar kendi aracında kalır.
      </Text>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xxxl, gap: space.md },
  card: { borderRadius: radius.lg, padding: space.lg, gap: space.xs },
  cardHead: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: space.sm,
  },
  badge: { ...typeScale.label, letterSpacing: 1 },
  edit: { alignSelf: 'flex-start', paddingTop: space.sm, minHeight: 40 },
});
