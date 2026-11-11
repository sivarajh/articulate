// One take on a phone: the device's speech recogniser gives live words, a volume level
// (used to find pauses) and, where supported, a recording of the audio.
//
// Platforms differ in how results arrive, and this handles all three shapes:
//   - Android: continuous mode is segmented. Each final result is a new utterance.
//   - iOS: interim results hold the whole transcript so far; one final arrives at the end.
//   - Web (Expo web): final per utterance, interim for the utterance in progress.
// In every case the transcript is "the finals so far, plus the latest interim".

import { Directory, Paths } from 'expo-file-system';
import { ExpoSpeechRecognitionModule } from 'expo-speech-recognition';
import { Platform } from 'react-native';
import { DELIBERATE_PAUSE_MS, wordsAt } from '@core/analysis/metrics';
import { countWords, wordsOf } from '@core/analysis/text';
import { VoiceAnalyzer } from '@core/speech/voice';
import type { Capture, TimedSegment, WordSample } from '@core/types';

export interface LiveState {
  elapsedMs: number;
  /** Loudness 0..1 for the meter. */
  level: number;
  speaking: boolean;
  /** Deliberate pauses taken so far. */
  pauses: number;
  /** True when speech is clearly being picked up but no words are coming back. */
  notTranscribing: boolean;
  finalText: string;
  interim: string;
  words: number;
  /** Pace over the last few seconds, once there is enough speech to measure. */
  liveWpm: number | null;
  transcript: 'listening' | 'error';
  transcriptError: string | null;
  /** Whether the recogniser is reporting volume (it does on phones, not on the web). */
  hasLevels: boolean;
}

export class CaptureError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CaptureError';
  }
}

export interface CaptureOptions {
  lang: string;
  /** Keep a recording of each take for playback, where the device supports it. */
  record: boolean;
}

const TICK_MS = 100;
const LIVE_PACE_WINDOW_MS = 8000;
const SILENT_FAILURE_MS = 3000;

/** The recogniser stops for these on its own; the session is simply restarted. */
const ROUTINE_ERRORS = new Set(['no-speech', 'speech-timeout', 'aborted', 'client']);

const ERROR_MESSAGES: Record<string, string> = {
  'not-allowed': 'Microphone or speech recognition access was turned off.',
  'service-not-allowed': 'Speech recognition is not available on this device right now.',
  'language-not-supported': 'This accent is not supported by the device’s speech recogniser. Choose another in Settings.',
  'audio-capture': 'The microphone could not be used.',
  network: 'Speech recognition needs an internet connection and could not reach its service.',
  interrupted: 'Another app took over the microphone.',
  busy: 'The speech recogniser is busy. Try again in a moment.',
  'too-many-requests': 'The speech recogniser is busy. Try again in a moment.',
};

interface Subscription {
  remove(): void;
}

export class NativeCapture {
  live: LiveState = {
    elapsedMs: 0,
    level: 0,
    speaking: false,
    pauses: 0,
    notTranscribing: false,
    finalText: '',
    interim: '',
    words: 0,
    liveWpm: null,
    transcript: 'listening',
    transcriptError: null,
    hasLevels: false,
  };

  private readonly options: CaptureOptions;
  private readonly listeners = new Set<() => void>();
  private subscriptions: Subscription[] = [];
  private voice: VoiceAnalyzer | null = null;
  private timer: ReturnType<typeof setInterval> | null = null;
  private t0 = 0;
  private running = false;
  /** We want the recogniser on (it is restarted if it stops by itself). */
  private active = false;
  /** The recogniser is on right now. */
  private recognizing = false;
  private onEnded: (() => void) | null = null;
  private restarts: number[] = [];

  private segments: TimedSegment[] = [];
  private timeline: WordSample[] = [];
  private interim = '';
  private segmentStart: number | null = null;
  private stepMarks: number[] = [];
  private audio: string[] = [];
  private takeNumber = 0;
  private gotLevels = false;
  private error: string | null = null;

  private constructor(options: CaptureOptions) {
    this.options = options;
  }

  /** Check the device can transcribe and ask for permission. Throws CaptureError if not. */
  static async open(options: CaptureOptions): Promise<NativeCapture> {
    let available = false;
    try {
      available = ExpoSpeechRecognitionModule.isRecognitionAvailable();
    } catch {
      available = false;
    }
    if (!available) {
      throw new CaptureError(
        Platform.OS === 'android'
          ? 'Speech recognition is not available on this device. Check that the Google app or Speech Recognition & Synthesis is installed and enabled.'
          : 'Speech recognition is not available on this device.',
      );
    }
    const permission = await ExpoSpeechRecognitionModule.requestPermissionsAsync();
    if (!permission.granted) {
      throw new CaptureError(
        'Articulate needs the microphone and speech recognition to hear your answer. Allow both in your device settings, then try again.',
      );
    }
    return new NativeCapture(options);
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): LiveState => this.live;

  private now = () => Date.now() - this.t0;

  private get finalText(): string {
    return this.segments.map((s) => s.text).join(' ');
  }

  /** Begin the take: the clock starts now. */
  start(): void {
    if (this.running) return;
    this.running = true;
    this.active = true;
    this.t0 = Date.now();
    this.takeNumber++;
    this.segments = [];
    this.timeline = [];
    this.interim = '';
    this.segmentStart = null;
    this.stepMarks = [];
    this.audio = [];
    this.restarts = [];
    this.error = null;
    this.gotLevels = false;
    this.voice = new VoiceAnalyzer();

    const module = ExpoSpeechRecognitionModule;
    this.subscriptions = [
      module.addListener('result', (event) => this.handleResult(event.isFinal, event.results[0]?.transcript ?? '')),
      module.addListener('volumechange', (event) => this.handleVolume(event.value)),
      module.addListener('audioend', (event) => {
        if (event?.uri) this.audio.push(event.uri);
      }),
      module.addListener('error', (event) => this.handleError(event.error)),
      module.addListener('end', () => this.handleEnd()),
    ];

    this.startRecognizer();
    this.refresh();
    this.timer = setInterval(() => this.refresh(), TICK_MS);
  }

  private recordingOptions() {
    if (!this.options.record || Platform.OS === 'web') return undefined;
    try {
      if (!ExpoSpeechRecognitionModule.supportsRecording()) return undefined;
      // Keep recordings in the app's documents so the system does not clear them.
      const directory = new Directory(Paths.document, 'recordings');
      if (!directory.exists) directory.create({ idempotent: true, intermediates: true });
      return {
        persist: true,
        outputDirectory: directory.uri,
        outputFileName: `take-${this.t0}-${this.takeNumber}-${this.audio.length + this.restarts.length}.wav`,
      };
    } catch {
      return { persist: true };
    }
  }

  private startRecognizer() {
    try {
      ExpoSpeechRecognitionModule.start({
        lang: this.options.lang,
        interimResults: true,
        maxAlternatives: 1,
        continuous: true,
        addsPunctuation: false,
        iosTaskHint: 'dictation',
        volumeChangeEventOptions: { enabled: true, intervalMillis: 100 },
        recordingOptions: this.recordingOptions(),
      });
      this.recognizing = true;
    } catch {
      this.fail('Speech recognition could not start.');
    }
  }

  private handleResult(isFinal: boolean, raw: string) {
    const t = this.now();
    const text = raw.trim();
    if (isFinal) {
      if (text) this.pushSegment(text, t);
      this.interim = '';
    } else {
      // Some recognisers start over mid-take without sending a final result. If the new
      // interim is much shorter and begins differently, keep what was there before.
      const before = wordsOf(this.interim);
      const after = wordsOf(text);
      if (before.length >= 5 && after.length <= before.length - 4 && after[0] !== before[0]) {
        this.pushSegment(this.interim, t);
      }
      this.interim = text;
      if (text && this.segmentStart == null) this.segmentStart = t;
    }
    this.sample(t);
    this.refresh();
  }

  private pushSegment(text: string, t: number) {
    this.segments.push({ text, start: Math.round(this.segmentStart ?? t), end: Math.round(t) });
    this.segmentStart = null;
  }

  private sample(t: number) {
    const words = countWords(this.interim ? `${this.finalText} ${this.interim}` : this.finalText);
    const last = this.timeline[this.timeline.length - 1];
    const count = Math.max(words, last?.words ?? 0);
    if (last && t - last.t < 500) last.words = count;
    else this.timeline.push({ t: Math.round(t), words: count });
  }

  private handleVolume(value: number) {
    if (!this.running || !this.voice) return;
    this.gotLevels = true;
    // The recogniser reports -2 (silence) to 10 (loud); below 0 is inaudible.
    // Map that onto a decibel-like scale where 0 lands at the speech threshold.
    this.voice.processLevel(-50 + value * 5, this.now());
  }

  private handleError(code: string) {
    if (ROUTINE_ERRORS.has(code)) return;
    this.fail(ERROR_MESSAGES[code] ?? 'Speech recognition stopped unexpectedly.');
  }

  private fail(message: string) {
    this.active = false;
    this.error = message;
    this.refresh();
  }

  private handleEnd() {
    this.recognizing = false;
    if (this.interim) {
      this.pushSegment(this.interim, this.now());
      this.interim = '';
    }
    if (!this.active) {
      this.onEnded?.();
      return;
    }
    // Recognisers stop after a silence or a time limit. Pick up again without losing text.
    const t = this.now();
    this.restarts = this.restarts.filter((at) => t - at < 5000);
    this.restarts.push(t);
    if (this.restarts.length > 8) {
      this.fail('Speech recognition keeps stopping on this device.');
      return;
    }
    setTimeout(() => {
      if (this.active && this.running) this.startRecognizer();
    }, 120);
  }

  private refresh() {
    if (!this.running) return;
    const t = this.now();
    const firstWord = this.timeline.find((s) => s.words > 0);
    let liveWpm: number | null = null;
    if (firstWord && t - firstWord.t >= 4000) {
      const span = Math.min(LIVE_PACE_WINDOW_MS, t - firstWord.t + 600);
      liveWpm = Math.round(((wordsAt(this.timeline, t) - wordsAt(this.timeline, t - span)) / span) * 60000);
    }
    const words = this.timeline.length ? this.timeline[this.timeline.length - 1]!.words : 0;
    this.live = {
      elapsedMs: t,
      level: this.voice?.level ?? 0,
      speaking: this.voice?.speaking ?? false,
      pauses: this.voice?.pauseCount(DELIBERATE_PAUSE_MS) ?? 0,
      notTranscribing: words === 0 && (this.voice?.speechSoFarMs ?? 0) >= 2 * SILENT_FAILURE_MS,
      finalText: this.finalText,
      interim: this.interim,
      words,
      liveWpm,
      transcript: this.error ? 'error' : 'listening',
      transcriptError: this.error,
      hasLevels: this.gotLevels,
    };
    for (const listener of this.listeners) listener();
  }

  /** Record the moment the speaker moved to the next framework step. */
  markStep(): void {
    if (this.running) this.stepMarks.push(Math.round(this.now()));
  }

  /** End the take and return everything that was captured. */
  async stop(): Promise<{ capture: Capture; audio: string[] }> {
    const durationMs = Math.round(this.now());
    this.running = false;
    this.active = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;

    if (this.recognizing) {
      // The last words (on iOS, the only final result) arrive after stop() and before "end".
      await new Promise<void>((resolve) => {
        let done = false;
        const finish = () => {
          if (done) return;
          done = true;
          this.onEnded = null;
          resolve();
        };
        this.onEnded = finish;
        try {
          ExpoSpeechRecognitionModule.stop();
        } catch {
          finish();
        }
        setTimeout(finish, 2500);
      });
    }
    if (this.interim) {
      this.pushSegment(this.interim, durationMs);
      this.interim = '';
    }
    this.sample(durationMs);
    this.detach();

    const transcript = this.finalText;
    const heardWords = transcript.trim().length > 0;
    const voice = this.gotLevels && this.voice ? this.voice.finish() : null;
    const silentFailure = !heardWords && (voice?.speechMs ?? 0) >= SILENT_FAILURE_MS;
    const capture: Capture = {
      transcript,
      transcriptAvailable: heardWords || (!this.error && !silentFailure),
      segments: this.segments,
      wordTimeline: this.timeline,
      durationMs,
      voice,
      stepMarks: this.stepMarks,
    };
    this.voice = null;
    return { capture, audio: this.audio };
  }

  private detach() {
    for (const subscription of this.subscriptions) subscription.remove();
    this.subscriptions = [];
  }

  /** Stop listening without keeping anything. Safe to call more than once. */
  close(): void {
    this.running = false;
    this.active = false;
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    if (this.recognizing) {
      try {
        ExpoSpeechRecognitionModule.abort();
      } catch {
        // already stopped
      }
      this.recognizing = false;
    }
    this.detach();
    this.listeners.clear();
  }
}
