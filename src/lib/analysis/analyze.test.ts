import { describe, expect, it } from 'vitest';
import type { Capture, Exercise, VoiceStats } from '../types';
import { analyze, curve, scoreBand } from './analyze';
import { countWords } from './text';

const settings = { paceMin: 130, paceMax: 165, customFillers: [] as string[] };

function exercise(over: Partial<Exercise> = {}): Exercise {
  return {
    id: 'x',
    drillId: 'impromptu',
    title: 'Impromptu',
    tag: 'Test',
    prompt: 'Why should we hire you?',
    prepSec: 0,
    speakSec: 60,
    mode: 'speak',
    goals: [],
    ...over,
  };
}

/** A capture of `text` spoken evenly at `wpm`, starting after `leadMs` of thinking. */
function spoken(text: string, wpm: number, over: Partial<Capture> = {}, leadMs = 800): Capture {
  const words = countWords(text);
  const speakMs = (words / wpm) * 60000;
  const steps = Math.max(1, Math.round(speakMs / 1000));
  const wordTimeline = Array.from({ length: steps + 1 }, (_, i) => ({
    t: leadMs + (i / steps) * speakMs,
    words: (i / steps) * words,
  }));
  const voice: VoiceStats = {
    speechMs: speakMs * 0.85,
    firstSpeechMs: leadMs,
    lastSpeechMs: leadMs + speakMs,
    pauses: [],
    levelDbMean: -22,
    levelDbStd: 4,
    pitchMedianHz: 140,
    pitchStdSemitones: 2.8,
    voicedFrames: 400,
    levels: [],
  };
  return {
    transcript: text,
    transcriptAvailable: true,
    segments: [],
    wordTimeline,
    durationMs: leadMs + speakMs + 500,
    voice,
    stepMarks: [],
    ...over,
  };
}

const STRONG =
  'You should hire me because I turn messy problems into shipped products. First, I have led three launches ' +
  'from a blank page to paying customers, the latest reaching forty thousand users in six months. Second, I ' +
  'make teams faster. For example, at my last company I cut our release cycle from three weeks to four days ' +
  'by rebuilding how we test. However, the real reason is fit. Your roadmap depends on moving quickly without ' +
  'breaking trust, and that balance is exactly what I have practised for eight years. In short, I bring a ' +
  'record of delivery, a habit of speed, and the judgement to protect your customers while we grow.';

const WEAK =
  'Um so I think I would be like a good fit because um I kind of have a lot of experience with stuff like ' +
  'this and you know I really like working with people and um I guess I am pretty good at things like ' +
  'projects and I I think that basically I would just sort of work really hard and um yeah I mean I ' +
  'actually did a lot of things at my last job and stuff so maybe that helps and uh yeah I think that is ' +
  "pretty much it so yeah";

describe('curve', () => {
  it('interpolates and clamps', () => {
    const points: [number, number][] = [
      [0, 100],
      [10, 50],
    ];
    expect(curve(-5, points)).toBe(100);
    expect(curve(5, points)).toBe(75);
    expect(curve(50, points)).toBe(50);
  });
});

describe('analyze', () => {
  it('rates a clean, structured answer highly', () => {
    const base = spoken(STRONG, 150);
    const paused: Capture = {
      ...base,
      voice: { ...base.voice!, pauses: [{ start: 9000, end: 9800 }, { start: 21000, end: 22000 }, { start: 33000, end: 33900 }] },
    };
    const a = analyze(paused, exercise(), settings);
    expect(a.sufficient).toBe(true);
    expect(a.wpm).toBeGreaterThanOrEqual(148);
    expect(a.wpm).toBeLessThanOrEqual(152);
    expect(a.fillers).toBe(0);
    expect(a.signpostKinds).toEqual(expect.arrayContaining(['sequence', 'cause', 'example', 'contrast', 'summary']));
    expect(a.scores.fluency).toBeGreaterThanOrEqual(95);
    expect(a.scores.pace).toBe(100);
    expect(a.scores.structure).toBe(100);
    expect(a.scores.clarity).toBeGreaterThanOrEqual(95);
    expect(a.scores.vocabulary).toBeGreaterThanOrEqual(75);
    expect(a.overall).toBeGreaterThanOrEqual(85);
    expect(a.notes.filter((n) => n.tone === 'fix').map((n) => n.title)).toEqual([]);
    expect(a.notes.map((n) => n.title)).toEqual(
      expect.arrayContaining(['Zero fillers', 'Clear signposting', 'Landed the ending', 'Purposeful pauses']),
    );
  });

  it('asks for breathing room when a long take never pauses', () => {
    const a = analyze(spoken(STRONG, 150), exercise(), settings);
    expect(a.notes.filter((n) => n.tone === 'fix').map((n) => n.title)).toEqual(['No breathing room']);
  });

  it('rates a rambling, filler-heavy answer poorly and says why', () => {
    const a = analyze(spoken(WEAK, 185), exercise(), settings);
    expect(a.fillers).toBeGreaterThanOrEqual(9);
    expect(a.topFillers[0]![0]).toBe('um');
    expect(a.hedges).toBeGreaterThanOrEqual(4);
    expect(a.vague).toBeGreaterThanOrEqual(4);
    expect(a.repeats).toBe(1);
    expect(a.weakOpen).toBe('um');
    expect(a.weakClose).toBe('so yeah');
    expect(a.scores.fluency).toBeLessThan(40);
    expect(a.scores.clarity).toBeLessThan(60);
    expect(a.scores.pace).toBeLessThan(80);
    expect(a.overall).toBeLessThan(55);

    const fixes = a.notes.filter((n) => n.tone === 'fix');
    // The biggest problem comes first.
    expect(fixes[0]!.skill).toBe('fluency');
    expect(fixes[0]!.title).toMatch(/fillers/);
    expect(fixes.map((n) => n.title).join(' | ')).toMatch(/Fast: \d+ words a minute/);
    expect(fixes.map((n) => n.title)).toEqual(expect.arrayContaining(['Opened with “um”', 'Trailed off with “so yeah”']));
  });

  it('scores the strong answer well above the weak one', () => {
    const strong = analyze(spoken(STRONG, 150), exercise(), settings).overall!;
    const weak = analyze(spoken(WEAK, 185), exercise(), settings).overall!;
    expect(strong - weak).toBeGreaterThan(35);
  });

  it('refuses to score a take with almost no speech', () => {
    const a = analyze(spoken('yes I agree', 120), exercise(), settings);
    expect(a.sufficient).toBe(false);
    expect(a.overall).toBeNull();
    expect(a.scores).toEqual({});
  });

  it('falls back to delivery only when there is no transcript', () => {
    const capture = spoken(STRONG, 150, { transcript: '', transcriptAvailable: false, wordTimeline: [] });
    const a = analyze(capture, exercise(), settings);
    expect(a.sufficient).toBe(true);
    expect(a.wpm).toBeNull();
    expect(Object.keys(a.scores)).toEqual(['delivery']);
    expect(a.overall).toBe(a.scores.delivery);
  });

  it('penalises a slow start only when there was no prep time', () => {
    const late = spoken(STRONG, 150, {}, 6000);
    const cold = analyze(late, exercise({ prepSec: 0 }), settings);
    expect(cold.startLatencySec).toBe(6);
    // Four seconds is fine: about two of them go on reading the question.
    const quick = analyze(spoken(STRONG, 150, {}, 4000), exercise({ prepSec: 0 }), settings);
    expect(quick.notes.some((n) => /before your first word/.test(n.title))).toBe(false);
    expect(cold.notes.some((n) => /before your first word/.test(n.title))).toBe(true);
    const prepped = analyze(late, exercise({ prepSec: 30 }), settings);
    expect(prepped.notes.some((n) => /before your first word/.test(n.title))).toBe(false);
  });

  it('respects the pace target from settings', () => {
    const capture = spoken(STRONG, 185);
    expect(analyze(capture, exercise(), settings).scores.pace).toBeLessThan(80);
    expect(analyze(capture, exercise(), { ...settings, paceMin: 160, paceMax: 195 }).scores.pace).toBe(100);
  });
});

describe('goals', () => {
  it('checks filler and word-count targets', () => {
    const drill = exercise({
      drillId: 'filler-free',
      goals: [{ type: 'maxFillers', max: 0 }, { type: 'minWords', min: 80 }, { type: 'paceBand' }],
    });
    const clean = analyze(spoken(STRONG, 150), drill, settings);
    expect(clean.goals.map((g) => g.met)).toEqual([true, true, true]);
    const messy = analyze(spoken(WEAK, 185), drill, settings);
    expect(messy.goals.map((g) => g.met)).toEqual([false, true, false]);
    expect(messy.goals[0]!.detail).toMatch(/You said \d+/);
  });

  it('checks taboo words', () => {
    const drill = exercise({ drillId: 'taboo', prompt: 'Coffee', taboo: ['drink', 'bean', 'cup', 'caffeine', 'morning'], goals: [{ type: 'noTaboo' }] });
    const text = 'It is a dark bitter liquid that people rely on to wake up and it is brewed from roasted beans all over the world';
    const a = analyze(spoken(text, 150), drill, settings);
    expect(a.tabooHits).toEqual(['bean']);
    expect(a.goals[0]).toMatchObject({ met: false, detail: 'Said “bean”' });
    expect(a.notes[0]!.title).toBe('Said 1 taboo word');
  });

  it('checks target words', () => {
    const drill = exercise({ drillId: 'word-weave', mustUse: ['catalyst', 'pragmatic', 'nuance'], goals: [{ type: 'useWords' }] });
    const text = 'The new manager was a catalyst for change because she took a pragmatic view of every decision and she never let the team argue in circles for long';
    const a = analyze(spoken(text, 150), drill, settings);
    expect(a.targetHits).toEqual(['catalyst', 'pragmatic']);
    expect(a.targetMissed).toEqual(['nuance']);
    expect(a.goals[0]!.met).toBe(false);
  });

  it('checks deliberate pauses and a quick start', () => {
    const base = spoken(STRONG, 150);
    const capture: Capture = {
      ...base,
      voice: { ...base.voice!, pauses: [{ start: 5000, end: 5900 }, { start: 12000, end: 13100 }] },
    };
    const drill = exercise({ goals: [{ type: 'pauses', min: 2 }, { type: 'quickStart', maxSec: 2 }] });
    const a = analyze(capture, drill, settings);
    expect(a.pauses!.deliberate).toBe(2);
    expect(a.goals.map((g) => g.met)).toEqual([true, true]);
  });
});

describe('guided frameworks', () => {
  const text =
    'My view is that we should buy the tool. The main reason is speed because it is live in a month. ' +
    'For example the last team that built their own took half a year. So that is why we should buy.';
  const drill = exercise({ drillId: 'framework', frameworkId: 'prep', guided: true, goals: [{ type: 'coverSteps' }] });

  it('measures each step when the speaker advances through all of them', () => {
    const base = spoken(text, 150, {}, 0);
    const d = base.durationMs;
    const a = analyze({ ...base, stepMarks: [d * 0.22, d * 0.5, d * 0.78] }, drill, settings);
    expect(a.steps!.map((s) => s.label)).toEqual(['Point', 'Reason', 'Example', 'Point']);
    for (const step of a.steps!) expect(step.words).toBeGreaterThanOrEqual(6);
    expect(a.goals[0]!.met).toBe(true);
    expect(a.scores.structure).toBeGreaterThanOrEqual(85);
  });

  it('flags steps that were skipped', () => {
    const a = analyze(spoken(text, 150, {}, 0), drill, settings);
    expect(a.goals[0]).toMatchObject({ met: false, detail: 'Thin: Reason, Example and Point' });
    expect(a.scores.structure).toBeLessThan(60);
    expect(a.notes.some((n) => n.title.startsWith('Thin on'))).toBe(true);
  });
});

describe('read-aloud drills', () => {
  const passage = 'Peter Piper picked a peck of pickled peppers. A peck of pickled peppers Peter Piper picked.';
  const drill = exercise({ drillId: 'tongue-twister', mode: 'read', readText: passage, goals: [{ type: 'accuracy', min: 0.9 }] });

  it('scores accuracy, not fillers or structure', () => {
    const a = analyze(spoken('peter piper picked a peck of pickled peppers a peck of pickled peppers peter piper picked', 140), drill, settings);
    expect(a.read!.accuracy).toBe(1);
    expect(Object.keys(a.scores)).toEqual(['clarity']);
    expect(a.overall).toBe(100);
    expect(a.goals[0]!.met).toBe(true);
  });

  it('does not coach skills the drill is not about', () => {
    const slow = analyze(spoken('peter piper picked a peck of pickled peppers a peck of pickled peppers peter piper picked', 80), drill, settings);
    expect(slow.wpm).toBeLessThan(100);
    expect(slow.notes.map((n) => n.skill)).toEqual(['clarity']);
    expect(slow.notes[0]!.title).toBe('Crisp diction');
  });

  it('does not penalise the slow word rate that deliberate pausing causes', () => {
    const passage = 'Listen. // That silence you just heard / is the most useful tool a speaker has. // It costs nothing.';
    const pauseDrill = exercise({ drillId: 'power-pause', mode: 'read', readText: passage, goals: [{ type: 'pauses', min: 2 }] });
    const base = spoken('listen that silence you just heard is the most useful tool a speaker has it costs nothing', 70);
    const capture: Capture = {
      ...base,
      voice: { ...base.voice!, pauses: [{ start: 2000, end: 3400 }, { start: 6000, end: 6800 }, { start: 11000, end: 12500 }] },
    };
    const a = analyze(capture, pauseDrill, settings);
    expect(a.scores.pace).toBeUndefined();
    expect(a.notes.some((n) => n.skill === 'pace')).toBe(false);
    expect(a.goals[0]!.met).toBe(true);
    expect(a.overall).toBeGreaterThanOrEqual(85);
  });

  it('reports the words that did not come through', () => {
    const a = analyze(spoken('peter piper picked a pack of pickle peppers a peck of pickled papers peter piper', 140), drill, settings);
    expect(a.read!.accuracy).toBeLessThan(0.9);
    expect(a.goals[0]!.met).toBe(false);
    expect(a.notes[0]!.detail).toMatch(/Not heard:/);
  });
});

describe('scoreBand', () => {
  it('labels scores', () => {
    expect(scoreBand(90).label).toBe('Sharp');
    expect(scoreBand(72).label).toBe('Solid');
    expect(scoreBand(60).label).toBe('Getting there');
    expect(scoreBand(30).label).toBe('Needs work');
  });
});
