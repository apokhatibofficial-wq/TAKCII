const { withAppBuildGradle } = require('@expo/config-plugins');

// expo prebuild --clean wipes and regenerates the whole android/ directory
// on every run, including android/app/build.gradle and android/app/debug.keystore
// — without this plugin, the release build type fell back to signingConfigs.debug
// (a keystore regenerated fresh each prebuild), so every rebuild silently produced
// a differently-signed APK and Android refused to install it as an update over
// whatever was already on a driver's phone. release.keystore lives at the project
// root (apps/driver/release.keystore, one level above android/, so --clean never
// touches it) and this plugin re-wires the release build type to it every time.
module.exports = function withReleaseSigning(config) {
  return withAppBuildGradle(config, (config) => {
    let contents = config.modResults.contents;

    if (!contents.includes('takc-driver-release')) {
      contents = contents.replace(
        /signingConfigs\s*\{/,
        `signingConfigs {
        release {
            storeFile file('../../release.keystore')
            storePassword 'TakcDriver2026Rel'
            keyAlias 'takc-driver-release'
            keyPassword 'TakcDriver2026Rel'
        }`
      );
    }

    // The buildTypes.release block sets `signingConfig signingConfigs.debug`
    // same as buildTypes.debug does — but only as its SECOND occurrence in
    // the file (debug's own comes first), with a couple of comment lines in
    // between that make a position-anchored regex brittle across template
    // versions. Replacing the last occurrence is robust to that either way.
    const marker = 'signingConfig signingConfigs.debug';
    const lastIndex = contents.lastIndexOf(marker);
    if (lastIndex !== -1 && contents.indexOf(marker) !== lastIndex) {
      contents = contents.slice(0, lastIndex) + 'signingConfig signingConfigs.release' + contents.slice(lastIndex + marker.length);
    }

    config.modResults.contents = contents;
    return config;
  });
};
