import { darkTokens, lightTokens } from '@/theme';
import type { Tokens } from '@/theme';

function keyPaths(value: unknown, prefix = ''): string[] {
  if (typeof value !== 'object' || value === null) return [prefix];
  return Object.entries(value).flatMap(([k, v]) => keyPaths(v, prefix ? `${prefix}.${k}` : k));
}

function luminance(hex: string): number {
  const n = parseInt(hex.slice(1), 16);
  const [r, g, b] = [(n >> 16) & 255, (n >> 8) & 255, n & 255].map((c) => {
    const s = (c ?? 0) / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * (r ?? 0) + 0.7152 * (g ?? 0) + 0.0722 * (b ?? 0);
}

function contrast(a: string, b: string): number {
  const [hi, lo] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return ((hi ?? 0) + 0.05) / ((lo ?? 0) + 0.05);
}

describe('tokens', () => {
  it('has the Warm & homely values', () => {
    expect(lightTokens.color.accent).toBe('#c4502a');
    expect(lightTokens.color.bg).toBe('#fcf1de');
    expect(lightTokens.radius.md).toBe(20);
    expect(lightTokens.touch.min).toBe(48);
  });

  it('uses the English-only font set', () => {
    expect(Object.keys(lightTokens.font).sort()).toEqual(['body', 'bodyBold', 'heading']);
  });

  it('dark tokens have the same keys as light tokens', () => {
    expect(keyPaths(darkTokens).sort()).toEqual(keyPaths(lightTokens).sort());
  });

  describe.each([
    ['light', lightTokens],
    ['dark', darkTokens],
  ] as [string, Tokens][])('%s contrast (WCAG AA)', (_name, tokens) => {
    const pairs: [keyof Tokens['color'], keyof Tokens['color']][] = [
      ['ink', 'bg'],
      ['ink', 'surface'],
      ['ink', 'soft'],
      ['muted', 'surface'],
      ['accentInk', 'accent'],
      ['deepTerracotta', 'surface'],
      ['warn', 'warnSoft'],
      ['ok', 'okSoft'],
    ];
    it.each(pairs)('%s on %s >= 4.5', (fg, bg) => {
      expect(contrast(tokens.color[fg], tokens.color[bg])).toBeGreaterThanOrEqual(4.5);
    });
  });
});
