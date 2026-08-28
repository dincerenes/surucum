import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AboveKeyboard, AmountInput, Button } from '@/components/ui';
import { addRide } from '@/db/repo';
import { type Kurus, parseAmount } from '@/lib/money';
import { useDriver } from '@/lib/use-driver';
import { requestSync } from '@/sync/scheduler';
import { space, type as typeScale, useTheme } from '@/theme/use-theme';
import { SheetHeader, sheetStyles } from '@/components/ui/sheet';

/**
 * Sefer ekleme — TEK ALAN.
 *
 * Kazanç kaynağı seçimi yok (tek platform), komisyon yok (vardiya
 * sonunda tek rakam), ödeme yöntemi yok. Sürücü günde kırk kez buraya
 * giriyor; her fazladan alan o kırk kez tekrarlanan bir yük.
 *
 * Hedef: aç → yaz → kaydet, üç saniye.
 */
export default function AddRideScreen() {
  const { colors } = useTheme();
  const { userId, vehicle, openShift } = useDriver();
  const [raw, setRaw] = useState('');

  const amount = parseAmount(raw);
  const valid = amount != null && amount > 0;

  function kaydet() {
    if (!userId || !valid) return;
    addRide(userId, {
      grossAmountKurus: amount as Kurus,
      shiftId: openShift?.id ?? null,
      vehicleId: vehicle?.id ?? null,
    });
    requestSync();
    router.back();
  }

  return (
    <AboveKeyboard>
      <View style={[sheetStyles.sheet, { backgroundColor: colors.background }]}>
        <SheetHeader title="Sefer ekle" />

        <AmountInput
          label="Tutar"
          value={raw}
          onChangeText={setRaw}
          autoFocus
          hint="Müşteriden aldığın tutarı yaz. Komisyonu vardiya sonunda soracağım."
        />

        {!openShift ? (
          <Text style={[typeScale.caption, { color: colors.warning }]}>
            Vardiya açık değil — sefer yine kaydedilir, ama vardiya
            istatistiklerine girmez.
          </Text>
        ) : null}

        <View style={styles.spacer} />

        <Button label="Kaydet" onPress={kaydet} disabled={!valid} />
      </View>
    </AboveKeyboard>
  );
}

const styles = StyleSheet.create({
  spacer: { flex: 1, minHeight: space.lg },
});
