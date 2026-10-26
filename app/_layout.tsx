import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useState } from 'react';

import { createServices } from '@/core';
import { AppProviders } from '@/screens/AppProviders';

SplashScreen.preventAutoHideAsync().catch((e: unknown) => console.warn('Could not hold splash', e));

export default function RootLayout(): React.JSX.Element {
  const [services] = useState(() => createServices());
  return (
    <AppProviders services={services}>
      <Stack screenOptions={{ headerShown: false }} />
    </AppProviders>
  );
}
