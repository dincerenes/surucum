import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmountText, Button, RideList } from '@/components/ui';
import { startShift } from '@/db/repo';
import { formatKurus } from '@/lib/money';
import { earningsPerRide } from '@/lib/shift';
import { useDriver } from '@/lib/use-driver';
import { requestSync } from '@/sync/scheduler';
import { radius, space, type as typeScale, useTheme } from '@/theme/use-theme';

/**
 * Sürüş — açık vardiyanın tam ekran hâli.
 *
 * Sürücü gün boyu bu ekranda. Tek dev hedef var: "Sefer ekle". Anasayfa
 * kaydırılabilir bir defter; burada kaydırma yok, başparmak nereye
 * gideceğini düşünmüyor.
 *
 * BURADAKİ HER SAYI AÇIK VARDİYANIN — günün değil. Bir iş gününde iki
 * vardiya olabilir; ekran "CANLI VARDİYA" diyorsa parası da o vardiyanın
 * olmalı. Karıştırıldığında sürücü yeni başlattığı boş vardiyada bir
 * öncekinin parasını görüyordu.
 *
 * Gösterilen sayı CİRO, cebe kalan değil. Komisyon ve yakıt vardiya
 * sonunda soruluyor; vardiya sürerken ikisi de bilinmiyor ve bilinmeyen
 * bir kesintiyi düşülmüş gibi göstermek sayıya olan güveni bitirir.
 * Günün üç satırı Anasayfa'da, gerçek rakamlarla duruyor.
 */
export default function DriveScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const state = useDriver();
  const { openShift, userId, vehicle } = state;

  if (!openShift) return <ClosedState onStart={() => {
    if (!userId || !vehicle) return;
    startShift(userId, vehicle.id);
    requestSync();
  }} />;

  const minutes = state.openShiftMinutes;
  const rides = state.shiftRides;
  const gross = state.shiftGross;
  /**
   * ₺/saat ve ₺/km YOK.
   *
   * ₺/saat vardiyanın başında saçmalıyor: on beş dakikada 2.250 ₺ girildiğinde
   * "9.000 ₺/saat" yazıyor. Sürücü o hızla çalışmayacağını biliyor; sayı
   * ona bir şey öğretmiyor, sadece uygulamanın ciddiyetini düşürüyor.
   * Anlamlı hâli vardiya kapandığında, tam süre belliyken hesaplanıyor.
   *
   * ₺/km ise kilometre vardiya sonunda sorulduğu için canlı ekranda
   * her zaman boş kalıyordu. ₺/sefer her seferde güncelleniyor ve
   * ilk seferden itibaren doğru.
   */
  const perRide = earningsPerRide(gross, rides.length);

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
        <Text style={[styles.eyebrow, { color: colors.textFaint }]}>BU VARDİYANIN CİROSU</Text>
        <AmountText value={gross} size="display" />
        <Text style={[typeScale.caption, { color: colors.textFaint }]}>
          komisyon ve yakıt vardiya sonunda düşülür
        </Text>
      </View>

      <View style={styles.stats}>
        <Stat value={String(rides.length)} label="sefer" />
        <Stat
          value={perRide != null ? formatKurus(perRide, { symbol: false, decimals: false }) : '—'}
          label="₺/sefer"
        />
      </View>

      <ScrollView
        style={styles.feed}
        contentContainerStyle={styles.feedBody}
        showsVerticalScrollIndicator={false}
      >
        <RideList
          rides={rides}
          emptyText="Henüz sefer yok. İlk parayı aldığında aşağıdaki butona bas."
        />
      </ScrollView>

      <View style={styles.liveActions}>
        <Button label="Sefer ekle" size="hero" plus onPress={() => router.push('/sefer')} />
        <View style={styles.pair}>
          <Button label="Gider" variant="secondary" style={styles.half}
            onPress={() => router.push('/gider')} />
          <Button label="Yakıt" variant="secondary" style={styles.half}
            onPress={() => router.push('/yakit')} />
        </View>
        <Button label="Vardiyayı bitir" variant="secondary"
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
  stats: { flexDirection: 'row', gap: space.sm, marginTop: space.lg },
  feed: { flex: 1, marginTop: space.lg },
  feedBody: { paddingBottom: space.lg },
  stat: { flex: 1, borderRadius: radius.md, padding: space.md, gap: 2 },
  liveActions: { paddingBottom: space.xl, gap: space.md },
  pair: { flexDirection: 'row', gap: space.md },
  half: { flex: 1 },
  closed: {
    flex: 1, paddingHorizontal: space.xl, alignItems: 'center', gap: space.lg,
  },
});
