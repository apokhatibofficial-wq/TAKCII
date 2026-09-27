const path = require('path');
const fs = require('fs');
const {
  withMainApplication,
  withDangerousMod,
  withSettingsGradle,
  withAppBuildGradle,
} = require('@expo/config-plugins');

// react-native-webrtc bundles a large native library (libjingle_peerconnection_so.so)
// that has real, documented compatibility problems on some older/OEM Android builds
// (crashes the whole app on launch, before any JS runs, so nothing JS-side -- Sentry
// included -- ever sees it). react-native.config.js excludes it from Android
// autolinking so this plugin can add it back here manually, wrapped in a try/catch:
// if WebRTCModulePackage's own construction throws (e.g. UnsatisfiedLinkError from a
// native library that fails to load on a given device), the rest of the app keeps
// working -- only voice calling is unavailable on that device. This can't catch a
// true native (C++/JNI) crash, which bypasses the JVM's exception handling entirely,
// only a Java-level Throwable during package construction/module or view-manager
// creation, which is the far more common failure mode for this kind of incompatibility.
module.exports = function withSafeWebRTC(config) {
  config = withDangerousMod(config, [
    'android',
    (config) => {
      const packagePath = config.android.package.replace(/\./g, '/');
      const dir = path.join(config.modRequest.platformProjectRoot, 'app/src/main/java', packagePath);
      fs.mkdirSync(dir, { recursive: true });
      fs.writeFileSync(
        path.join(dir, 'SafeReactPackage.kt'),
        `package ${config.android.package}

import android.util.Log
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class SafeReactPackage(private val delegate: ReactPackage) : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return try {
      delegate.createNativeModules(reactContext)
    } catch (t: Throwable) {
      Log.e("SafeReactPackage", "createNativeModules failed for \${delegate.javaClass.name}, disabling it", t)
      emptyList()
    }
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<in Nothing, in Nothing>> {
    return try {
      delegate.createViewManagers(reactContext)
    } catch (t: Throwable) {
      Log.e("SafeReactPackage", "createViewManagers failed for \${delegate.javaClass.name}, disabling it", t)
      emptyList()
    }
  }
}
`
      );
      return config;
    },
  ]);

  // react-native.config.js excludes react-native-webrtc from Android autolinking
  // so PackageList.java doesn't eagerly construct it (see comment above), but this
  // project's autolinking is the Gradle-plugin-driven kind (expo-autolinking-settings
  // invoking the RN CLI's config command), which has no static per-package include(...)
  // text to selectively keep -- excluding a package removes it from the Gradle module
  // graph entirely, not just from PackageList.java. These two mods manually restore the
  // Gradle wiring (settings.gradle + app/build.gradle) so ':react-native-webrtc' still
  // compiles as a project dependency; only its *autolinked registration* stays removed,
  // which is what MainApplication.kt re-adds by hand below, wrapped in try/catch.
  config = withSettingsGradle(config, (config) => {
    const marker = "include ':app'";
    if (config.modResults.contents.includes(marker) && !config.modResults.contents.includes("':react-native-webrtc'")) {
      config.modResults.contents = config.modResults.contents.replace(
        marker,
        `${marker}
include ':react-native-webrtc'
project(':react-native-webrtc').projectDir = new File(rootDir, '../node_modules/react-native-webrtc/android')`
      );
    }
    return config;
  });

  config = withAppBuildGradle(config, (config) => {
    const marker = 'dependencies {';
    if (config.modResults.contents.includes(marker) && !config.modResults.contents.includes("project(':react-native-webrtc')")) {
      config.modResults.contents = config.modResults.contents.replace(
        marker,
        `${marker}
    implementation project(':react-native-webrtc')`
      );
    }
    return config;
  });

  return withMainApplication(config, (config) => {
    let contents = config.modResults.contents;
    const marker = '// add(MyReactNativePackage())';
    if (contents.includes(marker) && !contents.includes('SafeReactPackage')) {
      contents = contents.replace(
        marker,
        `${marker}
          try {
            add(SafeReactPackage(com.oney.WebRTCModule.WebRTCModulePackage()))
          } catch (t: Throwable) {
            android.util.Log.e("MainApplication", "WebRTC native module unavailable on this device, voice calling disabled", t)
          }`
      );
    }
    config.modResults.contents = contents;
    return config;
  });
};
