import { describe, expect, it } from 'vitest';
import type { FlagKind } from '../types';
import { findFlags, sameWord, weakCloser, weakOpener, type FlagOptions } from './flags';
import { tokenize } from './text';

/** The flagged phrases of one kind, as text. */
function flagged(text: string, kind: FlagKind, options?: FlagOptions): string[] {
  const tokens = tokenize(text);
  return findFlags(tokens, options)
    .filter((f) => f.kind === kind)
    .map((f) =>
      tokens
        .slice(f.start, f.end)
        .map((t) => t.norm)
        .join(' '),
    );
}

describe('fillers', () => {
  it('flags hesitation sounds and crutch words', () => {
    expect(flagged('um so we uh basically shipped it', 'filler')).toEqual(['um', 'uh', 'basically']);
  });

  it('flags "like" only where it is padding', () => {
    expect(flagged('and like we just left', 'filler')).toEqual(['like']);
    expect(flagged('it was like really big', 'filler')).toEqual(['like']);
    expect(flagged('I was like no way', 'filler')).toEqual(['like']);
    expect(flagged('Like totally', 'filler')).toEqual(['like']);
  });

  it('leaves the verb and the comparison alone', () => {
    expect(flagged('I really like pizza', 'filler')).toEqual([]);
    expect(flagged('I would like to thank you', 'filler')).toEqual([]);
    expect(flagged('it is like herding cats', 'filler')).toEqual([]);
    expect(flagged("it's like trying to drink from a hose", 'filler')).toEqual([]);
    expect(flagged('it was like a dream', 'filler')).toEqual([]);
    expect(flagged('tools like Slack help', 'filler')).toEqual([]);
    expect(flagged('Like I said we are ready', 'filler')).toEqual([]);
  });

  it('distinguishes filler "you know" from the literal phrase', () => {
    expect(flagged('it was you know pretty hard', 'filler')).toEqual(['you know']);
    expect(flagged('do you know the answer', 'filler')).toEqual([]);
    expect(flagged('as you know we launched', 'filler')).toEqual([]);
    expect(flagged('you know how it goes', 'filler')).toEqual([]);
    expect(flagged('it is hard you know what i mean', 'filler')).toEqual(['you know what i mean']);
  });

  it('distinguishes filler "I mean" from the literal phrase', () => {
    expect(flagged('I mean we could try', 'filler')).toEqual(['i mean']);
    expect(flagged('that is what I mean', 'filler')).toEqual([]);
    expect(flagged('I mean it', 'filler')).toEqual([]);
  });

  it('honours custom fillers', () => {
    expect(flagged('right so at the end of the day we won', 'filler', { customFillers: ['at the end of the day'] })).toEqual([
      'at the end of the day',
    ]);
  });
});

describe('hedges and vague words', () => {
  it('flags adverbial "kind of" but not the noun', () => {
    expect(flagged('it was kind of hard', 'hedge')).toEqual(['kind of']);
    expect(flagged('what kind of bird is that', 'hedge')).toEqual([]);
    expect(flagged('this is a sort of test', 'hedge')).toEqual([]);
  });

  it('flags "I think" as a softener but not as a verb of thought', () => {
    expect(flagged('I think we should go', 'hedge')).toEqual(['i think']);
    expect(flagged('I think about it daily', 'hedge')).toEqual([]);
  });

  it('flags vague nouns and trailing phrases', () => {
    expect(flagged('we fixed the thing and stuff like that', 'vague')).toEqual(['thing', 'and stuff like that']);
  });
});

describe('stumbles', () => {
  it('flags doubled words and restarted phrases', () => {
    expect(flagged('we we need the the plan', 'repeat')).toEqual(['we', 'the']);
    expect(flagged('I think I think we go', 'repeat')).toEqual(['i think']);
  });

  it('allows emphasis', () => {
    expect(flagged('it was very very good and I had had enough', 'repeat')).toEqual([]);
  });
});

describe('signposts', () => {
  it('labels signposts by the job they do', () => {
    const tokens = tokenize('First we tried email. However it failed because nobody read it. For example Sam missed three. In short it flopped.');
    const kinds = findFlags(tokens)
      .filter((f) => f.kind === 'signpost')
      .map((f) => f.label);
    expect(kinds).toEqual(['sequence', 'contrast', 'cause', 'example', 'summary']);
  });
});

describe('taboo and target words', () => {
  it('matches inflected forms', () => {
    expect(sameWord('beans', 'bean')).toBe(true);
    expect(sameWord('drinking', 'drink')).toBe(true);
    expect(sameWord('drunk', 'drink')).toBe(false);
    expect(flagged('people love drinking it hot', 'taboo', { taboo: ['drink', 'hot', 'cup'] })).toEqual(['drinking', 'hot']);
    expect(flagged('we leveraged a catalyst', 'target', { mustUse: ['leverage', 'catalyst', 'nuance'] })).toEqual([
      'leveraged',
      'catalyst',
    ]);
  });
});

describe('openings and endings', () => {
  it('spots a wind-up opener', () => {
    expect(weakOpener(tokenize('Okay so the plan is simple'))).toBe('okay so');
    expect(weakOpener(tokenize('Um I would say yes'))).toBe('um');
    expect(weakOpener(tokenize('So many people ask this'))).toBeNull();
    expect(weakOpener(tokenize('The answer is yes'))).toBeNull();
  });

  it('spots a trailing-off ending', () => {
    expect(weakCloser(tokenize('and we shipped it so yeah'))).toBe('so yeah');
    expect(weakCloser(tokenize("it went fine I think that's it"))).toBe("i think that's it");
    expect(weakCloser(tokenize('That is why we should buy.'))).toBeNull();
  });
});
