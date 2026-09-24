import { useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';

export interface RideMessage {
  id: string;
  senderId: string;
  body: string;
  createdAt: string;
}

// In-app chat, scoped to one ride -- the replacement for the tel: link this
// session's phone-privacy change removed (0021_phone_privacy_and_ride_messages.sql).
// Writes go through send_ride_message() (checks the ride is live and stamps
// sender_id server-side), not a raw insert.
export function useRideMessages(rideId: string | null) {
  const [messages, setMessages] = useState<RideMessage[]>([]);
  const [sending, setSending] = useState(false);
  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);

  useEffect(() => {
    channelRef.current?.unsubscribe();
    channelRef.current = null;
    setMessages([]);
    if (!rideId) return;

    let cancelled = false;
    supabase
      .from('ride_messages')
      .select('id,sender_id,body,created_at')
      .eq('ride_id', rideId)
      .order('created_at', { ascending: true })
      .then(({ data }) => {
        if (!cancelled && data) {
          setMessages(data.map((m) => ({ id: m.id, senderId: m.sender_id, body: m.body, createdAt: m.created_at })));
        }
      });

    channelRef.current = supabase
      .channel(`ride-messages:${rideId}`)
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'ride_messages', filter: `ride_id=eq.${rideId}` }, (payload) => {
        const row = payload.new as { id: string; sender_id: string; body: string; created_at: string };
        setMessages((prev) => (prev.some((m) => m.id === row.id) ? prev : [...prev, { id: row.id, senderId: row.sender_id, body: row.body, createdAt: row.created_at }]));
      })
      .subscribe();

    return () => {
      cancelled = true;
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, [rideId]);

  const send = async (body: string) => {
    if (!rideId || !body.trim()) return;
    setSending(true);
    try {
      await supabase.rpc('send_ride_message', { p_ride_id: rideId, p_body: body.trim() });
    } finally {
      setSending(false);
    }
  };

  return { messages, send, sending };
}
