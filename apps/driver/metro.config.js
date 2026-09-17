const { getSentryExpoConfig } = require('@sentry/react-native/metro');

// getSentryExpoConfig wraps Expo's own getDefaultConfig with the same
// projectRoot — this project had no metro.config.js before (Expo's implicit
// default), so this is a strict superset of that, not a behavior change.
module.exports = getSentryExpoConfig(__dirname);
