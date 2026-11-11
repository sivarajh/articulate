// Charts and figures. One blue for data, hairline grid, values always reachable without
// hovering (direct end label + a table view), and keyboard focus shows what hover shows.

import { useEffect, useId, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react';
import type { DayActivity } from '../lib/progress';
import { Icon } from './Icon';

function useWidth<T extends HTMLElement>(fallback = 560): [React.RefObject<T | null>, number] {
  const ref = useRef<T>(null);
  const [width, setWidth] = useState(fallback);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    setWidth(element.clientWidth || fallback);
    const observer = new ResizeObserver(([entry]) => {
      if (entry) setWidth(entry.contentRect.width || fallback);
    });
    observer.observe(element);
    return () => observer.disconnect();
  }, [fallback]);
  return [ref, width];
}

/** Round tick values covering [min, max] in about `count` steps. */
export function niceTicks(min: number, max: number, count = 4): number[] {
  if (max <= min) max = min + 1;
  const rawStep = (max - min) / count;
  const magnitude = 10 ** Math.floor(Math.log10(rawStep));
  const residual = rawStep / magnitude;
  const step = (residual >= 5 ? 10 : residual >= 2 ? 5 : residual >= 1 ? 2 : 1) * magnitude;
  const first = Math.floor(min / step) * step;
  const ticks: number[] = [];
  for (let value = first; value < max + step; value += step) ticks.push(Math.round(value * 1000) / 1000);
  return ticks;
}

export interface LinePoint {
  x: number;
  y: number;
  /** How to name this point's position: "0:24", "12 Mar". */
  label: string;
}

interface LineChartProps {
  points: LinePoint[];
  ariaLabel: string;
  /** Column headings for the table view. */
  xName: string;
  yName: string;
  unit?: string;
  height?: number;
  /** Keep these values inside the y-range even if the data does not reach them. */
  include?: number[];
  band?: { from: number; to: number; label: string };
}

export function LineChart({ points, ariaLabel, xName, yName, unit = '', height = 190, include = [], band }: LineChartProps) {
  const [ref, width] = useWidth<HTMLDivElement>();
  const [active, setActive] = useState<number | null>(null);
  const clipId = useId();
  if (points.length === 0) return null;

  const last = points[points.length - 1]!;
  const endLabel = `${last.y}${unit ? ` ${unit}` : ''}`;
  // The value of the last point is printed beside it, so leave room for it on the right.
  const margin = { top: 16, right: 14 + endLabel.length * 7, bottom: 24, left: 38 };
  const plotW = Math.max(40, width - margin.left - margin.right);
  const plotH = height - margin.top - margin.bottom;

  const ys = [...points.map((p) => p.y), ...include, ...(band ? [band.from, band.to] : [])];
  const ticks = niceTicks(Math.min(...ys), Math.max(...ys));
  const yMin = ticks[0]!;
  const yMax = ticks[ticks.length - 1]!;
  const xMin = points[0]!.x;
  const xMax = points[points.length - 1]!.x;
  const sx = (x: number) => margin.left + (xMax === xMin ? plotW / 2 : ((x - xMin) / (xMax - xMin)) * plotW);
  const sy = (y: number) => margin.top + plotH - ((y - yMin) / (yMax - yMin)) * plotH;

  const line = points.map((p, i) => `${i ? 'L' : 'M'}${sx(p.x).toFixed(1)},${sy(p.y).toFixed(1)}`).join(' ');
  const baseY = margin.top + plotH;
  const area = `${line} L${sx(xMax).toFixed(1)},${baseY} L${sx(xMin).toFixed(1)},${baseY} Z`;
  const shown = active != null ? points[active]! : null;

  // A label at each end, plus the middle when there is room.
  const labelIndexes = [...new Set(points.length > 4 && plotW > 320 ? [0, points.length >> 1, points.length - 1] : [0, points.length - 1])];

  const nearest = (clientX: number, rect: DOMRect) => {
    const x = clientX - rect.left;
    let best = 0;
    for (let i = 1; i < points.length; i++) {
      if (Math.abs(sx(points[i]!.x) - x) < Math.abs(sx(points[best]!.x) - x)) best = i;
    }
    return best;
  };
  const onMove = (event: PointerEvent<SVGSVGElement>) => setActive(nearest(event.clientX, event.currentTarget.getBoundingClientRect()));
  const onKey = (event: KeyboardEvent<SVGSVGElement>) => {
    if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
    event.preventDefault();
    const current = active ?? points.length - 1;
    setActive(Math.max(0, Math.min(points.length - 1, current + (event.key === 'ArrowRight' ? 1 : -1))));
  };

  return (
    <div className="chart" ref={ref}>
      <svg
        height={height}
        viewBox={`0 0 ${width} ${height}`}
        role="img"
        aria-label={`${ariaLabel}. Use the arrow keys to read values.`}
        tabIndex={0}
        onPointerMove={onMove}
        onPointerLeave={() => setActive(null)}
        onFocus={() => setActive((a) => a ?? points.length - 1)}
        onBlur={() => setActive(null)}
        onKeyDown={onKey}
      >
        <defs>
          <clipPath id={clipId}>
            <rect x={margin.left} y={margin.top} width={plotW} height={plotH} />
          </clipPath>
        </defs>

        {band && (
          <g>
            <rect
              x={margin.left}
              y={sy(band.to)}
              width={plotW}
              height={Math.max(0, sy(band.from) - sy(band.to))}
              fill="var(--surface-2)"
            />
            <text
              x={margin.left + 6}
              y={sy(band.to) + 13}
              fontSize="11"
              fill="var(--muted)"
              stroke="var(--surface-2)"
              strokeWidth="3"
              paintOrder="stroke"
            >
              {band.label}
            </text>
          </g>
        )}

        <g className="chart-axis">
          {ticks.map((tick) => (
            <g key={tick}>
              <line
                x1={margin.left}
                x2={margin.left + plotW}
                y1={sy(tick)}
                y2={sy(tick)}
                stroke={tick === yMin ? 'var(--axis)' : 'var(--grid)'}
                strokeWidth="1"
              />
              <text x={margin.left - 8} y={sy(tick) + 4} textAnchor="end">
                {tick}
              </text>
            </g>
          ))}
          {labelIndexes.map((i) => (
            <text
              key={i}
              x={sx(points[i]!.x)}
              y={height - 6}
              textAnchor={i === 0 ? 'start' : i === points.length - 1 ? 'end' : 'middle'}
            >
              {points[i]!.label}
            </text>
          ))}
        </g>

        {points.length > 1 && (
          <g clipPath={`url(#${clipId})`}>
            <path d={area} fill="var(--accent)" opacity="0.1" />
            <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          </g>
        )}

        {shown && (
          <line x1={sx(shown.x)} x2={sx(shown.x)} y1={margin.top} y2={baseY} stroke="var(--axis)" strokeWidth="1" />
        )}
        <circle cx={sx(last.x)} cy={sy(last.y)} r="4" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
        <text x={sx(last.x) + 9} y={sy(last.y) + 4} fontSize="12" fontWeight="600" fill="var(--ink)">
          {endLabel}
        </text>
        {shown && (
          <circle cx={sx(shown.x)} cy={sy(shown.y)} r="5" fill="var(--accent)" stroke="var(--surface)" strokeWidth="2" />
        )}
      </svg>

      {shown && (
        <div className="chart-tip" style={{ left: sx(shown.x), top: sy(shown.y) - 12 }} aria-hidden="true">
          <strong>
            {shown.y}
            {unit ? ` ${unit}` : ''}
          </strong>
          <span>{shown.label}</span>
        </div>
      )}

      <details className="chart-table">
        <summary>View as table</summary>
        <table className="table">
          <thead>
            <tr>
              <th>{xName}</th>
              <th className="num">{yName}</th>
            </tr>
          </thead>
          <tbody>
            {points.map((p, i) => (
              <tr key={i}>
                <td>{p.label}</td>
                <td className="num">{p.y}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </div>
  );
}

export interface MeterRow {
  label: string;
  /** 0–100, or null when there is nothing to show yet. */
  value: number | null;
  /** Text for the figure column; defaults to the value. */
  figure?: string;
}

/** A name, a bar and a figure per row, bars aligned. */
export function MeterList({ rows, max = 100 }: { rows: MeterRow[]; max?: number }) {
  return (
    <div className="meter-list">
      {rows.map((row) => {
        const empty = row.value == null;
        const share = empty ? 0 : Math.max(0, Math.min(1, row.value! / max));
        return (
          <div key={row.label} className={empty ? 'meter-empty' : undefined} style={{ display: 'contents' }}>
            <span className="meter-label">{row.label}</span>
            <div
              className="meter-track"
              role="meter"
              aria-label={row.label}
              aria-valuemin={0}
              aria-valuemax={max}
              aria-valuenow={row.value ?? 0}
              aria-valuetext={empty ? 'Not measured yet' : (row.figure ?? String(row.value))}
            >
              <div className="meter-fill" style={{ width: `${share * 100}%` }} />
            </div>
            <span className="meter-value">{empty ? '–' : (row.figure ?? row.value)}</span>
          </div>
        );
      })}
    </div>
  );
}

/** The one big number on a report: an overall score out of 100 inside a thin ring. */
export function ScoreRing({ value }: { value: number | null }) {
  const size = 148;
  const stroke = 8;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const share = value == null ? 0 : Math.max(0, Math.min(1, value / 100));
  return (
    <div className="score" role="img" aria-label={value == null ? 'No score' : `Score ${value} out of 100`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--accent-wash)" strokeWidth={stroke} />
        {value != null && (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            fill="none"
            stroke="var(--accent)"
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={`${circumference * share} ${circumference}`}
          />
        )}
      </svg>
      <div>
        <div className="score-value">{value ?? '–'}</div>
        <div className="score-unit">out of 100</div>
      </div>
    </div>
  );
}

const STATUS_ICON = { good: 'check', ok: 'check', warn: 'minus', bad: 'x' } as const;

/** Status is never colour alone: an icon and a word always travel with it. */
export function Status({ level, label }: { level: 'good' | 'ok' | 'warn' | 'bad'; label: string }) {
  return (
    <span className={`status status-${level}`}>
      <span className="status-dot">
        <Icon name={STATUS_ICON[level]} size={12} strokeWidth={3} />
      </span>
      {label}
    </span>
  );
}

/** Minutes practised on each of the last seven days. */
export function WeekBars({ days }: { days: DayActivity[] }) {
  const max = Math.max(5, ...days.map((d) => d.minutes));
  return (
    <div className="week" role="img" aria-label={`Minutes practised over the last seven days: ${days.map((d) => `${d.key} ${Math.round(d.minutes)}`).join(', ')}`}>
      {days.map((day) => {
        const minutes = Math.round(day.minutes * 10) / 10;
        return (
          <div key={day.key} className={`week-day${day.isToday ? ' week-today' : ''}`} title={`${day.key}: ${minutes} min`}>
            <div
              className={`week-bar${day.minutes > 0 ? '' : ' week-bar-empty'}`}
              style={{ height: day.minutes > 0 ? `${Math.max(8, (day.minutes / max) * 100)}%` : 3 }}
            />
            <span className="week-label">{day.label}</span>
          </div>
        );
      })}
    </div>
  );
}
