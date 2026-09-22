import { StyleSheet, Text, View } from 'react-native';

import { Icon } from './icon';
import { initialOf } from '@/lib/profile';
import { useTheme } from '@/theme/use-theme';

interface Props {
  name: string | null | undefined;
  size?: number;
}

/**
 * Profil resmi — fotoğraf yokken HAZIR AVATAR: adın baş harfi, vurgu
 * renginde bir daire. Ad da yoksa kişi ikonu.
 *
 * Fotoğraf seçimi Profil'de geliyor; o zamana kadar herkes bu hâliyle.
 */
export function Avatar({ name, size = 48 }: Props) {
  const { colors } = useTheme();
  const initial = initialOf(name);

  return (
    <View style={[styles.circle, {
      width: size, height: size, borderRadius: size / 2, backgroundColor: colors.accentSoft,
    }]}>
      {initial ? (
        <Text style={{ color: colors.accent, fontSize: size * 0.42, fontWeight: '700' }}>
          {initial}
        </Text>
      ) : (
        <Icon name={{ ios: 'person.fill', android: 'person' }} size={size * 0.5} color={colors.accent} />
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  circle: { alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
});
