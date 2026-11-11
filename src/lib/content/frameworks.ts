// Speaking frameworks: reusable shapes for an answer. Knowing three or four of these cold
// is most of what "thinking on your feet" actually is.

import type { FrameworkId } from '../types';

export interface FrameworkStep {
  name: string;
  /** What to do in this step. */
  cue: string;
  /** A sentence starter the speaker can borrow. */
  starter: string;
}

export interface Framework {
  id: FrameworkId;
  name: string;
  tagline: string;
  useWhen: string;
  steps: FrameworkStep[];
  example: { prompt: string; answer: string[] };
}

export const FRAMEWORKS: Framework[] = [
  {
    id: 'prep',
    name: 'PREP',
    tagline: 'Point, Reason, Example, Point',
    useWhen: 'Someone asks what you think. The default for opinions, recommendations and quick answers.',
    steps: [
      { name: 'Point', cue: 'State your answer in one sentence.', starter: 'My view is…' },
      { name: 'Reason', cue: 'Give the single strongest reason.', starter: 'The main reason is…' },
      { name: 'Example', cue: 'Prove it with one concrete example.', starter: 'For example…' },
      { name: 'Point', cue: 'Say your answer again, sharper.', starter: 'So that is why…' },
    ],
    example: {
      prompt: 'Should our team move to a four-day week?',
      answer: [
        'Yes, we should pilot it for a quarter.',
        'The main reason is focus: our output depends on deep work, not hours at a desk.',
        'For example, when we ran no-meeting Fridays last year, we shipped the billing rewrite two weeks early.',
        'So a time-boxed pilot is a low-risk way to find out whether that holds for a whole day.',
      ],
    },
  },
  {
    id: 'star',
    name: 'STAR',
    tagline: 'Situation, Task, Action, Result',
    useWhen: 'Behavioural interview questions and any "tell me about a time when" story.',
    steps: [
      { name: 'Situation', cue: 'Set the scene in one or two sentences.', starter: 'Last year…' },
      { name: 'Task', cue: 'Say what you were responsible for.', starter: 'My job was to…' },
      { name: 'Action', cue: 'Describe what you did. This is the longest part.', starter: 'So I…' },
      { name: 'Result', cue: 'Give the outcome, with a number if you can.', starter: 'As a result…' },
    ],
    example: {
      prompt: 'Tell me about a time you handled a difficult stakeholder.',
      answer: [
        'Last spring a key client threatened to leave after two missed deliveries.',
        'I owned the account, so keeping them was my responsibility.',
        'I called their director the same day, agreed a weekly check-in, and moved our best engineer onto their backlog.',
        'As a result we hit the next four milestones, and they renewed for two years.',
      ],
    },
  },
  {
    id: 'wsn',
    name: 'What? So what? Now what?',
    tagline: 'Fact, meaning, next step',
    useWhen: 'Status updates, sharing news or data, and answering "what happened?"',
    steps: [
      { name: 'What', cue: 'State the fact or the news plainly.', starter: 'Here is what happened…' },
      { name: 'So what', cue: 'Explain why it matters to this listener.', starter: 'This matters because…' },
      { name: 'Now what', cue: 'Say what happens next, and who does it.', starter: 'So the next step is…' },
    ],
    example: {
      prompt: 'Give a quick update on the launch.',
      answer: [
        'The launch has moved from the 4th to the 18th.',
        'This matters because the sales campaign was timed to the 4th, so those emails need to hold.',
        'So the next step is for marketing to reschedule today, and I will confirm the new date in writing by noon.',
      ],
    },
  },
  {
    id: 'psb',
    name: 'Problem, Solution, Benefit',
    tagline: 'The shape of every pitch',
    useWhen: 'Pitching an idea, asking for budget, or persuading someone to change.',
    steps: [
      { name: 'Problem', cue: 'Name a problem the listener already feels.', starter: 'Right now…' },
      { name: 'Solution', cue: 'Offer your idea in one sentence.', starter: 'What I propose is…' },
      { name: 'Benefit', cue: 'Describe what gets better, for them.', starter: 'That means…' },
    ],
    example: {
      prompt: 'Pitch a change to how your team runs meetings.',
      answer: [
        'Right now we spend six hours a week in status meetings, and most of us are only needed for ten minutes of each.',
        'What I propose is a written update every Monday and one thirty-minute call for decisions only.',
        'That means each of us gets about five hours back every week, and decisions stop waiting for the next meeting.',
      ],
    },
  },
  {
    id: 'ppf',
    name: 'Past, Present, Future',
    tagline: 'Where it was, where it is, where it goes',
    useWhen: 'Introducing yourself, describing a project, or giving a reflective answer.',
    steps: [
      { name: 'Past', cue: 'Say where things started.', starter: 'I started out…' },
      { name: 'Present', cue: 'Say where things stand today.', starter: 'Today…' },
      { name: 'Future', cue: 'Say where you are headed.', starter: 'Next, I want to…' },
    ],
    example: {
      prompt: 'Tell me about yourself.',
      answer: [
        'I started out as a support agent, which taught me to explain technical things simply.',
        'Today I lead a product team of six, building the tools I used to wish I had.',
        'Next, I want to take on a product line of my own, which is why this role caught my eye.',
      ],
    },
  },
  {
    id: 'pyramid',
    name: 'Answer first',
    tagline: 'Conclusion, three supports, recap',
    useWhen: 'Briefing a busy senior person, or any time you are tempted to "give some background".',
    steps: [
      { name: 'Answer', cue: 'Lead with the conclusion or the ask.', starter: 'The short answer is…' },
      { name: 'Support', cue: 'Give two or three reasons, numbered out loud.', starter: 'Three reasons. First…' },
      { name: 'Recap', cue: 'Repeat the answer and what you need.', starter: 'So my recommendation is…' },
    ],
    example: {
      prompt: 'Should we build this in-house or buy it?',
      answer: [
        'The short answer is buy.',
        'Three reasons. First, it is live in four weeks instead of six months. Second, it costs less than one engineer. Third, we can still replace it later.',
        'So my recommendation is to buy, and I need your sign-off on the contract this week.',
      ],
    },
  },
  {
    id: 'sbi',
    name: 'SBI feedback',
    tagline: 'Situation, Behaviour, Impact, Next',
    useWhen: 'Giving feedback, positive or critical, without making it personal.',
    steps: [
      { name: 'Situation', cue: 'Name the specific moment.', starter: 'In yesterday’s review…' },
      { name: 'Behaviour', cue: 'Describe what they did. Facts, not judgement.', starter: 'You…' },
      { name: 'Impact', cue: 'Say what effect it had.', starter: 'The effect was…' },
      { name: 'Next', cue: 'Ask for, or agree, what happens next time.', starter: 'Next time, could you…' },
    ],
    example: {
      prompt: 'Give feedback to a colleague who interrupts in meetings.',
      answer: [
        'In yesterday’s planning meeting,',
        'you cut in on Priya twice before she had finished her estimate.',
        'The effect was that she stopped contributing, and we left without her numbers.',
        'Next time, could you let people finish and then ask your question?',
      ],
    },
  },
  {
    id: 'abc',
    name: 'Acknowledge, Bridge, Commit',
    tagline: 'For hard questions and pushback',
    useWhen: 'A hostile question, an objection, or a question you cannot fully answer.',
    steps: [
      { name: 'Acknowledge', cue: 'Show you heard the concern. Do not argue yet.', starter: 'That is a fair concern…' },
      { name: 'Bridge', cue: 'Move to what you do know or can stand behind.', starter: 'What I can tell you is…' },
      { name: 'Commit', cue: 'Say exactly what you will do, and by when.', starter: 'Here is what I will do…' },
    ],
    example: {
      prompt: 'Why is this project three weeks late?',
      answer: [
        'That is a fair concern, and the delay is on us.',
        'What I can tell you is the cause: the vendor integration failed security review, and it is now fixed.',
        'Here is what I will do: send you a revised plan by Friday, with a weekly checkpoint so you are never surprised again.',
      ],
    },
  },
  {
    id: 'story',
    name: 'Story arc',
    tagline: 'Hook, struggle, turn, takeaway',
    useWhen: 'Toasts, talks, and any moment where a story will persuade better than an argument.',
    steps: [
      { name: 'Hook', cue: 'Drop the listener into a specific moment.', starter: 'It was 2 a.m. and…' },
      { name: 'Struggle', cue: 'Show what was hard or at stake.', starter: 'The problem was…' },
      { name: 'Turn', cue: 'Describe the moment things changed.', starter: 'Then…' },
      { name: 'Takeaway', cue: 'Say what it taught you, in one line.', starter: 'What I learned is…' },
    ],
    example: {
      prompt: 'Tell a story about a lesson you learned the hard way.',
      answer: [
        'It was 2 a.m. and I was rewriting a presentation for the fifth time.',
        'The problem was I had forty slides and no idea what I actually wanted to say.',
        'Then my manager asked me one question: if they remember one sentence, what is it?',
        'What I learned is to write that sentence first, and build everything else around it.',
      ],
    },
  },
];

const BY_ID = new Map(FRAMEWORKS.map((f) => [f.id, f]));

export function getFramework(id: FrameworkId): Framework {
  const framework = BY_ID.get(id);
  if (!framework) throw new Error(`Unknown framework: ${id}`);
  return framework;
}
