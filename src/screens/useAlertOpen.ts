import { useRouter } from 'expo-router';
import { useEffect } from 'react';

import { useServices } from '@/core';

/** Opens the dispenser a tapped alert is about, or goes home when it has since been removed. */
export function useAlertOpen(): void {
  const router = useRouter();
  const { alerts } = useServices();
  useEffect(
    () =>
      alerts.onOpen((id) => {
        if (id === null) router.replace('/');
        else router.push(`/dispenser/${id}`);
      }),
    [alerts, router],
  );
}
