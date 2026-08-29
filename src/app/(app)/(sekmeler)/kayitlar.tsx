import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmountText, Card, SummaryRows } from '@/components/ui';
import { useDbValue } from '@/db/use-db';
import {
  getCutoffHour, getDaySummary, listExpensesInRange, listFuelLogsInRange,
  listRidesInRange,
} from '@/db/repo';
import { useAuth } from '@/lib/auth/auth-context';
import {
  type BusinessDate, addDays, formatBusinessDate, formatClock, todayBusinessDate,
} from '@/lib/business-date';
import type { DaySummary } from '@/lib/day-summary';
import type { Kurus } from '@/lib/money';
import { radius, space, type as typeScale, useTheme } from '@/theme/use-theme';

/** Kaç günlük geçmiş gösteriliyor. Sayfalama Faz 3'te. */
const WINDOW_DAYS = 60;

interface Entry {
  id: string;
  at: number;
  title: string;
  detail: string;
  amount: Kurus;
  incoming: boolean;
}

interface Day {
  date: BusinessDate;
  entries: Entry[];
  summary: DaySummary;
}

/**
 * Kayıtlar — gün gün kartlar.
 *
 * HER GÜN KENDİ KARTINDA. Kesintisiz bir liste, altmış günlük "Sefer,
 * Sefer, Sefer" duvarına dönüşüyor: sürücü nerede olduğunu kaybediyor
 * ve gün ayırıcısını kaydırıp geçince hangi güne baktığını unutuyor.
 *
 * Kart yalnızca kayıtları değil O GÜNÜN SONUCUNU da taşıyor. Geçmiş bir
 * günün üç satırını görebileceği başka yer yok — Anasayfa yalnızca bugünü
 * gösteriyor. Sürücünün asıl sorusu "27 Ağustos'ta ne kaldı", tek tek
 * seferler değil.
 *
 * Sefer, gider ve yakıt AYNI kartta: sürücü günü tek akış olarak yaşıyor,
 * üç ayrı sekmede aramıyor.
 */
export default function RecordsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const days = useDbValue<Day[]>(() => {
    if (!userId) return [];
    const cutoff = getCutoffHour(userId);
    const to = todayBusinessDate(cutoff);
    const from = addDays(to, -WINDOW_DAYS);

    const byDay = new Map<BusinessDate, Entry[]>();
    const push = (d: BusinessDate, e: Entry) => {
      const list = byDay.get(d) ?? [];
      list.push(e);
      byDay.set(d, list);
    };

    for (const r of listRidesInRange(userId, from, to)) {
      push(r.businessDate, {
        id: r.id, at: r.occurredAt, title: 'Sefer',
        detail: r.distanceMeters ? `${(r.distanceMeters / 1000).toFixed(1)} km` : '',
        amount: r.grossAmountKurus, incoming: true,
      });
    }
    for (const e of listExpensesInRange(userId, from, to)) {
      push(e.businessDate, {
        id: e.id, at: e.occurredAt, title: 'Gider',
        detail: e.notes ?? '', amount: e.amountKurus, incoming: false,
      });
    }
    for (const f of listFuelLogsInRange(userId, from, to)) {
      push(f.businessDate, {
        id: f.id, at: f.occurredAt, title: 'Yakıt',
        detail: `${(f.volumePer1000 / 1000).toFixed(1)} lt`,
        amount: f.totalAmountKurus, incoming: false,
      });
    }

    /**
     * Özet YALNIZCA kaydı olan günler için hesaplanıyor. Altmış günün
     * tamamını dolaşmak, çoğu boş olan günler için beş sorgu demekti.
     */
    return [...byDay.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, entries]) => ({
        date,
        entries: entries.sort((a, b) => b.at - a.at),
        summary: getDaySummary(userId, date),
      }));
  }, [userId]);

  return (
    <FlatList
      data={days}
      keyExtractor={(day) => day.date}
      contentContainerStyle={[
        styles.page,
        { paddingTop: insets.top + space.lg },
        days.length === 0 && styles.pageEmpty,
      ]}
      showsVerticalScrollIndicator={false}
      ListHeaderComponent={
        <Text style={[typeScale.display, { color: colors.text, marginBottom: space.md }]}>
          Kayıtlar
        </Text>
      }
      ListEmptyComponent={
        <View style={[styles.empty, { borderColor: colors.border }]}>
          <Text style={[typeScale.heading, { color: colors.text }]}>Henüz kayıt yok</Text>
          <Text style={[typeScale.body, { color: colors.textSoft }]}>
            Girdiğin her sefer, gider ve yakıt burada gün gün sıralanacak.
          </Text>
        </View>
      }
      renderItem={({ item }) => <DayCard day={item} />}
    />
  );
}

function DayCard({ day }: { day: Day }) {
  const { colors } = useTheme();

  return (
    <Card
      title={formatBusinessDate(day.date, 'long')}
      meta={`${day.entries.length} kayıt`}
      style={styles.card}
    >
      <View style={[styles.list, { borderColor: colors.border }]}>
        {day.entries.map((entry, index) => (
          <View
            key={entry.id}
            style={[
              styles.row,
              index > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
            ]}
          >
            <Text style={[styles.time, { color: colors.textFaint }]}>
              {formatClock(entry.at)}
            </Text>
            <View style={styles.rowText}>
              <Text style={[typeScale.body, { color: colors.text }]}>{entry.title}</Text>
              {entry.detail ? (
                <Text style={[typeScale.caption, { color: colors.textFaint }]}>
                  {entry.detail}
                </Text>
              ) : null}
            </View>
            <AmountText
              value={entry.amount}
              tone={entry.incoming ? 'plain' : 'cost'}
              showMinus={!entry.incoming}
            />
          </View>
        ))}
      </View>

      <SummaryRows summary={day.summary} detailed={false} />
    </Card>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xxxl, gap: space.lg },
  pageEmpty: { flexGrow: 1 },
  card: { gap: space.lg },
  list: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingHorizontal: space.md,
    paddingVertical: space.md,
  },
  time: { ...typeScale.body, fontVariant: ['tabular-nums'] },
  rowText: { flex: 1 },
  empty: {
    borderWidth: 1, borderStyle: 'dashed', borderRadius: 14,
    padding: space.xl, gap: space.sm,
  },
});
