// The transcript with the words worth noticing marked. Each kind has its own tint and
// underline, the legend filters them, and tapping a marked word says what it is.

import { useMemo, useState } from 'react';
import { Pressable, Text, View, type TextStyle } from 'react-native';
import { findFlags, type FlagOptions } from '@core/analysis/flags';
import { normalizeWord, tokenize } from '@core/analysis/text';
import type { FlagKind } from '@core/types';
import { T } from '@/ui/kit';
import { font, tint, useTheme, type Theme } from '@/ui/theme';

interface KindInfo {
  kind: FlagKind;
  label: string;
  color: (t: Theme) => string;
  line: TextStyle['textDecorationStyle'];
  describe: (label: string) => string;
}

const KINDS: KindInfo[] = [
  { kind: 'signpost', label: 'Signposts', color: (t) => t.c[0], line: 'solid', describe: (l) => `Signpost (${l})` },
  { kind: 'filler', label: 'Fillers', color: (t) => t.c[1], line: 'solid', describe: (l) => `Filler: “${l}”` },
  { kind: 'hedge', label: 'Hedges', color: (t) => t.c[2], line: 'dashed', describe: (l) => `Hedge: “${l}”` },
  { kind: 'vague', label: 'Vague words', color: (t) => t.c[3], line: 'dotted', describe: (l) => `Vague: “${l}”` },
  { kind: 'repeat', label: 'Stumbles', color: (t) => t.c[4], line: 'double', describe: (l) => `Stumble: ${l}` },
  { kind: 'taboo', label: 'Taboo words', color: (t) => t.critical, line: 'solid', describe: (l) => `Taboo word: “${l}”` },
  { kind: 'target', label: 'Target words', color: (t) => t.good, line: 'solid', describe: (l) => `Target word: “${l}”` },
];

export function Transcript({ text, options }: { text: string; options: FlagOptions }) {
  const t = useTheme();
  const [hidden, setHidden] = useState<Set<FlagKind>>(new Set());
  const [picked, setPicked] = useState<string | null>(null);
  const { tokens, flags } = useMemo(() => {
    const tokens = tokenize(text);
    return { tokens, flags: findFlags(tokens, options) };
  }, [text, options]);

  const counts = new Map<FlagKind, number>();
  for (const flag of flags) counts.set(flag.kind, (counts.get(flag.kind) ?? 0) + 1);
  const present = KINDS.filter((k) => counts.has(k.kind));

  const toggle = (kind: FlagKind) => {
    const next = new Set(hidden);
    if (next.has(kind)) next.delete(kind);
    else next.add(kind);
    setHidden(next);
  };

  const words = (from: number, to: number) =>
    tokens
      .slice(from, to)
      .map((token) => token.raw)
      .join(' ');

  const parts: React.ReactNode[] = [];
  let cursor = 0;
  for (const flag of flags) {
    if (flag.start > cursor) parts.push(`${words(cursor, flag.start)} `);
    const info = KINDS.find((k) => k.kind === flag.kind)!;
    const color = info.color(t);
    if (hidden.has(flag.kind)) {
      parts.push(`${words(flag.start, flag.end)} `);
    } else {
      const description = info.describe(flag.label);
      parts.push(
        <Text
          key={`f${flag.start}`}
          accessibilityLabel={`${words(flag.start, flag.end)}, ${description}`}
          onPress={() => setPicked(description)}
          style={{
            backgroundColor: tint(color, 0.24),
            textDecorationLine: flag.kind === 'taboo' ? 'line-through' : 'underline',
            textDecorationColor: color,
            textDecorationStyle: info.line,
          }}
        >
          {words(flag.start, flag.end)}
        </Text>,
        ' ',
      );
    }
    cursor = flag.end;
  }
  if (cursor < tokens.length) parts.push(words(cursor, tokens.length));

  return (
    <View style={{ gap: 12 }}>
      {present.length > 0 && (
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {present.map((k) => {
            const on = !hidden.has(k.kind);
            return (
              <Pressable
                key={k.kind}
                accessibilityRole="switch"
                accessibilityState={{ checked: on }}
                accessibilityLabel={`${k.label}, ${counts.get(k.kind)}`}
                onPress={() => toggle(k.kind)}
                style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 10, paddingVertical: 5, borderRadius: 999, borderWidth: 1, borderColor: t.border }}
              >
                <View style={{ width: 10, height: 10, borderRadius: 3, backgroundColor: k.color(t), opacity: on ? 1 : 0.25 }} />
                <Text style={{ fontFamily: font.sans, fontSize: 13, color: on ? t.ink : t.muted }}>{k.label}</Text>
                <Text style={{ fontFamily: font.sans, fontSize: 13, color: t.ink2 }}>{counts.get(k.kind)}</Text>
              </Pressable>
            );
          })}
        </View>
      )}
      {picked && <T v="small">{picked}</T>}
      <Text style={{ fontFamily: font.sans, fontSize: 17, lineHeight: 29, color: t.ink }}>{parts}</Text>
    </View>
  );
}

/** A passage to read aloud. Pause marks stand out; with `hits`, words that were not heard are marked. */
export function Passage({ text, hits, size = 20 }: { text: string; hits?: boolean[]; size?: number }) {
  const t = useTheme();
  let wordIndex = 0;
  return (
    <Text testID="passage" style={{ fontFamily: font.serif, fontSize: size, lineHeight: Math.round(size * 1.6), color: t.ink }}>
      {text.split(/\s+/).map((raw, i) => {
        if (raw === '/' || raw === '//') {
          return (
            <Text key={i} accessibilityLabel={raw === '//' ? 'long pause' : 'pause'} style={{ fontFamily: font.bold, fontSize: size * 0.8, color: t.accent }}>
              {raw}{' '}
            </Text>
          );
        }
        const isWord = normalizeWord(raw) !== '';
        const heard = !isWord || !hits || hits[wordIndex] !== false;
        if (isWord) wordIndex++;
        return heard ? (
          `${raw} `
        ) : (
          <Text key={i} accessibilityLabel={`${raw}, not heard clearly`} style={{ color: t.criticalInk, textDecorationLine: 'underline' }}>
            {raw}{' '}
          </Text>
        );
      })}
    </Text>
  );
}
