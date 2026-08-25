import { useColorScheme } from 'react-native';
import { palette, type Colors, type ColorScheme } from './tokens';

export function useTheme(): { colors: Colors; scheme: ColorScheme } {
  const scheme: ColorScheme = useColorScheme() === 'dark' ? 'dark' : 'light';
  return { colors: palette[scheme], scheme };
}

export * from './tokens';
