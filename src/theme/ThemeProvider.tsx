import { Fraunces_700Bold } from '@expo-google-fonts/fraunces';
import {
  Manrope_500Medium,
  Manrope_700Bold,
  Manrope_800ExtraBold,
} from '@expo-google-fonts/manrope';
import { Nunito_500Medium, Nunito_700Bold } from '@expo-google-fonts/nunito';
import { useFonts } from 'expo-font';
import { StatusBar } from 'expo-status-bar';
import { createContext, useContext, useMemo, useState } from 'react';
import type { ReactElement, ReactNode } from 'react';
import { useColorScheme } from 'react-native';
import { darkTokens, lightTokens, slateTokens } from './tokens';
import type { Tokens } from './tokens';

/** 'light' and 'dark' are Warm & homely; 'slate' is Night slate, which is always dark. */
export type ThemePreference = 'system' | 'light' | 'dark' | 'slate';

const TOKENS = { light: lightTokens, dark: darkTokens, slate: slateTokens } as const;

interface ThemeValue {
  tokens: Tokens;
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  /** True once the fonts loaded or failed; a failure falls back to system fonts, never blocks. */
  fontsReady: boolean;
}

const ThemeContext = createContext<ThemeValue>({
  tokens: lightTokens,
  preference: 'system',
  setPreference: () => undefined,
  fontsReady: false,
});

export interface ThemeProviderProps {
  children: ReactNode;
  /** Forces a scheme (tests, previews); ignores the system and the preference. */
  scheme?: 'light' | 'dark';
  /**
   * Starting preference, e.g. the one Settings saved. It is read once at mount, so the layout must
   * render the provider only after storage has loaded. Defaults to following the system.
   */
  initialPreference?: ThemePreference;
  /** Called when the preference changes, so Settings can persist it. */
  onPreferenceChange?: (p: ThemePreference) => void;
}

export function ThemeProvider(props: ThemeProviderProps): ReactElement {
  const system = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>(
    props.initialPreference ?? 'system',
  );
  // Children render immediately; the app layout waits for fontsReady before showing them.
  const [fontsLoaded, fontError] = useFonts({
    Fraunces_700Bold,
    Nunito_500Medium,
    Nunito_700Bold,
    Manrope_500Medium,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });
  const fontsReady = fontsLoaded || fontError !== null;
  const { onPreferenceChange } = props;
  const theme =
    props.scheme ?? (preference === 'system' ? (system === 'dark' ? 'dark' : 'light') : preference);
  const tokens = TOKENS[theme];
  const value = useMemo<ThemeValue>(() => {
    return {
      tokens,
      preference,
      fontsReady,
      setPreference: (p) => {
        setPreferenceState(p);
        onPreferenceChange?.(p);
      },
    };
  }, [tokens, preference, onPreferenceChange, fontsReady]);
  return (
    <ThemeContext.Provider value={value}>
      {/* Dark icons on the light theme, light icons on the dark one, whatever the system says. */}
      <StatusBar style={tokens.dark ? 'light' : 'dark'} />
      {props.children}
    </ThemeContext.Provider>
  );
}

export function useTheme(): Tokens {
  return useContext(ThemeContext).tokens;
}

/** The system/light/dark choice (Settings) and fontsReady (the layout, to hold the splash). */
export function useThemePreference(): {
  preference: ThemePreference;
  setPreference: (p: ThemePreference) => void;
  fontsReady: boolean;
} {
  const { preference, setPreference, fontsReady } = useContext(ThemeContext);
  return { preference, setPreference, fontsReady };
}
