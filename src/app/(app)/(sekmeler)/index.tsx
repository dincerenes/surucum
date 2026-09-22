import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, GoalBar, RideList, SummaryRows } from '@/components/ui';
import { startShift } from '@/db/repo';
import { formatBusinessDate } from '@/lib/business-date';
import { useDriver } from '@/lib/use-driver';
import { requestSync } from '@/sync/scheduler';
import { HIT_SIZE, radius, space, type as typeScale, useTheme } from '@/theme/use-theme';
import { upperTr } from '@/lib/text';

/**
 * Anasayfa — gün defteri.
 *
 * Kart yok, çıkarma işlemi görünür: sürücü ciroyu görüp altındaki
 * kesintileri tek tek takip edebiliyor. Sayıya ancak nereden geldiğini
 * görürse inanır.
 *
 * Üç ayrı durumu var ve üçü de ayrı tasarlandı: kayıt yokken (1. gün),
 * vardiya açıkken, vardiya kapandıktan sonra.
 */
export default function HomeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const state = useDriver();

  const { summary, openShift, rides, vehicle, userId, goal } = state;
  /**
   * Gösterilecek bir şey var mı — sefer, gider, yakıt ya da kapanmış
   * vardiya. Eskiden yalnızca seferlere bakılıyordu: ilk seferden önce
   * yakıt alan sürücü "vardiya açık, henüz kayıt yok" görüyordu, oysa
   * −700 ₺ yazılmıştı. Yalnızca açık vardiya olan boş gün hâlâ boş.
   */
  const hasRecords = summary?.hasActivity ?? false;

  function baslat() {
    if (!userId || !vehicle) return;
    startShift(userId, vehicle.id);
    requestSync();
  }

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.lg }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.head}>
        <Text style={[styles.date, { color: colors.textFaint }]}>
          {upperTr(formatBusinessDate(state.today, 'long'))}
        </Text>
        <View style={styles.headRow}>
          <Text style={[typeScale.display, { color: colors.text }]}>Gün defteri</Text>
          {rides.length > 0 ? (
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>
              {rides.length} yolcu
            </Text>
          ) : null}
        </View>
      </View>

      {hasRecords && summary ? (
        <SummaryRows summary={summary} />
      ) : (
        <EmptyDay hasShift={openShift != null} />
      )}

      {goal ? <GoalBar goal={goal} /> : null}

      {rides.length > 0 ? <RideList rides={rides} /> : null}

      {openShift ? (
        <OpenShiftBar
          minutes={state.openShiftMinutes}
          stale={state.shiftIsStale}
        />
      ) : null}

      <View style={styles.actions}>
        {openShift ? (
          <>
            <Button label="Yolcu ekle" size="hero" plus
              onPress={() => router.push('/sefer')} />
            <View style={styles.pair}>
              <Button
                label="Gider"
                variant="secondary"
                style={styles.half}
                onPress={() => router.push('/gider')}
              />
              <Button
                label="Yakıt"
                variant="secondary"
                style={styles.half}
                onPress={() => router.push('/yakit')}
              />
            </View>
          </>
        ) : (
          <Button
            label={hasRecords ? 'Yeni vardiya başlat' : 'Vardiyayı başlat'}
            size="hero"
            onPress={baslat}
          />
        )}
      </View>
    </ScrollView>
  );
}

/**
 * Sürücünün 1. günü.
 *
 * Bu ekranı doğru yapmak, dolu günü doğru yapmaktan daha önemli:
 * kullanıcıyı kaybediyorsak burada kaybediyoruz. Boş bir tablo yerine
 * ne olacağını anlatıyor.
 */
function EmptyDay({ hasShift }: { hasShift: boolean }) {
  const { colors } = useTheme();

  return (
    <View style={[styles.empty, { borderColor: colors.border }]}>
      <Text style={[typeScale.heading, { color: colors.text }]}>
        {hasShift ? 'Vardiya açık, henüz kayıt yok' : 'Bugün henüz kayıt yok'}
      </Text>
      <Text style={[typeScale.body, { color: colors.textSoft }]}>
        {hasShift
          ? 'Her para aldığında tutarı yaz. Vardiyayı bitirince günün hesabını çıkarırım.'
          : 'Vardiyayı başlat, gün boyu aldığın paraları yaz. Akşam cebinde ne kaldığını ve aracının ne kadar eridiğini göstereceğim.'}
      </Text>
    </View>
  );
}

/**
 * Açık vardiyanın canlı özeti — yalnızca süre.
 *
 * ₺/saat BİLEREK YOK: vardiyanın başında saçmalıyor ve sürücünün gördüğü
 * ilk sayı saçmaysa geri kalanına da inanmıyor. Saat başına kazanç
 * vardiya kapandığında, süre gerçekten belliyken anlamlı.
 */
function OpenShiftBar({
  minutes, stale,
}: { minutes: number; stale: boolean }) {
  const { colors } = useTheme();
  const hours = Math.floor(minutes / 60);
  const mins = minutes % 60;

  return (
    <View style={[
      styles.shiftBar,
      { backgroundColor: stale ? colors.warningSoft : colors.accentSoft },
    ]}>
      <View style={[
        styles.dot,
        { backgroundColor: stale ? colors.warning : colors.accent },
      ]} />
      <View style={{ flex: 1 }}>
        <Text style={[
          typeScale.bodyStrong,
          { color: stale ? colors.warning : colors.accent },
        ]}>
          Vardiya {hours}:{String(mins).padStart(2, '0')}
        </Text>
        {stale ? (
          <Text style={[typeScale.caption, { color: colors.warning }]}>
            Uzun süredir açık — bitirmeyi unuttuysan şimdi kapat.
          </Text>
        ) : null}
      </View>
      <Pressable
        onPress={() => router.push('/vardiya-bitir')}
        accessibilityRole="button"
        style={({ pressed }) => [
          styles.finish,
          { backgroundColor: colors.surface, opacity: pressed ? 0.8 : 1 },
        ]}
      >
        <Text style={[typeScale.bodyStrong, { color: colors.text }]}>Bitir</Text>
      </Pressable>
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: space.xl,
    paddingBottom: space.xxxl,
    gap: space.lg,
  },
  head: { gap: space.xs },
  date: { ...typeScale.label, letterSpacing: 1 },
  headRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: space.sm,
  },
  empty: {
    borderWidth: 1,
    borderStyle: 'dashed',
    borderRadius: radius.lg,
    padding: space.xl,
    gap: space.sm,
  },
  shiftBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    borderRadius: radius.md,
    paddingLeft: space.lg,
    paddingRight: space.sm,
    paddingVertical: space.sm,
    minHeight: HIT_SIZE,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  finish: {
    minHeight: HIT_SIZE - space.md,
    paddingHorizontal: space.lg,
    justifyContent: 'center',
    borderRadius: radius.sm,
  },
  actions: { gap: space.md },
  pair: { flexDirection: 'row', gap: space.md },
  half: { flex: 1 },
});
