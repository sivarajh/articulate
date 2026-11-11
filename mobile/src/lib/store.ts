// App state for the mobile app: settings and take history in AsyncStorage, the API key
// in the device keychain, recordings as files. Same shape and same tiny-store pattern
// as the web app, with an asynchronous first load.

import AsyncStorage from '@react-native-async-storage/async-storage';
import { File } from 'expo-file-system';
import * as SecureStore from 'expo-secure-store';
import { useSyncExternalStore } from 'react';
import { Platform } from 'react-native';
import { DEFAULT_SETTINGS, type AiFeedback, type Settings, type TakeRecord } from '@core/types';

/** A take plus the recording files the device saved for it. */
export type StoredTake = TakeRecord & { audio?: string[] };

export interface AppState {
  settings: Settings;
  /** Newest first. */
  takes: StoredTake[];
  /** Days (YYYY-MM-DD) on which the daily workout was finished. */
  dailyDone: string[];
}

const KEY = 'articulate:v1';
const API_KEY = 'articulate.apiKey';
const MAX_TAKES = 250;
/** Older takes keep their scores and transcript but drop timing detail and recordings. */
const FULL_DETAIL_TAKES = 40;

let state: AppState = { settings: { ...DEFAULT_SETTINGS }, takes: [], dailyDone: [] };
let hydrated = false;
const listeners = new Set<() => void>();

const secure = Platform.OS !== 'web';

async function readApiKey(): Promise<string> {
  try {
    return (secure ? await SecureStore.getItemAsync(API_KEY) : await AsyncStorage.getItem(API_KEY)) ?? '';
  } catch {
    return '';
  }
}

async function writeApiKey(value: string): Promise<void> {
  try {
    if (secure) {
      if (value) await SecureStore.setItemAsync(API_KEY, value);
      else await SecureStore.deleteItemAsync(API_KEY);
    } else if (value) await AsyncStorage.setItem(API_KEY, value);
    else await AsyncStorage.removeItem(API_KEY);
  } catch {
    // the key simply will not persist
  }
}

/** Load saved state. Call once before rendering the app. */
export async function hydrate(): Promise<void> {
  if (hydrated) return;
  try {
    const [raw, apiKey] = await Promise.all([AsyncStorage.getItem(KEY), readApiKey()]);
    const parsed = raw ? (JSON.parse(raw) as Partial<AppState>) : {};
    state = {
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings ?? {}), apiKey },
      takes: Array.isArray(parsed.takes) ? parsed.takes : [],
      dailyDone: Array.isArray(parsed.dailyDone) ? parsed.dailyDone : [],
    };
  } catch {
    // start fresh rather than refuse to open
  }
  hydrated = true;
  for (const listener of listeners) listener();
}

function persist() {
  // The API key never goes into general storage.
  const snapshot: AppState = { ...state, settings: { ...state.settings, apiKey: '' } };
  void AsyncStorage.setItem(KEY, JSON.stringify(snapshot)).catch(() => undefined);
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

function deleteFiles(uris: string[] | undefined) {
  for (const uri of uris ?? []) {
    try {
      const file = new File(uri);
      if (file.exists) file.delete();
    } catch {
      // already gone
    }
  }
}

function slim(take: StoredTake): StoredTake {
  if (!take.audio?.length && !take.capture.wordTimeline.length && !take.capture.voice?.levels.length) return take;
  deleteFiles(take.audio);
  return {
    ...take,
    audio: undefined,
    capture: {
      ...take.capture,
      wordTimeline: [],
      voice: take.capture.voice ? { ...take.capture.voice, levels: [] } : null,
    },
  };
}

export function updateSettings(patch: Partial<Settings>): void {
  if (patch.apiKey !== undefined && patch.apiKey !== state.settings.apiKey) void writeApiKey(patch.apiKey);
  set({ ...state, settings: { ...state.settings, ...patch } });
}

export function addTake(take: StoredTake): void {
  const stored: StoredTake = { ...take, capture: { ...take.capture, segments: [] } };
  const all = [stored, ...state.takes];
  for (const dropped of all.slice(MAX_TAKES)) deleteFiles(dropped.audio);
  set({ ...state, takes: all.slice(0, MAX_TAKES).map((t, i) => (i < FULL_DETAIL_TAKES ? t : slim(t))) });
}

export function attachAiFeedback(takeId: string, ai: AiFeedback): void {
  set({ ...state, takes: state.takes.map((t) => (t.id === takeId ? { ...t, ai } : t)) });
}

export function deleteTake(takeId: string): void {
  deleteFiles(state.takes.find((t) => t.id === takeId)?.audio);
  set({ ...state, takes: state.takes.filter((t) => t.id !== takeId) });
}

export function markDailyDone(key: string): void {
  if (state.dailyDone.includes(key)) return;
  set({ ...state, dailyDone: [...state.dailyDone, key].slice(-400) });
}

export function resetProgress(): void {
  for (const take of state.takes) deleteFiles(take.audio);
  set({ ...state, takes: [], dailyDone: [] });
}
