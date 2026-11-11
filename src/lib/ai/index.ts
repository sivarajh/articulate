// Lazy front door to the AI coach, so the Anthropic SDK and schema library are only
// downloaded when someone actually uses the coach.

import type { AiFeedback, Analysis, Exercise } from '../types';
import type { Scenario } from './coach';

export type { Scenario };

export async function coachTake(apiKey: string, exercise: Exercise, transcript: string, analysis: Analysis): Promise<AiFeedback> {
  const coach = await import('./coach');
  return coach.coachTake(apiKey, exercise, transcript, analysis);
}

export async function generateScenario(apiKey: string, situation: string): Promise<Scenario> {
  const coach = await import('./coach');
  return coach.generateScenario(apiKey, situation);
}

/** The coach's own errors carry a message written for the user; anything else gets the fallback. */
export function coachErrorMessage(error: unknown, fallback: string): string {
  return error instanceof Error && error.name === 'CoachError' ? error.message : fallback;
}
