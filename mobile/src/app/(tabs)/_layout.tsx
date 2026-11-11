import { Tabs } from 'expo-router/js-tabs';
import { Platform } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { Icon } from '@/ui/Icon';
import { font, useTheme } from '@/ui/theme';

const TABS = [
  { name: 'index', title: 'Today', icon: 'sun' },
  { name: 'practice', title: 'Practice', icon: 'mic' },
  { name: 'progress', title: 'Progress', icon: 'trend' },
  { name: 'learn', title: 'Learn', icon: 'book' },
  { name: 'settings', title: 'Settings', icon: 'sliders' },
];

export default function TabsLayout() {
  const t = useTheme();
  const insets = useSafeAreaInsets();
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: t.ink,
        tabBarInactiveTintColor: t.muted,
        // On phones the navigator sizes the bar itself. In a browser its default is too
        // short for an icon above a label, so give it room there.
        tabBarStyle: {
          backgroundColor: t.page,
          borderTopColor: t.border,
          ...(Platform.OS === 'web' ? { height: 68 + insets.bottom, paddingTop: 6, paddingBottom: insets.bottom + 6 } : null),
        },
        tabBarLabelStyle: { fontFamily: font.bold, fontSize: 11 },
        sceneStyle: { backgroundColor: t.page },
      }}
    >
      {TABS.map((tab) => (
        <Tabs.Screen
          key={tab.name}
          name={tab.name}
          options={{ title: tab.title, tabBarIcon: ({ color, size }) => <Icon name={tab.icon} size={size} color={String(color)} /> }}
        />
      ))}
    </Tabs>
  );
}
