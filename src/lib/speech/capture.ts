// One take, end to end: microphone -> voice analysis + recording + live transcript.

import type { Capture } from '../types';
import { DELIBERATE_PAUSE_MS, wordsAt } from '../analysis/metrics';
import { LiveTranscriber, transcriptionSupported } from './transcriber';
import { VoiceAnalyzer } from './voice';

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
  transcript: 'listening' | 'unsupported' | 'error';
  transcriptError: string | null;
  hasMic: boolean;
}

export type MicErrorCode = 'denied' | 'no-mic' | 'insecure' | 'unsupported' | 'failed';

export class MicError extends Error {
  readonly code: MicErrorCode;
  constructor(code: MicErrorCode, message: string) {
    super(message);
    this.code = code;
  }
}

export interface CaptureOptions {
  lang: string;
  /** Open the microphone for recording and voice analysis. Off = transcript only. */
  useMic: boolean;
}

const TICK_MS = 50;
const LIVE_PACE_WINDOW_MS = 8000;
/** This much detected speech with no words back means transcription is not working. */
const SILENT_FAILURE_MS = 3000;

function pickMimeType(): string | undefined {
  if (typeof MediaRecorder === 'undefined') return undefined;
  for (const type of ['audio/webm;codecs=opus', 'audio/webm', 'audio/mp4', 'audio/ogg;codecs=opus']) {
    if (MediaRecorder.isTypeSupported(type)) return type;
  }
  return undefined;
}

export class CaptureSession {
  live: LiveState;

  private readonly listeners = new Set<() => void>();
  private readonly stream: MediaStream | null;
  private readonly audioContext: AudioContext | null;
  private readonly analyser: AnalyserNode | null;
  private readonly buffer: Float32Array<ArrayBuffer> | null;
  private readonly options: CaptureOptions;
  private voice: VoiceAnalyzer | null = null;
  private transcriber: LiveTranscriber | null = null;
  private recorder: MediaRecorder | null = null;
  private chunks: Blob[] = [];
  private timer: ReturnType<typeof setInterval> | null = null;
  private t0 = 0;
  private running = false;
  private stepMarks: number[] = [];
  private ticks = 0;
  private wakeLock: { release(): Promise<void> } | null = null;

  private constructor(options: CaptureOptions, stream: MediaStream | null, audioContext: AudioContext | null) {
    this.options = options;
    this.stream = stream;
    if (stream && audioContext) {
      this.audioContext = audioContext;
      const source = this.audioContext.createMediaStreamSource(stream);
      this.analyser = this.audioContext.createAnalyser();
      this.analyser.fftSize = 2048;
      source.connect(this.analyser);
      this.buffer = new Float32Array(this.analyser.fftSize);
    } else {
      this.audioContext = null;
      this.analyser = null;
      this.buffer = null;
    }
    this.live = {
      elapsedMs: 0,
      level: 0,
      speaking: false,
      pauses: 0,
      notTranscribing: false,
      finalText: '',
      interim: '',
      words: 0,
      liveWpm: null,
      transcript: transcriptionSupported() ? 'listening' : 'unsupported',
      transcriptError: null,
      hasMic: stream != null,
    };
  }

  /** Ask for the microphone (if wanted) and get ready. Throws MicError when nothing can be captured. */
  static async open(options: CaptureOptions): Promise<CaptureSession> {
    const canTranscribe = transcriptionSupported();
    if (!options.useMic) {
      if (!canTranscribe) {
        throw new MicError('unsupported', 'This browser cannot transcribe speech. Turn microphone analysis back on in Settings, or use Chrome, Edge or Safari.');
      }
      return new CaptureSession(options, null, null);
    }
    if (!navigator.mediaDevices?.getUserMedia) {
      throw new MicError(
        'insecure',
        'The microphone is only available on a secure page. Open the app over https or on localhost.',
      );
    }
    // Create and resume the audio context now, while we are still inside the click that
    // started the take: Safari refuses to start one after an await.
    const Ctx: typeof AudioContext | undefined =
      window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    const audioContext = Ctx ? new Ctx() : null;
    void audioContext?.resume().catch(() => undefined);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: true, noiseSuppression: true, autoGainControl: false },
      });
      await audioContext?.resume().catch(() => undefined);
      return new CaptureSession(options, stream, audioContext);
    } catch (error) {
      void audioContext?.close().catch(() => undefined);
      const name = (error as { name?: string } | null)?.name ?? '';
      if (name === 'NotAllowedError' || name === 'SecurityError') {
        throw new MicError('denied', 'Microphone access is blocked. Allow it in your browser’s site settings, then try again.');
      }
      if (name === 'NotFoundError' || name === 'OverconstrainedError') {
        throw new MicError('no-mic', 'No microphone was found. Plug one in, then try again.');
      }
      throw new MicError('failed', 'The microphone could not be started.');
    }
  }

  subscribe = (listener: () => void): (() => void) => {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  };

  getSnapshot = (): LiveState => this.live;

  private emit() {
    for (const listener of this.listeners) listener();
  }

  private now = () => performance.now() - this.t0;

  /** Before a take starts, keep the level meter alive so the speaker can see the mic works. */
  startMonitoring(): void {
    if (this.timer || !this.analyser) return;
    this.t0 = performance.now();
    const monitor = new VoiceAnalyzer(this.audioContext!.sampleRate);
    this.timer = setInterval(() => {
      this.analyser!.getFloatTimeDomainData(this.buffer!);
      monitor.process(this.buffer!, this.now());
      this.live = { ...this.live, level: monitor.level, speaking: monitor.speaking };
      this.emit();
    }, TICK_MS * 2);
  }

  /** Begin the take: the clock starts now. */
  start(): void {
    if (this.running) return;
    if (this.timer) clearInterval(this.timer);
    this.running = true;
    this.t0 = performance.now();
    this.stepMarks = [];
    this.chunks = [];

    if (this.stream && this.audioContext) {
      this.voice = new VoiceAnalyzer(this.audioContext.sampleRate);
      const mimeType = pickMimeType();
      try {
        this.recorder = new MediaRecorder(this.stream, mimeType ? { mimeType } : undefined);
        this.recorder.ondataavailable = (event) => {
          if (event.data.size > 0) this.chunks.push(event.data);
        };
        this.recorder.start(1000);
      } catch {
        this.recorder = null;
      }
    }

    this.holdScreen();
    this.transcriber = new LiveTranscriber(this.options.lang, this.now, () => this.refresh());
    this.transcriber.start();
    this.refresh();
    this.timer = setInterval(() => this.tick(), TICK_MS);
  }

  private tick() {
    const t = this.now();
    if (this.analyser && this.buffer && this.voice) {
      this.analyser.getFloatTimeDomainData(this.buffer);
      this.voice.process(this.buffer, t);
    }
    // Analyse at 20 Hz, repaint at 10 Hz.
    if (++this.ticks % 2 === 0) this.refresh();
  }

  private refresh() {
    if (!this.running) return;
    const t = this.now();
    const transcriber = this.transcriber;
    const timeline = transcriber?.timeline ?? [];
    const firstWord = timeline.find((s) => s.words > 0);
    let liveWpm: number | null = null;
    if (firstWord && t - firstWord.t >= 4000) {
      const span = Math.min(LIVE_PACE_WINDOW_MS, t - firstWord.t + 600);
      liveWpm = Math.round(((wordsAt(timeline, t) - wordsAt(timeline, t - span)) / span) * 60000);
    }
    this.live = {
      elapsedMs: t,
      level: this.voice?.level ?? 0,
      speaking: this.voice?.speaking ?? false,
      pauses: this.voice?.pauseCount(DELIBERATE_PAUSE_MS) ?? 0,
      notTranscribing: (transcriber?.words ?? 0) === 0 && (this.voice?.speechSoFarMs ?? 0) >= 2 * SILENT_FAILURE_MS,
      finalText: transcriber?.finalText ?? '',
      interim: transcriber?.interim ?? '',
      words: transcriber?.words ?? 0,
      liveWpm,
      transcript:
        transcriber?.status === 'unsupported' ? 'unsupported' : transcriber?.status === 'error' ? 'error' : 'listening',
      transcriptError: transcriber?.error ?? null,
      hasMic: this.stream != null,
    };
    this.emit();
  }

  /** Keep the screen on while speaking: nobody touches their phone mid-answer. */
  private holdScreen() {
    const wakeLock = (navigator as Navigator & { wakeLock?: { request(type: 'screen'): Promise<{ release(): Promise<void> }> } }).wakeLock;
    wakeLock
      ?.request('screen')
      .then((lock) => {
        if (this.running) this.wakeLock = lock;
        else void lock.release().catch(() => undefined);
      })
      .catch(() => undefined);
  }

  private releaseScreen() {
    void this.wakeLock?.release().catch(() => undefined);
    this.wakeLock = null;
  }

  /** Record the moment the speaker moved to the next framework step. */
  markStep(): void {
    if (this.running) this.stepMarks.push(Math.round(this.now()));
  }

  /** End the take and return everything that was captured. */
  async stop(): Promise<{ capture: Capture; audio: Blob | null }> {
    const durationMs = Math.round(this.now());
    this.running = false;
    this.releaseScreen();
    if (this.timer) clearInterval(this.timer);
    this.timer = null;

    const transcriber = this.transcriber;
    const audioDone = new Promise<Blob | null>((resolve) => {
      const recorder = this.recorder;
      if (!recorder || recorder.state === 'inactive') return resolve(null);
      const finish = () => resolve(this.chunks.length ? new Blob(this.chunks, { type: recorder.mimeType }) : null);
      recorder.onstop = finish;
      try {
        recorder.stop();
      } catch {
        finish();
      }
      setTimeout(finish, 1500);
    });
    const [audio] = await Promise.all([audioDone, transcriber?.stop()]);

    const transcript = transcriber?.finalText ?? '';
    const heardWords = transcript.trim().length > 0;
    const voice = this.voice?.finish() ?? null;
    // Some browsers expose speech recognition but never return anything. If the microphone
    // clearly picked up speech and no words came back, call that what it is.
    const silentFailure = !heardWords && (voice?.speechMs ?? 0) >= SILENT_FAILURE_MS;
    const capture: Capture = {
      transcript,
      transcriptAvailable: transcriber != null && (heardWords || (transcriber.status === 'listening' && !silentFailure)),
      segments: transcriber?.segments ?? [],
      wordTimeline: transcriber?.timeline ?? [],
      durationMs,
      voice,
      stepMarks: this.stepMarks,
    };
    this.recorder = null;
    this.transcriber = null;
    this.voice = null;
    return { capture, audio };
  }

  /** Release the microphone. Safe to call more than once. */
  close(): void {
    this.running = false;
    this.releaseScreen();
    if (this.timer) clearInterval(this.timer);
    this.timer = null;
    this.transcriber?.abort();
    this.transcriber = null;
    try {
      if (this.recorder && this.recorder.state !== 'inactive') this.recorder.stop();
    } catch {
      // already stopped
    }
    this.recorder = null;
    this.stream?.getTracks().forEach((track) => track.stop());
    void this.audioContext?.close().catch(() => undefined);
    this.listeners.clear();
  }
}
