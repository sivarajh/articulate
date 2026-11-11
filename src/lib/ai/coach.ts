// Optional AI coach. The app scores delivery on its own; with an Anthropic API key the
// learner can also get feedback on content — what the numbers cannot see — and generate
// practice questions for any situation they describe.
//
// The key is supplied by the user and stays in their browser; requests go straight from
// the browser to the Anthropic API. The SDK is loaded on demand so it costs nothing
// until the coach is used.

import { z } from 'zod';
import type { AiFeedback, Analysis, Exercise, FrameworkId } from '../types';
import { FRAMEWORKS, getFramework } from '../content/frameworks';

const MODEL = 'claude-opus-5-5';

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

export interface Scenario {
  title: string;
  questions: string[];
  framework: FrameworkId;
}

const COACH_SYSTEM = `You are a speaking coach reviewing one practice take from a learner who is training to speak clearly and persuasively without notes. You receive the prompt they answered, the time they had, a transcript made by speech recognition, and delivery metrics the app measured.

The transcript is machine-made. It has little punctuation and may contain mis-heard words, so never comment on punctuation, spelling or capitalisation, and give the speaker the benefit of the doubt on an odd word. The app already reports fillers, pace and pauses in detail. Spend your attention on what it cannot measure: whether the answer addressed the prompt, how the ideas were ordered, how specific and concrete the content was, word choice, and how the take opened and closed.

Be specific and honest. Quote the speaker's own words when you point at something. Leave out generic advice and any praise that would fit every speech.

Fill in the fields like this:
- headline: one sentence naming the single most important thing about this take.
- strengths: two or three things that worked, one sentence each, each tied to something they actually said.
- improvements: the two or three changes that would most improve the next attempt. "issue" says what happened. "fix" says exactly what to do instead, with example wording where that helps.
- rewrite: the same answer as it could have been delivered. Keep the speaker's own facts, stories and opinions and invent nothing about their life. Restructure and tighten it so that, spoken aloud at a natural pace, it fits the time allowed. Write for the ear: short sentences, plain words, no bullet points.
- followUp: one question a sharp listener would ask next, so the learner can practise answering it.

If the transcript is too short or too garbled to judge, say so in the headline and keep everything else brief.`;

const SCENARIO_SYSTEM = `You design realistic speaking practice. The learner describes a situation they are preparing for. Write five things the other person in that situation might actually say or ask, ordered from the natural opening to the hardest moment. Each one must be something the learner can answer aloud in about a minute, and each is phrased the way the other person would say it, in the second person.

Also give the scenario a title of two to four words, and choose the framework that suits most of the answers:
${FRAMEWORKS.map((f) => `- ${f.id}: ${f.name} (${f.tagline}). ${f.useWhen}`).join('\n')}`;

function describeTake(exercise: Exercise, transcript: string, analysis: Analysis): string {
  const lines: string[] = [];
  lines.push(`Prompt: ${exercise.prompt}`);
  lines.push(`Exercise: ${exercise.title} (${exercise.tag}). Time allowed: ${exercise.speakSec} seconds. Preparation time: ${exercise.prepSec} seconds.`);
  if (exercise.context) lines.push(`Instruction shown to the speaker: ${exercise.context}`);
  if (exercise.frameworkId) {
    const framework = getFramework(exercise.frameworkId);
    lines.push(`Suggested framework: ${framework.name} (${framework.steps.map((s) => s.name).join(', ')}).`);
  }
  if (exercise.taboo?.length) lines.push(`Words the speaker was not allowed to say: ${exercise.taboo.join(', ')}.`);
  if (exercise.mustUse?.length) lines.push(`Words the speaker was asked to use: ${exercise.mustUse.join(', ')}.`);

  const measured: string[] = [`${analysis.words} words in ${Math.round(analysis.speakingSec)} seconds`];
  if (analysis.wpm != null) measured.push(`${analysis.wpm} words a minute`);
  measured.push(
    analysis.fillers
      ? `${analysis.fillers} fillers (${analysis.topFillers.map(([w, n]) => `${w} x${n}`).join(', ')})`
      : 'no fillers',
  );
  if (analysis.hedges) measured.push(`${analysis.hedges} hedging phrases`);
  if (analysis.pauses?.long) measured.push(`${analysis.pauses.long} long stalls`);
  if (analysis.overall != null) measured.push(`app score ${analysis.overall}/100`);
  lines.push(`Measured by the app: ${measured.join('; ')}.`);

  lines.push('', 'Transcript:', '"""', transcript.trim(), '"""');
  return lines.join('\n');
}

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
  const scenario = await ask(apiKey, SCENARIO_SYSTEM, `The situation I am preparing for:\n\n${situation.trim()}`, ScenarioSchema);
  const questions = scenario.questions.map((q) => q.trim()).filter(Boolean).slice(0, 6);
  if (!questions.length) throw new CoachError('other', 'The coach did not return any questions. Try again.');
  return { title: scenario.title.trim() || 'Your situation', questions, framework: scenario.framework };
}
