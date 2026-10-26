export interface Tokens {
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
  color: {
    bg: '#fcf1de',
    stage: '#f4dfbd',
    surface: '#fff8ec',
    ink: '#3d2216',
    muted: '#8b6b57',
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
    deepTerracotta: '#d9724b',
    warn: '#f3a98b',
    warnSoft: '#51281a',
    ok: '#a9d69c',
    okSoft: '#2e3f27',
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
