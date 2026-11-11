import { useMemo } from 'react';
import { Text, View } from 'react-native';
import { DRILLS, buildDaily, buildDrill, buildImpromptu, dateKey, drillInfo, planMinutes } from '@core/content/drills';
import { duration, greeting, minutes } from '@core/format';
import { computeProgress } from '@core/progress';
import { SKILLS, type DrillId, type SkillId } from '@core/types';
import { TakeList } from '@/features/TakeList';
import { startPlan } from '@/lib/session';
import { useStore } from '@/lib/store';
import { MeterList, WeekBars } from '@/ui/charts';
import { Btn, Card, Divider, Option, Row, Screen, Section, Status, T, Tile } from '@/ui/kit';
import { font, useTheme } from '@/ui/theme';

/** The drill to suggest for a weak skill. */
const TRAIN: Record<SkillId, DrillId> = {
  fluency: 'filler-free',
  pace: 'pace-lock',
  clarity: 'shrink-it',
  structure: 'hot-seat',
  vocabulary: 'word-weave',
  delivery: 'power-pause',
};

export default function Today() {
  const t = useTheme();
  const takes = useStore((s) => s.takes);
  const dailyDone = useStore((s) => s.dailyDone);
  const goal = useStore((s) => s.settings.dailyGoalMin);
  const progress = useMemo(() => computeProgress(takes), [takes]);
  const today = dateKey();
  const daily = useMemo(() => buildDaily(today, progress.weakest), [today, progress.weakest]);
  const doneToday = dailyDone.includes(today);
  const isNew = takes.length === 0;

  const weakest = progress.weakest ? SKILLS.find((s) => s.id === progress.weakest)! : null;
  const weakDrill = weakest ? drillInfo(TRAIN[weakest.id]) : null;
  const dateLine = new Date().toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' });

  return (
    <Screen>
      <View style={{ gap: 6 }}>
        <T v="eyebrow">{dateLine}</T>
        <T v="title">{greeting()}.</T>
        <T muted>
          {isNew
            ? 'Speaking well on the spot is a skill, and skills are built in short, honest repetitions. Say it out loud, see exactly what happened, and say it again.'
            : progress.todayMinutes > 0
              ? `You have practised ${minutes(progress.todayMinutes)} of your ${goal} minutes today.`
              : `Nothing recorded yet today. ${goal} minutes is all it takes.`}
        </T>
      </View>

      <Card strong style={{ gap: 14 }}>
        <T v="eyebrow">Today’s workout · about {planMinutes(daily)} minutes</T>
        <T v="h2">{doneToday ? 'Done for today. Keep going if you like.' : isNew ? 'Start here: three short steps.' : 'Three steps, aimed at what you need most.'}</T>
        <View style={{ gap: 10 }}>
          {daily.steps.map((step, i) => (
            <Row key={step.id} style={{ gap: 12, alignItems: 'flex-start' }}>
              <View style={{ width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center', backgroundColor: doneToday ? t.good : t.surface2 }}>
                <Text style={{ fontFamily: font.bold, fontSize: 12, color: doneToday ? '#ffffff' : t.ink2 }}>{doneToday ? '✓' : i + 1}</Text>
              </View>
              <View style={{ flex: 1 }}>
                <T v="strong">{step.title}</T>
                <T v="small">
                  {i === 0 ? 'Warm-up' : step.guided ? 'Guided structure practice' : step.tag} · {duration(step.speakSec)}
                </T>
              </View>
            </Row>
          ))}
        </View>
        <Row wrap>
          <Btn large kind={doneToday ? 'secondary' : 'primary'} icon="play" label={doneToday ? 'Run it again' : 'Start workout'} onPress={() => startPlan(daily)} />
          {doneToday && <Status level="good" label="Complete" />}
        </Row>
      </Card>

      {isNew ? (
        <>
          <Section title="How it works" />
          <Card style={{ gap: 14 }}>
            {[
              ['Speak', 'Answer a real question out loud, against the clock, the way you would have to in the room.'],
              ['Get measured', 'See your pace, fillers, hedges, pauses and structure, with the exact words marked in your transcript.'],
              ['Repeat', 'Fix one thing and go again. The second take is where the improvement happens.'],
            ].map(([title, text], i) => (
              <View key={title} style={{ gap: 2 }}>
                {i > 0 && <Divider />}
                <T v="h3" style={{ marginTop: i ? 12 : 0 }}>
                  {title}
                </T>
                <T v="small" style={{ fontSize: 14, lineHeight: 20 }}>
                  {text}
                </T>
              </View>
            ))}
          </Card>
        </>
      ) : (
        <>
          <Row wrap style={{ gap: 10, alignItems: 'stretch' }}>
            <Tile label="Streak" value={String(progress.streak)} unit={progress.streak === 1 ? 'day' : 'days'} sub={`Best ${progress.bestStreak}`} />
            <Tile label="This week" value={minutes(progress.weekMinutes)} unit="min" sub={`Goal ${goal} a day`} />
            <Tile label="Recent average" value={progress.recentAverage != null ? String(progress.recentAverage) : '–'} sub="Last ten scored takes" />
            <Tile label="Takes" value={String(progress.takes)} sub={`${minutes(progress.totalMinutes)} min in total`} />
          </Row>

          <Card style={{ gap: 14 }}>
            <View>
              <T v="h3">Your skills</T>
              <T v="small">Out of 100, weighted toward recent takes</T>
            </View>
            <MeterList rows={progress.skills.map((s) => ({ label: s.label, value: s.score }))} />
            {weakest && weakDrill && (
              <>
                <Divider />
                <View style={{ gap: 2 }}>
                  <T v="h3">Work on {weakest.label.toLowerCase()}</T>
                  <T v="small">{weakest.blurb}</T>
                </View>
                <Row>
                  <Btn kind="secondary" label={weakDrill.name} iconAfter="arrow-right" onPress={() => startPlan(buildDrill(weakDrill.id))} />
                </Row>
              </>
            )}
          </Card>

          <Card style={{ gap: 14 }}>
            <View>
              <T v="h3">Last seven days</T>
              <T v="small">Minutes practised each day</T>
            </View>
            <WeekBars days={progress.week} />
            <Divider />
            <MeterList
              max={goal}
              labelWidth={52}
              rows={[{ label: 'Today', value: Math.min(goal, progress.todayMinutes), figure: `${minutes(progress.todayMinutes)} of ${goal} min` }]}
            />
          </Card>
        </>
      )}

      <Section title="Quick start" />
      <Option
        icon="shuffle"
        title="Random question"
        text="One question from any situation. Fifteen seconds to think, sixty to answer."
        onPress={() => startPlan(buildImpromptu({ category: 'any', speakSec: 60, prepSec: 15, framework: 'auto' }))}
      />
      {(['hot-seat', 'filler-free'] as const).map((id) => {
        const drill = DRILLS.find((d) => d.id === id)!;
        return <Option key={id} icon={drill.icon} title={drill.name} text={drill.summary} onPress={() => startPlan(buildDrill(id))} />;
      })}

      {!isNew && (
        <>
          <Section title="Recent takes" />
          <Card style={{ paddingVertical: 4, gap: 0 }}>
            <TakeList takes={takes.slice(0, 4)} />
          </Card>
        </>
      )}
    </Screen>
  );
}
