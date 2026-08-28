import { SectionList, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmountText } from '@/components/ui';
import { useDbValue } from '@/db/use-db';
import {
  getCutoffHour, listExpensesInRange, listFuelLogsInRange, listRidesInRange,
} from '@/db/repo';
import { useAuth } from '@/lib/auth/auth-context';
import {
  type BusinessDate, addDays, formatBusinessDate, todayBusinessDate,
} from '@/lib/business-date';
import type { Kurus } from '@/lib/money';
import { space, type as typeScale, useTheme } from '@/theme/use-theme';

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

/**
 * Kayıtlar — akan defter.
 *
 * Sefer, gider ve yakıt AYNI listede: sürücü günü tek akış olarak
 * yaşıyor, üç ayrı sekmede aramıyor. Gün ayırıcıları o günün cebe
 * kalanını taşıyor.
 */
export default function RecordsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const sections = useDbValue(() => {
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

    return [...byDay.entries()]
      .sort((a, b) => (a[0] < b[0] ? 1 : -1))
      .map(([date, data]) => ({
        date,
        data: data.sort((a, b) => b.at - a.at),
      }));
  }, [userId]);

  return (
    <SectionList
      sections={sections}
      keyExtractor={(item) => item.id}
      contentContainerStyle={[
        styles.page,
        { paddingTop: insets.top + space.lg },
        sections.length === 0 && styles.pageEmpty,
      ]}
      stickySectionHeadersEnabled
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
      renderSectionHeader={({ section }) => (
        <View style={[styles.dayHead, { backgroundColor: colors.background }]}>
          <Text style={[styles.dayLabel, { color: colors.textFaint }]}>
            {formatBusinessDate(section.date, 'long').toUpperCase()}
          </Text>
        </View>
      )}
      renderItem={({ item }) => (
        <View style={[styles.row, { borderBottomColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[typeScale.bodyStrong, { color: colors.text }]}>{item.title}</Text>
            {item.detail ? (
              <Text style={[typeScale.caption, { color: colors.textFaint }]}>
                {item.detail}
              </Text>
            ) : null}
          </View>
          <AmountText
            value={item.amount}
            tone={item.incoming ? 'plain' : 'cost'}
            showMinus={!item.incoming}
          />
        </View>
      )}
    />
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xxxl },
  pageEmpty: { flexGrow: 1 },
  dayHead: { paddingTop: space.lg, paddingBottom: space.xs },
  dayLabel: { ...typeScale.label, letterSpacing: 1 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.md,
    paddingVertical: space.md,
    borderBottomWidth: 1,
  },
  empty: {
    borderWidth: 1, borderStyle: 'dashed', borderRadius: 14,
    padding: space.xl, gap: space.sm,
  },
});
