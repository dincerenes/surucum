/**
 * İstatistik kartları — ekran `src/app/(app)/(sekmeler)/istatistik.tsx`.
 *
 * Her kart tek bir soruya cevap veriyor ve verisi yetmediğinde susuyor:
 * "henüz yeterli kayıt yok" yanlış bir sayıdan iyidir. Hesapların hepsi
 * `src/lib/insights.ts` ve `efficiency.ts` içinde; burada yalnızca çizim.
 */

import { StyleSheet, Text, View } from 'react-native';

import {
  Card, Donut, ProfitRows, ScoreRing, StatGrid, StatTile, periodRowsData, useScoreColor,
} from '@/components/ui';
import type { StatsOverview } from '@/db/repo';
import {
  type BusinessDate, MONTHS_TR, WEEKDAYS_TR, formatBusinessDate, weekdayIndex,
} from '@/lib/business-date';
import { SCORE_BAND_LABELS, scoreBand } from '@/lib/efficiency';
import { MIN_RIDES_FOR_HOURS, trendRatio } from '@/lib/insights';
import { type Kurus, formatDecimal, formatInteger, formatKurus } from '@/lib/money';
import { PERIOD_LABELS, PREVIOUS_PERIOD_LABELS, type PeriodKey } from '@/lib/period';
import { formatDuration } from '@/lib/shift';
import { percentChange } from '@/lib/stats';
import { accentStep, radius, space, type as typeScale, useTheme } from '@/theme/use-theme';

/**
 * "Hangi gün daha kazançlı" için gereken en az gün. Tek günlük veriyle
 * "Cumartesi en kazançlı günün" demek bilmediğimiz bir şeyi söylemek.
 */
const MIN_DAYS_FOR_WEEKDAY = 5;

const money = (v: Kurus | null) => (v == null ? '—' : formatKurus(v, { decimals: false }));
/** Km başına tutarlar küçük: 5,90 ₺'yi 6 ₺ diye yuvarlamak farkı siler. */
const moneyFine = (v: Kurus | null) => (v == null ? '—' : formatKurus(v));

function Note({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[typeScale.caption, { color: colors.textFaint }]}>{children}</Text>;
}

function Waiting({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return <Text style={[typeScale.body, { color: colors.textSoft }]}>{children}</Text>;
}

// ---------------------------------------------------------------------------
// 1. Dönem özeti
// ---------------------------------------------------------------------------

/**
 * Üç satır, önceki dönemle fark ve kazanç seyri tek kartta. Karşılaştırma
 * eskiden ayrı bir karttı; "geçen aya göre" sorusu özetin kendisinin
 * devamı.
 */
export function PeriodCard({ data, period }: { data: StatsOverview; period: PeriodKey }) {
  const { colors } = useTheme();
  const t = data.totals;
  const prev = data.previous;
  const change = prev && prev.workedDayCount > 0 ? percentChange(t.cashProfit, prev.cashProfit) : null;

  return (
    <Card
      title={PERIOD_LABELS[period]}
      meta={`${t.workedDayCount} gün çalışıldı`}
      icon={{ ios: 'list.bullet.rectangle', android: 'receipt_long' }}
    >
      <ProfitRows data={periodRowsData(t)} />

      {period !== 'all' && prev && prev.workedDayCount > 0 ? (
        <View style={[styles.compare, { backgroundColor: colors.surfaceSunken }]}>
          <Text style={[typeScale.caption, { color: colors.textFaint }]}>
            {PREVIOUS_PERIOD_LABELS[period]}: {formatKurus(prev.cashProfit, { decimals: false })} cebe kalan
          </Text>
          {change != null ? (
            <Text style={[typeScale.bodyStrong, { color: change >= 0 ? colors.positive : colors.negative }]}>
              {change >= 0 ? '▲' : '▼'} %{Math.abs(change).toFixed(0)} {change >= 0 ? 'daha iyi' : 'daha düşük'}
            </Text>
          ) : null}
        </View>
      ) : null}

      <Trend data={data} period={period} />
    </Card>
  );
}

const TREND_HEIGHT = 72;

function Trend({ data, period }: { data: StatsOverview; period: PeriodKey }) {
  const { colors } = useTheme();
  const { unit, bars } = data.trend;
  if (bars.length < 2) return null;

  const label = (key: string) => (unit === 'month'
    ? MONTHS_TR[Number(key.slice(5, 7)) - 1].slice(0, 3)
    : period === 'week'
      ? WEEKDAYS_TR[weekdayIndex(key as BusinessDate)].slice(0, 2)
      : String(Number(key.slice(8, 10))));

  /**
   * Çok çubukta her etiket sığmıyor: baş, orta, son — sütunların altına
   * değil ayrı bir satıra, yoksa dar sütunda "12" bile kırpılıyor.
   */
  const few = bars.length <= 12;
  const ends = [bars[0], bars[Math.floor(bars.length / 2)], bars[bars.length - 1]];

  return (
    <View style={styles.trendWrap}>
      <Note>{unit === 'month' ? 'Ay ay cebe kalan' : 'Gün gün cebe kalan'}</Note>
      <View style={[styles.trend, { gap: bars.length > 12 ? 2 : space.xs }]}>
        {bars.map((b) => {
          const loss = b.cashProfit != null && b.cashProfit < 0;
          const ratio = trendRatio(b.cashProfit, bars);
          return (
            <View key={b.key} style={styles.trendCol}>
              <View style={[styles.trendTrack, { backgroundColor: colors.surfaceSunken }]}>
                <View style={{
                  height: loss ? 3 : Math.max(ratio * TREND_HEIGHT, b.cashProfit != null ? 3 : 0),
                  backgroundColor: loss ? colors.negative : colors.accent,
                  borderRadius: 3,
                }} />
              </View>
              {few ? (
                <Text style={[styles.tick, { color: colors.textFaint }]} numberOfLines={1}>
                  {label(b.key)}
                </Text>
              ) : null}
            </View>
          );
        })}
      </View>
      {!few ? (
        <View style={styles.hourTicks}>
          {ends.map((b) => (
            <Text key={b.key} style={[styles.tick, { color: colors.textFaint }]}>{label(b.key)}</Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

// ---------------------------------------------------------------------------
// 2. Verimlilik analizi
// ---------------------------------------------------------------------------

const SCORE_BAR_HEIGHT = 48;

export function EfficiencyCard({ data }: { data: StatsOverview }) {
  const { colors } = useTheme();
  const colorFor = useScoreColor();
  const avg = data.averageScore;
  const latest = data.scores[data.scores.length - 1];
  const shown = data.scores.slice(-31);

  return (
    <Card title="Verimlilik analizi" icon={{ ios: 'gauge.with.dots.needle.67percent', android: 'speed' }}>
      {avg == null ? (
        <Waiting>
          {data.daysUntilScore > 0
            ? `Puanın, vardiyasını kapattığın ${data.daysUntilScore} çalışma günü daha sonra hesaplanacak. `
              + 'Puan seni kendi normal gününle karşılaştırıyor; önce normalini öğrenmem gerekiyor.'
            : 'Bu dönemde puanlanan gün yok. Puan, vardiyası kapanmış günlere veriliyor.'}
        </Waiting>
      ) : (
        <>
          <View style={styles.scoreHead}>
            <ScoreRing score={avg} size={84} />
            <View style={styles.scoreText}>
              <Text style={[typeScale.heading, { color: colorFor(avg) }]}>
                {SCORE_BAND_LABELS[scoreBand(avg)]}
              </Text>
              <Text style={[typeScale.body, { color: colors.textSoft }]}>
                {`${formatInteger(data.scores.length)} günün ortalama puanı`}
              </Text>
              {latest ? (
                <Text style={[typeScale.caption, { color: colors.textFaint }]}>
                  {`Normal günün: ${money(latest.baseline.perHour)}/saat`
                    + (latest.baseline.perKm != null ? ` · ${moneyFine(latest.baseline.perKm)}/km` : '')}
                </Text>
              ) : null}
            </View>
          </View>

          {shown.length > 1 ? (
            <View style={[styles.scoreBars, { gap: shown.length > 12 ? 2 : space.xs }]}>
              {shown.map((s) => (
                <View key={s.date} style={[styles.scoreTrack, { backgroundColor: colors.surfaceSunken }]}>
                  <View style={{
                    height: Math.max(3, (s.score / 100) * SCORE_BAR_HEIGHT),
                    backgroundColor: colorFor(s.score),
                    borderRadius: 3,
                  }} />
                </View>
              ))}
            </View>
          ) : null}
        </>
      )}
      <Note>
        {'50 puan senin normal günün: son 30 gündeki saat başına (ve km girildiyse km '
          + 'başına) cebe kalanının ortancası. 70 üstü normalinden iyi, 30 altı zayıf bir gün. '
          + 'Başka sürücülerle karşılaştırılmıyorsun.'}
      </Note>
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 3. Zaman verimliliği
// ---------------------------------------------------------------------------

export function TimeCard({ data }: { data: StatsOverview }) {
  const t = data.time;
  return (
    <Card title="Zaman verimliliği" icon={{ ios: 'clock.fill', android: 'schedule' }}>
      {t.dayCount === 0 ? (
        <Waiting>Vardiyanı kapatıp çalıştığın süreyi girince saat başına kazancın burada görünecek.</Waiting>
      ) : (
        <>
          <StatGrid>
            <StatTile value={money(t.perHour)} label="saat başına cebe kalan" />
            <StatTile value={formatDuration(t.totalMinutes)} label="toplam çalışma" />
            <StatTile
              value={t.minutesPerShift == null ? '—' : formatDuration(t.minutesPerShift)}
              label="ortalama vardiya"
            />
            <StatTile
              value={t.ridesPerHour == null ? '—' : formatDecimal(t.ridesPerHour)}
              label="saatte yolcu"
            />
            <StatTile
              value={t.minutesPerRide == null ? '—' : formatDuration(t.minutesPerRide)}
              label="yolcu başına süre"
            />
            <StatTile value={formatInteger(t.closedShiftCount)} label="kapanan vardiya" />
          </StatGrid>
          <Note>Açık vardiya hesaba girmiyor: süresi vardiya bitince soruluyor.</Note>
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 4. Sıcak saatler
// ---------------------------------------------------------------------------

const HOUR_BAR_HEIGHT = 64;
const pad = (h: number) => String(h).padStart(2, '0');

export function HotHoursCard({ data }: { data: StatsOverview }) {
  const { colors } = useTheme();
  const hot = data.hot;
  const enough = data.hourRideCount >= MIN_RIDES_FOR_HOURS;
  const inHot = (h: number) => hot != null
    && ((h - hot.startHour + 24) % 24) < ((hot.endHour - hot.startHour + 24) % 24 || 24);

  return (
    <Card title="Sıcak saatler" icon={{ ios: 'flame.fill', android: 'local_fire_department' }}>
      {!enough ? (
        <Waiting>
          {`Yolcuların hangi saatlerde yoğunlaştığını ${MIN_RIDES_FOR_HOURS} yolcudan sonra `
            + `göstereceğim. ${MIN_RIDES_FOR_HOURS - data.hourRideCount} yolcu kaldı.`}
        </Waiting>
      ) : (
        <>
          {hot ? (
            <Text style={[typeScale.body, { color: colors.textSoft }]}>
              En yoğun saatlerin{' '}
              <Text style={{ color: colors.text, fontWeight: '700' }}>
                {pad(hot.startHour)}:00–{pad(hot.endHour)}:00
              </Text>
              {` — yolcularının %${Math.round(hot.share * 100)}'i bu 3 saatte.`}
            </Text>
          ) : null}
          <View style={styles.hours}>
            {data.hours.map((b) => (
              <View key={b.hour} style={styles.hourCol}>
                <View style={[styles.hourTrack, { backgroundColor: colors.surfaceSunken }]}>
                  <View style={{
                    height: b.rideCount > 0 ? Math.max(3, b.ratio * HOUR_BAR_HEIGHT) : 0,
                    backgroundColor: inHot(b.hour) ? colors.warning : colors.accentScale[3],
                    borderRadius: 2,
                  }} />
                </View>
              </View>
            ))}
          </View>
          <View style={styles.hourTicks}>
            {[0, 6, 12, 18].map((h) => (
              <Text key={h} style={[styles.tick, { color: colors.textFaint }]}>{pad(h)}</Text>
            ))}
            <Text style={[styles.tick, { color: colors.textFaint }]}>24</Text>
          </View>
          <Note>Saat, yolcuyu girdiğin an. Yolcuyu inerken girersen saat ona göre kayar.</Note>
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 5. En verimli gün
// ---------------------------------------------------------------------------

/**
 * Haftanın günlerine göre ORTALAMA cebe kalan (toplam değil: çok
 * çalışılan gün kendiliğinden kazançlı görünmesin) ve dönemin en yüksek
 * puanlı günü.
 */
export function BestDayCard({ data }: { data: StatsOverview }) {
  const { colors } = useTheme();
  const colorFor = useScoreColor();
  const stats = data.weekdays;
  const dayCount = data.totals.workedDayCount;
  const top = data.scores.reduce<(typeof data.scores)[number] | null>(
    (acc, s) => (acc == null || s.score > acc.score || (s.score === acc.score && s.date > acc.date) ? s : acc),
    null,
  );
  const best = stats.reduce<(typeof stats)[number] | null>(
    (acc, s) => (s.average != null && (acc == null || s.average > acc.average!) ? s : acc), null,
  );

  return (
    <Card title="En verimli gün" icon={{ ios: 'trophy.fill', android: 'emoji_events' }}>
      {top ? (
        <View style={styles.topDay}>
          <View style={{ flex: 1 }}>
            <Text style={[typeScale.bodyStrong, { color: colors.text }]}>
              {formatBusinessDate(top.date, 'weekday')}
            </Text>
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>
              {`dönemin en yüksek puanı · ${money(top.perHour)}/saat`}
            </Text>
          </View>
          <Text style={[typeScale.title, { color: colorFor(top.score) }]}>{top.score}</Text>
        </View>
      ) : null}

      {dayCount < MIN_DAYS_FOR_WEEKDAY ? (
        <Waiting>
          {`Birkaç gün daha kayıt girince hangi günlerin daha iyi geçtiğini göstereceğim. `
            + `${MIN_DAYS_FOR_WEEKDAY - dayCount} gün kaldı.`}
        </Waiting>
      ) : (
        <>
          <View style={styles.strip}>
            {stats.map((s) => (
              <View key={s.index} style={styles.stripCol}>
                <View style={[styles.stripCell, {
                  backgroundColor: s.dayCount === 0 ? colors.surfaceSunken : accentStep(colors, s.ratio),
                }]} />
                <Text style={[typeScale.caption, { color: colors.textFaint }]}>
                  {WEEKDAYS_TR[s.index].slice(0, 3)}
                </Text>
              </View>
            ))}
          </View>
          {best?.average != null && best.average > 0 ? (
            <Text style={[typeScale.body, { color: colors.textSoft }]}>
              En kazançlı günün <Text style={{ color: colors.text }}>{WEEKDAYS_TR[best.index]}</Text>
              {' '}— ortalama {money(best.average)} cebe kalıyor.
            </Text>
          ) : (
            <Waiting>Bu dönemde hiçbir gün kâra geçmemiş.</Waiting>
          )}
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 6. Yolcu analizi
// ---------------------------------------------------------------------------

export function RidesCard({ data }: { data: StatsOverview }) {
  const { colors } = useTheme();
  const r = data.rides;
  return (
    <Card title="Yolcu analizi" icon={{ ios: 'person.2.fill', android: 'group' }}>
      {r.rideCount === 0 ? (
        <Waiting>Bu dönemde yolcu girilmemiş.</Waiting>
      ) : (
        <>
          <StatGrid>
            <StatTile value={formatInteger(r.rideCount)} label="toplam yolcu" />
            <StatTile value={r.ridesPerDay == null ? '—' : formatDecimal(r.ridesPerDay)} label="yolcu / gün" />
            <StatTile value={money(r.revenuePerRide)} label="yolcu başı ciro" />
            <StatTile value={money(r.cashPerRide)} label="yolcu başı cebe kalan" />
          </StatGrid>
          {r.busiestDay ? (
            <Text style={[typeScale.body, { color: colors.textSoft }]}>
              En yoğun günün{' '}
              <Text style={{ color: colors.text }}>{formatBusinessDate(r.busiestDay.date, 'weekday')}</Text>
              {` — ${formatInteger(r.busiestDay.rideCount)} yolcu.`}
            </Text>
          ) : null}
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 7. Km analizi
// ---------------------------------------------------------------------------

export function KmCard({ data }: { data: StatsOverview }) {
  const k = data.km;
  return (
    <Card title="Km analizi" icon={{ ios: 'road.lanes', android: 'route' }}>
      {k.totalKm == null ? (
        <Waiting>
          Vardiyayı bitirirken kilometreyi girersen km başına kazancın ve maliyetin burada görünecek.
        </Waiting>
      ) : (
        <>
          <StatGrid>
            <StatTile value={`${formatInteger(k.totalKm)} km`} label="toplam" />
            <StatTile value={k.kmPerDay == null ? '—' : `${formatInteger(k.kmPerDay)} km`} label="gün başına" />
            <StatTile value={moneyFine(k.revenuePerKm)} label="km başı ciro" />
            <StatTile value={moneyFine(k.costPerKm)} label="km başı yakıt + yıpranma" />
            <StatTile value={moneyFine(k.cashPerKm)} label="km başı cebe kalan" />
            <StatTile
              value={k.kmPerRide == null ? '—' : `${formatDecimal(k.kmPerRide)} km`}
              label="yolcu başına"
            />
          </StatGrid>
          {k.skippedDayCount > 0 ? (
            <Note>
              {`${formatInteger(k.skippedDayCount)} günün kilometresi eksik girildiği için hesaba katılmadı.`}
            </Note>
          ) : null}
        </>
      )}
    </Card>
  );
}

// ---------------------------------------------------------------------------
// 8. Gider dağılımı
// ---------------------------------------------------------------------------

export function CostsCard({ data }: { data: StatsOverview }) {
  const c = data.costs;
  return (
    <Card title="Gider dağılımı" icon={{ ios: 'chart.pie.fill', android: 'pie_chart' }}>
      {c.slices.length === 0 ? (
        <Waiting>Bu dönemde gider, yakıt ya da komisyon girilmemiş.</Waiting>
      ) : (
        <>
          <Donut slices={c.slices} total={c.total} centerLabel="toplam" />
          <Note>Yıpranma payı cepten çıkmıyor ama aracın değerinden gidiyor; gerçek kâr bunu düşüyor.</Note>
        </>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  compare: { borderRadius: radius.md, padding: space.md, gap: 2 },
  trendWrap: { gap: space.xs, marginTop: space.xs },
  trend: { flexDirection: 'row', alignItems: 'flex-end' },
  trendCol: { flex: 1, alignItems: 'center', gap: 4 },
  trendTrack: {
    width: '100%', height: TREND_HEIGHT, borderRadius: 3,
    justifyContent: 'flex-end', overflow: 'hidden',
  },
  tick: { fontSize: 11, lineHeight: 14, fontVariant: ['tabular-nums'] },
  scoreHead: { flexDirection: 'row', alignItems: 'center', gap: space.lg },
  scoreText: { flex: 1, gap: 2 },
  scoreBars: { flexDirection: 'row', alignItems: 'flex-end', height: SCORE_BAR_HEIGHT },
  scoreTrack: {
    flex: 1, height: SCORE_BAR_HEIGHT, borderRadius: 3,
    justifyContent: 'flex-end', overflow: 'hidden',
  },
  hours: { flexDirection: 'row', gap: 2, alignItems: 'flex-end' },
  hourCol: { flex: 1 },
  hourTrack: {
    height: HOUR_BAR_HEIGHT, borderRadius: 2, justifyContent: 'flex-end', overflow: 'hidden',
  },
  hourTicks: { flexDirection: 'row', justifyContent: 'space-between' },
  topDay: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  strip: { flexDirection: 'row', gap: space.xs },
  stripCol: { flex: 1, alignItems: 'center', gap: space.xs },
  stripCell: { width: '100%', height: 44, borderRadius: radius.sm },
});
