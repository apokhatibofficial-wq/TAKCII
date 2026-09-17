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
