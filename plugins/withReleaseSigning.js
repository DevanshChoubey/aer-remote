const { withAppBuildGradle } = require('expo/config-plugins');

/**
 * Release builds are signed with the upload key when all four variables are set, read from the
 * environment or from gradle properties. Without them release builds keep the debug key, so a
 * contributor can still build one. The key and its passwords never live in the repo.
 */
const SIGNING_VARS = [
  'AER_UPLOAD_STORE_FILE',
  'AER_UPLOAD_STORE_PASSWORD',
  'AER_UPLOAD_KEY_ALIAS',
  'AER_UPLOAD_KEY_PASSWORD',
];

const MARKER = '// aer: release signing';

const BLOCK = `
${MARKER}
def aerSigning = [${SIGNING_VARS.map((name) => `'${name}'`).join(', ')}].collect {
    System.getenv(it) ?: findProperty(it)
}
if (aerSigning.every { it }) {
    android.signingConfigs.create('aerUpload') {
        storeFile file(aerSigning[0])
        storePassword aerSigning[1]
        keyAlias aerSigning[2]
        keyPassword aerSigning[3]
    }
    android.buildTypes.release.signingConfig = android.signingConfigs.aerUpload
}
`;

/** Appends the release signing config to an app build.gradle, once. */
function addReleaseSigning(buildGradle) {
  return buildGradle.includes(MARKER) ? buildGradle : buildGradle + BLOCK;
}

function withReleaseSigning(config) {
  return withAppBuildGradle(config, (cfg) => {
    cfg.modResults.contents = addReleaseSigning(cfg.modResults.contents);
    return cfg;
  });
}

module.exports = withReleaseSigning;
module.exports.addReleaseSigning = addReleaseSigning;
module.exports.SIGNING_VARS = SIGNING_VARS;
