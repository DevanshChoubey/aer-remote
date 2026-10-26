import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../..');

interface Plugin {
  (config: Record<string, unknown>): Record<string, unknown>;
  writeReleaseManifest: (platformProjectRoot: string) => string;
  RELEASE_MANIFEST: string;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require('../../plugins/withReleaseNoInternet.js') as Plugin;

const appJson = JSON.parse(fs.readFileSync(path.join(ROOT, 'app.json'), 'utf8')) as {
  expo: { android: { blockedPermissions: string[] }; plugins: unknown[] };
};

describe('Android config', () => {
  it('blocks storage, overlay and location permissions, keeping the old entries', () => {
    expect(appJson.expo.android.blockedPermissions).toEqual(
      expect.arrayContaining([
        'android.permission.ACCESS_FINE_LOCATION',
        'android.permission.ACCESS_COARSE_LOCATION',
        'android.permission.READ_EXTERNAL_STORAGE',
        'android.permission.WRITE_EXTERNAL_STORAGE',
        'android.permission.SYSTEM_ALERT_WINDOW',
      ]),
    );
  });

  it('registers the release no-internet plugin and minSdk 31', () => {
    expect(appJson.expo.plugins).toContain('./plugins/withReleaseNoInternet');
    expect(appJson.expo.plugins).toContainEqual([
      'expo-build-properties',
      { android: { minSdkVersion: 31 } },
    ]);
  });
});

describe('withReleaseNoInternet', () => {
  it('writes a release manifest that removes INTERNET', () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'aer-android-'));
    try {
      const file = plugin.writeReleaseManifest(dir);
      expect(file).toBe(path.join(dir, 'app/src/release/AndroidManifest.xml'));
      const xml = fs.readFileSync(file, 'utf8');
      expect(xml).toContain('xmlns:tools="http://schemas.android.com/tools"');
      expect(xml).toContain(
        '<uses-permission android:name="android.permission.INTERNET" tools:node="remove"/>',
      );
      expect(xml).toBe(plugin.RELEASE_MANIFEST);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  it('adds an Android dangerous mod to the config', () => {
    const config = plugin({ name: 'x', slug: 'x' }) as {
      mods?: { android?: { dangerous?: unknown } };
    };
    expect(typeof config.mods?.android?.dangerous).toBe('function');
  });
});
