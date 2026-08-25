import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getDb } from '@/db/client';
import { formatBusinessDate, todayBusinessDate } from '@/lib/business-date';
import { asBps, asKurus, applyRate, formatKurus, netAfterRate } from '@/lib/money';

/**
 * Geçici doğrulama ekranı. Faz 2'de yerini gerçek gün sonu kartı alacak.
 * Şu anki işi: veritabanı katmanının ve para/tarih modüllerinin
 * gerçek cihazda çalıştığını göstermek.
 */
export default function Home() {
  const insets = useSafeAreaInsets();

  const check = useMemo(() => {
    const tables = getDb().$client.getAllSync<{ name: string }>(
      `SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name`,
    );
    const gross = asKurus(33333);
    const rate = asBps(1750);
    return {
      tableCount: tables.length,
      tables: tables.map((t) => t.name),
      gross,
      commission: applyRate(gross, rate),
      net: netAfterRate(gross, rate),
    };
  }, []);

  const today = todayBusinessDate();

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + 24 }]}
    >
      <Text style={styles.brand}>Sürücüm</Text>
      <Text style={styles.date}>{formatBusinessDate(today, 'weekday')}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Veritabanı</Text>
        <Text style={styles.row}>{check.tableCount} tablo hazır</Text>
        <Text style={styles.mono}>{check.tables.join(' · ')}</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Para hesabı — %17,5 komisyon</Text>
        <Text style={styles.row}>Brüt: {formatKurus(check.gross)}</Text>
        <Text style={styles.row}>Komisyon: {formatKurus(check.commission)}</Text>
        <Text style={styles.rowStrong}>Net: {formatKurus(check.net)}</Text>
        <Text style={styles.note}>
          Komisyon + net = brüt:{' '}
          {check.commission + check.net === check.gross ? 'tutuyor' : 'TUTMUYOR'}
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { padding: 20, gap: 16, paddingBottom: 48 },
  brand: { fontSize: 30, fontWeight: '700', letterSpacing: -0.5 },
  date: { fontSize: 15, opacity: 0.6, marginTop: -8 },
  card: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: '#8a948e',
    padding: 16,
    gap: 6,
  },
  cardTitle: { fontSize: 12, letterSpacing: 1, textTransform: 'uppercase', opacity: 0.6 },
  row: { fontSize: 16 },
  rowStrong: { fontSize: 18, fontWeight: '600' },
  mono: { fontSize: 11, opacity: 0.5, lineHeight: 16 },
  note: { fontSize: 12, opacity: 0.6, marginTop: 4 },
});
