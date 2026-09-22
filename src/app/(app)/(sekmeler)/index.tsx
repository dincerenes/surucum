import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AmountText, Avatar, Button, Card, GoalBar, StatGrid, StatTile,
} from '@/components/ui';
import { getCutoffHour, getHomeOverview, getSettings, startShift } from '@/db/repo';
import { useDbValue } from '@/db/use-db';
import {
  formatBusinessDate, monthName, todayBusinessDate, weekdayIndex,
} from '@/lib/business-date';
import { type DailyBar, barRatio } from '@/lib/home';
import { type Kurus, ZERO, formatInteger, formatKurus, sum } from '@/lib/money';
import { firstName, greetingFor } from '@/lib/profile';
import { formatDuration, isShiftStale } from '@/lib/shift';
import { upperTr } from '@/lib/text';
import { useDriver } from '@/lib/use-driver';
import { useNow } from '@/lib/use-now';
import { requestSync } from '@/sync/scheduler';
import { HIT_SIZE, radius, space, type as typeScale, useTheme } from '@/theme/use-theme';

/**
 * Anasayfa — kartlar.
 *
 * Eskiden "gün defteri"ydi: tek günün döküm satırları ve yolcu listesi.
 * Sürücü uygulamayı açınca üç şey soruyor: bugün ne yaptım, bu ay nasıl
 * gidiyor, son günler nasıldı. Her kart bunlardan birinin cevabı; günün
 * satır satır dökümü vardiya detayında.
 *
 * Kart sırası önem sırası: unutulmuş vardiya uyarısı (varsa) en üstte,
 * çünkü o düzelmeden altındaki sayıların hepsi yanlış.
 */
export default function HomeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const state = useDriver();
  const { userId, openShift } = state;
  const now = useNow();

  const data = useDbValue(() => {
    if (!userId) return null;
    const at = Date.now();
    const today = todayBusinessDate(getCutoffHour(userId), new Date(at));
    return {
      today,
      name: getSettings(userId)?.displayName ?? null,
      overview: getHomeOverview(userId, today, at),
    };
  }, [userId]);

  const hour = new Date(now).getHours();
  const name = firstName(data?.name);
  const stale = openShift ? isShiftStale(openShift, now) : false;

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.lg }]}
      showsVerticalScrollIndicator={false}
    >
      <View style={styles.head}>
        <View style={styles.headText}>
          {data ? (
            <Text style={[styles.date, { color: colors.textFaint }]}>
              {upperTr(formatBusinessDate(data.today, 'long'))}
            </Text>
          ) : null}
          <Text style={[typeScale.display, { color: colors.text }]} numberOfLines={2}>
            {greetingFor(hour)}{name ? `, ${name}` : ''}
          </Text>
        </View>
        <Pressable
          onPress={() => router.push('/profil')}
          accessibilityRole="button"
          accessibilityLabel="Profil"
          hitSlop={space.sm}
        >
          <Avatar name={data?.name} size={52} />
        </Pressable>
      </View>

      {openShift && stale ? <StaleShiftCard startedAt={openShift.startedAt} now={now} /> : null}

      <TodayCard now={now} />

      {data ? (
        <>
          <MonthCard overview={data.overview} month={Number(data.today.slice(5, 7))} />
          <WearCard overview={data.overview} />
          <WeekCard bars={data.overview.week} />
        </>
      ) : null}
    </ScrollView>
  );
}

/**
 * Açık unutulmuş vardiya — kartların üstünde, sarı.
 *
 * Kapanmayan vardiya saatleri ve gün başına ortalamaları şişiriyor.
 * Yalnızca uyarmak yetmez: düğme bitirme sihirbazını açıyor, orada bitiş
 * saati düzeltilebiliyor.
 */
function StaleShiftCard({ startedAt, now }: { startedAt: number; now: number }) {
  const { colors } = useTheme();
  const hours = Math.floor((now - startedAt) / 3_600_000);

  return (
    <View style={[styles.stale, { backgroundColor: colors.warningSoft }]}>
      <Text style={[typeScale.heading, { color: colors.warning }]}>
        Vardiyan {formatInteger(hours)} saattir açık
      </Text>
      <Text style={[typeScale.body, { color: colors.warning }]}>
        Bitirmeyi unuttuysan şimdi kapat. Bitiş saatini düzeltebilirsin; yoksa
        süre ve ortalamalar şişer.
      </Text>
      <Button label="Vardiyayı bitir" variant="secondary"
        onPress={() => router.push('/vardiya-bitir')} />
    </View>
  );
}

/**
 * "Günlük kazancın".
 *
 * Vardiya AÇIKKEN canlı: bu vardiyanın yolcusu, cirosu, süresi. Büyük
 * sayı CİRO — komisyon ve yakıt vardiya biterken soruluyor, bilinmeyen
 * kesintiyi düşülmüş gibi göstermek sayıya güveni bitirir.
 *
 * Vardiya KAPALIYKEN bugünün toplamı ve cebe kalan; hiç kayıt yoksa
 * başlatma çağrısı.
 */
function TodayCard({ now }: { now: number }) {
  const { colors } = useTheme();
  const { userId, vehicle, openShift, shiftRides, shiftGross, goal, summary } = useDriver();

  function baslat() {
    if (!userId || !vehicle) return;
    startShift(userId, vehicle.id);
    requestSync();
  }

  if (openShift) {
    const minutes = Math.max(0, Math.floor((now - openShift.startedAt) / 60_000));
    return (
      <Card title="Günlük kazancın" meta="vardiya açık" style={{ borderColor: colors.positive }}>
        <View style={styles.bigRow}>
          <AmountText value={shiftGross} size="display" />
          <Text style={[typeScale.caption, { color: colors.textFaint }]}>ciro</Text>
        </View>
        <StatGrid>
          <StatTile value={formatInteger(shiftRides.length)} label="yolcu" />
          <StatTile value={formatDuration(minutes)} label="süre" />
        </StatGrid>
        {goal ? <GoalBar goal={goal} /> : null}
        <Button label="Yolcu ekle" size="hero" plus onPress={() => router.push('/sefer')} />
        <View style={styles.pair}>
          <Button label="Gider" variant="secondary" style={styles.half}
            onPress={() => router.push('/gider')} />
          <Button label="Yakıt" variant="secondary" style={styles.half}
            onPress={() => router.push('/yakit')} />
        </View>
      </Card>
    );
  }

  const worked = summary?.hasActivity ?? false;
  return (
    <Card title="Günlük kazancın" meta="bugün">
      {worked && summary ? (
        <>
          <View style={styles.bigRow}>
            <AmountText value={summary.profit.cashProfit} size="display" tone="signed" />
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>cebe kalan</Text>
          </View>
          <StatGrid>
            <StatTile value={formatInteger(summary.rideCount)} label="yolcu" />
            <StatTile
              value={formatKurus(summary.profit.revenue, { decimals: false })}
              label="ciro"
            />
          </StatGrid>
          {goal ? <GoalBar goal={goal} /> : null}
        </>
      ) : (
        <Text style={[typeScale.body, { color: colors.textSoft }]}>
          Bugün henüz vardiya yok. Başlat, gün boyu aldığın yolcuları yaz;
          akşam cebinde ne kaldığını göstereyim.
        </Text>
      )}
      <Button
        label={worked ? 'Yeni vardiya başlat' : 'Vardiyayı başlat'}
        size="hero"
        onPress={baslat}
      />
    </Card>
  );
}

/**
 * "Aylık ortalama" — bu ay ÇALIŞILAN gün başına.
 *
 * Büyük sayı gün başına cebe kalan. Km ortalaması yalnızca km'si girilmiş
 * günlerden; hiç yoksa "—". Bilinmeyen tahmin edilmez.
 */
function MonthCard({ overview, month }: {
  overview: ReturnType<typeof getHomeOverview>; month: number;
}) {
  const { colors } = useTheme();
  const a = overview.averages;

  return (
    <Card title="Aylık ortalama" meta={monthName(month)}>
      {a.perDay == null ? (
        <Text style={[typeScale.body, { color: colors.textSoft }]}>
          Bu ay henüz çalışılan gün yok. İlk vardiyadan sonra gün başına ne
          kaldığını burada göreceksin.
        </Text>
      ) : (
        <>
          <View style={styles.bigRow}>
            <AmountText value={a.perDay} size="display" tone="signed" />
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>/ gün cebe kalan</Text>
          </View>
          <Text style={[typeScale.caption, { color: colors.textFaint }]}>
            {formatInteger(a.workedDayCount)} çalışılan günün ortalaması
          </Text>
          <StatGrid>
            <StatTile value={a.ridesPerDay == null ? '—' : oneDecimal(a.ridesPerDay)} label="yolcu / gün" />
            <StatTile value={a.kmPerDay == null ? '—' : `${formatInteger(a.kmPerDay)} km`} label="km / gün" />
            <StatTile
              value={a.minutesPerDay == null ? '—' : formatDuration(a.minutesPerDay)}
              label="süre / gün"
            />
            <StatTile
              value={a.revenuePerDay == null ? '—' : formatKurus(a.revenuePerDay, { decimals: false })}
              label="ciro / gün"
            />
          </StatGrid>
        </>
      )}
    </Card>
  );
}

/**
 * "Aracın bu ay ne kadar eridi" — ürünün asıl tezi.
 *
 * Yıpranma payı cebe kalanın içinde duruyor ama sürücünün değil aracın
 * parası: lastik, bakım, değer kaybı. Km girilmemiş vardiyada hesaplanamaz,
 * o yüzden eksik vardiya sayısı da yazıyor.
 */
function WearCard({ overview }: { overview: ReturnType<typeof getHomeOverview> }) {
  const { colors } = useTheme();
  const m = overview.month;
  if (m.shiftCount === 0) return null;

  return (
    <Card title="Aracın bu ay eridi">
      {m.distanceKm == null ? (
        <Text style={[typeScale.body, { color: colors.textSoft }]}>
          Vardiya sonunda km girdiğinde aracının ne kadar eridiğini burada
          göreceksin.
        </Text>
      ) : (
        <>
          <View style={styles.bigRow}>
            <AmountText value={m.wearShare} size="title" tone="cost" />
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>
              {formatInteger(m.distanceKm)} km yolda
            </Text>
          </View>
          <Text style={[typeScale.caption, { color: colors.textSoft }]}>
            Cebinde duruyor ama aracına ait: lastik, bakım ve değer kaybı payı.
            Gerçek kâr bu pay düşülerek hesaplanıyor.
          </Text>
        </>
      )}
      {m.shiftsMissingDistance > 0 ? (
        <Text style={[typeScale.caption, { color: colors.warning }]}>
          {formatInteger(m.shiftsMissingDistance)} vardiyada km eksik
        </Text>
      ) : null}
    </Card>
  );
}

const WEEKDAY_SHORT = ['Pt', 'Sa', 'Ça', 'Pe', 'Cu', 'Ct', 'Pz'];
const BAR_HEIGHT = 88;

/**
 * "Son 7 gün" — günlük cebe kalan, mini çubuk grafik.
 *
 * Boş gün boş çubuk: çalışılmayan gün grafikten atılırsa hafta olduğundan
 * dolu görünür. Zarar edilen gün kırmızı bir çizgi. Dokununca İstatistik.
 */
function WeekCard({ bars }: { bars: DailyBar[] }) {
  const { colors } = useTheme();
  const total = sum(bars.map((b) => b.cashProfit ?? ZERO)) as Kurus;
  const any = bars.some((b) => b.cashProfit != null);

  return (
    <Pressable
      onPress={() => router.push('/istatistik')}
      accessibilityRole="button"
      accessibilityLabel="Son 7 gün, İstatistik'i aç"
    >
      <Card title="Son 7 gün" meta={any ? formatKurus(total, { decimals: false }) : undefined}>
        <View style={styles.chart}>
          {bars.map((b) => {
            const ratio = barRatio(b.cashProfit, bars);
            const loss = b.cashProfit != null && b.cashProfit < 0;
            return (
              <View key={b.date} style={styles.barCol}>
                <View style={[styles.barTrack, { backgroundColor: colors.surfaceSunken }]}>
                  <View style={[styles.bar, {
                    height: loss ? 3 : Math.max(ratio * BAR_HEIGHT, b.cashProfit != null ? 3 : 0),
                    backgroundColor: loss
                      ? colors.negative
                      : b.isToday ? colors.accent : colors.accentScale[2],
                  }]} />
                </View>
                <Text style={[typeScale.caption, {
                  color: b.isToday ? colors.text : colors.textFaint,
                  fontWeight: b.isToday ? '700' : '400',
                }]}>
                  {WEEKDAY_SHORT[weekdayIndex(b.date)]}
                </Text>
              </View>
            );
          })}
        </View>
        {!any ? (
          <Text style={[typeScale.caption, { color: colors.textFaint }]}>
            Son 7 günde kayıt yok.
          </Text>
        ) : null}
      </Card>
    </Pressable>
  );
}

/** 12,5 — tam sayıysa virgülsüz. */
function oneDecimal(n: number): string {
  const rounded = Math.round(n * 10) / 10;
  return Number.isInteger(rounded)
    ? formatInteger(rounded)
    : `${formatInteger(Math.trunc(rounded))},${Math.round(Math.abs(rounded % 1) * 10)}`;
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: space.xl,
    paddingBottom: space.xxxl,
    gap: space.lg,
  },
  head: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  headText: { flex: 1, gap: space.xs },
  date: { ...typeScale.label, letterSpacing: 1 },
  stale: { borderRadius: radius.lg, padding: space.lg, gap: space.sm },
  bigRow: { flexDirection: 'row', alignItems: 'baseline', gap: space.sm, flexWrap: 'wrap' },
  pair: { flexDirection: 'row', gap: space.md },
  half: { flex: 1 },
  chart: {
    flexDirection: 'row', justifyContent: 'space-between', gap: space.xs,
    minHeight: HIT_SIZE,
  },
  barCol: { flex: 1, alignItems: 'center', gap: space.xs },
  barTrack: {
    width: '70%', height: BAR_HEIGHT, borderRadius: radius.sm,
    justifyContent: 'flex-end', overflow: 'hidden',
  },
  bar: { width: '100%', borderRadius: radius.sm },
});
