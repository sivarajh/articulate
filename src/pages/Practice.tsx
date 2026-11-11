import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Icon } from '../components/Icon';
import { coachErrorMessage, generateScenario } from '../lib/ai';
import { DRILLS, buildCustom, buildDrill, buildFramework, buildImpromptu } from '../lib/content/drills';
import { FRAMEWORKS } from '../lib/content/frameworks';
import { CATEGORIES, type CategoryId } from '../lib/content/prompts';
import { setPlan } from '../lib/session';
import { useStore } from '../lib/store';
import { SKILLS, type FrameworkId, type Plan } from '../lib/types';

const SPEAK_TIMES: [number, string][] = [
  [30, '30 sec'],
  [60, '1 min'],
  [90, '90 sec'],
  [120, '2 min'],
];

const PREP_TIMES: [number, string][] = [
  [0, 'None'],
  [15, '15 sec'],
  [30, '30 sec'],
  [60, '1 min'],
];

function Choice<T extends string | number>({
  label,
  options,
  value,
  onChange,
}: {
  label: string;
  options: [T, string][];
  value: T;
  onChange: (value: T) => void;
}) {
  const id = `choice-${label.toLowerCase().replace(/\s+/g, '-')}`;
  return (
    <div className="field">
      <span className="field-label" id={id}>
        {label}
      </span>
      <div className="chips" role="radiogroup" aria-labelledby={id}>
        {options.map(([option, text]) => (
          <button
            key={String(option)}
            type="button"
            role="radio"
            className="chip"
            aria-checked={option === value}
            onClick={() => onChange(option)}
          >
            {text}
          </button>
        ))}
      </div>
    </div>
  );
}

export function Practice() {
  const navigate = useNavigate();
  const apiKey = useStore((s) => s.settings.apiKey);
  const [category, setCategory] = useState<CategoryId | 'any' | 'own'>('any');
  const [speakSec, setSpeakSec] = useState(60);
  const [prepSec, setPrepSec] = useState(15);
  const [framework, setFramework] = useState<FrameworkId | 'auto' | 'none'>('auto');
  const [situation, setSituation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const start = (plan: Plan) => {
    setPlan(plan);
    navigate('/session');
  };

  const own = category === 'own';
  const chosenFramework = framework === 'auto' || framework === 'none' ? undefined : framework;

  const startImpromptu = () => {
    if (own) {
      const text = situation.trim();
      if (!text) return;
      start(buildCustom([text], { speakSec, prepSec, frameworkId: chosenFramework }));
    } else {
      start(buildImpromptu({ category, speakSec, prepSec, framework }));
    }
  };

  const rehearse = async () => {
    const text = situation.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const scenario = await generateScenario(apiKey, text);
      start(
        buildCustom(scenario.questions, {
          speakSec,
          prepSec,
          title: scenario.title,
          frameworkId: framework === 'none' ? undefined : (chosenFramework ?? scenario.framework),
        }),
      );
    } catch (e) {
      setError(coachErrorMessage(e, 'Could not build the rehearsal.'));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="page">
      <header className="page-head">
        <span className="eyebrow">Practice</span>
        <h1 className="title">What do you need to be ready for?</h1>
        <p className="lede">
          Pick a situation and speak. Every take is timed, transcribed and scored, and you can repeat it as often as you
          like.
        </p>
      </header>

      <section className="card stack" style={{ gap: 22, padding: 24 }} aria-labelledby="spot-title">
        <div>
          <h2 className="section-title" id="spot-title">
            Speak on the spot
          </h2>
          <p className="section-sub">A question you have not seen, a clock, and nothing else.</p>
        </div>

        <Choice
          label="Situation"
          value={category}
          onChange={setCategory}
          options={[
            ['any', 'Anything'],
            ...CATEGORIES.map((c): [CategoryId, string] => [c.id, c.label]),
            ['own', 'My own…'],
          ]}
        />

        {own && (
          <div className="field">
            <label className="field-label" htmlFor="situation">
              Your situation or question
            </label>
            <textarea
              id="situation"
              className="textarea"
              value={situation}
              onChange={(e) => setSituation(e.target.value)}
              placeholder="e.g. I have to tell my manager on Friday that I am turning down the promotion."
              maxLength={600}
            />
            <span className="field-help">
              {apiKey
                ? 'Practise it as written, or let the AI coach turn it into five questions the other person might ask.'
                : 'You will answer this exactly as written. With an API key in Settings, the AI coach can turn any situation into a five-question rehearsal.'}
            </span>
          </div>
        )}

        <div className="grid grid-2">
          <Choice label="Time to speak" value={speakSec} onChange={setSpeakSec} options={SPEAK_TIMES} />
          <Choice label="Time to prepare" value={prepSec} onChange={setPrepSec} options={PREP_TIMES} />
        </div>

        <div className="field" style={{ maxWidth: 420 }}>
          <label className="field-label" htmlFor="framework">
            Structure hint
          </label>
          <select
            id="framework"
            className="select"
            value={framework}
            onChange={(e) => setFramework(e.target.value as FrameworkId | 'auto' | 'none')}
          >
            <option value="auto">Suggest one that fits</option>
            <option value="none">No hint</option>
            {FRAMEWORKS.map((f) => (
              <option key={f.id} value={f.id}>
                {f.name} ({f.tagline})
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="notice notice-error" role="alert">
            <Icon name="alert" size={16} />
            <span>{error}</span>
          </div>
        )}

        <div className="row-wrap">
          <button type="button" className="btn btn-primary btn-lg" onClick={startImpromptu} disabled={own && !situation.trim()}>
            <Icon name="mic" size={18} />
            {own ? 'Practise this' : 'Give me a question'}
          </button>
          {own && apiKey && (
            <button type="button" className="btn btn-secondary btn-lg" onClick={rehearse} disabled={busy || !situation.trim()}>
              {busy ? <span className="spinner" style={{ width: 16, height: 16, borderWidth: 2 }} /> : <Icon name="sparkles" size={18} />}
              {busy ? 'Building…' : 'Build a five-question rehearsal'}
            </button>
          )}
        </div>
      </section>

      <section className="section" aria-labelledby="frameworks-title">
        <div className="section-head">
          <div>
            <h2 className="section-title" id="frameworks-title">
              Frameworks
            </h2>
            <p className="section-sub">Guided practice: you step through the shape and each part is measured.</p>
          </div>
          <Link to="/learn" className="link">
            Read about them
          </Link>
        </div>
        <div className="grid grid-3">
          {FRAMEWORKS.map((f) => (
            <button key={f.id} type="button" className="option" onClick={() => start(buildFramework(f.id))}>
              <span className="option-title">{f.name}</span>
              <span className="option-text">{f.useWhen}</span>
              <span className="option-foot">
                <span className="tag">{f.steps.map((s) => s.name).join(' → ')}</span>
              </span>
            </button>
          ))}
        </div>
      </section>

      <section className="section" aria-labelledby="drills-title">
        <div className="section-head">
          <div>
            <h2 className="section-title" id="drills-title">
              Drills
            </h2>
            <p className="section-sub">Short exercises that isolate one skill.</p>
          </div>
        </div>
        <div className="grid grid-3">
          {DRILLS.map((drill) => (
            <button key={drill.id} type="button" className="option" onClick={() => start(buildDrill(drill.id))}>
              <span className="option-icon">
                <Icon name={drill.icon} size={18} />
              </span>
              <span className="option-title">{drill.name}</span>
              <span className="option-text">{drill.summary}</span>
              <span className="option-foot">
                <span className="tag">{SKILLS.find((s) => s.id === drill.skill)!.label}</span>
                <span className="muted small">{drill.length}</span>
              </span>
            </button>
          ))}
        </div>
      </section>
    </div>
  );
}
