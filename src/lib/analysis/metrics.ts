// Timing metrics: pace over time, pauses, per-step coverage, and read-aloud accuracy.

import type { Capture, PacePoint, PauseSummary, ReadResult, StepCoverage, WordSample } from '../types';
import { normalizeWord, stem } from './text';

/** Cumulative words at time t, interpolating between the recogniser's updates. */
export function wordsAt(timeline: WordSample[], t: number): number {
  if (timeline.length === 0 || t <= 0) return 0;
  let before: WordSample = { t: 0, words: 0 };
  for (const sample of timeline) {
    if (sample.t >= t) {
      const span = sample.t - before.t;
      if (span <= 0) return sample.words;
      return before.words + ((t - before.t) / span) * (sample.words - before.words);
    }
    before = sample;
  }
  return before.words;
}

/**
 * The stretch of the take the speaker was actually talking for, in ms.
 * Thinking time before the first word and dead air after the last are not held against pace.
 */
export function speakingWindow(capture: Capture): { start: number; end: number } {
  const { voice, wordTimeline, durationMs } = capture;
  const firstWord = wordTimeline.find((s) => s.words > 0);
  const lastWord = wordTimeline[wordTimeline.length - 1];
  // Recognition results trail the voice by roughly half a second.
  const start = voice?.firstSpeechMs ?? (firstWord ? Math.max(0, firstWord.t - 600) : 0);
  const rawEnd = voice?.lastSpeechMs != null ? voice.lastSpeechMs + 300 : lastWord ? lastWord.t : durationMs;
  const end = Math.min(durationMs, Math.max(rawEnd, start));
  return { start, end: end > start ? end : durationMs };
}

/** Words per minute in a sliding window, for the pace chart. Empty when the take is too short. */
export function paceSeries(
  timeline: WordSample[],
  startMs: number,
  endMs: number,
  windowMs = 12000,
  stepMs = 4000,
): PacePoint[] {
  const points: PacePoint[] = [];
  if (endMs - startMs < windowMs + 2 * stepMs) return points;
  for (let t = startMs + windowMs; t <= endMs + 1; t += stepMs) {
    const spoken = wordsAt(timeline, t) - wordsAt(timeline, t - windowMs);
    points.push({ t: Math.round(t / 100) / 10, wpm: Math.round((spoken / windowMs) * 60000) });
  }
  return points;
}

/** Coefficient of variation: how much pace swings relative to its average. */
export function variation(values: number[]): number | null {
  if (values.length < 4) return null;
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  if (mean <= 0) return null;
  const variance = values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length;
  return Math.sqrt(variance) / mean;
}

export const DELIBERATE_PAUSE_MS = 600;
export const LONG_PAUSE_MS = 2500;

/** Classify the silences inside the speaking window. */
export function summarisePauses(capture: Capture): PauseSummary | null {
  const voice = capture.voice;
  if (!voice || voice.firstSpeechMs == null || voice.lastSpeechMs == null) return null;
  const span = voice.lastSpeechMs - voice.firstSpeechMs;
  if (span < 2000) return null;
  let deliberate = 0;
  let long = 0;
  let longest = 0;
  let silence = 0;
  for (const pause of voice.pauses) {
    if (pause.start < voice.firstSpeechMs || pause.end > voice.lastSpeechMs + 50) continue;
    const length = pause.end - pause.start;
    silence += length;
    longest = Math.max(longest, length);
    if (length >= LONG_PAUSE_MS) long++;
    else if (length >= DELIBERATE_PAUSE_MS) deliberate++;
  }
  return {
    deliberate,
    long,
    longestSec: Math.round(longest / 100) / 10,
    silenceRatio: Math.min(1, silence / span),
  };
}

/** Words and time spent in each framework step, from the moments the speaker advanced. */
export function stepCoverage(capture: Capture, labels: string[]): StepCoverage[] {
  // Recognition lags the voice, so words said just before pressing "next" arrive a beat late.
  const LAG = 700;
  const bounds = [0, ...capture.stepMarks.slice(0, labels.length - 1), capture.durationMs];
  return labels.map((label, i) => {
    const from = bounds[i];
    const to = bounds[i + 1];
    if (from == null || to == null) return { label, words: 0, sec: 0 };
    const last = i === labels.length - 1;
    const words =
      wordsAt(capture.wordTimeline, last ? Infinity : to + LAG) - wordsAt(capture.wordTimeline, i === 0 ? 0 : from + LAG);
    return { label, words: Math.max(0, Math.round(words)), sec: Math.round((to - from) / 100) / 10 };
  });
}

// ---------- read-aloud accuracy ----------

const NUMBER_WORDS: Record<string, string> = {
  '0': 'zero',
  '1': 'one',
  '2': 'two',
  '3': 'three',
  '4': 'four',
  '5': 'five',
  '6': 'six',
  '7': 'seven',
  '8': 'eight',
  '9': 'nine',
  '10': 'ten',
  '11': 'eleven',
  '12': 'twelve',
};

/**
 * Words a recogniser cannot tell apart by sound. A reader who says "wood" should not be
 * marked wrong because the transcript says "would".
 */
const HOMOPHONES: Record<string, string> = {};
for (const group of [
  'would wood',
  'weather whether',
  'see sea',
  'there their they\'re',
  'to too two',
  'for four fore',
  'by buy bye',
  'no know',
  'right write',
  'here hear',
  'one won',
  'eight ate',
  'sun son',
  'its it\'s',
  'your you\'re',
  'peace piece',
  'whole hole',
  'new knew',
  'red read',
  'our hour',
  'sells cells',
  'seas sees seize',
  'bear bare',
  'bread bred',
  'but butt',
  'be bee',
  'which witch',
  'where wear',
  'through threw',
  'throne thrown',
  'weak week',
  'meet meat',
  'wait weight',
  'plane plain',
]) {
  const [head, ...rest] = group.split(' ');
  for (const word of rest) HOMOPHONES[word] = head!;
}

function canonical(word: string): string {
  const norm = normalizeWord(word);
  const spelled = NUMBER_WORDS[norm] ?? norm;
  return stem(HOMOPHONES[spelled] ?? spelled);
}

/** Split a passage into the words a reader is expected to say (pause marks and dashes are skipped). */
export function passageWords(text: string): string[] {
  return text.split(/\s+/).filter((w) => normalizeWord(w) !== '');
}

/**
 * Align what was heard against the passage (edit-distance alignment over words)
 * and report which passage words were heard.
 */
export function alignRead(passage: string, heardText: string): ReadResult {
  const targetRaw = passageWords(passage);
  const target = targetRaw.map(canonical);
  const heard = passageWords(heardText).map(canonical);
  const n = target.length;
  const m = heard.length;
  const hits = new Array<boolean>(n).fill(false);
  if (n === 0) return { accuracy: 0, hits, missed: [] };

  // cost[i][j] = edits to turn the first j heard words into the first i passage words
  const width = m + 1;
  const cost = new Uint16Array((n + 1) * width);
  for (let j = 0; j <= m; j++) cost[j] = j;
  for (let i = 1; i <= n; i++) {
    cost[i * width] = i;
    for (let j = 1; j <= m; j++) {
      const same = target[i - 1] === heard[j - 1];
      const diagonal = cost[(i - 1) * width + (j - 1)]! + (same ? 0 : 1);
      const skipTarget = cost[(i - 1) * width + j]! + 1;
      const skipHeard = cost[i * width + (j - 1)]! + 1;
      cost[i * width + j] = Math.min(diagonal, skipTarget, skipHeard);
    }
  }

  let i = n;
  let j = m;
  while (i > 0 && j > 0) {
    const here = cost[i * width + j]!;
    const same = target[i - 1] === heard[j - 1];
    if (here === cost[(i - 1) * width + (j - 1)]! + (same ? 0 : 1)) {
      if (same) hits[i - 1] = true;
      i--;
      j--;
    } else if (here === cost[(i - 1) * width + j]! + 1) {
      i--;
    } else {
      j--;
    }
  }

  const hitCount = hits.filter(Boolean).length;
  const missed = targetRaw.filter((_, k) => !hits[k]).map((w) => normalizeWord(w));
  return { accuracy: hitCount / n, hits, missed };
}
