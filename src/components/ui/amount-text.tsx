import { StyleSheet, Text, type TextStyle } from 'react-native';
import { type Kurus, formatKurus } from '@/lib/money';
import { type as typeScale, useTheme } from '@/theme/use-theme';

type Size = 'display' | 'title' | 'heading' | 'body' | 'bodyStrong' | 'caption';

interface Props {
  value: Kurus;
  size?: Size;
  /**
   * Renklendirme.
   * - `signed`: pozitif yeşil, negatif kırmızı
   * - `cost`: her zaman kırmızı — gider satırları için, tutar pozitif yazılsa da
   * - `plain`: nötr metin rengi
   */
  tone?: 'signed' | 'cost' | 'plain';
  /** Gider satırlarında başa eksi koyar: `−520,00 ₺` */
  showMinus?: boolean;
  symbol?: boolean;
  style?: TextStyle;
}

/**
 * Para gösterimi.
 *
 * `tabular-nums` ZORUNLU: alt alta gelen tutarların rakamları hizalanmazsa
 * sürücü sütunu okuyamıyor. Uygulamanın her yerinde para bu bileşenden
 * geçiyor; ham `formatKurus` çıktısı doğrudan `Text` içine yazılmıyor.
 */
export function AmountText({
  value, size = 'body', tone = 'plain', showMinus = false,
  symbol = true, style,
}: Props) {
  const { colors } = useTheme();

  const color =
    tone === 'cost' ? colors.negative
    : tone === 'signed' ? (value < 0 ? colors.negative : colors.positive)
    : colors.text;

  const text = formatKurus(value, { symbol });

  return (
    <Text style={[typeScale[size], styles.digits, { color }, style]}>
      {showMinus && value > 0 ? `\u2212${text}` : text}
    </Text>
  );
}

const styles = StyleSheet.create({
  digits: { fontVariant: ['tabular-nums'] },
});
