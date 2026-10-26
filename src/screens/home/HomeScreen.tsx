import { useFocusEffect, useRouter } from 'expo-router';
import { useCallback, useEffect, useState, type ReactElement } from 'react';

import { t } from '@/i18n';
import { Button, Column, EmptyState, Row, Screen, Txt } from '@/ui';

import { DispenserTile } from './DispenserTile';
import { useDispensers } from './useDispensers';

const CLOCK_REFRESH_MS = 60_000;

export function HomeScreen(): ReactElement {
  const router = useRouter();
  const { dispensers, loaded, failed, reload } = useDispensers();
  // "Last checked" and "next spray" age, so refresh the clock on focus and every minute.
  const [now, setNow] = useState(() => new Date());
  useFocusEffect(
    useCallback(() => {
      setNow(new Date());
      return undefined;
    }, []),
  );
  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), CLOCK_REFRESH_MS);
    return () => clearInterval(timer);
  }, []);
  const add = (
    <Button label={t('home.addDispenser')} onPress={() => router.push('/add')} icon="+" />
  );
  return (
    <Screen title={t('home.title')} scroll>
      <Row justify="end">
        <Button
          variant="ghost"
          label={t('home.settings')}
          onPress={() => router.push('/settings')}
        />
      </Row>
      {failed ? (
        <Column gap={3}>
          <Txt color="warn">{t('home.loadFailed')}</Txt>
          <Button variant="secondary" label={t('common.retry')} onPress={reload} />
          {dispensers.length === 0 ? add : null}
        </Column>
      ) : null}
      {loaded && dispensers.length === 0 && !failed ? (
        <EmptyState title={t('home.emptyTitle')} body={t('home.emptyBody')} action={add} />
      ) : null}
      {dispensers.length > 0 ? (
        <Column gap={4}>
          {dispensers.map((d) => (
            <DispenserTile
              key={d.id}
              dispenser={d}
              now={now}
              onOpen={() => router.push(`/dispenser/${d.id}`)}
            />
          ))}
          {add}
        </Column>
      ) : null}
      {__DEV__ ? (
        <Button
          variant="ghost"
          label={t('home.devSpike')}
          onPress={() => router.push('/dev/spike')}
        />
      ) : null}
    </Screen>
  );
}
