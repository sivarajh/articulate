// Turns a captured take into numbers, scores, goal results and coaching notes.
//
// Scores are deliberately simple, transparent curves over well-known speaking metrics
// (fillers per minute, words per minute, hedges per 100 words…). They are a training aid,
// not a judgement: the point is that the same take always scores the same, so a better
// second attempt shows up as a better number.

import type {
  Analysis,
  Capture,
  CoachNote,
  DrillId,
  Exercise,
  Flag,
  Goal,
  GoalResult,
  Settings,
  SkillId,
} from '../types';
import { getFramework } from '../content/frameworks';
import { findFlags, weakCloser, weakOpener } from './flags';
import { alignRead, paceSeries, speakingWindow, stepCoverage, summarisePauses, variation } from './metrics';
import { mattr, tokenize, topContentWords } from './text';

const clamp = (x: number, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, x));

/** Piecewise-linear lookup through (x, y) points sorted by x; flat beyond the ends. */
export function curve(x: number, points: [number, number][]): number {
  const first = points[0]!;
  if (x <= first[0]) return first[1];
  for (let i = 1; i < points.length; i++) {
    const [x1, y1] = points[i]!;
    const [x0, y0] = points[i - 1]!;
    if (x <= x1) return y0 + ((x - x0) / (x1 - x0)) * (y1 - y0);
  }
  return points[points.length - 1]![1];
}

type Weights = Partial<Record<SkillId, number>>;

const SPEAKING: Weights = { fluency: 28, clarity: 20, structure: 20, pace: 14, vocabulary: 8, delivery: 10 };

/** How much each skill counts toward the overall score, per drill. */
export const WEIGHTS: Record<DrillId, Weights> = {
  impromptu: SPEAKING,
  custom: SPEAKING,
  framework: { structure: 34, fluency: 22, clarity: 16, pace: 12, vocabulary: 6, delivery: 10 },
  'hot-seat': { fluency: 34, clarity: 22, structure: 14, pace: 14, vocabulary: 6, delivery: 10 },
  'filler-free': { fluency: 60, pace: 15, clarity: 15, delivery: 10 },
  'shrink-it': { clarity: 40, fluency: 30, structure: 15, pace: 15 },
  taboo: { clarity: 45, fluency: 30, vocabulary: 15, pace: 10 },
  'word-bridge': { fluency: 35, structure: 25, clarity: 20, vocabulary: 10, pace: 10 },
  analogy: { clarity: 35, fluency: 30, structure: 15, vocabulary: 10, pace: 10 },
  'word-weave': { vocabulary: 40, fluency: 30, clarity: 20, pace: 10 },
  'pace-lock': { pace: 60, clarity: 25, delivery: 15 },
  // Pausing on purpose slows the word rate, so pace is deliberately not scored here.
  'power-pause': { delivery: 70, clarity: 30 },
  'tongue-twister': { clarity: 100 },
};

const MIN_WORDS = 12;

type AnalysisSettings = Pick<Settings, 'paceMin' | 'paceMax' | 'customFillers'>;

function emptyAnalysis(): Analysis {
  return {
    sufficient: false,
    words: 0,
    speakingSec: 0,
    wpm: null,
    paceSeries: [],
    paceCv: null,
    fillers: 0,
    fillersPerMin: 0,
    topFillers: [],
    hedges: 0,
    vague: 0,
    repeats: 0,
    signposts: 0,
    signpostKinds: [],
    weakOpen: null,
    weakClose: null,
    variety: null,
    topWords: [],
    startLatencySec: null,
    pauses: null,
    pitchSt: null,
    read: null,
    tabooHits: [],
    targetHits: [],
    targetMissed: [],
    steps: null,
    scores: {},
    overall: null,
    goals: [],
    notes: [],
  };
}

function tally(flags: Flag[], kind: Flag['kind']): [string, number][] {
  const counts = new Map<string, number>();
  for (const flag of flags) if (flag.kind === kind) counts.set(flag.label, (counts.get(flag.label) ?? 0) + 1);
  return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

const quote = (s: string) => `“${s}”`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;
const listOf = (items: string[]) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} and ${items[items.length - 1]}`;

export function analyze(capture: Capture, exercise: Exercise, settings: AnalysisSettings): Analysis {
  const a = emptyAnalysis();
  const tokens = tokenize(capture.transcript);
  const words = tokens.filter((t) => t.norm).map((t) => t.norm);
  const isRead = exercise.mode === 'read';
  const voice = capture.voice;

  a.words = words.length;
  const window = speakingWindow(capture);
  a.speakingSec = Math.max(0, (window.end - window.start) / 1000);
  const minutes = a.speakingSec / 60;

  // ---- delivery (works even without a transcript) ----
  a.pauses = summarisePauses(capture);
  a.pitchSt = voice?.pitchStdSemitones ?? null;
  if (voice?.firstSpeechMs != null) a.startLatencySec = Math.round(voice.firstSpeechMs / 100) / 10;
  else {
    const firstWord = capture.wordTimeline.find((s) => s.words > 0);
    if (firstWord) a.startLatencySec = Math.round(Math.max(0, firstWord.t - 600) / 100) / 10;
  }

  const deliveryParts: number[] = [];
  if (a.pauses && minutes > 0) {
    const deliberatePerMin = a.pauses.deliberate / minutes;
    let pauseScore = curve(deliberatePerMin, [
      [0, 45],
      [1, 65],
      [2, 82],
      [4, 95],
      [9, 95],
      [14, 78],
    ]);
    pauseScore -= Math.min(30, (a.pauses.long / minutes) * 10);
    if (a.pauses.silenceRatio > 0.45) pauseScore -= (a.pauses.silenceRatio - 0.45) * 100;
    deliveryParts.push(clamp(pauseScore));
  }
  if (a.pitchSt != null) {
    deliveryParts.push(
      curve(a.pitchSt, [
        [0.8, 35],
        [1.5, 55],
        [2.5, 78],
        [3.5, 92],
        [5, 100],
      ]),
    );
  }
  if (deliveryParts.length) {
    let delivery = deliveryParts.reduce((x, y) => x + y, 0) / deliveryParts.length;
    if (voice?.levelDbStd != null && voice.levelDbStd > 9) delivery -= Math.min(10, (voice.levelDbStd - 9) * 2);
    a.scores.delivery = Math.round(clamp(delivery));
  }

  // ---- not enough to work with ----
  if (!capture.transcriptAvailable) {
    a.sufficient = (voice?.speechMs ?? 0) >= 3000 && a.scores.delivery != null;
    if (a.sufficient) a.overall = a.scores.delivery!;
    a.goals = exercise.goals.map((g) => evaluateGoal(g, a, exercise, settings, false));
    a.notes = notesFor(exercise.drillId, buildNotes(a, exercise, settings, [], tokens.length));
    return a;
  }
  if (a.words < (isRead ? 3 : MIN_WORDS) || a.speakingSec < 2) {
    a.scores = {};
    a.goals = exercise.goals.map((g) => evaluateGoal(g, a, exercise, settings, false));
    return a;
  }
  a.sufficient = true;

  // ---- words ----
  const flags = findFlags(tokens, {
    customFillers: settings.customFillers,
    taboo: exercise.taboo,
    mustUse: exercise.mustUse,
  });
  const fillerTally = tally(flags, 'filler');
  a.topFillers = fillerTally.slice(0, 4);
  a.fillers = isRead ? 0 : fillerTally.reduce((n, [, c]) => n + c, 0);
  a.fillersPerMin = minutes > 0 ? a.fillers / minutes : 0;
  a.hedges = isRead ? 0 : flags.filter((f) => f.kind === 'hedge').length;
  a.vague = isRead ? 0 : flags.filter((f) => f.kind === 'vague').length;
  a.repeats = flags.filter((f) => f.kind === 'repeat').length;
  const signpostTally = tally(flags, 'signpost');
  a.signposts = signpostTally.reduce((n, [, c]) => n + c, 0);
  a.signpostKinds = signpostTally.map(([kind]) => kind);
  a.tabooHits = tally(flags, 'taboo').map(([w]) => w);
  a.targetHits = tally(flags, 'target').map(([w]) => w);
  a.targetMissed = (exercise.mustUse ?? []).filter((w) => !a.targetHits.includes(w.toLowerCase()));
  a.weakOpen = isRead ? null : weakOpener(tokens);
  a.weakClose = isRead ? null : weakCloser(tokens);
  a.variety = mattr(words);
  a.topWords = topContentWords(words);

  // ---- pace ----
  a.wpm = a.speakingSec >= 3 ? Math.round((a.words / a.speakingSec) * 60) : null;
  a.paceSeries = paceSeries(capture.wordTimeline, window.start, window.end);
  a.paceCv = variation(a.paceSeries.map((p) => p.wpm));
  if (a.wpm != null) {
    const { paceMin, paceMax } = settings;
    const off = a.wpm < paceMin ? paceMin - a.wpm : a.wpm > paceMax ? a.wpm - paceMax : 0;
    let pace = curve(off, [
      [0, 100],
      [10, 88],
      [25, 62],
      [50, 32],
      [80, 10],
    ]);
    if (a.paceCv != null && a.paceCv > 0.3) pace -= Math.min(15, (a.paceCv - 0.3) * 50);
    a.scores.pace = Math.round(clamp(pace));
  }

  if (isRead && exercise.readText) {
    // ---- read aloud: clarity is how much of the passage came through ----
    a.read = alignRead(exercise.readText, capture.transcript);
    a.scores.clarity = Math.round(
      curve(a.read.accuracy, [
        [0.4, 5],
        [0.7, 40],
        [0.85, 70],
        [0.95, 92],
        [1, 100],
      ]),
    );
  } else {
    const per100 = (n: number) => (n / a.words) * 100;

    // ---- fluency ----
    let fluency = curve(a.fillersPerMin, [
      [0, 100],
      [1, 93],
      [3, 76],
      [5, 60],
      [8, 40],
      [12, 20],
      [16, 6],
    ]);
    if (minutes > 0) fluency -= Math.min(20, (a.repeats / minutes) * 5);
    if (a.pauses && minutes > 0) fluency -= Math.min(20, (a.pauses.long / minutes) * 6);
    if (a.startLatencySec != null) {
      fluency -= curve(a.startLatencySec - readingAllowance(exercise), [
        [2.5, 0],
        [4, 5],
        [7, 12],
      ]);
    }
    a.scores.fluency = Math.round(clamp(fluency));

    // ---- clarity ----
    let clarity = 100;
    clarity -= curve(per100(a.hedges), [
      [0, 0],
      [1, 5],
      [3, 16],
      [6, 32],
      [10, 46],
    ]);
    clarity -= curve(per100(a.vague), [
      [0, 0],
      [1, 4],
      [3, 13],
      [6, 27],
      [10, 40],
    ]);
    clarity -= a.tabooHits.length * 14;
    a.scores.clarity = Math.round(clamp(clarity));

    // ---- structure ----
    const expectedKinds = a.words >= 120 ? 3 : a.words >= 60 ? 2 : 1;
    let structure = 45 + 35 * Math.min(1, a.signpostKinds.length / expectedKinds);
    if (!a.weakOpen) structure += 10;
    if (!a.weakClose) structure += 10;
    const framework = exercise.guided && exercise.frameworkId ? getFramework(exercise.frameworkId) : null;
    if (framework) {
      a.steps = stepCoverage(
        capture,
        framework.steps.map((s) => s.name),
      );
      const covered = a.steps.filter((s) => s.words >= STEP_MIN_WORDS).length / a.steps.length;
      const biggest = Math.max(...a.steps.map((s) => s.words)) / Math.max(1, a.words);
      const coverage = 100 * covered - (biggest > 0.7 ? 15 : 0);
      structure = 0.6 * coverage + 0.4 * structure;
    }
    a.scores.structure = Math.round(clamp(structure));

    // ---- vocabulary ----
    if (a.variety != null) {
      let vocabulary = curve(a.variety, [
        [0.5, 20],
        [0.6, 45],
        [0.68, 65],
        [0.75, 82],
        [0.82, 95],
        [0.88, 100],
      ]);
      const top = a.topWords[0];
      if (top && top[1] >= 5 && top[1] / a.words > 0.04) vocabulary -= 8;
      if (exercise.mustUse?.length) {
        vocabulary = 0.5 * vocabulary + 0.5 * (100 * (a.targetHits.length / exercise.mustUse.length));
      }
      a.scores.vocabulary = Math.round(clamp(vocabulary));
    } else if (exercise.mustUse?.length) {
      a.scores.vocabulary = Math.round(100 * (a.targetHits.length / exercise.mustUse.length));
    }
  }

  // ---- overall: weighted mean of the skills we could measure ----
  const weights = WEIGHTS[exercise.drillId];
  let total = 0;
  let weightSum = 0;
  for (const [skill, weight] of Object.entries(weights) as [SkillId, number][]) {
    const score = a.scores[skill];
    if (score == null) continue;
    total += score * weight;
    weightSum += weight;
  }
  // Only report the skills this drill is about.
  for (const skill of Object.keys(a.scores) as SkillId[]) if (weights[skill] == null) delete a.scores[skill];
  a.overall = weightSum > 0 ? Math.round(total / weightSum) : null;

  a.goals = exercise.goals.map((g) => evaluateGoal(g, a, exercise, settings, true));
  a.notes = notesFor(exercise.drillId, buildNotes(a, exercise, settings, flags, tokens.length));
  return a;
}

/**
 * With no prep time the question only appears when the clock starts, so the first
 * couple of seconds are spent reading it. Do not count those as hesitation.
 */
function readingAllowance(exercise: Exercise): number {
  return exercise.prepSec === 0 && exercise.mode === 'speak' ? 2 : 0;
}

/** A framework step counts as covered once it has roughly a sentence in it. */
export const STEP_MIN_WORDS = 6;

/** What a goal asks for, in words. */
export function goalLabel(goal: Goal, exercise: Exercise, settings: Pick<Settings, 'paceMin' | 'paceMax'>): string {
  switch (goal.type) {
    case 'maxFillers':
      return goal.max === 0 ? 'Zero filler words' : `No more than ${plural(goal.max, 'filler')}`;
    case 'minWords':
      return `Keep talking: at least ${goal.min} words`;
    case 'maxWords':
      return `Say it in ${goal.max} words or fewer`;
    case 'paceBand':
      return `Hold ${settings.paceMin}\u2013${settings.paceMax} words a minute`;
    case 'accuracy':
      return `At least ${Math.round(goal.min * 100)}% of words heard clearly`;
    case 'noTaboo':
      return 'Avoid every taboo word';
    case 'useWords':
      return (exercise.mustUse?.length ?? 0) === 2 ? 'Use both words' : `Use all ${exercise.mustUse?.length ?? 0} target words`;
    case 'pauses':
      return `Take at least ${plural(goal.min, 'deliberate pause')}`;
    case 'quickStart':
      return `Start speaking within ${goal.maxSec} seconds`;
    case 'coverSteps':
      return 'Cover every step';
  }
}

function evaluateGoal(
  goal: Goal,
  a: Analysis,
  exercise: Exercise,
  settings: AnalysisSettings,
  measurable: boolean,
): GoalResult {
  const label = goalLabel(goal, exercise, settings);
  const unknown: GoalResult = { label, met: false, detail: 'Not enough speech to tell' };
  switch (goal.type) {
    case 'maxFillers':
      if (!measurable) return unknown;
      return { label, met: a.fillers <= goal.max, detail: a.fillers === 0 ? 'None' : `You said ${a.fillers}` };
    case 'minWords':
      if (!measurable) return unknown;
      return { label, met: a.words >= goal.min, detail: `${a.words} words` };
    case 'maxWords':
      if (!measurable) return unknown;
      return { label, met: a.words <= goal.max, detail: `${a.words} words` };
    case 'paceBand':
      if (!measurable || a.wpm == null) return unknown;
      return { label, met: a.wpm >= settings.paceMin && a.wpm <= settings.paceMax, detail: `${a.wpm} wpm` };
    case 'accuracy':
      if (!measurable || !a.read) return unknown;
      return { label, met: a.read.accuracy >= goal.min, detail: `${Math.round(a.read.accuracy * 100)}%` };
    case 'noTaboo':
      if (!measurable) return unknown;
      return {
        label,
        met: a.tabooHits.length === 0,
        detail: a.tabooHits.length ? `Said ${listOf(a.tabooHits.map(quote))}` : 'Clean',
      };
    case 'useWords':
      if (!measurable) return unknown;
      return {
        label,
        met: a.targetMissed.length === 0,
        detail: a.targetMissed.length ? `Missed ${listOf(a.targetMissed.map(quote))}` : 'All used',
      };
    case 'pauses':
      if (!a.pauses) return { label, met: false, detail: 'Needs microphone analysis' };
      return { label, met: a.pauses.deliberate >= goal.min, detail: `${a.pauses.deliberate} taken` };
    case 'quickStart':
      if (a.startLatencySec == null) return unknown;
      return { label, met: a.startLatencySec <= goal.maxSec, detail: `${a.startLatencySec.toFixed(1)}s` };
    case 'coverSteps': {
      if (!measurable || !a.steps) return unknown;
      const skipped = a.steps.filter((s) => s.words < STEP_MIN_WORDS).map((s) => s.label);
      return { label, met: skipped.length === 0, detail: skipped.length ? `Thin: ${listOf(skipped)}` : 'All covered' };
    }
  }
}

function buildNotes(
  a: Analysis,
  exercise: Exercise,
  settings: AnalysisSettings,
  flags: Flag[],
  tokenCount: number,
): CoachNote[] {
  const notes: CoachNote[] = [];
  const fix = (skill: SkillId, weight: number, title: string, detail: string) =>
    notes.push({ tone: 'fix', skill, weight, title, detail });
  const win = (skill: SkillId, weight: number, title: string, detail: string) =>
    notes.push({ tone: 'win', skill, weight, title, detail });
  const isRead = exercise.mode === 'read';
  const per100 = (n: number) => (a.words > 0 ? (n / a.words) * 100 : 0);
  const { paceMin, paceMax } = settings;

  // ---- delivery notes need only the microphone ----
  if (a.pauses) {
    if (a.pauses.long > 0 && !isRead) {
      fix(
        'fluency',
        38 + 6 * a.pauses.long,
        `${plural(a.pauses.long, 'long stall')} (longest ${a.pauses.longestSec.toFixed(1)}s)`,
        'A silence past two and a half seconds mid-thought sounds lost. When you blank, bridge out loud — “The key point is…” — and keep moving.',
      );
    }
    if (a.pauses.deliberate === 0 && a.speakingSec > 25) {
      fix(
        'delivery',
        30,
        'No breathing room',
        'You never stopped for more than half a second. Put one full beat of silence after your most important sentence so it can land.',
      );
    } else if (a.pauses.deliberate >= 2 && a.pauses.long === 0) {
      win(
        'delivery',
        24,
        'Purposeful pauses',
        `${plural(a.pauses.deliberate, 'clean pause')} and no stalls. Silence is doing work for you.`,
      );
    }
  }
  if (a.pitchSt != null) {
    if (a.pitchSt < 1.6) {
      fix(
        'delivery',
        28,
        'Flat delivery',
        'Your pitch barely moved. Choose one word in each sentence to lean on, and let your voice fall at the end of a statement.',
      );
    } else if (a.pitchSt >= 3) {
      win('delivery', 18, 'Expressive voice', 'Your pitch moved with your meaning, which keeps a listener with you.');
    }
  }

  if (!a.sufficient || !a.words) return sortNotes(notes);

  // ---- pace ----
  if (a.wpm != null) {
    if (a.wpm > paceMax + 8) {
      fix(
        'pace',
        50 + Math.min(40, (a.wpm - paceMax) / 2),
        `Fast: ${a.wpm} words a minute`,
        `Your target is ${paceMin}–${paceMax}. Finish the sentence, breathe, then start the next one. The gap is where your listener catches up.`,
      );
    } else if (a.wpm < paceMin - 8) {
      fix(
        'pace',
        46 + Math.min(40, (paceMin - a.wpm) / 2),
        `Slow: ${a.wpm} words a minute`,
        `Your target is ${paceMin}–${paceMax}. Slow works for emphasis, but sustained it sounds unsure. Know how the sentence ends before you start it, then say it in one run.`,
      );
    } else if (a.wpm >= paceMin && a.wpm <= paceMax) {
      win('pace', 20, `On pace at ${a.wpm} wpm`, 'Comfortably inside your target range.');
    }
    if (a.paceCv != null && a.paceCv > 0.38) {
      fix(
        'pace',
        34,
        'Uneven pace',
        'You sped up and slowed down a lot. Rushes usually mark the parts you are least sure of — slow down exactly there.',
      );
    }
  }

  if (isRead) {
    if (a.read) {
      const pct = Math.round(a.read.accuracy * 100);
      if (a.read.accuracy < 0.95) {
        const sample = [...new Set(a.read.missed)].slice(0, 5).map(quote);
        fix(
          'clarity',
          a.read.accuracy < 0.9 ? 60 : 35,
          `${pct}% of the words came through`,
          `Not heard: ${listOf(sample)}. Hit the consonants at the ends of words and slow down through the clusters that trip you.`,
        );
      } else {
        win('clarity', 30, 'Crisp diction', `${pct}% of the passage was heard exactly as written.`);
      }
    }
    return sortNotes(notes);
  }

  // ---- fluency ----
  if (a.fillers >= 2 && a.fillersPerMin > 1.5) {
    const top = a.topFillers[0]![0];
    const every = Math.max(1, Math.round(a.speakingSec / a.fillers));
    fix(
      'fluency',
      60 + Math.min(38, a.fillersPerMin * 4),
      `${a.fillers} fillers — mostly ${quote(top)}`,
      `That is one every ${every} seconds. When you feel ${quote(top)} coming, close your mouth and let a silent beat take its place. Silence reads as composure; a filler reads as searching.`,
    );
  } else if (a.fillers === 0 && a.words >= 40) {
    win('fluency', 34, 'Zero fillers', 'Clean from the first word to the last.');
  } else if (a.fillersPerMin <= 1.5 && a.words >= 40) {
    win('fluency', 22, 'Nearly filler-free', `Only ${plural(a.fillers, 'filler')} in the whole take.`);
  }
  if (a.repeats >= 2) {
    fix(
      'fluency',
      32 + Math.min(20, a.repeats * 4),
      `${plural(a.repeats, 'restart')}`,
      'You doubled back on words mid-sentence. Slow your first three words down; the rest of the sentence follows more easily once it has started well.',
    );
  }
  if (a.startLatencySec != null && exercise.prepSec === 0 && a.startLatencySec > 3 + readingAllowance(exercise)) {
    fix(
      'fluency',
      36,
      `${a.startLatencySec.toFixed(1)}s before your first word`,
      'Buy thinking time out loud. Restate the question as your opening sentence — it sounds deliberate and gives you a few seconds.',
    );
  }

  // ---- clarity ----
  const hedgeTally = tally(flags, 'hedge');
  if (a.hedges >= 2 && per100(a.hedges) > 2) {
    fix(
      'clarity',
      44 + Math.min(30, per100(a.hedges) * 4),
      `${plural(a.hedges, 'hedge')} softened your point`,
      `Phrases such as ${quote(hedgeTally[0]![0])} ask permission to have a view. Say it flat: “We should…”, not “I think maybe we should…”.`,
    );
  } else if (a.hedges === 0 && a.words >= 50) {
    win('clarity', 26, 'Direct language', 'No hedging. You said what you meant.');
  }
  const vagueTally = tally(flags, 'vague');
  if (a.vague >= 3 && per100(a.vague) > 2.5) {
    const worst = vagueTally.slice(0, 2).map(([w]) => quote(w));
    fix(
      'clarity',
      36 + Math.min(26, per100(a.vague) * 3),
      `${a.vague} vague or empty words`,
      `You leaned on ${listOf(worst)}. Name the actual noun, and trade “very good” for one exact word.`,
    );
  }
  if (a.tabooHits.length) {
    fix(
      'clarity',
      70,
      `Said ${plural(a.tabooHits.length, 'taboo word')}`,
      `${listOf(a.tabooHits.map(quote))} slipped out. Slow down and describe what it does, where you find it, or what it is like.`,
    );
  }
  if (a.targetMissed.length) {
    fix(
      'vocabulary',
      58,
      `Missed ${plural(a.targetMissed.length, 'target word')}`,
      `You did not use ${listOf(a.targetMissed.map(quote))}. Decide which sentence each word belongs in before you start.`,
    );
  }

  // ---- structure ----
  if (a.steps) {
    const thin = a.steps.filter((s) => s.words < STEP_MIN_WORDS).map((s) => s.label);
    if (thin.length) {
      fix(
        'structure',
        56,
        `Thin on ${listOf(thin)}`,
        'Each step needs at least one full sentence. A skipped step is usually where your answer stops being convincing.',
      );
    } else {
      win('structure', 30, 'Every step covered', 'You moved through the whole framework.');
    }
  }
  if (a.weakOpen) {
    fix(
      'structure',
      40,
      `Opened with ${quote(a.weakOpen)}`,
      'Your first five words set the tone. Open on the answer itself, or restate the question, and drop the wind-up.',
    );
  } else if (a.startLatencySec != null && a.startLatencySec <= 2 && a.words >= 40) {
    win('structure', 16, 'Confident start', 'You began promptly and with substance.');
  }
  if (a.weakClose) {
    fix(
      'structure',
      42,
      `Trailed off with ${quote(a.weakClose)}`,
      'End on purpose. Restate your main point in one sentence, then stop talking.',
    );
  } else if (flags.some((f) => f.kind === 'signpost' && f.label === 'summary' && f.start >= tokenCount - 35)) {
    win('structure', 26, 'Landed the ending', 'You closed by pulling your point together.');
  }
  if (a.signpostKinds.length === 0 && a.words >= 60) {
    fix(
      'structure',
      44,
      'No signposts',
      'Your listener cannot see your outline, so say it out loud: “Two reasons. First…”, “For example…”, “So the point is…”.',
    );
  } else if (a.signpostKinds.length >= 3) {
    win(
      'structure',
      28,
      'Clear signposting',
      `You marked ${listOf(a.signpostKinds.slice(0, 3))} out loud, so the shape of your answer was easy to follow.`,
    );
  }

  // ---- vocabulary ----
  if (a.variety != null && a.words >= 60) {
    if (a.variety < 0.64) {
      const top = a.topWords[0];
      fix(
        'vocabulary',
        26,
        'Repetitive wording',
        top
          ? `You said ${quote(top[0])} ${top[1]} times. Before the next take, line up two other ways to say it.`
          : 'You circled the same small set of words. Before the next take, line up two fresh ways to say your key idea.',
      );
    } else if (a.variety >= 0.8) {
      win('vocabulary', 18, 'Varied vocabulary', 'You rarely reached for the same word twice.');
    }
  }

  return sortNotes(notes);
}

function sortNotes(notes: CoachNote[]): CoachNote[] {
  return notes.sort((x, y) => y.weight - x.weight);
}

/** A drill only coaches the skills it is about: a diction drill does not nag about pace. */
function notesFor(drillId: DrillId, notes: CoachNote[]): CoachNote[] {
  const weights = WEIGHTS[drillId];
  return notes.filter((note) => weights[note.skill] != null);
}

/** One-word verdict for a score. */
export function scoreBand(score: number): { label: string; level: 'good' | 'ok' | 'warn' | 'bad' } {
  if (score >= 85) return { label: 'Sharp', level: 'good' };
  if (score >= 70) return { label: 'Solid', level: 'ok' };
  if (score >= 55) return { label: 'Getting there', level: 'warn' };
  return { label: 'Needs work', level: 'bad' };
}
