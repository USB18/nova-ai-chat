import { Platform, useColorScheme } from 'react-native';

// Light: sand & sage. Dark: graphite & amber. Both share one layout; only tokens differ.
const light = {
  bg: '#F4F1EA',
  surface: '#FFFFFF',
  surfaceAlt: '#ECE8DF',
  inset: '#FAF8F3',
  border: '#E2DDD2',
  divider: '#EEEAE2',
  text: '#1F2420',
  textMuted: '#6B706A',
  textFaint: '#9AA096',
  accent: '#4F6F52',
  accentText: '#FFFFFF',
  accentSoft: '#E3EADF',
  orbFrom: '#6E9471',
  orbTo: '#2F3E33',
  orbIcon: '#F4F1EA',
  userBubble: '#2F3E33',
  userBorder: '#2F3E33',
  userText: '#F4F1EA',
  danger: '#B3402F',
  dangerBg: '#F6E4DF',
  success: '#4F6F52',
  successSoft: '#E3EADF',
  pending: '#8A6A2C',
  pendingSoft: '#F3EAD6',
  codeBg: '#ECE8DF',
  codeText: '#2F3E33',
  shadow: '#1F2420',
  dangerBorder: '#EED3CC',
  heroBg: '#2F3E33',
  heroBorder: '#2F3E33',
  heroText: '#F4F1EA',
  heroMuted: '#C9D3C4',
  heroTile: 'rgba(244,241,234,0.10)',
  heroAccent: '#F4F1EA',
  heroGlow: '#6E9471',
  heroOk: '#9BD49E',
};

const dark: typeof light = {
  bg: '#0E0E10',
  surface: '#17171A',
  surfaceAlt: '#1F1F23',
  inset: '#1F1F23',
  border: '#2A2A2F',
  divider: '#232327',
  text: '#F2F0EB',
  textMuted: '#9A968F',
  textFaint: '#6E6A63',
  accent: '#F5B544',
  accentText: '#0E0E10',
  accentSoft: 'rgba(245,181,68,0.12)',
  orbFrom: '#F5B544',
  orbTo: '#E8743B',
  orbIcon: '#0E0E10',
  userBubble: '#1A1712',
  userBorder: '#3A2F1E',
  userText: '#F2F0EB',
  danger: '#FF7A6E',
  dangerBg: '#3A1F1C',
  success: '#9AD69D',
  successSoft: 'rgba(123,196,127,0.12)',
  pending: '#F5B544',
  pendingSoft: 'rgba(245,181,68,0.12)',
  codeBg: '#1F1F23',
  codeText: '#F5B544',
  shadow: '#000000',
  dangerBorder: '#4A2622',
  heroBg: '#1A1712',
  heroBorder: '#3A2F1E',
  heroText: '#F2F0EB',
  heroMuted: '#9A968F',
  heroTile: 'rgba(255,255,255,0.05)',
  heroAccent: '#F5B544',
  heroGlow: '#F5B544',
  heroOk: '#9AD69D',
};

export type Colors = typeof light;

export const spacing = { xs: 4, sm: 8, md: 12, lg: 16, xl: 24 };
export const radius = { sm: 8, md: 14, lg: 20, xl: 26, pill: 999 };
export const fonts = {
  mono: Platform.select({ ios: 'Menlo', default: 'monospace' }),
};

export function useTheme() {
  const scheme = useColorScheme();
  return { colors: scheme === 'dark' ? dark : light, dark: scheme === 'dark' };
}
