import * as Sentry from '@sentry/react-native';

// The Home-screen crash (reaches Home, then the OS "keeps stopping" dialog)
// never reaches installGlobalCrashLogger's ErrorUtils hook and outlasted a
// direct bisection of the two concrete native calls Home.tsx makes on
// mount (expo-audio, expo-location) — it isn't a catchable JS exception,
// and no amount of further JS-side logging/guessing can name it. Sentry's
// native Android crash handler captures the process-level failure itself
// (signal handler + a report written before the process dies), which is
// what's actually needed here — this is the reason it's being added now
// rather than earlier in the investigation.
export function initSentry(): void {
  const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;
  if (!dsn) return;
  Sentry.init({ dsn });
}
