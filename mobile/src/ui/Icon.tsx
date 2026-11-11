// The same line icons as the web app, drawn with react-native-svg.

import Svg, { Circle, Path, Polygon, Rect } from 'react-native-svg';

type Shape =
  | { d: string }
  | { circle: [number, number, number] }
  | { rect: [number, number, number, number, number] }
  | { points: string };

const ICONS: Record<string, Shape[]> = {
  sun: [
    { circle: [12, 12, 4] },
    { d: 'M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41' },
  ],
  mic: [{ d: 'M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z' }, { d: 'M19 10v2a7 7 0 0 1-14 0v-2' }, { d: 'M12 19v3' }],
  trend: [{ d: 'M22 7l-8.5 8.5-5-5L2 17' }, { d: 'M16 7h6v6' }],
  book: [{ d: 'M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z' }, { d: 'M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z' }],
  sliders: [{ d: 'M4 21v-7M4 10V3M12 21v-9M12 8V3M20 21v-5M20 12V3M2 14h4M10 8h4M18 16h4' }],
  play: [{ points: '6 3 20 12 6 21 6 3' }],
  stop: [{ rect: [5, 5, 14, 14, 2] }],
  check: [{ d: 'M20 6L9 17l-5-5' }],
  x: [{ d: 'M18 6L6 18M6 6l12 12' }],
  'arrow-right': [{ d: 'M5 12h14M12 5l7 7-7 7' }],
  'arrow-left': [{ d: 'M19 12H5M12 19l-7-7 7-7' }],
  'arrow-up': [{ d: 'M12 19V5M5 12l7-7 7 7' }],
  'arrow-down': [{ d: 'M12 5v14M19 12l-7 7-7-7' }],
  retry: [{ d: 'M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8' }, { d: 'M3 3v5h5' }],
  flame: [
    {
      d: 'M8.5 14.5A2.5 2.5 0 0 0 11 12c0-1.38-.5-2-1-3-1.072-2.143-.224-4.054 2-6 .5 2.5 2 4.9 4 6.5 2 1.6 3 3.5 3 5.5a7 7 0 1 1-14 0c0-1.153.433-2.294 1-3a2.5 2.5 0 0 0 2.5 2.5z',
    },
  ],
  clock: [{ circle: [12, 12, 10] }, { d: 'M12 6v6l4 2' }],
  target: [{ circle: [12, 12, 10] }, { circle: [12, 12, 6] }, { circle: [12, 12, 2] }],
  shuffle: [
    { d: 'M2 18h1.4c1.3 0 2.5-.6 3.3-1.7l6.1-8.6c.7-1.1 2-1.7 3.3-1.7H22' },
    { d: 'M18 2l4 4-4 4' },
    { d: 'M2 6h1.9c1.5 0 2.9.9 3.6 2.2' },
    { d: 'M22 18h-5.9c-1.3 0-2.6-.7-3.3-1.8l-.5-.8' },
    { d: 'M18 14l4 4-4 4' },
  ],
  sparkles: [
    {
      d: 'M9.94 15.5A2 2 0 0 0 8.5 14.06l-6.14-1.58a.5.5 0 0 1 0-.96L8.5 9.94A2 2 0 0 0 9.94 8.5l1.58-6.14a.5.5 0 0 1 .96 0L14.06 8.5A2 2 0 0 0 15.5 9.94l6.14 1.58a.5.5 0 0 1 0 .96L15.5 14.06a2 2 0 0 0-1.44 1.44l-1.58 6.14a.5.5 0 0 1-.96 0z',
    },
  ],
  trash: [{ d: 'M3 6h18' }, { d: 'M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6' }, { d: 'M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2' }],
  'chevron-right': [{ d: 'M9 18l6-6-6-6' }],
  'chevron-down': [{ d: 'M6 9l6 6 6-6' }],
  info: [{ circle: [12, 12, 10] }, { d: 'M12 16v-4M12 8h.01' }],
  alert: [{ d: 'M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z' }, { d: 'M12 9v4M12 17h.01' }],
  pause: [{ rect: [6, 4, 4, 16, 1] }, { rect: [14, 4, 4, 16, 1] }],
  gauge: [{ d: 'M12 14l4-4' }, { d: 'M3.34 19a10 10 0 1 1 17.32 0' }],
  shrink: [{ d: 'M4 14h6v6M20 10h-6V4M14 10l7-7M3 21l7-7' }],
  ban: [{ circle: [12, 12, 10] }, { d: 'M4.9 4.9l14.2 14.2' }],
  link: [
    { d: 'M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71' },
    { d: 'M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71' },
  ],
  bulb: [
    { d: 'M15 14c.2-1 .7-1.7 1.5-2.5 1-.9 1.5-2.2 1.5-3.5A6 6 0 0 0 6 8c0 1 .2 2.2 1.5 3.5.7.7 1.3 1.5 1.5 2.5' },
    { d: 'M9 18h6M10 22h4' },
  ],
  minus: [{ d: 'M5 12h14' }],
};

export function Icon({ name, size = 20, color, strokeWidth = 2 }: { name: string; size?: number; color: string; strokeWidth?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={strokeWidth} strokeLinecap="round" strokeLinejoin="round">
      {(ICONS[name] ?? []).map((shape, i) => {
        if ('d' in shape) return <Path key={i} d={shape.d} />;
        if ('circle' in shape) return <Circle key={i} cx={shape.circle[0]} cy={shape.circle[1]} r={shape.circle[2]} />;
        if ('rect' in shape) {
          const [x, y, width, height, rx] = shape.rect;
          return <Rect key={i} x={x} y={y} width={width} height={height} rx={rx} />;
        }
        return <Polygon key={i} points={shape.points} />;
      })}
    </Svg>
  );
}

/** The app's mark: four rising bars. */
export function Mark({ size = 18, color }: { size?: number; color: string }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.6} strokeLinecap="round">
      <Path d="M4 10v4M9.5 6v12M15 9v6M20.5 3v18" />
    </Svg>
  );
}
