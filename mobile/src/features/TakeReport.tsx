// Everything the app has to say about one take: the score, the one thing to fix next,
// the numbers behind it, the marked-up transcript, the recording, and the AI coach.

import { setAudioModeAsync, useAudioPlayer, useAudioPlayerStatus } from 'expo-audio';
import { router } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { Platform, Text, View } from 'react-native';
import { scoreBand } from '@core/analysis/analyze';
import { getFramework } from '@core/content/frameworks';
import { clock } from '@core/format';
import { previousAttempt } from '@core/progress';
import { SKILLS, type CoachNote } from '@core/types';
import { coachErrorMessage, coachTake } from '@/lib/coach';
import { attachAiFeedback, useStore, type StoredTake } from '@/lib/store';
import { Icon } from '@/ui/Icon';
import { LineChart, MeterList, ScoreRing } from '@/ui/charts';
import { Btn, Card, Chip, Divider, Notice, Row, Status, T, Tile } from '@/ui/kit';
import { font, useTheme } from '@/ui/theme';
import { Passage, Transcript } from './Transcript';

function Note({ note }: { note: Pick<CoachNote, 'tone' | 'title' | 'detail'> }) {
  const t = useTheme();
  const win = note.tone === 'win';
  return (
    <View style={{ flexDirection: 'row', gap: 10 }}>
      <View
        style={{ width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center', backgroundColor: win ? t.good : t.surface2 }}
      >
        <Icon name={win ? 'check' : 'arrow-right'} size={13} strokeWidth={3} color={win ? '#ffffff' : t.ink} />
      </View>
      <View style={{ flex: 1, gap: 2 }}>
        <T v="strong">{note.title}</T>
        <T v="small" style={{ fontSize: 14, lineHeight: 20 }}>
          {note.detail}
        </T>
      </View>
    </View>
  );
}

function PartPlayer({ uri }: { uri: string }) {
  const player = useAudioPlayer(uri);
  const status = useAudioPlayerStatus(player);
  const toggle = () => {
    if (status.playing) {
      player.pause();
      return;
    }
    const atEnd = status.duration > 0 && status.currentTime >= status.duration - 0.1;
    if (atEnd) void player.seekTo(0).then(() => player.play());
    else player.play();
  };
  return (
    <Row>
      <Btn kind="secondary" icon={status.playing ? 'pause' : 'play'} label={status.playing ? 'Pause' : 'Play recording'} onPress={toggle} />
      <T v="small">
        {clock(status.currentTime)} / {clock(status.duration)}
      </T>
    </Row>
  );
}

/** Plays back the recording. A long take can be saved in more than one part. */
function Recording({ uris }: { uris: string[] }) {
  const [part, setPart] = useState(0);
  useEffect(() => {
    // After a take the audio session is still set up for the microphone.
    void setAudioModeAsync({ playsInSilentMode: true, allowsRecording: false }).catch(() => undefined);
  }, []);
  return (
    <View style={{ gap: 10 }}>
      {uris.length > 1 && (
        <Row wrap>
          {uris.map((uri, i) => (
            <Chip key={uri} label={`Part ${i + 1}`} selected={i === part} onPress={() => setPart(i)} />
          ))}
        </Row>
      )}
      <PartPlayer key={uris[part]} uri={uris[part]!} />
    </View>
  );
}

interface TakeReportProps {
  take: StoredTake;
  /** Start practising a follow-up question. */
  onFollowUp?: (question: string) => void;
}

export function TakeReport({ take, onFollowUp }: TakeReportProps) {
  const settings = useStore((s) => s.settings);
  const takes = useStore((s) => s.takes);
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
  const audio = Platform.OS !== 'web' && take.audio?.length ? take.audio : null;
  const otherNotes = [...fixes.slice(1, 4), ...wins.slice(0, 3)];

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
    <View style={{ gap: 16 }}>
      <Card>
        <Row style={{ gap: 18 }}>
          <ScoreRing value={a.overall} />
          <View style={{ flex: 1, gap: 8 }}>
            {band && <Status level={band.level} label={band.label} />}
            {delta != null && delta !== 0 && <DeltaLine delta={delta} />}
            <T v="h2">{verdict}</T>
          </View>
        </Row>
        {voiceOnly ? (
          <T v="small">Speech recognition needs an internet connection on most devices. Without it you still get pauses and the recording.</T>
        ) : (
          !a.sufficient && <T v="small">Check that the microphone is picking you up, then speak for at least ten seconds.</T>
        )}
      </Card>

      {focus && (
        <Card strong>
          <T v="eyebrow">Fix this first</T>
          <T v="h2">{focus.title}</T>
          <T muted>{focus.detail}</T>
        </Card>
      )}

      {a.goals.length > 0 && (
        <Card>
          <Row style={{ justifyContent: 'space-between' }}>
            <T v="h3">Targets</T>
            <T v="small">
              {a.goals.filter((g) => g.met).length} of {a.goals.length} met
            </T>
          </Row>
          {a.goals.map((goal) => (
            <View key={goal.label} style={{ gap: 2 }}>
              <Divider />
              <Row style={{ paddingTop: 8, alignItems: 'flex-start' }}>
                <Status level={goal.met ? 'good' : 'bad'} label={goal.met ? 'Met' : 'Missed'} />
                <View style={{ flex: 1 }}>
                  <T>{goal.label}</T>
                  <T v="small">{goal.detail}</T>
                </View>
              </Row>
            </View>
          ))}
        </Card>
      )}

      {a.sufficient && (
        <Row wrap style={{ gap: 10, alignItems: 'stretch' }}>
          {isRead && a.read ? (
            <Tile
              label="Accuracy"
              value={String(Math.round(a.read.accuracy * 100))}
              unit="%"
              sub={a.read.missed.length ? `${a.read.missed.length} ${a.read.missed.length === 1 ? 'word' : 'words'} not heard` : 'Every word heard'}
            />
          ) : (
            <Tile label="Fillers" value={String(a.fillers)} sub={a.fillers ? `${a.fillersPerMin.toFixed(1)} a minute` : 'None at all'} />
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
                : 'Not measured on this device'
            }
          />
          <Tile label="Length" value={clock(a.speakingSec)} sub={`${a.words} words`} />
        </Row>
      )}

      {otherNotes.length > 0 && (
        <Card style={{ gap: 14 }}>
          <T v="h3">Coach notes</T>
          {otherNotes.map((note) => (
            <Note key={note.title} note={note} />
          ))}
        </Card>
      )}

      {skillRows.length > 0 && (
        <Card style={{ gap: 14 }}>
          <T v="h3">Skills in this take</T>
          <MeterList rows={skillRows} />
        </Card>
      )}

      {a.steps && framework && (
        <Card style={{ gap: 14 }}>
          <View>
            <T v="h3">{framework.name}: where your words went</T>
            <T v="small">Words spoken in each step</T>
          </View>
          <MeterList
            labelWidth={104}
            max={Math.max(1, ...a.steps.map((s) => s.words))}
            rows={a.steps.map((step, i) => ({ label: `${i + 1}. ${step.label}`, value: step.words, figure: `${step.words} · ${Math.round(step.sec)}s` }))}
          />
        </Card>
      )}

      {pacePoints.length >= 3 && a.scores.pace != null && (
        <Card>
          <View>
            <T v="h3">Pace through the take</T>
            <T v="small">Words per minute over a rolling twelve seconds. Touch the chart to read a value.</T>
          </View>
          <LineChart
            points={pacePoints}
            description="Speaking pace over the course of the take"
            xName="Time"
            yName="Words per minute"
            unit="wpm"
            include={[100, 200]}
            band={{ from: settings.paceMin, to: settings.paceMax, label: `Target ${settings.paceMin}–${settings.paceMax}` }}
          />
        </Card>
      )}

      {(capture.transcript || audio) && (
        <Card style={{ gap: 12 }}>
          <View>
            <T v="h3">{isRead ? 'The passage' : 'What you said'}</T>
            <T v="small">{isRead ? 'Words that were not heard clearly are underlined' : 'Tap a label to hide its marks, or a marked word to see why'}</T>
          </View>
          {isRead && exercise.readText ? (
            <Passage text={exercise.readText} hits={a.read?.hits} size={18} />
          ) : (
            capture.transcript !== '' && <Transcript text={capture.transcript} options={flagOptions} />
          )}
          {audio && <Recording uris={audio} />}
          {!isRead && capture.transcript !== '' && (
            <T v="small">
              Speech recognition tidies as it listens and often drops a quiet “um” or “uh”.
              {audio ? ' Play the recording back to catch the ones it missed.' : ''}
            </T>
          )}
        </Card>
      )}

      {!isRead && a.sufficient && !voiceOnly && <AiCoach take={take} apiKey={settings.apiKey} onFollowUp={onFollowUp} />}
    </View>
  );
}

function DeltaLine({ delta }: { delta: number }) {
  const t = useTheme();
  const up = delta > 0;
  const color = up ? t.goodInk : t.criticalInk;
  return (
    <Row style={{ gap: 4 }}>
      <Icon name={up ? 'arrow-up' : 'arrow-down'} size={14} strokeWidth={2.5} color={color} />
      <Text style={{ fontFamily: font.bold, fontSize: 13, color }}>
        {Math.abs(delta)} {up ? 'up on' : 'down on'} your last attempt
      </Text>
    </Row>
  );
}

function AiCoach({ take, apiKey, onFollowUp }: { take: StoredTake; apiKey: string; onFollowUp?: (q: string) => void }) {
  const t = useTheme();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // Read feedback from the store: the take passed in may be a copy made before the coach replied.
  const stored = useStore((s) => s.takes.find((x) => x.id === take.id)?.ai);
  const feedback = stored ?? take.ai;

  const run = async () => {
    setBusy(true);
    setError(null);
    try {
      attachAiFeedback(take.id, await coachTake(apiKey, take.exercise, take.capture.transcript, take.analysis));
    } catch (e) {
      setError(coachErrorMessage(e, 'Something went wrong asking the coach.'));
    } finally {
      setBusy(false);
    }
  };

  if (!feedback) {
    return (
      <Card>
        <T v="h3">AI coach</T>
        <T v="small" style={{ fontSize: 14, lineHeight: 20 }}>
          {apiKey
            ? 'Feedback on your content: structure, specifics, word choice, and a tighter version of your answer.'
            : 'Add an Anthropic API key in Settings to get feedback on your content and a tighter version of your answer.'}
        </T>
        {error && <Notice error text={error} />}
        <Row>
          {apiKey ? (
            <Btn kind="secondary" icon="sparkles" label={busy ? 'Reviewing…' : 'Review my answer'} busy={busy} onPress={run} />
          ) : (
            <Btn kind="secondary" label="Open Settings" onPress={() => router.navigate('/settings')} />
          )}
        </Row>
      </Card>
    );
  }

  return (
    <Card style={{ gap: 12 }}>
      <View>
        <T v="h3">AI coach</T>
        <T v="small">On your content, from the transcript</T>
      </View>
      <T v="h2">{feedback.headline}</T>

      {feedback.strengths.length > 0 && (
        <View style={{ gap: 6 }}>
          <T v="eyebrow">What worked</T>
          {feedback.strengths.map((strength) => (
            <Note key={strength} note={{ tone: 'win', title: strength, detail: '' }} />
          ))}
        </View>
      )}

      {feedback.improvements.length > 0 && (
        <View style={{ gap: 10 }}>
          <T v="eyebrow">What to change</T>
          {feedback.improvements.map((item) => (
            <Note key={item.issue} note={{ tone: 'fix', title: item.issue, detail: item.fix }} />
          ))}
        </View>
      )}

      {feedback.rewrite !== '' && (
        <View style={{ gap: 6 }}>
          <T v="eyebrow">A tighter version, in your words</T>
          <View style={{ padding: 14, borderLeftWidth: 3, borderLeftColor: t.accent, borderRadius: 4, backgroundColor: t.surface2 }}>
            <Text style={{ fontFamily: font.serif, fontSize: 17, lineHeight: 27, color: t.ink }}>{feedback.rewrite}</Text>
          </View>
          <T v="small">Read it aloud once, then try the prompt again without looking.</T>
        </View>
      )}

      {feedback.followUp !== '' && (
        <View style={{ gap: 8 }}>
          <T v="eyebrow">A listener might ask next</T>
          <Text style={{ fontFamily: font.serif, fontSize: 19, lineHeight: 26, color: t.ink }}>{feedback.followUp}</Text>
          {onFollowUp && (
            <Row>
              <Btn kind="secondary" icon="mic" label="Answer it" onPress={() => onFollowUp(feedback.followUp)} />
            </Row>
          )}
        </View>
      )}
    </Card>
  );
}
