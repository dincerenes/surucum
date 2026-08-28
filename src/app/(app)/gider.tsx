import { useState } from 'react';
import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { AboveKeyboard, AmountInput, Button, Chip, ChipGrid } from '@/components/ui';
import { useDbValue } from '@/db/use-db';
import { addExpense, listActiveExpenseCategories, seedSystemCategories } from '@/db/repo';
import { type Kurus, parseAmount } from '@/lib/money';
import { useDriver } from '@/lib/use-driver';
import { requestSync } from '@/sync/scheduler';
import { space, type as typeScale, useTheme } from '@/theme/use-theme';
import { SheetHeader, sheetStyles } from '@/components/ui/sheet';

/**
 * Gider ekleme — çip seç, tutar yaz.
 *
 * Kategoriler serbest metin değil çip: sürücü hareket hâlindeki bir
 * araçta klavye açıp "otopark" yazmıyor, tek dokunuşla seçiyor.
 */
export default function AddExpenseScreen() {
  const { colors } = useTheme();
  const { userId, vehicle } = useDriver();
  const [raw, setRaw] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);

  const categories = useDbValue(() => {
    if (!userId) return [];
    seedSystemCategories(userId);
    return listActiveExpenseCategories(userId);
  }, [userId]);

  const amount = parseAmount(raw);
  const selected = categoryId ?? categories[0]?.id ?? null;
  const valid = amount != null && amount > 0 && selected != null;

  function kaydet() {
    if (!userId || !valid) return;
    addExpense(userId, {
      categoryId: selected,
      amountKurus: amount as Kurus,
      vehicleId: vehicle?.id ?? null,
    });
    requestSync();
    router.back();
  }

  return (
    <AboveKeyboard>
      <View style={[sheetStyles.sheet, { backgroundColor: colors.background }]}>
        <SheetHeader title="Gider ekle" />

        <View style={styles.block}>
          <Text style={[styles.label, { color: colors.textSoft }]}>NE İÇİN</Text>
          <ChipGrid>
            {categories.map((c) => (
              <Chip
                key={c.id}
                label={c.name}
                selected={selected === c.id}
                onPress={() => setCategoryId(c.id)}
              />
            ))}
          </ChipGrid>
        </View>

        <AmountInput label="Tutar" value={raw} onChangeText={setRaw} autoFocus />

        <View style={styles.spacer} />
        <Button label="Kaydet" onPress={kaydet} disabled={!valid} />
      </View>
    </AboveKeyboard>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
  label: { ...typeScale.label, textTransform: 'uppercase' },
  spacer: { flex: 1, minHeight: space.md },
});
