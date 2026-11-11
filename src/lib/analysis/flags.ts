// Finds the words worth pointing at in a transcript: fillers, hedges, vague words,
// stumbles, and (on the positive side) signposts.
//
// The rules lean conservative. A false "you said a filler" is worse than a missed one —
// it teaches the speaker to distrust the feedback — so ambiguous words such as "like"
// and "you know" are only flagged in positions where they are almost certainly padding.

import type { Flag, FlagKind } from '../types';
import { stem, type Token } from './text';

type Guard = (tokens: Token[], start: number, end: number) => boolean;

interface Entry {
  words: string[];
  kind: FlagKind;
  label: string;
  guard?: Guard;
}

const prev = (tokens: Token[], i: number) => (i > 0 ? tokens[i - 1]!.norm : '');
const next = (tokens: Token[], i: number) => (i < tokens.length ? tokens[i]!.norm : '');
const set = (words: string) => new Set(words.split(/\s+/));

// ---- guards for ambiguous phrases ----

const DETERMINERS = set(
  'a an the this that these those my your his her our their it me you him them us when how what ' +
    'someone something anything nothing everything everyone one two three i we he she they many most some',
);
const LIKE_AFTER_CONJUNCTION = set('and so but then because or well yeah um uh okay ok');
const LIKE_AFTER_COPULA = set("was were is are am i'm he's she's it's that's you're we're they're");
/** What follows a padding "like" after a copula: "it was like really big", "I was like no way". */
const LIKE_BEFORE_REACTION = set(
  'really so totally super very kind sort i oh no yeah okay ok wow um uh well just literally actually ' +
    'basically honestly why hey pretty way not maybe wait dude man',
);

/**
 * "like" is only flagged where it is almost certainly padding: after a conjunction ("and like…"),
 * as a sentence opener, or in "it was like, really big". Comparisons ("it's like herding cats")
 * and the verb ("I like it") are left alone.
 */
const likeIsFiller: Guard = (tokens, start, end) => {
  const before = prev(tokens, start);
  const after = next(tokens, end);
  if (start === 0 || tokens[start]!.sentenceStart) return after !== '' && !DETERMINERS.has(after);
  if (LIKE_AFTER_CONJUNCTION.has(before)) return true;
  if (LIKE_AFTER_COPULA.has(before)) return LIKE_BEFORE_REACTION.has(after);
  return false;
};

const YOU_KNOW_VERB_BEFORE = set(
  "do did don't didn't if as would will should could might may must can let lets let's to once when until " +
    'before after sure hope think bet',
);
const YOU_KNOW_OBJECT_AFTER = set(
  'how why where who whether if about that the this these those a an it him her them me us my your his ' +
    'their our what which when anything something nothing everything better',
);
const youKnowIsFiller: Guard = (tokens, start, end) =>
  !YOU_KNOW_VERB_BEFORE.has(prev(tokens, start)) && !YOU_KNOW_OBJECT_AFTER.has(next(tokens, end));

const iMeanIsFiller: Guard = (tokens, start, end) =>
  !set('what how do did which where that know see').has(prev(tokens, start)) &&
  !set('it to by business well').has(next(tokens, end));

const KIND_OF_LITERAL_BEFORE = set(
  'a what which this that the some any every each one another other same right wrong best worst only new ' +
    'different special certain particular my his her their our your no all these those two three many',
);
const kindOfIsHedge: Guard = (tokens, start) => !KIND_OF_LITERAL_BEFORE.has(prev(tokens, start));

const iThinkIsHedge: Guard = (tokens, _start, end) => !set('about of back').has(next(tokens, end));

const iDontKnowIsHedge: Guard = (tokens, _start, end) => {
  const after = next(tokens, end);
  return after === '' || set("but i it it's maybe like just um uh so and").has(after);
};

/** "right" only counts as a tag question: "…so we shipped it, right?" */
const rightIsTag: Guard = (tokens, start) => tokens[start]!.raw.endsWith('?') && start > 0;

// ---- the lexicon ----

const ENTRIES: Entry[] = [];

function add(kind: FlagKind, phrases: string[], guard?: Guard, label?: string) {
  for (const phrase of phrases) {
    ENTRIES.push({ words: phrase.split(' '), kind, label: label ?? phrase, guard });
  }
}

add('filler', ['um', 'umm', 'uhm', 'uh', 'uhh', 'er', 'erm', 'ah', 'hmm', 'mm', 'mhm']);
add('filler', ['basically', 'actually', 'literally', 'honestly', 'essentially', 'to be honest', 'you see']);
add('filler', ['so yeah', 'yeah so', 'okay so', 'ok so', 'and yeah', 'but yeah', 'yeah no', 'you know what i mean']);
add('filler', ['like'], likeIsFiller);
add('filler', ['you know'], youKnowIsFiller);
add('filler', ['i mean'], iMeanIsFiller);
add('filler', ['right'], rightIsTag);

add('hedge', ['kind of', 'sort of', 'kinda', 'sorta'], kindOfIsHedge);
add('hedge', ['i think'], iThinkIsHedge);
add('hedge', ["i don't know"], iDontKnowIsHedge);
add('hedge', [
  'i guess',
  'i suppose',
  'i feel like',
  'maybe',
  'perhaps',
  'probably',
  'possibly',
  'somewhat',
  'a little bit',
  'more or less',
  'in a way',
  "i'm not sure",
  'if that makes sense',
  'does that make sense',
  'i could be wrong',
  'i might be wrong',
  'hopefully',
  'i just think',
  'i just feel',
  'i just wanted',
  'just my opinion',
  'sorry',
]);

add('vague', [
  'thing',
  'things',
  'stuff',
  'whatever',
  'etc',
  'etcetera',
  'et cetera',
  'and so on',
  'and so forth',
  'or something',
  'or whatever',
  'and stuff',
  'and everything',
  'and all that',
  'and stuff like that',
  'and things like that',
  'stuff like that',
  'things like that',
  'something like that',
  'some sort of',
  'some kind of',
  'very',
  'really',
]);

/** Signposts by the job they do. Using several kinds is what makes structure audible. */
export const SIGNPOST_KINDS: Record<string, string[]> = {
  sequence: [
    'first',
    'firstly',
    'first of all',
    'to begin with',
    'second',
    'secondly',
    'third',
    'thirdly',
    'next',
    'finally',
    'lastly',
    'last but not least',
    'another reason',
    'on top of that',
    'in addition',
    'additionally',
    'moreover',
    'furthermore',
  ],
  cause: [
    'because',
    'therefore',
    'as a result',
    'which means',
    'that means',
    "that's why",
    'this is why',
    'consequently',
    'so that',
    'the reason',
    'due to',
    'leads to',
    'led to',
    'hence',
    'thus',
  ],
  contrast: [
    'however',
    'on the other hand',
    'although',
    'whereas',
    'in contrast',
    'instead',
    'even though',
    'nevertheless',
    'despite',
    'rather than',
    'that said',
    'at the same time',
  ],
  example: [
    'for example',
    'for instance',
    'such as',
    'imagine',
    "let's say",
    'picture this',
    'specifically',
    'in particular',
    'to illustrate',
    'a good example',
    'one example',
  ],
  summary: [
    'in summary',
    'to summarize',
    'to sum up',
    'in short',
    'overall',
    'the bottom line',
    'bottom line',
    'to recap',
    'ultimately',
    'in conclusion',
    'to conclude',
    'the key point',
    'my point is',
    'the point is',
    'the takeaway',
    'in the end',
    'all in all',
    'to wrap up',
    'long story short',
    'most importantly',
    'the main thing',
  ],
};

for (const [kind, phrases] of Object.entries(SIGNPOST_KINDS)) add('signpost', phrases, undefined, kind);

function indexEntries(entries: Entry[]): Map<string, Entry[]> {
  const index = new Map<string, Entry[]>();
  for (const entry of entries) {
    const key = entry.words[0]!;
    const list = index.get(key);
    if (list) list.push(entry);
    else index.set(key, [entry]);
  }
  // Longest phrase first so "you know what i mean" wins over "you know".
  for (const list of index.values()) list.sort((a, b) => b.words.length - a.words.length);
  return index;
}

const BASE_INDEX = indexEntries(ENTRIES);

// ---- stumbles ----

/** Doubled words that are emphasis or grammar, not a stumble. */
const REPEAT_OK = set(
  'very really so no yes yeah bye long far many much never big little well okay ok hey wait go more again ' +
    'please thank ha wow blah that had is knock tick chop bit by on',
);

function matchesAt(tokens: Token[], i: number, words: string[]): boolean {
  if (i + words.length > tokens.length) return false;
  for (let k = 0; k < words.length; k++) if (tokens[i + k]!.norm !== words[k]) return false;
  return true;
}

/** Does a heard word count as the given target word? Tolerates plurals and tense. */
export function sameWord(heard: string, target: string): boolean {
  if (heard === target) return true;
  if (!heard || !target) return false;
  return stem(heard) === stem(target);
}

export interface FlagOptions {
  customFillers?: string[];
  taboo?: string[];
  mustUse?: string[];
}

/**
 * Scan a transcript and return non-overlapping flags in reading order.
 * Priority when phrases compete for a word: taboo, target, then the longest lexicon phrase.
 */
export function findFlags(tokens: Token[], options: FlagOptions = {}): Flag[] {
  const flags: Flag[] = [];
  const taboo = (options.taboo ?? []).map((w) => w.toLowerCase());
  const mustUse = (options.mustUse ?? []).map((w) => w.toLowerCase());

  let index = BASE_INDEX;
  const custom = (options.customFillers ?? []).map((p) => p.trim().toLowerCase()).filter(Boolean);
  if (custom.length) {
    const extra: Entry[] = custom.map((phrase) => ({ words: phrase.split(/\s+/), kind: 'filler', label: phrase }));
    index = indexEntries([...extra, ...ENTRIES]);
  }

  let i = 0;
  while (i < tokens.length) {
    const word = tokens[i]!.norm;
    if (!word) {
      i++;
      continue;
    }

    const tabooWord = taboo.find((t) => sameWord(word, t));
    if (tabooWord) {
      flags.push({ start: i, end: i + 1, kind: 'taboo', label: tabooWord });
      i++;
      continue;
    }
    const targetWord = mustUse.find((t) => sameWord(word, t));
    if (targetWord) {
      flags.push({ start: i, end: i + 1, kind: 'target', label: targetWord });
      i++;
      continue;
    }

    // Stumbles: "I think I think", "the the".
    if (i >= 2 && tokens[i + 1]?.norm && tokens[i - 2]!.norm === word && tokens[i - 1]!.norm === tokens[i + 1]!.norm) {
      flags.push({ start: i, end: i + 2, kind: 'repeat', label: 'restart' });
      i += 2;
      continue;
    }
    if (i >= 1 && tokens[i - 1]!.norm === word && !REPEAT_OK.has(word)) {
      flags.push({ start: i, end: i + 1, kind: 'repeat', label: 'repeated word' });
      i++;
      continue;
    }

    let matched: Entry | undefined;
    for (const entry of index.get(word) ?? []) {
      if (!matchesAt(tokens, i, entry.words)) continue;
      if (entry.guard && !entry.guard(tokens, i, i + entry.words.length)) continue;
      matched = entry;
      break;
    }
    if (matched) {
      flags.push({ start: i, end: i + matched.words.length, kind: matched.kind, label: matched.label });
      i += matched.words.length;
    } else {
      i++;
    }
  }
  return flags;
}

// ---- openings and endings ----

const WEAK_OPENERS = [
  'um',
  'uh',
  'er',
  'hmm',
  'so',
  'okay',
  'ok',
  'well',
  'yeah',
  'alright',
  'all right',
  'right',
  'basically',
  'honestly',
  'i guess',
  'i mean',
  'you know',
  'okay so',
  'so um',
  'so yeah',
];

const WEAK_CLOSERS = [
  'so yeah',
  'and yeah',
  'yeah',
  "that's it",
  "that's all",
  "that's about it",
  "that's pretty much it",
  'pretty much',
  'i guess',
  "i don't know",
  "i think that's it",
  'and stuff',
  'or whatever',
  'or something',
  'and so on',
  'you know',
  'um',
  'uh',
  'so',
  'if that makes sense',
  'anyway',
  'and everything',
  'i think',
];

function words(tokens: Token[]): string[] {
  return tokens.filter((t) => t.norm).map((t) => t.norm);
}

/** Words that make an opening "so" / "right" / "well" part of the sentence rather than a wind-up. */
const OPENER_CONTINUES = set('many much far long often few now after before');

/** The filler-ish phrase the speaker opened with, if any. */
export function weakOpener(tokens: Token[]): string | null {
  const w = words(tokens);
  let best: string | null = null;
  for (const phrase of WEAK_OPENERS) {
    const parts = phrase.split(' ');
    if (parts.every((p, k) => w[k] === p) && (!best || phrase.length > best.length)) best = phrase;
  }
  if (best && !best.includes(' ') && OPENER_CONTINUES.has(w[1] ?? '')) return null;
  return best;
}

/** The trailing-off phrase the speaker ended on, if any. */
export function weakCloser(tokens: Token[]): string | null {
  const w = words(tokens);
  let best: string | null = null;
  for (const phrase of WEAK_CLOSERS) {
    const parts = phrase.split(' ');
    if (parts.length > w.length) continue;
    const offset = w.length - parts.length;
    if (parts.every((p, k) => w[offset + k] === p) && (!best || phrase.length > best.length)) best = phrase;
  }
  return best;
}
