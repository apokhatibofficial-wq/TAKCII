import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '../lib/supabase';
import { notifyRideChange, rowToCamel, type Ride, type RideStatus } from '@takc/shared';

const ADVANCE: Partial<Record<RideStatus, RideStatus>> = { toPickup: 'arrived', arrived: 'onTrip', onTrip: 'done' };
const ACTIVE_TRIP_STATUSES: RideStatus[] = ['toPickup', 'arrived', 'onTrip'];
const COUNTDOWN_SECONDS = 20;
const MAX_WAIT_RUNS = 2;

// Drives the driver-side ride negotiation (dIncoming) and active-trip
// (dTrip) blocks from index.html. Both are fed by one Realtime subscription
// on rides.driver_id — request_ride/reject_ride insert or move rows into
// this driver's view, accept_ride/advanceTrip move them out again.
export function useDriverRide(driverId: string | null) {
  const [incoming, setIncoming] = useState<Ride | null>(null);
  const [countdown, setCountdown] = useState(COUNTDOWN_SECONDS);
  const [muted, setMuted] = useState(false);
  const [trip, setTrip] = useState<Ride | null>(null);
  const [cancelledNotice, setCancelledNotice] = useState(0);
  const [justCompleted, setJustCompleted] = useState<{ rideId: string; riderId: string } | null>(null);

  const [waitRunning, setWaitRunning] = useState(false);
  const [waitSeconds, setWaitSeconds] = useState(0);
  const [waitTotal, setWaitTotal] = useState(0);
  const [waitRuns, setWaitRuns] = useState(0);

  const channelRef = useRef<ReturnType<typeof supabase.channel> | null>(null);
  const countdownTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waitTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const waitStartRef = useRef(0);
  const incomingRef = useRef<Ride | null>(null);
  incomingRef.current = incoming;

  const resetWait = useCallback(() => {
    if (waitTimerRef.current) clearInterval(waitTimerRef.current);
    setWaitRunning(false);
    setWaitSeconds(0);
    setWaitTotal(0);
    setWaitRuns(0);
  }, []);

  const reject = useCallback(async (rideId: string) => {
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    setIncoming(null);
    await supabase.rpc('reject_ride', { p_ride_id: rideId });
    notifyRideChange(supabase, rideId);
  }, []);

  useEffect(() => {
    if (!incoming) return;
    setCountdown(COUNTDOWN_SECONDS);
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    countdownTimerRef.current = setInterval(() => {
      setCountdown((c) => {
        if (c <= 1) {
          if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
          const id = incomingRef.current?.id;
          if (id) reject(id);
          return 0;
        }
        return c - 1;
      });
    }, 1000);
    return () => {
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    };
  }, [incoming, reject]);

  useEffect(() => {
    if (!driverId) return;

    const applyRow = (row: Ride) => {
      if (row.status === 'dispatched') {
        setIncoming(row);
        return;
      }
      if (ACTIVE_TRIP_STATUSES.includes(row.status)) {
        setIncoming((cur) => (cur?.id === row.id ? null : cur));
        setTrip(row);
        return;
      }
      if (row.status === 'cancelled') {
        // Only the rider can cancel (cancel_ride RPC), and only while this
        // driver was still looking at it (offer or accepted trip) — a ride
        // that already moved on to another driver (searching/reassigned)
        // falls through to the generic clear below, silently, on purpose.
        setIncoming((cur) => {
          if (cur?.id !== row.id) return cur;
          setCancelledNotice((n) => n + 1);
          return null;
        });
        setTrip((cur) => {
          if (cur?.id !== row.id) return cur;
          setCancelledNotice((n) => n + 1);
          return null;
        });
        return;
      }
      // done / searching (lost the race to another driver)
      setIncoming((cur) => (cur?.id === row.id ? null : cur));
      setTrip((cur) => (cur?.id === row.id ? null : cur));
    };

    supabase
      .from('rides')
      .select('*')
      .eq('driver_id', driverId)
      .in('status', ['dispatched', 'toPickup', 'arrived', 'onTrip'])
      .order('requested_at', { ascending: false })
      .limit(1)
      .maybeSingle()
      .then(({ data }) => {
        if (!data) return;
        const row = rowToCamel<Ride>(data);
        // The 20s offer window is now also enforced server-side (see
        // migration 0017's sweep_stale_rides), but that runs on a schedule --
        // skip an offer this client can already see is stale instead of
        // flashing it as if it just arrived while waiting for the next sweep.
        if (row.status === 'dispatched' && row.dispatchedAt && Date.now() - new Date(row.dispatchedAt).getTime() > COUNTDOWN_SECONDS * 1000) {
          return;
        }
        applyRow(row);
      });

    channelRef.current?.unsubscribe();
    channelRef.current = supabase
      .channel(`driver-rides:${driverId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'rides', filter: `driver_id=eq.${driverId}` },
        (payload) => {
          if (payload.eventType === 'DELETE') return;
          applyRow(rowToCamel<Ride>(payload.new as Record<string, unknown>));
        }
      )
      .subscribe();

    return () => {
      channelRef.current?.unsubscribe();
      channelRef.current = null;
    };
  }, [driverId]);

  const accept = useCallback(async () => {
    if (!incoming) return;
    if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
    const rideId = incoming.id;
    const { data, error } = await supabase.rpc('accept_ride', { p_ride_id: rideId });
    if (error || !data) {
      setIncoming(null);
      return;
    }
    setIncoming(null);
    resetWait();
    setTrip(rowToCamel<Ride>(data));
    notifyRideChange(supabase, rideId);
  }, [incoming, resetWait]);

  const rejectIncoming = useCallback(() => {
    if (!incoming) return;
    reject(incoming.id);
  }, [incoming, reject]);

  const toggleWait = useCallback((): 'started' | 'stopped' | 'blocked' => {
    if (waitRunning) {
      if (waitTimerRef.current) clearInterval(waitTimerRef.current);
      const secs = Math.round((Date.now() - waitStartRef.current) / 1000);
      setWaitRunning(false);
      setWaitSeconds(0);
      setWaitTotal((t) => t + secs);
      setWaitRuns((r) => r + 1);
      return 'stopped';
    }
    if (waitRuns >= MAX_WAIT_RUNS) return 'blocked';
    waitStartRef.current = Date.now();
    setWaitRunning(true);
    setWaitSeconds(0);
    waitTimerRef.current = setInterval(() => {
      setWaitSeconds(Math.round((Date.now() - waitStartRef.current) / 1000));
    }, 1000);
    return 'started';
  }, [waitRunning, waitRuns]);

  const advanceTrip = useCallback(async () => {
    if (!trip) return;
    const next = ADVANCE[trip.status];
    if (!next) return;
    const isDone = next === 'done';
    const finalSeconds = isDone ? waitTotal + (waitRunning ? waitSeconds : 0) : undefined;
    const finalRuns = isDone ? waitRuns + (waitRunning ? 1 : 0) : undefined;
    // advance_trip computes the next status and wait_fare itself server-side —
    // wait_seconds/wait_runs are the only client-measured inputs it trusts.
    const { data, error } = await supabase.rpc('advance_trip', {
      p_ride_id: trip.id,
      p_wait_seconds: finalSeconds,
      p_wait_runs: finalRuns
    });
    if (error || !data) return;
    notifyRideChange(supabase, trip.id);
    if (isDone) {
      setJustCompleted({ rideId: trip.id, riderId: trip.riderId });
      setTrip(null);
      resetWait();
    } else {
      setTrip(rowToCamel<Ride>(data));
    }
  }, [trip, waitTotal, waitRunning, waitSeconds, waitRuns, resetWait]);

  const clearJustCompleted = useCallback(() => setJustCompleted(null), []);

  useEffect(
    () => () => {
      channelRef.current?.unsubscribe();
      if (countdownTimerRef.current) clearInterval(countdownTimerRef.current);
      if (waitTimerRef.current) clearInterval(waitTimerRef.current);
    },
    []
  );

  return {
    incoming,
    countdown,
    cancelledNotice,
    justCompleted,
    clearJustCompleted,
    muted,
    toggleMute: () => setMuted((m) => !m),
    accept,
    reject: rejectIncoming,
    trip,
    advanceTrip,
    waitRunning,
    waitSeconds,
    waitTotal,
    waitRuns,
    toggleWait,
    maxWaitRuns: MAX_WAIT_RUNS
  };
}
