import { StyleSheet, Text, View, type ViewStyle } from 'react-native';
import { radius, space, type as typeScale, useTheme } from '@/theme/use-theme';
import { upperTr } from '@/lib/text';

interface Props {
  children: React.ReactNode;
  /** Üstte küçük, büyük harfli etiket. Boşsa başlık çizilmez. */
  title?: string;
  /** Başlığın sağındaki ikincil metin — tarih, sayaç, durum. */
  meta?: string;
  /**
   * Gömük yüzey. Kartın içindeki kartlar ve açıklama blokları için;
   * üst üste iki beyaz yüzey sınırsız kalıyor ve derinlik okunmuyor.
   */
  sunken?: boolean;
  style?: ViewStyle;
}

/**
 * Yüzey kabı.
 *
 * Kenarlık var, gölge yok: gölge koyu temada işe yaramıyor ve Android'de
 * `elevation` ile ayrı ayarlanması gerekiyor. Kenarlık iki temada da
 * aynı davranıyor.
 */
export function Card({ children, title, meta, sunken = false, style }: Props) {
  const { colors } = useTheme();

  return (
    <View
      style={[
        styles.card,
        {
          backgroundColor: sunken ? colors.surfaceSunken : colors.surface,
          borderColor: colors.border,
        },
        style,
      ]}
    >
      {title ? (
        <View style={styles.head}>
          <Text style={[styles.title, { color: colors.textFaint }]}>{upperTr(title)}</Text>
          {meta ? (
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>{meta}</Text>
          ) : null}
        </View>
      ) : null}
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderWidth: 1,
    borderRadius: radius.lg,
    padding: space.lg,
    gap: space.sm,
  },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: space.sm,
  },
  /** Büyük harf `upperTr` ile — `textTransform` Türkçe İ'yi bilmiyor. */
  title: { ...typeScale.label },
});
