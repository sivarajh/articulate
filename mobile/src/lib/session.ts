// The plan currently being practised, held in memory while the session screen is open.

import { router } from 'expo-router';
import { useSyncExternalStore } from 'react';
import type { Plan } from '@core/types';

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

/** Open the session screen on a plan. */
export function startPlan(plan: Plan): void {
  setPlan(plan);
  router.push('/session');
}
