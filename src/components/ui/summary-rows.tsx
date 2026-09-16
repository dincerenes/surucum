import { StyleSheet, Text, View } from 'react-native';
import { AmountText } from './amount-text';
import type { DaySummary } from '@/lib/day-summary';
import type { Kurus } from '@/lib/money';
import { add, formatInteger } from '@/lib/money';
import { radius, space, type as typeScale, useTheme } from '@/theme/use-theme';

/**
 * Üç satırlı bloğun ihtiyaç duyduğu HER ŞEY.
 *
 * Gün özeti de dönem özeti de bu şekle dönüştürülüp aynı bileşenden
 * geçiyor. İki ayrı çizim olsaydı biri güncellenip diğeri unutulurdu ve
 * sürücü aynı hesabı iki farklı biçimde görürdü.
 */
export interface ProfitRowsData {
  revenue: Kurus;
  commission: Kurus;
  fuelPaid: Kurus;
  expensesPaid: Kurus;
  cashProfit: Kurus;
  wearShare: Kurus;
  trueProfit: Kurus;

  /** Yakıt satırına yazılacak hacim, mililitre. Bilinmiyorsa `null`. */
  fuelVolume: number | null;
  /** Yıpranma satırına yazılacak kilometre. Bilinmiyorsa `null`. */
  distanceKm: number | null;
  /** Eksik girdi uyarıları — boş dizi hiçbir şey çizmez. */
  notes: readonly string[];
}

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

/** Gün özetini üç satırlık bloğa çevirir. */
export function SummaryRows({ summary, detailed = true }: Props) {
  return (
    <ProfitRows data={toRowsData(summary)} detailed={detailed} />
  );
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
export function ProfitRows({
  data, detailed = true,
}: { data: ProfitRowsData; detailed?: boolean }) {
  const { colors } = useTheme();
  const deductions = add(data.commission, data.fuelPaid, data.expensesPaid);

  const wearLabel = data.distanceKm == null
    ? 'Yıpranma'
    : `Yıpranma · ${formatKm(data.distanceKm)} km`;

  return (
    <View style={styles.wrap}>
      <View style={styles.line}>
        <Text style={[typeScale.body, { color: colors.textSoft }]}>Ciro</Text>
        <AmountText value={data.revenue} size="body" />
      </View>

      {detailed ? (
        <>
          <Deduction label="Komisyon" value={data.commission} />
          <Deduction
            label={
              data.fuelVolume == null
                ? 'Yakıt'
                : `Yakıt · ${(data.fuelVolume / 1000).toFixed(1)} lt`
            }
            value={data.fuelPaid}
          />
          <Deduction label="Gider" value={data.expensesPaid} />
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
          <AmountText value={data.cashProfit} size="title" tone="signed" />
        </View>
      ) : (
        <View style={styles.line}>
          <Text style={[typeScale.bodyStrong, { color: colors.accent }]}>Cebe kalan</Text>
          <AmountText value={data.cashProfit} size="bodyStrong" tone="signed" />
        </View>
      )}

      <Deduction label={wearLabel} value={data.wearShare} />

      <View style={[styles.rule, { backgroundColor: colors.border }]} />

      {detailed ? (
        <View style={styles.hero}>
          <View style={styles.heroText}>
            <Text style={[styles.heroLabel, { color: colors.text }]}>GERÇEK KÂR</Text>
            <Text style={[typeScale.caption, { color: colors.textFaint }]}>
              yıpranma dahil
            </Text>
          </View>
          <AmountText value={data.trueProfit} size="title" tone="signed" />
        </View>
      ) : (
        <View style={styles.line}>
          <Text style={[typeScale.bodyStrong, { color: colors.text }]}>Gerçek kâr</Text>
          <AmountText value={data.trueProfit} size="bodyStrong" tone="signed" />
        </View>
      )}

      <MissingData notes={data.notes} />
    </View>
  );
}

/**
 * Gün özetini bloğun beklediği şekle çevirir ve EKSİK GİRDİYİ SÖYLER.
 *
 * Kilometre ya da tüketim girilmemişse gerçek kâr olduğundan iyi görünür.
 * Bunu sessizce yapmak, sürücüye yanlış bir sayıyı doğruymuş gibi
 * göstermektir; sayıya olan güven bir kez kaybedilince geri gelmiyor.
 */
export function toRowsData(summary: DaySummary): ProfitRowsData {
  const notes: string[] = [];

  if (summary.distanceKm == null) {
    notes.push('Kilometre girilmediği için yıpranma payı hesaplanmadı.');
  } else if (summary.shiftsMissingDistance > 0) {
    notes.push(`${summary.shiftsMissingDistance} vardiyanın kilometresi girilmemiş; pay eksik.`);
  }

  if (summary.fuelVolume == null && summary.profit.fuelPaid > 0) {
    notes.push('Ortalama tüketim girilmediği için yakıt, kaydedilen dolum tutarından sayıldı.');
  }

  return {
    revenue: summary.profit.revenue,
    commission: summary.profit.commission,
    fuelPaid: summary.profit.fuelPaid,
    expensesPaid: summary.profit.expensesPaid,
    cashProfit: summary.profit.cashProfit,
    wearShare: summary.profit.wearShare,
    trueProfit: summary.profit.trueProfit,
    fuelVolume: summary.fuelVolume,
    distanceKm: summary.distanceKm,
    notes,
  };
}

function Deduction({ label, value }: { label: string; value: number }) {
  const { colors } = useTheme();
  if (value === 0) return null;

  return (
    <View style={styles.line}>
      <Text style={[typeScale.body, { color: colors.textSoft }]}>{label}</Text>
      <AmountText value={value as never} size="body" tone="cost" showMinus />
    </View>
  );
}

function MissingData({ notes }: { notes: readonly string[] }) {
  const { colors } = useTheme();
  if (notes.length === 0) return null;

  return (
    <View style={[styles.note, { backgroundColor: colors.warningSoft }]}>
      {notes.map((n) => (
        <Text key={n} style={[typeScale.caption, { color: colors.warning }]}>{n}</Text>
      ))}
    </View>
  );
}

/** Uzun dönemlerde kilometre binlere çıkıyor — ayraçsız okunmuyor. */
function formatKm(km: number): string {
  return formatInteger(km);
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
