// The plan currently being practised. Held in memory: a session is a live activity and
// does not survive a reload (the takes inside it are saved as they finish).

import { useSyncExternalStore } from 'react';
import type { Plan } from './types';

let current: Plan | null = null;
const listeners = new Set<() => void>();

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

export function setPlan(plan: Plan | null): void {
  current = plan;
  for (const listener of listeners) listener();
}

export function getPlan(): Plan | null {
  return current;
}

export function usePlan(): Plan | null {
  return useSyncExternalStore(subscribe, getPlan, getPlan);
}
