import * as Location from 'expo-location';
import * as TaskManager from 'expo-task-manager';
import { supabase } from '../lib/supabase';

export const LOCATION_TASK_NAME = 'takc-driver-location';

// Defined at module scope (required — TaskManager runs this outside any
// mounted component, even with the app backgrounded/screen off). Reads the
// signed-in driver from the persisted session rather than component state,
// since this can fire without any screen mounted.
TaskManager.defineTask(LOCATION_TASK_NAME, async ({ data, error }) => {
  if (error) {
    console.error('[location task]', error.message);
    return;
  }
  const { locations } = (data ?? {}) as { locations?: Location.LocationObject[] };
  const last = locations?.[locations.length - 1];
  if (!last) return;

  const {
    data: { session }
  } = await supabase.auth.getSession();
  if (!session?.user) return;

  await supabase
    .from('drivers')
    .update({ lat: last.coords.latitude, lng: last.coords.longitude })
    .eq('id', session.user.id);
});

export async function requestLocationPermissions(): Promise<boolean> {
  const fg = await Location.requestForegroundPermissionsAsync();
  if (fg.status !== 'granted') return false;
  const bg = await Location.requestBackgroundPermissionsAsync();
  return bg.status === 'granted';
}

export async function startBackgroundLocation() {
  const already = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
  if (already) return;
  await Location.startLocationUpdatesAsync(LOCATION_TASK_NAME, {
    accuracy: Location.Accuracy.High,
    timeInterval: 5000,
    distanceInterval: 15,
    foregroundService: {
      notificationTitle: 'TAK-C.TAXI — متصل',
      notificationBody: 'موقعك يصل للركاب أثناء عملك كسائق.',
      notificationColor: '#181619'
    }
  });
}

export async function stopBackgroundLocation() {
  const already = await Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
  if (already) await Location.stopLocationUpdatesAsync(LOCATION_TASK_NAME);
}

export async function isBackgroundLocationRunning(): Promise<boolean> {
  return Location.hasStartedLocationUpdatesAsync(LOCATION_TASK_NAME).catch(() => false);
}
