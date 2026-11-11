// The optional AI coach on mobile. The official Anthropic SDK does not support React
// Native, so this calls the Messages API over plain HTTPS. The instructions and the
// description of the take come from the shared core, so web and mobile ask for exactly
// the same thing.

import { COACH_SYSTEM, MODEL, SCENARIO_SYSTEM, describeSituation, describeTake } from '@core/ai/prompt';
import { FRAMEWORKS } from '@core/content/frameworks';
import type { AiFeedback, Analysis, Exercise, FrameworkId, Scenario } from '@core/types';

const ENDPOINT = 'https://api.anthropic.com/v1/messages';
const API_VERSION = '2026-10-21';
/** Structured output, plus the server-side fallback used if a safety classifier declines. */
const BETAS = 'server-side-fallback-2026-07-01,structured-outputs-2025-12-15';

export class CoachError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CoachError';
  }
}

type JsonSchema = Record<string, unknown>;

const text = { type: 'string' };
const object = (properties: Record<string, JsonSchema>): JsonSchema => ({
  type: 'object',
  properties,
  required: Object.keys(properties),
  additionalProperties: false,
});

const FEEDBACK_SCHEMA = object({
  headline: text,
  strengths: { type: 'array', items: text },
  improvements: { type: 'array', items: object({ issue: text, fix: text }) },
  rewrite: text,
  followUp: text,
});

const SCENARIO_SCHEMA = object({
  title: text,
  questions: { type: 'array', items: text },
  framework: { type: 'string', enum: FRAMEWORKS.map((f) => f.id) },
});

interface MessageResponse {
  stop_reason?: string;
  content?: { type: string; text?: string }[];
}

async function ask(apiKey: string, system: string, user: string, schema: JsonSchema): Promise<unknown> {
  let response: Response;
  try {
    response = await fetch(ENDPOINT, {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': API_VERSION,
        'anthropic-beta': BETAS,
        // Only consulted when this bundle runs in a browser (Expo web).
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 16000,
        fallbacks: 'default',
        system,
        messages: [{ role: 'user', content: user }],
        output_config: { effort: 'medium', format: { type: 'json_schema', schema } },
      }),
    });
  } catch {
    throw new CoachError('Could not reach the API. Check your connection and try again.');
  }

  if (response.status === 401 || response.status === 403) {
    throw new CoachError('That API key was rejected. Check it in Settings.');
  }
  if (response.status === 429) throw new CoachError('The API is rate-limiting this key. Wait a moment and try again.');
  if (!response.ok) throw new CoachError(`The API returned an error (${response.status}). Try again.`);

  let message: MessageResponse;
  try {
    message = (await response.json()) as MessageResponse;
  } catch {
    throw new CoachError('The coach’s reply could not be read. Try again.');
  }
  if (message.stop_reason === 'refusal') throw new CoachError('The coach declined to review this take.');
  const reply = message.content?.find((block) => block.type === 'text')?.text;
  if (message.stop_reason === 'max_tokens' || !reply) throw new CoachError('The coach’s reply was incomplete. Try again.');
  try {
    return JSON.parse(reply);
  } catch {
    throw new CoachError('The coach’s reply could not be read. Try again.');
  }
}

const isString = (value: unknown): value is string => typeof value === 'string';
const strings = (value: unknown): string[] => (Array.isArray(value) ? value.filter(isString) : []);

export async function coachTake(apiKey: string, exercise: Exercise, transcript: string, analysis: Analysis): Promise<AiFeedback> {
  const raw = (await ask(apiKey, COACH_SYSTEM, describeTake(exercise, transcript, analysis), FEEDBACK_SCHEMA)) as Record<string, unknown> | null;
  if (!raw || !isString(raw.headline)) throw new CoachError('The coach’s reply could not be read. Try again.');
  const improvements = Array.isArray(raw.improvements) ? raw.improvements : [];
  return {
    headline: raw.headline,
    strengths: strings(raw.strengths),
    improvements: improvements
      .filter((item): item is { issue: string; fix: string } => !!item && isString(item.issue) && isString(item.fix))
      .map(({ issue, fix }) => ({ issue, fix })),
    rewrite: isString(raw.rewrite) ? raw.rewrite : '',
    followUp: isString(raw.followUp) ? raw.followUp : '',
  };
}

export async function generateScenario(apiKey: string, situation: string): Promise<Scenario> {
  const raw = (await ask(apiKey, SCENARIO_SYSTEM, describeSituation(situation), SCENARIO_SCHEMA)) as Record<string, unknown> | null;
  const questions = strings(raw?.questions)
    .map((q) => q.trim())
    .filter(Boolean)
    .slice(0, 6);
  if (!questions.length) throw new CoachError('The coach did not return any questions. Try again.');
  const framework = FRAMEWORKS.some((f) => f.id === raw?.framework) ? (raw!.framework as FrameworkId) : 'prep';
  return { title: isString(raw?.title) && raw.title.trim() ? raw.title.trim() : 'Your situation', questions, framework };
}

export function coachErrorMessage(error: unknown, fallback: string): string {
  return error instanceof CoachError ? error.message : fallback;
}
