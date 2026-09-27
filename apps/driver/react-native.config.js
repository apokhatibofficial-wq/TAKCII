module.exports = {
  dependencies: {
    // Excluded from autolinking on Android so withSafeWebRTC.js (see app.json's
    // plugins) can add it manually, wrapped in a try/catch -- see that file for
    // why.
    'react-native-webrtc': {
      platforms: {
        android: null,
      },
    },
  },
};
