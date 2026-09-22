import { router } from 'expo-router';
import { useEffect } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import Animated, {
  Easing, useAnimatedStyle, useSharedValue, withRepeat, withTiming,
} from 'react-native-reanimated';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmountText, Button, Icon, RideList } from '@/components/ui';
import { useDbValue } from '@/db/use-db';
import { getLastClosedShift, getShiftSummary, listVehicleFuelTypes, startShift } from '@/db/repo';
import { FUEL_TYPE_LABELS } from '@/db/schema/_shared';
import { formatBusinessDate, formatClock } from '@/lib/business-date';
import { formatInteger, formatKurus } from '@/lib/money';
import { earningsPerRide } from '@/lib/shift';
import { useDriver } from '@/lib/use-driver';
import { requestSync } from '@/sync/scheduler';
import { radius, space, type as typeScale, useTheme } from '@/theme/use-theme';

/**
 * Sürüş — açık vardiyanın tam ekran hâli.
 *
 * Sürücü gün boyu bu ekranda. Tek dev hedef var: "Yolcu ekle". Anasayfa
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
        <Stat value={formatInteger(rides.length)} label="yolcu" />
        <Stat
          value={perRide != null ? formatKurus(perRide, { symbol: false, decimals: false }) : '—'}
          label="₺/yolcu"
        />
      </View>

      <ScrollView
        style={styles.feed}
        contentContainerStyle={styles.feedBody}
        showsVerticalScrollIndicator={false}
      >
        <RideList
          rides={rides}
          emptyText="Henüz yolcu yok. İlk parayı aldığında aşağıdaki butona bas."
        />
      </ScrollView>

      <View style={styles.liveActions}>
        <Button label="Yolcu ekle" size="hero" plus onPress={() => router.push('/sefer')} />
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

/** Başlat butonunun çapı — ekranın ortasında, başparmağın düşünmeden gittiği yer. */
const START_SIZE = 200;

/**
 * Vardiya kapalıyken: ortada BÜYÜK bir Başlat butonu.
 *
 * Eskiden bir başlık, bir paragraf ve ekran genişliğinde sıradan bir
 * butondu; sekme boş ve cansız görünüyordu. Sürücü bu ekrana tek bir iş
 * için geliyor: direksiyona geçti, vardiyayı açacak. Buton o işin kendisi
 * ve ekranın ortasında, yavaş bir nabızla duruyor.
 *
 * Üstte hangi araçla başlayacağı (vardiya o araca yazılıyor), altta son
 * vardiyanın özeti: ekran boş kalmıyor ve sürücü nerede kaldığını görüyor.
 *
 * Gider/yakıt girişi YOK: ikisi de yalnızca açık vardiyada giriliyor.
 */
function ClosedState({ onStart }: { onStart: () => void }) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId, vehicle } = useDriver();

  const info = useDbValue(() => {
    if (!userId) return null;
    const last = getLastClosedShift(userId);
    const summary = last ? getShiftSummary(userId, last.id) : null;
    return {
      fuels: vehicle
        ? listVehicleFuelTypes(userId, vehicle.id)
          .map((f) => FUEL_TYPE_LABELS[f.fuelType]).join(' + ')
        : '',
      last: last && summary ? { shift: last, summary } : null,
    };
  }, [userId, vehicle?.id]);

  const pulse = useSharedValue(0);
  useEffect(() => {
    pulse.value = withRepeat(
      withTiming(1, { duration: 1800, easing: Easing.out(Easing.quad) }), -1,
    );
  }, [pulse]);
  const ring = useAnimatedStyle(() => ({
    opacity: 0.35 * (1 - pulse.value),
    transform: [{ scale: 1 + pulse.value * 0.22 }],
  }));

  const last = info?.last ?? null;

  return (
    <View style={[
      styles.closed,
      { backgroundColor: colors.background, paddingTop: insets.top + space.lg },
    ]}>
      <View style={styles.closedHead}>
        <Text style={[typeScale.display, { color: colors.text }]}>Sürüş</Text>
        {vehicle ? (
          <View style={[styles.vehicle, {
            backgroundColor: colors.surface, borderColor: colors.border,
          }]}>
            <Icon name={{ ios: 'car.fill', android: 'directions_car' }} size={18} color={colors.accent} />
            <Text style={[typeScale.bodyStrong, { color: colors.text }]} numberOfLines={1}>
              {vehicle.label}
            </Text>
            {info?.fuels ? (
              <Text style={[typeScale.caption, { color: colors.textFaint }]}>{info.fuels}</Text>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={styles.center}>
        <View style={styles.startWrap}>
          <Animated.View
            pointerEvents="none"
            style={[styles.ring, { backgroundColor: colors.accent }, ring]}
          />
          <Pressable
            onPress={onStart}
            accessibilityRole="button"
            accessibilityLabel="Vardiyayı başlat"
            style={({ pressed }) => [styles.start, {
              backgroundColor: colors.accent,
              transform: [{ scale: pressed ? 0.96 : 1 }],
            }]}
          >
            <Icon name={{ ios: 'play.fill', android: 'play_arrow' }} size={64} color={colors.accentText} />
            <Text style={[typeScale.heading, { color: colors.accentText }]}>Başlat</Text>
          </Pressable>
        </View>
        <Text style={[typeScale.body, styles.hint, { color: colors.textSoft }]}>
          Direksiyona geçtiğinde bas. Vardiya açılınca yolcu eklemek tek dokunuş.
        </Text>
      </View>

      {last ? (
        <Pressable
          onPress={() => router.push({ pathname: '/vardiya', params: { id: last.shift.id } })}
          accessibilityRole="button"
          accessibilityLabel="Son vardiyanın detayı"
          style={({ pressed }) => [styles.last, {
            backgroundColor: pressed ? colors.surfaceSunken : colors.surface,
            borderColor: colors.border,
          }]}
        >
          <View style={styles.lastText}>
            <Text style={[typeScale.label, { color: colors.textFaint }]}>SON VARDİYA</Text>
            <Text style={[typeScale.body, { color: colors.text }]}>
              {formatBusinessDate(last.shift.businessDate, 'dayMonth')}
              {' · '}
              {formatClock(last.shift.startedAt)}–{formatClock(last.shift.endedAt ?? last.shift.startedAt)}
            </Text>
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>
              {formatInteger(last.summary.rideCount)} yolcu
              {last.summary.distanceKm != null
                ? ` · ${formatInteger(last.summary.distanceKm)} km` : ''}
            </Text>
          </View>
          <View style={styles.lastAmount}>
            <AmountText value={last.summary.profit.cashProfit} size="heading" tone="signed" />
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>cebe kalan</Text>
          </View>
        </Pressable>
      ) : null}
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
  closed: { flex: 1, paddingHorizontal: space.xl, paddingBottom: space.xl, gap: space.lg },
  closedHead: { gap: space.md, alignItems: 'flex-start' },
  vehicle: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, maxWidth: '100%',
    borderWidth: 1, borderRadius: radius.pill,
    paddingHorizontal: space.md, paddingVertical: space.sm,
  },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: space.xl },
  startWrap: {
    width: START_SIZE, height: START_SIZE, alignItems: 'center', justifyContent: 'center',
  },
  ring: {
    position: 'absolute', width: START_SIZE, height: START_SIZE, borderRadius: START_SIZE / 2,
  },
  start: {
    width: START_SIZE, height: START_SIZE, borderRadius: START_SIZE / 2,
    alignItems: 'center', justifyContent: 'center', gap: space.xs,
  },
  hint: { textAlign: 'center', maxWidth: 280 },
  last: {
    flexDirection: 'row', alignItems: 'center', gap: space.md,
    borderWidth: 1, borderRadius: radius.lg, padding: space.lg,
  },
  lastText: { flex: 1, gap: 2 },
  lastAmount: { alignItems: 'flex-end', gap: 2 },
});
