// Shared domain types. Everything here is plain data so it can be stored, tested and passed around freely.

export type SkillId = 'fluency' | 'pace' | 'clarity' | 'structure' | 'vocabulary' | 'delivery';

export const SKILLS: { id: SkillId; label: string; blurb: string }[] = [
  { id: 'fluency', label: 'Fluency', blurb: 'Speaking without fillers, restarts or stalls' },
  { id: 'pace', label: 'Pace', blurb: 'A steady, listenable speed' },
  { id: 'clarity', label: 'Clarity', blurb: 'Direct, precise words — no hedging or vagueness' },
  { id: 'structure', label: 'Structure', blurb: 'A shape the listener can follow' },
  { id: 'vocabulary', label: 'Vocabulary', blurb: 'Range and variety of word choice' },
  { id: 'delivery', label: 'Delivery', blurb: 'Purposeful pauses and vocal variety' },
];

export type FrameworkId = 'prep' | 'star' | 'wsn' | 'psb' | 'ppf' | 'pyramid' | 'sbi' | 'abc' | 'story';

export type DrillId =
  | 'impromptu'
  | 'framework'
  | 'custom'
  | 'hot-seat'
  | 'filler-free'
  | 'shrink-it'
  | 'taboo'
  | 'word-bridge'
  | 'analogy'
  | 'word-weave'
  | 'pace-lock'
  | 'power-pause'
  | 'tongue-twister';

/** A target the speaker is asked to hit in a take. Evaluated after the take. */
export type Goal =
  | { type: 'maxFillers'; max: number }
  | { type: 'minWords'; min: number }
  | { type: 'maxWords'; max: number }
  | { type: 'paceBand' }
  | { type: 'accuracy'; min: number }
  | { type: 'noTaboo' }
  | { type: 'useWords' }
  | { type: 'pauses'; min: number }
  | { type: 'quickStart'; maxSec: number }
  | { type: 'coverSteps' };

/** One thing to say out loud: a prompt plus the rules for the take. */
export interface Exercise {
  id: string;
  drillId: DrillId;
  /** Short name shown in headers and history, e.g. "Impromptu". */
  title: string;
  /** Small label above the prompt, e.g. "Job interview". */
  tag: string;
  prompt: string;
  /** One line of instruction under the prompt. */
  context?: string;
  prepSec: number;
  speakSec: number;
  /** 'read' takes show a passage to read aloud and are scored on accuracy. */
  mode: 'speak' | 'read';
  readText?: string;
  frameworkId?: FrameworkId;
  /** When true the speaker steps through the framework and each step is measured. */
  guided?: boolean;
  taboo?: string[];
  mustUse?: string[];
  goals: Goal[];
}

/** A sequence of exercises run back to back (a drill, a workout, a hot seat). */
export interface Plan {
  id: string;
  title: string;
  steps: Exercise[];
  /** Skip the report between steps: answer, next question, answer. */
  rapid?: boolean;
  /** Set for the daily workout so completion can be recorded. */
  dailyKey?: string;
  /** How to build a fresh plan of the same kind ("new prompt"). */
  recipe?: PlanRecipe;
}

export type PlanRecipe =
  | { kind: 'drill'; drillId: DrillId }
  | { kind: 'framework'; frameworkId: FrameworkId }
  | { kind: 'impromptu'; category: string; speakSec: number; prepSec: number; framework: FrameworkId | 'auto' | 'none' };

// ---------- capture ----------

export interface TimedSegment {
  text: string;
  /** ms from the start of the take */
  start: number;
  end: number;
}

/** Cumulative word count observed at time t (ms from the start of the take). */
export interface WordSample {
  t: number;
  words: number;
}

export interface Pause {
  start: number;
  end: number;
}

/** What the microphone told us, independent of the words. */
export interface VoiceStats {
  speechMs: number;
  firstSpeechMs: number | null;
  lastSpeechMs: number | null;
  /** Silences of 300ms or more between stretches of speech. */
  pauses: Pause[];
  levelDbMean: number | null;
  levelDbStd: number | null;
  pitchMedianHz: number | null;
  pitchStdSemitones: number | null;
  voicedFrames: number;
  /** Loudness envelope, 0..1, four samples per second. */
  levels: number[];
}

export interface Capture {
  transcript: string;
  /** False when the browser could not transcribe (unsupported or failed). */
  transcriptAvailable: boolean;
  segments: TimedSegment[];
  wordTimeline: WordSample[];
  durationMs: number;
  voice: VoiceStats | null;
  /** Times at which the speaker moved to the next framework step. */
  stepMarks: number[];
}

// ---------- analysis ----------

export type FlagKind = 'filler' | 'hedge' | 'vague' | 'repeat' | 'signpost' | 'taboo' | 'target';

/** A run of tokens [start, end) worth pointing at in the transcript. */
export interface Flag {
  start: number;
  end: number;
  kind: FlagKind;
  label: string;
}

export interface GoalResult {
  label: string;
  met: boolean;
  detail: string;
}

export interface CoachNote {
  tone: 'win' | 'fix';
  skill: SkillId;
  title: string;
  detail: string;
  /** Higher = more important. Used to pick the one thing to work on next. */
  weight: number;
}

export interface PacePoint {
  /** seconds from the start of the take */
  t: number;
  wpm: number;
}

export interface StepCoverage {
  label: string;
  words: number;
  sec: number;
}

export interface ReadResult {
  accuracy: number;
  /** One entry per word of the passage: was it heard? */
  hits: boolean[];
  missed: string[];
}

export interface PauseSummary {
  deliberate: number;
  long: number;
  longestSec: number;
  silenceRatio: number;
}

export interface Analysis {
  /** False when there was too little speech to say anything meaningful. */
  sufficient: boolean;
  words: number;
  speakingSec: number;
  wpm: number | null;
  paceSeries: PacePoint[];
  paceCv: number | null;
  fillers: number;
  fillersPerMin: number;
  topFillers: [string, number][];
  hedges: number;
  vague: number;
  repeats: number;
  signposts: number;
  signpostKinds: string[];
  weakOpen: string | null;
  weakClose: string | null;
  variety: number | null;
  topWords: [string, number][];
  startLatencySec: number | null;
  pauses: PauseSummary | null;
  pitchSt: number | null;
  read: ReadResult | null;
  tabooHits: string[];
  targetHits: string[];
  targetMissed: string[];
  steps: StepCoverage[] | null;
  scores: Partial<Record<SkillId, number>>;
  overall: number | null;
  goals: GoalResult[];
  notes: CoachNote[];
}

// ---------- AI coach ----------

export interface AiFeedback {
  headline: string;
  strengths: string[];
  improvements: { issue: string; fix: string }[];
  rewrite: string;
  followUp: string;
}

/** Practice questions the AI coach wrote for a situation the learner described. */
export interface Scenario {
  title: string;
  questions: string[];
  framework: FrameworkId;
}

// ---------- persistence ----------

export interface TakeRecord {
  id: string;
  /** epoch ms */
  at: number;
  /** Shared by the takes of one plan run. */
  planId: string;
  planTitle: string;
  exercise: Exercise;
  capture: Capture;
  analysis: Analysis;
  xp: number;
  ai?: AiFeedback;
}

export interface Settings {
  lang: string;
  paceMin: number;
  paceMax: number;
  customFillers: string[];
  liveFillerAlert: boolean;
  recordAudio: boolean;
  speakPrompts: boolean;
  dailyGoalMin: number;
  theme: 'system' | 'light' | 'dark';
  apiKey: string;
}

export const DEFAULT_SETTINGS: Settings = {
  lang: 'en-US',
  paceMin: 130,
  paceMax: 165,
  customFillers: [],
  liveFillerAlert: true,
  recordAudio: true,
  speakPrompts: false,
  dailyGoalMin: 10,
  theme: 'system',
  apiKey: '',
};
