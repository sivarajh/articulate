// Optional AI coach. The app scores delivery on its own; with an Anthropic API key the
// learner can also get feedback on content — what the numbers cannot see — and generate
// practice questions for any situation they describe.
//
// The key is supplied by the user and stays in their browser; requests go straight from
// the browser to the Anthropic API. The SDK is loaded on demand so it costs nothing
// until the coach is used.

import { z } from 'zod';
import type { AiFeedback, Analysis, Exercise, FrameworkId, Scenario } from '../types';
import { FRAMEWORKS } from '../content/frameworks';
import { COACH_SYSTEM, MODEL, SCENARIO_SYSTEM, describeSituation, describeTake } from './prompt';

export type CoachErrorKind = 'auth' | 'rate' | 'network' | 'declined' | 'other';

export class CoachError extends Error {
  readonly kind: CoachErrorKind;
  constructor(kind: CoachErrorKind, message: string) {
    super(message);
    this.name = 'CoachError';
    this.kind = kind;
  }
}

const FeedbackSchema = z.object({
  headline: z.string(),
  strengths: z.array(z.string()),
  improvements: z.array(z.object({ issue: z.string(), fix: z.string() })),
  rewrite: z.string(),
  followUp: z.string(),
});

const FRAMEWORK_IDS = FRAMEWORKS.map((f) => f.id) as [FrameworkId, ...FrameworkId[]];

const ScenarioSchema = z.object({
  title: z.string(),
  questions: z.array(z.string()),
  framework: z.enum(FRAMEWORK_IDS),
});

export type { Scenario };

async function ask<T>(apiKey: string, system: string, user: string, schema: z.ZodType<T>): Promise<T> {
  const [{ default: Anthropic }, { betaZodOutputFormat }] = await Promise.all([
    import('@anthropic-ai/sdk'),
    import('@anthropic-ai/sdk/helpers/beta/zod'),
  ]);
  // The key belongs to the person using the app and never leaves their browser except
  // to call the API directly, which is the case this flag exists for.
  const client = new Anthropic({ apiKey, dangerouslyAllowBrowser: true });

  try {
    const response = await client.beta.messages.parse({
      model: MODEL,
      max_tokens: 16000,
      // If a safety classifier declines the request, let the API retry it on a fallback model.
      betas: ['server-side-fallback-2026-07-01'],
      fallbacks: 'default',
      system,
      messages: [{ role: 'user', content: user }],
      output_config: { effort: 'medium', format: betaZodOutputFormat(schema) },
    });
    if (response.stop_reason === 'refusal') {
      throw new CoachError('declined', 'The coach declined to review this take.');
    }
    if (response.stop_reason === 'max_tokens' || !response.parsed_output) {
      throw new CoachError('other', 'The coach’s reply was incomplete. Try again.');
    }
    return response.parsed_output;
  } catch (error) {
    if (error instanceof CoachError) throw error;
    if (error instanceof Anthropic.AuthenticationError || error instanceof Anthropic.PermissionDeniedError) {
      throw new CoachError('auth', 'That API key was rejected. Check it in Settings.');
    }
    if (error instanceof Anthropic.RateLimitError) {
      throw new CoachError('rate', 'The API is rate-limiting this key. Wait a moment and try again.');
    }
    if (error instanceof Anthropic.APIConnectionError) {
      throw new CoachError('network', 'Could not reach the API. Check your connection and try again.');
    }
    if (error instanceof Anthropic.APIError) {
      throw new CoachError('other', `The API returned an error (${error.status ?? 'unknown'}). Try again.`);
    }
    throw new CoachError('other', 'Something went wrong asking the coach.');
  }
}

/** Content-level feedback on one take. */
export async function coachTake(
  apiKey: string,
  exercise: Exercise,
  transcript: string,
  analysis: Analysis,
): Promise<AiFeedback> {
  return ask(apiKey, COACH_SYSTEM, describeTake(exercise, transcript, analysis), FeedbackSchema);
}

/** Five practice questions for a situation the learner describes. */
export async function generateScenario(apiKey: string, situation: string): Promise<Scenario> {
  const scenario = await ask(apiKey, SCENARIO_SYSTEM, describeSituation(situation), ScenarioSchema);
  const questions = scenario.questions.map((q) => q.trim()).filter(Boolean).slice(0, 6);
  if (!questions.length) throw new CoachError('other', 'The coach did not return any questions. Try again.');
  return { title: scenario.title.trim() || 'Your situation', questions, framework: scenario.framework };
}
