// Shared by every Edge Function that needs to push a notification to one
// user's devices -- factored out of send-ride-notification once
// send-message-notification needed the exact same expo/web-push fan-out.
import { createClient } from 'jsr:@supabase/supabase-js@2';
import webpush from 'npm:web-push@3.6.7';

const VAPID_PUBLIC_KEY = Deno.env.get('VAPID_PUBLIC_KEY');
const VAPID_PRIVATE_KEY = Deno.env.get('VAPID_PRIVATE_KEY');
if (VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
  webpush.setVapidDetails('mailto:apokhatib.official@gmail.com', VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);
}

export async function sendPushToUser(
  admin: ReturnType<typeof createClient>,
  targetUserId: string,
  title: string,
  body: string,
  data: Record<string, unknown>
): Promise<void> {
  const { data: subs } = await admin.from('push_subscriptions').select('*').eq('user_id', targetUserId);
  const staleIds: string[] = [];

  await Promise.all(
    (subs ?? []).map(async (sub) => {
      if (sub.platform === 'expo' && sub.expo_token) {
        await fetch('https://exp.host/--/api/v2/push/send', {
          method: 'POST',
          headers: { 'content-type': 'application/json', accept: 'application/json' },
          body: JSON.stringify({ to: sub.expo_token, title, body, data })
        }).catch(() => undefined);
        return;
      }
      if (sub.platform === 'web' && sub.web_endpoint && sub.web_p256dh && sub.web_auth && VAPID_PUBLIC_KEY && VAPID_PRIVATE_KEY) {
        try {
          await webpush.sendNotification(
            { endpoint: sub.web_endpoint, keys: { p256dh: sub.web_p256dh, auth: sub.web_auth } },
            JSON.stringify({ title, body, ...data })
          );
        } catch (err) {
          // 404/410 means the browser subscription is gone for good
          // (uninstalled, cleared site data) -- stop trying it.
          const status = (err as { statusCode?: number }).statusCode;
          if (status === 404 || status === 410) staleIds.push(sub.id as string);
        }
      }
    })
  );

  if (staleIds.length) {
    await admin.from('push_subscriptions').delete().in('id', staleIds);
  }
}
