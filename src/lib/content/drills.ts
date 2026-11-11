// Drills: short, repeatable exercises that isolate one speaking skill, plus the builders
// that turn a drill, a prompt or a date into a runnable plan.

import type { DrillId, Exercise, FrameworkId, Goal, Plan, SkillId } from '../types';
import { FRAMEWORKS, getFramework } from './frameworks';
import { CATEGORIES, categoryLabel, promptsFor, promptsIn, type CategoryId, type Prompt } from './prompts';

export type Rng = () => number;

/** Small deterministic generator so the daily workout is the same all day. */
export function seededRng(seed: string): Rng {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  let state = h >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function pick<T>(items: readonly T[], rng: Rng): T {
  return items[Math.floor(rng() * items.length)]!;
}

export function sample<T>(items: readonly T[], count: number, rng: Rng): T[] {
  const pool = [...items];
  const out: T[] = [];
  while (out.length < count && pool.length) out.push(pool.splice(Math.floor(rng() * pool.length), 1)[0]!);
  return out;
}

let counter = 0;
const uid = (prefix: string) => `${prefix}-${Date.now().toString(36)}-${(counter++).toString(36)}`;

// ---------- the drill catalogue ----------

export interface DrillInfo {
  id: DrillId;
  name: string;
  skill: SkillId;
  length: string;
  summary: string;
  icon: 'zap' | 'target' | 'gauge' | 'pause' | 'shrink' | 'ban' | 'link' | 'bulb' | 'book' | 'mic' | 'flame';
}

export const DRILLS: DrillInfo[] = [
  {
    id: 'hot-seat',
    name: 'Hot Seat',
    skill: 'fluency',
    length: '5 questions · 3 min',
    summary: 'Five questions, thirty seconds each, no time to prepare. Trains you to start strong under pressure.',
    icon: 'flame',
  },
  {
    id: 'filler-free',
    name: 'Filler-Free Minute',
    skill: 'fluency',
    length: '1 min',
    summary: 'Talk about something easy for sixty seconds without a single um, uh or like. Pause instead.',
    icon: 'ban',
  },
  {
    id: 'shrink-it',
    name: 'Shrink It',
    skill: 'clarity',
    length: '3 rounds · 2 min',
    summary: 'Make the same point in sixty seconds, then thirty, then one sentence. Forces you to find the core.',
    icon: 'shrink',
  },
  {
    id: 'taboo',
    name: 'Taboo',
    skill: 'clarity',
    length: '40 sec',
    summary: 'Describe a word without using the obvious ones. Builds the reflex of finding another way to say it.',
    icon: 'target',
  },
  {
    id: 'analogy',
    name: 'Analogy Sprint',
    skill: 'clarity',
    length: '45 sec',
    summary: 'Explain an idea through an unrelated world. The fastest way to make a complex thing land.',
    icon: 'bulb',
  },
  {
    id: 'word-bridge',
    name: 'Word Bridge',
    skill: 'fluency',
    length: '30 sec',
    summary: 'Link two unrelated words into one coherent thought. Pure momentum training.',
    icon: 'link',
  },
  {
    id: 'word-weave',
    name: 'Word Weave',
    skill: 'vocabulary',
    length: '45 sec',
    summary: 'Speak on a topic and work three precise words in naturally. Moves vocabulary from knowing to using.',
    icon: 'book',
  },
  {
    id: 'pace-lock',
    name: 'Pace Lock',
    skill: 'pace',
    length: '1 min',
    summary: 'Read a passage aloud and hold a steady, listenable speed with a live pace gauge.',
    icon: 'gauge',
  },
  {
    id: 'power-pause',
    name: 'Power Pause',
    skill: 'delivery',
    length: '45 sec',
    summary: 'Read a passage and stop fully at every mark. Teaches you that silence is a tool, not a gap.',
    icon: 'pause',
  },
  {
    id: 'tongue-twister',
    name: 'Diction Warm-up',
    skill: 'clarity',
    length: '3 twisters · 1 min',
    summary: 'Three tongue twisters, scored on how many words come through cleanly. Wakes up your mouth.',
    icon: 'mic',
  },
];

export function drillInfo(id: DrillId): DrillInfo | undefined {
  return DRILLS.find((d) => d.id === id);
}

// ---------- drill content ----------

const EASY_TOPICS = [
  'Describe your morning routine in detail.',
  'Walk me through how to make a meal you cook often.',
  'Describe the place you grew up.',
  'Explain how you get to work or school, step by step.',
  'Describe your ideal weekend.',
  'Tell me about the last film or series you enjoyed.',
  'Describe your job to someone who has never heard of it.',
  'Describe a close friend.',
  'What did you do last weekend?',
  'Describe a hobby and how you got into it.',
  'Walk me through your home, room by room.',
  'Explain the rules of a game or sport you know well.',
  'Describe a place you would like to visit, and why.',
  'Describe what you can see from where you are sitting.',
];

const SHRINK_TOPICS = [
  'Explain what your job, or your field of study, is and why it matters.',
  'Explain why sleep matters.',
  'Describe the plot of a film or book you know well.',
  'Explain how to give good feedback.',
  'Make the case for learning a second language.',
  'Explain what makes a good manager.',
  'Describe a project you are working on and why it is worth doing.',
  'Explain how to prepare for an interview.',
  'Explain what a budget is and why people need one.',
  'Describe what makes a city a good place to live.',
  'Explain why exercise is worth the effort.',
  'Explain how to make a good first impression.',
];

interface TabooCard {
  word: string;
  taboo: string[];
}

const TABOO_CARDS: TabooCard[] = [
  { word: 'coffee', taboo: ['drink', 'bean', 'cup', 'caffeine', 'morning'] },
  { word: 'airport', taboo: ['plane', 'fly', 'flight', 'travel', 'luggage'] },
  { word: 'library', taboo: ['book', 'read', 'borrow', 'quiet', 'shelf'] },
  { word: 'umbrella', taboo: ['rain', 'wet', 'water', 'open', 'weather'] },
  { word: 'deadline', taboo: ['time', 'due', 'late', 'date', 'finish'] },
  { word: 'password', taboo: ['secret', 'login', 'account', 'security', 'type'] },
  { word: 'wedding', taboo: ['marry', 'bride', 'groom', 'ring', 'husband'] },
  { word: 'bicycle', taboo: ['ride', 'wheel', 'pedal', 'bike', 'cycle'] },
  { word: 'meeting', taboo: ['room', 'talk', 'agenda', 'people', 'work'] },
  { word: 'teacher', taboo: ['school', 'student', 'class', 'learn', 'lesson'] },
  { word: 'mirror', taboo: ['reflection', 'glass', 'see', 'look', 'face'] },
  { word: 'budget', taboo: ['money', 'spend', 'plan', 'cost', 'save'] },
  { word: 'bridge', taboo: ['river', 'cross', 'water', 'road', 'over'] },
  { word: 'election', taboo: ['vote', 'president', 'government', 'party', 'politics'] },
  { word: 'breakfast', taboo: ['morning', 'meal', 'eat', 'egg', 'food'] },
  { word: 'internet', taboo: ['web', 'online', 'computer', 'website', 'network'] },
  { word: 'holiday', taboo: ['vacation', 'travel', 'trip', 'beach', 'work'] },
  { word: 'hospital', taboo: ['doctor', 'nurse', 'sick', 'patient', 'medicine'] },
  { word: 'feedback', taboo: ['comment', 'review', 'improve', 'opinion', 'tell'] },
  { word: 'elevator', taboo: ['lift', 'floor', 'building', 'up', 'down'] },
  { word: 'newspaper', taboo: ['news', 'read', 'paper', 'article', 'print'] },
  { word: 'leadership', taboo: ['leader', 'manage', 'boss', 'team', 'follow'] },
  { word: 'traffic', taboo: ['car', 'road', 'jam', 'drive', 'street'] },
  { word: 'interview', taboo: ['job', 'question', 'hire', 'candidate', 'answer'] },
  { word: 'calendar', taboo: ['date', 'day', 'month', 'year', 'schedule'] },
  { word: 'volcano', taboo: ['lava', 'mountain', 'erupt', 'hot', 'fire'] },
  { word: 'insurance', taboo: ['policy', 'cover', 'accident', 'pay', 'risk'] },
  { word: 'orchestra', taboo: ['music', 'instrument', 'conductor', 'play', 'concert'] },
  { word: 'startup', taboo: ['company', 'business', 'founder', 'new', 'invest'] },
  { word: 'gravity', taboo: ['fall', 'earth', 'weight', 'force', 'down'] },
];

const BRIDGE_WORDS = [
  'lighthouse',
  'spreadsheet',
  'grandmother',
  'volcano',
  'passport',
  'deadline',
  'orchestra',
  'bicycle',
  'thunderstorm',
  'recipe',
  'satellite',
  'handshake',
  'compass',
  'traffic',
  'garden',
  'invoice',
  'marathon',
  'candle',
  'elevator',
  'penguin',
  'contract',
  'museum',
  'ladder',
  'headline',
  'anchor',
  'microscope',
  'postcard',
  'thermostat',
  'chessboard',
  'umbrella',
  'blueprint',
  'campfire',
  'keyboard',
  'harvest',
  'telescope',
  'suitcase',
  'library',
  'engine',
  'rainbow',
  'budget',
];

const ANALOGY_CONCEPTS = [
  'inflation',
  'compound interest',
  'how the internet works',
  'machine learning',
  'the cloud',
  'encryption',
  'supply and demand',
  'how a vaccine works',
  'burnout',
  'opportunity cost',
  'the stock market',
  'a startup',
  'technical debt',
  'a good strategy',
  'the immune system',
  'how memory works',
  'teamwork',
  'climate change',
  'a budget',
  'trust',
];

const ANALOGY_WORLDS = [
  'cooking',
  'football',
  'gardening',
  'traffic',
  'music',
  'sailing',
  'building a house',
  'a road trip',
  'a restaurant kitchen',
  'the weather',
  'a library',
  'running a marathon',
];

const WEAVE_WORDS = [
  'catalyst',
  'nuance',
  'pragmatic',
  'momentum',
  'friction',
  'resilient',
  'deliberate',
  'candid',
  'concise',
  'compelling',
  'tangible',
  'pivotal',
  'scrutiny',
  'incremental',
  'constraint',
  'evidence',
  'consequence',
  'perspective',
  'assumption',
  'sustainable',
  'anticipate',
  'distinct',
  'essential',
  'inevitable',
  'robust',
  'subtle',
  'tension',
  'threshold',
  'viable',
  'vivid',
  'ambiguous',
  'coherent',
  'foster',
  'hinder',
  'inherent',
  'mitigate',
  'plausible',
  'precise',
  'profound',
  'reinforce',
  'relevant',
  'undermine',
  'versatile',
  'trade-off',
];

const WEAVE_TOPICS = [
  'a change you would make where you work or study',
  'what makes a team work well',
  'a decision you are weighing up at the moment',
  'how technology has changed your daily life',
  'what you have learned in the past year',
  'the future of your industry',
  'how to handle disagreement',
  'what good leadership looks like',
  'a habit worth building',
  'the best way to learn something new',
];

/** Original passages of roughly 140–160 words: about a minute at a comfortable pace. */
const PACE_PASSAGES = [
  'Most people speak faster when they are nervous, and they rarely notice it. The words pile up, the breath gets short, and the listener falls behind. The cure is not to speak slowly all the time. It is to choose your speed. A steady pace tells the room that you are in control of your material. It gives each idea the space it needs to land. It also gives you time to think about the next sentence before you say it. Try this the next time you present. Say your first sentence at half the speed that feels natural. It will feel strange to you, and it will sound calm to everyone else. Then let your pace rise a little, and bring it back down whenever you reach a point that matters. Speed is not a habit to fight. It is a dial, and you are allowed to turn it.',
  'A lighthouse does not chase ships. It stands in one place and sends the same clear signal, again and again, through fog and rain and dark. Sailors trust it because it does not change. Good communication works the same way. When you know your main point, you can return to it whenever the conversation drifts. You do not need to say everything you know. You need to say the one thing your listener must remember, and then say it once more before you finish. People are busy. They are thinking about their own work, their own worries, and what they will eat for lunch. A single clear signal reaches them. A dozen competing signals do not. So before you speak, decide what your light is. Put it at the start. Come back to it at the end. Let everything in the middle point toward it.',
  'Bread is made from four simple things: flour, water, salt and time. The first three are easy to measure. The fourth is the one most people rush. When dough is left alone, tiny living cells feed on the flour and fill it with air. The longer they work, the deeper the flavour becomes. A baker who is in a hurry gets a loaf that looks right and tastes of very little. A baker who waits gets something worth eating. Skill is often like this. We want the result today, so we skip the slow part, and then we wonder why the result is thin. Practice is the slow part. Ten quiet minutes a day will change how you speak more than one long session each month. Nothing dramatic happens on any single day. Then, one morning, you notice that the words are simply there when you reach for them.',
  'Before a pilot takes off, she reads a checklist out loud. She has flown this aircraft a thousand times, and she reads it anyway. The list is short. Each item takes a few seconds. Together they catch the small mistakes that cause large accidents. Speakers can borrow this habit. Before an important conversation, ask yourself three questions. Who am I talking to? What do I want them to do? What is the one sentence they must remember? If you cannot answer all three, you are not ready to speak yet. If you can, the rest becomes much easier. You will know where to begin, because you begin with what matters to them. You will know where to end, because you end with what you want them to do. And you will know what to leave out, which is nearly everything else.',
  'There is a village in the mountains where the road ends and the path begins. Visitors arrive tired from the long drive, and they usually want to keep moving. The people who live there give them tea first. They ask about the journey. They point out the peaks by name. Only then do they talk about the walk ahead. It is a small thing, and it changes the whole trip. The visitors set off rested, and they know what they are looking at. A good introduction does the same work. It tells your listeners where they are, where you are taking them, and why the climb is worth it. Skip it, and they spend the first few minutes lost. Give it thirty seconds, and they will follow you a long way. The path matters, but so does the cup of tea before it.',
];

/** Passages marked for pausing: "/" is one beat, "//" is two. */
const PAUSE_PASSAGES = [
  'I want to tell you one thing today. // Just one. / Most of what we say / is forgotten within the hour. // But the right sentence, / said at the right moment, / can stay with a person for years. // So before you speak, / ask yourself a single question. // What do I want them to remember? // Then say that. / And stop.',
  'We had three months, / a team of four, / and no budget. // Everyone told us it could not be done. // They were almost right. / In the first month, / nothing worked. // In the second month, / one thing worked. // And in the third month, / on the very last day, / we shipped. // I learned something that week. // Deadlines do not create pressure. / They create focus.',
  'Listen. // That silence you just heard / is the most useful tool a speaker has. // It costs nothing. / It needs no practice. // And almost nobody uses it. // We rush to fill every gap, / because silence feels like failure. // It is not. / To your audience, / a pause sounds like confidence. // It says: / I know what comes next, / and it is worth waiting for.',
  'Here is the problem. // Our customers wait eleven days for an answer. // Eleven. / Our competitors answer in two. // Here is what I propose. // One team, / one inbox, / and a promise: / every message answered within a day. // And here is what we gain. / Customers who stay. // Staff who are proud of their work. // And a reputation / that no advert can buy.',
];

const TWISTERS = [
  'She sells seashells by the seashore. The shells she sells are surely seashells.',
  'Peter Piper picked a peck of pickled peppers. A peck of pickled peppers Peter Piper picked.',
  'A proper copper coffee pot. A proper copper coffee pot. A proper copper coffee pot.',
  'Six slippery snails slid slowly seaward. Six slippery snails slid slowly seaward.',
  'Fred fed Ted bread, and Ted fed Fred bread.',
  'A big black bug bit a big black bear. A big black bug bit a big black bear.',
  'Betty Botter bought some butter, but she said the butter is bitter.',
  'Four fine fresh fish for you. Four fine fresh fish for you.',
  'I saw Susie sitting in a shoeshine shop. Where she sits she shines, and where she shines she sits.',
  'Eleven benevolent elephants. Eleven benevolent elephants. Eleven benevolent elephants.',
  'Crisp crusts crackle and crunch. Crisp crusts crackle and crunch.',
  'The thirty-three thieves thought that they thrilled the throne throughout Thursday.',
  'How much wood would a woodchuck chuck if a woodchuck could chuck wood?',
  'Lesser leather never weathered wetter weather better.',
];

const HOT_SEAT_QUESTIONS = [
  'What are you working on right now, and why does it matter?',
  'What is your greatest professional strength?',
  'Why should someone trust your judgement?',
  'What is the best decision you made this year?',
  'What would you change about how your team works?',
  'What is a belief you hold that most people disagree with?',
  'How do you handle being wrong?',
  'What makes you good at what you do?',
  'What is the hardest part of your job?',
  'Describe yourself in three words, and justify one of them.',
  'What have you learned in the past month?',
  'What do you do when you do not know the answer?',
  'What is the most useful advice you have been given?',
  'What does success look like for you this year?',
  'How do you decide what to work on first?',
  'What would you do differently if you started your career again?',
  'What is a problem you solved that you are proud of?',
  'How do you respond to criticism?',
  'What motivates you on a bad day?',
  'What is one thing your colleagues rely on you for?',
  'Why did you choose your line of work?',
  'What is the biggest risk you have taken?',
  'What does a good day look like for you?',
  'What is something you are trying to get better at?',
  'How would a friend describe you?',
  'What is one thing you would never compromise on?',
  'What do people misunderstand about your work?',
  'What would you do with a free afternoon tomorrow?',
];

// ---------- builders ----------

const DEFAULT_SPEAK_GOALS: Goal[] = [{ type: 'maxFillers', max: 3 }];

function frameworkContext(id: FrameworkId): string {
  const framework = getFramework(id);
  return `Suggested shape: ${framework.name} — ${framework.tagline.toLowerCase()}.`;
}

export interface ImpromptuOptions {
  category: CategoryId | 'any';
  speakSec: number;
  prepSec: number;
  /** 'auto' shows the framework that suits the prompt; 'none' shows nothing. */
  framework: FrameworkId | 'auto' | 'none';
  /** Use this prompt instead of drawing one. */
  prompt?: Prompt;
}

export function drawPrompt(category: CategoryId | 'any', rng: Rng = Math.random): Prompt {
  return pick(promptsIn(category), rng);
}

export function impromptuExercise(options: ImpromptuOptions, rng: Rng = Math.random): Exercise {
  const prompt = options.prompt ?? drawPrompt(options.category, rng);
  const frameworkId =
    options.framework === 'none'
      ? undefined
      : options.framework === 'auto'
        ? (prompt.framework ?? CATEGORIES.find((c) => c.id === prompt.category)?.framework)
        : options.framework;
  return {
    id: uid('ex'),
    drillId: 'impromptu',
    title: 'Impromptu',
    tag: categoryLabel(prompt.category),
    prompt: prompt.text,
    context: frameworkId ? frameworkContext(frameworkId) : undefined,
    prepSec: options.prepSec,
    speakSec: options.speakSec,
    mode: 'speak',
    frameworkId,
    goals: DEFAULT_SPEAK_GOALS,
  };
}

export function buildImpromptu(options: ImpromptuOptions, rng: Rng = Math.random): Plan {
  return {
    id: uid('plan'),
    title: 'Impromptu',
    steps: [impromptuExercise(options, rng)],
    recipe: {
      kind: 'impromptu',
      category: options.category,
      speakSec: options.speakSec,
      prepSec: options.prepSec,
      framework: options.framework,
    },
  };
}

/** A plan around the speaker's own situation or question. */
export function buildCustom(
  prompts: string[],
  options: { speakSec: number; prepSec: number; title?: string; frameworkId?: FrameworkId },
): Plan {
  const many = prompts.length > 1;
  return {
    id: uid('plan'),
    title: options.title ?? 'Your situation',
    steps: prompts.map((text, i) => ({
      id: uid('ex'),
      drillId: 'custom' as const,
      title: options.title ?? 'Your situation',
      tag: many ? `Question ${i + 1} of ${prompts.length}` : 'Your situation',
      prompt: text,
      context: options.frameworkId ? frameworkContext(options.frameworkId) : undefined,
      prepSec: options.prepSec,
      speakSec: options.speakSec,
      mode: 'speak' as const,
      frameworkId: options.frameworkId,
      goals: DEFAULT_SPEAK_GOALS,
    })),
  };
}

export function frameworkExercise(frameworkId: FrameworkId, rng: Rng = Math.random): Exercise {
  const framework = getFramework(frameworkId);
  const pool = promptsFor(frameworkId);
  const prompt = pool.length ? pick(pool, rng) : { text: framework.example.prompt, category: 'wild' as const };
  const perStep = framework.steps.length >= 4 ? 25 : 30;
  return {
    id: uid('ex'),
    drillId: 'framework',
    title: framework.name,
    tag: `Framework · ${framework.name}`,
    prompt: prompt.text,
    context: 'Work through each step. Tap Next step (or press Space) as you move on.',
    prepSec: 20,
    speakSec: perStep * framework.steps.length,
    mode: 'speak',
    frameworkId,
    guided: true,
    goals: [{ type: 'coverSteps' }, { type: 'maxFillers', max: 3 }],
  };
}

export function buildFramework(frameworkId: FrameworkId, rng: Rng = Math.random): Plan {
  const exercise = frameworkExercise(frameworkId, rng);
  return { id: uid('plan'), title: exercise.title, steps: [exercise], recipe: { kind: 'framework', frameworkId } };
}

function drillExercises(id: DrillId, rng: Rng): Exercise[] {
  const base = { id: '', drillId: id, title: drillInfo(id)?.name ?? id, mode: 'speak' as const };
  switch (id) {
    case 'filler-free':
      return [
        {
          ...base,
          tag: 'Fluency drill',
          prompt: pick(EASY_TOPICS, rng),
          context: 'Keep talking for the full minute. When you feel a filler coming, close your mouth and pause.',
          prepSec: 5,
          speakSec: 60,
          goals: [{ type: 'maxFillers', max: 0 }, { type: 'minWords', min: 90 }],
        },
      ];
    case 'shrink-it': {
      const prompt = pick(SHRINK_TOPICS, rng);
      const rounds: [number, string, string, Goal[]][] = [
        [60, 'Round 1 of 3 · 60 seconds', 'Say everything you want to say.', [{ type: 'minWords', min: 80 }]],
        [30, 'Round 2 of 3 · 30 seconds', 'Same point, half the time. Cut the background.', [{ type: 'maxWords', max: 85 }]],
        [12, 'Round 3 of 3 · one sentence', 'One sentence. What is the core?', [{ type: 'maxWords', max: 30 }]],
      ];
      return rounds.map(([speakSec, tag, context, goals], i) => ({
        ...base,
        tag,
        prompt,
        context,
        prepSec: i === 0 ? 10 : 5,
        speakSec,
        goals,
      }));
    }
    case 'taboo': {
      const card = pick(TABOO_CARDS, rng);
      return [
        {
          ...base,
          tag: 'Clarity drill',
          prompt: `Describe “${card.word}”`,
          context: 'Help a listener guess the word. You may not say it, or any of the words below.',
          prepSec: 5,
          speakSec: 40,
          taboo: [card.word, ...card.taboo],
          goals: [{ type: 'noTaboo' }, { type: 'minWords', min: 40 }],
        },
      ];
    }
    case 'word-bridge': {
      const [first, second] = sample(BRIDGE_WORDS, 2, rng);
      return [
        {
          ...base,
          tag: 'Fluency drill',
          prompt: `Connect “${first}” and “${second}”`,
          context: 'Tell a short story or make an argument that links the two. There is no wrong answer, only momentum.',
          prepSec: 5,
          speakSec: 30,
          mustUse: [first!, second!],
          goals: [{ type: 'useWords' }, { type: 'minWords', min: 45 }, { type: 'maxFillers', max: 1 }],
        },
      ];
    }
    case 'analogy':
      return [
        {
          ...base,
          tag: 'Clarity drill',
          prompt: `Explain ${pick(ANALOGY_CONCEPTS, rng)} using an analogy from ${pick(ANALOGY_WORLDS, rng)}.`,
          context: 'Start with “It is like…”, then say where the comparison holds.',
          prepSec: 10,
          speakSec: 45,
          goals: [{ type: 'minWords', min: 60 }, { type: 'maxFillers', max: 2 }],
        },
      ];
    case 'word-weave':
      return [
        {
          ...base,
          tag: 'Vocabulary drill',
          prompt: `Talk about ${pick(WEAVE_TOPICS, rng)}.`,
          context: 'Work all three words in so naturally that nobody would notice.',
          prepSec: 15,
          speakSec: 45,
          mustUse: sample(WEAVE_WORDS, 3, rng),
          goals: [{ type: 'useWords' }, { type: 'maxFillers', max: 2 }],
        },
      ];
    case 'pace-lock':
      return [
        {
          ...base,
          mode: 'read',
          tag: 'Pace drill',
          prompt: 'Read this aloud at a steady, conversational speed.',
          context: 'Watch the gauge. If it climbs, breathe at the next full stop.',
          readText: pick(PACE_PASSAGES, rng),
          prepSec: 5,
          speakSec: 80,
          goals: [{ type: 'paceBand' }, { type: 'accuracy', min: 0.85 }],
        },
      ];
    case 'power-pause':
      return [
        {
          ...base,
          mode: 'read',
          tag: 'Delivery drill',
          prompt: 'Read this aloud and stop fully at every mark.',
          context: 'One beat of silence at each single mark, two beats at each double. It will feel too long. It is not.',
          readText: pick(PAUSE_PASSAGES, rng),
          prepSec: 5,
          speakSec: 60,
          goals: [{ type: 'pauses', min: 6 }, { type: 'accuracy', min: 0.8 }],
        },
      ];
    case 'tongue-twister':
      return sample(TWISTERS, 3, rng).map((twister, i) => ({
        ...base,
        mode: 'read' as const,
        tag: `Twister ${i + 1} of 3`,
        prompt: 'Say it clearly. Accuracy beats speed.',
        readText: twister,
        prepSec: 3,
        speakSec: 20,
        goals: [{ type: 'accuracy', min: 0.9 }],
      }));
    case 'hot-seat':
      return sample(HOT_SEAT_QUESTIONS, 5, rng).map((question, i) => ({
        ...base,
        tag: `Question ${i + 1} of 5`,
        prompt: question,
        context: 'No preparation. Answer first, then give one reason.',
        prepSec: 0,
        speakSec: 30,
        goals: [{ type: 'quickStart', maxSec: 4 }, { type: 'maxFillers', max: 1 }],
      }));
    default:
      return [impromptuExercise({ category: 'any', speakSec: 60, prepSec: 15, framework: 'auto' }, rng)];
  }
}

export function buildDrill(id: DrillId, rng: Rng = Math.random): Plan {
  const steps = drillExercises(id, rng).map((step) => ({ ...step, id: uid('ex') }));
  return {
    id: uid('plan'),
    title: drillInfo(id)?.name ?? 'Drill',
    steps,
    rapid: id === 'hot-seat' || id === 'tongue-twister',
    recipe: { kind: 'drill', drillId: id },
  };
}

/** A fresh plan of the same kind with new content, or null if the plan cannot be re-drawn. */
export function remixPlan(plan: Plan, rng: Rng = Math.random): Plan | null {
  const recipe = plan.recipe;
  if (!recipe) return null;
  switch (recipe.kind) {
    case 'drill':
      return buildDrill(recipe.drillId, rng);
    case 'framework':
      return buildFramework(recipe.frameworkId, rng);
    case 'impromptu':
      return buildImpromptu(
        {
          category: recipe.category as CategoryId | 'any',
          speakSec: recipe.speakSec,
          prepSec: recipe.prepSec,
          framework: recipe.framework,
        },
        rng,
      );
  }
}

/** The same exercises again, as a new run (for "try again" on a whole plan). */
export function repeatPlan(plan: Plan): Plan {
  return { ...plan, id: uid('plan'), steps: plan.steps.map((step) => ({ ...step, id: uid('ex') })), dailyKey: undefined };
}

// ---------- the daily workout ----------

/** The drill that trains each skill most directly. */
const DRILL_FOR_SKILL: Record<SkillId, DrillId> = {
  fluency: 'filler-free',
  pace: 'pace-lock',
  clarity: 'taboo',
  structure: 'framework',
  vocabulary: 'word-weave',
  delivery: 'power-pause',
};

const ROTATION: DrillId[] = ['filler-free', 'taboo', 'word-bridge', 'analogy', 'word-weave', 'power-pause', 'framework'];

export function dateKey(date: Date = new Date()): string {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, '0');
  const d = String(date.getDate()).padStart(2, '0');
  return `${y}-${m}-${d}`;
}

/**
 * Three steps, about six minutes: a warm-up, a drill aimed at the speaker's weakest
 * skill, and one impromptu answer. The same all day, different tomorrow.
 */
export function buildDaily(key: string, weakest: SkillId | null): Plan {
  const rng = seededRng(`daily:${key}`);
  const dayNumber = Math.floor(new Date(`${key}T12:00:00`).getTime() / 86400000);

  const warmUp: Exercise =
    dayNumber % 2 === 0
      ? { ...drillExercises('tongue-twister', rng)[0]!, tag: 'Warm-up' }
      : { ...drillExercises('pace-lock', rng)[0]!, tag: 'Warm-up' };

  // Two days in three, train the weakest skill; otherwise rotate so nothing goes stale.
  let focusId: DrillId = ROTATION[dayNumber % ROTATION.length]!;
  if (weakest && dayNumber % 3 !== 0) focusId = DRILL_FOR_SKILL[weakest];
  if (focusId === warmUp.drillId) focusId = 'word-bridge';
  const focus: Exercise =
    focusId === 'framework'
      ? frameworkExercise(pick(FRAMEWORKS, rng).id, rng)
      : { ...drillExercises(focusId, rng)[0]! };

  const category = CATEGORIES[dayNumber % CATEGORIES.length]!.id;
  const main = impromptuExercise({ category, speakSec: 60, prepSec: 15, framework: 'auto' }, rng);

  return {
    id: uid('plan'),
    title: 'Daily workout',
    steps: [warmUp, focus, main].map((step) => ({ ...step, id: uid('ex') })),
    dailyKey: key,
  };
}

/** Rough minutes a plan takes, for display. */
export function planMinutes(plan: Plan): number {
  const seconds = plan.steps.reduce((n, s) => n + s.prepSec + s.speakSec + 20, 0);
  return Math.max(1, Math.round(seconds / 60));
}
