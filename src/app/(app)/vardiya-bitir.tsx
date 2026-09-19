import { useState } from 'react';
import { router } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AboveKeyboard, AmountInput, Button, Chip, ChipGrid, SummaryRows,
} from '@/components/ui';
import { useDbValue } from '@/db/use-db';
import {
  addExpense, endShift, getDaySummary, getKnownFuelFigures,
  listActiveExpenseCategories, seedSystemCategories,
} from '@/db/repo';
import type { BusinessDate } from '@/lib/business-date';
import { type Kurus, formatKurus, parseAmount } from '@/lib/money';
import { useDriver } from '@/lib/use-driver';
import { parseWholeKm } from '@/lib/whole-number';
import { requestSync } from '@/sync/scheduler';
import { radius, space, type as typeScale, useTheme } from '@/theme/use-theme';

/**
 * Vardiya bitirme sihirbazı — ürünün ödül anı.
 *
 * Dört adım, hepsi ATLANABİLİR. Hiçbir soru akışı bloklamıyor: eksik
 * bırakılan alan hesabı eksiltiyor ve özet bunu açıkça söylüyor.
 *
 * Sıra önemli — maliyetler önce, özet en sonda. Özet ödül; başta
 * gösterilirse geri kalanı doldurmaya kimse devam etmez.
 *
 * GİDER ADIMINDA YAKIT ÇİPİ YOK. Tasarım listesinde vardı ama bir önceki
 * adım zaten tüketimi ve litre fiyatını soruyor: vardiyanın yakıtı
 * ondan üretiliyor ve o vardiyanın dolumu ayrıca sayılmıyor (ikisi
 * birden sayılsaydı aynı yakıt iki kez düşülürdü). İki adım arayla aynı
 * şeyi iki kez sormak, sürücüye girdiğinin sayılmadığı bir alan
 * sunmaktır. Dolum Anasayfa'dan (açık vardiya) ya da Kayıtlar'dan girilir.
 */
export default function EndShiftScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { userId, openShift, vehicle, today } = useDriver();

  /**
   * Ön dolgu VARDİYANIN ARACINDAN: vardiya ortasında Araçlarım'da başka
   * araç seçilmiş olabilir; tüketim ve fiyat bu vardiyanın aracına ait.
   */
  const fuelVehicleId = openShift?.vehicleId ?? vehicle?.id ?? null;
  const known = useDbValue(
    () => (userId && fuelVehicleId ? getKnownFuelFigures(userId, fuelVehicleId) : null),
    [userId, fuelVehicleId],
  );

  /**
   * Özetin günü, vardiya KAPANMADAN ÖNCE sabitlenir.
   *
   * Kapanınca `today` vardiyanın gününden takvim gününe atlar. Sabitlemezsek
   * ödül anında boş bir gün gösteririz: gece 22:00'de başlayıp 05:00'te
   * kapanan vardiya 28'e yazılıdır, ekran 29'a geçer ve sürücü kazandığı
   * paranın kaybolduğunu görür.
   */
  const [closedDate, setClosedDate] = useState<BusinessDate | null>(null);
  const summaryDate = closedDate ?? openShift?.businessDate ?? today;

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

  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [expenseRaw, setExpenseRaw] = useState('');
  /** Bu adımda eklenenler — sürücü ne girdiğini görmeden devam etmemeli. */
  const [added, setAdded] = useState<Array<{ name: string; amount: Kurus }>>([]);

  const categories = useDbValue(() => {
    if (!userId) return [];
    seedSystemCategories(userId);
    return listActiveExpenseCategories(userId);
  }, [userId]);

  /** Özet adımında gösterilecek, HENÜZ KAYDEDİLMEMİŞ hesap. */
  const preview = useDbValue(() => {
    if (!userId) return null;
    return getDaySummary(userId, summaryDate);
  }, [userId, summaryDate, step]);

  const expenseAmount = parseAmount(expenseRaw);
  const selectedCategory = categoryId ?? categories[0]?.id ?? null;
  const canAddExpense = expenseAmount != null && expenseAmount > 0
    && selectedCategory != null;

  /**
   * Gider ANINDA yazılıyor, özete kadar bekletilmiyor.
   *
   * Beklettiğimizde sürücü sihirbazı yarıda bıraktığında girdiği kalemler
   * kayboluyordu. Kayıt yazıldıktan sonra listede görünüyor; yanlış
   * girileni Kayıtlar'dan düzeltmek mümkün.
   */
  function giderEkle() {
    if (!userId || !canAddExpense || !selectedCategory) return;
    addExpense(userId, {
      categoryId: selectedCategory,
      amountKurus: expenseAmount as Kurus,
      vehicleId: vehicle?.id ?? null,
      // Gün ve araç vardiyadan gelir.
      shiftId: openShift?.id ?? null,
    });
    const name = categories.find((c) => c.id === selectedCategory)?.name ?? 'Gider';
    setAdded((cur) => [...cur, { name, amount: expenseAmount as Kurus }]);
    setExpenseRaw('');
    requestSync();
  }

  function kapat() {
    if (!userId || !openShift) return;
    setClosedDate(openShift.businessDate);

    const hoursValue = Number(hours.replace(',', '.'));
    const consumptionValue = Number(consumption.replace(',', '.'));

    endShift(userId, openShift.id, {
      // Kilometre TAM SAYI: bulutta sütun integer, ondalık reddedilir.
      distanceKm: parseWholeKm(km),
      workedMinutes: Number.isFinite(hoursValue) && hoursValue > 0
        ? Math.round(hoursValue * 60) : null,
      commissionKurus: parseAmount(commission) as Kurus | null,
      fuelConsumptionPer100Km: Number.isFinite(consumptionValue) && consumptionValue > 0
        ? Math.round(consumptionValue * 1000) : null,
      fuelPriceKurus: parseAmount(price) as Kurus | null,
    });
    requestSync();
    setStep(4);
  }

  return (
    <AboveKeyboard>
      <View style={[styles.page, {
        backgroundColor: colors.background, paddingTop: insets.top + space.md,
      }]}>
        <View style={styles.head}>
          {/*
            * Özet adımında (4) geri yok: vardiya o noktada KAPANMIŞ ve
            * geri dönmek sürücüye kapanmamış gibi bir ekran gösterirdi.
            * Gider adımından (3) geri dönülebilir — orada henüz kapanma yok.
            */}
          {step < 4 ? (
            <Pressable onPress={() => (step === 1 ? router.back() : setStep(step - 1))}>
              <Text style={[typeScale.bodyStrong, { color: colors.textSoft }]}>
                {step === 1 ? 'Vazgeç' : 'Geri'}
              </Text>
            </Pressable>
          ) : <View />}
          <View style={styles.dots}>
            {[1, 2, 3, 4].map((n) => (
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
                unit="km" keyboard="number-pad" autoFocus />
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

          {step === 3 ? (
            <>
              <StepTitle
                title="Ekstra gider var mı?"
                note="Yoksa geç. Girdiğin her kalem bugünün cebe kalanından düşer."
              />
              <ChipGrid>
                {categories.map((c) => (
                  <Chip
                    key={c.id}
                    label={c.name}
                    /*
                     * Seçili hâl, kaydın GERÇEKTEN gideceği kategoriyi
                     * gösteriyor. `categoryId === c.id` yazsaydık hiçbir
                     * çip seçili görünmezken kayıt ilkine giderdi: sürücü
                     * otopark parasını yemek olarak kaydederdi.
                     */
                    selected={selectedCategory === c.id}
                    onPress={() => setCategoryId(c.id)}
                  />
                ))}
              </ChipGrid>
              <AmountInput
                label="Tutar" value={expenseRaw} onChangeText={setExpenseRaw}
              />
              <Button
                label="Gideri ekle"
                variant="secondary"
                disabled={!canAddExpense}
                onPress={giderEkle}
              />

              {added.length > 0 ? (
                <View style={[styles.added, { borderColor: colors.border }]}>
                  {added.map((e, i) => (
                    <View key={`${e.name}-${i}`} style={styles.addedRow}>
                      <Text style={[typeScale.body, { color: colors.text }]}>{e.name}</Text>
                      <Text style={[typeScale.body, {
                        color: colors.negative, fontVariant: ['tabular-nums'],
                      }]}>
                        {'\u2212'}{formatKurus(e.amount)}
                      </Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </>
          ) : null}

          {step === 4 && preview ? (
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
            <Button label="Devam" onPress={() => setStep(3)} />
          ) : step === 3 ? (
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
  added: { borderWidth: 1, borderRadius: radius.md, padding: space.md, gap: space.sm },
  addedRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
  },
  foot: { paddingTop: space.md },
});
