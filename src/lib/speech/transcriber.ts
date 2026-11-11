// Live transcription on top of the browser's Web Speech API (Chrome, Edge, Safari).
//
// The API was built for short voice commands, so a few things need handling for
// minute-long speeches: recognition sessions end on their own and must be restarted
// without losing text, and each result needs a timestamp so pace can be measured.

import type { TimedSegment, WordSample } from '../types';
import { countWords } from '../analysis/text';

// Minimal typings: the Web Speech API is not in every TypeScript DOM lib.
interface RecognitionAlternative {
  transcript: string;
}
interface RecognitionResult {
  isFinal: boolean;
  [index: number]: RecognitionAlternative;
}
interface RecognitionEvent {
  resultIndex: number;
  results: { length: number; [index: number]: RecognitionResult };
}
interface Recognition {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
type RecognitionCtor = new () => Recognition;

function recognitionCtor(): RecognitionCtor | null {
  if (typeof window === 'undefined') return null;
  const w = window as unknown as { SpeechRecognition?: RecognitionCtor; webkitSpeechRecognition?: RecognitionCtor };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

export function transcriptionSupported(): boolean {
  return recognitionCtor() != null;
}

const FATAL_ERRORS: Record<string, string> = {
  'not-allowed': 'Microphone access was blocked for speech recognition.',
  'service-not-allowed': 'This browser does not allow speech recognition here.',
  'audio-capture': 'Speech recognition could not reach the microphone.',
  network: 'Speech recognition needs an internet connection and could not reach its service.',
  'language-not-supported': 'This language is not supported for speech recognition.',
};

export type TranscriberStatus = 'idle' | 'listening' | 'unsupported' | 'error';

export class LiveTranscriber {
  status: TranscriberStatus = 'idle';
  error: string | null = null;
  /** Text still being revised by the recogniser. */
  interim = '';
  readonly segments: TimedSegment[] = [];
  readonly timeline: WordSample[] = [];

  private rec: Recognition | null = null;
  private active = false;
  private finalCount = 0;
  private segmentStart: number | null = null;
  /** Android Chrome reports one growing result per session instead of a list of finals. */
  private readonly cumulative = typeof navigator !== 'undefined' && /Android/i.test(navigator.userAgent);
  private sessionText = '';
  private restarts: number[] = [];
  private onStopped: (() => void) | null = null;

  private readonly lang: string;
  private readonly now: () => number;
  private readonly onChange: () => void;

  constructor(lang: string, now: () => number, onChange: () => void) {
    this.lang = lang;
    this.now = now;
    this.onChange = onChange;
  }

  get finalText(): string {
    const parts = this.segments.map((s) => s.text);
    if (this.sessionText) parts.push(this.sessionText);
    return parts.join(' ');
  }

  get words(): number {
    return this.timeline.length ? this.timeline[this.timeline.length - 1]!.words : 0;
  }

  start(): void {
    const Ctor = recognitionCtor();
    if (!Ctor) {
      this.status = 'unsupported';
      return;
    }
    const rec = new Ctor();
    rec.lang = this.lang;
    rec.continuous = true;
    rec.interimResults = true;
    rec.maxAlternatives = 1;
    rec.onresult = (event) => this.handleResult(event);
    rec.onerror = (event) => this.handleError(event.error);
    rec.onend = () => this.handleEnd();
    this.rec = rec;
    this.active = true;
    this.status = 'listening';
    try {
      rec.start();
    } catch {
      this.fail('Speech recognition could not start.');
    }
  }

  /** Stop listening and wait briefly for the last words to be finalised. */
  async stop(): Promise<void> {
    const wasActive = this.active;
    this.active = false;
    const rec = this.rec;
    if (!rec || !wasActive) {
      this.commitPending();
      return;
    }
    await new Promise<void>((resolve) => {
      let done = false;
      const finish = () => {
        if (done) return;
        done = true;
        this.onStopped = null;
        resolve();
      };
      this.onStopped = finish;
      try {
        rec.stop();
      } catch {
        finish();
      }
      setTimeout(finish, 1200);
    });
    this.commitPending();
    this.detach();
  }

  /** Abandon without waiting (leaving the screen). */
  abort(): void {
    this.active = false;
    try {
      this.rec?.abort();
    } catch {
      // already stopped
    }
    this.detach();
  }

  private detach() {
    if (!this.rec) return;
    this.rec.onresult = null;
    this.rec.onerror = null;
    this.rec.onend = null;
    this.rec = null;
  }

  private handleResult(event: RecognitionEvent) {
    const t = this.now();
    const interimParts: string[] = [];

    if (this.cumulative) {
      const last = event.results[event.results.length - 1];
      this.sessionText = last ? last[0]!.transcript.trim() : this.sessionText;
    } else {
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i]!;
        const text = result[0]!.transcript.trim();
        if (!text) continue;
        if (result.isFinal) {
          if (i >= this.finalCount) {
            this.pushSegment(text, t);
            this.finalCount = i + 1;
          }
        } else {
          interimParts.push(text);
        }
      }
    }

    this.interim = interimParts.join(' ');
    if (this.interim && this.segmentStart == null) this.segmentStart = t;
    this.sample(t);
    this.onChange();
  }

  private pushSegment(text: string, t: number) {
    this.segments.push({ text, start: Math.round(this.segmentStart ?? t), end: Math.round(t) });
    this.segmentStart = null;
  }

  /** Anything the recogniser had not finalised when its session ended is kept, not dropped. */
  private commitPending() {
    const t = this.now();
    if (this.sessionText) {
      this.pushSegment(this.sessionText, t);
      this.sessionText = '';
    }
    if (this.interim) {
      this.pushSegment(this.interim, t);
      this.interim = '';
    }
    this.sample(t);
  }

  private sample(t: number) {
    const words = countWords(this.interim ? `${this.finalText} ${this.interim}` : this.finalText);
    const last = this.timeline[this.timeline.length - 1];
    const count = Math.max(words, last?.words ?? 0);
    // One sample per half second is plenty for pace and keeps stored takes small.
    if (last && t - last.t < 500) last.words = count;
    else this.timeline.push({ t: Math.round(t), words: count });
  }

  private handleError(code: string) {
    // "no-speech" and "aborted" are routine: the session ends and is restarted.
    const message = FATAL_ERRORS[code];
    if (message) this.fail(message);
  }

  private fail(message: string) {
    this.active = false;
    this.status = 'error';
    this.error = message;
    this.onChange();
  }

  private handleEnd() {
    this.commitPending();
    this.finalCount = 0;
    if (!this.active) {
      this.onStopped?.();
      this.onChange();
      return;
    }
    // Chrome ends a session after a stretch of silence or about a minute. Pick up again.
    const t = this.now();
    this.restarts = this.restarts.filter((at) => t - at < 4000);
    this.restarts.push(t);
    if (this.restarts.length > 6) {
      this.fail('Speech recognition keeps stopping in this browser.');
      return;
    }
    const restart = () => {
      if (!this.active || !this.rec) return;
      try {
        this.rec.start();
      } catch {
        setTimeout(restart, 300);
      }
    };
    setTimeout(restart, 60);
    this.onChange();
  }
}
