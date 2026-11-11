// Everything derived from the history of takes: streaks, practice time, level, skill ratings.

import { SKILLS, type Analysis, type SkillId, type TakeRecord } from './types';
import { dateKey } from './content/drills';

export function xpFor(analysis: Analysis): number {
  if (!analysis.sufficient || analysis.overall == null) return 2;
  const goalsMet = analysis.goals.filter((g) => g.met).length;
  return Math.round(8 + analysis.speakingSec / 6 + analysis.overall / 5 + 4 * goalsMet);
}

const LEVELS: [number, string][] = [
  [0, 'Finding your voice'],
  [100, 'Warming up'],
  [250, 'Steady speaker'],
  [450, 'Clear communicator'],
  [700, 'Confident presenter'],
  [1000, 'Compelling storyteller'],
  [1400, 'Persuader'],
  [1900, 'Polished orator'],
  [2500, 'Master communicator'],
  [3200, 'Virtuoso'],
];

export interface Level {
  number: number;
  name: string;
  /** XP earned inside this level and the XP it spans. */
  into: number;
  span: number;
}

export function levelFor(xp: number): Level {
  let index = 0;
  for (let i = 0; i < LEVELS.length; i++) if (xp >= LEVELS[i]![0]) index = i;
  const floor = LEVELS[index]![0];
  const ceiling = LEVELS[index + 1]?.[0] ?? floor + 900;
  // Past the last named level, keep counting in steps of 900.
  if (index === LEVELS.length - 1 && xp >= ceiling) {
    const extra = Math.floor((xp - floor) / 900);
    return { number: LEVELS.length + extra, name: LEVELS[index]![1], into: (xp - floor) % 900, span: 900 };
  }
  return { number: index + 1, name: LEVELS[index]![1], into: xp - floor, span: ceiling - floor };
}

export interface SkillRating {
  id: SkillId;
  label: string;
  /** Recency-weighted average, or null if never measured. */
  score: number | null;
  samples: number;
}

export interface DayActivity {
  key: string;
  /** One-letter weekday. */
  label: string;
  minutes: number;
  isToday: boolean;
}

export interface Progress {
  takes: number;
  totalMinutes: number;
  todayMinutes: number;
  weekMinutes: number;
  streak: number;
  bestStreak: number;
  xp: number;
  level: Level;
  /** Average overall score of the ten most recent scored takes. */
  recentAverage: number | null;
  skills: SkillRating[];
  weakest: SkillId | null;
  strongest: SkillId | null;
  week: DayActivity[];
}

const DAY_MS = 86400000;
/** How much less each older take counts toward a skill rating than the take after it. */
const RECENCY = 0.85;

function shiftDay(key: string, days: number): string {
  return dateKey(new Date(new Date(`${key}T12:00:00`).getTime() + days * DAY_MS));
}

export function computeProgress(takes: TakeRecord[], now: Date = new Date()): Progress {
  const today = dateKey(now);
  const minutesByDay = new Map<string, number>();
  let totalSeconds = 0;
  let xp = 0;
  for (const take of takes) {
    const key = dateKey(new Date(take.at));
    const seconds = take.capture.durationMs / 1000;
    minutesByDay.set(key, (minutesByDay.get(key) ?? 0) + seconds / 60);
    totalSeconds += seconds;
    xp += take.xp;
  }

  // Current streak: consecutive practice days ending today, or yesterday if today is still open.
  let streak = 0;
  let cursor = minutesByDay.has(today) ? today : shiftDay(today, -1);
  while (minutesByDay.has(cursor)) {
    streak++;
    cursor = shiftDay(cursor, -1);
  }

  let bestStreak = 0;
  for (const key of minutesByDay.keys()) {
    if (minutesByDay.has(shiftDay(key, -1))) continue; // not the start of a run
    let length = 1;
    while (minutesByDay.has(shiftDay(key, length))) length++;
    bestStreak = Math.max(bestStreak, length);
  }

  const week: DayActivity[] = [];
  let weekMinutes = 0;
  for (let i = 6; i >= 0; i--) {
    const key = shiftDay(today, -i);
    const minutes = minutesByDay.get(key) ?? 0;
    weekMinutes += minutes;
    week.push({
      key,
      label: new Date(`${key}T12:00:00`).toLocaleDateString(undefined, { weekday: 'narrow' }),
      minutes,
      isToday: i === 0,
    });
  }

  // Skill ratings: a weighted mean in which each older take counts for 15% less than the one after it.
  const ratings = new Map<SkillId, { total: number; weight: number; samples: number }>();
  for (const take of takes) {
    for (const [skill, score] of Object.entries(take.analysis.scores) as [SkillId, number][]) {
      const current = ratings.get(skill) ?? { total: 0, weight: 0, samples: 0 };
      const weight = RECENCY ** current.samples;
      ratings.set(skill, { total: current.total + score * weight, weight: current.weight + weight, samples: current.samples + 1 });
    }
  }
  const skills: SkillRating[] = SKILLS.map((skill) => {
    const rating = ratings.get(skill.id);
    return {
      id: skill.id,
      label: skill.label,
      score: rating ? Math.round(rating.total / rating.weight) : null,
      samples: rating?.samples ?? 0,
    };
  });
  const rated = skills.filter((s) => s.score != null && s.samples >= 2);
  const sorted = [...rated].sort((a, b) => a.score! - b.score!);

  const recent = takes.filter((t) => t.analysis.overall != null).slice(0, 10);
  const recentAverage = recent.length
    ? Math.round(recent.reduce((n, t) => n + t.analysis.overall!, 0) / recent.length)
    : null;

  return {
    takes: takes.length,
    totalMinutes: totalSeconds / 60,
    todayMinutes: minutesByDay.get(today) ?? 0,
    weekMinutes,
    streak,
    bestStreak,
    xp,
    level: levelFor(xp),
    recentAverage,
    skills,
    weakest: sorted.length >= 2 ? sorted[0]!.id : null,
    strongest: sorted.length >= 2 ? sorted[sorted.length - 1]!.id : null,
    week,
  };
}

/** The most recent earlier attempt at the same prompt, for "better than last time". */
export function previousAttempt(takes: TakeRecord[], take: TakeRecord): TakeRecord | null {
  return (
    takes.find(
      (t) =>
        t.id !== take.id &&
        t.at < take.at &&
        t.exercise.drillId === take.exercise.drillId &&
        t.exercise.prompt === take.exercise.prompt &&
        (t.exercise.readText ?? '') === (take.exercise.readText ?? '') &&
        t.exercise.speakSec === take.exercise.speakSec,
    ) ?? null
  );
}
