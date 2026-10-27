export interface Tokens {
  /** Dark backgrounds take light status bar icons. */
  dark: boolean;
  color: {
    bg: string;
    stage: string;
    surface: string;
    ink: string;
    muted: string;
    accent: string;
    accentInk: string;
    soft: string;
    border: string;
    saffron: string;
    deepTerracotta: string;
    warn: string;
    warnSoft: string;
    ok: string;
    okSoft: string;
    track: string;
  };
  font: { heading: string; body: string; bodyBold: string };
  size: { title: number; heading: number; body: number; caption: number };
  space: (n: number) => number;
  radius: { sm: number; md: number; lg: number; pill: number };
  shadow: {
    card: {
      shadowColor: string;
      shadowOffset: { width: number; height: number };
      shadowOpacity: number;
      shadowRadius: number;
      elevation: number;
    };
  };
  touch: { min: 48 };
}

const font: Tokens['font'] = {
  heading: 'Fraunces_700Bold',
  body: 'Nunito_500Medium',
  bodyBold: 'Nunito_700Bold',
};

const base = {
  font,
  size: { title: 30, heading: 21, body: 16, caption: 13 },
  space: (n: number): number => n * 4,
  radius: { sm: 10, md: 20, lg: 28, pill: 999 },
  touch: { min: 48 },
} as const;

export const lightTokens: Tokens = {
  ...base,
  dark: false,
  color: {
    bg: '#fcf1de',
    stage: '#f4dfbd',
    surface: '#fff8ec',
    ink: '#3d2216',
    muted: '#866650',
    accent: '#c4502a',
    accentInk: '#fffdf8',
    soft: '#f7dfb9',
    border: '#ebcca0',
    saffron: '#f0b56e',
    deepTerracotta: '#a3482a',
    warn: '#8f3a1c',
    warnSoft: '#f9d9c9',
    ok: '#3b6232',
    okSoft: '#e2ebcd',
    track: '#9a7a60',
  },
  shadow: {
    card: {
      shadowColor: '#3d2216',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.12,
      shadowRadius: 10,
      elevation: 3,
    },
  },
};

export const darkTokens: Tokens = {
  ...base,
  dark: true,
  color: {
    bg: '#1e130d',
    stage: '#2a1b12',
    surface: '#35231a',
    ink: '#fbeedb',
    muted: '#c9ab94',
    accent: '#e9855f',
    accentInk: '#2a140a',
    soft: '#4a3022',
    border: '#5a3e2c',
    saffron: '#f0b56e',
    deepTerracotta: '#e9855f',
    warn: '#f3a98b',
    warnSoft: '#51281a',
    ok: '#a9d69c',
    okSoft: '#2e3f27',
    track: '#9a7b63',
  },
  shadow: {
    card: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.4,
      shadowRadius: 10,
      elevation: 3,
    },
  },
};

export type ColorToken = keyof Tokens['color'];
export type SpaceStep = 0 | 1 | 2 | 3 | 4 | 5 | 6 | 8 | 10 | 12;
export type RadiusToken = keyof Tokens['radius'];
export type ShadowToken = keyof Tokens['shadow'];

/** Night slate (direction C in docs/design/visual-directions-mockup.html): dark slate, mint accent. */
export const slateTokens: Tokens = {
  ...base,
  dark: true,
  font: {
    heading: 'Manrope_800ExtraBold',
    body: 'Manrope_500Medium',
    bodyBold: 'Manrope_700Bold',
  },
  radius: { sm: 10, md: 18, lg: 26, pill: 999 },
  color: {
    bg: '#10151c',
    stage: '#070a0e',
    surface: '#1a222c',
    ink: '#eef3f8',
    muted: '#8b9aab',
    accent: '#7fe0c4',
    accentInk: '#0b1a16',
    soft: '#243040',
    border: '#2b3746',
    saffron: '#ffb86b',
    deepTerracotta: '#7fe0c4',
    warn: '#ffb86b',
    warnSoft: '#3a2a18',
    ok: '#7fe0c4',
    okSoft: '#1d3a33',
    track: '#6f7e90',
  },
  shadow: {
    card: {
      shadowColor: '#000000',
      shadowOffset: { width: 0, height: 0 },
      shadowOpacity: 0,
      shadowRadius: 0,
      elevation: 0,
    },
  },
};
