const path = require('path');
const fs = require('fs');
const { withMainApplication, withDangerousMod } = require('@expo/config-plugins');

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
