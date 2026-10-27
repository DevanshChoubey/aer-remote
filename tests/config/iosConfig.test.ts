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

  it('lists the plugin after expo-notifications', () => {
    const names = appJson.expo.plugins.map((p) => (Array.isArray(p) ? p[0] : p));
    const notifications = names.indexOf('expo-notifications');
    expect(notifications).toBeGreaterThan(-1);
    expect(names.indexOf('./plugins/withNoPushEntitlement')).toBe(notifications + 1);
    expect(appJson.expo.plugins[notifications]).toEqual([
      'expo-notifications',
      { color: '#c4502b' },
    ]);
  });

  it('adds an entitlements mod to the config', () => {
    const config = plugin({ name: 'x', slug: 'x' }) as {
      mods?: { ios?: { entitlements?: unknown } };
    };
    expect(typeof config.mods?.ios?.entitlements).toBe('function');
  });
});
