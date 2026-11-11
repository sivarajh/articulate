// A practice session: brief -> countdown -> speak -> report, once per step. Multi-step
// plans either pause on a report between steps or, for rapid drills, run straight
// through and summarise at the end. Mirrors the web app's session.

import { activateKeepAwakeAsync, deactivateKeepAwake } from 'expo-keep-awake';
import { router } from 'expo-router';
import * as Speech from 'expo-speech';
import { useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { Pressable, ScrollView, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { analyze, goalLabel, scoreBand } from '@core/analysis/analyze';
import { findFlags, sameWord } from '@core/analysis/flags';
import { tokenize, wordsOf } from '@core/analysis/text';
import { buildCustom, remixPlan, repeatPlan } from '@core/content/drills';
import { getFramework } from '@core/content/frameworks';
import { clock, duration } from '@core/format';
import { xpFor } from '@core/progress';
import type { Exercise, Plan, Settings } from '@core/types';
import { CaptureError, NativeCapture } from '@/lib/capture';
import { setPlan } from '@/lib/session';
import { addTake, markDailyDone, useStore, type StoredTake } from '@/lib/store';
import { Icon } from '@/ui/Icon';
import { TimerRing } from '@/ui/charts';
import { Btn, Card, Notice, Row, Status, T, Tag } from '@/ui/kit';
import { font, tint, useTheme } from '@/ui/theme';
import { TakeReport } from './TakeReport';
import { Passage } from './Transcript';

type Phase = 'brief' | 'prep' | 'live' | 'scoring' | 'report' | 'summary';

/** With no prep time the question stays hidden until the clock starts. */
const isConcealed = (exercise: Exercise) => exercise.prepSec === 0 && exercise.mode === 'speak';

const promptSize = (text: string) => (text.length > 110 ? 22 : text.length > 60 ? 26 : 31);

function Prompt({ text, size }: { text: string; size?: number }) {
  const t = useTheme();
  const fontSize = size ?? promptSize(text);
  return (
    <Text
      accessibilityRole="header"
      style={{ fontFamily: font.serif, fontSize, lineHeight: Math.round(fontSize * 1.16), letterSpacing: -0.5, color: t.ink, textAlign: 'center' }}
    >
      {text}
    </Text>
  );
}

/** Header, scrolling body and a bottom action bar. */
function Frame({ title, dots, right, children, bottom }: { title: string; dots?: ReactNode; right?: ReactNode; children: ReactNode; bottom?: ReactNode }) {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <View style={{ flex: 1, backgroundColor: t.page }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, paddingTop: insets.top + 6, paddingHorizontal: 8, paddingBottom: 6 }}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Leave session"
          onPress={() => (router.canGoBack() ? router.back() : router.replace('/'))}
          style={{ width: 44, height: 44, alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="x" color={t.ink2} />
        </Pressable>
        <Text numberOfLines={1} style={{ flexShrink: 1, fontFamily: font.bold, fontSize: 15, color: t.ink }}>
          {title}
        </Text>
        {dots}
        <View style={{ flex: 1 }} />
        {right}
        <View style={{ width: 8 }} />
      </View>
      <ScrollView
        contentContainerStyle={{ width: '100%', maxWidth: 720, alignSelf: 'center', paddingHorizontal: 16, paddingTop: 12, paddingBottom: 28, gap: 16 }}
        keyboardShouldPersistTaps="handled"
      >
        {children}
      </ScrollView>
      {bottom && (
        <View
          style={{
            flexDirection: 'row',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 10,
            paddingHorizontal: 16,
            paddingTop: 12,
            paddingBottom: insets.bottom + 12,
            borderTopWidth: 1,
            borderTopColor: t.border,
          }}
        >
          {bottom}
        </View>
      )}
    </View>
  );
}

export function Session({ plan }: { plan: Plan }) {
  const t = useTheme();
  const settings = useStore((s) => s.settings);
  const [index, setIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>('brief');
  const [done, setDone] = useState<StoredTake[]>([]);
  const [viewing, setViewing] = useState(0);
  const [fromSummary, setFromSummary] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [opening, setOpening] = useState(false);
  const [capture, setCapture] = useState<NativeCapture | null>(null);

  const captureRef = useRef<NativeCapture | null>(null);
  const doneRef = useRef<StoredTake[]>([]);
  const finishing = useRef(false);
  const mounted = useRef(true);

  const exercise = plan.steps[index]!;
  const isLast = index === plan.steps.length - 1;
  const multi = plan.steps.length > 1;

  useEffect(() => {
    mounted.current = true;
    // Nobody touches their phone mid-answer: keep the screen on for the whole session.
    void activateKeepAwakeAsync('articulate-session').catch(() => undefined);
    return () => {
      mounted.current = false;
      captureRef.current?.close();
      captureRef.current = null;
      void Speech.stop().catch(() => undefined);
      void deactivateKeepAwake('articulate-session').catch(() => undefined);
    };
  }, []);

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
        const session = await NativeCapture.open({ lang: settings.lang, record: settings.recordAudio });
        if (!mounted.current) {
          session.close();
          return;
        }
        captureRef.current = session;
        setCapture(session);
      } catch (e) {
        if (mounted.current) setError(e instanceof CaptureError ? e.message : 'Speech recognition could not be started.');
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
    const take: StoredTake = {
      id: `take-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 7)}`,
      at: Date.now(),
      planId: plan.id,
      planTitle: plan.title,
      exercise,
      capture: captured,
      analysis,
      xp: xpFor(analysis),
      audio: audio.length ? audio : undefined,
    };
    addTake(take);
    if (isLast && plan.dailyKey) markDailyDone(plan.dailyKey);
    if (!mounted.current) return;

    doneRef.current = [...doneRef.current, take];
    setDone(doneRef.current);

    if (plan.rapid && !isLast) {
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
    if (router.canGoBack()) router.back();
    else router.replace('/');
  };

  const followUp = (question: string) => setPlan(buildCustom([question], { speakSec: 60, prepSec: 10, title: 'Follow-up' }));

  const dots = multi ? (
    <View accessibilityLabel={`Step ${index + 1} of ${plan.steps.length}`} style={{ flexDirection: 'row', gap: 5 }}>
      {plan.steps.map((step, i) => {
        const finished = done.some((d) => d.exercise.id === step.id);
        return <View key={step.id} style={{ width: 18, height: 4, borderRadius: 2, backgroundColor: finished ? t.ink : i === index ? t.accent : t.grid }} />;
      })}
    </View>
  ) : undefined;

  const listening =
    phase === 'live' ? (
      <Row style={{ gap: 6 }}>
        <View style={{ width: 9, height: 9, borderRadius: 5, backgroundColor: t.critical }} />
        <Text style={{ fontFamily: font.bold, fontSize: 13, color: t.ink2 }}>Listening</Text>
      </Row>
    ) : undefined;

  const shown = done[viewing];

  if (phase === 'brief') {
    return (
      <Frame
        title={plan.title}
        dots={dots}
        bottom={<Btn large icon="mic" label={opening ? 'Getting ready…' : 'Start'} busy={opening} onPress={begin} />}
      >
        <Brief plan={plan} index={index} exercise={exercise} settings={settings} error={error} />
      </Frame>
    );
  }

  if (phase === 'prep') {
    return <Prep key={exercise.id + done.length} title={plan.title} dots={dots} exercise={exercise} settings={settings} onDone={goLive} />;
  }

  if (phase === 'live' && capture) {
    return <Live title={plan.title} dots={dots} right={listening} session={capture} exercise={exercise} settings={settings} onFinish={finish} />;
  }

  if (phase === 'report' && shown) {
    return (
      <Frame
        title={plan.title}
        dots={dots}
        bottom={
          fromSummary ? (
            <Btn icon="arrow-left" label="Back to summary" onPress={() => setPhase('summary')} />
          ) : (
            <>
              <Btn kind={multi && !isLast ? 'secondary' : 'primary'} icon="retry" label="Try it again" busy={opening} onPress={begin} />
              {multi && !isLast && (
                <Btn
                  label={`Next: ${plan.steps[index + 1]!.title}`}
                  iconAfter="arrow-right"
                  onPress={() => {
                    setIndex(index + 1);
                    setPhase('brief');
                  }}
                />
              )}
              {multi && isLast && <Btn kind="secondary" label="See the summary" onPress={() => setPhase('summary')} />}
              {!multi && plan.recipe && <Btn kind="secondary" icon="shuffle" label="New prompt" onPress={() => setPlan(remixPlan(plan))} />}
              {(!multi || isLast) && <Btn kind="ghost" label="Done" onPress={exit} />}
            </>
          )
        }
      >
        <View style={{ gap: 6 }}>
          <T v="eyebrow">
            {shown.exercise.title} · {shown.exercise.tag}
          </T>
          {shown.exercise.mode === 'speak' && <T v="h2">{shown.exercise.prompt}</T>}
        </View>
        <TakeReport take={shown} onFollowUp={followUp} />
        {error && <Notice error text={error} />}
      </Frame>
    );
  }

  if (phase === 'summary') {
    return (
      <Summary
        plan={plan}
        dots={dots}
        done={done}
        onOpen={(i) => {
          setViewing(i);
          setFromSummary(true);
          setPhase('report');
        }}
        onAgain={() => setPlan(remixPlan(plan) ?? repeatPlan(plan))}
        onDone={exit}
      />
    );
  }

  return (
    <Frame title={plan.title} dots={dots}>
      <View style={{ alignItems: 'center', gap: 16, paddingTop: 120 }}>
        <T muted>Scoring your take…</T>
      </View>
    </Frame>
  );
}

// ---------------------------------------------------------------- brief

function Words({ exercise, said }: { exercise: Exercise; said?: string[] }) {
  const t = useTheme();
  const heard = (word: string) => said?.some((w) => sameWord(w, word.toLowerCase())) ?? false;
  const framework = exercise.frameworkId && !exercise.guided ? getFramework(exercise.frameworkId) : null;
  const pill = (word: string, color: string, border: string, icon?: string, struck?: boolean) => (
    <View key={word} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8, borderWidth: 1, borderColor: border, backgroundColor: t.surface }}>
      {icon && <Icon name={icon} size={14} strokeWidth={2.5} color={color} />}
      <Text style={{ fontFamily: font.bold, fontSize: 15, color, textDecorationLine: struck ? 'line-through' : 'none' }}>{word}</Text>
    </View>
  );
  return (
    <>
      {exercise.taboo && (
        <View accessibilityLabel="Words you may not say" style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
          {exercise.taboo.map((word) => pill(word, t.criticalInk, tint(t.critical, 0.45), heard(word) ? 'x' : 'ban', heard(word)))}
        </View>
      )}
      {exercise.mustUse && (
        <View accessibilityLabel="Words to use" style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
          {exercise.mustUse.map((word) =>
            heard(word) ? pill(word, t.goodInk, tint(t.good, 0.5), 'check') : pill(word, t.ink, t.borderStrong),
          )}
        </View>
      )}
      {framework && (
        <View accessibilityLabel={`${framework.name} steps`} style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
          {framework.steps.map((step, i) => (
            <View key={i} style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: t.border }}>
              <Text style={{ fontFamily: font.bold, fontSize: 14, color: t.ink2 }}>{step.name}</Text>
            </View>
          ))}
        </View>
      )}
    </>
  );
}

function StepList({ items }: { items: { name: string; cue: string }[] }) {
  const t = useTheme();
  return (
    <View style={{ gap: 12 }}>
      {items.map((item, i) => (
        <View key={i} style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: t.surface2 }}>
            <Text style={{ fontFamily: font.bold, fontSize: 12, color: t.ink2 }}>{i + 1}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <T v="strong">{item.name}</T>
            <T v="small" style={{ fontSize: 14, lineHeight: 20 }}>
              {item.cue}
            </T>
          </View>
        </View>
      ))}
    </View>
  );
}

function Brief({ plan, index, exercise, settings, error }: { plan: Plan; index: number; exercise: Exercise; settings: Settings; error: string | null }) {
  const t = useTheme();
  const concealed = isConcealed(exercise);
  const framework = exercise.guided && exercise.frameworkId ? getFramework(exercise.frameworkId) : null;
  const showOutline = plan.steps.length > 1 && index === 0;

  return (
    <View style={{ gap: 18, paddingTop: 12 }}>
      <T v="eyebrow" center>
        {exercise.tag}
      </T>
      {concealed ? <Prompt text="Your question appears when the clock starts." size={26} /> : <Prompt text={exercise.prompt} size={exercise.mode === 'read' ? 26 : undefined} />}
      {exercise.context && (
        <T muted center>
          {exercise.context}
        </T>
      )}
      <Row wrap style={{ justifyContent: 'center' }}>
        <Tag icon="clock" label={exercise.prepSec > 0 ? `${duration(exercise.prepSec)} to prepare` : 'No preparation'} />
        <Tag icon="mic" label={exercise.mode === 'read' ? `Up to ${duration(exercise.speakSec)}` : `${duration(exercise.speakSec)} to speak`} />
      </Row>

      <Words exercise={exercise} />

      {exercise.mode === 'read' && exercise.readText && (
        <Card>
          <Passage text={exercise.readText} />
        </Card>
      )}

      {framework && (
        <Card style={{ gap: 14 }}>
          <T v="h3">{framework.name}</T>
          <StepList items={framework.steps} />
        </Card>
      )}

      {exercise.goals.length > 0 && (
        <Card>
          <T v="h3">Targets</T>
          {exercise.goals.map((goal) => (
            <Row key={goal.type} style={{ gap: 10 }}>
              <Icon name="target" size={16} color={t.ink2} />
              <T style={{ flex: 1 }}>{goalLabel(goal, exercise, settings)}</T>
            </Row>
          ))}
        </Card>
      )}

      {showOutline && (
        <Card style={{ gap: 14 }}>
          <T v="h3">{plan.rapid ? `${plan.steps.length} in a row, no stopping` : `${plan.steps.length} steps`}</T>
          <StepList
            items={plan.steps.map((step, i) => ({
              name: plan.rapid ? step.tag : step.title,
              cue: plan.rapid || i > 0 ? duration(step.speakSec) : `${step.tag} · ${duration(step.speakSec)}`,
            }))}
          />
        </Card>
      )}

      {error && <Notice error text={error} />}
    </View>
  );
}

// ---------------------------------------------------------------- countdown

interface PrepProps {
  title: string;
  dots?: ReactNode;
  exercise: Exercise;
  settings: Settings;
  onDone: () => void;
}

function Prep({ title, dots, exercise, settings, onDone }: PrepProps) {
  const speakAloud = settings.speakPrompts && exercise.mode === 'speak';
  const hasPrep = exercise.prepSec > 0;
  // With no prep time: a three-second "get ready", or long enough to hear the question read out.
  const total = hasPrep ? exercise.prepSec : speakAloud ? Math.ceil(wordsOf(exercise.prompt).length / 2.6) + 2 : 3;
  const reveal = hasPrep || speakAloud || exercise.mode === 'read';
  const [left, setLeft] = useState(total);
  const onDoneRef = useRef(onDone);
  onDoneRef.current = onDone;

  useEffect(() => {
    const started = Date.now();
    const timer = setInterval(() => {
      const remaining = total - (Date.now() - started) / 1000;
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
    Speech.speak(exercise.prompt, { language: settings.lang });
    return () => {
      void Speech.stop().catch(() => undefined);
    };
  }, [speakAloud, exercise.prompt, settings.lang]);

  return (
    <Frame title={title} dots={dots} bottom={hasPrep ? <Btn kind="secondary" large label="I am ready" onPress={onDone} /> : undefined}>
      <View style={{ alignItems: 'center', gap: 18, paddingTop: 8 }}>
        <T v="eyebrow">{exercise.tag}</T>
        <TimerRing share={left / total} value={String(Math.ceil(left))} label={hasPrep ? 'Prepare' : 'Get ready'} />
        {reveal ? (
          <>
            <Prompt text={exercise.prompt} size={exercise.mode === 'read' ? 20 : undefined} />
            {exercise.context && (
              <T muted center>
                {exercise.context}
              </T>
            )}
            <Words exercise={exercise} />
            {exercise.mode === 'read' && exercise.readText && (
              <Card style={{ alignSelf: 'stretch' }}>
                <Passage text={exercise.readText} />
              </Card>
            )}
          </>
        ) : (
          <T muted center>
            The question appears when the clock starts. Answer first, then give your reason.
          </T>
        )}
      </View>
    </Frame>
  );
}

// ---------------------------------------------------------------- live

function LevelMeter({ level, speaking }: { level: number; speaking: boolean }) {
  const t = useTheme();
  const history = useRef<number[]>(new Array(22).fill(0));
  history.current = [...history.current.slice(1), level];
  return (
    <View accessibilityElementsHidden importantForAccessibility="no-hide-descendants" style={{ flexDirection: 'row', alignItems: 'center', gap: 3, height: 30 }}>
      {history.current.map((value, i) => (
        <View key={i} style={{ width: 3, height: Math.max(3, value * 30), borderRadius: 2, backgroundColor: speaking ? t.accent : t.axis }} />
      ))}
    </View>
  );
}

function Stat({ label, value, note, flash, children }: { label: string; value: string; note?: string; flash?: boolean; children?: ReactNode }) {
  const t = useTheme();
  return (
    <View
      style={{
        flex: 1,
        padding: 12,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: flash ? t.c[1] : t.border,
        backgroundColor: flash ? tint(t.c[1], 0.14) : t.surface,
      }}
    >
      <Text style={{ fontFamily: font.bold, fontSize: 12, color: t.ink2 }}>{label}</Text>
      <Text style={{ fontFamily: font.bold, fontSize: 22, lineHeight: 28, color: t.ink, fontVariant: ['tabular-nums'] }}>
        {value}
        {note ? <Text style={{ fontFamily: font.medium, fontSize: 12, color: t.ink2 }}> {note}</Text> : null}
      </Text>
      {children}
    </View>
  );
}

const GAUGE_MIN = 80;
const GAUGE_MAX = 220;
const gaugeShare = (wpm: number) => Math.max(0, Math.min(1, (wpm - GAUGE_MIN) / (GAUGE_MAX - GAUGE_MIN)));

function PaceGauge({ wpm, min, max }: { wpm: number | null; min: number; max: number }) {
  const t = useTheme();
  return (
    <View style={{ height: 14, justifyContent: 'center', marginTop: 4 }}>
      <View style={{ height: 6, borderRadius: 3, backgroundColor: t.grid }}>
        <View
          style={{
            position: 'absolute',
            left: `${gaugeShare(min) * 100}%`,
            width: `${(gaugeShare(max) - gaugeShare(min)) * 100}%`,
            height: 6,
            borderRadius: 3,
            backgroundColor: t.accentWash,
          }}
        />
      </View>
      {wpm != null && (
        <View
          style={{
            position: 'absolute',
            left: `${gaugeShare(wpm) * 100}%`,
            marginLeft: -7,
            width: 14,
            height: 14,
            borderRadius: 7,
            borderWidth: 2,
            borderColor: t.surface,
            backgroundColor: t.accent,
          }}
        />
      )}
    </View>
  );
}

interface LiveProps {
  title: string;
  dots?: ReactNode;
  right?: ReactNode;
  session: NativeCapture;
  exercise: Exercise;
  settings: Settings;
  onFinish: () => void;
}

function Live({ title, dots, right, session, exercise, settings, onFinish }: LiveProps) {
  const t = useTheme();
  const live = useSyncExternalStore(session.subscribe, session.getSnapshot, session.getSnapshot);
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
    () => (isRead ? 0 : findFlags(tokenize(text), { customFillers: settings.customFillers }).filter((f) => f.kind === 'filler').length),
    [text, isRead, settings.customFillers],
  );
  // Briefly highlight the counter when a new filler lands.
  const [flash, setFlash] = useState(false);
  const lastFillers = useRef(0);
  useEffect(() => {
    if (fillers > lastFillers.current) {
      setFlash(true);
      const timer = setTimeout(() => setFlash(false), 450);
      lastFillers.current = fillers;
      return () => clearTimeout(timer);
    }
    lastFillers.current = fillers;
  }, [fillers]);

  const lastStep = framework ? step >= framework.steps.length - 1 : true;
  const nextStep = () => {
    if (!framework || lastStep) return;
    session.markStep();
    setStep(step + 1);
  };

  const wpm = live.liveWpm;
  const paceState = wpm == null ? 'wpm' : wpm > settings.paceMax + 8 ? 'Fast' : wpm < settings.paceMin - 8 ? 'Slow' : 'On pace';
  const tail = live.finalText.length > 220 ? `…${live.finalText.slice(-220)}` : live.finalText;
  const showFillers = !isRead && settings.liveFillerAlert && live.transcript === 'listening';

  return (
    <Frame
      title={title}
      dots={dots}
      right={right}
      bottom={
        <>
          {framework && !lastStep && <Btn large label={`Next: ${framework.steps[step + 1]!.name}`} iconAfter="arrow-right" onPress={nextStep} />}
          <Btn large kind={framework && !lastStep ? 'secondary' : 'primary'} icon="stop" label="Finish" onPress={onFinish} />
        </>
      }
    >
      <View style={{ alignItems: 'center', gap: 16 }}>
        <Row style={{ gap: 18 }}>
          <TimerRing share={1 - remaining / totalMs} value={clock(remaining / 1000)} label="left" />
          {live.hasLevels && <LevelMeter level={live.level} speaking={live.speaking} />}
        </Row>

        {isRead ? (
          <Card style={{ alignSelf: 'stretch' }}>{exercise.readText ? <Passage text={exercise.readText} /> : null}</Card>
        ) : (
          <Prompt text={exercise.prompt} />
        )}

        <Words exercise={exercise} said={said} />

        {framework && (
          <>
            <View accessibilityLabel={`${framework.name} steps`} style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'center', gap: 8 }}>
              {framework.steps.map((s, i) => (
                <View
                  key={i}
                  accessibilityState={{ selected: i === step }}
                  style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 999, borderWidth: 1, borderColor: i === step ? t.accent : t.border, backgroundColor: i === step ? t.accent : 'transparent' }}
                >
                  <Text style={{ fontFamily: font.bold, fontSize: 14, color: i === step ? '#ffffff' : i < step ? t.muted : t.ink2, textDecorationLine: i < step ? 'line-through' : 'none' }}>
                    {s.name}
                  </Text>
                </View>
              ))}
            </View>
            <Card style={{ alignSelf: 'stretch', gap: 4 }}>
              <T v="small">{framework.steps[step]!.cue}</T>
              <Text style={{ fontFamily: font.serifItalic, fontSize: 20, lineHeight: 26, color: t.ink }}>{framework.steps[step]!.starter}</Text>
            </Card>
          </>
        )}

        <View style={{ flexDirection: 'row', gap: 10, alignSelf: 'stretch' }}>
          <Stat label="Words" value={String(live.words)} />
          {exercise.drillId === 'power-pause' ? (
            <Stat label="Pauses" value={live.hasLevels ? String(live.pauses) : '–'} />
          ) : (
            <Stat label="Pace" value={wpm != null ? String(wpm) : '–'} note={paceState}>
              <PaceGauge wpm={wpm} min={settings.paceMin} max={settings.paceMax} />
            </Stat>
          )}
          {showFillers && <Stat label="Fillers" value={String(fillers)} flash={flash} />}
        </View>

        {live.transcript === 'listening' && live.notTranscribing && (
          <Notice text="Your voice is coming through, but no words are. Speech recognition may not be working on this device. Timing is still being measured." />
        )}
        {!isRead && live.transcript === 'listening' && !live.notTranscribing && (
          <View
            accessibilityLabel="Live transcript"
            style={{ alignSelf: 'stretch', minHeight: 84, justifyContent: 'flex-end', padding: 14, borderRadius: 10, borderWidth: 1, borderColor: t.border, backgroundColor: t.surface }}
          >
            <Text style={{ fontFamily: font.sans, fontSize: 16, lineHeight: 25, color: t.ink }}>
              {tail} <Text style={{ color: t.muted }}>{live.interim || (tail ? '' : 'Start speaking…')}</Text>
            </Text>
          </View>
        )}
        {live.transcript === 'error' && <Notice text={`${live.transcriptError ?? 'Transcription stopped.'} You can finish the take; what was heard so far is kept.`} />}
      </View>
    </Frame>
  );
}

// ---------------------------------------------------------------- summary

interface SummaryProps {
  plan: Plan;
  dots?: ReactNode;
  done: StoredTake[];
  onOpen: (index: number) => void;
  onAgain: () => void;
  onDone: () => void;
}

function Summary({ plan, dots, done, onOpen, onAgain, onDone }: SummaryProps) {
  const t = useTheme();
  const scored = done.filter((d) => d.analysis.overall != null);
  const average = scored.length ? Math.round(scored.reduce((n, d) => n + d.analysis.overall!, 0) / scored.length) : null;
  const goals = done.flatMap((d) => d.analysis.goals);
  const band = average != null ? scoreBand(average) : null;
  const xp = done.reduce((n, d) => n + d.xp, 0);

  return (
    <Frame
      title={plan.title}
      dots={dots}
      bottom={
        <>
          <Btn icon="retry" label="Go again" onPress={onAgain} />
          <Btn kind="ghost" label="Done" onPress={onDone} />
        </>
      }
    >
      <View style={{ gap: 8 }}>
        <T v="eyebrow">{plan.title} · complete</T>
        <T v="title">{average != null ? `You averaged ${average}.` : 'Session complete.'}</T>
        <Row wrap>
          {band && <Status level={band.level} label={band.label} />}
          {goals.length > 0 && <Tag label={`${goals.filter((g) => g.met).length} of ${goals.length} targets met`} />}
          <Tag label={`+${xp} XP`} />
        </Row>
      </View>
      <Card style={{ gap: 0, paddingVertical: 4 }}>
        {done.map((take, i) => {
          const fix = take.analysis.notes.find((n) => n.tone === 'fix');
          const title = take.exercise.mode === 'read' ? (take.exercise.readText ?? take.exercise.prompt) : take.exercise.prompt;
          return (
            <Pressable
              key={take.id}
              accessibilityRole="button"
              onPress={() => onOpen(i)}
              style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: t.border }}
            >
              <View style={{ flex: 1 }}>
                <T numberOfLines={1} style={{ fontFamily: font.medium }}>
                  {title}
                </T>
                <T v="small" numberOfLines={1}>
                  {take.exercise.tag}
                  {fix ? ` · ${fix.title}` : take.analysis.sufficient ? ' · Clean' : ' · Not enough speech'}
                </T>
              </View>
              <Text style={{ fontFamily: font.bold, fontSize: 18, color: t.ink }}>{take.analysis.overall ?? '–'}</Text>
              <Icon name="chevron-right" size={18} color={t.muted} />
            </Pressable>
          );
        })}
      </Card>
    </Frame>
  );
}
