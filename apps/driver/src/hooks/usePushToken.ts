import { useEffect } from 'react';
import { Platform } from 'react-native';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import { supabase } from '../lib/supabase';

// Foreground notifications (e.g. an admin broadcast arriving while the app
// is open) still show as a banner — without this, expo-notifications
// silently drops them since the default handler shows nothing.
Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: true,
    shouldSetBadge: false
  })
});

// Registers this device for push (new-ride-offer alerts while backgrounded)
// and upserts the token server-side. Requires EXPO_PUBLIC_EAS_PROJECT_ID —
// getExpoPushTokenAsync needs a real EAS project id to know which app to
// route pushes to, so until that's configured this silently no-ops. Runs
// once the driver profile is loaded, independent of online/offline status.
export function usePushToken(driverId: string | null): void {
  useEffect(() => {
    if (!driverId) return;
    const projectId = process.env.EXPO_PUBLIC_EAS_PROJECT_ID;
    if (!projectId || !Device.isDevice) return;

    let cancelled = false;

    (async () => {
      try {
        if (Platform.OS === 'android') {
          await Notifications.setNotificationChannelAsync('ride-offers', {
            name: 'طلبات الرحلات',
            importance: Notifications.AndroidImportance.MAX,
            sound: 'default',
            vibrationPattern: [0, 250, 250, 250]
          });
        }

        const { status: existing } = await Notifications.getPermissionsAsync();
        let status = existing;
        if (status !== 'granted') {
          const req = await Notifications.requestPermissionsAsync();
          status = req.status;
        }
        if (status !== 'granted' || cancelled) return;

        const { data: token } = await Notifications.getExpoPushTokenAsync({ projectId });
        if (cancelled || !token) return;

        await supabase.from('push_subscriptions').upsert({ user_id: driverId, platform: 'expo', expo_token: token }, { onConflict: 'expo_token' });
      } catch {
        // Best-effort — push registration never blocks going online.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [driverId]);
}
