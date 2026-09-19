import { useState } from 'react';
import { router, useLocalSearchParams } from 'expo-router';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import {
  AboveKeyboard, AmountInput, Button, Chip, ChipGrid, Field, PageHeader, SelectField,
} from '@/components/ui';
import { useDbValue } from '@/db/use-db';
import {
  countShiftsAffectedByOwnership, createVehicle, deactivateVehicle, getVehicle,
  isVehicleOnOpenShift, listActiveVehicles, listVehicleFuelTypes, setVehicleFuelTypes,
  updateSettings, updateVehicle,
} from '@/db/repo';
import {
  FUEL_TYPE_LABELS, type FuelType, OWNERSHIP_LABELS, OWNERSHIP_TYPES,
  type OwnershipType, defaultWearPerKm,
} from '@/db/schema/_shared';
import { useAuth } from '@/lib/auth/auth-context';
import { formatKurus } from '@/lib/money';
import { OTHER_OPTION, VEHICLE_MAKES, modelYears, modelsFor } from '@/lib/vehicle-catalog';
import { requestSync } from '@/sync/scheduler';
import { radius, space, type as typeScale, useTheme } from '@/theme/use-theme';

const SELECTABLE: FuelType[] = ['gasoline', 'diesel', 'lpg', 'electric'];

/**
 * Araç ekleme ve düzenleme.
 *
 * SAHİPLİK BURADA SORULUYOR, kurulumda değil. Kurulum hedef kitleye
 * göre "kendi aracım" varsayıyor ve tek soru bile eklemiyor — ilk
 * açılışta sorulan her soru, hiç açılmayan bir uygulama riski. Ama
 * kiralık araçla çalışan sürücünün bunu düzeltebileceği bir yer olmak
 * zorunda: yıpranma payı doğrudan buna bağlı ve kiralık araçta SIFIR,
 * yoksa kira bedeliyle aynı maliyet iki kez düşülür.
 *
 * Yıpranma payının KENDİSİ yine sorulmuyor, yalnızca gösteriliyor.
 * Sürücü aracının kaç kilometrede ne kadar eridiğini bilmiyor.
 */
export default function VehicleEditScreen() {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const userId = user?.id ?? null;
  const params = useLocalSearchParams<{ id?: string }>();
  const id = params.id ?? null;

  /**
   * Kimlik URL'den geliyor; araç yalnızca BU HESABINSA açılır. Bulunamayan
   * araç için ekleme formu AÇILMIYOR — sürücü düzenlediğini sanıp yeni bir
   * araç eklerdi.
   */
  const existing = useDbValue(() => {
    if (!id || !userId) return null;
    const vehicle = getVehicle(userId, id);
    if (!vehicle) return null;
    return { vehicle, fuels: listVehicleFuelTypes(userId, id).map((f) => f.fuelType) };
  }, [id, userId]);

  const otherVehicleCount = useDbValue(
    () => (userId ? listActiveVehicles(userId).filter((v) => v.id !== id).length : 0),
    [userId, id],
  );

  const [label, setLabel] = useState<string | null>(null);
  const [make, setMake] = useState<string | null>(null);
  const [model, setModel] = useState<string | null>(null);
  const [year, setYear] = useState<string | null>(null);
  const [ownership, setOwnership] = useState<OwnershipType | null>(null);
  const [fuels, setFuels] = useState<FuelType[] | null>(null);
  const [odometer, setOdometer] = useState<string | null>(null);

  const v = existing?.vehicle ?? null;
  const labelText = label ?? v?.label ?? '';
  const makeValue = make ?? v?.make ?? null;
  const modelValue = model ?? v?.model ?? null;
  const yearValue = year ?? (v?.modelYear ? String(v.modelYear) : null);
  const ownershipValue = ownership ?? v?.ownership ?? 'owned';
  const fuelValue = fuels ?? existing?.fuels ?? ['gasoline' as FuelType];
  const odometerText = odometer
    ?? (v?.initialOdometerKm ? String(v.initialOdometerKm) : '');

  /** Ad boş bırakılırsa marka/model/yıldan türetiliyor. */
  const derived = [makeValue, modelValue, yearValue]
    .filter((p) => p && p !== OTHER_OPTION).join(' ');
  const finalLabel = labelText.trim() || derived || 'Aracım';

  /**
   * Gösterilen katsayı, KAYDEDİLECEK olan: sahiplik değişmediyse aracın
   * kendi değeri (eski bir araçta 300 olabilir), değiştiyse yeni sahipliğin
   * katsayısı. Repo da tam olarak bunu yazıyor.
   */
  const ownershipChanged = v != null && ownershipValue !== v.ownership;
  const wear = v && !ownershipChanged ? v.wearPerKmKurus : defaultWearPerKm(ownershipValue);
  const valid = fuelValue.length > 0;

  function pickMake(next: string) {
    setMake(next);
    setModel(null);
  }

  function toggleFuel(f: FuelType) {
    setFuels(fuelValue.includes(f)
      ? fuelValue.filter((x) => x !== f)
      : [...fuelValue, f]);
  }

  /**
   * Sahiplik değiştiyse ve bu, geçmiş vardiyaların gerçek kârını
   * değiştirecekse TEK SORU soruluyor. Katsayının kendisi ne soruluyor
   * ne soruda gösteriliyor; sürücü yalnızca ne olduğunu söylüyor:
   * yanlış mı girmişti, yoksa aracın durumu bugün mü değişti?
   */
  function kaydet() {
    if (!userId || !valid) return;
    if (v && ownershipChanged
      && countShiftsAffectedByOwnership(userId, v.id, ownershipValue) > 0) {
      Alert.alert(
        'Bu değişiklik geçmiş vardiyalarına da uygulansın mı?',
        'Sahipliği yanlış girdiysen geçmiş de düzelir. Aracı yeni aldıysan '
          + 'ya da kiraladıysan geçmiş olduğu gibi kalır.',
        [
          { text: 'Evet, yanlış girmiştim', onPress: () => kaydetVe(true) },
          { text: 'Hayır, bugünden itibaren', onPress: () => kaydetVe(false) },
        ],
      );
      return;
    }
    kaydetVe(false);
  }

  function kaydetVe(applyWearToPastShifts: boolean) {
    if (!userId || !valid) return;
    const km = Number(odometerText.replace(/[.\s]/g, '').replace(',', '.'));
    const odometerKm = Number.isFinite(km) && km > 0 ? Math.round(km) : null;

    if (v) {
      const saved = updateVehicle(userId, v.id, {
        label: finalLabel,
        make: makeValue,
        model: modelValue,
        modelYear: yearValue ? Number(yearValue) : null,
        // Yalnızca değiştiyse: katsayı sahiplik DEĞİŞİNCE yeniden atanıyor.
        ...(ownershipChanged ? { ownership: ownershipValue } : {}),
        initialOdometerKm: odometerKm,
      }, Date.now(), { applyWearToPastShifts });
      if (!saved) {
        Alert.alert('Araç bulunamadı', 'Bu araç silinmiş olabilir. Değişiklik kaydedilmedi.');
        return;
      }
      setVehicleFuelTypes(userId, v.id, fuelValue);
    } else {
      const created = createVehicle(userId, {
        label: finalLabel,
        ownership: ownershipValue,
        fuelTypes: fuelValue,
        make: makeValue,
        model: modelValue,
        modelYear: yearValue ? Number(yearValue) : null,
        initialOdometerKm: odometerKm,
      });
      /** Yeni eklenen araç aktif olur — sürücü onu kullanmak için ekledi. */
      updateSettings(userId, { defaultVehicleId: created.id });
    }

    requestSync();
    router.back();
  }

  /**
   * Son aracı pasifleştirmek ENGELLENİYOR.
   *
   * Araç yoksa uygulama kullanılamıyor (vardiya bir araca bağlanıyor) ve
   * sürücü kendini kurulum ekranında bulurdu. Yaptığı şeyin sonucunu
   * göremeyeceği bir eylemi sunmuyoruz.
   */
  function pasiflestir() {
    if (!v || !userId) return;
    /**
     * Açık vardiyanın aracı kaldırılamaz: vardiya bu araçla sürüyor ve
     * kalan seferleri, yakıtı ve vardiya sonu hesabı ona ait.
     */
    if (isVehicleOnOpenShift(userId, v.id)) {
      Alert.alert(
        'Vardiya bu araçla açık',
        'Bu araçla açık vardiyan var; önce vardiyayı bitir, sonra aracı kaldır.',
      );
      return;
    }
    if (otherVehicleCount === 0) {
      Alert.alert(
        'Tek aracın',
        'Bu aracı kaldırırsan uygulama kullanılamaz. Önce yeni bir araç ekle.',
      );
      return;
    }

    /**
     * Metin GERİ ALMA VAAT ETMİYOR. Eskiden "sonra geri alabilirsin"
     * diyordu ama kaldırılan aracı gösteren ya da geri getiren hiçbir
     * ekran yok; sürücü güvendiği bir yolu bulamazdı.
     */
    Alert.alert(
      'Aracı kaldır',
      'Araç listeden çıkar, geçmiş vardiya ve yakıt kayıtları durur. '
        + 'Kaldırılan araç listeye geri getirilemez; gerekirse yeniden eklersin.',
      [
        { text: 'Vazgeç', style: 'cancel' },
        {
          text: 'Kaldır',
          style: 'destructive',
          onPress: () => {
            if (!userId) return;
            if (!deactivateVehicle(userId, v.id)) {
              Alert.alert('Araç kaldırılmadı', 'Araç bulunamadı ya da açık bir vardiyada kullanılıyor.');
              return;
            }
            requestSync();
            router.back();
          },
        },
      ],
    );
  }

  if (id && !existing) {
    return (
      <View style={[styles.page, {
        backgroundColor: colors.background, paddingTop: insets.top + space.xxl,
      }]}>
        <Text style={[typeScale.title, { color: colors.text }]}>Araç bulunamadı</Text>
        <Button label="Geri" variant="secondary" onPress={() => router.back()} />
      </View>
    );
  }

  return (
    <AboveKeyboard>
      <ScrollView
        contentContainerStyle={[styles.page, {
          backgroundColor: colors.background, paddingTop: insets.top + space.lg,
        }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <PageHeader />

        <Text style={[typeScale.display, { color: colors.text }]}>
          {v ? 'Aracı düzenle' : 'Araç ekle'}
        </Text>

        <Field
          label="Araç adı"
          value={labelText}
          onChangeText={setLabel}
          placeholder={derived || 'Aracım'}
          hint="Boş bırakırsan marka ve modelden üretilir."
        />

        <SelectField
          label="Marka" value={makeValue} onChange={pickMake}
          options={VEHICLE_MAKES} placeholder="Marka seç" searchable allowCustom
        />
        <SelectField
          label="Model" value={modelValue} onChange={setModel}
          options={modelsFor(makeValue)} placeholder="Önce marka seç"
          disabled={makeValue == null} allowCustom
        />
        <SelectField
          label="Yıl" value={yearValue} onChange={setYear}
          options={modelYears()} placeholder="Yıl seç (isteğe bağlı)" searchable
        />

        <View style={styles.block}>
          <Text style={[styles.label, { color: colors.textSoft }]}>SAHİPLİK</Text>
          <ChipGrid>
            {OWNERSHIP_TYPES.map((o) => (
              <Chip
                key={o}
                label={OWNERSHIP_LABELS[o]}
                selected={ownershipValue === o}
                onPress={() => setOwnership(o)}
              />
            ))}
          </ChipGrid>
        </View>

        <View style={styles.block}>
          <Text style={[styles.label, { color: colors.textSoft }]}>YAKIT</Text>
          <ChipGrid>
            {SELECTABLE.map((f) => (
              <Chip
                key={f}
                label={FUEL_TYPE_LABELS[f]}
                selected={fuelValue.includes(f)}
                onPress={() => toggleFuel(f)}
              />
            ))}
          </ChipGrid>
          <Text style={[typeScale.caption, { color: colors.textFaint }]}>
            Dönüşümlü LPG'li araçta hem benzini hem LPG'yi seç.
          </Text>
        </View>

        <AmountInput
          label="Kilometre" value={odometerText} onChangeText={setOdometer}
          unit="km" hint="Zorunlu değil."
        />

        <View style={[styles.wear, { backgroundColor: colors.surfaceSunken }]}>
          <View style={styles.wearRow}>
            <Text style={[typeScale.body, { color: colors.textSoft }]}>Yıpranma payı</Text>
            <Text style={[typeScale.bodyStrong, { color: colors.text }]}>
              {wear > 0 ? `${formatKurus(wear)}/km` : 'yok'}
            </Text>
          </View>
          <Text style={[typeScale.caption, { color: colors.textFaint }]}>
            {wear > 0
              ? 'Amortisman, lastik, bakım, sigorta ve vergiyi kapsayan tek '
                + 'katsayı. Sahiplik biçiminden atanıyor, senden istenmiyor.'
              : 'Kiralık araçta ve işveren aracında sıfır: aracın değer kaybı '
                + 'senin cebinden çıkmıyor, kira bedeli zaten gider olarak giriliyor.'}
          </Text>
        </View>

        <View style={styles.foot}>
          <Button label="Kaydet" onPress={kaydet} disabled={!valid} />
          {v ? (
            <Button label="Aracı kaldır" variant="ghost" onPress={pasiflestir} />
          ) : null}
        </View>
      </ScrollView>
    </AboveKeyboard>
  );
}

const styles = StyleSheet.create({
  page: {
    flexGrow: 1,
    paddingHorizontal: space.xl,
    paddingBottom: space.xxxl,
    gap: space.lg,
  },
  block: { gap: space.sm },
  label: { ...typeScale.label, textTransform: 'uppercase' },
  wear: { borderRadius: radius.md, padding: space.md, gap: space.xs },
  wearRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline',
  },
  foot: { gap: space.sm, paddingTop: space.md },
});
