// Short lessons: the handful of principles that account for most of what makes a
// speaker sound clear. Each one points at a drill that trains it.

import type { DrillId, SkillId } from '../types';

export interface Lesson {
  id: string;
  title: string;
  skill: SkillId;
  /** The whole idea in one sentence. */
  idea: string;
  body: string[];
  before: string;
  after: string;
  drill: DrillId;
}

export const LESSONS: Lesson[] = [
  {
    id: 'answer-first',
    title: 'Answer first',
    skill: 'structure',
    idea: 'Lead with your conclusion, then earn it.',
    body: [
      'When we are unsure, we give background first and hope a conclusion appears by the end. The listener hears a story with no destination and stops listening before you arrive.',
      'Reverse the order. Say the answer in your first sentence, then give the reasons. If you are cut off after ten seconds, the important part has already been said.',
    ],
    before:
      'So, we looked at a few vendors, and there were some issues with the first one, and the pricing changed on the second, so after a lot of back and forth…',
    after: 'We should go with the third vendor. It is the cheapest, and it is the only one that passed security review.',
    drill: 'hot-seat',
  },
  {
    id: 'pause',
    title: 'Pause instead of filling',
    skill: 'fluency',
    idea: 'A filler is a pause you were afraid to take.',
    body: [
      'Um, uh and like are the sounds we make to hold the floor while we think. To you the silence would feel endless. To a listener, a one-second pause sounds like thought, and a filler sounds like doubt.',
      'You do not remove fillers by trying not to say them. You replace them. When you feel one coming, close your mouth, breathe in through your nose, and start the next sentence when it is ready.',
    ],
    before: 'I think, um, the main issue is, like, we, uh, never really agreed on the goal.',
    after: 'The main issue… is that we never agreed on the goal.',
    drill: 'filler-free',
  },
  {
    id: 'one-thought',
    title: 'One thought per sentence',
    skill: 'clarity',
    idea: 'Short sentences are easy to say and easy to follow.',
    body: [
      'Long sentences are where speakers get lost. You start one idea, attach a second with "and", a third with "which", and by the end neither of you remembers where it began.',
      'End the sentence. Start another. A full stop is free, and each one gives you a moment to choose what comes next.',
    ],
    before:
      'The launch went well and we had a lot of sign-ups which was great although the server did struggle a bit so we are looking at that.',
    after: 'The launch went well. Sign-ups beat our target. The server struggled, and we are fixing that this week.',
    drill: 'shrink-it',
  },
  {
    id: 'signpost',
    title: 'Signpost your structure',
    skill: 'structure',
    idea: 'Listeners cannot see your outline, so say it out loud.',
    body: [
      'A reader can glance at headings. A listener has only your voice. Small phrases such as "two reasons", "for example" and "so the point is" work as spoken headings.',
      'They also help you. Saying "three things" commits you to a shape, and the shape carries you through the answer.',
    ],
    before: 'It is cheaper and also the team already knows it and the support is good.',
    after: 'Three reasons. First, it is cheaper. Second, the team already knows it. Third, the support is excellent.',
    drill: 'framework',
  },
  {
    id: 'concrete',
    title: 'Make it concrete',
    skill: 'clarity',
    idea: 'One specific example beats three general claims.',
    body: [
      'Abstract words such as "improve", "issues" and "a lot" slide past a listener. A number, a name or a moment sticks.',
      'Whenever you make a claim, follow it with "for example". If no example comes to mind, the claim may not be as solid as it sounded.',
    ],
    before: 'Customer satisfaction has improved a lot since we made some changes to support.',
    after: 'Since we started answering every ticket within a day, complaints have halved, from forty a week to twenty.',
    drill: 'analogy',
  },
  {
    id: 'hedges',
    title: 'Cut the hedges',
    skill: 'clarity',
    idea: 'Say what you think without asking permission to think it.',
    body: [
      '"I think", "sort of", "maybe" and "I guess" feel polite. Stacked together they tell the listener you do not trust your own point, so they stop trusting it too.',
      'Keep a hedge when you are honestly uncertain, and say why. Otherwise state the point plainly. Confidence in speech is mostly the absence of these small retreats.',
    ],
    before: 'I just think maybe we could sort of consider pushing the date a little bit.',
    after: 'We should move the date by two weeks.',
    drill: 'taboo',
  },
  {
    id: 'rule-of-three',
    title: 'Use the rule of three',
    skill: 'structure',
    idea: 'Three points feel complete. Two feel thin, and four are forgotten.',
    body: [
      'Listeners hold about three items comfortably. That is why so many memorable lines come in threes.',
      'When you have many points, choose the best three. When you have one, look for its three parts: what, why and how, or past, present and future.',
    ],
    before: 'There are lots of benefits, like speed, cost, reliability, support, security, and it is easier to hire for.',
    after: 'It is faster, cheaper and safer.',
    drill: 'word-bridge',
  },
  {
    id: 'ending',
    title: 'Land the ending',
    skill: 'structure',
    idea: 'Your last sentence is the one they remember. Choose it.',
    body: [
      'Most answers do not end. They fade out with "so, yeah" or "that is about it". The speaker ran out of words and hoped someone else would speak.',
      'Decide your last line before you start. The simplest version is to repeat your main point in fresh words, and then stop. The silence afterwards is yours, and it belongs there.',
    ],
    before: '…and that is kind of where we are with it, so, yeah.',
    after: '…so the decision in front of us is simple: ship on Friday, or fix it properly and ship in two weeks. I recommend two weeks.',
    drill: 'hot-seat',
  },
  {
    id: 'pace',
    title: 'Choose your speed',
    skill: 'pace',
    idea: 'Fast sounds nervous. Steady sounds sure.',
    body: [
      'Conversational English runs at roughly 130 to 165 words a minute. Under pressure most people climb well above that without noticing, and their listener quietly falls behind.',
      'Slow down most at the two places that matter: your first sentence and your key point. Everywhere else, a steady pace with real stops at the end of sentences is enough.',
    ],
    before: 'A minute of speech delivered in forty seconds.',
    after: 'The same words, with a breath at every full stop.',
    drill: 'pace-lock',
  },
  {
    id: 'buy-time',
    title: 'Buy time out loud',
    skill: 'fluency',
    idea: 'When you need a moment, take it deliberately.',
    body: [
      'Being put on the spot is not a test of speed. You are allowed a few seconds, and there are graceful ways to take them.',
      'Restate the question as the start of your answer. Name the shape you will use: "There are two parts to that." Or simply say, "Let me think about that for a second." Each one sounds composed, and each one buys you time to find your first point.',
    ],
    before: 'Uh… so… hmm, that is, um, a good question…',
    after: 'The biggest risk to the project? There are two, and I will start with the larger one.',
    drill: 'hot-seat',
  },
  {
    id: 'voice',
    title: 'Let your voice move',
    skill: 'delivery',
    idea: 'Emphasis is how a listener knows what matters.',
    body: [
      'A flat voice makes every word equally important, which means none of them are. Variety in pitch and volume, and above all in pausing, is how you underline when you speak.',
      'Pick one word in each sentence to lean on. Let your voice fall at the end of a statement, since rising makes it sound like a question. Before your most important line, stop for a full beat.',
    ],
    before: 'we increased revenue by forty percent this year',
    after: 'We increased revenue… by forty percent. This year.',
    drill: 'power-pause',
  },
  {
    id: 'precise-words',
    title: 'Reach for the exact word',
    skill: 'vocabulary',
    idea: 'A precise word does the work of a whole vague sentence.',
    body: [
      '"Thing", "stuff", "good" and "very" are placeholders. They mark the spot where a better word would go.',
      'You do not need rare words. You need the right ordinary one: "fragile" in place of "not very strong", "bottleneck" in place of "the thing slowing us down". Vocabulary only counts when it is available at speaking speed, and that comes from using words aloud.',
    ],
    before: 'The meeting was really good and we got a lot of stuff done.',
    after: 'The meeting was decisive. We agreed the budget and set the launch date.',
    drill: 'word-weave',
  },
];

export function getLesson(id: string): Lesson | undefined {
  return LESSONS.find((l) => l.id === id);
}
