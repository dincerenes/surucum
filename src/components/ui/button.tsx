import {
  ActivityIndicator, Pressable, StyleSheet, Text, View, type ViewStyle,
} from 'react-native';
import { HIT_SIZE, radius, space, useTheme } from '@/theme/use-theme';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';

interface Props {
  label: string;
  onPress: () => void;
  variant?: Variant;
  loading?: boolean;
  disabled?: boolean;
  style?: ViewStyle;
}

export function Button({
  label, onPress, variant = 'primary', loading = false, disabled = false, style,
}: Props) {
  const { colors } = useTheme();
  const inactive = disabled || loading;

  const bg =
    variant === 'primary' ? colors.accent
    : variant === 'danger' ? colors.negative
    : variant === 'secondary' ? colors.surface
    : 'transparent';

  const fg =
    variant === 'primary' ? colors.accentText
    : variant === 'danger' ? '#FFFFFF'
    : variant === 'ghost' ? colors.accent
    : colors.text;

  const border =
    variant === 'secondary' ? colors.borderStrong : 'transparent';

  return (
    <Pressable
      onPress={onPress}
      disabled={inactive}
      accessibilityRole="button"
      accessibilityState={{ disabled: inactive, busy: loading }}
      style={({ pressed }) => [
        styles.base,
        {
          backgroundColor: bg,
          borderColor: border,
          borderWidth: variant === 'secondary' ? 1 : 0,
          opacity: inactive ? 0.5 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={fg} />
      ) : (
        <Text style={[styles.label, { color: fg }]}>{label}</Text>
      )}
    </Pressable>
  );
}

/** Ekranın altına sabitlenen buton grubu — klavye açıkken bile erişilebilir. */
export function ButtonRow({ children }: { children: React.ReactNode }) {
  return <View style={styles.row}>{children}</View>;
}

const styles = StyleSheet.create({
  base: {
    minHeight: HIT_SIZE,
    borderRadius: radius.md,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: space.lg,
  },
  label: { fontSize: 16, fontWeight: '600' },
  row: { gap: space.md },
});
