import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AboveKeyboard, AmountInput, Button, SummaryRows } from '@/components/ui';
import { useDbValue } from '@/db/use-db';
import { endShift, getDaySummary, getKnownFuelFigures } from '@/db/repo';
import { type Kurus, parseAmount } from '@/lib/money';
import { useDriver } from '@/lib/use-driver';
import { requestSync } from '@/sync/scheduler';
import { radius, space, type as typeScale, useTheme } from '@/theme/use-theme';

/**
 * Vardiya bitirme sihirbazı — ürünün ödül anı.
 *
 * Üç adım, hepsi ATLANABİLİR. Hiçbir soru akışı bloklamıyor: eksik
 * bırakılan alan hesabı eksiltiyor ve özet bunu açıkça söylüyor.
 *
 * Sıra önemli — maliyetler önce, özet en sonda. Özet ödül; başta
 * gösterilirse geri kalanı doldurmaya kimse devam etmez.
 */
export default function EndShiftScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId, openShift, vehicle, today } = useDriver();

  const known = useDbValue(
    () => (vehicle ? getKnownFuelFigures(vehicle.id) : null),
    [vehicle?.id],
  );

  const [step, setStep] = useState(1);
  const [km, setKm] = useState('');
  const [hours, setHours] = useState('');
  const [commission, setCommission] = useState('');
  const [consumption, setConsumption] = useState(
    known?.consumptionPer100Km ? String(known.consumptionPer100Km / 1000).replace('.', ',') : '',
  );
  const [price, setPrice] = useState(
    known?.unitPriceKurus ? String(known.unitPriceKurus / 100).replace('.', ',') : '',
  );

  /** Özet adımında gösterilecek, HENÜZ KAYDEDİLMEMİŞ hesap. */
  const preview = useDbValue(() => {
    if (!userId) return null;
    return getDaySummary(userId, today);
  }, [userId, today, step]);

  function kapat() {
    if (!userId || !openShift) return;

    const kmValue = Number(km.replace(',', '.'));
    const hoursValue = Number(hours.replace(',', '.'));
    const consumptionValue = Number(consumption.replace(',', '.'));

    endShift(openShift.id, {
      distanceKm: Number.isFinite(kmValue) && kmValue > 0 ? kmValue : null,
      workedMinutes: Number.isFinite(hoursValue) && hoursValue > 0
        ? Math.round(hoursValue * 60) : null,
      commissionKurus: parseAmount(commission) as Kurus | null,
      fuelConsumptionPer100Km: Number.isFinite(consumptionValue) && consumptionValue > 0
        ? Math.round(consumptionValue * 1000) : null,
      fuelPriceKurus: parseAmount(price) as Kurus | null,
    });
    requestSync();
    setStep(3);
  }

  return (
    <AboveKeyboard>
      <View style={[styles.page, {
        backgroundColor: colors.background, paddingTop: insets.top + space.md,
      }]}>
        <View style={styles.head}>
          {step < 3 ? (
            <Pressable onPress={() => (step === 1 ? router.back() : setStep(step - 1))}>
              <Text style={[typeScale.bodyStrong, { color: colors.textSoft }]}>
                {step === 1 ? 'Vazgeç' : 'Geri'}
              </Text>
            </Pressable>
          ) : <View />}
          <View style={styles.dots}>
            {[1, 2, 3].map((n) => (
              <View
                key={n}
                style={[styles.dot, {
                  backgroundColor: n <= step ? colors.accent : colors.border,
                }]}
              />
            ))}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={styles.body}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {step === 1 ? (
            <>
              <StepTitle
                title="Mesafe ve süre"
                note="Kilometre girmezsen yıpranma payı ve yakıt maliyeti hesaplanmaz."
              />
              <AmountInput label="Kaç km yaptın?" value={km} onChangeText={setKm}
                unit="km" autoFocus />
              <AmountInput label="Kaç saat çalıştın?" value={hours} onChangeText={setHours}
                unit="saat" hint="Mola düştüysen gerçek süreyi yaz." />
            </>
          ) : null}

          {step === 2 ? (
            <>
              <StepTitle
                title="Kesinti ve yakıt"
                note="Yakıt maliyetini tüketimden hesaplıyorum; her dolumu ayrı yazmana gerek yok."
              />
              <AmountInput
                label="Bugün uygulamaya ödediğin komisyon"
                value={commission} onChangeText={setCommission} autoFocus
              />
              <AmountInput
                label="Ortalama tüketim"
                value={consumption} onChangeText={setConsumption} unit="lt/100km"
                hint="Aracının göstergesinde yazıyor. Bir kez gir, sonra hatırlarım."
              />
              <AmountInput
                label="Litre fiyatı" value={price} onChangeText={setPrice} unit="₺/lt"
              />
            </>
          ) : null}

          {step === 3 && preview ? (
            <>
              <StepTitle title="Vardiya kapandı" note="" />
              <SummaryRows summary={preview} />
            </>
          ) : null}
        </ScrollView>

        <View style={styles.foot}>
          {step === 1 ? (
            <Button label="Devam" onPress={() => setStep(2)} />
          ) : step === 2 ? (
            <Button label="Özeti gör" onPress={kapat} />
          ) : (
            <Button label="Bitir" onPress={() => router.back()} />
          )}
        </View>
      </View>
    </AboveKeyboard>
  );
}

function StepTitle({ title, note }: { title: string; note: string }) {
  const { colors } = useTheme();
  return (
    <View style={{ gap: space.xs }}>
      <Text style={[typeScale.display, { color: colors.text }]}>{title}</Text>
      {note ? (
        <Text style={[typeScale.body, { color: colors.textSoft }]}>{note}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: space.xl, paddingBottom: space.xl },
  head: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', minHeight: 40,
  },
  dots: { flexDirection: 'row', gap: space.xs },
  dot: { width: 22, height: 4, borderRadius: radius.pill },
  body: { paddingTop: space.lg, paddingBottom: space.xl, gap: space.lg },
  foot: { paddingTop: space.md },
});
