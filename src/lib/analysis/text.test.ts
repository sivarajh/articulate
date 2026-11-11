import { describe, expect, it } from 'vitest';
import { countWords, mattr, normalizeWord, stem, tokenize, topContentWords, wordsOf } from './text';

describe('tokenize', () => {
  it('normalises case, punctuation and curly quotes', () => {
    expect(normalizeWord('Hello,')).toBe('hello');
    expect(normalizeWord('“don’t”')).toBe("don't");
    expect(normalizeWord('—')).toBe('');
  });

  it('marks sentence starts', () => {
    const tokens = tokenize('So it works. Then we ship! Right?');
    expect(tokens.filter((t) => t.sentenceStart).map((t) => t.norm)).toEqual(['so', 'then', 'right']);
  });

  it('keeps punctuation-only tokens for display but does not count them as words', () => {
    expect(tokenize('wait — what').length).toBe(3);
    expect(countWords('wait — what')).toBe(2);
    expect(wordsOf('  One,  two.  ')).toEqual(['one', 'two']);
  });
});

describe('mattr', () => {
  it('is null for very short texts', () => {
    expect(mattr(['a', 'b', 'c'])).toBeNull();
  });

  it('is 1 when no word repeats and low when one word repeats', () => {
    const distinct = Array.from({ length: 60 }, (_, i) => `w${i}`);
    expect(mattr(distinct)).toBe(1);
    const same = Array.from({ length: 60 }, () => 'again');
    expect(mattr(same)).toBeCloseTo(1 / 40, 5);
  });

  it('does not fall just because a text is longer', () => {
    const cycle = Array.from({ length: 30 }, (_, i) => `w${i}`);
    const short = [...cycle, ...cycle];
    const long = [...short, ...short, ...short];
    expect(mattr(long)!).toBeCloseTo(mattr(short)!, 2);
  });
});

describe('topContentWords', () => {
  it('ignores stopwords and rare words', () => {
    const words = wordsOf('the plan is the plan and the plan works because the team trusts the team');
    expect(topContentWords(words)).toEqual([['plan', 3]]);
  });
});

describe('stem', () => {
  it('folds common inflections together', () => {
    expect(stem('plans')).toBe(stem('plan'));
    expect(stem('planned')).toBe(stem('plan'));
    expect(stem('leveraging')).toBe(stem('leverage'));
    expect(stem('leveraged')).toBe(stem('leverage'));
    expect(stem('studies')).toBe(stem('study'));
    expect(stem('boxes')).toBe(stem('box'));
  });

  it('keeps different words apart', () => {
    expect(stem('sells')).not.toBe(stem('shells'));
    expect(stem('class')).toBe('class');
  });
});
