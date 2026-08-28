import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmountText, Button } from '@/components/ui';
import { startShift } from '@/db/repo';
import { formatKurus } from '@/lib/money';
import { earningsPerHour, earningsPerKm } from '@/lib/shift';
import { useDriver } from '@/lib/use-driver';
import { requestSync } from '@/sync/scheduler';
import { radius, space, type as typeScale, useTheme } from '@/theme/use-theme';

/**
 * Sürüş — açık vardiyanın tam ekran hâli.
 *
 * Sürücü gün boyu bu ekranda. Tek dev hedef var: "Sefer ekle". Anasayfa
 * kaydırılabilir bir defter; burada kaydırma yok, başparmak nereye
 * gideceğini düşünmüyor.
 */
export default function DriveScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const state = useDriver();
  const { openShift, summary, userId, vehicle } = state;

  if (!openShift) return <ClosedState onStart={() => {
    if (!userId || !vehicle) return;
    startShift(userId, vehicle.id);
    requestSync();
  }} />;

  const minutes = state.openShiftMinutes;
  const cash = summary?.profit.cashProfit ?? (0 as never);
  const perHour = earningsPerHour(cash, minutes);
  const perKm = earningsPerKm(cash, summary?.distanceKm ?? null);

  return (
    <View style={[
      styles.live,
      { backgroundColor: colors.surfaceSunken, paddingTop: insets.top + space.xl },
    ]}>
      <View style={styles.liveHead}>
        <View style={[styles.dot, { backgroundColor: colors.positive }]} />
        <Text style={[styles.eyebrow, { color: colors.positive }]}>CANLI VARDİYA</Text>
      </View>

      <Text style={[styles.clock, { color: colors.text }]}>
        {Math.floor(minutes / 60)}:{String(minutes % 60).padStart(2, '0')}
      </Text>
      <Text style={[typeScale.caption, { color: colors.textFaint }]}>
        saat : dakika · direksiyonda
      </Text>

      <View style={styles.cash}>
        <Text style={[styles.eyebrow, { color: colors.textFaint }]}>CEBE KALAN</Text>
        <AmountText value={cash} size="display" tone="signed" />
      </View>

      <View style={styles.stats}>
        <Stat value={String(state.rides.length)} label="sefer" />
        <Stat
          value={perHour != null ? formatKurus(perHour, { symbol: false, decimals: false }) : '—'}
          label="₺/saat"
        />
        <Stat
          value={perKm != null ? formatKurus(perKm, { symbol: false }) : '—'}
          label="₺/km"
        />
      </View>

      <View style={styles.liveActions}>
        <Button label="Sefer ekle" onPress={() => router.push('/sefer')} />
        <View style={styles.pair}>
          <Button label="Gider" variant="secondary" style={styles.half}
            onPress={() => router.push('/gider')} />
          <Button label="Yakıt" variant="secondary" style={styles.half}
            onPress={() => router.push('/yakit')} />
        </View>
        <Button label="Vardiyayı bitir" variant="ghost"
          onPress={() => router.push('/vardiya-bitir')} />
      </View>
    </View>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface }]}>
      <Text style={[typeScale.title, { color: colors.text, fontVariant: ['tabular-nums'] }]}>
        {value}
      </Text>
      <Text style={[typeScale.caption, { color: colors.textFaint }]}>{label}</Text>
    </View>
  );
}

/** Vardiya kapalıyken sekme boş kalmıyor — buradan da başlatılabiliyor. */
function ClosedState({ onStart }: { onStart: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <View style={[
      styles.closed,
      { backgroundColor: colors.background, paddingTop: insets.top + space.xxxl },
    ]}>
      <Text style={[typeScale.title, { color: colors.text }]}>Vardiya kapalı</Text>
      <Text style={[typeScale.body, { color: colors.textSoft, textAlign: 'center' }]}>
        Direksiyona geçtiğinde vardiyayı başlat. Bu ekran o zaman canlı
        sayaca dönüşür ve sefer eklemek tek dokunuş olur.
      </Text>
      <Button label="Vardiyayı başlat" onPress={onStart} style={{ alignSelf: 'stretch' }} />
    </View>
  );
}

const styles = StyleSheet.create({
  live: { flex: 1, paddingHorizontal: space.xl, gap: space.xs },
  liveHead: { flexDirection: 'row', alignItems: 'center', gap: space.sm },
  dot: { width: 8, height: 8, borderRadius: 4 },
  eyebrow: { ...typeScale.label, letterSpacing: 1 },
  clock: { fontSize: 72, fontWeight: '700', letterSpacing: -2, fontVariant: ['tabular-nums'] },
  cash: { marginTop: space.xl, gap: space.xs },
  stats: { flexDirection: 'row', gap: space.sm, marginTop: space.xl },
  stat: { flex: 1, borderRadius: radius.md, padding: space.md, gap: 2 },
  liveActions: { marginTop: 'auto', paddingBottom: space.xl, gap: space.md },
  pair: { flexDirection: 'row', gap: space.md },
  half: { flex: 1 },
  closed: {
    flex: 1, paddingHorizontal: space.xl, alignItems: 'center', gap: space.lg,
  },
});
