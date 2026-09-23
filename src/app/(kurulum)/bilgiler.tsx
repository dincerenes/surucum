import { router } from 'expo-router';
import { useState } from 'react';

import { SetupStep } from '@/components/setup-step';
import { Field, SelectField } from '@/components/ui';
import { getSettings, updateSettings } from '@/db/repo';
import { useAuth } from '@/lib/auth/auth-context';
import { CITIES } from '@/lib/cities';
import { MAX_DISPLAY_NAME, normalizeDisplayName } from '@/lib/profile';
import { requestSync } from '@/sync/scheduler';

/**
 * Kurulum 1 — kişisel bilgiler: ad soyad ve çalışılan şehir.
 *
 * Araç sorularından farklı olarak bu adım HEMEN kaydediliyor: ad ve
 * şehir araçtan bağımsız ve sürücü kurulumu yarıda bıraksa bile
 * bir daha sorulmasın.
 *
 * Kayıtta ad yazıldıysa (hesabın metadata'sı) alan dolu geliyor.
 */
export default function InfoStep() {
  const { user } = useAuth();
  const userId = user?.id ?? null;

  const [initial] = useState(() => {
    const settings = userId ? getSettings(userId) : undefined;
    const signupName = user?.user_metadata?.display_name;
    return {
      name: settings?.displayName ?? (typeof signupName === 'string' ? signupName : ''),
      city: settings?.city ?? null,
    };
  });
  const [name, setName] = useState(initial.name);
  const [city, setCity] = useState<string | null>(initial.city);

  const valid = normalizeDisplayName(name) != null && city != null;

  function devam() {
    if (!userId || !valid) return;
    updateSettings(userId, { displayName: name, city });
    requestSync();
    router.push('/arac');
  }

  return (
    <SetupStep
      step={1}
      title="Seni tanıyalım"
      subtitle="Anasayfada seni adınla karşılarız. Şehrin, ileride bölgendeki sürücülerle karşılaştırma için."
      primary={{ label: 'Kaydet ve devam et', onPress: devam, disabled: !valid }}
    >
      <Field
        label="Ad soyad"
        value={name}
        onChangeText={setName}
        placeholder="Örn. Enes Dinçer"
        autoCapitalize="words"
        autoComplete="name"
        textContentType="name"
        maxLength={MAX_DISPLAY_NAME}
      />
      <SelectField
        label="Çalıştığın şehir"
        value={city}
        onChange={setCity}
        options={CITIES}
        placeholder="Şehrini seç"
        searchable
      />
    </SetupStep>
  );
}
