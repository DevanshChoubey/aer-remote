import * as SplashScreen from 'expo-splash-screen';
import { useEffect, type ReactElement, type ReactNode } from 'react';

import { ServicesProvider, type Services } from '@/core';
import { ThemeProvider, useThemePreference } from '@/theme';

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

export function AppProviders(props: { services: Services; children: ReactNode }): ReactElement {
  return (
    <ServicesProvider services={props.services}>
      <ThemeProvider initialPreference="system">
        <SplashGate>{props.children}</SplashGate>
      </ThemeProvider>
    </ServicesProvider>
  );
}
