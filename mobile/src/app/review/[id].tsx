import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { View } from 'react-native';
import { buildCustom, repeatPlan } from '@core/content/drills';
import { when } from '@core/format';
import { TakeReport } from '@/features/TakeReport';
import { startPlan } from '@/lib/session';
import { deleteTake, useStore } from '@/lib/store';
import { Btn, Row, Screen, T } from '@/ui/kit';

export default function Review() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const take = useStore((s) => s.takes.find((t) => t.id === id));
  const [confirming, setConfirming] = useState(false);
  if (!take) return <Redirect href="/progress" />;

  const { exercise } = take;
  const back = () => (router.canGoBack() ? router.back() : router.replace('/progress'));
  const remove = () => {
    if (!confirming) {
      setConfirming(true);
      return;
    }
    back();
    deleteTake(take.id);
  };

  return (
    <Screen>
      <Row>
        <Btn kind="ghost" icon="arrow-left" label="Back" onPress={back} style={{ paddingHorizontal: 8 }} />
      </Row>
      <View style={{ gap: 6 }}>
        <T v="eyebrow">
          {exercise.title} · {exercise.tag} · {when(take.at)}
        </T>
        <T v="h2">{exercise.prompt}</T>
      </View>
      <Row wrap>
        <Btn icon="retry" label="Practise this again" onPress={() => startPlan(repeatPlan({ id: '', title: take.planTitle, steps: [exercise] }))} />
        <Btn kind="danger" icon="trash" label={confirming ? 'Tap again to delete' : 'Delete'} onPress={remove} />
      </Row>
      <TakeReport take={take} onFollowUp={(question) => startPlan(buildCustom([question], { speakSec: 60, prepSec: 10, title: 'Follow-up' }))} />
    </Screen>
  );
}
