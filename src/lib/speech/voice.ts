// Voice analysis from raw microphone samples: when the speaker is talking, where the
// pauses are, how loud, and how much the pitch moves. Pure maths, no browser APIs, so it
// can be unit-tested with synthetic audio.

import type { Pause, VoiceStats } from '../types';

const MIN_PAUSE_MS = 300;
/** Speech must be this far above the noise floor to count. */
const SPEECH_MARGIN_DB = 10;
const ABSOLUTE_FLOOR_DB = -55;
const MIN_PITCH_HZ = 70;
const MAX_PITCH_HZ = 400;
const LEVEL_BUCKET_MS = 250;

export function rmsDb(samples: Float32Array): number {
  let sum = 0;
  for (let i = 0; i < samples.length; i++) sum += samples[i]! * samples[i]!;
  const rms = Math.sqrt(sum / Math.max(1, samples.length));
  return rms > 0 ? 20 * Math.log10(rms) : -100;
}

/**
 * Fundamental frequency by normalised autocorrelation, or null if the frame is not
 * clearly voiced. Picks the shortest lag near the global peak to avoid octave errors.
 */
export function detectPitch(samples: Float32Array, sampleRate: number): number | null {
  // Decimate to roughly 12 kHz: plenty for a 70–400 Hz fundamental and 16x cheaper.
  const factor = Math.max(1, Math.floor(sampleRate / 12000));
  const n = Math.floor(samples.length / factor);
  const rate = sampleRate / factor;
  const x = new Float32Array(n);
  let mean = 0;
  for (let i = 0; i < n; i++) {
    let s = 0;
    for (let k = 0; k < factor; k++) s += samples[i * factor + k]!;
    x[i] = s / factor;
    mean += x[i]!;
  }
  mean /= Math.max(1, n);
  let energy = 0;
  for (let i = 0; i < n; i++) {
    x[i] = x[i]! - mean;
    energy += x[i]! * x[i]!;
  }
  if (energy < 1e-7) return null;

  const minLag = Math.max(2, Math.floor(rate / MAX_PITCH_HZ));
  const maxLag = Math.min(n - 1, Math.ceil(rate / MIN_PITCH_HZ));
  if (maxLag <= minLag + 1) return null;

  const corr = new Float32Array(maxLag + 2);
  let best = 0;
  for (let lag = minLag; lag <= maxLag + 1 && lag < n; lag++) {
    let sum = 0;
    let e1 = 0;
    let e2 = 0;
    for (let i = 0; i + lag < n; i++) {
      const a = x[i]!;
      const b = x[i + lag]!;
      sum += a * b;
      e1 += a * a;
      e2 += b * b;
    }
    const value = e1 > 0 && e2 > 0 ? sum / Math.sqrt(e1 * e2) : 0;
    corr[lag] = value;
    if (lag <= maxLag && value > best) best = value;
  }
  if (best < 0.55) return null;

  for (let lag = minLag + 1; lag <= maxLag; lag++) {
    const v = corr[lag]!;
    if (v >= 0.9 * best && v >= corr[lag - 1]! && v >= corr[lag + 1]!) {
      // Parabolic interpolation around the peak for sub-sample accuracy.
      const left = corr[lag - 1]!;
      const right = corr[lag + 1]!;
      const denom = left - 2 * v + right;
      const shift = denom !== 0 ? (0.5 * (left - right)) / denom : 0;
      return rate / (lag + shift);
    }
  }
  return null;
}

const median = (values: number[]) => {
  const sorted = [...values].sort((a, b) => a - b);
  const mid = sorted.length >> 1;
  return sorted.length % 2 ? sorted[mid]! : (sorted[mid - 1]! + sorted[mid]!) / 2;
};

const stdDev = (values: number[]) => {
  const mean = values.reduce((a, b) => a + b, 0) / values.length;
  return Math.sqrt(values.reduce((a, b) => a + (b - mean) ** 2, 0) / values.length);
};

/**
 * Feed it audio frames with timestamps; ask for stats at the end.
 * `level` and `speaking` are live readouts for the meter.
 */
export class VoiceAnalyzer {
  level = 0;
  speaking = false;

  private readonly sampleRate: number;
  private noiseFloor: number | null = null;
  private lastT = 0;
  private speechMs = 0;
  private firstSpeech: number | null = null;
  private lastSpeech: number | null = null;
  private silenceStart: number | null = null;
  private readonly pauses: Pause[] = [];
  private readonly voicedDb: number[] = [];
  private readonly semitones: number[] = [];
  private readonly levels: number[] = [];
  private bucketPeak = 0;
  private bucketIndex = 0;

  /** @param sampleRate only needed when feeding raw samples with `process` */
  constructor(sampleRate = 48000) {
    this.sampleRate = sampleRate;
  }

  /** Total time spent speaking so far, in ms. */
  get speechSoFarMs(): number {
    return this.speechMs;
  }

  /** Completed silences of at least `minMs` so far. */
  pauseCount(minMs: number): number {
    return this.pauses.filter((p) => p.end - p.start >= minMs).length;
  }

  /** Feed one frame of raw audio. @param t ms since the start of the take */
  process(samples: Float32Array, t: number): void {
    this.processLevel(rmsDb(samples), t, (loud) => (loud ? detectPitch(samples, this.sampleRate) : null));
  }

  /**
   * Feed a loudness reading in dBFS (about -60 for silence, 0 for full scale).
   * Native speech recognisers report a volume level rather than raw audio, so this is
   * the entry point there. `pitch` is asked for only when the frame counts as speech.
   */
  processLevel(db: number, t: number, pitch?: (loud: boolean) => number | null): void {
    const dt = Math.max(0, t - this.lastT);
    this.lastT = t;

    // Noise floor: drops to quiet immediately, creeps up slowly, so it follows the room
    // without being dragged up by speech.
    if (this.noiseFloor == null) this.noiseFloor = Math.min(-35, Math.max(-80, db));
    else if (db < this.noiseFloor) this.noiseFloor = Math.max(-80, db);
    else this.noiseFloor = Math.min(-35, this.noiseFloor + 0.0004 * dt);

    const threshold = Math.max(this.noiseFloor + SPEECH_MARGIN_DB, ABSOLUTE_FLOOR_DB);
    const loud = db > threshold;
    this.level = Math.max(0, Math.min(1, (db + 60) / 50));
    this.speaking = loud;

    const bucket = Math.floor(t / LEVEL_BUCKET_MS);
    while (this.bucketIndex < bucket) {
      this.levels.push(Math.round(this.bucketPeak * 100) / 100);
      this.bucketPeak = 0;
      this.bucketIndex++;
    }
    this.bucketPeak = Math.max(this.bucketPeak, this.level);

    if (loud) {
      if (this.firstSpeech == null) this.firstSpeech = t;
      else if (this.silenceStart != null && t - this.silenceStart >= MIN_PAUSE_MS) {
        this.pauses.push({ start: Math.round(this.silenceStart), end: Math.round(t) });
      }
      this.silenceStart = null;
      this.lastSpeech = t;
      this.speechMs += dt;
      this.voicedDb.push(db);
      const hz = pitch?.(true) ?? null;
      if (hz != null) this.semitones.push(12 * Math.log2(hz / 100));
    } else if (this.firstSpeech != null && this.silenceStart == null) {
      this.silenceStart = t;
    }
  }

  finish(): VoiceStats {
    this.levels.push(Math.round(this.bucketPeak * 100) / 100);

    let pitchMedianHz: number | null = null;
    let pitchStdSemitones: number | null = null;
    if (this.semitones.length >= 20) {
      const mid = median(this.semitones);
      // Drop octave slips and stray detections before measuring spread.
      const kept = this.semitones.filter((s) => Math.abs(s - mid) <= 9);
      if (kept.length >= 20) {
        pitchMedianHz = Math.round(100 * 2 ** (median(kept) / 12));
        pitchStdSemitones = Math.round(stdDev(kept) * 100) / 100;
      }
    }

    return {
      speechMs: Math.round(this.speechMs),
      firstSpeechMs: this.firstSpeech == null ? null : Math.round(this.firstSpeech),
      lastSpeechMs: this.lastSpeech == null ? null : Math.round(this.lastSpeech),
      pauses: this.pauses,
      levelDbMean: this.voicedDb.length
        ? Math.round((this.voicedDb.reduce((a, b) => a + b, 0) / this.voicedDb.length) * 10) / 10
        : null,
      levelDbStd: this.voicedDb.length >= 5 ? Math.round(stdDev(this.voicedDb) * 10) / 10 : null,
      pitchMedianHz,
      pitchStdSemitones,
      voicedFrames: this.semitones.length,
      levels: this.levels,
    };
  }
}
