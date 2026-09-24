import { StyleSheet, Text, View } from 'react-native';
import { accentStep, radius, space, type as typeScale, useTheme } from '@/theme/use-theme';

interface HeatStripProps {
  values: readonly (number | null)[];
  labels: readonly string[];
  highlightIndex?: number | null;
  height?: number;
  accessibilityLabel: string;
}

/** Bu eşiğin altında hücreler ayrık kutu, üstünde aralıksız bant olur. */
const ROW_THRESHOLD = 12;

/**
 * Yoğunluk şeridi — saat/gün başına tek bir değerin şiddetini gösterir.
 *
 * Az sayıda hücrede (≤12, örn. haftanın günleri) her hücre kendi altındaki
 * etiketle birlikte ayrı bir kutu. Çok sayıda hücrede (>12, örn. günün 24
 * saati) kutular aralıksız bir banda dönüşüyor ve etiketler tek tek değil
 * grup grup yazılıyor — aksi hâlde 24 dar sütunun altına 24 rakam sığmaz,
 * okunmaz olurdu.
 *
 * Renk anlamsal değil, `accentScale` üzerinden şiddet: bu yüzden yeşil/kırmızı
 * (kazanç/gider) değil vurgu tonu kullanılıyor.
 */
export function HeatStrip({
  values, labels, highlightIndex, height, accessibilityLabel,
}: HeatStripProps) {
  const { colors } = useTheme();
  const isRow = values.length <= ROW_THRESHOLD;
  const cellHeight = height ?? (isRow ? 44 : 32);
  const showPerCellLabels = isRow && labels.length === values.length;

  const colorFor = (v: number | null) => (v == null ? colors.surfaceSunken : accentStep(colors, v));

  return (
    <View accessible accessibilityRole="image" accessibilityLabel={accessibilityLabel}>
      <View style={isRow ? styles.row : styles.band}>
        {values.map((v, i) => (
          <View
            key={i}
            style={[
              isRow ? styles.rowCell : styles.bandCell,
              {
                height: cellHeight,
                backgroundColor: colorFor(v),
                borderColor: i === highlightIndex ? colors.text : 'transparent',
              },
            ]}
          />
        ))}
      </View>
      {showPerCellLabels ? (
        <View style={styles.row}>
          {labels.map((label, i) => (
            <Text
              key={i}
              style={[
                typeScale.caption,
                styles.rowCaption,
                {
                  color: i === highlightIndex ? colors.text : colors.textFaint,
                  fontWeight: i === highlightIndex ? '700' : '400',
                },
              ]}
              numberOfLines={1}
            >
              {label}
            </Text>
          ))}
        </View>
      ) : null}
      {!isRow ? (
        <View style={styles.bandCaptionRow}>
          {labels.map((label, i) => (
            <Text
              key={i}
              style={[typeScale.caption, styles.bandCaption, { color: colors.textFaint }]}
              numberOfLines={1}
            >
              {label}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: space.xs },
  rowCell: { flex: 1, borderRadius: radius.sm, borderWidth: 2 },
  rowCaption: { flex: 1, textAlign: 'center', marginTop: space.xs },
  band: { flexDirection: 'row', borderRadius: radius.sm, overflow: 'hidden' },
  bandCell: { flex: 1, borderWidth: 2 },
  bandCaptionRow: { flexDirection: 'row', marginTop: space.xs },
  bandCaption: { flex: 1, textAlign: 'left' },
});
