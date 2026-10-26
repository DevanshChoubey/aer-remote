import type { ReactElement, ReactNode } from 'react';
import { FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useTheme } from '@/theme';
import { Box, Column, Txt } from './primitives';

export interface ScreenProps {
  title?: string;
  children: ReactNode;
  scroll?: boolean;
}

const ONE_PAGE = [0];

export function Screen(props: ScreenProps): ReactElement {
  const theme = useTheme();
  const content = (
    <Column gap={4} px={5} py={4}>
      {props.title ? <Txt variant="title">{props.title}</Txt> : null}
      {props.children}
    </Column>
  );
  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: theme.color.bg }}>
      {props.scroll ? (
        // A one-row FlatList is the scroll container available outside the primitives.
        <FlatList
          data={ONE_PAGE}
          keyExtractor={(n) => String(n)}
          renderItem={() => content}
          keyboardShouldPersistTaps="handled"
        />
      ) : (
        <Box flex={1}>{content}</Box>
      )}
    </SafeAreaView>
  );
}
