import { describe, expect, it } from 'vitest';
import type { Analysis, SkillId, TakeRecord } from './types';
import { computeProgress, levelFor, previousAttempt, xpFor } from './progress';

const NOON = (key: string) => new Date(`${key}T12:00:00`).getTime();

function take(day: string, scores: Partial<Record<SkillId, number>> = {}, over: Partial<TakeRecord> = {}): TakeRecord {
  const values = Object.values(scores);
  const overall = values.length ? Math.round(values.reduce((a, b) => a + b, 0) / values.length) : null;
  return {
    id: `${day}-${Math.random()}`,
    at: NOON(day),
    planId: 'p',
    planTitle: 'Impromptu',
    exercise: { id: 'e', drillId: 'impromptu', title: 'Impromptu', tag: '', prompt: 'Why?', prepSec: 0, speakSec: 60, mode: 'speak', goals: [] },
    capture: { transcript: '', transcriptAvailable: true, segments: [], wordTimeline: [], durationMs: 60000, voice: null, stepMarks: [] },
    analysis: { sufficient: overall != null, overall, scores, goals: [], speakingSec: 60 } as unknown as Analysis,
    xp: 20,
    ...over,
  };
}

describe('streaks', () => {
  const now = new Date('2026-03-10T18:00:00');

  it('counts consecutive days ending today', () => {
    const p = computeProgress([take('2026-03-10'), take('2026-03-09'), take('2026-03-08'), take('2026-03-05')], now);
    expect(p.streak).toBe(3);
    expect(p.bestStreak).toBe(3);
  });

  it('keeps yesterday’s streak alive until today is over', () => {
    expect(computeProgress([take('2026-03-09'), take('2026-03-08')], now).streak).toBe(2);
  });

  it('resets after a missed day but remembers the best run', () => {
    const p = computeProgress([take('2026-03-08'), take('2026-03-03'), take('2026-03-02'), take('2026-03-01'), take('2026-02-28')], now);
    expect(p.streak).toBe(0);
    expect(p.bestStreak).toBe(4);
  });

  it('is zero with no history', () => {
    const p = computeProgress([], now);
    expect(p).toMatchObject({ streak: 0, bestStreak: 0, takes: 0, recentAverage: null, weakest: null });
    expect(p.week.length).toBe(7);
    expect(p.week[6]!.isToday).toBe(true);
  });
});

describe('practice time', () => {
  it('totals minutes for today and the past seven days', () => {
    const now = new Date('2026-03-10T18:00:00');
    const p = computeProgress([take('2026-03-10'), take('2026-03-10'), take('2026-03-06'), take('2026-02-20')], now);
    expect(p.todayMinutes).toBe(2);
    expect(p.weekMinutes).toBe(3);
    expect(p.totalMinutes).toBe(4);
    expect(p.xp).toBe(80);
  });
});

describe('skill ratings', () => {
  it('weights recent takes more and finds the weakest skill', () => {
    // Newest first, as stored.
    const p = computeProgress([
      take('2026-03-10', { fluency: 80, pace: 90 }),
      take('2026-03-09', { fluency: 40, pace: 90 }),
      take('2026-03-08', { fluency: 40, pace: 90, clarity: 10 }),
    ]);
    const fluency = p.skills.find((s) => s.id === 'fluency')!;
    expect(fluency.score).toBe(56); // (80 + 0.85*40 + 0.7225*40) / (1 + 0.85 + 0.7225)
    expect(fluency.samples).toBe(3);
    expect(p.weakest).toBe('fluency'); // clarity has one sample only, so it is not trusted yet
    expect(p.strongest).toBe('pace');
    expect(p.skills.find((s) => s.id === 'delivery')!.score).toBeNull();
    expect(p.recentAverage).toBe(66); // mean of 85, 65 and 47
  });
});

describe('levels', () => {
  it('maps XP to a level with progress inside it', () => {
    expect(levelFor(0)).toMatchObject({ number: 1, into: 0, span: 100 });
    expect(levelFor(120)).toMatchObject({ number: 2, into: 20, span: 150 });
    expect(levelFor(3300)).toMatchObject({ number: 10, into: 100, span: 900 });
    expect(levelFor(4200)).toMatchObject({ number: 11, into: 100, span: 900 });
  });

  it('awards more XP for a longer, better take with goals met', () => {
    const base = { sufficient: true, overall: 50, speakingSec: 30, goals: [] } as unknown as Analysis;
    const better = { sufficient: true, overall: 90, speakingSec: 60, goals: [{ met: true }, { met: false }] } as unknown as Analysis;
    expect(xpFor(better)).toBeGreaterThan(xpFor(base));
    expect(xpFor({ sufficient: false, overall: null, goals: [] } as unknown as Analysis)).toBe(2);
  });
});

describe('previousAttempt', () => {
  it('finds the last earlier take of the same prompt', () => {
    const first = take('2026-03-01');
    const other = take('2026-03-02', {}, { exercise: { ...first.exercise, prompt: 'Something else' } });
    const second = take('2026-03-03');
    const third = take('2026-03-04');
    const history = [third, second, other, first];
    expect(previousAttempt(history, third)).toBe(second);
    expect(previousAttempt(history, first)).toBeNull();
    expect(previousAttempt(history, other)).toBeNull();
  });
});
