import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  Card, PeriodFilterBar, ProfitRows, StatGrid, StatTile, periodRowsData,
} from '@/components/ui';
import { useDbValue } from '@/db/use-db';
import { getCutoffHour, getFirstRecordDate, listDaySummaries } from '@/db/repo';
import { useAuth } from '@/lib/auth/auth-context';
import { WEEKDAYS_TR, todayBusinessDate } from '@/lib/business-date';
import { formatInteger, formatKurus } from '@/lib/money';
import {
  PERIOD_LABELS, PREVIOUS_PERIOD_LABELS, type PeriodKey, periodBounds,
} from '@/lib/period';
import {
  type PeriodTotals, calculatePeriodTotals, percentChange, summarizeByWeekday,
} from '@/lib/stats';
import {
  accentStep, radius, space, type as typeScale, useTheme,
} from '@/theme/use-theme';

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
 * "Yolcu" = SEFER: her sefer bir yolcu sayılıyor. Bir seferde kaç kişinin
 * bindiği sorulmuyor — sefer girişi tek dokunuş kalsın diye (sürücünün
 * kararı).
 *
 * Dönem filtresi Kayıtlar'la AYNI (`period.ts`): "Bu ay" iki ekranda aynı
 * günleri kapsıyor.
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
    /** "Tüm zamanlar" ilk kayıttan başlar; sabit bir pencere eski günleri yutardı. */
    const oldest = period === 'all' ? getFirstRecordDate(userId) : null;
    const { from, to, previousFrom, previousTo } = periodBounds(period, today, oldest);

    const days = listDaySummaries(userId, from, to);

    /**
     * Önceki dönem yalnızca KARŞILAŞTIRMA için okunuyor ve "Tümü"nde
     * "Tüm zamanlar"da anlamsız: her şeyin öncesi diye bir şey yok.
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

      <PeriodFilterBar value={period} onChange={setPeriod} />

      {totals == null || totals.dayCount === 0 ? (
        <EmptyPeriod period={period} />
      ) : (
        <>
          {/*
            * Çalışılan gün: sefer ya da kapanmış vardiya olan gün. Yalnız
            * gider ya da depo alımı olan gün sayılmıyor; maliyeti yine
            * aşağıdaki toplamda.
            */}
          <Card
            title={PERIOD_LABELS[period]}
            meta={`${totals.workedDayCount} gün çalışıldı`}
          >
            <ProfitRows data={periodRowsData(totals)} />
          </Card>

          <Card title="Dönem ortalamaları">
            <StatGrid>
              <StatTile
                value={totals.perDay != null
                  ? formatKurus(totals.perDay, { decimals: false }) : '—'}
                label="gün başına cebe kalan"
              />
              <StatTile
                value={totals.perHour != null
                  ? formatKurus(totals.perHour, { decimals: false }) : '—'}
                label="₺/saat"
              />
              <StatTile
                value={totals.perRide != null
                  ? formatKurus(totals.perRide, { decimals: false }) : '—'}
                label="yolcu başı cebe kalan"
              />
              <StatTile
                value={totals.perKm != null
                  ? formatKurus(totals.perKm, { decimals: false }) : '—'}
                label="₺/km"
              />
              <StatTile value={formatInteger(totals.rideCount)} label="toplam yolcu" />
              <StatTile
                value={totals.distanceKm != null
                  ? formatInteger(totals.distanceKm) : '—'}
                label="toplam km"
              />
            </StatGrid>
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>
              {'Oranların paydası CEBE KALAN, ciro değil: "saat başına ne '
                + 'kazandım" sorusunun cevabı eline geçen paradır.'}
            </Text>
          </Card>

          {data?.previous && data.previous.workedDayCount > 0 ? (
            <Comparison current={totals} previous={data.previous} period={period} />
          ) : null}

          <WeekdayStrip stats={data?.weekdays ?? []} dayCount={totals.workedDayCount} />
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
  const label = period === 'all' ? '' : PREVIOUS_PERIOD_LABELS[period];

  return (
    <Card title={label} meta={`${previous.workedDayCount} gün`}>
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
        Vardiya açıp yolcu girdikçe burası dolacak: hangi gün daha çok
        kazandığın, saat ve kilometre başına eline geçen, aylar arası
        karşılaştırma.
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xxxl, gap: space.lg },
  empty: {
    borderWidth: 1, borderStyle: 'dashed', borderRadius: radius.lg,
    padding: space.xl, gap: space.sm,
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
