import { router } from 'expo-router';
import { useMemo, useState } from 'react';
import { View } from 'react-native';
import { minutes, shortDate } from '@core/format';
import { computeProgress } from '@core/progress';
import { SKILLS, type TakeRecord } from '@core/types';
import { TakeList } from '@/features/TakeList';
import { useStore } from '@/lib/store';
import { LineChart, MeterList, type LinePoint } from '@/ui/charts';
import { Btn, Card, Chip, Row, Screen, Section, T, Tile } from '@/ui/kit';

type Filter = 'all' | 'impromptu' | 'framework' | 'drill';

const FILTERS: [Filter, string][] = [
  ['all', 'All'],
  ['impromptu', 'On the spot'],
  ['framework', 'Frameworks'],
  ['drill', 'Drills'],
];

function matches(take: TakeRecord, filter: Filter): boolean {
  const id = take.exercise.drillId;
  const spot = id === 'impromptu' || id === 'custom' || id === 'hot-seat';
  if (filter === 'all') return true;
  if (filter === 'impromptu') return spot;
  if (filter === 'framework') return id === 'framework';
  return !spot && id !== 'framework';
}

/** Oldest-to-newest points for a trend chart from the most recent takes that have the value. */
function series(takes: TakeRecord[], value: (take: TakeRecord) => number | null, limit = 30): LinePoint[] {
  const points: LinePoint[] = [];
  for (const take of takes) {
    const y = value(take);
    if (y == null) continue;
    points.push({ x: 0, y, label: shortDate(take.at) });
    if (points.length === limit) break;
  }
  return points.reverse().map((p, i) => ({ ...p, x: i }));
}

function Trend({ title, sub, points, unit, yName, include }: { title: string; sub: string; points: LinePoint[]; unit?: string; yName: string; include?: number[] }) {
  return (
    <Card>
      <View>
        <T v="h3">{title}</T>
        <T v="small">{sub}</T>
      </View>
      {points.length >= 2 ? (
        <LineChart points={points} description={`${title} over your recent takes`} xName="Take" yName={yName} unit={unit} height={160} include={include} />
      ) : (
        <T v="small">Two takes are needed to draw a trend.</T>
      )}
    </Card>
  );
}

export default function Progress() {
  const takes = useStore((s) => s.takes);
  const paceMin = useStore((s) => s.settings.paceMin);
  const paceMax = useStore((s) => s.settings.paceMax);
  const [filter, setFilter] = useState<Filter>('all');
  const [shown, setShown] = useState(20);
  const progress = useMemo(() => computeProgress(takes), [takes]);

  const scorePoints = useMemo(() => series(takes, (t) => t.analysis.overall), [takes]);
  const fillerPoints = useMemo(
    () => series(takes, (t) => (t.analysis.sufficient && t.exercise.mode === 'speak' ? Math.round(t.analysis.fillersPerMin * 10) / 10 : null)),
    [takes],
  );
  const pacePoints = useMemo(() => series(takes, (t) => (t.exercise.mode === 'speak' ? t.analysis.wpm : null)), [takes]);

  if (takes.length === 0) {
    return (
      <Screen>
        <View style={{ gap: 6 }}>
          <T v="eyebrow">Progress</T>
          <T v="title">Nothing to show yet.</T>
          <T muted>Record your first take and this page starts tracking your pace, fillers, scores and skills over time.</T>
        </View>
        <Row>
          <Btn large label="Start practising" onPress={() => router.navigate('/practice')} />
        </Row>
      </Screen>
    );
  }

  const filtered = takes.filter((t) => matches(t, filter));
  const strongest = SKILLS.find((s) => s.id === progress.strongest);
  const weakest = SKILLS.find((s) => s.id === progress.weakest);

  return (
    <Screen>
      <View style={{ gap: 6 }}>
        <T v="eyebrow">Progress</T>
        <T v="title">
          Level {progress.level.number}: {progress.level.name}
        </T>
        <T muted>{progress.level.span - progress.level.into} XP to the next level. You earn XP for every take, more for longer takes, better scores and targets met.</T>
      </View>

      <Row wrap style={{ gap: 10, alignItems: 'stretch' }}>
        <Tile label="Time speaking" value={minutes(progress.totalMinutes)} unit="min" sub={`${progress.takes} takes`} />
        <Tile label="Current streak" value={String(progress.streak)} unit={progress.streak === 1 ? 'day' : 'days'} sub={`Best ${progress.bestStreak}`} />
        <Tile label="Recent average" value={progress.recentAverage != null ? String(progress.recentAverage) : '–'} sub="Last ten scored takes" />
        <Tile label="Experience" value={String(progress.xp)} unit="XP" sub={`${progress.level.into} of ${progress.level.span} this level`} />
      </Row>

      <Section title="Trends" sub={`Your last ${Math.min(30, takes.length)} takes, oldest to newest.`} />
      <Trend title="Overall score" sub="Out of 100" points={scorePoints} yName="Score" include={[40, 100]} />
      <Trend title="Fillers" sub="Per minute, lower is better" points={fillerPoints} yName="Fillers per minute" include={[0, 4]} />
      <Trend title="Pace" sub={`Words a minute, target ${paceMin}–${paceMax}`} points={pacePoints} yName="Words per minute" unit="wpm" include={[paceMin, paceMax]} />

      <Section title="Skills" />
      <Card style={{ gap: 14 }}>
        <MeterList rows={progress.skills.map((s) => ({ label: s.label, value: s.score }))} />
        {strongest && weakest && (
          <T muted>
            Strongest: {strongest.label.toLowerCase()}. Most room to grow: {weakest.label.toLowerCase()} ({weakest.blurb.toLowerCase()}).
          </T>
        )}
      </Card>

      <Section title="History" />
      <View accessibilityRole="radiogroup" accessibilityLabel="Filter history" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {FILTERS.map(([id, label]) => (
          <Chip key={id} label={label} selected={filter === id} onPress={() => setFilter(id)} />
        ))}
      </View>
      <Card style={{ paddingVertical: 4, gap: 0 }}>
        {filtered.length ? (
          <TakeList takes={filtered.slice(0, shown)} />
        ) : (
          <T muted center style={{ paddingVertical: 24 }}>
            No takes of this kind yet.
          </T>
        )}
      </Card>
      {filtered.length > shown && (
        <Row style={{ justifyContent: 'center' }}>
          <Btn kind="secondary" label="Show more" onPress={() => setShown(shown + 30)} />
        </Row>
      )}
    </Screen>
  );
}
