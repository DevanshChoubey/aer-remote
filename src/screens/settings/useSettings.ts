import { useCallback, useState } from 'react';

import { useServices } from '@/core';
import { errorCopyKey } from '@/screens/errorCopy';

import { useDispensers } from '../home/useDispensers';

export function useSettings(): {
  dispensers: ReturnType<typeof useDispensers>['dispensers'];
  setZone: (id: string, zone: string) => Promise<boolean>;
  errorKey: string | null;
} {
  const { client } = useServices();
  const { dispensers } = useDispensers();
  const [errorKey, setErrorKey] = useState<string | null>(null);
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
  return { dispensers, setZone, errorKey };
}
