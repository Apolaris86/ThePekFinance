import '@/global.css';

import { Platform } from 'react-native';

// Same palette as the web app's CSS tokens so both feel like one product.
export const Colors = {
  light: {
    text: '#1f1f1f',
    textSecondary: '#5f6368',
    background: '#ffffff',
    backgroundElement: '#f6f8fa',
    backgroundSelected: '#e8f0fe',
    border: '#e3e3e3',
    accent: '#1a73e8',
    onAccent: '#ffffff',
    up: '#137333',
    upBg: '#e6f4ea',
    down: '#c5221f',
    downBg: '#fce8e6',
  },
  dark: {
    text: '#e8eaed',
    textSecondary: '#9aa0a6',
    background: '#121314',
    backgroundElement: '#1c1d1f',
    backgroundSelected: '#1f2a3a',
    border: '#2e3134',
    accent: '#8ab4f8',
    onAccent: '#121314',
    up: '#81c995',
    upBg: '#1e3a28',
    down: '#f28b82',
    downBg: '#4a2523',
  },
} as const;

export type ThemeColor = keyof typeof Colors.light & keyof typeof Colors.dark;

export const Fonts = Platform.select({
  ios: { sans: 'system-ui', mono: 'ui-monospace' },
  default: { sans: 'normal', mono: 'monospace' },
  web: { sans: 'var(--font-display)', mono: 'var(--font-mono)' },
});

export const Spacing = {
  half: 2,
  one: 4,
  two: 8,
  three: 16,
  four: 24,
  five: 32,
  six: 64,
} as const;

export const Radius = { sm: 6, md: 12, lg: 16, pill: 999 } as const;

export const MaxContentWidth = 800;
