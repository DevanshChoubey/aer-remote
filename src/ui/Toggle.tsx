import type { ReactElement } from 'react';
import { Switch } from 'react-native';
import { useTheme } from '@/theme';
import { Row, Txt } from './primitives';

export interface ToggleProps {
  label: string;
  value: boolean;
  onChange: (value: boolean) => void;
  disabled?: boolean;
}

export function Toggle(props: ToggleProps): ReactElement {
  const theme = useTheme();
  return (
    <Row align="center" justify="between" gap={3}>
      <Txt variant="bodyBold">{props.label}</Txt>
      <Switch
        value={props.value}
        onValueChange={props.onChange}
        disabled={props.disabled}
        accessibilityLabel={props.label}
        accessibilityRole="switch"
        trackColor={{ false: theme.color.border, true: theme.color.accent }}
        thumbColor={theme.color.surface}
        style={{ minHeight: theme.touch.min, minWidth: theme.touch.min }}
      />
    </Row>
  );
}
