import type { KeyValueStorage } from './asyncStorageStore';

export type ThemePreferenceValue = 'system' | 'light' | 'dark';

export interface ThemePreferenceStore {
  /** The saved preference; 'system' when nothing valid is saved. */
  load(): Promise<ThemePreferenceValue>;
  save(p: ThemePreferenceValue): Promise<void>;
}

const KEY = 'aer.theme';

const isPreference = (v: unknown): v is ThemePreferenceValue =>
  v === 'system' || v === 'light' || v === 'dark';

export function createThemePreferenceStore(storage: KeyValueStorage): ThemePreferenceStore {
  return {
    async load() {
      try {
        const raw = await storage.getItem(KEY);
        return isPreference(raw) ? raw : 'system';
      } catch (e) {
        console.warn('Could not read the theme preference', e);
        return 'system';
      }
    },
    save: (p) => storage.setItem(KEY, p),
  };
}
