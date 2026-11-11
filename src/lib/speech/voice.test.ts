import { describe, expect, it } from 'vitest';
import { VoiceAnalyzer, detectPitch, rmsDb } from './voice';

const RATE = 48000;
const FRAME = 2048;
const STEP_MS = 50;

/** A harmonic-rich tone, closer to a voice than a pure sine. */
function tone(hz: number, amplitude = 0.2, phase = 0): Float32Array {
  const out = new Float32Array(FRAME);
  for (let i = 0; i < FRAME; i++) {
    const t = (i + phase) / RATE;
    out[i] = amplitude * (Math.sin(2 * Math.PI * hz * t) + 0.5 * Math.sin(4 * Math.PI * hz * t));
  }
  return out;
}

function noise(amplitude = 0.0005): Float32Array {
  const out = new Float32Array(FRAME);
  let seed = 1234;
  for (let i = 0; i < FRAME; i++) {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    out[i] = amplitude * ((seed / 0x7fffffff) * 2 - 1);
  }
  return out;
}

/** Run a script of [durationMs, frame factory] segments through an analyzer. */
function run(script: [number, (t: number) => Float32Array][]) {
  const analyzer = new VoiceAnalyzer(RATE);
  let t = 0;
  for (const [duration, make] of script) {
    const end = t + duration;
    for (; t < end; t += STEP_MS) analyzer.process(make(t), t);
  }
  return analyzer.finish();
}

describe('rmsDb', () => {
  it('measures level in decibels', () => {
    expect(rmsDb(new Float32Array(100).fill(1))).toBeCloseTo(0);
    expect(rmsDb(new Float32Array(100).fill(0.1))).toBeCloseTo(-20);
    expect(rmsDb(new Float32Array(100))).toBe(-100);
  });
});

describe('detectPitch', () => {
  it('finds the fundamental of a voiced frame', () => {
    expect(detectPitch(tone(120), RATE)!).toBeCloseTo(120, 0);
    expect(detectPitch(tone(220), RATE)!).toBeCloseTo(220, 0);
  });

  it('returns null for noise and silence', () => {
    expect(detectPitch(noise(0.1), RATE)).toBeNull();
    expect(detectPitch(new Float32Array(FRAME), RATE)).toBeNull();
  });
});

describe('VoiceAnalyzer', () => {
  it('finds when speech starts, where the pauses are, and when it ends', () => {
    const stats = run([
      [1000, () => noise()],
      [3000, () => tone(150)],
      [1000, () => noise()], // deliberate pause
      [2000, () => tone(150)],
      [200, () => noise()], // too short to be a pause
      [2000, () => tone(150)],
      [1500, () => noise()],
    ]);
    expect(stats.firstSpeechMs).toBe(1000);
    expect(stats.lastSpeechMs).toBe(9150);
    expect(stats.pauses).toEqual([{ start: 4000, end: 5000 }]);
    expect(stats.speechMs).toBeGreaterThan(6500);
    expect(stats.speechMs).toBeLessThan(7300);
    expect(stats.levels.length).toBeGreaterThan(40);
  });

  it('reports no speech in a silent room', () => {
    const stats = run([[3000, () => noise()]]);
    expect(stats.firstSpeechMs).toBeNull();
    expect(stats.speechMs).toBe(0);
    expect(stats.pitchStdSemitones).toBeNull();
  });

  it('measures a monotone voice as flat and a moving voice as varied', () => {
    const flat = run([[4000, () => tone(140)]]);
    expect(flat.pitchMedianHz).toBeCloseTo(140, -1);
    expect(flat.pitchStdSemitones!).toBeLessThan(0.3);

    // Sweep between 110 and 190 Hz every second.
    const varied = run([[6000, (t) => tone(150 + 40 * Math.sin((2 * Math.PI * t) / 1000))]]);
    expect(varied.pitchStdSemitones!).toBeGreaterThan(2.5);
  });
});
