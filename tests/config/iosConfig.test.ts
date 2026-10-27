/**
 * @jest-environment node
 */
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

  it('leaves no push entitlement once every plugin has run', async () => {
    // Mods run in reverse order of the plugins list, so the order in app.json decides who wins.
    /* eslint-disable @typescript-eslint/no-require-imports */
    const { getPrebuildConfigAsync } = require('@expo/prebuild-config') as {
      getPrebuildConfigAsync: (
        root: string,
        opts: { platforms: string[] },
      ) => Promise<{ exp: Record<string, unknown> }>;
    };
    const { compileModsAsync } = require('@expo/config-plugins') as {
      compileModsAsync: (
        config: Record<string, unknown>,
        opts: Record<string, unknown>,
      ) => Promise<{ ios?: { entitlements?: Record<string, unknown> } }>;
    };
    /* eslint-enable @typescript-eslint/no-require-imports */
    const projectRoot = path.resolve(__dirname, '../..');
    const { exp } = await getPrebuildConfigAsync(projectRoot, { platforms: ['ios'] });
    const compiled = await compileModsAsync(exp, {
      projectRoot,
      introspect: true,
      platforms: ['ios'],
      assertMissingModProviders: false,
    });
    expect(compiled.ios?.entitlements).toBeDefined();
    expect(compiled.ios?.entitlements).not.toHaveProperty('aps-environment');
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
