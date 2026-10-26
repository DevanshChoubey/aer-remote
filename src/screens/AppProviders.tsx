import * as SplashScreen from 'expo-splash-screen';
import { useEffect, useState, type ReactElement, type ReactNode } from 'react';

import { ServicesProvider, type Services, type ThemePreferenceStore } from '@/core';
import { ThemeProvider, useThemePreference, type ThemePreference } from '@/theme';

/** Holds the native splash screen up until the fonts are ready, then hides it. */
function SplashGate({ children }: { children: ReactNode }): ReactElement {
  const { fontsReady } = useThemePreference();
  useEffect(() => {
    if (fontsReady) {
      SplashScreen.hideAsync().catch((e: unknown) => console.warn('Could not hide splash', e));
    }
  }, [fontsReady]);
  return <>{children}</>;
}

export function AppProviders(props: {
  services: Services;
  children: ReactNode;
  /** Where the theme choice is saved. Without it the app follows the system and saves nothing. */
  preferences?: ThemePreferenceStore;
}): ReactElement | null {
  const { preferences } = props;
  const [initial, setInitial] = useState<ThemePreference | null>(preferences ? null : 'system');
  useEffect(() => {
    if (!preferences) return;
    let alive = true;
    void preferences.load().then((p) => {
      if (alive) setInitial(p);
    });
    return () => {
      alive = false;
    };
  }, [preferences]);
  // Render nothing (the splash stays up) until the saved preference is known: no flash.
  if (initial === null) return null;
  const save = preferences
    ? (p: ThemePreference): void => {
        preferences.save(p).catch((e: unknown) => console.warn('Could not save the theme', e));
      }
    : undefined;
  return (
    <ServicesProvider services={props.services}>
      <ThemeProvider initialPreference={initial} onPreferenceChange={save}>
        <SplashGate>{props.children}</SplashGate>
      </ThemeProvider>
    </ServicesProvider>
  );
}
