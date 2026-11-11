import { router } from 'expo-router';
import { Pressable, Text, View } from 'react-native';
import { when } from '@core/format';
import type { StoredTake } from '@/lib/store';
import { Icon } from '@/ui/Icon';
import { T } from '@/ui/kit';
import { font, useTheme } from '@/ui/theme';

export function TakeList({ takes }: { takes: StoredTake[] }) {
  const t = useTheme();
  return (
    <View>
      {takes.map((take, i) => {
        const a = take.analysis;
        const title = take.exercise.mode === 'read' ? (take.exercise.readText ?? take.exercise.prompt) : take.exercise.prompt;
        const facts = [when(take.at), take.exercise.title];
        if (a.wpm != null) facts.push(`${a.wpm} wpm`);
        if (a.sufficient && take.exercise.mode === 'speak') facts.push(a.fillers === 1 ? '1 filler' : `${a.fillers} fillers`);
        return (
          <Pressable
            key={take.id}
            accessibilityRole="button"
            accessibilityLabel={`${title}. ${facts.join(', ')}. ${a.overall != null ? `Score ${a.overall}` : 'Not scored'}`}
            onPress={() => router.push({ pathname: '/review/[id]', params: { id: take.id } })}
            style={{ flexDirection: 'row', alignItems: 'center', gap: 12, paddingVertical: 12, borderTopWidth: i ? 1 : 0, borderTopColor: t.border }}
          >
            <View style={{ flex: 1 }}>
              <T numberOfLines={1} style={{ fontFamily: font.medium }}>
                {title}
              </T>
              <T v="small" numberOfLines={1}>
                {facts.join(' · ')}
              </T>
            </View>
            <Text style={{ fontFamily: font.bold, fontSize: 18, color: t.ink }}>{a.overall ?? '–'}</Text>
            <Icon name="chevron-right" size={18} color={t.muted} />
          </Pressable>
        );
      })}
    </View>
  );
}
