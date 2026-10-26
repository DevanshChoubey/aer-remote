import type { ReactElement } from 'react';
import { t } from '@/i18n';
import type { ColorToken } from '@/theme';
import { Box, Row, Txt } from './primitives';

export interface StatusBadgeProps {
  kind: 'battery' | 'refill';
  /** 0 to 100, as read from the dispenser. */
  percent: number;
  /** At or below this the badge turns to the low (warning) look. */
  lowAt?: number;
}

const LOOK: Record<'ok' | 'low', { bg: ColorToken; text: ColorToken }> = {
  ok: { bg: 'okSoft', text: 'ok' },
  low: { bg: 'warnSoft', text: 'warn' },
};

export function StatusBadge(props: StatusBadgeProps): ReactElement {
  const percent = Math.round(Math.min(100, Math.max(0, props.percent)));
  const level = percent <= (props.lowAt ?? 20) ? 'low' : 'ok';
  const look = LOOK[level];
  const name = t(props.kind === 'battery' ? 'common.battery' : 'common.refill');
  const state = t(level === 'low' ? 'common.levelLow' : 'common.levelOk');
  return (
    <Box
      bg={look.bg}
      radius="pill"
      px={3}
      py={1}
      accessibilityLabel={t('common.levelLabel', { name, percent, state })}
    >
      <Row gap={1} align="center">
        <Txt variant="caption" color={look.text}>
          {level === 'low'
            ? t('common.levelShortLow', { name, percent })
            : t('common.levelShortOk', { name, percent })}
        </Txt>
      </Row>
    </Box>
  );
}
