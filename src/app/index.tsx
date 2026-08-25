import { useEffect, useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { getDb } from '@/db/client';
import { formatBusinessDate, todayBusinessDate } from '@/lib/business-date';
import { hasFeature } from '@/lib/entitlements';
import { asBps, asKurus, applyRate, formatKurus, netAfterRate } from '@/lib/money';
import { getSupabase, isCloudConfigured } from '@/lib/supabase';

type CloudState =
  | { kind: 'checking' }
  | { kind: 'off' }
  | { kind: 'ok'; rlsBlocked: boolean }
  | { kind: 'error'; message: string };

/**
 * Geçici doğrulama ekranı. Faz 2'de yerini gerçek gün sonu kartı alacak.
 * Şu anki işi: veritabanı, para/tarih modülleri ve bulut bağlantısının
 * gerçek cihazda çalıştığını göstermek.
 */
export default function Home() {
  const insets = useSafeAreaInsets();
  const [cloud, setCloud] = useState<CloudState>({ kind: 'checking' });

  const local = useMemo(() => {
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

  useEffect(() => {
    let cancelled = false;

    (async () => {
      if (!isCloudConfigured()) {
        if (!cancelled) setCloud({ kind: 'off' });
        return;
      }
      const supabase = getSupabase();
      if (!supabase) {
        if (!cancelled) setCloud({ kind: 'off' });
        return;
      }
      // Oturum açmadan sefer okumaya çalış: RLS bunu engellemeli.
      const { data, error } = await supabase.from('rides').select('id').limit(1);
      if (cancelled) return;
      if (error) {
        setCloud({ kind: 'error', message: error.message });
      } else {
        setCloud({ kind: 'ok', rlsBlocked: (data?.length ?? 0) === 0 });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const today = todayBusinessDate();

  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + 24 }]}>
      <Text style={styles.brand}>Sürücüm</Text>
      <Text style={styles.date}>{formatBusinessDate(today, 'weekday')}</Text>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Yerel veritabanı</Text>
        <Text style={styles.row}>{local.tableCount} tablo hazır</Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Para hesabı — %17,5 komisyon</Text>
        <Text style={styles.row}>Brüt: {formatKurus(local.gross)}</Text>
        <Text style={styles.row}>Komisyon: {formatKurus(local.commission)}</Text>
        <Text style={styles.rowStrong}>Net: {formatKurus(local.net)}</Text>
        <Text style={styles.note}>
          Komisyon + net = brüt:{' '}
          {local.commission + local.net === local.gross ? 'tutuyor' : 'TUTMUYOR'}
        </Text>
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Bulut</Text>
        {cloud.kind === 'checking' && <Text style={styles.row}>Kontrol ediliyor…</Text>}
        {cloud.kind === 'off' && (
          <Text style={styles.row}>Yapılandırılmamış — uygulama yine de çalışır</Text>
        )}
        {cloud.kind === 'ok' && (
          <>
            <Text style={styles.row}>Bağlantı kuruldu</Text>
            <Text style={styles.note}>
              {cloud.rlsBlocked
                ? 'RLS çalışıyor: oturumsuz sorgu veri döndürmedi'
                : 'DİKKAT: oturumsuz sorgu veri döndürdü'}
            </Text>
          </>
        )}
        {cloud.kind === 'error' && (
          <Text style={styles.row}>Hata: {cloud.message}</Text>
        )}
      </View>

      <View style={styles.card}>
        <Text style={styles.cardTitle}>Yetkiler</Text>
        <Text style={styles.note}>
          Dışa aktarım: {hasFeature('export') ? 'açık' : 'kilitli'} · Bulut yedek:{' '}
          {hasFeature('cloudBackup') ? 'açık' : 'kilitli'}
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
  note: { fontSize: 12, opacity: 0.6, marginTop: 4 },
});
