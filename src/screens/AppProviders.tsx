import * as SplashScreen from 'expo-splash-screen';
import { useCallback, useEffect, useState, type ReactElement, type ReactNode } from 'react';
import { AppState } from 'react-native';

import { ServicesProvider, type Services, type ThemePreferenceStore } from '@/core';
import { ThemeProvider, useThemePreference, type ThemePreference } from '@/theme';

const THEME_LOAD_TIMEOUT_MS = 1500;

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
  const { preferences, services } = props;
  // A backgrounded app must not keep holding the dispenser's single connection slot.
  useEffect(() => {
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'background') void services.client.closeAll();
    });
    return () => sub.remove();
  }, [services]);
  const [initial, setInitial] = useState<ThemePreference | null>(preferences ? null : 'system');
  useEffect(() => {
    if (!preferences) return;
    let alive = true;
    // A stuck storage must not keep the splash up: fall back to the system theme after a moment.
    const timer = setTimeout(() => {
      if (alive) setInitial((cur) => cur ?? 'system');
    }, THEME_LOAD_TIMEOUT_MS);
    void preferences.load().then((p) => {
      if (alive) setInitial((cur) => cur ?? p);
    });
    return () => {
      alive = false;
      clearTimeout(timer);
    };
  }, [preferences]);
  const save = useCallback(
    (p: ThemePreference): void => {
      preferences?.save(p).catch((e: unknown) => console.warn('Could not save the theme', e));
    },
    [preferences],
  );
  // Render nothing (the splash stays up) until the saved preference is known: no flash.
  if (initial === null) return null;
  return (
    <ServicesProvider services={services}>
      <ThemeProvider
        initialPreference={initial}
        onPreferenceChange={preferences ? save : undefined}
      >
        <SplashGate>{props.children}</SplashGate>
      </ThemeProvider>
    </ServicesProvider>
  );
}
