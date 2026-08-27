import { useEffect, useRef, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { type Kurus, formatKurus, parseAmount } from '@/lib/money';
import { radius, space, type as typeScale, useTheme } from '@/theme/use-theme';

interface Props {
  value: string;
  onChangeText: (raw: string) => void;
  /** Girdi çözümlenince çağrılır; okunamayan girdide `null`. */
  onValueChange?: (value: Kurus | null) => void;
  label?: string;
  placeholder?: string;
  /** Alan açılır açılmaz klavye gelsin mi? Sefer ekleme sayfasında evet. */
  autoFocus?: boolean;
  /** Sağda birim etiketi — "₺", "lt", "km". */
  unit?: string;
  hint?: string;
}

/**
 * Büyük tutar girişi — sefer ekleme sayfasının kalbi.
 *
 * SİSTEM KLAVYESİ kullanılıyor, özel tuş takımı değil. Ondalık modu
 * Türkçe yerel ayarda virgülü zaten veriyor; özel tuş takımında virgül
 * yoktu ve `187,50 ₺` girilemiyordu.
 *
 * Girdi `parseAmount` ile okunuyor: okunamayan girdi `null` döner,
 * ASLA sıfıra düşmez. Sıfıra düşseydi sürücü yanlış yazdığını fark
 * etmeden bedava sefer kaydeder.
 */
export function AmountInput({
  value, onChangeText, onValueChange, label, placeholder = '0',
  autoFocus = false, unit = '₺', hint,
}: Props) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const ref = useRef<TextInput>(null);

  useEffect(() => {
    if (!autoFocus) return;
    /**
     * Bir kare beklemek şart: alttan açılan sayfa animasyonu bitmeden
     * odaklanınca iOS klavyeyi açmıyor ve alan sessizce boş kalıyor.
     */
    const id = setTimeout(() => ref.current?.focus(), 120);
    return () => clearTimeout(id);
  }, [autoFocus]);

  const parsed = parseAmount(value);
  const invalid = value.trim().length > 0 && parsed === null;

  return (
    <View style={styles.wrap}>
      {label ? (
        <Text style={[styles.label, { color: colors.textSoft }]}>{label}</Text>
      ) : null}

      <View
        style={[
          styles.box,
          {
            backgroundColor: colors.surface,
            borderColor: invalid ? colors.negative : focused ? colors.accent : colors.border,
            borderWidth: focused || invalid ? 2 : 1,
          },
        ]}
      >
        <TextInput
          ref={ref}
          value={value}
          onChangeText={(next) => {
            onChangeText(next);
            onValueChange?.(parseAmount(next));
          }}
          onFocus={() => setFocused(true)}
          onBlur={() => setFocused(false)}
          placeholder={placeholder}
          placeholderTextColor={colors.textFaint}
          keyboardType="decimal-pad"
          inputMode="decimal"
          style={[styles.input, { color: invalid ? colors.negative : colors.text }]}
          accessibilityLabel={label}
        />
        <Text style={[typeScale.title, { color: colors.textFaint }]}>{unit}</Text>
      </View>

      {invalid ? (
        <Text style={[typeScale.caption, { color: colors.negative }]}>
          Tutar okunamadı
        </Text>
      ) : hint ? (
        <Text style={[typeScale.caption, { color: colors.textFaint }]}>{hint}</Text>
      ) : null}
    </View>
  );
}

/**
 * İçeriği klavyenin üstünde tutan kap.
 *
 * iOS'ta sayı klavyesi ekranın altını kaplıyor. Kaydet butonu arkada
 * kalırsa sürücü kaydetmek için önce klavyeyi kapatmak zorunda kalır ve
 * girişten kazanılan hız geri verilir.
 */
export function AboveKeyboard({ children }: { children: React.ReactNode }) {
  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      style={styles.avoider}
    >
      {children}
    </KeyboardAvoidingView>
  );
}

/** Girilen ham metnin okunabilir hâli — onay satırlarında gösterilir. */
export function previewAmount(raw: string): string | null {
  const parsed = parseAmount(raw);
  return parsed === null ? null : formatKurus(parsed);
}

const styles = StyleSheet.create({
  wrap: { gap: space.xs },
  label: { ...typeScale.label, textTransform: 'uppercase' },
  box: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: space.sm,
    borderRadius: radius.md,
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  input: {
    flex: 1,
    ...typeScale.display,
    fontVariant: ['tabular-nums'],
    paddingVertical: space.xs,
  },
  avoider: { flex: 1 },
});
