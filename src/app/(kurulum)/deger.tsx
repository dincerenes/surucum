import { router } from 'expo-router';
import { StyleSheet, Text, View } from 'react-native';

import { SetupStep } from '@/components/setup-step';
import { AmountInput, Chip, ChipGrid } from '@/components/ui';
import { parseAmount } from '@/lib/money';
import { upperTr } from '@/lib/text';
import { useSetupDraft } from '@/lib/setup-draft';
import { space, type as typeScale, useTheme } from '@/theme/use-theme';

/**
 * Kurulum 6 — aracın bugünkü durumu: ikinci el değeri, kilometresi,
 * hasar kaydı.
 *
 * Değer kaybı payı ikinci el değerden çıkıyor. Kilometre ilk yakıt
 * hesabının başlangıcı. Hasar kaydı şimdilik hesaba girmiyor — değer
 * zaten onu yansıtıyor — ama ileride payı ayarlamak için saklanıyor.
 */
export default function ValueStep() {
  const { colors } = useTheme();
  const { draft, update } = useSetupDraft();

  const value = draft.marketValue.trim() === '' ? null : parseAmount(draft.marketValue);
  const valid = value != null && value > 0;

  return (
    <SetupStep
      step={6}
      title="Aracın bugünkü durumu"
      subtitle="Değer kaybını hesaplamak için aracının şu anki ikinci el değerini soruyoruz."
      primary={{ label: 'Devam', onPress: () => router.push('/ozet'), disabled: !valid }}
      skip={{
        label: 'Değerini bilmiyorum, atla',
        onPress: () => {
          update({ marketValue: '' });
          router.push('/ozet');
        },
      }}
    >
      <AmountInput
        label="İkinci el değeri"
        value={draft.marketValue}
        onChangeText={(marketValue) => update({ marketValue })}
        unit="₺"
        hint="İlan sitelerindeki benzer araçların fiyatı yeterli."
      />
      <AmountInput
        label="Güncel kilometre"
        value={draft.odometer}
        onChangeText={(odometer) => update({ odometer })}
        unit="km"
        keyboard="number-pad"
        hint="Zorunlu değil."
      />
      <View style={styles.block}>
        <Text style={[typeScale.label, { color: colors.textSoft }]}>
          {upperTr('Hasar kaydı var mı?')}
        </Text>
        <ChipGrid>
          <Chip
            label="Evet"
            selected={draft.accident === true}
            onPress={() => update({ accident: true })}
          />
          <Chip
            label="Hayır"
            selected={draft.accident === false}
            onPress={() => update({ accident: false })}
          />
        </ChipGrid>
      </View>
    </SetupStep>
  );
}

const styles = StyleSheet.create({
  block: { gap: space.sm },
});
