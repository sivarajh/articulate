import { useMemo } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { MeterList, Status, WeekBars } from '../components/charts';
import { TakeList } from '../components/TakeList';
import { DRILLS, buildDaily, buildDrill, buildImpromptu, dateKey, drillInfo, planMinutes } from '../lib/content/drills';
import { duration, greeting, minutes } from '../lib/format';
import { computeProgress } from '../lib/progress';
import { setPlan } from '../lib/session';
import { useStore } from '../lib/store';
import { SKILLS, type DrillId, type Plan, type SkillId } from '../lib/types';

/** The drill to suggest for a weak skill. */
const TRAIN: Record<SkillId, DrillId> = {
  fluency: 'filler-free',
  pace: 'pace-lock',
  clarity: 'shrink-it',
  structure: 'hot-seat',
  vocabulary: 'word-weave',
  delivery: 'power-pause',
};

export function Home() {
  const navigate = useNavigate();
  const takes = useStore((s) => s.takes);
  const dailyDone = useStore((s) => s.dailyDone);
  const goal = useStore((s) => s.settings.dailyGoalMin);
  const progress = useMemo(() => computeProgress(takes), [takes]);
  const today = dateKey();
  const daily = useMemo(() => buildDaily(today, progress.weakest), [today, progress.weakest]);
  const doneToday = dailyDone.includes(today);
  const isNew = takes.length === 0;

  const start = (plan: Plan) => {
    setPlan(plan);
    navigate('/session');
  };

  const weakest = progress.weakest ? SKILLS.find((s) => s.id === progress.weakest)! : null;
  const weakDrill = weakest ? drillInfo(TRAIN[weakest.id]) : null;
  const dateLine = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <div className="page">
      <header className="page-head">
        <span className="eyebrow">{dateLine}</span>
        <h1 className="title">{greeting()}.</h1>
        <p className="lede">
          {isNew
            ? 'Speaking well on the spot is a skill, and skills are built in short, honest repetitions. Say it out loud, see exactly what happened, and say it again.'
            : progress.todayMinutes > 0
              ? `You have practised ${minutes(progress.todayMinutes)} of your ${goal} minutes today.`
              : `Nothing recorded yet today. ${goal} minutes is all it takes.`}
        </p>
      </header>

      <section className="card hero-card" aria-labelledby="daily-title">
        <div className="stack" style={{ gap: 14, alignItems: 'flex-start' }}>
          <span className="eyebrow">Today’s workout · about {planMinutes(daily)} minutes</span>
          <h2 className="hero-title" id="daily-title">
            {doneToday ? 'Done for today. Keep going if you like.' : isNew ? 'Start here: three short steps.' : 'Three steps, aimed at what you need most.'}
          </h2>
          <div className="row-wrap" style={{ marginTop: 6 }}>
            <button type="button" className={`btn btn-lg ${doneToday ? 'btn-secondary' : 'btn-primary'}`} onClick={() => start(daily)}>
              <Icon name="play" size={16} />
              {doneToday ? 'Run it again' : 'Start workout'}
            </button>
            {doneToday && <Status level="good" label="Complete" />}
          </div>
        </div>
        <ol className="steps" aria-label="Workout steps">
          {daily.steps.map((step, i) => (
            <li key={step.id} className={doneToday ? 'done' : undefined}>
              <div>
                <div className="step-name">{step.title}</div>
                <div className="step-cue">
                  {i === 0 ? 'Warm-up' : step.guided ? 'Guided structure practice' : step.tag} · {duration(step.speakSec)}
                </div>
              </div>
            </li>
          ))}
        </ol>
      </section>

      {isNew ? (
        <section className="section" aria-labelledby="how-title">
          <div className="section-head">
            <h2 className="section-title" id="how-title">
              How it works
            </h2>
          </div>
          <div className="grid grid-3">
            {[
              ['mic', 'Speak', 'Answer a real question out loud, against the clock, the way you would have to in the room.'],
              ['gauge', 'Get measured', 'See your pace, fillers, hedges, pauses and structure, with the exact words marked in your transcript.'],
              ['retry', 'Repeat', 'Fix one thing and go again. The second take is where the improvement happens.'],
            ].map(([icon, title, text]) => (
              <div key={title} className="card stack" style={{ gap: 8 }}>
                <span className="option-icon">
                  <Icon name={icon!} size={18} />
                </span>
                <div className="option-title">{title}</div>
                <p className="option-text">{text}</p>
              </div>
            ))}
          </div>
        </section>
      ) : (
        <>
          <section className="section" aria-label="Your numbers">
            <div className="grid grid-4">
              <div className="card tile">
                <span className="tile-label">Streak</span>
                <span className="tile-value">
                  {progress.streak}
                  <small>{progress.streak === 1 ? 'day' : 'days'}</small>
                </span>
                <span className="tile-sub">Best {progress.bestStreak}</span>
              </div>
              <div className="card tile">
                <span className="tile-label">This week</span>
                <span className="tile-value">
                  {minutes(progress.weekMinutes)}
                  <small>min</small>
                </span>
                <span className="tile-sub">Goal {goal} a day</span>
              </div>
              <div className="card tile">
                <span className="tile-label">Recent average</span>
                <span className="tile-value">{progress.recentAverage ?? '–'}</span>
                <span className="tile-sub">Last ten scored takes</span>
              </div>
              <div className="card tile">
                <span className="tile-label">Takes</span>
                <span className="tile-value">{progress.takes}</span>
                <span className="tile-sub">{minutes(progress.totalMinutes)} min in total</span>
              </div>
            </div>
          </section>

          <section className="section split" aria-label="Skills and activity">
            <div className="card">
              <div className="card-head">
                <div>
                  <div className="card-title">Your skills</div>
                  <div className="card-sub">Out of 100, weighted toward recent takes</div>
                </div>
              </div>
              <MeterList rows={progress.skills.map((s) => ({ label: s.label, value: s.score }))} />
              {weakest && weakDrill && (
                <div className="row" style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)', flexWrap: 'wrap' }}>
                  <div style={{ flex: '1 1 200px' }}>
                    <div className="card-title">Work on {weakest.label.toLowerCase()}</div>
                    <div className="card-sub">{weakest.blurb}</div>
                  </div>
                  <button type="button" className="btn btn-secondary" onClick={() => start(buildDrill(weakDrill.id))}>
                    {weakDrill.name}
                    <Icon name="arrow-right" size={16} />
                  </button>
                </div>
              )}
            </div>
            <div className="card">
              <div className="card-head">
                <div>
                  <div className="card-title">Last seven days</div>
                  <div className="card-sub">Minutes practised each day</div>
                </div>
              </div>
              <WeekBars days={progress.week} />
              <div style={{ marginTop: 18, paddingTop: 16, borderTop: '1px solid var(--border)' }}>
                <MeterList
                  max={goal}
                  rows={[
                    {
                      label: 'Today',
                      value: Math.min(goal, progress.todayMinutes),
                      figure: `${minutes(progress.todayMinutes)} of ${goal} min`,
                    },
                  ]}
                />
              </div>
            </div>
          </section>
        </>
      )}

      <section className="section" aria-labelledby="quick-title">
        <div className="section-head">
          <h2 className="section-title" id="quick-title">
            Quick start
          </h2>
          <Link to="/practice" className="link">
            All practice
          </Link>
        </div>
        <div className="grid grid-3">
          <button
            type="button"
            className="option"
            onClick={() => start(buildImpromptu({ category: 'any', speakSec: 60, prepSec: 15, framework: 'auto' }))}
          >
            <span className="option-icon">
              <Icon name="shuffle" size={18} />
            </span>
            <span className="option-title">Random question</span>
            <span className="option-text">One question from any situation. Fifteen seconds to think, sixty to answer.</span>
          </button>
          {(['hot-seat', 'filler-free'] as const).map((id) => {
            const drill = DRILLS.find((d) => d.id === id)!;
            return (
              <button key={id} type="button" className="option" onClick={() => start(buildDrill(id))}>
                <span className="option-icon">
                  <Icon name={drill.icon} size={18} />
                </span>
                <span className="option-title">{drill.name}</span>
                <span className="option-text">{drill.summary}</span>
              </button>
            );
          })}
        </div>
      </section>

      {!isNew && (
        <section className="section" aria-labelledby="recent-title">
          <div className="section-head">
            <h2 className="section-title" id="recent-title">
              Recent takes
            </h2>
            <Link to="/progress" className="link">
              Full history
            </Link>
          </div>
          <div className="card">
            <TakeList takes={takes.slice(0, 4)} />
          </div>
        </section>
      )}
    </div>
  );
}
