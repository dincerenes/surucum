import { StyleSheet, Text, View } from 'react-native';

import { AmountText } from './amount-text';
import type { Ride } from '@/db/schema/earnings';
import { radius, space, type as typeScale, useTheme } from '@/theme/use-theme';

interface Props {
  rides: readonly Ride[];
  /** En fazla kaç satır. Aşan kısım "+N sefer daha" olarak özetlenir. */
  limit?: number;
  /** Kayıt yokken gösterilecek metin. Boşsa hiçbir şey çizilmez. */
  emptyText?: string;
}

/**
 * Vardiya boyunca girilen seferler — saatiyle birlikte.
 *
 * NEDEN VAR: sefer eklemek tek dokunuşluk bir iş ve sonucu yalnızca
 * toplam rakamda görünüyordu. Sürücü "kaydoldu mu" diye emin olamıyor,
 * ekran da boş duruyordu. Girilen her kayıt anında burada beliriyor;
 * hem geri bildirim hem de yanlış girilen tutarı fark etme imkânı.
 *
 * En yeni üstte: sürücünün kontrol ettiği şey en son girdiği sefer.
 */
export function RideList({ rides, limit = 8, emptyText }: Props) {
  const { colors } = useTheme();

  if (rides.length === 0) {
    if (!emptyText) return null;
    return (
      <Text style={[typeScale.caption, { color: colors.textFaint }]}>{emptyText}</Text>
    );
  }

  const shown = rides.slice(0, limit);
  const rest = rides.length - shown.length;

  return (
    <View style={styles.wrap}>
      <View style={styles.head}>
        <Text style={[styles.label, { color: colors.textFaint }]}>SEFERLER</Text>
        <Text style={[typeScale.caption, { color: colors.textFaint }]}>
          {rides.length}
        </Text>
      </View>

      <View style={[styles.list, { borderColor: colors.border }]}>
        {shown.map((ride, index) => (
          <View
            key={ride.id}
            style={[
              styles.row,
              index > 0 && { borderTopWidth: 1, borderTopColor: colors.border },
            ]}
          >
            <Text style={[styles.time, { color: colors.textFaint }]}>
              {clockOf(ride.occurredAt)}
            </Text>
            <View style={styles.spacer} />
            <AmountText value={ride.grossAmountKurus} size="bodyStrong" />
          </View>
        ))}
      </View>

      {rest > 0 ? (
        <Text style={[typeScale.caption, { color: colors.textFaint }]}>
          +{rest} sefer daha
        </Text>
      ) : null}
    </View>
  );
}

/**
 * Damgadan saat:dakika.
 *
 * `toLocaleTimeString` KULLANILMIYOR: Hermes'te ICU verisi eksik
 * olabiliyor ve saat biçimi cihaza göre değişiyor. İki haneli 24 saat
 * her cihazda aynı görünsün.
 */
function clockOf(at: number): string {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}

const styles = StyleSheet.create({
  wrap: { gap: space.sm },
  head: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'baseline',
  },
  label: { ...typeScale.label, letterSpacing: 1 },
  list: { borderWidth: 1, borderRadius: radius.md, overflow: 'hidden' },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: space.lg,
    paddingVertical: space.md,
  },
  time: { ...typeScale.body, fontVariant: ['tabular-nums'] },
  spacer: { flex: 1 },
});
