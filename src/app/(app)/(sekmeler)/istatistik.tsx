import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Card, Chip, ChipRow, ProfitRows } from '@/components/ui';
import { useDbValue } from '@/db/use-db';
import { getCutoffHour, getFirstRecordDate, listDaySummaries } from '@/db/repo';
import { useAuth } from '@/lib/auth/auth-context';
import {
  type BusinessDate, WEEKDAYS_TR, addDays, startOfMonth, startOfWeek,
  todayBusinessDate,
} from '@/lib/business-date';
import { formatInteger, formatKurus } from '@/lib/money';
import {
  type DayEntry, type PeriodTotals, calculatePeriodTotals, percentChange,
  summarizeByWeekday,
} from '@/lib/stats';
import {
  accentStep, radius, space, type as typeScale, useTheme,
} from '@/theme/use-theme';

type PeriodKey = 'week' | 'month' | 'all';

const PERIOD_LABELS: Record<PeriodKey, string> = {
  week: 'Bu hafta',
  month: 'Bu ay',
  all: 'Tümü',
};

/**
 * Anlamlı bir karşılaştırma için gereken en az gün sayısı.
 *
 * Tek günlük veriyle "Cumartesi en kazançlı günün" demek, sürücüye
 * bilmediğimiz bir şeyi biliyormuş gibi söylemektir. Sayıya güven bir
 * kez kaybedilince geri gelmiyor; susmak yanlış konuşmaktan iyi.
 */
const MIN_DAYS_FOR_WEEKDAY = 5;

/**
 * İstatistik.
 *
 * KULLANILAN TERİMLER SABİT: Ciro, Cebe kalan, Gerçek kâr. Dördüncü bir
 * terim ("net kazanç" gibi) üretilmiyor — tanımsız bir sayı, sürücünün
 * hangi rakama baktığını bilmemesi demek.
 *
 * Sefer SAYILIYOR, yolcu değil: bir seferde dört yolcu olabilir ve
 * yolcu sayısı hiçbir yerde toplanmıyor.
 */
export default function StatsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const [period, setPeriod] = useState<PeriodKey>('month');

  const data = useDbValue(() => {
    if (!userId) return null;
    const today = todayBusinessDate(getCutoffHour(userId));
    /** "Tümü" ilk kayıttan başlar; sabit bir pencere eski günleri yutardı. */
    const oldest = period === 'all' ? getFirstRecordDate(userId) : null;
    const { from, previousFrom, previousTo } = periodBounds(period, today, oldest);

    const days = listDaySummaries(userId, from, today);

    /**
     * Önceki dönem yalnızca KARŞILAŞTIRMA için okunuyor ve "Tümü"nde
     * anlamsız: her şeyin öncesi diye bir şey yok.
     */
    const previous = previousFrom && previousTo
      ? calculatePeriodTotals(listDaySummaries(userId, previousFrom, previousTo))
      : null;

    return {
      days,
      totals: calculatePeriodTotals(days),
      previous,
      weekdays: summarizeByWeekday(days),
    };
  }, [userId, period]);

  const totals = data?.totals ?? null;

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.lg }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[typeScale.display, { color: colors.text }]}>İstatistik</Text>

      <ChipRow>
        {(Object.keys(PERIOD_LABELS) as PeriodKey[]).map((p) => (
          <Chip
            key={p}
            label={PERIOD_LABELS[p]}
            selected={period === p}
            onPress={() => setPeriod(p)}
          />
        ))}
      </ChipRow>

      {totals == null || totals.dayCount === 0 ? (
        <EmptyPeriod period={period} />
      ) : (
        <>
          <Card
            title={PERIOD_LABELS[period]}
            meta={`${totals.dayCount} gün çalışıldı`}
          >
            <ProfitRows
              data={{
                revenue: totals.revenue,
                commission: totals.commission,
                fuelPaid: totals.fuelPaid,
                expensesPaid: totals.expensesPaid,
                cashProfit: totals.cashProfit,
                wearShare: totals.wearShare,
                trueProfit: totals.trueProfit,
                /**
                 * Hacim dönem geneline yazılmıyor: günlerin bir kısmında
                 * tüketim girilmiş, bir kısmında girilmemiş olabilir ve
                 * yarısı ölçülmüş bir litre toplamı yanlış bilgidir.
                 */
                fuelVolume: null,
                distanceKm: totals.distanceKm,
                notes: periodNotes(totals),
              }}
            />
          </Card>

          <Card title="Dönem ortalamaları">
            <View style={styles.grid}>
              <Metric
                value={totals.perDay != null
                  ? formatKurus(totals.perDay, { decimals: false }) : '—'}
                label="gün başına cebe kalan"
              />
              <Metric
                value={totals.perHour != null
                  ? formatKurus(totals.perHour, { decimals: false }) : '—'}
                label="₺/saat"
              />
              <Metric
                value={totals.perRide != null
                  ? formatKurus(totals.perRide, { decimals: false }) : '—'}
                label="sefer başı gelir"
              />
              <Metric
                value={totals.perKm != null
                  ? formatKurus(totals.perKm, { decimals: false }) : '—'}
                label="₺/km"
              />
              <Metric value={String(totals.rideCount)} label="toplam sefer" />
              <Metric
                value={totals.distanceKm != null
                  ? formatInteger(totals.distanceKm) : '—'}
                label="toplam km"
              />
            </View>
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>
              Oranların paydası CEBE KALAN, ciro değil: "saat başına ne
              kazandım" sorusunun cevabı eline geçen paradır.
            </Text>
          </Card>

          {data?.previous && data.previous.dayCount > 0 ? (
            <Comparison current={totals} previous={data.previous} period={period} />
          ) : null}

          <WeekdayStrip stats={data?.weekdays ?? []} dayCount={totals.dayCount} />
        </>
      )}
    </ScrollView>
  );
}

/**
 * Haftanın günlerine göre kazanç şeridi.
 *
 * ORTALAMA gösteriliyor, toplam değil: sürücü altı Cumartesi üç Salı
 * çalıştıysa toplam Cumartesi'yi otomatik öne çıkarır ve bize yalnızca
 * daha çok çalıştığını söyler.
 */
function WeekdayStrip({
  stats, dayCount,
}: { stats: ReturnType<typeof summarizeByWeekday>; dayCount: number }) {
  const { colors } = useTheme();

  if (dayCount < MIN_DAYS_FOR_WEEKDAY) {
    return (
      <Card title="Hangi gün daha kazançlı">
        <Text style={[typeScale.body, { color: colors.textSoft }]}>
          Birkaç gün daha kayıt girince burada hangi günlerin daha iyi
          geçtiğini göstereceğim. {MIN_DAYS_FOR_WEEKDAY - dayCount} gün kaldı.
        </Text>
      </Card>
    );
  }

  const best = stats.reduce((acc, s) => (
    s.average != null && (acc == null || s.average > acc.average!) ? s : acc
  ), null as (typeof stats)[number] | null);

  return (
    <Card title="Hangi gün daha kazançlı">
      <View style={styles.strip}>
        {stats.map((s) => (
          <View key={s.index} style={styles.stripCol}>
            <View
              style={[
                styles.stripCell,
                {
                  backgroundColor: s.dayCount === 0
                    ? colors.surfaceSunken
                    : accentStep(colors, s.ratio),
                },
              ]}
            />
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>
              {WEEKDAYS_TR[s.index].slice(0, 3)}
            </Text>
          </View>
        ))}
      </View>

      {best?.average != null && best.average > 0 ? (
        <Text style={[typeScale.body, { color: colors.textSoft }]}>
          En iyi günün <Text style={{ color: colors.text }}>{WEEKDAYS_TR[best.index]}</Text>
          {' '}— ortalama {formatKurus(best.average, { decimals: false })} cebe kalıyor.
        </Text>
      ) : (
        <Text style={[typeScale.body, { color: colors.textSoft }]}>
          Bu dönemde hiçbir gün kâra geçmemiş.
        </Text>
      )}

      <Text style={[typeScale.caption, { color: colors.textFaint }]}>
        Toplam değil ORTALAMA karşılaştırılıyor — çok çalışılan gün
        kendiliğinden kazançlı görünmesin diye.
      </Text>
    </Card>
  );
}

/** Bir önceki dönemle karşılaştırma. */
function Comparison({
  current, previous, period,
}: { current: PeriodTotals; previous: PeriodTotals; period: PeriodKey }) {
  const { colors } = useTheme();
  const change = percentChange(current.cashProfit, previous.cashProfit);
  const label = period === 'week' ? 'Geçen hafta' : 'Geçen ay';

  return (
    <Card title={label} meta={`${previous.dayCount} gün`}>
      <View style={styles.line}>
        <Text style={[typeScale.body, { color: colors.textSoft }]}>Cebe kalan</Text>
        <Text style={[typeScale.bodyStrong, {
          color: colors.text, fontVariant: ['tabular-nums'],
        }]}>
          {formatKurus(previous.cashProfit)}
        </Text>
      </View>

      {change != null ? (
        <Text style={[typeScale.body, {
          color: change >= 0 ? colors.positive : colors.negative,
        }]}>
          {change >= 0 ? '▲' : '▼'} {Math.abs(change).toFixed(0)}%
          {' '}{change >= 0 ? 'daha iyi' : 'daha düşük'}
        </Text>
      ) : (
        <Text style={[typeScale.caption, { color: colors.textFaint }]}>
          Geçen dönem kâra geçmediği için yüzde karşılaştırması yapılmıyor.
        </Text>
      )}

      <Text style={[typeScale.caption, { color: colors.textFaint }]}>
        Dönemler farklı sayıda gün içerebilir; gün başına ortalamaya da bak.
      </Text>
    </Card>
  );
}

function EmptyPeriod({ period }: { period: PeriodKey }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.empty, { borderColor: colors.border }]}>
      <Text style={[typeScale.heading, { color: colors.text }]}>
        {PERIOD_LABELS[period]} için kayıt yok
      </Text>
      <Text style={[typeScale.body, { color: colors.textSoft }]}>
        Vardiya açıp sefer girdikçe burası dolacak: hangi gün daha çok
        kazandığın, saat ve kilometre başına eline geçen, aylar arası
        karşılaştırma.
      </Text>
    </View>
  );
}

function Metric({ value, label }: { value: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.metric, { backgroundColor: colors.surfaceSunken }]}>
      <Text
        style={[typeScale.title, { color: colors.text, fontVariant: ['tabular-nums'] }]}
        numberOfLines={1}
      >
        {value}
      </Text>
      <Text style={[typeScale.caption, { color: colors.textFaint }]} numberOfLines={2}>
        {label}
      </Text>
    </View>
  );
}

/** Dönemin eksik girdileri — gün özetindekiyle aynı dürüstlük kuralı. */
function periodNotes(totals: PeriodTotals): string[] {
  const notes: string[] = [];
  if (totals.daysMissingDistance > 0) {
    notes.push(
      `${totals.daysMissingDistance} günün kilometresi girilmemiş; `
      + 'yıpranma payı o günler için hesaplanmadı ve gerçek kâr '
      + 'olduğundan iyi görünüyor.',
    );
  }
  return notes;
}

/**
 * Dönemin sınırları ve karşılaştırılacak önceki dönem.
 *
 * Bitiş her zaman BUGÜN: yarısı geçmiş bir ayı tam ay gibi göstermek,
 * sürücüye ayın kötü geçtiğini düşündürür. Önceki dönem de aynı sebeple
 * tam alınıyor ve karşılaştırma notunda gün sayısı yazılıyor.
 */
function periodBounds(
  period: PeriodKey, today: BusinessDate, oldest: BusinessDate | null,
): {
  from: BusinessDate;
  previousFrom: BusinessDate | null;
  previousTo: BusinessDate | null;
} {
  if (period === 'week') {
    const from = startOfWeek(today);
    return {
      from,
      previousFrom: addDays(from, -7),
      previousTo: addDays(from, -1),
    };
  }

  if (period === 'month') {
    const from = startOfMonth(today);
    const previousTo = addDays(from, -1);
    return { from, previousFrom: startOfMonth(previousTo), previousTo };
  }

  /** Hiç kayıt yoksa bugün — sorgu boş döner ve ekran boş durumu gösterir. */
  return { from: oldest ?? today, previousFrom: null, previousTo: null };
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xxxl, gap: space.lg },
  empty: {
    borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.lg,
    padding: space.xl, gap: space.sm,
  },
  grid: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  metric: {
    /**
     * İki sütun: `space.sm` boşluk düşülerek. Üç sütun denendi ve
     * altı haneli tutarlar kırpıldı — para asla kırpılmaz.
     */
    flexBasis: '48%',
    flexGrow: 1,
    borderRadius: radius.md,
    padding: space.md,
    gap: 2,
  },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: space.md,
  },
  strip: { flexDirection: 'row', gap: space.xs },
  stripCol: { flex: 1, alignItems: 'center', gap: space.xs },
  stripCell: { width: '100%', height: 44, borderRadius: radius.sm },
});
