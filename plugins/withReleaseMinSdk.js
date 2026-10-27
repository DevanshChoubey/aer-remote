const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Release builds need Android 12 (API 31): its Bluetooth permissions let the app scan without
 * location. Debug builds keep the lower defaultConfig minSdk so an Android 11 phone can run the
 * hardware test, where scanning needs location.
 */
const RELEASE_MIN_SDK = 31;

const MARKER = '// aer: release minSdk';

const BLOCK = `
${MARKER}
androidComponents {
    beforeVariants(selector().withBuildType("release")) { variantBuilder ->
        variantBuilder.minSdk = ${RELEASE_MIN_SDK}
    }
}
`;

/** Appends the release-only minSdk to an app build.gradle, once. */
function addReleaseMinSdk(buildGradle) {
  return buildGradle.includes(MARKER) ? buildGradle : buildGradle + BLOCK;
}

function withReleaseMinSdk(config) {
  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = addReleaseMinSdk(cfg.modResults.contents);
    return cfg;
  });
}

module.exports = withReleaseMinSdk;
module.exports.addReleaseMinSdk = addReleaseMinSdk;
module.exports.RELEASE_MIN_SDK = RELEASE_MIN_SDK;
