import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';

import { useServices, type AlertPermission } from '@/core';
import { errorCopyKey } from '@/screens/errorCopy';

import { useDispensers } from '../home/useDispensers';

export function useSettings(): {
  dispensers: ReturnType<typeof useDispensers>['dispensers'];
  setZone: (id: string, zone: string) => Promise<boolean>;
  errorKey: string | null;
  alertsOn: boolean;
  alertPermission: AlertPermission;
  setAlertsOn: (on: boolean) => Promise<void>;
} {
  const { client, alerts } = useServices();
  const { dispensers } = useDispensers();
  const [errorKey, setErrorKey] = useState<string | null>(null);
  const [alertsOn, setOn] = useState(true);
  const [alertPermission, setPermission] = useState<AlertPermission>('undetermined');
  const setZone = useCallback(
    async (id: string, zone: string): Promise<boolean> => {
      setErrorKey(null);
      try {
        await client.setHomeTimeZone(id, zone);
        return true;
      } catch (e) {
        setErrorKey(errorCopyKey(e));
        return false;
      }
    },
    [client],
  );
  const read = useCallback(async (): Promise<{ on: boolean; permission: AlertPermission }> => {
    const [on, permission] = await Promise.all([alerts.enabled(), alerts.permission()]);
    return { on, permission };
  }, [alerts]);
  useEffect(() => {
    let alive = true;
    const load = (): void => {
      read()
        .then(({ on, permission }) => {
          if (!alive) return;
          setOn(on);
          setPermission(permission);
        })
        .catch((e: unknown) => console.warn('Could not read the alert settings', e));
    };
    load();
    // Coming back from the phone settings may have changed the permission.
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') load();
    });
    return () => {
      alive = false;
      sub.remove();
    };
  }, [read]);
  const setAlertsOn = useCallback(
    async (on: boolean): Promise<void> => {
      try {
        await alerts.setEnabled(on);
        // Turning on may have raised the permission prompt, so read both again.
        const next = await read();
        setOn(next.on);
        setPermission(next.permission);
      } catch (e) {
        console.warn('Could not change the alert setting', e);
      }
    },
    [alerts, read],
  );
  return { dispensers, setZone, errorKey, alertsOn, alertPermission, setAlertsOn };
}
