const expoConfig = require('eslint-config-expo/flat');

const RN_VISUAL = ['View', 'Text', 'Pressable', 'TextInput', 'Image', 'ScrollView', 'StyleSheet'];

const rnVisualRestriction = {
  paths: [
    {
      name: 'react-native',
      importNames: RN_VISUAL,
      message:
        'Compose from the primitives in @/ui/primitives (Box, Row, Column, Txt, Touchable, Input, Img, Spacer) instead.',
    },
  ],
};

const SERVICE_MODULES = ['protocol', 'device', 'store', 'ble'];
const DOMAIN_FOLDERS = ['core', 'protocol', 'device', 'store', 'ble'];

const serviceImports = SERVICE_MODULES.flatMap((m) => [
  {
    group: [`@/${m}`, `@/${m}/**`],
    message:
      'Screens reach services only through useServices(), never by importing service modules.',
  },
]);

module.exports = [
  ...expoConfig,
  {
    ignores: ['node_modules/**', 'dist/**', '.expo/**', 'coverage/**', 'bun.lock', 'docs/**'],
  },
  {
    files: ['**/*.{ts,tsx}'],
    rules: {
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'import/no-cycle': 'error',
      'import/order': [
        'error',
        {
          groups: ['builtin', 'external', 'internal', ['parent', 'sibling', 'index']],
          pathGroups: [{ pattern: '@/**', group: 'internal' }],
          pathGroupsExcludedImportTypes: ['builtin'],
        },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-non-null-assertion': 'error',
      '@typescript-eslint/explicit-module-boundary-types': 'error',
      '@typescript-eslint/explicit-function-return-type': [
        'error',
        {
          allowExpressions: true,
          allowTypedFunctionExpressions: true,
          allowHigherOrderFunctions: true,
        },
      ],
      'no-restricted-imports': ['error', rnVisualRestriction],
      'no-restricted-globals': [
        'error',
        {
          name: 'fetch',
          message: 'This app makes no network calls. fetch is banned everywhere.',
        },
      ],
    },
  },
  // Primitives are the one place for RN visual building blocks.
  {
    files: ['src/ui/primitives/**'],
    rules: { 'no-restricted-imports': 'off' },
  },
  // Layering. Domain modules never import app/, screens or ui.
  {
    files: DOMAIN_FOLDERS.map((d) => `src/${d}/**`),
    rules: {
      'no-restricted-imports': [
        'error',
        {
          ...rnVisualRestriction,
          patterns: [
            {
              group: ['@/screens', '@/screens/**', '@/ui', '@/ui/**', '**/app/**'],
              message: 'Domain modules must not import from app/, screens or ui.',
            },
          ],
        },
      ],
    },
  },
  // Protocol and device logic stay pure TypeScript so they run in plain Jest and Node.
  {
    files: ['src/protocol/**', 'src/device/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/screens', '@/screens/**', '@/ui', '@/ui/**', '**/app/**'],
              message: 'Domain modules must not import from app/, screens or ui.',
            },
            {
              group: [
                'react-native',
                'react-native-*',
                'react-native/**',
                'expo',
                'expo-*',
                'expo/**',
                '@react-native-async-storage/*',
              ],
              message: 'src/protocol and src/device must stay free of React Native and Expo.',
            },
          ],
        },
      ],
    },
  },
  // UI components may import only the theme, primitives and their peers.
  {
    files: ['src/ui/**'],
    ignores: ['src/ui/primitives/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          ...rnVisualRestriction,
          patterns: [
            {
              group: ['@/screens', '@/screens/**', '**/app/**'],
              message: 'src/ui must not import from screens or app.',
            },
            ...serviceImports,
          ],
        },
      ],
    },
  },
  {
    files: ['src/ui/primitives/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/screens', '@/screens/**', '@/ui', '@/ui/!(primitives)/**', '**/app/**'],
              message: 'Primitives only depend on the theme.',
            },
            ...serviceImports,
          ],
        },
      ],
    },
  },
  // Screens: services only via useServices(); no raw RN visuals.
  {
    files: ['src/screens/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          ...rnVisualRestriction,
          patterns: [
            { group: ['**/app/**'], message: 'Screens must not import from app/.' },
            ...serviceImports,
          ],
        },
      ],
    },
  },
  // Routes are thin: no raw RN visuals, no direct service-module imports.
  {
    files: ['app/**'],
    rules: {
      'no-restricted-imports': ['error', { ...rnVisualRestriction, patterns: serviceImports }],
      'import/no-default-export': 'off',
    },
  },
  // Throwaway hardware spike: it drives the BLE and device services directly, so service-module
  // imports are allowed here only (it uses the shared primitives for its UI).
  {
    files: ['app/dev/spike.tsx'],
    rules: { 'no-restricted-imports': ['error', rnVisualRestriction] },
  },
  // Tests may use any import.
  {
    files: ['tests/**'],
    rules: {
      'no-restricted-imports': 'off',
      '@typescript-eslint/no-non-null-assertion': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
    },
  },
  // Node-run CommonJS scripts and configs.
  {
    files: ['**/*.js'],
    languageOptions: {
      sourceType: 'commonjs',
      globals: {
        __dirname: 'readonly',
        require: 'readonly',
        module: 'writable',
        process: 'readonly',
        console: 'readonly',
      },
    },
  },
];
