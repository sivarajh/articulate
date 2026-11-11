import { useState, type ReactNode } from 'react';
import { Pressable, Text, View } from 'react-native';
import { buildDrill, buildFramework, drillInfo } from '@core/content/drills';
import { FRAMEWORKS } from '@core/content/frameworks';
import { LESSONS } from '@core/content/lessons';
import { SKILLS } from '@core/types';
import { startPlan } from '@/lib/session';
import { Icon } from '@/ui/Icon';
import { Btn, Divider, Row, Screen, Section, T, Tag } from '@/ui/kit';
import { font, useTheme } from '@/ui/theme';

/** A card that opens to show its body. */
function Fold({ title, sub, tag, children }: { title: string; sub: string; tag?: string; children: ReactNode }) {
  const t = useTheme();
  const [open, setOpen] = useState(false);
  return (
    <View style={{ backgroundColor: t.surface, borderWidth: 1, borderColor: t.border, borderRadius: 14 }}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        accessibilityLabel={`${title}. ${sub}`}
        onPress={() => setOpen(!open)}
        style={{ flexDirection: 'row', alignItems: 'center', gap: 10, padding: 16 }}
      >
        <View style={{ flex: 1, gap: 2 }}>
          <T v="h3">{title}</T>
          <T v="small">{sub}</T>
        </View>
        {tag && <Tag label={tag} />}
        <Icon name={open ? 'chevron-down' : 'chevron-right'} size={18} color={t.muted} />
      </Pressable>
      {open && (
        <View style={{ paddingHorizontal: 16, paddingBottom: 16, gap: 14 }}>
          <Divider />
          {children}
        </View>
      )}
    </View>
  );
}

function Quote({ label, text, good }: { label: string; text: string; good?: boolean }) {
  const t = useTheme();
  return (
    <View style={{ gap: 4 }}>
      <T v="eyebrow">{label}</T>
      <View style={{ paddingLeft: 12, borderLeftWidth: 2, borderLeftColor: good ? t.accent : t.axis }}>
        <Text style={{ fontFamily: font.sans, fontSize: 15, lineHeight: 22, color: good ? t.ink : t.ink2 }}>{text}</Text>
      </View>
    </View>
  );
}

export default function Learn() {
  return (
    <Screen>
      <View style={{ gap: 6 }}>
        <T v="eyebrow">Learn</T>
        <T v="title">A dozen ideas do most of the work.</T>
        <T muted>Each principle takes a minute to read and has a drill that trains it. Read one, then go and say something out loud.</T>
      </View>

      <Section title="Principles" />
      {LESSONS.map((lesson) => {
        const drill = lesson.drill === 'framework' ? null : drillInfo(lesson.drill);
        return (
          <Fold key={lesson.id} title={lesson.title} sub={lesson.idea} tag={SKILLS.find((s) => s.id === lesson.skill)!.label}>
            {lesson.body.map((paragraph) => (
              <T key={paragraph}>{paragraph}</T>
            ))}
            <Quote label="Before" text={lesson.before} />
            <Quote label="After" text={lesson.after} good />
            <Row>
              <Btn
                kind="secondary"
                icon="mic"
                label={`Practise: ${drill ? drill.name : 'Answer first'}`}
                onPress={() => startPlan(drill ? buildDrill(drill.id) : buildFramework('pyramid'))}
              />
            </Row>
          </Fold>
        );
      })}

      <Section title="Frameworks" sub="Shapes you can pour any answer into. Learn three or four until they are automatic." />
      {FRAMEWORKS.map((framework) => (
        <Fold key={framework.id} title={framework.name} sub={framework.tagline}>
          <T>
            <Text style={{ fontFamily: font.bold }}>Use it when: </Text>
            {framework.useWhen}
          </T>
          {framework.steps.map((step, i) => (
            <View key={i} style={{ gap: 2 }}>
              <T v="strong">
                {i + 1}. {step.name}
              </T>
              <T v="small" style={{ fontSize: 14, lineHeight: 20 }}>
                {step.cue} “{step.starter}”
              </T>
            </View>
          ))}
          <T v="eyebrow">Example: {framework.example.prompt}</T>
          {framework.example.answer.map((line, i) => (
            <Quote key={i} label={framework.steps[i]!.name} text={line} good />
          ))}
          <Row>
            <Btn kind="secondary" icon="mic" label={`Practise ${framework.name}`} onPress={() => startPlan(buildFramework(framework.id))} />
          </Row>
        </Fold>
      ))}
    </Screen>
  );
}
