import { router } from 'expo-router';
import { Text } from 'react-native';

import { SetupStep } from '@/components/setup-step';
import { BrandBadge, SelectField } from '@/components/ui';
import { draftLabel, useSetupDraft } from '@/lib/setup-draft';
import {
  OTHER_OPTION, VEHICLE_MAKES, modelYears, modelsFor,
} from '@/lib/vehicle-catalog';
import { type as typeScale, useTheme } from '@/theme/use-theme';

const LISTED_MAKES = VEHICLE_MAKES.filter((m) => m !== OTHER_OPTION);

/**
 * Kurulum 2 — araç: marka, model, yıl.
 *
 * Üçü de LİSTEDEN seçiliyor; markalar listede logolarıyla. Listede
 * olmayan marka ya da model için listenin altında serbest giriş var —
 * hiçbir sürücü listeye takılıp kurulumu bırakamamalı.
 *
 * Plaka SORULMUYOR: hiçbir hesaba girmiyor, gereksiz kişisel veri.
 */
export default function VehicleStep() {
  const { colors } = useTheme();
  const { draft, update } = useSetupDraft();

  /** Marka değişince model sıfırlanır — eski model yeni markaya ait değil. */
  function pickMake(make: string) {
    if (make !== draft.make) update({ make, model: null });
  }

  const valid = draft.make != null && draft.model != null;

  return (
    <SetupStep
      step={2}
      title="Hangi araçla çalışıyorsun?"
      subtitle="Kazanç ve giderler bu araca yazılır. Sonradan araç ekleyip aralarında geçebilirsin."
      primary={{ label: 'Devam', onPress: () => router.push('/yakit-vites'), disabled: !valid }}
    >
      <SelectField
        label="Marka" value={draft.make} onChange={pickMake}
        options={LISTED_MAKES} placeholder="Marka seç"
        searchable allowCustom
        renderIcon={(make) => <BrandBadge make={make} size={32} />}
      />
      <SelectField
        label="Model" value={draft.model} onChange={(model) => update({ model })}
        options={modelsFor(draft.make)}
        placeholder={draft.make ? 'Model seç' : 'Önce marka seç'}
        disabled={!draft.make} allowCustom
      />
      <SelectField
        label="Yıl" value={draft.year} onChange={(year) => update({ year })}
        options={modelYears()} placeholder="Yıl seç (isteğe bağlı)"
        searchable
      />

      {valid ? (
        <Text style={[typeScale.caption, { color: colors.textFaint }]}>
          Araç <Text style={{ color: colors.text }}>{draftLabel(draft)}</Text> olarak adlandırılacak.
        </Text>
      ) : null}
    </SetupStep>
  );
}
