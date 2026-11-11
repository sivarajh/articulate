// The transcript with the words worth noticing marked, and a legend that doubles as a filter.
// Each kind has its own colour and its own underline style, and every mark carries a
// tooltip, so nothing depends on colour alone.

import { Fragment, useMemo, useState } from 'react';
import { findFlags, type FlagOptions } from '../lib/analysis/flags';
import { normalizeWord, tokenize } from '../lib/analysis/text';
import type { FlagKind } from '../lib/types';

const KINDS: { kind: FlagKind; label: string; color: string; describe: (label: string) => string }[] = [
  { kind: 'signpost', label: 'Signposts', color: 'var(--c1)', describe: (l) => `Signpost (${l})` },
  { kind: 'filler', label: 'Fillers', color: 'var(--c2)', describe: (l) => `Filler: “${l}”` },
  { kind: 'hedge', label: 'Hedges', color: 'var(--c3)', describe: (l) => `Hedge: “${l}”` },
  { kind: 'vague', label: 'Vague words', color: 'var(--c4)', describe: (l) => `Vague: “${l}”` },
  { kind: 'repeat', label: 'Stumbles', color: 'var(--c5)', describe: (l) => `Stumble: ${l}` },
  { kind: 'taboo', label: 'Taboo words', color: 'var(--critical)', describe: (l) => `Taboo word: “${l}”` },
  { kind: 'target', label: 'Target words', color: 'var(--good)', describe: (l) => `Target word: “${l}”` },
];

export function Transcript({ text, options }: { text: string; options: FlagOptions }) {
  const [hidden, setHidden] = useState<Set<FlagKind>>(new Set());
  const { tokens, flags } = useMemo(() => {
    const tokens = tokenize(text);
    return { tokens, flags: findFlags(tokens, options) };
  }, [text, options]);

  const counts = new Map<FlagKind, number>();
  for (const flag of flags) counts.set(flag.kind, (counts.get(flag.kind) ?? 0) + 1);
  const present = KINDS.filter((k) => counts.has(k.kind));

  const toggle = (kind: FlagKind) =>
    setHidden((current) => {
      const next = new Set(current);
      if (next.has(kind)) next.delete(kind);
      else next.add(kind);
      return next;
    });

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  const words = (from: number, to: number) =>
    tokens
      .slice(from, to)
      .map((t) => t.raw)
      .join(' ');
  for (const flag of flags) {
    if (flag.start > cursor) parts.push(<Fragment key={`t${cursor}`}>{words(cursor, flag.start)} </Fragment>);
    const info = KINDS.find((k) => k.kind === flag.kind)!;
    parts.push(
      hidden.has(flag.kind) ? (
        <Fragment key={`f${flag.start}`}>{words(flag.start, flag.end)} </Fragment>
      ) : (
        <Fragment key={`f${flag.start}`}>
          <mark className={`flag flag-${flag.kind}`} title={info.describe(flag.label)}>
            {words(flag.start, flag.end)}
          </mark>{' '}
        </Fragment>
      ),
    );
    cursor = flag.end;
  }
  if (cursor < tokens.length) parts.push(<Fragment key={`t${cursor}`}>{words(cursor, tokens.length)}</Fragment>);

  return (
    <div>
      {present.length > 0 && (
        <div className="legend" role="group" aria-label="Show or hide marks in the transcript">
          {present.map((k) => (
            <button
              key={k.kind}
              type="button"
              className="legend-item"
              aria-pressed={!hidden.has(k.kind)}
              onClick={() => toggle(k.kind)}
            >
              <span className="swatch" style={{ background: k.color }} />
              {k.label}
              <span className="legend-count">{counts.get(k.kind)}</span>
            </button>
          ))}
        </div>
      )}
      <p className="transcript">{parts}</p>
    </div>
  );
}

/** A passage to read aloud. Pause marks are styled; with `hits`, words that were not heard are marked. */
export function Passage({ text, hits }: { text: string; hits?: boolean[] }) {
  let wordIndex = 0;
  return (
    <>
      {text.split(/\s+/).map((raw, i) => {
        if (raw === '/' || raw === '//') {
          return (
            <Fragment key={i}>
              <span className="pause-mark" title={raw === '//' ? 'Long pause: two beats' : 'Pause: one beat'}>
                {raw}
              </span>{' '}
            </Fragment>
          );
        }
        const isWord = normalizeWord(raw) !== '';
        const heard = !isWord || !hits || hits[wordIndex] !== false;
        if (isWord) wordIndex++;
        return (
          <Fragment key={i}>
            {heard ? raw : <span className="miss" title="Not heard clearly">{raw}</span>}{' '}
          </Fragment>
        );
      })}
    </>
  );
}
