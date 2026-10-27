import { useLocalSearchParams, useRouter } from 'expo-router';
import type { ReactElement } from 'react';

import type { Interval, Weekday } from '@/core';
import { t } from '@/i18n';
import { Button, Card, Chip, Column, Row, Screen, Txt } from '@/ui';

import { formatClock, WEEKDAYS, WEEKEND, WORKDAYS } from './format';
import { problemCopy } from './problemCopy';
import { TimeStepper } from './TimeStepper';
import { useScheduleDraft } from './useScheduleDraft';

const INTERVALS: Interval[] = [10, 20, 40];

const PRESETS: { key: string; days: readonly Weekday[] }[] = [
  { key: 'schedule.everyDay', days: WEEKDAYS },
  { key: 'schedule.weekdays', days: WORKDAYS },
  { key: 'schedule.weekends', days: WEEKEND },
];

const isPreset = (current: readonly Weekday[], days: readonly Weekday[]): boolean =>
  current.length === days.length && days.every((d) => current.includes(d));

export function ScheduleEditor(): ReactElement {
  const router = useRouter();
  const params = useLocalSearchParams<{ id: string; index?: string }>();
  const id = String(params.id);
  const parsed = params.index === undefined ? undefined : Number(params.index);
  const valid = parsed !== undefined && Number.isInteger(parsed) && parsed >= 0;
  const index = valid ? parsed : undefined;
  const badIndex = parsed !== undefined && !valid;
  const d = useScheduleDraft(id, index);

  const back = (): void => router.back();
  const title = t(d.isNew ? 'schedule.titleNew' : 'schedule.titleEdit');

  if (badIndex || d.stale) {
    return (
      <Screen title={title} onBack={back}>
        <Txt>{t('schedule.missing')}</Txt>
      </Screen>
    );
  }
  if (!d.loaded) {
    return (
      <Screen title={title} onBack={back}>
        <Txt color="muted">{t('common.loading')}</Txt>
      </Screen>
    );
  }
  if (d.missing) {
    return (
      <Screen title={title} onBack={back}>
        <Txt>{t('dispenser.notFound')}</Txt>
      </Screen>
    );
  }
  if (d.unknown) {
    return (
      <Screen title={title} onBack={back}>
        <Txt>{t('schedule.unknown')}</Txt>
        {d.errorKey ? <Txt color="warn">{t(d.errorKey)}</Txt> : null}
        <Button
          label={t('schedule.refresh')}
          onPress={() => void d.refresh()}
          disabled={d.refreshing}
          loading={d.refreshing}
        />
      </Screen>
    );
  }
  const onSave = async (): Promise<void> => {
    if ((await d.save()) === 'done') back();
  };
  const onDelete = async (): Promise<void> => {
    if (await d.remove()) back();
  };

  return (
    <Screen title={title} scroll onBack={back}>
      <Column gap={4}>
        <Card>
          <TimeStepper label={t('schedule.start')} value={d.draft.start} onChange={d.setStart} />
          <TimeStepper label={t('schedule.end')} value={d.draft.end} onChange={d.setEnd} />
        </Card>
        <Card>
          <Txt variant="bodyBold">{t('schedule.days')}</Txt>
          <Row gap={2} wrap>
            {PRESETS.map((p) => (
              <Chip
                key={p.key}
                label={t(p.key)}
                state={isPreset(d.draft.days, p.days) ? 'selected' : 'neutral'}
                onToggle={() => d.setDays(p.days)}
              />
            ))}
          </Row>
          <Row gap={2} wrap>
            {WEEKDAYS.map((day) => (
              <Chip
                key={day}
                label={t(`schedule.${day}`)}
                state={d.draft.days.includes(day) ? 'selected' : 'neutral'}
                onToggle={() => d.toggleDay(day)}
              />
            ))}
          </Row>
        </Card>
        <Card>
          <Txt variant="bodyBold">{t('schedule.interval')}</Txt>
          <Row gap={2} wrap>
            {INTERVALS.map((n) => (
              <Chip
                key={n}
                label={t('schedule.intervalMinutes', { minutes: n })}
                state={d.draft.interval === n ? 'selected' : 'neutral'}
                onToggle={() => d.setInterval(n)}
              />
            ))}
          </Row>
        </Card>
        {d.problems.length === 0 ? (
          <Txt color="muted">{t('schedule.sprayEstimate', { count: d.sprays })}</Txt>
        ) : (
          <Column gap={1}>
            {d.problems.map((p) => (
              <Txt key={p} color="warn">
                {problemCopy(p)}
              </Txt>
            ))}
          </Column>
        )}
        {d.roundedEnd ? (
          <Txt variant="bodyBold">{t('schedule.rounded', { time: formatClock(d.roundedEnd) })}</Txt>
        ) : null}
        {d.errorKey ? <Txt color="warn">{t(d.errorKey)}</Txt> : null}
        {d.saving ? <Txt color="muted">{t('schedule.saving')}</Txt> : null}
        {d.roundedEnd ? (
          <Button label={t('common.done')} onPress={back} />
        ) : (
          <Button
            label={t('schedule.save')}
            onPress={() => void onSave()}
            disabled={!d.canSave}
            loading={d.saving}
          />
        )}
        {!d.isNew ? (
          <Button
            variant="secondary"
            label={t('schedule.delete')}
            onPress={() => void onDelete()}
            disabled={d.saving}
          />
        ) : null}
        <Button variant="ghost" label={t('common.cancel')} onPress={back} />
      </Column>
    </Screen>
  );
}
