import { useState, type ReactNode } from 'react';
import { Platform, Share, Switch, TextInput, View } from 'react-native';
import { getState, resetProgress, updateSettings, useStore } from '@/lib/store';
import { Btn, Card, Chip, Divider, Row, Screen, T } from '@/ui/kit';
import { font, useTheme } from '@/ui/theme';

const ACCENTS: [string, string][] = [
  ['en-US', 'United States'],
  ['en-GB', 'United Kingdom'],
  ['en-IN', 'India'],
  ['en-AU', 'Australia'],
  ['en-CA', 'Canada'],
  ['en-NZ', 'New Zealand'],
  ['en-ZA', 'South Africa'],
  ['en-IE', 'Ireland'],
  ['en-SG', 'Singapore'],
];

function Setting({ title, help, children, inline }: { title: string; help?: string; children: ReactNode; inline?: boolean }) {
  return (
    <View style={inline ? { flexDirection: 'row', alignItems: 'center', gap: 16 } : { gap: 10 }}>
      <View style={inline ? { flex: 1, gap: 2 } : { gap: 2 }}>
        <T v="h3" style={{ fontSize: 15 }}>
          {title}
        </T>
        {help && <T v="small">{help}</T>}
      </View>
      {children}
    </View>
  );
}

function Chips<V extends string | number>({ label, options, value, onChange }: { label: string; options: [V, string][]; value: V; onChange: (value: V) => void }) {
  return (
    <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
      {options.map(([option, text]) => (
        <Chip key={String(option)} label={text} selected={option === value} onPress={() => onChange(option)} />
      ))}
    </View>
  );
}

export default function Settings() {
  const t = useTheme();
  const settings = useStore((s) => s.settings);
  const takeCount = useStore((s) => s.takes.length);
  const [fillers, setFillers] = useState(settings.customFillers.join(', '));
  const [confirming, setConfirming] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  const input = {
    minHeight: 44,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: t.borderStrong,
    backgroundColor: t.surface,
    color: t.ink,
    fontFamily: font.sans,
    fontSize: 15,
  } as const;

  const nudgePace = (key: 'paceMin' | 'paceMax', by: number) => {
    const value = Math.max(80, Math.min(240, settings[key] + by));
    if (key === 'paceMin') updateSettings({ paceMin: value, paceMax: Math.max(settings.paceMax, value + 10) });
    else updateSettings({ paceMax: value, paceMin: Math.min(settings.paceMin, value - 10) });
  };

  const saveFillers = () => {
    const list = fillers
      .split(',')
      .map((f) => f.trim().toLowerCase())
      .filter(Boolean)
      .slice(0, 20);
    updateSettings({ customFillers: list });
    setFillers(list.join(', '));
  };

  const exportBackup = () => {
    const state = getState();
    const backup = JSON.stringify({ ...state, settings: { ...state.settings, apiKey: '' }, takes: state.takes.map((take) => ({ ...take, audio: undefined })) });
    void Share.share({ title: 'Articulate backup', message: backup }).catch(() => undefined);
  };

  const clear = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    resetProgress();
    setConfirming(false);
    setMessage('Progress cleared.');
  };

  const stepper = (key: 'paceMin' | 'paceMax', label: string) => (
    <Row style={{ gap: 6 }}>
      <Btn kind="secondary" label="−" onPress={() => nudgePace(key, -5)} style={{ minHeight: 40, paddingHorizontal: 14 }} />
      <View accessible accessibilityLabel={`${label}: ${settings[key]} words a minute`} style={{ minWidth: 44, alignItems: 'center' }}>
        <T v="strong">{settings[key]}</T>
      </View>
      <Btn kind="secondary" label="+" onPress={() => nudgePace(key, 5)} style={{ minHeight: 40, paddingHorizontal: 14 }} />
    </Row>
  );

  return (
    <Screen>
      <View style={{ gap: 6 }}>
        <T v="eyebrow">Settings</T>
        <T v="title">Make it yours.</T>
      </View>

      <Card style={{ gap: 16 }}>
        <T v="h2">Speaking</T>
        <Setting title="Accent" help="Which variety of English the recogniser should listen for.">
          <Chips label="Accent" options={ACCENTS} value={settings.lang} onChange={(lang) => updateSettings({ lang })} />
        </Setting>
        <Divider />
        <Setting title="Target pace" help="Words a minute. 130–165 suits most conversation and presenting.">
          <Row wrap style={{ gap: 14 }}>
            {stepper('paceMin', 'Slowest target pace')}
            <T muted>to</T>
            {stepper('paceMax', 'Fastest target pace')}
          </Row>
        </Setting>
        <Divider />
        <Setting title="Your own crutch words" help="Counted as fillers on top of the built-in list. Separate with commas.">
          <TextInput
            accessibilityLabel="Your own crutch words"
            value={fillers}
            onChangeText={setFillers}
            onBlur={saveFillers}
            onSubmitEditing={saveFillers}
            placeholder="at the end of the day, right"
            placeholderTextColor={t.muted}
            autoCapitalize="none"
            autoCorrect={false}
            style={input}
          />
        </Setting>
        <Divider />
        <Setting title="Daily goal" help="Minutes of speaking practice a day.">
          <Chips
            label="Daily goal"
            options={[5, 10, 15, 20, 30].map((m): [number, string] => [m, `${m} min`])}
            value={settings.dailyGoalMin}
            onChange={(dailyGoalMin) => updateSettings({ dailyGoalMin })}
          />
        </Setting>
      </Card>

      <Card style={{ gap: 16 }}>
        <T v="h2">During a take</T>
        <Setting inline title="Live filler counter" help="Shows a running count while you speak. Turn it off if it distracts you.">
          <Switch accessibilityLabel="Live filler counter" value={settings.liveFillerAlert} onValueChange={(v) => updateSettings({ liveFillerAlert: v })} />
        </Setting>
        <Divider />
        <Setting inline title="Keep a recording" help="Saves the audio of each take on this device so you can play it back.">
          <Switch accessibilityLabel="Keep a recording" value={settings.recordAudio} onValueChange={(v) => updateSettings({ recordAudio: v })} />
        </Setting>
        <Divider />
        <Setting inline title="Read questions aloud" help="Hear the question spoken before you answer, as you would in a real conversation.">
          <Switch accessibilityLabel="Read questions aloud" value={settings.speakPrompts} onValueChange={(v) => updateSettings({ speakPrompts: v })} />
        </Setting>
      </Card>

      <Card style={{ gap: 12 }}>
        <T v="h2">Appearance</T>
        <Chips
          label="Theme"
          options={[
            ['system', 'System'],
            ['light', 'Light'],
            ['dark', 'Dark'],
          ]}
          value={settings.theme}
          onChange={(theme) => updateSettings({ theme })}
        />
      </Card>

      <Card style={{ gap: 12 }}>
        <T v="h2">AI coach</T>
        <T muted>
          Optional. With an Anthropic API key, Claude reviews the content of your answers, rewrites them more tightly in your own words, and can turn any
          situation you describe into a rehearsal. Everything else in the app works without it.
        </T>
        <TextInput
          accessibilityLabel="Anthropic API key"
          value={settings.apiKey}
          onChangeText={(apiKey) => updateSettings({ apiKey: apiKey.trim() })}
          placeholder="sk-ant-…"
          placeholderTextColor={t.muted}
          secureTextEntry
          autoCapitalize="none"
          autoCorrect={false}
          style={input}
        />
        <T v="small">
          {Platform.OS === 'web'
            ? 'Kept in this browser’s storage and sent only to the Anthropic API. Usage is billed to your key.'
            : 'Kept in this device’s secure keychain and sent only to the Anthropic API. Usage is billed to your key.'}
        </T>
      </Card>

      <Card style={{ gap: 12 }}>
        <T v="h2">Your data</T>
        <T muted>
          Takes, transcripts and recordings are stored on this device only. Transcription is done by the device’s speech recognition service, which may
          send audio to Apple or Google.
        </T>
        <Row wrap>
          {Platform.OS !== 'web' && <Btn kind="secondary" label="Export backup" onPress={exportBackup} />}
          <Btn kind="danger" icon="trash" label={confirming ? `Tap again to delete ${takeCount} takes` : 'Clear all progress'} disabled={takeCount === 0} onPress={clear} />
          {confirming && <Btn kind="ghost" label="Cancel" onPress={() => setConfirming(false)} />}
        </Row>
        {message && <T v="small">{message}</T>}
      </Card>
    </Screen>
  );
}
