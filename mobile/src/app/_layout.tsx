import { DMSans_400Regular } from '@expo-google-fonts/dm-sans/400Regular';
import { DMSans_500Medium } from '@expo-google-fonts/dm-sans/500Medium';
import { DMSans_600SemiBold } from '@expo-google-fonts/dm-sans/600SemiBold';
import { Fraunces_500Medium } from '@expo-google-fonts/fraunces/500Medium';
import { Fraunces_500Medium_Italic } from '@expo-google-fonts/fraunces/500Medium_Italic';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect, useState } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { hydrate } from '@/lib/store';
import { useTheme } from '@/ui/theme';

// Keep the splash screen up until fonts and saved progress are ready.
void SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded, fontError] = useFonts({
    DMSans_400Regular,
    DMSans_500Medium,
    DMSans_600SemiBold,
    Fraunces_500Medium,
    Fraunces_500Medium_Italic,
  });
  const [restored, setRestored] = useState(false);
  const theme = useTheme();

  useEffect(() => {
    void hydrate().finally(() => setRestored(true));
  }, []);

  const ready = restored && (fontsLoaded || fontError != null);
  useEffect(() => {
    if (ready) void SplashScreen.hideAsync().catch(() => undefined);
  }, [ready]);

  if (!ready) return null;

  return (
    <SafeAreaProvider>
      <StatusBar style={theme.dark ? 'light' : 'dark'} />
      <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.page } }}>
        <Stack.Screen name="(tabs)" />
        {/* A take should not be dismissed by an accidental swipe. */}
        <Stack.Screen name="session" options={{ gestureEnabled: false, animation: 'fade' }} />
        <Stack.Screen name="review/[id]" />
      </Stack>
    </SafeAreaProvider>
  );
}
