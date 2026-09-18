// Must be the first import: Hermes has no full URL implementation, and
// @supabase/supabase-js depends on the real one internally. Without this,
// requests can still go out, so this doesn't crash — but auth internals
// (session parsing/persistence, refresh) misbehave in ways that surface as
// sign-in silently not sticking rather than as any visible error.
import 'react-native-url-polyfill/auto';

import { registerRootComponent } from 'expo';

import App from './App';
import { initSentry } from './src/lib/sentry';

// Must run before any screen mounts — see src/lib/sentry.ts.
initSentry();

// registerRootComponent calls AppRegistry.registerComponent('main', () => App);
// It also ensures that whether you load the app in Expo Go or in a native build,
// the environment is set up appropriately
registerRootComponent(App);
