import { useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';

import { AboveKeyboard, AmountInput, Button, Chip, ChipRow } from '@/components/ui';
import { useDbValue } from '@/db/use-db';
import { addFuelLog, listVehicleFuelTypes } from '@/db/repo';
import { FUEL_TYPE_LABELS, type FuelType } from '@/db/schema/_shared';
import { type Kurus, parseAmount } from '@/lib/money';
import { isKnownUnitPrice, pickPrimaryFuelType } from '@/lib/fuel-type-pick';
import { useDriver } from '@/lib/use-driver';
import { requestSync } from '@/sync/scheduler';
import { space, type as typeScale, useTheme } from '@/theme/use-theme';
import { SheetHeader, sheetStyles } from '@/components/ui/sheet';

/**
 * Yakıt dolumu.
 *
 * Kilometre sayacı SORULMUYOR — tam depo/sayaç zinciri kapsam dışı.
 * Buradaki kaydın iki işi var: o gün cepten çıkan parayı yazmak ve
 * birim fiyatı güncel tutmak (gün hesabı o fiyatı kullanıyor).
 */
export default function AddFuelScreen() {
  const { colors } = useTheme();
  const { userId, vehicle, openShift } = useDriver();
  const [total, setTotal] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [fuelType, setFuelType] = useState<FuelType | null>(null);

  const fuels = useDbValue(
    () => (userId && vehicle ? listVehicleFuelTypes(userId, vehicle.id) : []),
    [userId, vehicle?.id],
  );

  /**
   * Varsayılan çip BİRİNCİL yakıt — ön dolgunun okuduğu satır. En eski
   * tipte açıldığında LPG'ye geçmiş araçta dolum benzine yazılıyor ve
   * pompada girilen fiyat vardiya sonuna hiç ulaşmıyordu.
   */
  const selected = fuelType ?? pickPrimaryFuelType(fuels)?.fuelType ?? 'gasoline';
  const totalKurus = parseAmount(total);
  const priceKurus = parseAmount(unitPrice);

  /**
   * Fiyat isteğe bağlı, ama YAZILDIYSA geçerli olmalı. Sıfır ya da eksi
   * bir fiyat kayda "bilinmiyor" diye geçmez; sürücü yanlış yazmıştır.
   */
  const priceEntered = unitPrice.trim().length > 0;
  const priceValid = !priceEntered || isKnownUnitPrice(priceKurus);
  const valid = totalKurus != null && totalKurus > 0 && vehicle != null && priceValid;

  function kaydet() {
    if (!userId || !valid || !vehicle) return;
    /**
     * Hacim birim fiyattan türetiliyor; fiyat girilmemişse sıfır kalıyor.
     * Sürücüye üç sayı birden yazdırmıyoruz — ödediği tutarı biliyor,
     * pompadaki litre fiyatını çoğu zaman hatırlıyor, litreyi hesaplamak
     * bizim işimiz.
     */
    const volume = isKnownUnitPrice(priceKurus)
      ? Math.round((totalKurus / priceKurus) * 1000)
      : 0;

    // Açık vardiya varsa gün ve araç ondan gelir (repo bunu kendisi çözer).
    addFuelLog(userId, {
      vehicleId: vehicle.id,
      shiftId: openShift?.id ?? null,
      fuelType: selected,
      totalAmountKurus: totalKurus as Kurus,
      unitPriceKurus: (isKnownUnitPrice(priceKurus) ? priceKurus : 0) as Kurus,
      volumePer1000: volume,
      isFullTank: false,
    });
    requestSync();
    router.back();
  }

  return (
    <AboveKeyboard>
      <ScrollView
        contentContainerStyle={[sheetStyles.sheet, { backgroundColor: colors.background }]}
        keyboardShouldPersistTaps="handled"
      >
        <SheetHeader title="Yakıt ekle" />

        {fuels.length > 1 ? (
          <View style={styles.block}>
            <Text style={[styles.label, { color: colors.textSoft }]}>YAKIT</Text>
            <ChipRow>
              {fuels.map((f) => (
                <Chip
                  key={f.id}
                  label={FUEL_TYPE_LABELS[f.fuelType]}
                  selected={selected === f.fuelType}
                  onPress={() => setFuelType(f.fuelType)}
                />
              ))}
            </ChipRow>
          </View>
        ) : null}

        <AmountInput label="Ödediğin tutar" value={total} onChangeText={setTotal} autoFocus />
        <AmountInput
          label="Litre fiyatı"
          value={unitPrice}
          onChangeText={setUnitPrice}
          unit="₺/lt"
          hint={priceValid
            ? 'Zorunlu değil — girersen bir sonraki vardiya sonunda litre fiyatı olarak önerilir.'
            : 'Litre fiyatı sıfırdan büyük olmalı. Bilmiyorsan boş bırak.'}
        />

        <View style={styles.spacer} />
        <Button label="Kaydet" onPress={kaydet} disabled={!valid} />
      </ScrollView>
    </AboveKeyboard>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  label: { ...typeScale.label, textTransform: 'uppercase' },
  spacer: { flex: 1, minHeight: space.md },
});
