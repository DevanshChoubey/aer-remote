import type { ReactElement } from 'react';
import { ActivityIndicator } from 'react-native';
import { useTheme } from '@/theme';
import type { ColorToken } from '@/theme';
import { Box, Row, Touchable, Txt } from './primitives';

export interface ButtonProps {
  label: string;
  onPress: () => void;
  variant?: 'primary' | 'secondary' | 'ghost';
  icon?: string;
  disabled?: boolean;
  loading?: boolean;
}

const LOOK: Record<
  NonNullable<ButtonProps['variant']>,
  { bg?: ColorToken; border?: ColorToken; text: ColorToken }
> = {
  primary: { bg: 'accent', text: 'accentInk' },
  secondary: { bg: 'soft', border: 'border', text: 'ink' },
  ghost: { text: 'deepTerracotta' },
};

export function Button(props: ButtonProps): ReactElement {
  const theme = useTheme();
  const look = LOOK[props.variant ?? 'primary'];
  const blocked = props.disabled === true || props.loading === true;
  return (
    <Touchable onPress={props.onPress} accessibilityLabel={props.label} disabled={blocked}>
      <Box bg={look.bg} border={look.border} radius="pill" px={6} py={4}>
        <Row gap={2} align="center" justify="center">
          {props.loading ? (
            <ActivityIndicator color={theme.color[look.text]} />
          ) : props.icon ? (
            <Txt variant="bodyBold" color={look.text}>
              {props.icon}
            </Txt>
          ) : null}
          <Txt variant="bodyBold" color={look.text}>
            {props.label}
          </Txt>
        </Row>
      </Box>
    </Touchable>
  );
}
