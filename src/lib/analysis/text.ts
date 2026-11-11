// Tokenising spoken transcripts. Speech-to-text output is messy: little or no punctuation,
// inconsistent casing, curly quotes. Everything downstream works on normalised tokens.

export interface Token {
  /** As it appeared in the transcript, for display. */
  raw: string;
  /** Lower-case, punctuation stripped. Empty for punctuation-only tokens. */
  norm: string;
  /** True for the first word of the transcript and words after . ! ? */
  sentenceStart: boolean;
}

const EDGE_PUNCT = /^[^\p{L}\p{N}']+|[^\p{L}\p{N}']+$/gu;

export function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[‘’]/g, "'")
    .replace(EDGE_PUNCT, '')
    .replace(/^'+|'+$/g, '');
}

export function tokenize(text: string): Token[] {
  const tokens: Token[] = [];
  let sentenceStart = true;
  for (const raw of text.split(/\s+/)) {
    if (!raw) continue;
    const norm = normalizeWord(raw);
    tokens.push({ raw, norm, sentenceStart: norm ? sentenceStart : false });
    if (norm) sentenceStart = false;
    if (/[.!?]["')\]]*$/.test(raw)) sentenceStart = true;
  }
  return tokens;
}

/** Normalised words only (punctuation-only tokens dropped). */
export function wordsOf(text: string): string[] {
  const out: string[] = [];
  for (const raw of text.split(/\s+/)) {
    const norm = normalizeWord(raw);
    if (norm) out.push(norm);
  }
  return out;
}

export function countWords(text: string): number {
  return wordsOf(text).length;
}

const STOPWORDS = new Set(
  (
    'a an the and or but if so than then that this these those is am are was were be been being ' +
    'have has had having do does did doing will would shall should can could may might must ' +
    'i me my mine myself we us our ours you your yours he him his she her hers it its they them their ' +
    'who whom whose which what when where why how to of in on at by for with about from into over under ' +
    'up down out off as not no nor yes too very just also there here all any both each few more most other ' +
    "some such only own same s t don't doesn't didn't isn't aren't wasn't weren't won't wouldn't can't " +
    "couldn't shouldn't it's i'm i've i'd i'll we're we've we'd we'll you're you've you'd you'll he's she's " +
    "they're they've they'd they'll that's there's what's let's because while really like get got go going " +
    'went one two thing things lot um uh know think mean kind sort'
  ).split(/\s+/),
);

export function isStopword(word: string): boolean {
  return STOPWORDS.has(word);
}

/**
 * Moving-average type-token ratio: the share of distinct words in a sliding window, averaged.
 * Unlike a plain unique/total ratio it does not fall just because a speech is longer.
 */
export function mattr(words: string[], window = 40): number | null {
  if (words.length < 20) return null;
  const size = Math.min(window, words.length);
  const counts = new Map<string, number>();
  let distinct = 0;
  let sum = 0;
  let windows = 0;
  for (let i = 0; i < words.length; i++) {
    const add = words[i]!;
    const c = counts.get(add) ?? 0;
    if (c === 0) distinct++;
    counts.set(add, c + 1);
    if (i >= size) {
      const drop = words[i - size]!;
      const d = counts.get(drop)! - 1;
      counts.set(drop, d);
      if (d === 0) distinct--;
    }
    if (i >= size - 1) {
      sum += distinct / size;
      windows++;
    }
  }
  return sum / windows;
}

/** Content words said three times or more, most frequent first. */
export function topContentWords(words: string[], limit = 5): [string, number][] {
  const counts = new Map<string, number>();
  for (const w of words) {
    if (w.length < 3 || isStopword(w)) continue;
    counts.set(w, (counts.get(w) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= 3)
    .sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]))
    .slice(0, limit);
}

/** Crude stemmer, good enough to treat "plan", "plans" and "planned" as the same heard word. */
export function stem(word: string): string {
  let w = word.replace(/'s$/, '');
  let stripped = false;
  if (w.length > 5 && w.endsWith('ing')) {
    w = w.slice(0, -3);
    stripped = true;
  } else if (w.length > 4 && w.endsWith('ied')) {
    w = w.slice(0, -3) + 'y';
  } else if (w.length > 4 && w.endsWith('ed')) {
    w = w.slice(0, -2);
    stripped = true;
  } else if (w.length > 4 && w.endsWith('ies')) {
    w = w.slice(0, -3) + 'y';
  } else if (w.length > 4 && /(s|x|z|ch|sh)es$/.test(w)) {
    w = w.slice(0, -2);
  } else if (w.length > 3 && w.endsWith('s') && !w.endsWith('ss')) {
    w = w.slice(0, -1);
  }
  // "planned" -> "plann" -> "plan"
  if (stripped && w.length > 3 && /([b-df-hj-np-tv-z])\1$/.test(w)) w = w.slice(0, -1);
  if (w.length > 4 && w.endsWith('e')) w = w.slice(0, -1);
  return w;
}
