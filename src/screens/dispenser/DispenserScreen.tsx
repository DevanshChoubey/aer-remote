import { useLocalSearchParams, useRouter } from 'expo-router';
import { useState, type ReactElement } from 'react';
import { Alert } from 'react-native';

import {
  batteryPercent,
  isBatteryTooLow,
  MAX_SCHEDULES,
  refillPercent,
  sprayCount,
  type Interval,
} from '@/core';
import { t } from '@/i18n';
import {
  Button,
  Card,
  Chip,
  Column,
  Input,
  Row,
  Screen,
  StatusBadge,
  Toggle,
  Touchable,
  Txt,
} from '@/ui';

import { formatSchedule } from '../schedule/format';
import { useDispenser } from './useDispenser';

const INTERVALS: Interval[] = [10, 20, 40];
const DEFAULT_AUTO: Interval = 20;

export function DispenserScreen(): ReactElement {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const v = useDispenser(String(id));
  const [menu, setMenu] = useState(false);
  const [renaming, setRenaming] = useState<string | null>(null);

  const back = <Button variant="ghost" label={t('common.back')} onPress={() => router.back()} />;
  const { dispenser } = v;
  if (v.missing || !dispenser) {
    return (
      <Screen title={v.missing ? t('dispenser.notFoundTitle') : t('common.loading')}>
        {v.missing ? <Txt>{t('dispenser.notFound')}</Txt> : null}
        {v.missing ? back : null}
      </Screen>
    );
  }

  const { lastStatus, schedules } = dispenser;
  const battery = lastStatus ? batteryPercent(lastStatus.batteryMv) : null;
  const refill = lastStatus ? refillPercent(lastStatus.spraysSinceRefill) : null;
  const tooLow = lastStatus ? isBatteryTooLow(lastStatus.batteryMv) : false;
  const auto = lastStatus?.autoSpray ?? null;
  const idle = v.busy === null;
  const list = schedules?.list;

  const confirmRefill = (): void => {
    Alert.alert(t('dispenser.refillConfirmTitle'), t('dispenser.refillResetConfirm'), [
      { text: t('common.cancel'), style: 'cancel' },
      { text: t('dispenser.refillConfirmAction'), onPress: () => void v.resetRefill() },
    ]);
  };
  const confirmRemove = (): void => {
    Alert.alert(
      t('dispenser.removeConfirmTitle'),
      t('dispenser.removeConfirm', { name: dispenser.name }),
      [
        { text: t('common.cancel'), style: 'cancel' },
        {
          text: t('dispenser.removeAction'),
          style: 'destructive',
          onPress: () => {
            void v.remove().then((removed) => {
              if (removed) router.replace('/');
            });
          },
        },
      ],
    );
  };
  const saveName = (): void => {
    const name = (renaming ?? '').trim();
    if (name.length > 0) void v.rename(name);
    setRenaming(null);
  };

  return (
    <Screen title={dispenser.name} scroll>
      <Column gap={4}>
        {back}
        {v.busy === 'refresh' ? <Txt color="muted">{t('dispenser.checking')}</Txt> : null}
        {v.errorKey ? <Txt color="warn">{t(v.errorKey)}</Txt> : null}
        {dispenser.clockSet === false ? <Txt color="muted">{t('home.clockHint')}</Txt> : null}
        {tooLow ? <Txt color="warn">{t('errors.batteryTooLow')}</Txt> : null}

        <Button
          label={v.busy === 'spray' ? t('dispenser.spraying') : t('dispenser.sprayNow')}
          onPress={() => void v.sprayNow()}
          disabled={!idle}
          loading={v.busy === 'spray'}
        />

        <Card>
          <Toggle
            label={t('dispenser.autoSpray')}
            value={auto !== null}
            disabled={!idle}
            onChange={(on) => void v.setAutoSpray(on ? DEFAULT_AUTO : null)}
          />
          <Txt variant="caption" color="muted">
            {auto === null ? t('dispenser.autoOff') : t('dispenser.autoEvery', { minutes: auto })}
          </Txt>
          <Row gap={2} wrap>
            {INTERVALS.map((n) => (
              <Chip
                key={n}
                label={t('dispenser.intervalChip', { minutes: n })}
                state={auto === n ? 'selected' : 'neutral'}
                disabled={!idle}
                onToggle={() => void v.setAutoSpray(n)}
              />
            ))}
          </Row>
        </Card>

        <Card>
          <Txt variant="heading">{t('dispenser.status')}</Txt>
          {battery !== null && refill !== null && lastStatus ? (
            <Column gap={2}>
              <Row gap={2} wrap>
                <StatusBadge kind="battery" percent={battery} />
                <StatusBadge kind="refill" percent={refill} />
              </Row>
              <Txt variant="caption" color="muted">
                {t('dispenser.firmware', { version: lastStatus.firmware })}
              </Txt>
            </Column>
          ) : (
            <Txt color="muted">{t('home.notChecked')}</Txt>
          )}
          <Button
            variant="secondary"
            label={t('dispenser.refillReset')}
            onPress={confirmRefill}
            disabled={!idle}
            loading={v.busy === 'refill'}
          />
        </Card>

        <Card>
          <Txt variant="heading">{t('dispenser.schedules')}</Txt>
          {list === undefined ? (
            <Column gap={2}>
              <Txt color="muted">{t('dispenser.schedulesUnknown')}</Txt>
              <Button
                variant="secondary"
                label={t('dispenser.refresh')}
                onPress={() => void v.refresh()}
                disabled={!idle}
                loading={v.busy === 'refresh'}
              />
            </Column>
          ) : (
            <Column gap={3}>
              {list.length === 0 ? <Txt color="muted">{t('dispenser.noSchedules')}</Txt> : null}
              {list.map((s, i) => (
                <Touchable
                  key={`${i}-${formatSchedule(s)}`}
                  disabled={!idle}
                  accessibilityLabel={t('dispenser.scheduleOpen', { summary: formatSchedule(s) })}
                  onPress={() => router.push(`/dispenser/${dispenser.id}/schedule?index=${i}`)}
                >
                  <Column gap={1}>
                    <Txt variant="bodyBold">{formatSchedule(s)}</Txt>
                    <Txt variant="caption" color="muted">
                      {t('schedule.sprayEstimate', { count: sprayCount(s) })}
                    </Txt>
                  </Column>
                </Touchable>
              ))}
              {list.length < MAX_SCHEDULES ? (
                <Button
                  variant="secondary"
                  icon="+"
                  disabled={!idle}
                  label={t('dispenser.addSchedule')}
                  onPress={() => router.push(`/dispenser/${dispenser.id}/schedule`)}
                />
              ) : null}
            </Column>
          )}
        </Card>

        <Button
          variant="ghost"
          label={t('dispenser.more')}
          accessibilityLabel={t('dispenser.moreOptions')}
          onPress={() => setMenu((m) => !m)}
        />
        {menu ? (
          <Card>
            {renaming === null ? (
              <Column gap={2}>
                <Button
                  variant="secondary"
                  label={t('dispenser.rename')}
                  onPress={() => setRenaming(dispenser.name)}
                />
                <Button
                  variant="secondary"
                  label={t('dispenser.removeDispenser')}
                  onPress={confirmRemove}
                  disabled={!idle}
                />
              </Column>
            ) : (
              <Column gap={2}>
                <Input
                  value={renaming}
                  onChangeText={setRenaming}
                  accessibilityLabel={t('dispenser.renameLabel')}
                  onSubmitEditing={saveName}
                />
                <Button label={t('dispenser.renameSave')} onPress={saveName} />
                <Button
                  variant="ghost"
                  label={t('common.cancel')}
                  onPress={() => setRenaming(null)}
                />
              </Column>
            )}
          </Card>
        ) : null}
      </Column>
    </Screen>
  );
}
