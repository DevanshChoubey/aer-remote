import { createThemePreferenceStore } from '@/core';

jest.mock('@react-native-async-storage/async-storage', () =>
  jest.requireActual('@react-native-async-storage/async-storage/jest/async-storage-mock'),
);

function memoryStorage(initial?: string): {
  data: Map<string, string>;
  getItem: (k: string) => Promise<string | null>;
  setItem: (k: string, v: string) => Promise<void>;
} {
  const data = new Map<string, string>();
  if (initial !== undefined) data.set('aer.theme', initial);
  return {
    data,
    getItem: async (k) => data.get(k) ?? null,
    setItem: async (k, v) => {
      data.set(k, v);
    },
  };
}

describe('theme preference store', () => {
  it('defaults to system', async () => {
    expect(await createThemePreferenceStore(memoryStorage()).load()).toBe('system');
  });

  it('saves under aer.theme and loads it back', async () => {
    const storage = memoryStorage();
    const prefs = createThemePreferenceStore(storage);
    await prefs.save('dark');
    expect(storage.data.get('aer.theme')).toBe('dark');
    expect(await prefs.load()).toBe('dark');
  });

  it('falls back to system for an invalid stored value', async () => {
    expect(await createThemePreferenceStore(memoryStorage('purple')).load()).toBe('system');
  });

  it('falls back to system when storage fails', async () => {
    const prefs = createThemePreferenceStore({
      getItem: () => Promise.reject(new Error('disk')),
      setItem: () => Promise.resolve(),
    });
    jest.spyOn(console, 'warn').mockImplementation(() => undefined);
    expect(await prefs.load()).toBe('system');
  });
});
