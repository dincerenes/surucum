import { useState } from 'react';
import { router } from 'expo-router';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Button, SelectField } from '@/components/ui';
import {
  OTHER_OPTION, VEHICLE_MAKES, modelYears, modelsFor,
} from '@/lib/vehicle-catalog';
import { space, type as typeScale, useTheme } from '@/theme/use-theme';

/**
 * Kurulum 1/3 — araç kimliği.
 *
 * Üçü de LİSTEDEN seçiliyor, elle yazılmıyor: aynı aracı "renault",
 * "Renault", "RENAULT" diye yazmak veriyi kirletir ve ileride araç
 * bazlı karşılaştırmayı imkânsız kılar. Ayrıca üç dokunuş, üç yazımdan
 * hızlı.
 *
 * Plaka SORULMUYOR. Hedef kitle kendi arabasıyla çalışıyor; plaka hiçbir
 * hesaba girmiyor ve gereksiz kişisel veri istemek güven kaybettiriyor.
 */
export default function VehicleStep() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();

  const [make, setMake] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [year, setYear] = useState<string | null>(null);

  /** Marka değişince model sıfırlanır — eski model yeni markaya ait değil. */
  function pickMake(next: string) {
    setMake(next);
    setModel(null);
  }

  const label = [make, model, year]
    .filter((p) => p && p !== OTHER_OPTION)
    .join(' ');
  const valid = make != null && model != null;

  return (
    <View style={[styles.page, { paddingTop: insets.top + space.xxl }]}>
      <ScrollView contentContainerStyle={styles.body} showsVerticalScrollIndicator={false}>
        <Text style={[typeScale.display, { color: colors.text }]}>
          Hangi araçla çalışıyorsun?
        </Text>
        <Text style={[typeScale.body, { color: colors.textSoft }]}>
          Kazanç ve gider bu araca yazılır. Sonradan araç ekleyip
          aralarında geçebilirsin.
        </Text>

        <View style={styles.fields}>
          <SelectField
            label="Marka" value={make} onChange={pickMake}
            options={VEHICLE_MAKES} placeholder="Marka seç"
            searchable allowCustom
          />
          <SelectField
            label="Model" value={model} onChange={setModel}
            options={modelsFor(make)} placeholder="Önce marka seç"
            disabled={make == null} allowCustom
          />
          <SelectField
            label="Yıl" value={year} onChange={setYear}
            options={modelYears()} placeholder="Yıl seç (isteğe bağlı)"
            searchable
          />
        </View>

        {label ? (
          <Text style={[typeScale.caption, { color: colors.textFaint }]}>
            Araç <Text style={{ color: colors.text }}>{label}</Text> olarak adlandırılacak.
          </Text>
        ) : null}
      </ScrollView>

      <Button
        label="Devam"
        disabled={!valid}
        onPress={() => router.push({
          pathname: '/detay',
          params: {
            make: make ?? '',
            model: model ?? '',
            year: year ?? '',
            label: label || 'Aracım',
          },
        })}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  page: { flex: 1, paddingHorizontal: space.xl, paddingBottom: space.xl },
  body: { gap: space.md, paddingBottom: space.xl },
  fields: { gap: space.lg, marginTop: space.md },
});
