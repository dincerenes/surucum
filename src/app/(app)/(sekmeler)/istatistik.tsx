import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { space, type as typeScale, useTheme } from '@/theme/use-theme';

/**
 * İstatistik — Faz 3'te dolacak.
 *
 * Sekme şimdiden duruyor ki çubuk sonradan yeniden dizilmesin: sürücü
 * sekmelerin yerini kas hafızasıyla öğreniyor ve sonradan araya bir
 * sekme sokmak öğrendiği her şeyi bozar.
 */
export default function StatsScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  return (
    <ScrollView contentContainerStyle={[styles.page, { paddingTop: insets.top + space.lg }]}>
      <Text style={[typeScale.display, { color: colors.text }]}>İstatistik</Text>
      <View style={[styles.soon, { borderColor: colors.border }]}>
        <Text style={[typeScale.heading, { color: colors.text }]}>Yakında</Text>
        <Text style={[typeScale.body, { color: colors.textSoft }]}>
          Hangi gün ve saatlerde daha çok kazandığın, aylık karşılaştırma ve
          kilometre başına gerçek kazanç buraya gelecek. Birkaç haftalık kayıt
          birikince anlamlı olacak.
        </Text>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  page: { paddingHorizontal: space.xl, paddingBottom: space.xxxl, gap: space.lg },
  soon: {
    borderWidth: 1, borderStyle: 'dashed', borderRadius: 14,
    padding: space.xl, gap: space.sm,
  },
});
