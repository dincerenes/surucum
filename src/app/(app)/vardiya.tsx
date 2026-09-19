import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AboveKeyboard, AmountInput, Button, RideList } from '@/components/ui';
import { SheetHeader } from '@/components/ui/sheet';
import { useDbValue } from '@/db/use-db';
import {
  deleteShift, getShift, getVehicle, listRidesInShift, updateShiftTotals,
} from '@/db/repo';
import { useAuth } from '@/lib/auth/auth-context';
import { formatBusinessDate, formatClock } from '@/lib/business-date';
import {
  type Kurus, ZERO, add, formatAmountForInput, formatKurus, parseAmount,
} from '@/lib/money';
import { calculateShiftStats } from '@/lib/shift';
import { calculateWearShare } from '@/lib/profit';
import { calculateFuelCost } from '@/lib/fuel-cost';
import { parseWholeKm } from '@/lib/whole-number';
import { requestSync } from '@/sync/scheduler';
import { radius, space, type as typeScale, useTheme } from '@/theme/use-theme';

/**
 * Vardiya detayı — geçmiş bir vardiyanın tam dökümü ve DÜZELTİLMESİ.
 *
 * NEDEN ZORUNLU: vardiya sihirbazının her adımı atlanabilir ve atlanan
 * kilometre geri gelmiyordu. Sürücü "kaç km yaptın" sorusunu geçtiyse
 * o vardiyanın yıpranma payı kalıcı olarak sıfır kalıyor, gerçek kâr
 * satırı olduğundan iyi görünüyordu — üstelik ekran bunu söylüyor ama
 * sürücünün yapabileceği hiçbir şey yoktu. Düzeltilemeyen bir uyarı,
 * uyarı değil suçlamadır.
 *
 * Buradaki sayılar TEK BİR VARDİYANIN — günün değil. Aynı iş gününde
 * iki vardiya olabilir ve gün özeti Kayıtlar'daki kartta duruyor.
 */
export default function ShiftDetailScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const params = useLocalSearchParams<{ id: string }>();
  const id = params.id ?? '';

  /**
   * Kimlik URL'den geliyor; vardiya yalnızca BU HESABINSA açılır. Aracın
   * oranı da yalnızca aynı hesabın aracından okunur — gün özetiyle aynı
   * kural, yoksa iki ekran farklı yıpranma gösterirdi.
   */
  const data = useDbValue(() => {
    if (!id || !userId) return null;
    const shift = getShift(userId, id);
    if (!shift) return null;

    const rides = listRidesInShift(userId, shift.id);
    const gross = rides.reduce((acc, r) => add(acc, r.grossAmountKurus), ZERO);
    const vehicle = getVehicle(userId, shift.vehicleId);

    return {
      shift,
      rides,
      gross,
      wearPerKmKurus: vehicle?.wearPerKmKurus ?? null,
      stats: calculateShiftStats(shift, gross, rides.length, Date.now()),
    };
  }, [id, userId]);

  const [km, setKm] = useState<string | null>(null);
  const [hours, setHours] = useState<string | null>(null);
  const [commission, setCommission] = useState<string | null>(null);
  const [consumption, setConsumption] = useState<string | null>(null);
  const [price, setPrice] = useState<string | null>(null);

  if (!data) {
    return (
      <View style={[styles.page, {
        backgroundColor: colors.background, paddingTop: insets.top + space.xxl,
      }]}>
        <Text style={[typeScale.title, { color: colors.text }]}>Vardiya bulunamadı</Text>
        <Button label="Geri" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  const { shift, rides, gross, stats, wearPerKmKurus } = data;

  /** Alanlar kaydın MEVCUT değeriyle açılıyor; boş açmak veriyi siler. */
  const kmText = km ?? numberInput(shift.distanceKm);
  const hoursText = hours ?? (shift.workedMinutes
    ? numberInput(Math.round((shift.workedMinutes / 60) * 10) / 10) : '');
  const commissionText = commission ?? formatAmountForInput(shift.commissionKurus);
  const consumptionText = consumption
    ?? numberInput(shift.fuelConsumptionPer100Km
      ? shift.fuelConsumptionPer100Km / 1000 : null);
  const priceText = price ?? formatAmountForInput(shift.fuelPriceKurus);

  // Kilometre TAM SAYI: bulutta sütun integer, ondalık reddedilir.
  const kmValue = parseWholeKm(kmText);
  const hoursValue = readNumber(hoursText);
  const consumptionValue = readNumber(consumptionText);

  /** Tüketim ekranda lt/100km, veritabanında 100 km başına mililitre. */
  const consumptionPer100Km = consumptionValue != null
    ? Math.round(consumptionValue * 1000) : null;

  const wear = calculateWearShare(kmValue, wearPerKmKurus as Kurus | null);
  const fuel = calculateFuelCost(kmValue, consumptionPer100Km, parseAmount(priceText));

  function kaydet() {
    if (!userId) return;
    const saved = updateShiftTotals(userId, shift.id, {
      distanceKm: kmValue,
      workedMinutes: hoursValue != null ? Math.round(hoursValue * 60) : null,
      commissionKurus: parseAmount(commissionText) as Kurus | null,
      fuelConsumptionPer100Km: consumptionPer100Km,
      fuelPriceKurus: parseAmount(priceText) as Kurus | null,
    });
    // Vardiya bu arada silinmişse düzeltme yapılmış gibi kapanmıyoruz.
    if (!saved) {
      Alert.alert('Vardiya bulunamadı', 'Bu vardiya silinmiş olabilir. Düzeltme kaydedilmedi.');
      return;
    }
    requestSync();
    router.back();
  }

  /**
   * Vardiyayı silmek SEFERLERİ SİLMEZ.
   *
   * Seferler kendi kayıtları ve kendi iş günleri var; vardiya silinince
   * yalnızca süre, kilometre ve komisyon ortadan kalkar. Sürücünün
   * kazandığı parayı bir yönetim kaydıyla birlikte silmek, yapmak
   * istediğinden fazlasını yapmaktır.
   */
  function sil() {
    Alert.alert(
      'Vardiyayı sil',
      rides.length > 0
        ? `Bu vardiyanın ${rides.length} seferi SİLİNMEZ, kayıtlarda kalır. `
          + 'Yalnızca süre, kilometre ve komisyon bilgisi gider.'
        : 'Bu vardiya kaydı silinecek.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Sil',
          style: 'destructive',
          onPress: () => {
            if (!userId) return;
            deleteShift(userId, shift.id);
            requestSync();
            router.back();
          },
        },
      ],
    );
  }

  return (
    <AboveKeyboard>
      <ScrollView
        contentContainerStyle={[styles.page, {
          backgroundColor: colors.background, paddingTop: insets.top + space.lg,
        }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <SheetHeader title="Vardiya" />

        <View style={styles.head}>
          <Text style={[styles.eyebrow, { color: colors.textFaint }]}>
            {formatBusinessDate(shift.businessDate, 'long').toUpperCase()}
          </Text>
          <Text style={[typeScale.display, { color: colors.text }]}>
            {formatClock(shift.startedAt)}
            {shift.endedAt ? ` – ${formatClock(shift.endedAt)}` : ' – açık'}
          </Text>
        </View>

        <View style={styles.stats}>
          <Stat
            value={`${Math.floor(stats.durationMinutes / 60)}:${
              String(stats.durationMinutes % 60).padStart(2, '0')}`}
            label={stats.isDurationEstimated ? 'süre · tahmini' : 'süre'}
          />
          <Stat value={String(stats.rideCount)} label="sefer" />
          <Stat
            value={stats.distanceKm != null ? String(stats.distanceKm) : '—'}
            label="km"
          />
        </View>

        <View style={[styles.box, { backgroundColor: colors.surfaceSunken }]}>
          <Row label="Ciro" value={formatKurus(gross)} strong />
          <Row
            label="Yıpranma payı"
            value={wear > 0 ? `−${formatKurus(wear)}` : 'hesaplanmadı'}
            muted={wear === 0}
          />
          <Row
            label="Yakıt maliyeti"
            value={fuel > 0 ? `−${formatKurus(fuel)}` : 'hesaplanmadı'}
            muted={fuel === 0}
          />
          <Text style={[typeScale.caption, { color: colors.textFaint }]}>
            Günün üç satırı Kayıtlar'daki gün kartında — bir günde birden
            fazla vardiya olabilir.
          </Text>
        </View>

        <Text style={[styles.sectionLabel, { color: colors.textSoft }]}>DÜZELT</Text>

        <AmountInput
          label="Kaç km yaptın?" value={kmText} onChangeText={setKm} unit="km"
          keyboard="number-pad"
          hint="Boş bırakılırsa yıpranma payı ve yakıt maliyeti hesaplanmaz."
        />
        <AmountInput
          label="Kaç saat çalıştın?" value={hoursText} onChangeText={setHours}
          unit="saat"
        />
        <AmountInput
          label="Uygulamaya ödenen komisyon" value={commissionText}
          onChangeText={setCommission}
        />
        <AmountInput
          label="Ortalama tüketim" value={consumptionText}
          onChangeText={setConsumption} unit="lt/100km"
        />
        <AmountInput
          label="Litre fiyatı" value={priceText} onChangeText={setPrice} unit="₺/lt"
        />

        {rides.length > 0 ? <RideList rides={rides} limit={50} /> : null}

        <View style={styles.foot}>
          <Button label="Kaydet" onPress={kaydet} />
          <Button label="Vardiyayı sil" variant="ghost" onPress={sil} />
        </View>
      </ScrollView>
    </AboveKeyboard>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View style={[styles.stat, { backgroundColor: colors.surface }]}>
      <Text style={[typeScale.title, { color: colors.text, fontVariant: ['tabular-nums'] }]}>
        {value}
      </Text>
      <Text style={[typeScale.caption, { color: colors.textFaint }]}>{label}</Text>
    </View>
  );
}

function Row({
  label, value, strong = false, muted = false,
}: { label: string; value: string; strong?: boolean; muted?: boolean }) {
  const { colors } = useTheme();
  return (
    <View style={styles.row}>
      <Text style={[typeScale.body, { color: colors.textSoft }]}>{label}</Text>
      <Text
        style={[
          strong ? typeScale.bodyStrong : typeScale.body,
          { color: muted ? colors.textFaint : colors.text, fontVariant: ['tabular-nums'] },
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

/** Ondalık sayıyı düzenlenebilir metne çevirir — virgüllü, ayraçsız. */
function numberInput(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value)) return '';
  return String(value).replace('.', ',');
}

/** Boş ve okunamayan girdi `null` — sıfıra DÜŞMEZ, yoksa pay sıfırlanır. */
function readNumber(raw: string): number | null {
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;
  const value = Number(trimmed.replace(/\s/g, '').replace(',', '.'));
  if (!Number.isFinite(value) || value <= 0) return null;
  return value;
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    paddingHorizontal: space.xl,
    paddingBottom: space.xxxl,
    gap: space.lg,
  },
  head: { gap: space.xs },
  eyebrow: { ...typeScale.label, letterSpacing: 1 },
  stats: { flexDirection: 'row', gap: space.sm },
  stat: { flex: 1, borderRadius: radius.md, padding: space.md, gap: 2 },
  box: { borderRadius: radius.md, padding: space.lg, gap: space.sm },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: space.md,
  },
  sectionLabel: { ...typeScale.label, textTransform: 'uppercase' },
  foot: { gap: space.sm, paddingTop: space.md },
});
