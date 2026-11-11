// Colours and type for the mobile app. The same ink-on-paper palette as the web app:
// one blue for data, a validated set of categorical colours for transcript marks, and
// status colours that always travel with an icon and a word.

import { useColorScheme } from 'react-native';
import { useStore } from '@/lib/store';

export interface Theme {
  dark: boolean;
  page: string;
  surface: string;
  surface2: string;
  ink: string;
  ink2: string;
  muted: string;
  grid: string;
  axis: string;
  border: string;
  borderStrong: string;
  accent: string;
  accentWash: string;
  accentInk: string;
  btn: string;
  btnInk: string;
  good: string;
  goodInk: string;
  warning: string;
  critical: string;
  criticalInk: string;
  /** Categorical slots, fixed order: signposts, fillers, hedges, vague, stumbles. */
  c: [string, string, string, string, string];
}

const LIGHT: Theme = {
  dark: false,
  page: '#f9f9f7',
  surface: '#fcfcfb',
  surface2: '#f1f0ec',
  ink: '#0b0b0b',
  ink2: '#52514e',
  muted: '#6f6d68',
  grid: '#e1e0d9',
  axis: '#c3c2b7',
  border: 'rgba(11,11,11,0.10)',
  borderStrong: 'rgba(11,11,11,0.20)',
  accent: '#2a78d6',
  accentWash: '#cde2fb',
  accentInk: '#184f95',
  btn: '#0b0b0b',
  btnInk: '#fcfcfb',
  good: '#0ca30c',
  goodInk: '#006300',
  warning: '#fab219',
  critical: '#d03b3b',
  criticalInk: '#a82a2a',
  c: ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'],
};

const DARK: Theme = {
  dark: true,
  page: '#0d0d0d',
  surface: '#1a1a19',
  surface2: '#262624',
  ink: '#f0efec',
  ink2: '#c3c2b7',
  muted: '#9a988f',
  grid: '#2c2c2a',
  axis: '#383835',
  border: 'rgba(255,255,255,0.10)',
  borderStrong: 'rgba(255,255,255,0.22)',
  accent: '#3987e5',
  accentWash: '#123a6e',
  accentInk: '#86b6ef',
  btn: '#f0efec',
  btnInk: '#0d0d0d',
  good: '#0ca30c',
  goodInk: '#2fc02f',
  warning: '#fab219',
  critical: '#d03b3b',
  criticalInk: '#f08080',
  c: ['#3987e5', '#d95926', '#199e70', '#c98500', '#d55181'],
};

export function useTheme(): Theme {
  const system = useColorScheme();
  const preference = useStore((s) => s.settings.theme);
  const mode = preference === 'system' ? (system ?? 'light') : preference;
  return mode === 'dark' ? DARK : LIGHT;
}

/** Font families, as registered in the root layout. */
export const font = {
  serif: 'Fraunces_500Medium',
  serifItalic: 'Fraunces_500Medium_Italic',
  sans: 'DMSans_400Regular',
  medium: 'DMSans_500Medium',
  bold: 'DMSans_600SemiBold',
} as const;

/** Mix a colour with transparency: tint('#2a78d6', 0.2). */
export function tint(hex: string, alpha: number): string {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${alpha})`;
}
