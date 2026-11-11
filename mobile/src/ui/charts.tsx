// Charts and figures for the mobile app, drawn with react-native-svg. Same rules as the
// web app: one blue for data, hairline grid, the last value printed beside its point,
// and a table view so no value is only reachable by touch.

import { useState } from 'react';
import { Pressable, Text, View, type GestureResponderEvent, type LayoutChangeEvent } from 'react-native';
import Svg, { Circle, Line, Path, Rect, Text as SvgText } from 'react-native-svg';
import type { DayActivity } from '@core/progress';
import { niceTicks } from '@core/ticks';
import { T } from './kit';
import { font, useTheme } from './theme';

export interface MeterRow {
  label: string;
  /** null when there is nothing to show yet. */
  value: number | null;
  figure?: string;
}

/** A name, a bar and a figure per row, bars aligned. */
export function MeterList({ rows, max = 100, labelWidth = 92 }: { rows: MeterRow[]; max?: number; labelWidth?: number }) {
  const t = useTheme();
  return (
    <View style={{ gap: 12 }}>
      {rows.map((row) => {
        const empty = row.value == null;
        const share = empty ? 0 : Math.max(0, Math.min(1, row.value! / max));
        const figure = empty ? '–' : (row.figure ?? String(row.value));
        return (
          <View
            key={row.label}
            accessible
            accessibilityLabel={`${row.label}: ${empty ? 'not measured yet' : figure}`}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}
          >
            <Text numberOfLines={1} style={{ width: labelWidth, fontFamily: font.medium, fontSize: 15, color: t.ink }}>
              {row.label}
            </Text>
            <View style={{ flex: 1, height: 8, borderRadius: 4, backgroundColor: t.accentWash, overflow: 'hidden' }}>
              <View style={{ width: `${share * 100}%`, height: 8, borderRadius: 4, backgroundColor: t.accent }} />
            </View>
            <Text style={{ minWidth: 26, textAlign: 'right', fontFamily: empty ? font.medium : font.bold, fontSize: 15, color: empty ? t.muted : t.ink }}>
              {figure}
            </Text>
          </View>
        );
      })}
    </View>
  );
}

function Arc({ size, stroke, share, track, color }: { size: number; stroke: number; share: number; track: string; color: string }) {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const clamped = Math.max(0, Math.min(1, share));
  return (
    <Svg width={size} height={size} style={{ position: 'absolute', transform: [{ rotate: '-90deg' }] }}>
      <Circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke={track} strokeWidth={stroke} />
      {clamped > 0 && (
        <Circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference * clamped} ${circumference}`}
        />
      )}
    </Svg>
  );
}

/** The one big number on a report: an overall score out of 100 inside a thin ring. */
export function ScoreRing({ value }: { value: number | null }) {
  const t = useTheme();
  const size = 132;
  return (
    <View
      accessible
      accessibilityLabel={value == null ? 'No score' : `Score ${value} out of 100`}
      style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}
    >
      <Arc size={size} stroke={8} share={(value ?? 0) / 100} track={t.accentWash} color={t.accent} />
      <Text style={{ fontFamily: font.bold, fontSize: 50, lineHeight: 54, letterSpacing: -1.5, color: t.ink }}>{value ?? '–'}</Text>
      <Text style={{ fontFamily: font.sans, fontSize: 12, color: t.ink2 }}>out of 100</Text>
    </View>
  );
}

/** Countdown / time-left ring used during a take. */
export function TimerRing({ share, value, label }: { share: number; value: string; label: string }) {
  const t = useTheme();
  const size = 124;
  return (
    <View accessible accessibilityRole="timer" accessibilityLabel={`${value} ${label}`} style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Arc size={size} stroke={6} share={share} track={t.grid} color={t.accent} />
      <Text style={{ fontFamily: font.bold, fontSize: 36, lineHeight: 40, letterSpacing: -0.8, color: t.ink, fontVariant: ['tabular-nums'] }}>{value}</Text>
      <Text style={{ fontFamily: font.bold, fontSize: 11, letterSpacing: 0.8, color: t.ink2, textTransform: 'uppercase' }}>{label}</Text>
    </View>
  );
}

export interface LinePoint {
  x: number;
  y: number;
  /** How to name this point's position: "0:24", "12 Mar". */
  label: string;
}

interface LineChartProps {
  points: LinePoint[];
  description: string;
  xName: string;
  yName: string;
  unit?: string;
  height?: number;
  /** Keep these values inside the y-range even if the data does not reach them. */
  include?: number[];
  band?: { from: number; to: number; label: string };
}

export function LineChart({ points, description, xName, yName, unit = '', height = 180, include = [], band }: LineChartProps) {
  const t = useTheme();
  const [width, setWidth] = useState(320);
  const [active, setActive] = useState<number | null>(null);
  const [table, setTable] = useState(false);
  if (points.length === 0) return null;

  const last = points[points.length - 1]!;
  const endLabel = `${last.y}${unit ? ` ${unit}` : ''}`;
  const margin = { top: 14, right: 12 + endLabel.length * 7, bottom: 22, left: 34 };
  const plotW = Math.max(40, width - margin.left - margin.right);
  const plotH = height - margin.top - margin.bottom;

  const ys = [...points.map((p) => p.y), ...include, ...(band ? [band.from, band.to] : [])];
  const ticks = niceTicks(Math.min(...ys), Math.max(...ys));
  const yMin = ticks[0]!;
  const yMax = ticks[ticks.length - 1]!;
  const xMin = points[0]!.x;
  const xMax = last.x;
  const sx = (x: number) => margin.left + (xMax === xMin ? plotW / 2 : ((x - xMin) / (xMax - xMin)) * plotW);
  const sy = (y: number) => margin.top + plotH - ((y - yMin) / (yMax - yMin)) * plotH;
  const baseY = margin.top + plotH;

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  const area = `${line} L${sx(xMax).toFixed(1)},${baseY} L${sx(xMin).toFixed(1)},${baseY} Z`;
  const shown = active != null ? points[active]! : null;

  const pick = (event: GestureResponderEvent) => {
    const x = event.nativeEvent.locationX;
    let best = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(sx(points[i]!.x) - x) < Math.abs(sx(points[best]!.x) - x)) best = i;
    }
    setActive(best);
  };

  return (
    <View>
      <View
        accessible
        accessibilityLabel={`${description}. Latest value ${endLabel}. A table of every value follows.`}
        onLayout={(event: LayoutChangeEvent) => setWidth(event.nativeEvent.layout.width)}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={pick}
        onResponderMove={pick}
        onResponderRelease={() => setActive(null)}
        onResponderTerminate={() => setActive(null)}
      >
        <Svg width={width} height={height} pointerEvents="none">
          {band && (
            <>
              <Rect x={margin.left} y={sy(band.to)} width={plotW} height={Math.max(0, sy(band.from) - sy(band.to))} fill={t.surface2} />
              <SvgText x={margin.left + 6} y={sy(band.to) + 13} fontSize={11} fill={t.muted} fontFamily={font.sans}>
                {band.label}
              </SvgText>
            </>
          )}
          {ticks.map((tick) => (
            <Line key={`g${tick}`} x1={margin.left} x2={margin.left + plotW} y1={sy(tick)} y2={sy(tick)} stroke={tick === yMin ? t.axis : t.grid} strokeWidth={1} />
          ))}
          {ticks.map((tick) => (
            <SvgText key={`t${tick}`} x={margin.left - 7} y={sy(tick) + 4} fontSize={11} fill={t.muted} textAnchor="end" fontFamily={font.sans}>
              {tick}
            </SvgText>
          ))}
          <SvgText x={sx(xMin)} y={height - 5} fontSize={11} fill={t.muted} textAnchor="start" fontFamily={font.sans}>
            {points[0]!.label}
          </SvgText>
          {points.length > 1 && (
            <SvgText x={sx(xMax)} y={height - 5} fontSize={11} fill={t.muted} textAnchor="end" fontFamily={font.sans}>
              {last.label}
            </SvgText>
          )}
          {points.length > 1 && <Path d={area} fill={t.accent} opacity={0.1} />}
          {points.length > 1 && <Path d={line} fill="none" stroke={t.accent} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" />}
          {shown && <Line x1={sx(shown.x)} x2={sx(shown.x)} y1={margin.top} y2={baseY} stroke={t.axis} strokeWidth={1} />}
          <Circle cx={sx(last.x)} cy={sy(last.y)} r={4} fill={t.accent} stroke={t.surface} strokeWidth={2} />
          <SvgText x={sx(last.x) + 9} y={sy(last.y) + 4} fontSize={12} fill={t.ink} fontFamily={font.bold}>
            {endLabel}
          </SvgText>
          {shown && <Circle cx={sx(shown.x)} cy={sy(shown.y)} r={5} fill={t.accent} stroke={t.surface} strokeWidth={2} />}
        </Svg>
        {shown && (
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: Math.max(0, Math.min(width - 96, sx(shown.x) - 48)),
              top: Math.max(0, sy(shown.y) - 52),
              width: 96,
              alignItems: 'center',
              paddingVertical: 4,
              borderRadius: 8,
              borderWidth: 1,
              borderColor: t.border,
              backgroundColor: t.surface,
            }}
          >
            <Text style={{ fontFamily: font.bold, fontSize: 14, color: t.ink }}>
              {shown.y}
              {unit ? ` ${unit}` : ''}
            </Text>
            <Text style={{ fontFamily: font.sans, fontSize: 12, color: t.ink2 }}>{shown.label}</Text>
          </View>
        )}
      </View>

      <Pressable accessibilityRole="button" accessibilityState={{ expanded: table }} onPress={() => setTable(!table)} style={{ paddingVertical: 8 }}>
        <T v="small">{table ? 'Hide table' : 'View as table'}</T>
      </Pressable>
      {table && (
        <View>
          <View style={{ flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: t.grid }}>
            <Text style={{ flex: 1, fontFamily: font.bold, fontSize: 12, color: t.ink2 }}>{xName}</Text>
            <Text style={{ fontFamily: font.bold, fontSize: 12, color: t.ink2 }}>{yName}</Text>
          </View>
          {points.map((p, i) => (
            <View key={i} style={{ flexDirection: 'row', paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: t.grid }}>
              <Text style={{ flex: 1, fontFamily: font.sans, fontSize: 13, color: t.ink }}>{p.label}</Text>
              <Text style={{ fontFamily: font.sans, fontSize: 13, color: t.ink, fontVariant: ['tabular-nums'] }}>{p.y}</Text>
            </View>
          ))}
        </View>
      )}
    </View>
  );
}

/** Minutes practised on each of the last seven days. */
export function WeekBars({ days }: { days: DayActivity[] }) {
  const t = useTheme();
  const max = Math.max(5, ...days.map((d) => d.minutes));
  const summary = days.map((d) => `${d.key} ${Math.round(d.minutes)} minutes`).join(', ');
  return (
    <View accessible accessibilityLabel={`Minutes practised over the last seven days: ${summary}`} style={{ flexDirection: 'row', height: 84, alignItems: 'flex-end' }}>
      {days.map((day) => (
        <View key={day.key} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', gap: 6, height: 84 }}>
          <View
            style={{
              width: 18,
              height: day.minutes > 0 ? Math.max(6, (day.minutes / max) * 58) : 3,
              borderTopLeftRadius: day.minutes > 0 ? 4 : 2,
              borderTopRightRadius: day.minutes > 0 ? 4 : 2,
              backgroundColor: day.minutes > 0 ? t.accent : t.grid,
            }}
          />
          <Text style={{ fontFamily: day.isToday ? font.bold : font.sans, fontSize: 12, color: day.isToday ? t.ink : t.muted }}>{day.label}</Text>
        </View>
      ))}
    </View>
  );
}
