import AsyncStorage from '@react-native-async-storage/async-storage';

// ErrorBoundary only catches errors thrown during React's render phase — an
// exception thrown from an effect, an event handler, or an unawaited promise
// (all over Home.tsx's online/location/audio wiring) bypasses it entirely,
// and in a release build RN's default handling of an uncaught JS exception
// is to bring the whole app down, which on-device looks identical to a
// native crash ("keeps stopping") with no stack trace visible anywhere. This
// is the only way to capture that message without adb/logcat access to the
// device: intercept it via ErrorUtils (RN's own global JS error hook, one
// level below where React's error boundaries plug in) and persist it before
// letting the app go down, so the NEXT launch can show what actually threw.
// The write is fire-and-forget because the process may not survive long
// enough after a fatal error to await it — not fully reliable, but the best
// available without adding a native crash-reporting module.
const KEY = 'takc_last_crash';

interface StoredCrash {
  message: string;
  stack?: string;
  isFatal: boolean;
  at: string;
}

export function installGlobalCrashLogger(): void {
  if (typeof ErrorUtils === 'undefined') return;
  const previousHandler = ErrorUtils.getGlobalHandler();
  ErrorUtils.setGlobalHandler((error, isFatal) => {
    try {
      const record: StoredCrash = {
        message: error instanceof Error ? error.message : String(error),
        stack: error instanceof Error ? error.stack : undefined,
        isFatal: !!isFatal,
        at: new Date().toISOString()
      };
      AsyncStorage.setItem(KEY, JSON.stringify(record)).catch(() => undefined);
    } catch {
      // The crash logger must never be the thing that throws.
    }
    previousHandler(error, isFatal);
  });
}

export async function readAndClearLastCrash(): Promise<StoredCrash | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(KEY);
    return JSON.parse(raw) as StoredCrash;
  } catch {
    return null;
  }
}
