import { useEffect } from 'react';
import { supabase } from '../lib/supabase';

function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/');
  const rawData = atob(base64);
  const bytes = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) bytes[i] = rawData.charCodeAt(i);
  return bytes;
}

// Subscribes this browser to Web Push once per login and upserts the
// subscription server-side. Entirely best-effort and silent: unsupported
// browser, denied permission, or no VAPID key configured all just no-op —
// push is a nice-to-have on top of the realtime ride flow, never a
// dependency of it.
export function usePushSubscription(enabled: boolean): void {
  useEffect(() => {
    if (!enabled) return;
    if (!('serviceWorker' in navigator) || !('PushManager' in window)) return;
    const vapidKey = import.meta.env.VITE_VAPID_PUBLIC_KEY as string | undefined;
    if (!vapidKey) return;

    let cancelled = false;

    (async () => {
      try {
        if (Notification.permission === 'denied') return;
        if (Notification.permission === 'default') {
          const perm = await Notification.requestPermission();
          if (perm !== 'granted') return;
        }
        const registration = await navigator.serviceWorker.ready;
        let subscription = await registration.pushManager.getSubscription();
        if (!subscription) {
          subscription = await registration.pushManager.subscribe({
            userVisibleOnly: true,
            // TS's lib.dom types every Uint8Array as Uint8Array<ArrayBufferLike>
            // (even freshly `new`-allocated ones), which BufferSource's
            // ArrayBufferView<ArrayBuffer> rejects — a real runtime non-issue.
            applicationServerKey: urlBase64ToUint8Array(vapidKey) as BufferSource
          });
        }
        if (cancelled) return;

        const { data: userData } = await supabase.auth.getUser();
        const userId = userData.user?.id;
        if (!userId) return;

        const json = subscription.toJSON();
        if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return;

        await supabase
          .from('push_subscriptions')
          .upsert(
            { user_id: userId, platform: 'web', web_endpoint: json.endpoint, web_p256dh: json.keys.p256dh, web_auth: json.keys.auth },
            { onConflict: 'web_endpoint' }
          );
      } catch {
        // Best-effort — see comment above.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [enabled]);
}
