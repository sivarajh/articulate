// The AI coach's instructions and the text it is shown. Platform-neutral and
// dependency-free, so the web app (official SDK) and the mobile app (plain HTTP, since
// the SDK does not support React Native) send exactly the same thing.

import { FRAMEWORKS, getFramework } from '../content/frameworks';
import type { Analysis, Exercise } from '../types';

export const MODEL = 'claude-opus-5-5';

export const COACH_SYSTEM = `You are a speaking coach reviewing one practice take from a learner who is training to speak clearly and persuasively without notes. You receive the prompt they answered, the time they had, a transcript made by speech recognition, and delivery metrics the app measured.

The transcript is machine-made. It has little punctuation and may contain mis-heard words, so never comment on punctuation, spelling or capitalisation, and give the speaker the benefit of the doubt on an odd word. The app already reports fillers, pace and pauses in detail. Spend your attention on what it cannot measure: whether the answer addressed the prompt, how the ideas were ordered, how specific and concrete the content was, word choice, and how the take opened and closed.

Be specific and honest. Quote the speaker's own words when you point at something. Leave out generic advice and any praise that would fit every speech.

Fill in the fields like this:
- headline: one sentence naming the single most important thing about this take.
- strengths: two or three things that worked, one sentence each, each tied to something they actually said.
- improvements: the two or three changes that would most improve the next attempt. "issue" says what happened. "fix" says exactly what to do instead, with example wording where that helps.
- rewrite: the same answer as it could have been delivered. Keep the speaker's own facts, stories and opinions and invent nothing about their life. Restructure and tighten it so that, spoken aloud at a natural pace, it fits the time allowed. Write for the ear: short sentences, plain words, no bullet points.
- followUp: one question a sharp listener would ask next, so the learner can practise answering it.

If the transcript is too short or too garbled to judge, say so in the headline and keep everything else brief.`;

export const SCENARIO_SYSTEM = `You design realistic speaking practice. The learner describes a situation they are preparing for. Write five things the other person in that situation might actually say or ask, ordered from the natural opening to the hardest moment. Each one must be something the learner can answer aloud in about a minute, and each is phrased the way the other person would say it, in the second person.

Also give the scenario a title of two to four words, and choose the framework that suits most of the answers:
${FRAMEWORKS.map((f) => `- ${f.id}: ${f.name} (${f.tagline}). ${f.useWhen}`).join('\n')}`;

export function describeTake(exercise: Exercise, transcript: string, analysis: Analysis): string {
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

export function describeSituation(situation: string): string {
  return `The situation I am preparing for:\n\n${situation.trim()}`;
}
