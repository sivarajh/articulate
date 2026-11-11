import { dateKey } from './content/drills';

/** 75 -> "1:15" */
export function clock(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

/** 75 -> "1 min 15 s", 60 -> "1 min", 30 -> "30 s" */
export function duration(seconds: number): string {
  const s = Math.max(0, Math.round(seconds));
  const m = Math.floor(s / 60);
  const rest = s % 60;
  if (m === 0) return `${rest} s`;
  return rest ? `${m} min ${rest} s` : `${m} min`;
}

export function minutes(value: number): string {
  if (value < 1) return value > 0 ? '<1' : '0';
  return String(Math.round(value));
}

/** "Today, 14:32", "Yesterday, 09:10", "12 Mar" */
export function when(at: number, now: Date = new Date()): string {
  const date = new Date(at);
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const key = dateKey(date);
  if (key === dateKey(now)) return `Today, ${time}`;
  if (key === dateKey(new Date(now.getTime() - 86400000))) return `Yesterday, ${time}`;
  const sameYear = date.getFullYear() === now.getFullYear();
  return date.toLocaleDateString(undefined, sameYear ? { day: 'numeric', month: 'short' } : { day: 'numeric', month: 'short', year: 'numeric' });
}

export function shortDate(at: number): string {
  return new Date(at).toLocaleDateString(undefined, { day: 'numeric', month: 'short' });
}

export function greeting(now: Date = new Date()): string {
  const hour = now.getHours();
  if (hour < 5) return 'Still up';
  if (hour < 12) return 'Good morning';
  if (hour < 18) return 'Good afternoon';
  return 'Good evening';
}
