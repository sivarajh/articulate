import { useRef, useState } from 'react';
import { Icon } from '../components/Icon';
import { transcriptionSupported } from '../lib/speech/transcriber';
import { exportData, importData, resetProgress, updateSettings, useStore } from '../lib/store';
import type { Settings } from '../lib/types';

const LANGUAGES: [string, string][] = [
  ['en-US', 'English (United States)'],
  ['en-GB', 'English (United Kingdom)'],
  ['en-IN', 'English (India)'],
  ['en-AU', 'English (Australia)'],
  ['en-CA', 'English (Canada)'],
  ['en-NZ', 'English (New Zealand)'],
  ['en-ZA', 'English (South Africa)'],
  ['en-IE', 'English (Ireland)'],
  ['en-SG', 'English (Singapore)'],
  ['en-PH', 'English (Philippines)'],
  ['en-NG', 'English (Nigeria)'],
];

function Switch({ checked, onChange, label }: { checked: boolean; onChange: (value: boolean) => void; label: string }) {
  return <button type="button" role="switch" className="switch" aria-checked={checked} aria-label={label} onClick={() => onChange(!checked)} />;
}

function Row({ title, help, children }: { title: string; help?: string; children: React.ReactNode }) {
  return (
    <div className="setting">
      <div>
        <div className="card-title">{title}</div>
        {help && <div className="field-help">{help}</div>}
      </div>
      {children}
    </div>
  );
}

export function SettingsPage() {
  const settings = useStore((s) => s.settings);
  const takeCount = useStore((s) => s.takes.length);
  const [fillers, setFillers] = useState(settings.customFillers.join(', '));
  const [message, setMessage] = useState<string | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);
  const set = (patch: Partial<Settings>) => updateSettings(patch);

  const setPace = (key: 'paceMin' | 'paceMax', raw: string) => {
    const value = Math.round(Number(raw));
    if (!Number.isFinite(value)) return;
    const clamped = Math.max(80, Math.min(240, value));
    if (key === 'paceMin') set({ paceMin: clamped, paceMax: Math.max(settings.paceMax, clamped + 10) });
    else set({ paceMax: clamped, paceMin: Math.min(settings.paceMin, clamped - 10) });
  };

  const saveFillers = () => {
    const list = fillers
      .split(',')
      .map((f) => f.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 20);
    set({ customFillers: list });
    setFillers(list.join(', '));
  };

  const download = () => {
    const url = URL.createObjectURL(new Blob([exportData()], { type: 'application/json' }));
    const link = document.createElement('a');
    link.href = url;
    link.download = `articulate-backup-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };

  const restore = async (file: File | undefined) => {
    if (!file) return;
    try {
      importData(await file.text());
      setMessage('Backup restored.');
    } catch (e) {
      setMessage(e instanceof Error ? e.message : 'That file could not be read.');
    }
    if (fileInput.current) fileInput.current.value = '';
  };

  const reset = () => {
    if (!window.confirm(`Delete all ${takeCount} takes, recordings and progress? This cannot be undone.`)) return;
    resetProgress();
    setMessage('Progress cleared.');
  };

  return (
    <div className="page" style={{ maxWidth: 760 }}>
      <header className="page-head">
        <span className="eyebrow">Settings</span>
        <h1 className="title">Make it yours.</h1>
      </header>

      <div className="stack" style={{ gap: 20 }}>
        {!transcriptionSupported() && (
          <div className="notice">
            <Icon name="info" size={16} />
            <span>
              This browser has no built-in speech recognition, so takes get timing and voice feedback only. Chrome, Edge
              and Safari give you the full word-level analysis.
            </span>
          </div>
        )}

        <section className="card" aria-labelledby="speaking-title">
          <h2 className="section-title" id="speaking-title" style={{ marginBottom: 16 }}>
            Speaking
          </h2>
          <Row title="Accent" help="Which variety of English the recogniser should listen for.">
            <select className="select setting-control" value={settings.lang} onChange={(e) => set({ lang: e.target.value })} aria-label="Accent">
              {LANGUAGES.map(([code, name]) => (
                <option key={code} value={code}>
                  {name}
                </option>
              ))}
            </select>
          </Row>
          <Row title="Target pace" help="Words a minute. 130–165 suits most conversation and presenting.">
            <div className="row setting-control">
              <input className="input" type="number" min={80} max={230} step={5} value={settings.paceMin} onChange={(e) => setPace('paceMin', e.target.value)} aria-label="Slowest target pace" />
              <span className="muted">to</span>
              <input className="input" type="number" min={90} max={240} step={5} value={settings.paceMax} onChange={(e) => setPace('paceMax', e.target.value)} aria-label="Fastest target pace" />
            </div>
          </Row>
          <Row title="Your own crutch words" help="Counted as fillers on top of the built-in list. Separate with commas.">
            <input
              className="input setting-control"
              value={fillers}
              onChange={(e) => setFillers(e.target.value)}
              onBlur={saveFillers}
              placeholder="at the end of the day, right"
              aria-label="Your own crutch words"
            />
          </Row>
          <Row title="Daily goal" help="Minutes of speaking practice a day.">
            <select className="select setting-control" value={settings.dailyGoalMin} onChange={(e) => set({ dailyGoalMin: Number(e.target.value) })} aria-label="Daily goal">
              {[5, 10, 15, 20, 30].map((m) => (
                <option key={m} value={m}>
                  {m} minutes
                </option>
              ))}
            </select>
          </Row>
        </section>

        <section className="card" aria-labelledby="session-title">
          <h2 className="section-title" id="session-title" style={{ marginBottom: 16 }}>
            During a take
          </h2>
          <Row title="Live filler counter" help="Shows a running count while you speak. Turn it off if it distracts you.">
            <Switch checked={settings.liveFillerAlert} onChange={(v) => set({ liveFillerAlert: v })} label="Live filler counter" />
          </Row>
          <Row
            title="Record and analyse my voice"
            help="Needed for playback, pauses and vocal variety. Turn it off if transcription stops working on your phone: some mobile browsers cannot record and transcribe at once."
          >
            <Switch checked={settings.recordAudio} onChange={(v) => set({ recordAudio: v })} label="Record and analyse my voice" />
          </Row>
          <Row title="Read questions aloud" help="Hear the question spoken before you answer, as you would in a real conversation.">
            <Switch checked={settings.speakPrompts} onChange={(v) => set({ speakPrompts: v })} label="Read questions aloud" />
          </Row>
        </section>

        <section className="card" aria-labelledby="look-title">
          <h2 className="section-title" id="look-title" style={{ marginBottom: 16 }}>
            Appearance
          </h2>
          <Row title="Theme">
            <div className="chips" role="radiogroup" aria-label="Theme">
              {(['system', 'light', 'dark'] as const).map((theme) => (
                <button key={theme} type="button" role="radio" className="chip" aria-checked={settings.theme === theme} onClick={() => set({ theme })}>
                  {theme[0]!.toUpperCase() + theme.slice(1)}
                </button>
              ))}
            </div>
          </Row>
        </section>

        <section className="card" aria-labelledby="ai-title">
          <h2 className="section-title" id="ai-title" style={{ marginBottom: 6 }}>
            AI coach
          </h2>
          <p className="muted" style={{ marginBottom: 16, maxWidth: '64ch' }}>
            Optional. With an Anthropic API key, Claude reviews the content of your answers, rewrites them more tightly in
            your own words, and can turn any situation you describe into a rehearsal. Everything else in the app works
            without it.
          </p>
          <div className="field">
            <label className="field-label" htmlFor="api-key">
              Anthropic API key
            </label>
            <input
              id="api-key"
              className="input"
              type="password"
              autoComplete="off"
              spellCheck={false}
              value={settings.apiKey}
              onChange={(e) => set({ apiKey: e.target.value.trim() })}
              placeholder="sk-ant-…"
            />
            <span className="field-help">
              Kept in this browser’s storage and sent only to the Anthropic API, directly from this page. Usage is billed
              to your key. Do not enter a key on a shared computer.
            </span>
          </div>
        </section>

        <section className="card" aria-labelledby="data-title">
          <h2 className="section-title" id="data-title" style={{ marginBottom: 6 }}>
            Your data
          </h2>
          <p className="muted" style={{ marginBottom: 16, maxWidth: '64ch' }}>
            Takes, transcripts and recordings are stored in this browser only. Nothing is uploaded. Transcription is done
            by your browser’s speech service.
          </p>
          <div className="row-wrap">
            <button type="button" className="btn btn-secondary" onClick={download}>
              <Icon name="download" size={16} />
              Export backup
            </button>
            <button type="button" className="btn btn-secondary" onClick={() => fileInput.current?.click()}>
              <Icon name="upload" size={16} />
              Restore backup
            </button>
            <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(e) => void restore(e.target.files?.[0])} />
            <button type="button" className="btn btn-danger" onClick={reset} disabled={takeCount === 0}>
              <Icon name="trash" size={16} />
              Clear all progress
            </button>
          </div>
          {message && (
            <p className="muted small" style={{ marginTop: 12 }} role="status">
              {message}
            </p>
          )}
        </section>
      </div>
    </div>
  );
}
