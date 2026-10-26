import { useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import { t } from '@/i18n';
import { Button, Column, EmptyState, Screen, Txt } from '@/ui';

import { DispenserTile } from './DispenserTile';
import { useDispensers } from './useDispensers';

export function HomeScreen(): ReactElement {
  const router = useRouter();
  const { dispensers, loaded, failed } = useDispensers();
  const now = new Date();
  const add = (
    <Button label={t('home.addDispenser')} onPress={() => router.push('/add')} icon="+" />
  );
  return (
    <Screen title={t('home.title')} scroll>
      {failed ? <Txt color="warn">{t('home.loadFailed')}</Txt> : null}
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
