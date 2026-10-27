import type { ReactElement } from 'react';

import {
  batteryPercent,
  isBatteryTooLow,
  nextSprayToday,
  refillPercent,
  runsToday,
  type SavedDispenser,
} from '@/core';
import { t } from '@/i18n';
import { Card, Row, StatusBadge, Touchable, Txt } from '@/ui';

import { formatTimeOfDay, formatWhen } from './format';

export interface DispenserTileProps {
  dispenser: SavedDispenser;
  now: Date;
  onOpen: () => void;
}

const LOW_BATTERY_PERCENT = 20;
const LOW_REFILL_PERCENT = 20;

export function DispenserTile({ dispenser, now, onOpen }: DispenserTileProps): ReactElement {
  const { lastStatus, schedules } = dispenser;
  const battery = lastStatus ? batteryPercent(lastStatus.batteryMv) : null;
  const refill = lastStatus ? refillPercent(lastStatus.spraysSinceRefill) : null;
  const tooLow = lastStatus ? isBatteryTooLow(lastStatus.batteryMv) : false;
  const lowSoon = !tooLow && battery !== null && battery <= LOW_BATTERY_PERCENT;
  let nextLine: string | null = null;
  if (schedules) {
    const next = nextSprayToday(schedules.list, now, dispenser.homeTimeZone);
    nextLine = next
      ? t('home.nextSpray', { time: formatTimeOfDay(next) })
      : runsToday(schedules.list, now, dispenser.homeTimeZone)
        ? t('home.doneForToday')
        : t('home.noSchedule');
  }
  const checked = lastStatus
    ? t('home.lastChecked', { when: formatWhen(lastStatus.at, now) })
    : t('home.notChecked');
  const warning = tooLow ? t('errors.batteryTooLow') : lowSoon ? t('home.batteryLowSoon') : null;
  const clockHint = dispenser.clockSet === false ? t('home.clockHint') : null;

  const spoken = [
    t('home.openDispenser', { name: dispenser.name }),
    battery !== null
      ? t('common.levelLabel', {
          name: t('common.battery'),
          percent: battery,
          state: t(battery <= LOW_BATTERY_PERCENT ? 'common.levelLow' : 'common.levelOk'),
        })
      : null,
    refill !== null
      ? t('common.levelLabel', {
          name: t('common.refill'),
          percent: refill,
          state: t(refill <= LOW_REFILL_PERCENT ? 'common.levelLow' : 'common.levelOk'),
        })
      : null,
    nextLine,
    warning,
    clockHint,
    checked,
  ]
    .filter((p): p is string => p !== null)
    .join('. ');

  return (
    <Touchable onPress={onOpen} accessibilityLabel={spoken}>
      <Card>
        <Txt variant="heading">{dispenser.name}</Txt>
        {battery !== null && refill !== null ? (
          <Row gap={2} wrap>
            <StatusBadge kind="battery" percent={battery} />
            <StatusBadge kind="refill" percent={refill} />
          </Row>
        ) : null}
        {nextLine ? <Txt variant="bodyBold">{nextLine}</Txt> : null}
        {warning ? (
          <Txt variant="bodyBold" color="warn">
            {warning}
          </Txt>
        ) : null}
        {clockHint ? <Txt color="muted">{clockHint}</Txt> : null}
        <Txt variant="caption" color="muted">
          {checked}
        </Txt>
      </Card>
    </Touchable>
  );
}
