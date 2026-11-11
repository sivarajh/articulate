// App state: settings and the history of takes, kept in localStorage.
// A tiny external store rather than a state library; components subscribe with useStore().

import { useSyncExternalStore } from 'react';
import { DEFAULT_SETTINGS, type AiFeedback, type Settings, type TakeRecord } from './types';
import { clearAudio, deleteAudio, pruneAudio } from './audioStore';

export interface AppState {
  settings: Settings;
  /** Newest first. */
  takes: TakeRecord[];
  /** Days (YYYY-MM-DD) on which the daily workout was finished. */
  dailyDone: string[];
}

const KEY = 'articulate:v1';
const MAX_TAKES = 250;
/** Older takes keep their scores and transcript but drop the bulky timing detail. */
const FULL_DETAIL_TAKES = 60;

function initialState(): AppState {
  return { settings: { ...DEFAULT_SETTINGS }, takes: [], dailyDone: [] };
}

function load(): AppState {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return initialState();
    const parsed = JSON.parse(raw) as Partial<AppState>;
    return {
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}) },
      takes: Array.isArray(parsed.takes) ? parsed.takes : [],
      dailyDone: Array.isArray(parsed.dailyDone) ? parsed.dailyDone : [],
    };
  } catch {
    return initialState();
  }
}

let state: AppState = typeof localStorage === 'undefined' ? initialState() : load();
const listeners = new Set<() => void>();

function slim(take: TakeRecord): TakeRecord {
  if (!take.capture.wordTimeline.length && !take.capture.voice?.levels.length) return take;
  return {
    ...take,
    capture: {
      ...take.capture,
      wordTimeline: [],
      voice: take.capture.voice ? { ...take.capture.voice, levels: [] } : null,
    },
  };
}

function persist() {
  try {
    localStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    // Storage is full: drop detail from all but the newest few takes and try once more.
    state = { ...state, takes: state.takes.map((t, i) => (i < 10 ? t : slim(t))).slice(0, 120) };
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch {
      // give up quietly; the session still works in memory
    }
  }
}

function set(next: AppState) {
  state = next;
  persist();
  for (const listener of listeners) listener();
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function getState(): AppState {
  return state;
}

export function useStore<T>(selector: (state: AppState) => T): T {
  return useSyncExternalStore(
    subscribe,
    () => selector(state),
    () => selector(state),
  );
}

export function updateSettings(patch: Partial<Settings>): void {
  set({ ...state, settings: { ...state.settings, ...patch } });
}

export function addTake(take: TakeRecord): void {
  // Segments are only needed while a take is live.
  const stored: TakeRecord = { ...take, capture: { ...take.capture, segments: [] } };
  const takes = [stored, ...state.takes].slice(0, MAX_TAKES).map((t, i) => (i < FULL_DETAIL_TAKES ? t : slim(t)));
  set({ ...state, takes });
  void pruneAudio(takes.map((t) => t.id));
}

export function attachAiFeedback(takeId: string, ai: AiFeedback): void {
  set({ ...state, takes: state.takes.map((t) => (t.id === takeId ? { ...t, ai } : t)) });
}

export function deleteTake(takeId: string): void {
  set({ ...state, takes: state.takes.filter((t) => t.id !== takeId) });
  void deleteAudio(takeId);
}

export function markDailyDone(key: string): void {
  if (state.dailyDone.includes(key)) return;
  set({ ...state, dailyDone: [...state.dailyDone, key].slice(-400) });
}

export function resetProgress(): void {
  set({ ...state, takes: [], dailyDone: [] });
  void clearAudio();
}

/** Everything except the API key, as a JSON string for backup. */
export function exportData(): string {
  return JSON.stringify({ ...state, settings: { ...state.settings, apiKey: '' } }, null, 2);
}

export function importData(json: string): void {
  const parsed = JSON.parse(json) as Partial<AppState>;
  if (!parsed || !Array.isArray(parsed.takes)) throw new Error('That file is not an Articulate backup.');
  set({
    settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}), apiKey: state.settings.apiKey },
    takes: parsed.takes.slice(0, MAX_TAKES),
    dailyDone: Array.isArray(parsed.dailyDone) ? parsed.dailyDone : [],
  });
}
