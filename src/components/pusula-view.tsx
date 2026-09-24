/**
 * Pusula — İstatistik'in ikinci bölümü: şehrin sıcak saatleri, günleri
 * ve bölgeleri. Ekran `src/app/(app)/(sekmeler)/istatistik.tsx`.
 *
 * `src/app` altında değil: oradaki her dosya bir ekran oluyor.
 *
 * HER ŞEY TAHMİN. Veri sürücü kayıtlarından değil, şehrin genel iş, okul,
 * gece hayatı, turizm ve ulaşım düzeninden derlendi (`pusula-data.ts`).
 * "Bilinmeyen tahmin edilmez" kuralı burada ancak şöyle tutuyor: her
 * kartın üstünde "Tahmini" yazıyor, hiçbir yerde sayı ya da yüzde
 * gösterilmiyor (0–100 ölçeği sürücüye kesinlik gibi görünür) ve para
 * kelimesi geçmiyor — Pusula yoğunluk anlatır, "daha çok kazanırsın" demez.
 *
 * Isı rengi mavi `accentScale`: kırmızı/yeşil kazanç ve gidere, turuncu
 * uyarıya ayrılmış.
 */

import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';

import {
  Badge, Button, Card, Chip, ChipRow, HeatStrip, Notice, TextLink,
} from '@/components/ui';
import { WEEKDAYS_SHORT_TR, formatClock } from '@/lib/business-date';
import type { PusulaCity } from '@/lib/pusula-data';
import {
  type CityResolution, type DemandLevel, LEVEL_LABELS, SOURCE_LABELS, type ZoneView,
  activeZonesSentence, formatWindow, getDemandModel,
  hotDaysSentence, hotHoursSentence, nowSentence, orderedCities, pusulaSnapshot,
} from '@/lib/pusula';
import { useNow } from '@/lib/use-now';
import { radius, space, type as typeScale, useTheme } from '@/theme/use-theme';

/** Bölge listesi ilk bakışta bu kadar satır — gerisi "Tüm bölgeler" ile. */
const ZONES_PREVIEW = 6;

/**
 * Günlerin tonu en sakin günden en yoğun güne YAYILIYOR. Günler arası fark
 * küçük (en sakin gün bile en yoğunun %70'i); oranı doğrudan boyayınca
 * yedi hücre de aynı koyu mavide kalıyor ve şerit bir şey söylemiyordu.
 */
function spread(values: readonly number[]): number[] {
  const min = Math.min(...values);
  const max = Math.max(...values);
  if (max <= min) return values.map(() => 1);
  return values.map((v) => 0.15 + (0.85 * (v - min)) / (max - min));
}

/** Şeridin altındaki saat etiketleri: sürücü günü 06:00'da başlıyor. */
const HOUR_LABELS = ['06', '12', '18', '00'] as const;

interface Props {
  resolution: CityResolution;
  city: PusulaCity;
  onCityChange: (city: PusulaCity) => void;
}

export function PusulaView({ resolution, city, onCityChange }: Props) {
  const { colors } = useTheme();
  /** Dakikada bir: "Şu an" kartı saat ilerledikçe kendiliğinden değişsin. */
  const now = useNow(60_000);
  const minute = Math.floor(now / 60_000);
  const [dayOffset, setDayOffset] = useState(0);

  const model = getDemandModel(city);
  const snap = useMemo(
    () => pusulaSnapshot(model, new Date(minute * 60_000), dayOffset),
    [model, minute, dayOffset],
  );
  const label = SOURCE_LABELS[snap.source];

  return (
    <>
      <Text style={[typeScale.body, { color: colors.textSoft }]}>
        Şehrinde hangi saat, gün ve bölgenin hareketli olduğuna dair genel bir tahmin.
      </Text>

      <CityPicker resolution={resolution} city={city} onChange={onCityChange} />

      <Card
        title="Şu an"
        meta={`${label} · ${formatClock(now)}`}
        icon={{ ios: 'clock.fill', android: 'schedule' }}
      >
        <View style={styles.nowHead}>
          <Text style={[typeScale.title, { color: colors.text }]}>
            {LEVEL_LABELS[snap.now.level]}
          </Text>
          <LevelMeter level={snap.now.level} />
        </View>
        <Text style={[typeScale.body, { color: colors.textSoft }]}>
          {nowSentence(snap.now)}
        </Text>
        <Text style={[typeScale.body, { color: colors.textSoft }]}>
          {activeZonesSentence(snap.zones)}
        </Text>
      </Card>

      <Card
        title="Sıcak saatler"
        meta={label}
        icon={{ ios: 'flame.fill', android: 'local_fire_department' }}
      >
        <ChipRow>
          {snap.days.map((d) => (
            <Chip
              key={d.offset}
              label={d.label}
              selected={d.offset === dayOffset}
              onPress={() => setDayOffset(d.offset)}
            />
          ))}
        </ChipRow>
        <Text style={[typeScale.caption, { color: colors.textFaint }]}>
          {`${snap.day.option.fullName} 06:00 – ertesi sabah 06:00`}
        </Text>
        <HeatStrip
          values={snap.day.cells.map((c) => c.ratio)}
          labels={HOUR_LABELS}
          highlightIndex={snap.day.nowIndex}
          accessibilityLabel={`${snap.day.option.fullName} için saatlik tahmini yoğunluk. ${
            hotHoursSentence(snap.day.windows)}`}
        />
        <Text style={[typeScale.body, { color: colors.textSoft }]}>
          {hotHoursSentence(snap.day.windows)}
        </Text>
      </Card>

      <Card
        title="Sıcak günler"
        meta={label}
        icon={{ ios: 'calendar', android: 'calendar_month' }}
      >
        <HeatStrip
          values={spread(snap.week.ranks.map((r) => r.value))}
          labels={WEEKDAYS_SHORT_TR}
          highlightIndex={snap.week.todayIndex}
          accessibilityLabel={`Haftanın günlerine göre tahmini yoğunluk. ${
            hotDaysSentence(snap.week.best, snap.week.quietest)}`}
        />
        <Text style={[typeScale.body, { color: colors.textSoft }]}>
          {hotDaysSentence(snap.week.best, snap.week.quietest)}
        </Text>
      </Card>

      <ZonesCard zones={snap.zones} meta={label} />
    </>
  );
}

/**
 * Şehir seçimi. Sürücünün kendi şehri başta ve "şehrin" diye işaretli.
 *
 * Şehri desteklenmiyorsa ya da hiç seçilmemişse bunu SÖYLÜYOR ve yine de
 * dört şehre bakabiliyor. Şehir seçilmemişse düzeltme yolu da burada:
 * uyarı düzeltilemiyorsa suçlamadır (README, "Bilinmeyen tahmin edilmez").
 */
function CityPicker({
  resolution, city, onChange,
}: { resolution: CityResolution; city: PusulaCity; onChange: (c: PusulaCity) => void }) {
  const own = resolution.kind === 'supported' ? resolution.city : null;

  return (
    <View style={styles.cities}>
      <ChipRow>
        {orderedCities(resolution).map((c) => (
          <Chip
            key={c}
            label={c}
            detail={c === own ? 'şehrin' : undefined}
            selected={c === city}
            onPress={() => onChange(c)}
          />
        ))}
      </ChipRow>

      {resolution.kind === 'unsupported' ? (
        <Notice>
          {`Pusula şimdilik İstanbul, Ankara, İzmir ve Antalya'da. ${resolution.ownCity} için `
            + 'yakında; o zamana kadar bu dört şehre bakabilirsin.'}
        </Notice>
      ) : null}

      {resolution.kind === 'missing' ? (
        <>
          <Notice>
            Şehrini seçmedin. Seçersen Pusula hep senin şehrinle açılır; şimdilik
            yukarıdan istediğin şehre bakabilirsin.
          </Notice>
          <TextLink label="Şehrini seç" href="/profil-duzenle" align="left" />
        </>
      ) : null}
    </View>
  );
}

/** Dört çubuklu seviye göstergesi — sayı yerine: kesinlik iddia etmiyor. */
function LevelMeter({ level }: { level: DemandLevel }) {
  const { colors } = useTheme();

  return (
    <View
      style={styles.meter}
      accessible
      accessibilityRole="image"
      accessibilityLabel={`Tahmini yoğunluk: ${LEVEL_LABELS[level]}`}
    >
      {[0, 1, 2, 3].map((i) => (
        <View
          key={i}
          style={[styles.meterBar, {
            height: 10 + i * 5,
            backgroundColor: i <= level ? colors.accentScale[i + 1] : colors.surfaceSunken,
          }]}
        />
      ))}
    </View>
  );
}

/**
 * Sıcak bölgeler: önce şu an aktif olanlar, sonra bugün açılacaklar,
 * sonra diğerleri (sıralama `zonesAt`'te). Satırlar dokunulabilir DEĞİL —
 * bölgenin açılacak bir detayı yok.
 */
function ZonesCard({ zones, meta }: { zones: readonly ZoneView[]; meta: string }) {
  const { colors } = useTheme();
  const [all, setAll] = useState(false);
  const shown = all ? zones : zones.slice(0, ZONES_PREVIEW);

  return (
    <Card
      title="Sıcak bölgeler"
      meta={`${meta} · ${zones.length} bölge`}
      icon={{ ios: 'mappin.and.ellipse', android: 'location_on' }}
    >
      {shown.map((v, i) => {
        const badge = v.status === 'active'
          ? 'Şu an aktif'
          : v.status === 'later' && v.window
            ? `Bugün ${formatWindow(v.window)}`
            : null;
        return (
          <View
            key={v.zone.id}
            style={[styles.zone, i > 0 && { borderTopWidth: 1, borderTopColor: colors.border }]}
            accessible
            accessibilityLabel={[v.zone.name, badge].filter(Boolean).join('. ')}
          >
            <Text style={[typeScale.bodyStrong, styles.zoneName, { color: colors.text }]}>
              {v.zone.name}
            </Text>
            {badge ? (
              <Badge label={badge} tone={v.status === 'active' ? 'accent' : 'neutral'} />
            ) : null}
          </View>
        );
      })}

      {zones.length > ZONES_PREVIEW ? (
        <Button
          label={all ? 'Daha az göster' : `Tüm bölgeler (${zones.length})`}
          variant="ghost"
          onPress={() => setAll((a) => !a)}
        />
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  cities: { gap: space.sm },
  nowHead: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between', gap: space.md,
  },
  meter: { flexDirection: 'row', alignItems: 'flex-end', gap: space.xs },
  meterBar: { width: 10, borderRadius: radius.sm / 2 },
  zone: {
    flexDirection: 'row', alignItems: 'center', gap: space.sm, flexWrap: 'wrap',
    paddingVertical: space.sm,
  },
  zoneName: { flexShrink: 1 },
});
