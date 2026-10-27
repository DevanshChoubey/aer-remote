const fs = require('fs');
const path = require('path');
const { withDangerousMod } = require('expo/config-plugins');

/**
 * Release builds hold no network or location permission. Debug builds keep INTERNET for Metro and
 * the Bluetooth library's Android 11 location entries (for the hardware test), so the removals live
 * in the release source set, which Gradle merges over the main manifest for release only.
 */
const RELEASE_MANIFEST = `<?xml version="1.0" encoding="utf-8"?>
<manifest xmlns:android="http://schemas.android.com/apk/res/android"
    xmlns:tools="http://schemas.android.com/tools">
    <uses-permission android:name="android.permission.INTERNET" tools:node="remove"/>
    <uses-permission-sdk-23 android:name="android.permission.ACCESS_FINE_LOCATION" tools:node="remove"/>
    <uses-permission-sdk-23 android:name="android.permission.ACCESS_COARSE_LOCATION" tools:node="remove"/>
</manifest>
`;

/** Writes android/app/src/release/AndroidManifest.xml under the Android project root. */
function writeReleaseManifest(platformProjectRoot) {
  const dir = path.join(platformProjectRoot, 'app', 'src', 'release');
  fs.mkdirSync(dir, { recursive: true });
  const file = path.join(dir, 'AndroidManifest.xml');
  fs.writeFileSync(file, RELEASE_MANIFEST);
  return file;
}

function withReleaseNoInternet(config) {
  return withDangerousMod(config, [
    'android',
    (cfg) => {
      writeReleaseManifest(cfg.modRequest.platformProjectRoot);
      return cfg;
    },
  ]);
}

module.exports = withReleaseNoInternet;
module.exports.writeReleaseManifest = writeReleaseManifest;
module.exports.RELEASE_MANIFEST = RELEASE_MANIFEST;
