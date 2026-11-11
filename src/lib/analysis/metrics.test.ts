import { describe, expect, it } from 'vitest';
import type { Capture } from '../types';
import { alignRead, paceSeries, speakingWindow, stepCoverage, summarisePauses, variation, wordsAt } from './metrics';

const capture = (over: Partial<Capture>): Capture => ({
  transcript: '',
  transcriptAvailable: true,
  segments: [],
  wordTimeline: [],
  durationMs: 60000,
  voice: null,
  stepMarks: [],
  ...over,
});

describe('wordsAt', () => {
  const timeline = [
    { t: 1000, words: 2 },
    { t: 3000, words: 8 },
  ];
  it('interpolates between samples', () => {
    expect(wordsAt(timeline, 0)).toBe(0);
    expect(wordsAt(timeline, 500)).toBe(1);
    expect(wordsAt(timeline, 2000)).toBe(5);
    expect(wordsAt(timeline, 9000)).toBe(8);
  });
});

describe('paceSeries', () => {
  it('reports a steady pace for evenly spaced words', () => {
    // 2.5 words a second = 150 wpm
    const timeline = Array.from({ length: 61 }, (_, i) => ({ t: i * 1000, words: i * 2.5 }));
    const series = paceSeries(timeline, 0, 60000);
    expect(series.length).toBeGreaterThan(5);
    for (const point of series) expect(point.wpm).toBe(150);
    expect(variation(series.map((p) => p.wpm))).toBe(0);
  });

  it('is empty for takes too short to chart', () => {
    expect(paceSeries([{ t: 5000, words: 10 }], 0, 15000)).toEqual([]);
  });
});

describe('speakingWindow', () => {
  it('excludes thinking time before the first word and silence after the last', () => {
    const c = capture({
      voice: {
        speechMs: 20000,
        firstSpeechMs: 3000,
        lastSpeechMs: 40000,
        pauses: [],
        levelDbMean: -20,
        levelDbStd: 3,
        pitchMedianHz: null,
        pitchStdSemitones: null,
        voicedFrames: 0,
        levels: [],
      },
    });
    expect(speakingWindow(c)).toEqual({ start: 3000, end: 40300 });
  });

  it('falls back to the word timeline without microphone analysis', () => {
    const c = capture({ wordTimeline: [{ t: 2600, words: 3 }, { t: 30000, words: 60 }] });
    expect(speakingWindow(c)).toEqual({ start: 2000, end: 30000 });
  });
});

describe('summarisePauses', () => {
  it('sorts silences into deliberate pauses and stalls', () => {
    const c = capture({
      voice: {
        speechMs: 20000,
        firstSpeechMs: 1000,
        lastSpeechMs: 31000,
        pauses: [
          { start: 5000, end: 5400 }, // natural gap
          { start: 9000, end: 10000 }, // deliberate
          { start: 15000, end: 18000 }, // stall
        ],
        levelDbMean: -20,
        levelDbStd: 3,
        pitchMedianHz: null,
        pitchStdSemitones: null,
        voicedFrames: 0,
        levels: [],
      },
    });
    expect(summarisePauses(c)).toEqual({
      deliberate: 1,
      long: 1,
      longestSec: 3,
      silenceRatio: 4400 / 30000,
    });
  });
});

describe('stepCoverage', () => {
  it('splits words between the moments the speaker advanced', () => {
    const timeline = Array.from({ length: 31 }, (_, i) => ({ t: i * 1000, words: i * 2 }));
    const c = capture({ durationMs: 30000, wordTimeline: timeline, stepMarks: [10000, 20000] });
    const steps = stepCoverage(c, ['Point', 'Reason', 'Example']);
    expect(steps.map((s) => s.label)).toEqual(['Point', 'Reason', 'Example']);
    expect(steps.map((s) => s.sec)).toEqual([10, 10, 10]);
    expect(steps.reduce((n, s) => n + s.words, 0)).toBe(60);
    for (const step of steps) expect(step.words).toBeGreaterThan(15);
  });

  it('reports untouched steps as empty', () => {
    const c = capture({ durationMs: 10000, wordTimeline: [{ t: 9000, words: 20 }], stepMarks: [] });
    const steps = stepCoverage(c, ['What', 'So what', 'Now what']);
    expect(steps[0]!.words).toBe(20);
    expect(steps[1]!.words).toBe(0);
    expect(steps[2]!.words).toBe(0);
  });
});

describe('alignRead', () => {
  const passage = 'She sells seashells by the seashore.';

  it('scores a perfect read at 100%', () => {
    const result = alignRead(passage, 'she sells seashells by the seashore');
    expect(result.accuracy).toBe(1);
    expect(result.missed).toEqual([]);
  });

  it('finds substituted and skipped words', () => {
    const result = alignRead(passage, 'she shells seashells by seashore');
    expect(result.hits).toEqual([true, false, true, true, false, true]);
    expect(result.missed).toEqual(['sells', 'the']);
    expect(result.accuracy).toBeCloseTo(4 / 6);
  });

  it('ignores extra words and tolerates digits and plurals', () => {
    expect(alignRead('I bought three boxes', 'um I bought 3 box today').accuracy).toBe(1);
  });

  it('does not punish words that only differ in spelling', () => {
    const twister = 'How much wood would a woodchuck chuck';
    expect(alignRead(twister, 'how much would would a woodchuck chuck').accuracy).toBe(1);
    expect(alignRead('We threw it through there', 'we through it threw their').accuracy).toBe(1);
  });

  it('skips pause marks in the passage', () => {
    expect(alignRead('Stop. / Breathe. // Go on.', 'stop breathe go on').accuracy).toBe(1);
  });

  it('handles silence', () => {
    expect(alignRead(passage, '').accuracy).toBe(0);
  });
});
