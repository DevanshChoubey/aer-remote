import { render } from '@testing-library/react-native';

import { ThemeProvider } from '@/theme';

const mockStatusBar = jest.fn((_props: { style: string }) => null);
jest.mock('expo-status-bar', () => ({
  StatusBar: (props: { style: string }) => mockStatusBar(props),
}));

describe('ThemeProvider status bar', () => {
  beforeEach(() => mockStatusBar.mockClear());

  it('uses dark icons on the light theme', async () => {
    await render(<ThemeProvider scheme="light">{null}</ThemeProvider>);
    expect(mockStatusBar).toHaveBeenLastCalledWith({ style: 'dark' });
  });

  it('uses light icons on the dark theme', async () => {
    await render(<ThemeProvider scheme="dark">{null}</ThemeProvider>);
    expect(mockStatusBar).toHaveBeenLastCalledWith({ style: 'light' });
  });

  it('follows a saved preference over the system', async () => {
    await render(<ThemeProvider initialPreference="dark">{null}</ThemeProvider>);
    expect(mockStatusBar).toHaveBeenLastCalledWith({ style: 'light' });
  });
});
