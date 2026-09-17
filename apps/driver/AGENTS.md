# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Release builds: do not pass `-Pandroid.enableMinifyInReleaseBuilds=true`

proguard-rules.pro only has keep rules for react-native-reanimated — nothing
for expo-location's background task, expo-audio, or async-storage, all of
which Expo's module registry reaches via reflection. A minified release
build compiles, signs, and installs fine, then crashes immediately on
launch on a real device with no error a build/signature check would ever
surface (this cost a lot of back-and-forth to actually track down). The
default (omit the property, or pass `false`) is unminified and works.
Re-enabling minification needs proper keep rules for those three modules
added to proguard-rules.pro first, then an actual on-device install test —
not just a successful build — before shipping it.

# Release builds: set SENTRY_DISABLE_AUTO_UPLOAD=true SENTRY_DISABLE_NATIVE_DEBUG_UPLOAD=true

@sentry/react-native's Gradle hook runs sentry-cli during the JS bundle
task and, with no org/project/auth token configured (sentry.properties has
none yet — that needs a SENTRY_AUTH_TOKEN this project doesn't have), it
hard-fails the whole build with "An organization ID or slug is required"
rather than skipping. These two env vars skip the upload step entirely;
crash capture itself doesn't depend on it, only nicely symbolicated stack
traces in the Sentry dashboard do. Once a real auth token + org/project are
configured in sentry.properties, drop both flags to get proper source-map
upload.
