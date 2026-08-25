import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button } from '@/components/ui/button';
import { getDb } from '@/db/client';
import { useAuth } from '@/lib/auth/auth-context';
import { formatBusinessDate, todayBusinessDate } from '@/lib/business-date';
import { asBps, asKurus, applyRate, formatKurus, netAfterRate } from '@/lib/money';
import { radius, space, type as typeScale, useTheme } from '@/theme/use-theme';

/**
 * Geçici ana ekran. Faz 2'de yerini gerçek gün sonu kartı ve hızlı sefer
 * girişi alacak. Şu anki işi: katmanların gerçek cihazda çalıştığını
 * göstermek ve oturumu yönetebilmek.
 */
export default function HomeScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user, signOut, cloudAvailable } = useAuth();

  const check = useMemo(() => {
    const tables = getDb().$client.getAllSync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    );
    const gross = asKurus(33333);
    const rate = asBps(1750);
    return {
      tableCount: tables.length,
      gross,
      commission: applyRate(gross, rate),
      net: netAfterRate(gross, rate),
    };
  }, []);

  const today = todayBusinessDate();

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.xl }]}
    >
      <View style={styles.header}>
        <Text style={[typeScale.display, { color: colors.text }]}>Sürücüm</Text>
        <Text style={[typeScale.body, { color: colors.textSoft }]}>
          {formatBusinessDate(today, 'weekday')}
        </Text>
      </View>

      <Card title="Hesap">
        <Text style={[typeScale.body, { color: colors.text }]}>
          {user?.email ?? 'Yerel mod — hesap yok'}
        </Text>
        <Text style={[typeScale.caption, { color: colors.textFaint }]}>
          {cloudAvailable
            ? 'Kayıtların cihazında tutuluyor, bulut yalnızca yedek.'
            : 'Bulut yapılandırılmamış; uygulama tamamen yerel çalışıyor.'}
        </Text>
      </Card>

      <Card title="Yerel veritabanı">
        <Text style={[typeScale.bodyStrong, { color: colors.text }]}>
          {check.tableCount} tablo hazır
        </Text>
      </Card>

      <Card title="Para hesabı — %17,5 komisyon">
        <Row label="Brüt" value={formatKurus(check.gross)} />
        <Row label="Komisyon" value={formatKurus(check.commission)} negative />
        <Row label="Net" value={formatKurus(check.net)} strong />
        <Text style={[typeScale.caption, { color: colors.textFaint, marginTop: space.xs }]}>
          Komisyon + net = brüt:{' '}
          {check.commission + check.net === check.gross ? 'tutuyor' : 'TUTMUYOR'}
        </Text>
      </Card>

      {user ? (
        <Button label="Çıkış yap" variant="secondary" onPress={signOut} />
      ) : null}
    </ScrollView>
  );
}

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <Text style={[typeScale.label, { color: colors.textFaint, textTransform: 'uppercase' }]}>
        {title}
      </Text>
      {children}
    </View>
  );
}

function Row({
  label, value, strong = false, negative = false,
}: { label: string; value: string; strong?: boolean; negative?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[typeScale.body, { color: colors.textSoft }]}>{label}</Text>
      <Text
        style={[
          strong ? typeScale.bodyStrong : typeScale.body,
          {
            color: negative ? colors.negative : colors.text,
            fontVariant: ['tabular-nums'],
          },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xxxl, gap: space.lg },
  header: { gap: space.xs, marginBottom: space.xs },
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
  },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
});
