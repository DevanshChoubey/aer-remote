import type { ReactElement } from 'react';
import { t } from '@/i18n';
import type { ColorToken } from '@/theme';
import { Box, Touchable, Txt } from './primitives';

export type ChipState = 'neutral' | 'selected';

export interface ChipProps {
  label: string;
  state: ChipState;
  onToggle?: () => void;
}

const LOOK: Record<ChipState, { bg: ColorToken; border: ColorToken; text: ColorToken }> = {
  neutral: { bg: 'surface', border: 'border', text: 'ink' },
  selected: { bg: 'accent', border: 'deepTerracotta', text: 'accentInk' },
};

export function Chip(props: ChipProps): ReactElement {
  const look = LOOK[props.state];
  const body = (
    <Box bg={look.bg} border={look.border} radius="pill" px={4} py={2}>
      <Txt variant="bodyBold" color={look.text}>
        {props.label}
      </Txt>
    </Box>
  );
  if (!props.onToggle) return body;
  const selected = props.state === 'selected';
  return (
    <Touchable
      onPress={props.onToggle}
      selected={selected}
      accessibilityLabel={selected ? t('common.chipSelected', { label: props.label }) : props.label}
    >
      {body}
    </Touchable>
  );
}
