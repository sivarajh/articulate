import { useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { LineChart, MeterList, type LinePoint } from '../components/charts';
import { TakeList } from '../components/TakeList';
import { minutes, shortDate } from '../lib/format';
import { computeProgress } from '../lib/progress';
import { useStore } from '../lib/store';
import { SKILLS, type TakeRecord } from '../lib/types';

type Filter = 'all' | 'impromptu' | 'framework' | 'drill';

const FILTERS: [Filter, string][] = [
  ['all', 'All'],
  ['impromptu', 'On the spot'],
  ['framework', 'Frameworks'],
  ['drill', 'Drills'],
];

function matches(take: TakeRecord, filter: Filter): boolean {
  const id = take.exercise.drillId;
  if (filter === 'all') return true;
  if (filter === 'impromptu') return id === 'impromptu' || id === 'custom' || id === 'hot-seat';
  if (filter === 'framework') return id === 'framework';
  return id !== 'impromptu' && id !== 'custom' && id !== 'hot-seat' && id !== 'framework';
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
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">{title}</div>
          <div className="card-sub">{sub}</div>
        </div>
      </div>
      {points.length >= 2 ? (
        <LineChart points={points} ariaLabel={`${title} over your recent takes`} xName="Take" yName={yName} unit={unit} height={170} include={include} />
      ) : (
        <p className="muted small">Two takes are needed to draw a trend.</p>
      )}
    </div>
  );
}

export function ProgressPage() {
  const takes = useStore((s) => s.takes);
  const paceMin = useStore((s) => s.settings.paceMin);
  const paceMax = useStore((s) => s.settings.paceMax);
  const [filter, setFilter] = useState<Filter>('all');
  const [shown, setShown] = useState(20);
  const progress = useMemo(() => computeProgress(takes), [takes]);

  const scorePoints = useMemo(() => series(takes, (t) => t.analysis.overall), [takes]);
  const fillerPoints = useMemo(
    () =>
      series(takes, (t) =>
        t.analysis.sufficient && t.exercise.mode === 'speak' ? Math.round(t.analysis.fillersPerMin * 10) / 10 : null,
      ),
    [takes],
  );
  const pacePoints = useMemo(() => series(takes, (t) => (t.exercise.mode === 'speak' ? t.analysis.wpm : null)), [takes]);

  const filtered = takes.filter((t) => matches(t, filter));
  const strongest = SKILLS.find((s) => s.id === progress.strongest);
  const weakest = SKILLS.find((s) => s.id === progress.weakest);

  if (takes.length === 0) {
    return (
      <div className="page">
        <header className="page-head">
          <span className="eyebrow">Progress</span>
          <h1 className="title">Nothing to show yet.</h1>
          <p className="lede">Record your first take and this page starts tracking your pace, fillers, scores and skills over time.</p>
        </header>
        <Link to="/practice" className="btn btn-primary btn-lg">
          Start practising
        </Link>
      </div>
    );
  }

  return (
    <div className="page">
      <header className="page-head">
        <span className="eyebrow">Progress</span>
        <h1 className="title">
          Level {progress.level.number}: {progress.level.name}
        </h1>
        <p className="lede">
          {progress.level.span - progress.level.into} XP to the next level. You earn XP for every take, more for longer
          takes, better scores and targets met.
        </p>
      </header>

      <div className="grid grid-4">
        <div className="card tile">
          <span className="tile-label">Time speaking</span>
          <span className="tile-value">
            {minutes(progress.totalMinutes)}
            <small>min</small>
          </span>
          <span className="tile-sub">{progress.takes} takes</span>
        </div>
        <div className="card tile">
          <span className="tile-label">Current streak</span>
          <span className="tile-value">
            {progress.streak}
            <small>{progress.streak === 1 ? 'day' : 'days'}</small>
          </span>
          <span className="tile-sub">Best {progress.bestStreak}</span>
        </div>
        <div className="card tile">
          <span className="tile-label">Recent average</span>
          <span className="tile-value">{progress.recentAverage ?? '–'}</span>
          <span className="tile-sub">Last ten scored takes</span>
        </div>
        <div className="card tile">
          <span className="tile-label">Experience</span>
          <span className="tile-value">
            {progress.xp}
            <small>XP</small>
          </span>
          <span className="tile-sub">
            {progress.level.into} of {progress.level.span} this level
          </span>
        </div>
      </div>

      <section className="section" aria-labelledby="trends-title">
        <div className="section-head">
          <div>
            <h2 className="section-title" id="trends-title">
              Trends
            </h2>
            <p className="section-sub">Your last {Math.min(30, takes.length)} takes, oldest to newest.</p>
          </div>
        </div>
        <div className="grid grid-3">
          <Trend title="Overall score" sub="Out of 100" points={scorePoints} yName="Score" include={[40, 100]} />
          <Trend title="Fillers" sub="Per minute, lower is better" points={fillerPoints} yName="Fillers per minute" include={[0, 4]} />
          <Trend title="Pace" sub={`Words a minute, target ${paceMin}–${paceMax}`} points={pacePoints} yName="Words per minute" unit="wpm" include={[paceMin, paceMax]} />
        </div>
      </section>

      <section className="section" aria-labelledby="skills-title">
        <div className="section-head">
          <h2 className="section-title" id="skills-title">
            Skills
          </h2>
        </div>
        <div className="card">
          <MeterList rows={progress.skills.map((s) => ({ label: s.label, value: s.score }))} />
          {strongest && weakest && (
            <p className="muted" style={{ marginTop: 16 }}>
              Strongest: {strongest.label.toLowerCase()}. Most room to grow: {weakest.label.toLowerCase()} (
              {weakest.blurb.toLowerCase()}).
            </p>
          )}
        </div>
      </section>

      <section className="section" aria-labelledby="history-title">
        <div className="section-head">
          <h2 className="section-title" id="history-title">
            History
          </h2>
        </div>
        <div className="chips" role="radiogroup" aria-label="Filter history" style={{ marginBottom: 14 }}>
          {FILTERS.map(([id, label]) => (
            <button key={id} type="button" role="radio" className="chip" aria-checked={filter === id} onClick={() => setFilter(id)}>
              {label}
            </button>
          ))}
        </div>
        <div className="card">
          {filtered.length ? <TakeList takes={filtered.slice(0, shown)} /> : <p className="empty">No takes of this kind yet.</p>}
        </div>
        {filtered.length > shown && (
          <div style={{ marginTop: 14, textAlign: 'center' }}>
            <button type="button" className="btn btn-secondary" onClick={() => setShown(shown + 30)}>
              Show more
            </button>
          </div>
        )}
      </section>
    </div>
  );
}
