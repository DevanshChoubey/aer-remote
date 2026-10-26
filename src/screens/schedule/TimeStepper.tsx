import type { ReactElement } from 'react';

import type { TimeOfDay } from '@/core';
import { t } from '@/i18n';
import { Box, Column, Row, Touchable, Txt } from '@/ui';

import { formatClock } from './format';
import { stepTime } from './useScheduleDraft';

export interface TimeStepperProps {
  label: string;
  value: TimeOfDay;
  onChange: (time: TimeOfDay) => void;
}

interface StepButtonProps {
  glyph: string;
  label: string;
  onPress: () => void;
}

function StepButton(props: StepButtonProps): ReactElement {
  return (
    <Touchable onPress={props.onPress} accessibilityLabel={props.label}>
      <Box bg="soft" border="border" radius="pill" px={4} py={2} align="center">
        <Txt variant="bodyBold">{props.glyph}</Txt>
      </Box>
    </Touchable>
  );
}

/** A time picker built from big buttons: hour up and down by 1, minutes by 5, wrapping round. */
export function TimeStepper(props: TimeStepperProps): ReactElement {
  const { label, value, onChange } = props;
  const spoken = (key: string): string => t(key, { what: `${label} ${formatClock(value)}` });
  return (
    <Column gap={2}>
      <Txt variant="bodyBold">{label}</Txt>
      <Row gap={4} align="center" justify="between">
        <Row gap={2} align="center">
          <StepButton
            glyph="−"
            label={spoken('schedule.hourDown')}
            onPress={() => onChange(stepTime(value, 'h', -1))}
          />
          <StepButton
            glyph="+"
            label={spoken('schedule.hourUp')}
            onPress={() => onChange(stepTime(value, 'h', 1))}
          />
        </Row>
        <Txt variant="heading">{formatClock(value)}</Txt>
        <Row gap={2} align="center">
          <StepButton
            glyph="−"
            label={spoken('schedule.minuteDown')}
            onPress={() => onChange(stepTime(value, 'm', -1))}
          />
          <StepButton
            glyph="+"
            label={spoken('schedule.minuteUp')}
            onPress={() => onChange(stepTime(value, 'm', 1))}
          />
        </Row>
      </Row>
    </Column>
  );
}
