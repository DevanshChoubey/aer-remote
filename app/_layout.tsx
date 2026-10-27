import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';

import { createServices, createThemePreferenceStore } from '@/core';
import { AppProviders } from '@/screens/AppProviders';
import { useAlertOpen } from '@/screens/useAlertOpen';

SplashScreen.preventAutoHideAsync().catch((e: unknown) => console.warn('Could not hold splash', e));

/** Mounted inside the providers so it can reach the services and the router. */
function AlertLinks(): null {
  useAlertOpen();
  return null;
}

export default function RootLayout(): React.JSX.Element {
  const [services] = useState(() => createServices());
  const [preferences] = useState(() => createThemePreferenceStore());
  return (
    <AppProviders services={services} preferences={preferences}>
      <AlertLinks />
      <Stack screenOptions={{ headerShown: false }} />
    </AppProviders>
  );
}
