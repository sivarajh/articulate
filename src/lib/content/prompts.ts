// The prompt library: real situations people have to speak in, grouped so a learner can
// train for the ones they actually face.

import type { FrameworkId } from '../types';

export type CategoryId =
  | 'interview'
  | 'work'
  | 'leadership'
  | 'persuade'
  | 'explain'
  | 'opinion'
  | 'story'
  | 'social'
  | 'tough'
  | 'wild';

export interface Category {
  id: CategoryId;
  label: string;
  blurb: string;
  /** The framework that fits most prompts in this category. */
  framework: FrameworkId;
}

export const CATEGORIES: Category[] = [
  { id: 'interview', label: 'Job interview', blurb: 'Answers that sound prepared, not rehearsed', framework: 'star' },
  { id: 'work', label: 'Meetings & updates', blurb: 'Say what matters, then stop', framework: 'wsn' },
  { id: 'leadership', label: 'Leading & feedback', blurb: 'Direct, kind and specific', framework: 'sbi' },
  { id: 'persuade', label: 'Pitch & persuade', blurb: 'Move someone to yes', framework: 'psb' },
  { id: 'explain', label: 'Explain it simply', blurb: 'Make a hard idea easy', framework: 'pyramid' },
  { id: 'opinion', label: 'Take a stand', blurb: 'A clear view, backed up', framework: 'prep' },
  { id: 'story', label: 'Tell a story', blurb: 'Hold attention from the first line', framework: 'story' },
  { id: 'social', label: 'Social & small talk', blurb: 'Warm, easy and interesting', framework: 'ppf' },
  { id: 'tough', label: 'Tough moments', blurb: 'Stay composed when it is hard', framework: 'abc' },
  { id: 'wild', label: 'Wildcards', blurb: 'Pure thinking on your feet', framework: 'prep' },
];

export interface Prompt {
  text: string;
  category: CategoryId;
  framework?: FrameworkId;
}

const P = (category: CategoryId, framework: FrameworkId | undefined, texts: string[]): Prompt[] =>
  texts.map((text) => ({ text, category, framework }));

export const PROMPTS: Prompt[] = [
  ...P('interview', 'ppf', [
    'Tell me about yourself.',
    'Walk me through your career so far and where you want it to go.',
    'Why do you want this role?',
    'Where do you see yourself in five years?',
  ]),
  ...P('interview', 'star', [
    'Tell me about a time you failed, and what you did next.',
    'Describe a time you disagreed with your manager.',
    'Tell me about the project you are proudest of.',
    'Describe a time you had to learn something quickly.',
    'Tell me about a time you led without formal authority.',
    'Give an example of a decision you made with incomplete information.',
    'Tell me about a conflict with a colleague and how you resolved it.',
    'Describe a time you received hard feedback.',
  ]),
  ...P('interview', 'prep', [
    'Why should we hire you over other candidates?',
    'What is your biggest weakness?',
    'What would your last manager say you need to work on?',
    'What kind of team brings out your best work?',
  ]),

  ...P('work', 'wsn', [
    'Give a sixty-second update on what you are working on right now.',
    'Your project will miss its deadline. Tell your team.',
    'Summarise the last meeting you attended for someone who missed it.',
    'Report the single most important result from your last month of work.',
    'A customer found a serious bug. Brief your manager.',
    'Hand over your current work to a colleague before you go on leave.',
  ]),
  ...P('work', 'pyramid', [
    'Your director asks in the lift: "How is it going?" Answer in under a minute.',
    'Recommend one thing your team should stop doing.',
    'You have two minutes with the CEO. What do you tell them?',
    'Explain why your team needs one more person.',
    'Disagree, respectfully, with a plan your team has just agreed on.',
    'Explain what your team does to a new joiner on their first day.',
  ]),

  ...P('leadership', 'sbi', [
    'Tell a strong performer that their attitude in meetings is hurting the team.',
    'Praise a colleague for excellent work, specifically enough that they can repeat it.',
    'Tell a team member that their report was not good enough.',
    'A colleague keeps missing deadlines. Raise it with them.',
    'Give feedback to someone more senior than you.',
  ]),
  ...P('leadership', 'psb', [
    'Announce an unpopular change to your team and bring them with you.',
    'Rally a tired team before one final push.',
    'Explain to your team why a project they loved is being cancelled.',
    'Set out your vision for the team for the coming year.',
  ]),
  ...P('leadership', 'wsn', [
    'Open a meeting: say why everyone is here and what you need from them.',
    'Tell your team that a well-liked colleague is leaving.',
    'Close a tense meeting by summarising what was decided.',
    'Welcome a new hire and tell them what matters most here.',
  ]),

  ...P('persuade', 'psb', [
    'Pitch your current project to an investor in sixty seconds.',
    'Convince your manager to let you work from another country for a month.',
    'Persuade a sceptical colleague to try a new tool.',
    'Ask for a raise.',
    'Convince a friend to take up a hobby you love.',
    'Pitch a new product idea you have just thought of.',
    'Persuade your team to adopt one new habit.',
    'Sell me the pen, phone or cup nearest to you.',
  ]),
  ...P('persuade', 'prep', [
    'Argue that everyone should learn to cook.',
    'Convince me to visit your home town.',
    'Make the case for a book everyone should read.',
    'Persuade a teenager to start saving money.',
    'Negotiate an extra week on a deadline.',
  ]),

  ...P('explain', 'pyramid', [
    'Explain what you do for a living to a ten-year-old.',
    'Explain how the internet works to your grandmother.',
    'Explain inflation to someone who has never studied economics.',
    'Explain why the sky is blue.',
    'Explain how a vaccine works.',
    'Teach me one thing you know well in sixty seconds.',
    'Explain the rules of your favourite sport to a complete beginner.',
    'Explain compound interest without using numbers.',
    'Explain what artificial intelligence is, and what it is not.',
    'Explain how to make a decision when both options look good.',
    'Explain a technical term from your field in plain language.',
    'Describe how to get from your home to the nearest shop, precisely.',
  ]),

  ...P('opinion', 'prep', [
    'Is remote work better than office work?',
    'Should schools teach public speaking to every child?',
    'Is it better to be a specialist or a generalist?',
    'Does social media do more harm than good?',
    'Should a four-day working week be the norm?',
    'Is talent or effort more important?',
    'Should you tell a friend a hard truth they have not asked for?',
    'Is it ever right to quit without another job lined up?',
    'What is the most overrated piece of career advice?',
    'What is one rule you would add to every workplace?',
    'Is it better to be liked or respected?',
    'What should everyone learn before the age of twenty?',
    'Are meetings a waste of time?',
  ]),

  ...P('story', 'story', [
    'Tell me about a moment that changed how you see the world.',
    'Tell the story of the best advice you ever received.',
    'Describe a time you were completely out of your depth.',
    'Tell a story about a mistake that turned out well.',
    'Tell me about a teacher or mentor who shaped you.',
    'Describe the hardest decision you have made.',
    'Tell a story about a journey that did not go to plan.',
    'Tell me about a time you changed your mind about something important.',
    'Describe your first day at a job.',
    'Tell the story of how you met someone important in your life.',
    'Tell me about a small moment you still think about.',
    'Describe a risk you took.',
  ]),

  ...P('social', 'ppf', [
    'Introduce yourself to a room of strangers at a conference.',
    'Someone at a party asks, "So, what do you do?" Make it interesting.',
    'You run into an old colleague. Catch them up on the last few years.',
    'Introduce two people who should know each other.',
  ]),
  ...P('social', 'story', [
    'Give a short toast at a friend’s wedding.',
    'Say a few words at a colleague’s leaving party.',
    'Give a short speech thanking your team at the end of a hard year.',
    'Raise a glass at a family birthday.',
  ]),
  ...P('social', 'prep', [
    'Recommend a film, and say why without spoiling it.',
    'Describe your perfect day off.',
    'What is something you have changed your mind about recently?',
    'What is the best meal you have ever had?',
    'Tell me about something you are looking forward to.',
  ]),

  ...P('tough', 'abc', [
    'A client says, "Frankly, I am not impressed with your work." Respond.',
    'You are asked a question in a meeting and you do not know the answer.',
    'Your manager asks why you made a mistake that cost the team a week.',
    'An audience member says your idea will never work. Respond.',
    'A colleague takes credit for your work in a meeting. Speak up.',
    'A customer demands a refund you are not allowed to give.',
    'You are asked to commit to a deadline you think is impossible.',
    'An interviewer asks about a gap in your CV.',
    'Someone interrupts you for the third time. Take the floor back.',
  ]),
  ...P('tough', 'wsn', [
    'Apologise to a client for a serious error, and say what happens now.',
    'Say no to a request from someone senior.',
    'Tell someone their application was unsuccessful.',
    'Tell your manager you are resigning.',
    'Deliver bad news to someone who is expecting good news.',
  ]),

  ...P('wild', 'prep', [
    'If you could have dinner with anyone, living or dead, who and why?',
    'What would you do with one extra hour every day?',
    'Which invention has changed your life the most?',
    'If you had to teach a class tomorrow, what would it be on?',
    'What does the word "home" mean to you?',
    'Describe the colour blue to someone who has never seen it.',
    'If your city were a person, what would they be like?',
    'What would you put in a time capsule to be opened in a hundred years?',
    'Defend an unpopular food.',
    'What is a small thing that makes a big difference?',
    'Argue that boredom is good for you.',
    'If you could un-invent one thing, what would it be?',
    'What will people in fifty years find strange about today?',
    'Describe your morning from the point of view of your phone.',
  ]),
];

export function promptsIn(category: CategoryId | 'any'): Prompt[] {
  return category === 'any' ? PROMPTS : PROMPTS.filter((p) => p.category === category);
}

export function promptsFor(framework: FrameworkId): Prompt[] {
  return PROMPTS.filter((p) => p.framework === framework);
}

export function categoryLabel(id: CategoryId): string {
  return CATEGORIES.find((c) => c.id === id)?.label ?? id;
}
