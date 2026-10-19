import { StyleSheet, Text, type TextProps } from 'react-native';

import { Fonts, type ThemeColor } from '@/constants/theme';
import { useTheme } from '@/hooks/use-theme';

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'heading' | 'subheading' | 'small' | 'smallBold' | 'caption' | 'mono' | 'big';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const theme = useTheme();
  return <Text style={[{ color: theme[themeColor ?? 'text'] }, styles[type], style]} {...rest} />;
}

const styles = StyleSheet.create({
  default: { fontSize: 16, lineHeight: 22 },
  title: { fontSize: 28, lineHeight: 34, fontWeight: '600' },
  heading: { fontSize: 20, lineHeight: 26, fontWeight: '600' },
  subheading: { fontSize: 17, lineHeight: 22, fontWeight: '600' },
  small: { fontSize: 14, lineHeight: 20 },
  smallBold: { fontSize: 14, lineHeight: 20, fontWeight: '600' },
  caption: { fontSize: 12, lineHeight: 16 },
  mono: { fontFamily: Fonts.mono, fontSize: 12, fontWeight: '700' },
  big: { fontSize: 36, lineHeight: 42, fontWeight: '500', fontVariant: ['tabular-nums'] },
});
