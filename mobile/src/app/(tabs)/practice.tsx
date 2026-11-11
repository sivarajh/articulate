import { useState } from 'react';
import { TextInput, View } from 'react-native';
import { DRILLS, buildCustom, buildDrill, buildFramework, buildImpromptu } from '@core/content/drills';
import { FRAMEWORKS } from '@core/content/frameworks';
import { CATEGORIES, type CategoryId } from '@core/content/prompts';
import { SKILLS, type FrameworkId } from '@core/types';
import { coachErrorMessage, generateScenario } from '@/lib/coach';
import { startPlan } from '@/lib/session';
import { useStore } from '@/lib/store';
import { Btn, Card, Chip, Notice, Option, Row, Screen, Section, T, Tag } from '@/ui/kit';
import { font, useTheme } from '@/ui/theme';

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

function Choice<V extends string | number>({ label, options, value, onChange }: { label: string; options: [V, string][]; value: V; onChange: (value: V) => void }) {
  return (
    <View style={{ gap: 8 }}>
      <T v="strong" style={{ fontSize: 13 }}>
        {label}
      </T>
      <View accessibilityRole="radiogroup" accessibilityLabel={label} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {options.map(([option, text]) => (
          <Chip key={String(option)} label={text} selected={option === value} onPress={() => onChange(option)} />
        ))}
      </View>
    </View>
  );
}

export default function Practice() {
  const t = useTheme();
  const apiKey = useStore((s) => s.settings.apiKey);
  const [category, setCategory] = useState<CategoryId | 'any' | 'own'>('any');
  const [speakSec, setSpeakSec] = useState(60);
  const [prepSec, setPrepSec] = useState(15);
  const [framework, setFramework] = useState<FrameworkId | 'auto' | 'none'>('auto');
  const [situation, setSituation] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const own = category === 'own';
  const chosenFramework = framework === 'auto' || framework === 'none' ? undefined : framework;

  const startImpromptu = () => {
    if (own) {
      const text = situation.trim();
      if (text) startPlan(buildCustom([text], { speakSec, prepSec, frameworkId: chosenFramework }));
    } else {
      startPlan(buildImpromptu({ category, speakSec, prepSec, framework }));
    }
  };

  const rehearse = async () => {
    const text = situation.trim();
    if (!text || busy) return;
    setBusy(true);
    setError(null);
    try {
      const scenario = await generateScenario(apiKey, text);
      startPlan(
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
    <Screen>
      <View style={{ gap: 6 }}>
        <T v="eyebrow">Practice</T>
        <T v="title">What do you need to be ready for?</T>
        <T muted>Pick a situation and speak. Every take is timed, transcribed and scored, and you can repeat it as often as you like.</T>
      </View>

      <Card style={{ gap: 18 }}>
        <View style={{ gap: 2 }}>
          <T v="h2">Speak on the spot</T>
          <T v="small">A question you have not seen, a clock, and nothing else.</T>
        </View>

        <Choice
          label="Situation"
          value={category}
          onChange={setCategory}
          options={[['any', 'Anything'], ...CATEGORIES.map((c): [CategoryId, string] => [c.id, c.label]), ['own', 'My own…']]}
        />

        {own && (
          <View style={{ gap: 6 }}>
            <T v="strong" style={{ fontSize: 13 }}>
              Your situation or question
            </T>
            <TextInput
              accessibilityLabel="Your situation or question"
              value={situation}
              onChangeText={setSituation}
              placeholder="e.g. I have to tell my manager on Friday that I am turning down the promotion."
              placeholderTextColor={t.muted}
              multiline
              maxLength={600}
              style={{
                minHeight: 92,
                padding: 12,
                borderRadius: 10,
                borderWidth: 1,
                borderColor: t.borderStrong,
                backgroundColor: t.surface,
                color: t.ink,
                fontFamily: font.sans,
                fontSize: 15,
                lineHeight: 22,
                textAlignVertical: 'top',
              }}
            />
            <T v="small">
              {apiKey
                ? 'Practise it as written, or let the AI coach turn it into five questions the other person might ask.'
                : 'You will answer this exactly as written. With an API key in Settings, the AI coach can turn any situation into a five-question rehearsal.'}
            </T>
          </View>
        )}

        <Choice label="Time to speak" value={speakSec} onChange={setSpeakSec} options={SPEAK_TIMES} />
        <Choice label="Time to prepare" value={prepSec} onChange={setPrepSec} options={PREP_TIMES} />
        <Choice
          label="Structure hint"
          value={framework}
          onChange={setFramework}
          options={[['auto', 'Suggest one'], ['none', 'No hint'], ...FRAMEWORKS.map((f): [FrameworkId, string] => [f.id, f.name])]}
        />

        {error && <Notice error text={error} />}

        <Row wrap>
          <Btn large icon="mic" label={own ? 'Practise this' : 'Give me a question'} disabled={own && !situation.trim()} onPress={startImpromptu} />
          {own && apiKey !== '' && (
            <Btn large kind="secondary" icon="sparkles" label={busy ? 'Building…' : 'Build a rehearsal'} busy={busy} disabled={!situation.trim()} onPress={rehearse} />
          )}
        </Row>
      </Card>

      <Section title="Frameworks" sub="Guided practice: you step through the shape and each part is measured." />
      {FRAMEWORKS.map((f) => (
        <Option key={f.id} title={f.name} text={f.useWhen} foot={<Tag label={f.steps.map((s) => s.name).join(' → ')} />} onPress={() => startPlan(buildFramework(f.id))} />
      ))}

      <Section title="Drills" sub="Short exercises that isolate one skill." />
      {DRILLS.map((drill) => (
        <Option
          key={drill.id}
          icon={drill.icon}
          title={drill.name}
          text={drill.summary}
          foot={
            <>
              <Tag label={SKILLS.find((s) => s.id === drill.skill)!.label} />
              <T v="small">{drill.length}</T>
            </>
          }
          onPress={() => startPlan(buildDrill(drill.id))}
        />
      ))}
    </Screen>
  );
}
