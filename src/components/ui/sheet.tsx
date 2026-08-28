import { router } from 'expo-router';
import { Pressable, StyleSheet, Text, View } from 'react-native';

import { HIT_SIZE, space, type as typeScale, useTheme } from '@/theme/use-theme';

/**
 * Alttan açılan sayfaların ortak başlığı.
 *
 * "Kapat" solda değil sağda: sağ üst, tek elle tutulan telefonda
 * başparmağın en rahat ulaştığı köşe değil — yanlışlıkla kapatmayı
 * zorlaştırıyor. Yarım doldurulmuş bir formu kazara kapatmak, sürücünün
 * yeniden yazması demek.
 */
export function SheetHeader({ title }: { title: string }) {
  const { colors } = useTheme();

  return (
    <View style={styles.head}>
      <Text style={[typeScale.title, { color: colors.text }]}>{title}</Text>
      <Pressable
        onPress={() => router.back()}
        accessibilityRole="button"
        accessibilityLabel="Kapat"
        hitSlop={space.md}
        style={({ pressed }) => [styles.close, { opacity: pressed ? 0.6 : 1 }]}
      >
        <Text style={[typeScale.bodyStrong, { color: colors.accent }]}>Kapat</Text>
      </Pressable>
    </View>
  );
}

export const sheetStyles = StyleSheet.create({
  sheet: {
    flex: 1,
    paddingHorizontal: space.xl,
    paddingTop: space.lg,
    paddingBottom: space.xl,
    gap: space.lg,
  },
});

const styles = StyleSheet.create({
  head: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    minHeight: HIT_SIZE - space.md,
  },
  close: { paddingHorizontal: space.sm, paddingVertical: space.xs },
});
