import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';

import { createServices, createThemePreferenceStore } from '@/core';
import { AppProviders } from '@/screens/AppProviders';

SplashScreen.preventAutoHideAsync().catch((e: unknown) => console.warn('Could not hold splash', e));

export default function RootLayout(): React.JSX.Element {
  const [services] = useState(() => createServices());
  const [preferences] = useState(() => createThemePreferenceStore());
  return (
    <AppProviders services={services} preferences={preferences}>
      <Stack screenOptions={{ headerShown: false }} />
    </AppProviders>
  );
}
