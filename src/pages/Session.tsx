// A practice session, in focus mode: brief -> countdown -> speak -> report, once per step.
// Multi-step plans either pause on a report between steps or, for rapid drills, run
// straight through and summarise at the end.

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { Status } from '../components/charts';
import { TakeReport } from '../components/TakeReport';
import { Passage } from '../components/Transcript';
import { analyze, goalLabel, scoreBand } from '../lib/analysis/analyze';
import { findFlags, sameWord } from '../lib/analysis/flags';
import { tokenize, wordsOf } from '../lib/analysis/text';
import { saveAudio } from '../lib/audioStore';
import { buildCustom, remixPlan, repeatPlan } from '../lib/content/drills';
import { getFramework } from '../lib/content/frameworks';
import { clock, duration } from '../lib/format';
import { xpFor } from '../lib/progress';
import { setPlan, usePlan } from '../lib/session';
import { CaptureSession, MicError } from '../lib/speech/capture';
import { transcriptionSupported } from '../lib/speech/transcriber';
import { addTake, markDailyDone, useStore } from '../lib/store';
import type { Exercise, Plan, Settings, TakeRecord } from '../lib/types';

type Phase = 'brief' | 'prep' | 'live' | 'scoring' | 'report' | 'summary';

interface DoneTake {
  take: TakeRecord;
  audioUrl: string | null;
}

export function SessionRoute() {
  const plan = usePlan();
  if (!plan) return <Navigate to="/practice" replace />;
  return <Session key={plan.id} plan={plan} />;
}

/** With no prep time the question stays hidden until the clock starts. */
const isConcealed = (exercise: Exercise) => exercise.prepSec === 0 && exercise.mode === 'speak';

const promptClass = (text: string) =>
  text.length > 110 ? 'prompt prompt-small' : text.length > 60 ? 'prompt prompt-long' : 'prompt';

function Session({ plan }: { plan: Plan }) {
  const navigate = useNavigate();
  const settings = useStore((s) => s.settings);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('brief');
  const [done, setDone] = useState<DoneTake[]>([]);
  const [viewing, setViewing] = useState(0);
  const [fromSummary, setFromSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [capture, setCapture] = useState<CaptureSession | null>(null);

  const captureRef = useRef<CaptureSession | null>(null);
  const doneRef = useRef<DoneTake[]>([]);
  const urls = useRef<string[]>([]);
  const finishing = useRef(false);
  const mounted = useRef(true);

  const exercise = plan.steps[index]!;
  const isLast = index === plan.steps.length - 1;
  const multi = plan.steps.length > 1;

  useEffect(() => {
    mounted.current = true;
    const created = urls.current;
    return () => {
      mounted.current = false;
      captureRef.current?.close();
      captureRef.current = null;
      created.forEach((url) => URL.revokeObjectURL(url));
      window.speechSynthesis?.cancel();
    };
  }, []);

  useEffect(() => {
    window.scrollTo(0, 0);
  }, [phase, index, viewing]);

  const releaseCapture = () => {
    captureRef.current?.close();
    captureRef.current = null;
    setCapture(null);
  };

  const begin = async () => {
    if (opening) return;
    setError(null);
    if (!captureRef.current) {
      setOpening(true);
      try {
        const session = await CaptureSession.open({ lang: settings.lang, useMic: settings.recordAudio });
        if (!mounted.current) {
          session.close();
          return;
        }
        captureRef.current = session;
        setCapture(session);
        session.startMonitoring();
      } catch (e) {
        if (mounted.current) setError(e instanceof MicError ? e.message : 'The microphone could not be started.');
        return;
      } finally {
        if (mounted.current) setOpening(false);
      }
    }
    setPhase('prep');
  };

  const goLive = () => {
    if (!captureRef.current) return;
    finishing.current = false;
    captureRef.current.start();
    setPhase('live');
  };

  const finish = async () => {
    const session = captureRef.current;
    if (finishing.current || !session) return;
    finishing.current = true;
    setPhase('scoring');

    const { capture: captured, audio } = await session.stop();
    const analysis = analyze(captured, exercise, settings);
    const take: TakeRecord = {
      id: `take-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      at: Date.now(),
      planId: plan.id,
      planTitle: plan.title,
      exercise,
      capture: captured,
      analysis,
      xp: xpFor(analysis),
    };
    addTake(take);
    if (audio) void saveAudio(take.id, audio);
    if (isLast && plan.dailyKey) markDailyDone(plan.dailyKey);
    if (!mounted.current) return;

    let audioUrl: string | null = null;
    if (audio) {
      audioUrl = URL.createObjectURL(audio);
      urls.current.push(audioUrl);
    }
    doneRef.current = [...doneRef.current, { take, audioUrl }];
    setDone(doneRef.current);

    if (plan.rapid && !isLast) {
      // Keep the microphone open and go straight to the next one.
      setIndex(index + 1);
      setPhase('prep');
      return;
    }
    releaseCapture();
    if (plan.rapid) {
      setPhase('summary');
    } else {
      setViewing(doneRef.current.length - 1);
      setFromSummary(false);
      setPhase('report');
    }
  };

  const exit = () => {
    releaseCapture();
    navigate(-1);
  };

  const next = () => {
    setIndex(index + 1);
    setPhase('brief');
  };

  const followUp = (question: string) => {
    setPlan(buildCustom([question], { speakSec: 60, prepSec: 10, title: 'Follow-up' }));
  };

  // Keyboard: Space starts / skips the countdown / advances a framework step, Enter finishes.
  const keys = useRef<{ space?: () => void; enter?: () => void }>({});
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, button, a, summary, audio, svg[tabindex]')) return;
      if (event.code === 'Space' && keys.current.space) {
        event.preventDefault();
        keys.current.space();
      } else if (event.key === 'Enter' && keys.current.enter) {
        event.preventDefault();
        keys.current.enter();
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
  keys.current = phase === 'brief' ? { space: begin, enter: begin } : phase === 'prep' ? { space: goLive } : {};

  const shown = done[viewing];
  const recipe = plan.recipe;

  return (
    <div className="session">
      <header className="session-top">
        <button type="button" className="btn btn-ghost btn-icon" onClick={exit} aria-label="Leave session">
          <Icon name="x" />
        </button>
        <span className="session-title">{plan.title}</span>
        {multi && (
          <div className="dots" aria-label={`Step ${index + 1} of ${plan.steps.length}`}>
            {plan.steps.map((step, i) => {
              const finished = done.some((d) => d.take.exercise.id === step.id);
              return <span key={step.id} className={`dot${finished ? ' dot-done' : i === index ? ' dot-now' : ''}`} />;
            })}
          </div>
        )}
        <span className="spacer" />
        {(phase === 'prep' || phase === 'live') && capture?.live.hasMic && (
          <span className="rec">
            <span className="rec-dot" />
            {phase === 'live' ? 'Recording' : 'Mic on'}
          </span>
        )}
      </header>

      <main className={`session-body${phase === 'report' || phase === 'summary' ? ' session-body-wide' : ''}`}>
        {phase === 'brief' && (
          <Brief
            plan={plan}
            index={index}
            exercise={exercise}
            settings={settings}
            error={error}
            opening={opening}
            onStart={begin}
          />
        )}

        {phase === 'prep' && (
          <Prep key={exercise.id + done.length} exercise={exercise} settings={settings} onDone={goLive} />
        )}

        {phase === 'live' && capture && (
          <Live session={capture} exercise={exercise} settings={settings} onFinish={finish} keys={keys} />
        )}

        {phase === 'scoring' && (
          <div className="stage" style={{ paddingTop: '22vh' }}>
            <div className="spinner" />
            <p className="muted">Scoring your take…</p>
          </div>
        )}

        {phase === 'report' && shown && (
          <>
            <div className="page-head" style={{ marginBottom: 20 }}>
              <span className="eyebrow">
                {shown.take.exercise.title} · {shown.take.exercise.tag}
              </span>
              {shown.take.exercise.mode === 'speak' && (
                <h1 className="title" style={{ fontSize: 'clamp(22px, 3vw, 30px)' }}>
                  {shown.take.exercise.prompt}
                </h1>
              )}
            </div>
            <TakeReport take={shown.take} audioUrl={shown.audioUrl} onFollowUp={followUp} />
            {error && (
              <div className="notice notice-error" style={{ marginTop: 16 }} role="alert">
                <Icon name="alert" size={16} />
                <span>{error}</span>
              </div>
            )}
            <div className="sticky-actions">
              {fromSummary ? (
                <button type="button" className="btn btn-primary" onClick={() => setPhase('summary')}>
                  <Icon name="arrow-left" size={16} />
                  Back to summary
                </button>
              ) : (
                <>
                  <button type="button" className={`btn ${multi && !isLast ? 'btn-secondary' : 'btn-primary'}`} onClick={begin} disabled={opening}>
                    <Icon name="retry" size={16} />
                    Try it again
                  </button>
                  {multi && !isLast && (
                    <button type="button" className="btn btn-primary" onClick={next}>
                      Next: {plan.steps[index + 1]!.title}
                      <Icon name="arrow-right" size={16} />
                    </button>
                  )}
                  {multi && isLast && (
                    <button type="button" className="btn btn-secondary" onClick={() => setPhase('summary')}>
                      See the summary
                    </button>
                  )}
                  {!multi && recipe && (
                    <button type="button" className="btn btn-secondary" onClick={() => setPlan(remixPlan(plan))}>
                      <Icon name="shuffle" size={16} />
                      New prompt
                    </button>
                  )}
                  {(!multi || isLast) && (
                    <button type="button" className="btn btn-ghost" onClick={exit}>
                      Done
                    </button>
                  )}
                </>
              )}
            </div>
          </>
        )}

        {phase === 'summary' && (
          <Summary
            plan={plan}
            done={done}
            onOpen={(i) => {
              setViewing(i);
              setFromSummary(true);
              setPhase('report');
            }}
            onAgain={() => setPlan(remixPlan(plan) ?? repeatPlan(plan))}
            onDone={exit}
          />
        )}
      </main>
    </div>
  );
}

// ---------------------------------------------------------------- brief

function ExerciseExtras({ exercise, said }: { exercise: Exercise; said?: string[] }) {
  const framework = exercise.frameworkId && !exercise.guided ? getFramework(exercise.frameworkId) : null;
  const heard = (word: string) => said?.some((w) => sameWord(w, word.toLowerCase())) ?? false;
  return (
    <>
      {exercise.taboo && (
        <div className="chips" style={{ justifyContent: 'center' }} aria-label="Words you may not say">
          {exercise.taboo.map((word) => (
            <span key={word} className="word word-taboo" style={heard(word) ? { textDecoration: 'line-through' } : undefined}>
              <Icon name={heard(word) ? 'x' : 'ban'} size={14} />
              {word}
            </span>
          ))}
        </div>
      )}
      {exercise.mustUse && (
        <div className="chips" style={{ justifyContent: 'center' }} aria-label="Words to use">
          {exercise.mustUse.map((word) => (
            <span key={word} className={`word${heard(word) ? ' word-done' : ''}`}>
              {heard(word) && <Icon name="check" size={14} strokeWidth={3} />}
              {word}
            </span>
          ))}
        </div>
      )}
      {framework && (
        <ol className="stepper" aria-label={`${framework.name} steps`}>
          {framework.steps.map((step, i) => (
            <li key={i}>{step.name}</li>
          ))}
        </ol>
      )}
    </>
  );
}

interface BriefProps {
  plan: Plan;
  index: number;
  exercise: Exercise;
  settings: Settings;
  error: string | null;
  opening: boolean;
  onStart: () => void;
}

function Brief({ plan, index, exercise, settings, error, opening, onStart }: BriefProps) {
  const concealed = isConcealed(exercise);
  const framework = exercise.guided && exercise.frameworkId ? getFramework(exercise.frameworkId) : null;
  const showOutline = plan.steps.length > 1 && index === 0;
  const canTranscribe = transcriptionSupported();

  return (
    <div className="stage">
      <span className="eyebrow">{exercise.tag}</span>
      {concealed ? (
        <p className="prompt prompt-long">Your question appears when the clock starts.</p>
      ) : exercise.mode === 'read' ? (
        <p className="prompt prompt-long">{exercise.prompt}</p>
      ) : (
        <p className={promptClass(exercise.prompt)}>{exercise.prompt}</p>
      )}
      {exercise.context && <p className="context">{exercise.context}</p>}

      <div className="row-wrap" style={{ justifyContent: 'center' }}>
        <span className="tag">
          <Icon name="clock" size={13} />
          {exercise.prepSec > 0 ? `${duration(exercise.prepSec)} to prepare` : 'No preparation'}
        </span>
        <span className="tag">
          <Icon name="mic" size={13} />
          {exercise.mode === 'read' ? `Up to ${duration(exercise.speakSec)}` : `${duration(exercise.speakSec)} to speak`}
        </span>
      </div>

      <ExerciseExtras exercise={exercise} />

      {exercise.mode === 'read' && exercise.readText && (
        <p className="passage">
          <Passage text={exercise.readText} />
        </p>
      )}

      {framework && (
        <div className="card targets">
          <div className="card-title" style={{ marginBottom: 6 }}>
            {framework.name}
          </div>
          <ol className="steps">
            {framework.steps.map((step, i) => (
              <li key={i}>
                <div>
                  <div className="step-name">{step.name}</div>
                  <div className="step-cue">{step.cue}</div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {exercise.goals.length > 0 && (
        <div className="card targets">
          <div className="card-title" style={{ marginBottom: 6 }}>
            Targets
          </div>
          {exercise.goals.map((goal) => (
            <div key={goal.type} className="goal">
              <Icon name="target" size={16} />
              <span>{goalLabel(goal, exercise, settings)}</span>
            </div>
          ))}
        </div>
      )}

      {showOutline && (
        <div className="card targets">
          <div className="card-title" style={{ marginBottom: 6 }}>
            {plan.rapid ? `${plan.steps.length} in a row, no stopping` : `${plan.steps.length} steps`}
          </div>
          <ol className="steps">
            {plan.steps.map((step, i) => (
              <li key={step.id}>
                <div>
                  <div className="step-name">{plan.rapid ? step.tag : step.title}</div>
                  <div className="step-cue">
                    {plan.rapid || i > 0 ? duration(step.speakSec) : `${step.tag} · ${duration(step.speakSec)}`}
                  </div>
                </div>
              </li>
            ))}
          </ol>
        </div>
      )}

      {!canTranscribe && (
        <div className="notice" style={{ maxWidth: 520, textAlign: 'left' }}>
          <Icon name="info" size={16} />
          <span>
            This browser cannot transcribe speech, so you will get timing and voice feedback only. For word-level
            feedback, open Articulate in Chrome, Edge or Safari.
          </span>
        </div>
      )}
      {error && (
        <div className="notice notice-error" style={{ maxWidth: 520, textAlign: 'left' }} role="alert">
          <Icon name="alert" size={16} />
          <span>{error}</span>
        </div>
      )}

      <div className="session-actions">
        <button type="button" className="btn btn-primary btn-lg" onClick={onStart} disabled={opening}>
          <Icon name="mic" size={18} />
          {opening ? 'Waiting for microphone…' : 'Start'}
          {!opening && <span className="kbd">Space</span>}
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- countdown

function Ring({ share, value, label }: { share: number; value: string; label: string }) {
  const size = 132;
  const stroke = 6;
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  return (
    <div className="ring" role="timer" aria-label={`${value} ${label}`}>
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <circle cx={size / 2} cy={size / 2} r={radius} fill="none" stroke="var(--grid)" strokeWidth={stroke} />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="var(--accent)"
          strokeWidth={stroke}
          strokeLinecap="round"
          strokeDasharray={`${circumference * Math.max(0, Math.min(1, share))} ${circumference}`}
        />
      </svg>
      <div>
        <div className="ring-value">{value}</div>
        <div className="ring-label">{label}</div>
      </div>
    </div>
  );
}

function Prep({ exercise, settings, onDone }: { exercise: Exercise; settings: Settings; onDone: () => void }) {
  const speakAloud = settings.speakPrompts && exercise.mode === 'speak' && 'speechSynthesis' in window;
  const hasPrep = exercise.prepSec > 0;
  // With no prep time: a three-second "get ready", or long enough to hear the question read out.
  const total = hasPrep ? exercise.prepSec : speakAloud ? Math.ceil(wordsOf(exercise.prompt).length / 2.6) + 2 : 3;
  const reveal = hasPrep || speakAloud || exercise.mode === 'read';
  const [left, setLeft] = useState(total);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const started = performance.now();
    const timer = setInterval(() => {
      const remaining = total - (performance.now() - started) / 1000;
      if (remaining <= 0) {
        clearInterval(timer);
        onDoneRef.current();
      } else {
        setLeft(remaining);
      }
    }, 100);
    return () => clearInterval(timer);
  }, [total]);

  useEffect(() => {
    if (!speakAloud) return;
    const utterance = new SpeechSynthesisUtterance(exercise.prompt);
    utterance.lang = settings.lang;
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utterance);
    return () => window.speechSynthesis.cancel();
  }, [speakAloud, exercise.prompt, settings.lang]);

  return (
    <div className="stage">
      <span className="eyebrow">{exercise.tag}</span>
      <Ring share={left / total} value={String(Math.ceil(left))} label={hasPrep ? 'Prepare' : 'Get ready'} />
      {reveal ? (
        <>
          <p className={exercise.mode === 'read' ? 'prompt prompt-small' : promptClass(exercise.prompt)}>{exercise.prompt}</p>
          {exercise.context && <p className="context">{exercise.context}</p>}
          <ExerciseExtras exercise={exercise} />
          {exercise.mode === 'read' && exercise.readText && (
            <p className="passage">
              <Passage text={exercise.readText} />
            </p>
          )}
        </>
      ) : (
        <p className="context">The question appears when the clock starts. Answer first, then give your reason.</p>
      )}
      {hasPrep && (
        <div className="session-actions">
          <button type="button" className="btn btn-secondary" onClick={onDone}>
            I am ready
            <span className="kbd">Space</span>
          </button>
        </div>
      )}
    </div>
  );
}

// ---------------------------------------------------------------- live

function LevelMeter({ level, speaking }: { level: number; speaking: boolean }) {
  const history = useRef<number[]>(new Array(28).fill(0));
  history.current = [...history.current.slice(1), level];
  return (
    <div className={`level${speaking ? ' level-on' : ''}`} aria-hidden="true">
      {history.current.map((value, i) => (
        <i key={i} style={{ height: `${Math.max(3, value * 28)}px` }} />
      ))}
    </div>
  );
}

const GAUGE_MIN = 80;
const GAUGE_MAX = 220;
const gaugePos = (wpm: number) => `${(Math.max(0, Math.min(1, (wpm - GAUGE_MIN) / (GAUGE_MAX - GAUGE_MIN))) * 100).toFixed(1)}%`;

interface LiveProps {
  session: CaptureSession;
  exercise: Exercise;
  settings: Settings;
  onFinish: () => void;
  keys: React.RefObject<{ space?: () => void; enter?: () => void }>;
}

function Live({ session, exercise, settings, onFinish, keys }: LiveProps) {
  const live = useSyncExternalStore(session.subscribe, session.getSnapshot);
  const [step, setStep] = useState(0);
  const framework = exercise.guided && exercise.frameworkId ? getFramework(exercise.frameworkId) : null;
  const isRead = exercise.mode === 'read';

  const totalMs = exercise.speakSec * 1000;
  const remaining = Math.max(0, totalMs - live.elapsedMs);
  const timeUp = live.elapsedMs >= totalMs;
  const onFinishRef = useRef(onFinish);
  onFinishRef.current = onFinish;
  useEffect(() => {
    if (timeUp) onFinishRef.current();
  }, [timeUp]);

  const text = live.interim ? `${live.finalText} ${live.interim}` : live.finalText;
  const said = useMemo(() => wordsOf(text), [text]);
  const fillers = useMemo(
    () =>
      isRead
        ? 0
        : findFlags(tokenize(text), { customFillers: settings.customFillers }).filter((f) => f.kind === 'filler').length,
    [text, isRead, settings.customFillers],
  );

  const lastStep = framework ? step >= framework.steps.length - 1 : true;
  const nextStep = () => {
    if (!framework || lastStep) return;
    session.markStep();
    setStep(step + 1);
  };
  keys.current = { space: framework && !lastStep ? nextStep : undefined, enter: onFinish };

  const wpm = live.liveWpm;
  const paceState = wpm == null ? '' : wpm > settings.paceMax + 8 ? 'Fast' : wpm < settings.paceMin - 8 ? 'Slow' : 'On pace';
  const tail = live.finalText.length > 260 ? `…${live.finalText.slice(-260)}` : live.finalText;
  const showFillers = !isRead && settings.liveFillerAlert && live.transcript === 'listening';

  return (
    <div className="stage" style={{ gap: 20, paddingTop: '1vh' }}>
      <div className="row" style={{ gap: 20 }}>
        <Ring share={1 - remaining / totalMs} value={clock(remaining / 1000)} label="left" />
        {live.hasMic && <LevelMeter level={live.level} speaking={live.speaking} />}
      </div>

      {isRead ? (
        <p className="passage">{exercise.readText && <Passage text={exercise.readText} />}</p>
      ) : (
        <p className={promptClass(exercise.prompt)}>{exercise.prompt}</p>
      )}

      <ExerciseExtras exercise={exercise} said={said} />

      {framework && (
        <>
          <ol className="stepper" aria-label={`${framework.name} steps`}>
            {framework.steps.map((s, i) => (
              <li key={i} className={i === step ? 'now' : i < step ? 'past' : undefined} aria-current={i === step ? 'step' : undefined}>
                {s.name}
              </li>
            ))}
          </ol>
          <div className="step-card" aria-live="polite">
            <div className="muted small">{framework.steps[step]!.cue}</div>
            <div className="step-starter">{framework.steps[step]!.starter}</div>
          </div>
        </>
      )}

      <div className="live-stats" style={showFillers ? undefined : { gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', maxWidth: 420 }}>
        <div className="live-stat">
          <div className="live-stat-label">Words</div>
          <div className="live-stat-value">{live.words}</div>
        </div>
        {exercise.drillId === 'power-pause' ? (
          <div className="live-stat">
            <div className="live-stat-label">Pauses</div>
            <div className="live-stat-value">{live.hasMic ? live.pauses : '–'}</div>
          </div>
        ) : (
          <div className="live-stat">
            <div className="live-stat-label">Pace</div>
            <div className="live-stat-value">
              {wpm ?? '–'}
              <small>{wpm == null ? 'wpm' : paceState}</small>
            </div>
            <div className="gauge" aria-hidden="true">
              <div
                className="gauge-band"
                style={{ left: gaugePos(settings.paceMin), right: `calc(100% - ${gaugePos(settings.paceMax)})` }}
              />
              {wpm != null && <div className="gauge-needle" style={{ left: gaugePos(wpm) }} />}
            </div>
          </div>
        )}
        {showFillers && (
          <div key={fillers} className={`live-stat${fillers > 0 ? ' bump' : ''}`}>
            <div className="live-stat-label">Fillers</div>
            <div className="live-stat-value">{fillers}</div>
          </div>
        )}
      </div>

      {!isRead && live.transcript === 'listening' && !live.notTranscribing && (
        <div className="live-transcript" aria-label="Live transcript">
          <p>
            {tail} <span className="interim">{live.interim}</span>
            {!tail && !live.interim && <span className="interim">Start speaking…</span>}
          </p>
        </div>
      )}
      {live.transcript === 'listening' && live.notTranscribing && (
        <div className="notice" style={{ maxWidth: 620, textAlign: 'left' }}>
          <Icon name="info" size={16} />
          <span>
            Your voice is coming through, but no words are. Speech recognition may not be working in this browser.
            Timing and voice are still being measured.
          </span>
        </div>
      )}
      {live.transcript !== 'listening' && (
        <div className="notice" style={{ maxWidth: 620, textAlign: 'left' }}>
          <Icon name="info" size={16} />
          <span>
            {live.transcript === 'unsupported'
              ? 'Live transcription is not available in this browser. Timing and voice are still being measured.'
              : `${live.transcriptError ?? 'Transcription stopped.'} Timing and voice are still being measured.`}
          </span>
        </div>
      )}

      <div className="session-actions">
        {framework && !lastStep && (
          <button type="button" className="btn btn-primary btn-lg" onClick={nextStep}>
            Next: {framework.steps[step + 1]!.name}
            <span className="kbd">Space</span>
          </button>
        )}
        <button type="button" className={`btn btn-lg ${framework && !lastStep ? 'btn-secondary' : 'btn-primary'}`} onClick={onFinish}>
          <Icon name="stop" size={16} />
          Finish
          <span className="kbd">Enter</span>
        </button>
      </div>
    </div>
  );
}

// ---------------------------------------------------------------- summary

interface SummaryProps {
  plan: Plan;
  done: DoneTake[];
  onOpen: (index: number) => void;
  onAgain: () => void;
  onDone: () => void;
}

function Summary({ plan, done, onOpen, onAgain, onDone }: SummaryProps) {
  const scored = done.filter((d) => d.take.analysis.overall != null);
  const average = scored.length
    ? Math.round(scored.reduce((n, d) => n + d.take.analysis.overall!, 0) / scored.length)
    : null;
  const goals = done.flatMap((d) => d.take.analysis.goals);
  const band = average != null ? scoreBand(average) : null;
  const xp = done.reduce((n, d) => n + d.take.xp, 0);

  return (
    <>
      <div className="page-head">
        <span className="eyebrow">{plan.title} · complete</span>
        <h1 className="title">{average != null ? `You averaged ${average}.` : 'Session complete.'}</h1>
        <div className="row-wrap" style={{ marginTop: 12 }}>
          {band && <Status level={band.level} label={band.label} />}
          {goals.length > 0 && (
            <span className="tag">
              {goals.filter((g) => g.met).length} of {goals.length} targets met
            </span>
          )}
          <span className="tag">+{xp} XP</span>
        </div>
      </div>

      <div className="card">
        <div className="list">
          {done.map((d, i) => {
            const fix = d.take.analysis.notes.find((n) => n.tone === 'fix');
            return (
              <button
                key={d.take.id}
                type="button"
                className="list-row"
                style={{ background: 'none', border: 0, borderTop: i ? '1px solid var(--border)' : 0, textAlign: 'left', cursor: 'pointer' }}
                onClick={() => onOpen(i)}
              >
                <div className="list-main">
                  <div className="list-title">
                    {d.take.exercise.mode === 'read' ? (d.take.exercise.readText ?? d.take.exercise.prompt) : d.take.exercise.prompt}
                  </div>
                  <div className="list-meta">
                    {d.take.exercise.tag}
                    {fix ? ` · ${fix.title}` : d.take.analysis.sufficient ? ' · Clean' : ' · Not enough speech'}
                  </div>
                </div>
                <span className="list-score">{d.take.analysis.overall ?? '–'}</span>
                <Icon name="chevron-right" size={18} />
              </button>
            );
          })}
        </div>
      </div>

      <div className="sticky-actions">
        <button type="button" className="btn btn-primary" onClick={onAgain}>
          <Icon name="retry" size={16} />
          Go again
        </button>
        <button type="button" className="btn btn-ghost" onClick={onDone}>
          Done
        </button>
      </div>
    </>
  );
}
