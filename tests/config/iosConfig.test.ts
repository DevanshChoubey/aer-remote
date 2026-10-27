/**
 * @jest-environment node
 */
import { execFileSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';

interface PushPlugin {
  (config: Record<string, unknown>): Record<string, unknown>;
  removePushEntitlement: (e: Record<string, unknown>) => Record<string, unknown>;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require('../../plugins/withNoPushEntitlement.js') as PushPlugin;

const appJson = JSON.parse(fs.readFileSync(path.resolve(__dirname, '../../app.json'), 'utf8')) as {
  expo: { plugins: unknown[] };
};

describe('iOS config', () => {
  it('drops the push entitlement', () => {
    expect(plugin.removePushEntitlement({ 'aps-environment': 'development', x: 1 })).toEqual({
      x: 1,
    });
  });

  it('leaves no push entitlement once every plugin has run', () => {
    // Mods run in reverse order of the plugins list, so the order in app.json decides who wins.
    // The compile runs in its own Node process: inside Jest, Expo's lazy test globals throw
    // once the test has finished.
    const projectRoot = path.resolve(__dirname, '../..');
    const script = `
      const { getPrebuildConfigAsync } = require('@expo/prebuild-config');
      const { compileModsAsync } = require('@expo/config-plugins');
      (async () => {
        const root = process.argv[1];
        const { exp } = await getPrebuildConfigAsync(root, { platforms: ['ios'] });
        const compiled = await compileModsAsync(exp, {
          projectRoot: root, introspect: true, platforms: ['ios'], assertMissingModProviders: false,
        });
        process.stdout.write(JSON.stringify(compiled.ios?.entitlements ?? null));
      })().catch((e) => { console.error(e); process.exit(1); });
    `;
    const out = execFileSync(process.execPath, ['-e', script, projectRoot], {
      cwd: projectRoot,
      encoding: 'utf8',
    });
    const entitlements = JSON.parse(out) as Record<string, unknown> | null;
    expect(entitlements).not.toBeNull();
    expect(entitlements).not.toHaveProperty('aps-environment');
  }, 60_000);

  it('keeps the notification colour', () => {
    const entry = appJson.expo.plugins.find(
      (p) => Array.isArray(p) && p[0] === 'expo-notifications',
    );
    expect(entry).toEqual(['expo-notifications', { color: '#c4502b' }]);
  });

  it('adds an entitlements mod to the config', () => {
    const config = plugin({ name: 'x', slug: 'x' }) as {
      mods?: { ios?: { entitlements?: unknown } };
    };
    expect(typeof config.mods?.ios?.entitlements).toBe('function');
  });
});
