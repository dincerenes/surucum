import { StyleSheet, Text, View } from 'react-native';

import { useAnnouncements } from '@/lib/announcements';
import { radius, space, type as typeScale, useTheme } from '@/theme/use-theme';

/**
 * Yönetim panelinden yayımlanan duyuruları gösterir.
 *
 * Duyuru yoksa hiçbir şey çizmez — boş bir kutu, kullanılmayan bir
 * özelliğin ekranda yer kaplaması demek olurdu.
 */
export function AnnouncementBanner() {
  const { colors } = useTheme();
  const items = useAnnouncements();

  if (items.length === 0) return null;

  return (
    <View style={styles.stack}>
      {items.map((a) => {
        const tone =
          a.severity === 'critical'
            ? { bg: colors.negativeSoft, line: colors.negative }
            : a.severity === 'warning'
              ? { bg: colors.warningSoft, line: colors.warning }
              : { bg: colors.accentSoft, line: colors.accent };

        return (
          <View
            key={a.id}
            style={[styles.card, { backgroundColor: tone.bg, borderLeftColor: tone.line }]}
          >
            <Text style={[typeScale.bodyStrong, { color: colors.text }]}>{a.title}</Text>
            <Text style={[typeScale.caption, { color: colors.textSoft }]}>{a.body}</Text>
          </View>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: space.sm },
  card: {
    borderRadius: radius.md,
    borderLeftWidth: 3,
    padding: space.lg,
    gap: space.xs,
  },
});
