// Everything the app has to say about one take: the score, the one thing to fix next,
// the numbers behind it, the marked-up transcript, and (optionally) the AI coach.

import { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { scoreBand } from '../lib/analysis/analyze';
import { coachErrorMessage, coachTake } from '../lib/ai';
import { loadAudio } from '../lib/audioStore';
import { getFramework } from '../lib/content/frameworks';
import { clock } from '../lib/format';
import { previousAttempt } from '../lib/progress';
import { attachAiFeedback, useStore } from '../lib/store';
import { SKILLS, type AiFeedback, type CoachNote, type TakeRecord } from '../lib/types';
import { Icon } from './Icon';
import { LineChart, MeterList, ScoreRing, Status } from './charts';
import { Passage, Transcript } from './Transcript';

function useAudioUrl(takeId: string, provided: string | null | undefined): string | null {
  const [loaded, setLoaded] = useState<string | null>(null);
  useEffect(() => {
    if (provided !== undefined) return;
    let url: string | null = null;
    let cancelled = false;
    void loadAudio(takeId).then((blob) => {
      if (cancelled || !blob) return;
      url = URL.createObjectURL(blob);
      setLoaded(url);
    });
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
      setLoaded(null);
    };
  }, [takeId, provided]);
  return provided !== undefined ? provided : loaded;
}

function Note({ note }: { note: CoachNote }) {
  return (
    <div className={`note note-${note.tone}`}>
      <span className="note-icon">
        <Icon name={note.tone === 'win' ? 'check' : 'arrow-right'} size={13} strokeWidth={3} />
      </span>
      <div>
        <div className="note-title">{note.title}</div>
        <div className="note-detail">{note.detail}</div>
      </div>
    </div>
  );
}

function Tile({ label, value, unit, sub }: { label: string; value: string; unit?: string; sub?: string }) {
  return (
    <div className="card tile">
      <span className="tile-label">{label}</span>
      <span className="tile-value">
        {value}
        {unit && <small>{unit}</small>}
      </span>
      {sub && <span className="tile-sub">{sub}</span>}
    </div>
  );
}

interface TakeReportProps {
  take: TakeRecord;
  /** Pass the just-recorded audio; leave undefined to load it from storage. */
  audioUrl?: string | null;
  /** Start practising a follow-up question. */
  onFollowUp?: (question: string) => void;
}

export function TakeReport({ take, audioUrl, onFollowUp }: TakeReportProps) {
  const settings = useStore((s) => s.settings);
  const takes = useStore((s) => s.takes);
  const audio = useAudioUrl(take.id, audioUrl);
  const { exercise, analysis: a, capture } = take;
  const isRead = exercise.mode === 'read';

  const previous = useMemo(() => previousAttempt(takes, take), [takes, take]);
  const delta = previous?.analysis.overall != null && a.overall != null ? a.overall - previous.analysis.overall : null;

  const flagOptions = useMemo(
    () => ({ customFillers: settings.customFillers, taboo: exercise.taboo, mustUse: exercise.mustUse }),
    [settings.customFillers, exercise.taboo, exercise.mustUse],
  );

  const fixes = a.notes.filter((n) => n.tone === 'fix');
  const wins = a.notes.filter((n) => n.tone === 'win');
  const focus = fixes[0];
  const band = a.overall != null ? scoreBand(a.overall) : null;

  const skillRows = SKILLS.filter((s) => a.scores[s.id] != null).map((s) => ({ label: s.label, value: a.scores[s.id]! }));
  const pacePoints = a.paceSeries.map((p) => ({ x: p.t, y: p.wpm, label: clock(p.t) }));
  const framework = exercise.frameworkId ? getFramework(exercise.frameworkId) : null;

  const voiceOnly = !capture.transcriptAvailable;
  let verdict: string;
  if (!a.sufficient) {
    verdict = voiceOnly
      ? 'Your words could not be transcribed, and there was too little speech to score your voice.'
      : 'There was not enough speech to score this take.';
  } else if (voiceOnly) verdict = 'Scored on your voice only: your words could not be transcribed.';
  else if (delta != null && delta >= 3) verdict = 'Better than your last attempt at this.';
  else if (focus) verdict = `Next time, work on ${SKILLS.find((s) => s.id === focus.skill)!.label.toLowerCase()}.`;
  else verdict = 'Nothing to fix. Try a harder prompt or less time.';

  return (
    <div className="stack">
      {/* ---- headline ---- */}
      <div className="card">
        <div className="report-hero">
          <ScoreRing value={a.overall} />
          <div className="stack" style={{ gap: 8 }}>
            <div className="row-wrap">
              {band && <Status level={band.level} label={band.label} />}
              {delta != null && delta !== 0 && (
                <span className={`delta ${delta > 0 ? 'delta-up' : 'delta-down'}`}>
                  <Icon name={delta > 0 ? 'arrow-up' : 'arrow-down'} size={14} strokeWidth={2.5} />
                  {Math.abs(delta)} {delta > 0 ? 'up on' : 'down on'} your last attempt
                </span>
              )}
            </div>
            <p className="verdict">{verdict}</p>
            {voiceOnly ? (
              <p className="muted">
                Live transcription works in Chrome, Edge and Safari and needs an internet connection. Without it you
                still get pauses, vocal variety and the recording.
              </p>
            ) : (
              !a.sufficient && (
                <p className="muted">Check that your microphone is picking you up, then speak for at least ten seconds.</p>
              )
            )}
          </div>
        </div>
      </div>

      {/* ---- the one thing ---- */}
      {focus && (
        <div className="card focus">
          <span className="eyebrow">Fix this first</span>
          <p className="focus-title">{focus.title}</p>
          <p className="muted" style={{ marginTop: 6 }}>
            {focus.detail}
          </p>
        </div>
      )}

      {/* ---- targets ---- */}
      {a.goals.length > 0 && (
        <div className="card">
          <div className="card-head">
            <span className="card-title">Targets</span>
            <span className="card-sub">
              {a.goals.filter((g) => g.met).length} of {a.goals.length} met
            </span>
          </div>
          {a.goals.map((goal) => (
            <div key={goal.label} className="goal">
              <Status level={goal.met ? 'good' : 'bad'} label={goal.met ? 'Met' : 'Missed'} />
              <span>{goal.label}</span>
              <span className="goal-detail">{goal.detail}</span>
            </div>
          ))}
        </div>
      )}

      {/* ---- numbers ---- */}
      {a.sufficient && (
        <div className="grid grid-4">
          {isRead && a.read ? (
            <Tile
              label="Accuracy"
              value={String(Math.round(a.read.accuracy * 100))}
              unit="%"
              sub={a.read.missed.length ? `${a.read.missed.length} ${a.read.missed.length === 1 ? 'word' : 'words'} not heard` : 'Every word heard'}
            />
          ) : (
            <Tile
              label="Fillers"
              value={String(a.fillers)}
              sub={a.fillers ? `${a.fillersPerMin.toFixed(1)} a minute` : 'None at all'}
            />
          )}
          <Tile
            label="Pace"
            value={a.wpm != null ? String(a.wpm) : '–'}
            unit={a.wpm != null ? 'wpm' : undefined}
            sub={a.scores.pace != null ? `Target ${settings.paceMin}–${settings.paceMax}` : 'Not scored in this drill'}
          />
          <Tile
            label="Pauses"
            value={a.pauses ? String(a.pauses.deliberate) : '–'}
            sub={
              a.pauses
                ? a.pauses.long
                  ? `${a.pauses.long} stall${a.pauses.long === 1 ? '' : 's'}, longest ${a.pauses.longestSec.toFixed(1)}s`
                  : 'Deliberate, no stalls'
                : 'Needs microphone analysis'
            }
          />
          <Tile label="Length" value={clock(a.speakingSec)} sub={`${a.words} words`} />
        </div>
      )}

      {/* ---- coaching + skills ---- */}
      {(fixes.length > 1 || wins.length > 0 || skillRows.length > 0) && (
        <div className="split">
          <div className="card">
            <div className="card-head">
              <span className="card-title">Coach notes</span>
            </div>
            {wins.length + fixes.length - 1 <= 0 && <p className="muted">Nothing else to add.</p>}
            {fixes.slice(1, 4).map((note) => (
              <Note key={note.title} note={note} />
            ))}
            {wins.slice(0, 3).map((note) => (
              <Note key={note.title} note={note} />
            ))}
          </div>
          {skillRows.length > 0 && (
            <div className="card">
              <div className="card-head">
                <span className="card-title">Skills in this take</span>
              </div>
              <MeterList rows={skillRows} />
            </div>
          )}
        </div>
      )}

      {/* ---- framework coverage ---- */}
      {a.steps && framework && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">{framework.name}: where your words went</div>
              <div className="card-sub">Words spoken in each step</div>
            </div>
          </div>
          <MeterList
            max={Math.max(1, ...a.steps.map((s) => s.words))}
            rows={a.steps.map((step, i) => ({
              label: `${i + 1}. ${step.label}`,
              value: step.words,
              figure: `${step.words} words · ${Math.round(step.sec)}s`,
            }))}
          />
        </div>
      )}

      {/* ---- pace over time ---- */}
      {pacePoints.length >= 3 && a.scores.pace != null && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">Pace through the take</div>
              <div className="card-sub">Words per minute, measured over a rolling twelve seconds</div>
            </div>
          </div>
          <LineChart
            points={pacePoints}
            ariaLabel="Speaking pace over the course of the take"
            xName="Time"
            yName="Words per minute"
            unit="wpm"
            include={[100, 200]}
            band={{ from: settings.paceMin, to: settings.paceMax, label: `Target ${settings.paceMin}–${settings.paceMax}` }}
          />
        </div>
      )}

      {/* ---- what was said ---- */}
      {(capture.transcript || audio) && (
        <div className="card">
          <div className="card-head">
            <div>
              <div className="card-title">{isRead ? 'The passage' : 'What you said'}</div>
              <div className="card-sub">
                {isRead ? 'Words that were not heard clearly are underlined' : 'Tap a label to show or hide its marks'}
              </div>
            </div>
          </div>
          {isRead && exercise.readText ? (
            <p className="transcript" style={{ fontFamily: 'var(--serif)' }}>
              <Passage text={exercise.readText} hits={a.read?.hits} />
            </p>
          ) : (
            capture.transcript && <Transcript text={capture.transcript} options={flagOptions} />
          )}
          {isRead && capture.transcript && (
            <details className="chart-table">
              <summary>What the microphone heard</summary>
              <p className="muted" style={{ marginTop: 8 }}>
                {capture.transcript}
              </p>
            </details>
          )}
          {audio && <audio className="audio" controls src={audio} preload="metadata" />}
          {!isRead && capture.transcript && (
            <p className="muted small" style={{ marginTop: 12 }}>
              Speech recognition tidies as it listens and often drops a quiet “um” or “uh”.
              {audio ? ' Play the recording back to catch the ones it missed.' : ''}
            </p>
          )}
        </div>
      )}

      {/* ---- AI coach ---- */}
      {!isRead && a.sufficient && <AiCoach take={take} apiKey={settings.apiKey} onFollowUp={onFollowUp} />}
    </div>
  );
}

function AiCoach({ take, apiKey, onFollowUp }: { take: TakeRecord; apiKey: string; onFollowUp?: (q: string) => void }) {
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Read feedback from the store: the take passed in may be a copy made before the coach replied.
  const stored = useStore((s) => s.takes.find((t) => t.id === take.id)?.ai);
  const feedback: AiFeedback | undefined = stored ?? take.ai;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      const result = await coachTake(apiKey, take.exercise, take.capture.transcript, take.analysis);
      attachAiFeedback(take.id, result);
    } catch (e) {
      setError(coachErrorMessage(e, 'Something went wrong asking the coach.'));
    } finally {
      setBusy(false);
    }
  };

  if (!feedback) {
    return (
      <div className="card">
        <div className="card-head" style={{ marginBottom: 0 }}>
          <div>
            <div className="card-title">AI coach</div>
            <div className="card-sub">
              {apiKey
                ? 'Feedback on your content: structure, specifics, word choice, and a tighter version of your answer.'
                : 'Add an Anthropic API key in Settings to get feedback on your content and a tighter version of your answer.'}
            </div>
          </div>
          {apiKey ? (
            <button type="button" className="btn btn-secondary" onClick={run} disabled={busy}>
              {busy ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <Icon name="sparkles" size={16} />}
              {busy ? 'Reviewing…' : 'Review my answer'}
            </button>
          ) : (
            <Link to="/settings" className="btn btn-secondary">
              Open Settings
            </Link>
          )}
        </div>
        {error && (
          <div className="notice notice-error" style={{ marginTop: 14 }} role="alert">
            <Icon name="alert" size={16} />
            <span>{error}</span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="card">
      <div className="card-head">
        <div>
          <div className="card-title">AI coach</div>
          <div className="card-sub">On your content, from the transcript</div>
        </div>
      </div>
      <p className="focus-title" style={{ marginTop: 0 }}>
        {feedback.headline}
      </p>

      {feedback.strengths.length > 0 && (
        <>
          <h3 className="subhead">What worked</h3>
          <ul className="plain-list">
            {feedback.strengths.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </>
      )}

      {feedback.improvements.length > 0 && (
        <>
          <h3 className="subhead">What to change</h3>
          <div>
            {feedback.improvements.map((item) => (
              <Note key={item.issue} note={{ tone: 'fix', skill: 'clarity', weight: 0, title: item.issue, detail: item.fix }} />
            ))}
          </div>
        </>
      )}

      {feedback.rewrite && (
        <>
          <h3 className="subhead">A tighter version, in your words</h3>
          <p className="ai-rewrite">{feedback.rewrite}</p>
          <p className="muted small" style={{ marginTop: 8 }}>
            Read it aloud once, then try the prompt again without looking.
          </p>
        </>
      )}

      {feedback.followUp && (
        <>
          <h3 className="subhead">A listener might ask next</h3>
          <div className="row" style={{ alignItems: 'flex-start', justifyContent: 'space-between', flexWrap: 'wrap' }}>
            <p style={{ fontFamily: 'var(--serif)', fontSize: 19, flex: '1 1 260px' }}>{feedback.followUp}</p>
            {onFollowUp && (
              <button type="button" className="btn btn-secondary" onClick={() => onFollowUp(feedback.followUp)}>
                <Icon name="mic" size={16} />
                Answer it
              </button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
