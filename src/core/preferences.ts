import AsyncStorage from '@react-native-async-storage/async-storage';

import type { KeyValueStorage } from '@/store/asyncStorageStore';
import {
  createThemePreferenceStore as createStore,
  type ThemePreferenceStore,
} from '@/store/themePreferenceStore';

/** The theme preference in AsyncStorage under 'aer.theme'; pass memory storage in tests. */
export function createThemePreferenceStore(
  storage: KeyValueStorage = AsyncStorage,
): ThemePreferenceStore {
  return createStore(storage);
}
