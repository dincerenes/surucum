import { StyleSheet, Text, View } from 'react-native';
import { AmountText } from './amount-text';
import type { DaySummary } from '@/lib/day-summary';
import { add } from '@/lib/money';
import { radius, space, type as typeScale, useTheme } from '@/theme/use-theme';

interface Props {
  summary: DaySummary;
  /**
   * Kesintileri kalem kalem gösterir.
   *
   * Kapalıyken komisyon, yakıt ve gider TEK "Kesintiler" satırında
   * toplanır — gizlenmez. Gizleseydik ekrandaki sayılar toplanınca
   * gerçek kâra ulaşmazdı ve sürücü tutmayan bir hesaba bakardı.
   */
  detailed?: boolean;
}

/**
 * Üç satırlı kâr bloğu — ürünün varlık sebebi.
 *
 * ÜÇÜ DE GÖSTERİLİR, hiçbiri gizlenmez ve tek sayıya indirilmez. 2 ile 3
 * arasındaki fark bu ürünün neden var olduğudur: sürücü akşam cebindeki
 * parayla eve gider ve kazandığını sanır; aracının eridiğini görmez.
 *
 * İKİ SATIR ARASINDAKİ TEK FARK YIPRANMA PAYIDIR. (2) sürücünün akşam
 * cebinde bulduğu para; (3) aracının eridiği de düşülmüş hâli.
 *
 * Ekrandaki satırlar toplanınca gerçek kâra ULAŞMALI: sürücü gördüğü
 * sayıları topluyor ve tutmadığında sayıya güvenmiyor.
 */
export function SummaryRows({ summary, detailed = true }: Props) {
  const { colors } = useTheme();
  const { profit } = summary;
  const deductions = add(profit.commission, profit.fuelPaid, profit.expensesPaid);

  return (
    <View style={styles.wrap}>
      <View style={styles.line}>
        <Text style={[typeScale.body, { color: colors.textSoft }]}>Ciro</Text>
        <AmountText value={profit.revenue} size="body" />
      </View>

      {detailed ? (
        <>
          <Deduction label="Komisyon" value={profit.commission} />
          <Deduction
            label={
              summary.fuelVolume == null
                ? 'Yakıt'
                : `Yakıt · ${(summary.fuelVolume / 1000).toFixed(1)} lt`
            }
            value={profit.fuelPaid}
          />
          <Deduction label="Gider" value={profit.expensesPaid} />
        </>
      ) : (
        <Deduction label="Kesintiler" value={deductions} />
      )}

      <View style={[styles.rule, { backgroundColor: colors.accent }]} />

      {detailed ? (
        <View style={styles.hero}>
          <View style={styles.heroText}>
            <Text style={[styles.heroLabel, { color: colors.accent }]}>CEBE KALAN</Text>
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>
              gerçekleşmiş nakit
            </Text>
          </View>
          <AmountText value={profit.cashProfit} size="title" tone="signed" />
        </View>
      ) : (
        <View style={styles.line}>
          <Text style={[typeScale.bodyStrong, { color: colors.accent }]}>Cebe kalan</Text>
          <AmountText value={profit.cashProfit} size="bodyStrong" tone="signed" />
        </View>
      )}

      {detailed ? (
        <>
          <Deduction
            label={
              summary.distanceKm == null
                ? 'Yıpranma'
                : `Yıpranma · ${summary.distanceKm} km`
            }
            value={profit.wearShare}
          />

          <View style={[styles.rule, { backgroundColor: colors.border }]} />

          <View style={styles.hero}>
            <View style={styles.heroText}>
              <Text style={[styles.heroLabel, { color: colors.text }]}>GERÇEK KÂR</Text>
              <Text style={[typeScale.caption, { color: colors.textFaint }]}>
                yıpranma dahil
              </Text>
            </View>
            <AmountText value={profit.trueProfit} size="title" tone="signed" />
          </View>
        </>
      ) : (
        <>
          <Deduction
            label={
              summary.distanceKm == null
                ? 'Yıpranma'
                : `Yıpranma · ${summary.distanceKm} km`
            }
            value={profit.wearShare}
          />

          <View style={[styles.rule, { backgroundColor: colors.border }]} />

          <View style={styles.line}>
            <Text style={[typeScale.bodyStrong, { color: colors.text }]}>Gerçek kâr</Text>
            <AmountText value={profit.trueProfit} size="bodyStrong" tone="signed" />
          </View>
        </>
      )}

      <MissingData summary={summary} />
    </View>
  );
}

function Deduction({
  label, value, muted = false,
}: { label: string; value: number; muted?: boolean }) {
  const { colors } = useTheme();
  if (value === 0) return null;

  return (
    <View style={styles.line}>
      <Text style={[typeScale.body, { color: muted ? colors.textFaint : colors.textSoft }]}>
        {label}
      </Text>
      <AmountText value={value as never} size="body" tone="cost" showMinus />
    </View>
  );
}

/**
 * Eksik girdiyi SÖYLER.
 *
 * Kilometre ya da tüketim girilmemişse gerçek kâr olduğundan iyi görünür.
 * Bunu sessizce yapmak, sürücüye yanlış bir sayıyı doğruymuş gibi
 * göstermektir; sayıya olan güven bir kez kaybedilince geri gelmiyor.
 */
function MissingData({ summary }: { summary: DaySummary }) {
  const { colors } = useTheme();
  const notes: string[] = [];

  if (summary.distanceKm == null) {
    notes.push('Kilometre girilmediği için yıpranma payı hesaplanmadı.');
  } else if (summary.shiftsMissingDistance > 0) {
    notes.push(`${summary.shiftsMissingDistance} vardiyanın kilometresi girilmemiş; pay eksik.`);
  }

  if (summary.fuelVolume == null && summary.profit.fuelPaid > 0) {
    notes.push('Ortalama tüketim girilmediği için yakıt, kaydedilen dolum tutarından sayıldı.');
  }

  if (notes.length === 0) return null;

  return (
    <View style={[styles.note, { backgroundColor: colors.warningSoft }]}>
      {notes.map((n) => (
        <Text key={n} style={[typeScale.caption, { color: colors.warning }]}>{n}</Text>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  line: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
    gap: space.md,
  },
  rule: { height: 2, borderRadius: 1, marginVertical: space.xs },
  hero: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-end',
    gap: space.md,
  },
  /**
   * Etiket sütunu daralabilir, tutar daralamaz.
   *
   * Aksi hâlde altı haneli bir tutar kabın dışına taşıyor ve ₺ simgesi
   * kırpılıyor. Uzun etiket kırpılabilir, para asla.
   */
  heroText: { flexShrink: 1 },
  heroLabel: { ...typeScale.label, letterSpacing: 1 },
  note: { borderRadius: radius.sm, padding: space.md, gap: space.xs },
});
