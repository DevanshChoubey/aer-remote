import { spawnSync } from 'child_process';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '..');
const ESLINT_BIN = path.join(ROOT, 'node_modules', 'eslint', 'bin', 'eslint.js');

// ESLint loads its config with a dynamic import(), which Jest's VM cannot do, so run it as a child
// process. import/no-cycle is off because it needs the file to exist on disk.
function errorsFor(source: string, filePath: string): string[] {
  const run = spawnSync(
    process.execPath,
    [
      ESLINT_BIN,
      '--stdin',
      '--stdin-filename',
      path.join(ROOT, filePath),
      '--format',
      'json',
      '--rule',
      'import/no-cycle: off',
    ],
    { cwd: ROOT, input: source, encoding: 'utf8' },
  );
  const [result] = JSON.parse(run.stdout) as {
    messages: { ruleId: string | null; severity: number }[];
  }[];
  return (result?.messages ?? []).filter((m) => m.severity === 2).map((m) => m.ruleId ?? 'parse');
}

describe('architecture lint rules', () => {
  it('bans raw React Native visuals in screens', () => {
    const errors = errorsFor(
      "import { View } from 'react-native';\nexport const X = View;\n",
      'src/screens/x.tsx',
    );
    expect(errors).toContain('no-restricted-imports');
  });

  it('bans any react-native import in src/protocol', () => {
    const errors = errorsFor(
      "import { Platform } from 'react-native';\nexport const p = Platform.OS;\n",
      'src/protocol/x.ts',
    );
    expect(errors).toContain('no-restricted-imports');
  });

  it('bans fetch in src/device', () => {
    const errors = errorsFor("export const r = fetch('x');\n", 'src/device/x.ts');
    expect(errors).toContain('no-restricted-globals');
  });

  it('bans screens importing service modules directly', () => {
    const errors = errorsFor(
      "import '@/device/session';\nexport const x = 1;\n",
      'src/screens/x.tsx',
    );
    expect(errors).toContain('no-restricted-imports');
  });

  it('allows React Native visuals inside src/ui/primitives', () => {
    const errors = errorsFor(
      "import { View } from 'react-native';\nexport const Box = View;\n",
      'src/ui/primitives/Box.tsx',
    );
    expect(errors).not.toContain('no-restricted-imports');
  });

  it('bans fetch in tests too', () => {
    const errors = errorsFor("export const r = fetch('x');\n", 'tests/x.test.ts');
    expect(errors).toContain('no-restricted-globals');
  });
});
