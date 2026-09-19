import { router } from 'expo-router';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AmountText, Button, Card, SummaryRows } from '@/components/ui';
import { useDbValue } from '@/db/use-db';
import {
  getCutoffHour, getDaySummary, listExpensesInRange, listFuelLogsInRange,
  listRidesInRange, listShiftsInRange,
} from '@/db/repo';
import { useAuth } from '@/lib/auth/auth-context';
import {
  type BusinessDate, addDays, formatBusinessDate, formatClock, todayBusinessDate,
} from '@/lib/business-date';
import type { DaySummary } from '@/lib/day-summary';
import type { Shift } from '@/db/schema/earnings';
import { type Kurus, formatDecimal } from '@/lib/money';
import { resolveShiftDuration } from '@/lib/shift';
import { radius, space, type as typeScale, useTheme } from '@/theme/use-theme';

/** Kaç günlük geçmiş gösteriliyor. Sayfalama Faz 3'te. */
const WINDOW_DAYS = 60;

interface Entry {
  id: string;
  /** Düzenleme ekranı hangi tabloya bakacağını buradan biliyor. */
  kind: 'sefer' | 'gider' | 'yakit';
  at: number;
  title: string;
  detail: string;
  amount: Kurus;
  incoming: boolean;
}

interface Day {
  date: BusinessDate;
  entries: Entry[];
  /** O günün vardiyaları — detayına ve düzeltmesine buradan giriliyor. */
  shifts: Shift[];
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
 *
 * Her satır dokunulabilir: yanlış girilmiş bir tutarı düzeltmenin ya da
 * silmenin tek yolu burası. Kart başlığı o günün tam dökümüne açılıyor.
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

    const shiftsByDay = new Map<BusinessDate, Shift[]>();
    for (const s of listShiftsInRange(userId, from, to)) {
      shiftsByDay.set(s.businessDate, [...(shiftsByDay.get(s.businessDate) ?? []), s]);
    }

    const byDay = new Map<BusinessDate, Entry[]>();
    const push = (d: BusinessDate, e: Entry) => {
      const list = byDay.get(d) ?? [];
      list.push(e);
      byDay.set(d, list);
    };

    for (const r of listRidesInRange(userId, from, to)) {
      push(r.businessDate, {
        id: r.id, kind: 'sefer', at: r.occurredAt, title: 'Sefer',
        detail: r.distanceMeters ? `${formatDecimal(r.distanceMeters / 1000)} km` : '',
        amount: r.grossAmountKurus, incoming: true,
      });
    }
    for (const e of listExpensesInRange(userId, from, to)) {
      push(e.businessDate, {
        id: e.id, kind: 'gider', at: e.occurredAt, title: 'Gider',
        detail: e.notes ?? '', amount: e.amountKurus, incoming: false,
      });
    }
    for (const f of listFuelLogsInRange(userId, from, to)) {
      push(f.businessDate, {
        id: f.id, kind: 'yakit', at: f.occurredAt, title: 'Yakıt',
        // Fiyatsız dolumda hacim hesaplanamıyor ve 0 duruyor; "0,0 lt"
        // sıfır litre almış gibi okunuyordu.
        detail: f.volumePer1000 > 0
          ? `${formatDecimal(f.volumePer1000 / 1000)} lt` : 'litre bilinmiyor',
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
        shifts: shiftsByDay.get(date) ?? [],
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
        <View style={styles.header}>
          <Text style={[typeScale.display, { color: colors.text }]}>Kayıtlar</Text>

          {/*
            * Gider ve yakıt VARDİYADAN BAĞIMSIZ da girilebilmeli.
            *
            * İkisine tek giriş Anasayfa'daki açık vardiya butonlarıydı:
            * vardiya kapalıyken sürücünün otoparka ödediği parayı yazacak
            * hiçbir yeri yoktu. Kayıt için önce vardiya başlatmak, kaydı
            * hiç girmemeye yol açıyor.
            */}
          <View style={styles.actions}>
            <Button
              label="Gider" variant="secondary" plus
              style={styles.half} onPress={() => router.push('/gider')}
            />
            <Button
              label="Yakıt" variant="secondary" plus
              style={styles.half} onPress={() => router.push('/yakit')}
            />
          </View>
        </View>
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
          <Pressable
            key={entry.id}
            onPress={() => router.push({
              pathname: '/kayit', params: { tur: entry.kind, id: entry.id },
            })}
            accessibilityRole="button"
            accessibilityLabel={`${entry.title} kaydını düzenle`}
            style={({ pressed }) => [
              styles.row,
              index > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
              pressed && { backgroundColor: colors.surfaceSunken },
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
          </Pressable>
        ))}
      </View>

      {day.shifts.length > 0 ? <ShiftRows shifts={day.shifts} /> : null}

      <SummaryRows summary={day.summary} detailed={false} />
    </Card>
  );
}

/**
 * Günün vardiyaları.
 *
 * Kilometresi girilmemiş vardiya AYRICA işaretleniyor: gün özetindeki
 * "yıpranma payı hesaplanmadı" uyarısının karşılığı burada, dokunulabilir
 * hâlde duruyor. Sürücüye eksiği söyleyip düzeltme yolu vermemek,
 * uyarı değil suçlamadır.
 */
function ShiftRows({ shifts }: { shifts: readonly Shift[] }) {
  const { colors } = useTheme();
  const now = Date.now();

  return (
    <View style={styles.shifts}>
      {shifts.map((shift) => {
        const duration = resolveShiftDuration(shift, now);
        const missing = shift.distanceKm == null;

        return (
          <Pressable
            key={shift.id}
            onPress={() => router.push({ pathname: '/vardiya', params: { id: shift.id } })}
            accessibilityRole="button"
            accessibilityLabel="Vardiya detayı"
            style={({ pressed }) => [
              styles.shiftRow,
              { backgroundColor: pressed ? colors.border : colors.surfaceSunken },
            ]}
          >
            <Text style={[typeScale.body, { color: colors.text }]}>
              {formatClock(shift.startedAt)}
              {shift.endedAt ? `–${formatClock(shift.endedAt)}` : ' · açık'}
            </Text>
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>
              {Math.floor(duration.minutes / 60)}s {duration.minutes % 60}dk
              {shift.distanceKm != null ? ` · ${shift.distanceKm} km` : ''}
            </Text>
            {missing ? (
              <Text style={[typeScale.caption, { color: colors.warning }]}>
                km eksik
              </Text>
            ) : null}
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xxxl, gap: space.lg },
  pageEmpty: { flexGrow: 1 },
  header: { gap: space.md, marginBottom: space.md },
  actions: { flexDirection: 'row', gap: space.md },
  half: { flex: 1 },
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
  shifts: { gap: space.xs },
  shiftRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: space.sm,
    borderRadius: radius.sm,
    paddingHorizontal: space.md,
    paddingVertical: space.sm,
  },
});
