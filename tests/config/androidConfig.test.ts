import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

const ROOT = path.resolve(__dirname, '../..');

interface Plugin {
  (config: Record<string, unknown>): Record<string, unknown>;
  writeReleaseManifest: (platformProjectRoot: string) => string;
  RELEASE_MANIFEST: string;
}

interface MinSdkPlugin {
  (config: Record<string, unknown>): Record<string, unknown>;
  addReleaseMinSdk: (buildGradle: string) => string;
  RELEASE_MIN_SDK: number;
}

// eslint-disable-next-line @typescript-eslint/no-require-imports
const plugin = require('../../plugins/withReleaseNoInternet.js') as Plugin;
// eslint-disable-next-line @typescript-eslint/no-require-imports
const minSdkPlugin = require('../../plugins/withReleaseMinSdk.js') as MinSdkPlugin;

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

  it('registers the release plugins, with minSdk 30 for debug builds only', () => {
    expect(appJson.expo.plugins).toContain('./plugins/withReleaseNoInternet');
    expect(appJson.expo.plugins).toContain('./plugins/withReleaseMinSdk');
    expect(appJson.expo.plugins).toContainEqual([
      'expo-build-properties',
      { android: { minSdkVersion: 30 } },
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
      // Bluetooth libraries declare location for Android 11 scans; release never runs there.
      for (const p of ['ACCESS_FINE_LOCATION', 'ACCESS_COARSE_LOCATION']) {
        expect(xml).toContain(
          `<uses-permission-sdk-23 android:name="android.permission.${p}" tools:node="remove"/>`,
        );
      }
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

describe('withReleaseMinSdk', () => {
  const gradle = 'android {\n    defaultConfig {}\n}\n';

  it('raises the release minSdk to 31 and leaves debug alone', () => {
    const out = minSdkPlugin.addReleaseMinSdk(gradle);
    expect(minSdkPlugin.RELEASE_MIN_SDK).toBe(31);
    expect(out.startsWith(gradle)).toBe(true);
    expect(out).toContain('beforeVariants(selector().withBuildType("release"))');
    expect(out).toContain('minSdk = 31');
  });

  it('adds the block once', () => {
    const once = minSdkPlugin.addReleaseMinSdk(gradle);
    expect(minSdkPlugin.addReleaseMinSdk(once)).toBe(once);
  });

  it('adds an app build.gradle mod to the config', () => {
    const config = minSdkPlugin({ name: 'x', slug: 'x' }) as {
      mods?: { android?: { appBuildGradle?: unknown } };
    };
    expect(typeof config.mods?.android?.appBuildGradle).toBe('function');
  });
});

describe('release manifest push stripping', () => {
  it('release manifest strips Firebase push', () => {
    for (const name of [
      'android.permission.ACCESS_NETWORK_STATE',
      'com.google.android.c2dm.permission.RECEIVE',
      'expo.modules.notifications.service.ExpoFirebaseMessagingService',
      'com.google.firebase.messaging.FirebaseMessagingService',
      'com.google.firebase.iid.FirebaseInstanceIdReceiver',
    ]) {
      expect(plugin.RELEASE_MANIFEST).toMatch(
        new RegExp(`android:name="${name.replace(/\./g, '\\.')}"[^>]*tools:node="remove"`),
      );
    }
  });
});
