import { useState } from 'react';
import { ScrollView, StyleSheet, Text } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  BestDayCard, CostsCard, EfficiencyCard, HotHoursCard, KmCard, PeriodCard, RidesCard, TimeCard,
} from '@/components/stats/stat-cards';
import { PeriodFilterBar } from '@/components/ui';
import { useDbValue } from '@/db/use-db';
import { getCutoffHour, getStatsOverview } from '@/db/repo';
import { useAuth } from '@/lib/auth/auth-context';
import { todayBusinessDate } from '@/lib/business-date';
import type { PeriodKey } from '@/lib/period';
import { space, type as typeScale, useTheme } from '@/theme/use-theme';

/**
 * İstatistik — "nerede kazanıp nerede kaybediyorum".
 *
 * Anasayfa "bugün nasıl gidiyorum"u gösteriyor: kısa, anlık, filtresiz.
 * Burası derin ve dönem filtresine göre değişiyor. Aynı kart iki ekranda
 * durmuyor: "Son 7 gün" Anasayfa'da, burada dönemin kazanç seyri.
 *
 * Kart sırası sürücüyle kararlaştırıldı (23 Eylül 2026): dönem özeti,
 * verimlilik, zaman, sıcak saatler, en verimli gün, yolcu, km, gider.
 *
 * KULLANILAN TERİMLER SABİT: Ciro, Cebe kalan, Gerçek kâr. "Yolcu" =
 * sefer. Dönem filtresi Kayıtlar'la AYNI (`period.ts`).
 *
 * Platform ve ödeme şekline göre dağılım YOK: yolcu girilirken ikisi de
 * sorulmuyor (tek dokunuş kararı), sütunlar hep varsayılan değerde.
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
    return getStatsOverview(userId, period, today);
  }, [userId, period]);

  return (
    <ScrollView
      contentContainerStyle={[styles.page, { paddingTop: insets.top + space.lg }]}
      showsVerticalScrollIndicator={false}
    >
      <Text style={[typeScale.display, { color: colors.text }]}>İstatistik</Text>

      <PeriodFilterBar value={period} onChange={setPeriod} />

      {/*
        * Kayıt olmasa da kartlar sıfırla görünüyor (sürücünün kararı):
        * sürücü kullanmaya başlamadan neyin geleceğini görsün.
        */}
      {data ? (
        <>
          <PeriodCard data={data} period={period} />
          <EfficiencyCard data={data} />
          <TimeCard data={data} />
          <HotHoursCard data={data} />
          <BestDayCard data={data} />
          <RidesCard data={data} />
          <KmCard data={data} />
          <CostsCard data={data} />
        </>
      ) : null}
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xxxl, gap: space.lg },
});
