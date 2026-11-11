// A small set of line icons (24px grid, 2px stroke), inlined so the app has no icon dependency.

import type { ReactNode } from 'react';

const P = (d: string, key?: number) => <path key={key ?? d} d={d} />;

const ICONS: Record<string, ReactNode> = {
  sun: [
    <circle key="c" cx="12" cy="12" r="4" />,
    P('M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41'),
  ],
  mic: [
    P('M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z'),
    P('M19 10v2a7 7 0 0 1-14 0v-2'),
    P('M12 19v3'),
  ],
  trend: [P('M22 7l-8.5 8.5-5-5L2 17'), P('M16 7h6v6')],
  book: [
    P('M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z'),
    P('M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z'),
  ],
  sliders: [P('M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M2 14h4M10 8h4M18 16h4')],
  play: [<polygon key="p" points="6 3 20 12 6 21 6 3" />],
  stop: [<rect key="r" x="5" y="5" width="14" height="14" rx="2" />],
  check: [P('M20 6L9 17l-5-5')],
  x: [P('M18 6L6 18M6 6l12 12')],
  'arrow-right': [P('M5 12h14M12 5l7 7-7 7')],
  'arrow-left': [P('M19 12H5M12 19l-7-7 7-7')],
  'arrow-up': [P('M12 19V5M5 12l7-7 7 7')],
  'arrow-down': [P('M12 5v14M19 12l-7 7-7-7')],
  retry: [P('M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8'), P('M3 3v5h5')],
  flame: [
    P(
      'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z',
    ),
  ],
  clock: [<circle key="c" cx="12" cy="12" r="10" />, P('M12 6v6l4 2')],
  zap: [<polygon key="p" points="13 2 3 14 12 14 11 22 21 10 12 10 13 2" />],
  target: [
    <circle key="a" cx="12" cy="12" r="10" />,
    <circle key="b" cx="12" cy="12" r="6" />,
    <circle key="c" cx="12" cy="12" r="2" />,
  ],
  shuffle: [
    P('M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22'),
    P('M18 2l4 4-4 4'),
    P('M2 6h1.9c1.5 0 2.9.9 3.6 2.2'),
    P('M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8'),
    P('M18 14l4 4-4 4'),
  ],
  sparkles: [
    P(
      'M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.14 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z',
    ),
  ],
  trash: [
    P('M3 6h18'),
    P('M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6'),
    P('M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2'),
  ],
  'chevron-right': [P('M9 18l6-6-6-6')],
  info: [<circle key="c" cx="12" cy="12" r="10" />, P('M12 16v-4M12 8h.01')],
  alert: [
    P('M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z'),
    P('M12 9v4M12 17h.01'),
  ],
  pause: [
    <rect key="a" x="6" y="4" width="4" height="16" rx="1" />,
    <rect key="b" x="14" y="4" width="4" height="16" rx="1" />,
  ],
  gauge: [P('M12 14l4-4'), P('M3.34 19a10 10 0 1 1 17.32 0')],
  shrink: [P('M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7')],
  ban: [<circle key="c" cx="12" cy="12" r="10" />, P('M4.9 4.9l14.2 14.2')],
  link: [
    P('M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71'),
    P('M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71'),
  ],
  bulb: [
    P('M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5'),
    P('M9 18h6M10 22h4'),
  ],
  download: [P('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'), P('M7 10l5 5 5-5M12 15V3')],
  upload: [P('M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4'), P('M17 8l-5-5-5 5M12 3v12')],
  minus: [P('M5 12h14')],
};

export type IconName = keyof typeof ICONS;

export function Icon({ name, size = 20, strokeWidth = 2 }: { name: string; size?: number; strokeWidth?: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {ICONS[name] ?? null}
    </svg>
  );
}
