import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { setAudioModeAsync, useAudioPlayer } from 'expo-audio';
import { supabase } from '../lib/supabase';
import { isBackgroundLocationRunning, requestLocationPermissions, startBackgroundLocation, stopBackgroundLocation } from '../location/backgroundTask';
import { useActiveAd } from '../hooks/useActiveAd';
import { useDriverRide } from '../hooks/useDriverRide';
import { useDriverStats } from '../hooks/useDriverStats';
import { useFare } from '../hooks/useFare';
import { usePushToken } from '../hooks/usePushToken';
import { useVoiceCall } from '../hooks/useVoiceCall';
import Profile from './Profile';
import AdOverlay from '../components/AdOverlay';
import CallOverlay from '../components/CallOverlay';
import ChatOverlay from '../components/ChatOverlay';
import PickupMap from '../components/PickupMap';
import RateRiderOverlay from '../components/RateRiderOverlay';
import { COLORS, FONT } from '../theme';
import { fmtMoney, haversineKm, waitFareOf, type CurrencyCode, type Driver } from '@takc/shared';

const RINGTONE = require('../../assets/ringtone.wav');
const TAXI_WATERMARK = require('../../assets/taxi-watermark.png');

const TRIP_TITLES: Record<string, string> = { toPickup: 'في الطريق إلى الراكب', arrived: 'بانتظار صعود الراكب', onTrip: 'الرحلة جارية' };
const TRIP_ACTION_LABELS: Record<string, string> = { toPickup: 'وصلت إلى الراكب', arrived: 'بدء الرحلة', onTrip: 'إنهاء الرحلة' };

function fmtClock(totalSeconds: number): string {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

// Ported from index.html's dHomeScreen block (online toggle / stats / active
// trip / incoming-request overlay). The live map background (fullMap in the
// prototype) is out of scope here — the driver app's job is background GPS
// + the negotiation flow, not route browsing, so this uses the prototype's
// own "liteMap" fallback styling instead of pulling in a native map library.
export default function Home({ driver, setDriver, onLogout }: { driver: Driver; setDriver: (d: Driver) => void; onLogout: () => void }) {
  const [onlineBusy, setOnlineBusy] = useState(false);
  const [riderName, setRiderName] = useState('');
  const [showProfile, setShowProfile] = useState(false);
  const [adDismissed, setAdDismissed] = useState(false);
  const [chatOpen, setChatOpen] = useState(false);
  const { pricing, settings } = useFare();
  const stats = useDriverStats(driver.id);
  const ride = useDriverRide(driver.id);
  const ad = useActiveAd();
  const call = useVoiceCall(ride.trip ? ride.trip.id : null);
  usePushToken(driver.id);

  useEffect(() => {
    if (ride.cancelledNotice === 0) return;
    Alert.alert('تم إلغاء الرحلة', 'ألغى الراكب هذه الرحلة.');
  }, [ride.cancelledNotice]);

  // Close the chat whenever the active trip changes (finished, or a
  // different ride entirely) -- never leave it open over a stale rideId.
  useEffect(() => {
    setChatOpen(false);
  }, [ride.trip?.id]);

  // Loud, looping ringtone while a request is waiting on this driver — ported
  // from index.html's playTone() (same 660/880/660/990Hz triangle-wave chime,
  // same 1.6s cadence), rendered ahead of time to assets/ringtone.wav since
  // React Native has no Web Audio API to synthesize it live. playsInSilentMode
  // is required here: a driver whose phone is on silent/vibrate must still
  // hear a ride request, which is the whole point of "صوت عالي".
  const ringPlayer = useAudioPlayer(RINGTONE);
  useEffect(() => {
    setAudioModeAsync({ playsInSilentMode: true }).catch(() => undefined);
  }, []);
  useEffect(() => {
    try {
      ringPlayer.loop = true;
      ringPlayer.volume = 1;
      if (ride.incoming && !ride.muted) {
        ringPlayer
          .seekTo(0)
          .then(() => ringPlayer.play())
          .catch(() => undefined);
      } else {
        ringPlayer.pause();
      }
    } catch {
      // A ride request that rings silently is far better than one that
      // crashes the app — never let the tone break the actual negotiation.
    }
  }, [ride.incoming, ride.muted, ringPlayer]);

  const activeRiderId = ride.incoming?.riderId ?? ride.trip?.riderId ?? null;
  useEffect(() => {
    if (!activeRiderId) {
      setRiderName('');
      return;
    }
    let cancelled = false;
    supabase
      .from('riders')
      .select('name')
      .eq('id', activeRiderId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setRiderName(data.name);
      });
    return () => {
      cancelled = true;
    };
  }, [activeRiderId]);

  // drivers.online can flip to true from outside this screen (admin approving
  // a pending driver sets it directly) without background location actually
  // having been started for this app instance — reconcile on mount/whenever
  // it changes so "online" in the DB never lies about being tracked.
  useEffect(() => {
    if (!driver.online) return;
    let cancelled = false;
    (async () => {
      const already = await isBackgroundLocationRunning();
      if (already || cancelled) return;
      const granted = await requestLocationPermissions();
      if (cancelled) return;
      if (!granted) {
        await supabase.from('drivers').update({ online: false }).eq('id', driver.id);
        if (!cancelled) {
          setDriver({ ...driver, online: false });
          Alert.alert('صلاحية الموقع مطلوبة', 'تم فصلك تلقائياً — امنح صلاحية الموقع ثم فعّل الاتصال يدوياً.');
        }
        return;
      }
      try {
        await startBackgroundLocation();
      } catch (e) {
        console.error('[reconcile background location]', e);
        await supabase.from('drivers').update({ online: false }).eq('id', driver.id);
        if (!cancelled) {
          setDriver({ ...driver, online: false });
          Alert.alert('تعذّر تفعيل تتبع الموقع', 'تم فصلك تلقائياً — أعد تفعيل الاتصال من الشاشة الرئيسية.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [driver.online, driver.id]);

  const toggleOnline = async () => {
    if (onlineBusy) return;
    setOnlineBusy(true);
    try {
      if (driver.online) {
        await stopBackgroundLocation();
        await supabase.from('drivers').update({ online: false }).eq('id', driver.id);
        setDriver({ ...driver, online: false });
      } else {
        const granted = await requestLocationPermissions();
        if (!granted) {
          Alert.alert('صلاحية الموقع مطلوبة', 'لاستقبال طلبات الركوب يجب منح صلاحية الموقع، بما فيها الموقع في الخلفية.');
          return;
        }
        await startBackgroundLocation();
        await supabase.from('drivers').update({ online: true }).eq('id', driver.id);
        setDriver({ ...driver, online: true });
      }
    } catch (e) {
      Alert.alert('تعذّر تغيير الحالة', e instanceof Error ? e.message : 'حدث خطأ غير متوقع، حاول مرة أخرى.');
    } finally {
      setOnlineBusy(false);
    }
  };

  const handleLogout = async () => {
    if (driver.online) {
      await stopBackgroundLocation();
      await supabase.from('drivers').update({ online: false }).eq('id', driver.id);
    }
    onLogout();
  };

  const handleToggleWait = () => {
    if (ride.toggleWait() === 'blocked') {
      Alert.alert('', 'لا يمكنك تشغيل العداد أكثر من مرتين لكل رحلة');
    }
  };

  const total = driver.acceptedCount + driver.rejectedCount;
  const acceptRate = total > 0 ? `${Math.round((driver.acceptedCount * 100) / total)}%` : '—';
  const waitHasTotal = ride.waitTotal > 0;
  const currency: CurrencyCode = pricing?.currency ?? 'SYP';

  const incoming = ride.incoming;
  const reqDistance =
    incoming && driver.lat != null && driver.lng != null
      ? `${(haversineKm([driver.lat, driver.lng], [incoming.pickupLat, incoming.pickupLng]) * 1.32).toFixed(1)} كم`
      : '—';
  const reqHasFare = !!(incoming && incoming.fareAmount != null) && settings?.showToRiders !== false;
  const reqTripMeta = incoming && incoming.km != null && incoming.minutes != null ? `${incoming.km.toFixed(1)} كم · ${Math.max(1, Math.round(incoming.minutes))} دقيقة` : '';

  if (showProfile) {
    return <Profile driver={driver} setDriver={setDriver} onBack={() => setShowProfile(false)} />;
  }

  return (
    <View style={styles.root}>
      <LinearGradient colors={[COLORS.cream, '#e9e4d4']} style={styles.mapBg}>
        <Image source={TAXI_WATERMARK} style={styles.mapWatermark} resizeMode="contain" />
      </LinearGradient>

      <View style={styles.topBar}>
        <Pressable onPress={() => setShowProfile(true)} style={styles.profileCard}>
          <View style={styles.avatar}>
            {driver.selfieUrl ? (
              <Image source={{ uri: driver.selfieUrl }} style={styles.avatarImg} />
            ) : (
              <Text style={styles.avatarText}>{driver.name.slice(0, 1)}</Text>
            )}
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.profileName} numberOfLines={1}>{driver.name}</Text>
            <Text style={styles.profileSub} numberOfLines={1}>{driver.plate} · {driver.car}</Text>
          </View>
        </Pressable>
        <Pressable onPress={handleLogout} style={styles.iconBtn}>
          <Text style={styles.iconBtnText}>خروج</Text>
        </Pressable>
      </View>

      <Pressable onPress={handleToggleWait} disabled={!ride.waitRunning && ride.waitRuns >= ride.maxWaitRuns} style={[styles.waitBtn, ride.waitRunning && styles.waitBtnActive, !ride.waitRunning && ride.waitRuns >= ride.maxWaitRuns && { opacity: 0.55 }]}>
        <Text style={[styles.waitBtnLabel, ride.waitRunning && styles.waitBtnLabelActive]}>
          {ride.waitRunning ? 'إيقاف' : ride.waitRuns >= ride.maxWaitRuns ? 'انتهى' : 'انتظار'}
        </Text>
        {ride.waitRunning && <Text style={styles.waitBtnClock}>{fmtClock(ride.waitSeconds)}</Text>}
      </Pressable>

      <View style={{ flex: 1 }} />

      <View style={styles.sheet}>
        <View style={styles.grabber} />

        {waitHasTotal && (
          <View style={styles.waitPanel}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.waitPanelTitle}>{ride.waitRunning ? 'عدّاد الانتظار يعمل' : 'مجموع وقت الانتظار'}</Text>
              <Text style={styles.waitPanelSub}>
                {fmtClock(ride.waitTotal)} · {ride.waitRuns >= ride.maxWaitRuns ? 'استُخدم العداد مرتين — الحد الأقصى لهذه الرحلة' : `المتبقي في هذه الرحلة: ${ride.maxWaitRuns - ride.waitRuns} تشغيل`}
              </Text>
            </View>
            <Text style={styles.waitPanelFare}>{pricing ? fmtMoney(pricing.currency, waitFareOf(pricing, ride.waitTotal)) : ''}</Text>
          </View>
        )}

        {ride.trip ? (
          <View>
            <Text style={styles.tripTitle}>{TRIP_TITLES[ride.trip.status] ?? ''}</Text>

            {ride.trip.status === 'toPickup' && (
              <View style={{ marginTop: 12, marginBottom: 4 }}>
                <PickupMap lat={ride.trip.pickupLat} lng={ride.trip.pickupLng} label={ride.trip.pickupName} />
              </View>
            )}

            <View style={{ marginTop: 14, gap: 10 }}>
              <View>
                <Text style={styles.tripLabel}>موقع الراكب</Text>
                <View style={styles.tripRow}>
                  <View style={styles.dotGreen} />
                  <Text style={styles.tripValue}>{ride.trip.pickupName}</Text>
                </View>
              </View>
              <View>
                <Text style={styles.tripLabel}>الوجهة</Text>
                <View style={styles.tripRow}>
                  <View style={styles.dotBlack} />
                  <Text style={styles.tripValue}>{ride.trip.destName}</Text>
                </View>
              </View>
            </View>
            <View style={styles.tripActionsRow}>
              <Pressable onPress={call.startCall} style={styles.callBtn}>
                <Text style={styles.callBtnText}>اتصال</Text>
              </Pressable>
              <Pressable onPress={() => setChatOpen(true)} style={styles.messageBtn}>
                <Text style={styles.messageBtnText}>مراسلة</Text>
              </Pressable>
              <Pressable onPress={ride.advanceTrip} style={styles.advanceBtn}>
                <Text style={styles.advanceBtnText}>{TRIP_ACTION_LABELS[ride.trip.status] ?? 'إنهاء الرحلة'}</Text>
              </Pressable>
            </View>
          </View>
        ) : (
          <View>
            <View style={styles.onlineCard}>
              <View style={{ flex: 1 }}>
                <Text style={styles.onlineTitle}>{driver.online ? 'أنت متصل — جاهز للطلبات' : 'أنت غير متصل'}</Text>
                <Text style={styles.onlineSub}>{driver.online ? 'يتم تحديث موقعك تلقائياً' : 'فعّل الاتصال لاستقبال طلبات الركاب'}</Text>
              </View>
              <Pressable onPress={toggleOnline} disabled={onlineBusy} style={[styles.onlineSwitch, driver.online && styles.onlineSwitchOn]}>
                <View style={styles.onlineKnob} />
              </Pressable>
            </View>
            <View style={styles.statsRow}>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{stats.tripsToday}</Text>
                <Text style={styles.statLabel}>رحلات اليوم</Text>
              </View>
              <View style={styles.statCard}>
                <Text style={styles.statNum}>{acceptRate}</Text>
                <Text style={styles.statLabel}>نسبة القبول</Text>
              </View>
              <View style={[styles.statCard, styles.statCardYellow]}>
                <Text style={styles.statNum}>★ {stats.avgRating}</Text>
                <Text style={styles.statLabelDark}>التقييم</Text>
              </View>
            </View>
          </View>
        )}
      </View>

      {incoming && (
        <ScrollView style={styles.incomingOverlay} contentContainerStyle={styles.incomingContent}>
          <View style={styles.incomingHeader}>
            <View style={styles.pulseDot} />
            <Text style={styles.incomingHeaderText}>طلب رحلة جديد</Text>
            <View style={{ flex: 1 }} />
            <Pressable onPress={ride.toggleMute} style={styles.muteBtn}>
              <Text style={styles.muteBtnText}>{ride.muted ? 'تفعيل الصوت' : 'كتم الصوت'}</Text>
            </Pressable>
          </View>

          <View style={styles.countdownWrap}>
            <Text style={styles.countdownNum}>{ride.countdown}</Text>
            <Text style={styles.countdownLabel}>ثانية</Text>
          </View>

          <View style={styles.reqCard}>
            <View style={styles.reqRow}>
              <View style={styles.dotGreenSm} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.reqLabel}>نقطة الانطلاق</Text>
                <Text style={styles.reqValue}>{incoming.pickupName}</Text>
              </View>
              <Text style={styles.reqDistance}>{reqDistance}</Text>
            </View>
            <View style={[styles.reqRow, styles.reqRowLast]}>
              <View style={styles.dotYellowSm} />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.reqLabel}>الوجهة</Text>
                <Text style={styles.reqValue}>{incoming.destName}</Text>
              </View>
            </View>
          </View>

          {reqHasFare && (
            <View style={styles.fareBox}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={styles.fareBoxTitle}>أجرة الرحلة</Text>
                <Text style={styles.fareBoxMeta}>{reqTripMeta}</Text>
              </View>
              <Text style={styles.fareBoxAmount}>{fmtMoney(incoming.fareCurrency ?? currency, incoming.fareAmount ?? 0)}</Text>
            </View>
          )}

          <Text style={styles.riderLine}>الراكب: {riderName || '…'}</Text>

          <View style={{ flex: 1, minHeight: 16 }} />

          <View style={styles.incomingActions}>
            <Pressable onPress={ride.reject} style={styles.rejectBtn}>
              <Text style={styles.rejectBtnText}>رفض</Text>
            </Pressable>
            <Pressable onPress={ride.accept} style={styles.acceptBtn}>
              <Text style={styles.acceptBtnText}>قبول الطلب</Text>
            </Pressable>
          </View>
        </ScrollView>
      )}

      {ride.justCompleted && (
        <RateRiderOverlay rideId={ride.justCompleted.rideId} riderId={ride.justCompleted.riderId} onDone={ride.clearJustCompleted} />
      )}

      {chatOpen && ride.trip && <ChatOverlay rideId={ride.trip.id} myId={driver.id} onClose={() => setChatOpen(false)} />}

      <CallOverlay call={call} />

      {ad && !adDismissed && <AdOverlay ad={ad} onClose={() => setAdDismissed(true)} />}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.white },
  mapBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' },
  mapWatermark: { width: 130, height: 290, opacity: 0.16 },
  topBar: { padding: 12, flexDirection: 'row', gap: 8, alignItems: 'center' },
  profileCard: {
    flex: 1,
    backgroundColor: COLORS.white,
    borderRadius: 14,
    padding: 10,
    paddingHorizontal: 13,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    elevation: 3,
    shadowColor: COLORS.black,
    shadowOpacity: 0.12,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 }
  },
  avatar: { width: 34, height: 34, borderRadius: 11, backgroundColor: COLORS.cream, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { fontSize: 13, fontFamily: FONT.extraBold, color: COLORS.black },
  profileName: { fontSize: 13, fontFamily: FONT.bold, color: COLORS.black, textAlign: 'right' },
  profileSub: { fontSize: 11, fontFamily: FONT.regular, color: COLORS.textMuted, textAlign: 'right', marginTop: 2 },
  iconBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.white, borderWidth: 1, borderColor: 'rgba(24,22,25,0.1)', alignItems: 'center', justifyContent: 'center', elevation: 3 },
  iconBtnText: { fontSize: 11, fontFamily: FONT.bold, color: COLORS.danger },
  waitBtn: { position: 'absolute', top: 120, left: 12, width: 70, borderWidth: 2, borderColor: 'rgba(24,22,25,0.1)', borderRadius: 18, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center', gap: 5, backgroundColor: COLORS.white, elevation: 4 },
  waitBtnActive: { borderColor: COLORS.danger, backgroundColor: COLORS.danger },
  waitBtnLabel: { fontSize: 10, fontFamily: FONT.bold, color: COLORS.black },
  waitBtnLabelActive: { color: COLORS.white },
  waitBtnClock: { fontSize: 12, fontFamily: FONT.extraBold, color: COLORS.white },
  sheet: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    padding: 18,
    paddingTop: 16,
    elevation: 12,
    shadowColor: COLORS.black,
    shadowOpacity: 0.18,
    shadowRadius: 22,
    shadowOffset: { width: 0, height: -6 }
  },
  grabber: { width: 44, height: 4, borderRadius: 4, backgroundColor: '#e2dcca', alignSelf: 'center', marginBottom: 14 },
  waitPanel: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.cream, borderRadius: 14, padding: 13, marginBottom: 12 },
  waitPanelTitle: { fontSize: 12.5, fontFamily: FONT.bold, color: COLORS.black, textAlign: 'right' },
  waitPanelSub: { fontSize: 11.5, fontFamily: FONT.regular, color: COLORS.textMuted, textAlign: 'right', marginTop: 4 },
  waitPanelFare: { fontSize: 16, fontFamily: FONT.extraBold, color: COLORS.black },
  onlineCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    backgroundColor: COLORS.black,
    borderRadius: 18,
    padding: 16
  },
  onlineTitle: { fontSize: 17, fontFamily: FONT.extraBold, color: COLORS.white, textAlign: 'right' },
  onlineSub: { fontSize: 12, fontFamily: FONT.regular, color: 'rgba(244,239,225,0.65)', textAlign: 'right', marginTop: 4 },
  onlineSwitch: { width: 62, height: 34, borderRadius: 20, backgroundColor: 'rgba(244,239,225,0.18)', padding: 3, justifyContent: 'center', alignItems: 'flex-end' },
  onlineSwitchOn: { backgroundColor: COLORS.green, alignItems: 'flex-start' },
  onlineKnob: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.white },
  statsRow: { flexDirection: 'row', gap: 9, marginTop: 14 },
  statCard: { flex: 1, backgroundColor: '#faf8f2', borderRadius: 14, padding: 12, alignItems: 'center' },
  statCardYellow: { backgroundColor: COLORS.yellow },
  statNum: { fontSize: 19, fontFamily: FONT.heavy, color: COLORS.black },
  statLabel: { fontSize: 11, fontFamily: FONT.medium, color: COLORS.textMuted, marginTop: 5, textAlign: 'center' },
  statLabelDark: { fontSize: 11, fontFamily: FONT.medium, color: COLORS.black, marginTop: 5, textAlign: 'center' },
  tripTitle: { fontSize: 17, fontFamily: FONT.extraBold, color: COLORS.black, textAlign: 'right' },
  tripLabel: { fontSize: 10.5, fontFamily: FONT.medium, color: COLORS.textMuted, textAlign: 'right', marginBottom: 4 },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tripValue: { fontSize: 14.5, fontFamily: FONT.bold, color: COLORS.black, textAlign: 'right', flex: 1 },
  dotGreen: { width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.green },
  dotBlack: { width: 9, height: 9, borderRadius: 2, backgroundColor: COLORS.black },
  tripActionsRow: { flexDirection: 'row', gap: 9, marginTop: 16 },
  callBtn: { flex: 1, paddingVertical: 15, borderRadius: 14, backgroundColor: COLORS.green, alignItems: 'center' },
  callBtnText: { color: COLORS.white, fontFamily: FONT.bold, fontSize: 13.5 },
  messageBtn: { flex: 1, paddingVertical: 15, borderWidth: 1.5, borderColor: 'rgba(24,22,25,0.14)', borderRadius: 14, alignItems: 'center' },
  messageBtnText: { color: COLORS.black, fontFamily: FONT.bold, fontSize: 13.5 },
  advanceBtn: { flex: 2, paddingVertical: 15, borderRadius: 14, backgroundColor: COLORS.green, alignItems: 'center' },
  advanceBtnText: { color: COLORS.white, fontFamily: FONT.extraBold, fontSize: 15 },
  incomingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: COLORS.black },
  incomingContent: { padding: 22, paddingTop: 24, minHeight: '100%' },
  incomingHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pulseDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.yellow },
  incomingHeaderText: { fontSize: 13, fontFamily: FONT.bold, color: COLORS.yellow },
  muteBtn: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, paddingVertical: 7, paddingHorizontal: 10 },
  muteBtnText: { color: COLORS.cream, fontSize: 11, fontFamily: FONT.medium },
  countdownWrap: { marginVertical: 22, alignSelf: 'center', width: 118, height: 118, borderRadius: 59, borderWidth: 3, borderColor: COLORS.yellow, alignItems: 'center', justifyContent: 'center' },
  countdownNum: { fontSize: 40, fontFamily: FONT.heavy, color: COLORS.yellow },
  countdownLabel: { fontSize: 11, fontFamily: FONT.medium, color: 'rgba(244,239,225,0.6)', marginTop: 4 },
  reqCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 20, padding: 18 },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  reqRowLast: { paddingTop: 13, paddingBottom: 0, borderBottomWidth: 0 },
  dotGreenSm: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22c55e' },
  dotYellowSm: { width: 10, height: 10, borderRadius: 2, backgroundColor: COLORS.yellow },
  reqLabel: { fontSize: 10.5, fontFamily: FONT.medium, color: 'rgba(244,239,225,0.6)', textAlign: 'right' },
  reqValue: { fontSize: 14.5, fontFamily: FONT.bold, color: COLORS.cream, textAlign: 'right', marginTop: 4 },
  reqDistance: { fontSize: 12, fontFamily: FONT.bold, color: COLORS.yellow },
  fareBox: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.yellow, borderRadius: 16, padding: 14 },
  fareBoxTitle: { fontSize: 11.5, fontFamily: FONT.medium, color: COLORS.black, textAlign: 'right' },
  fareBoxMeta: { fontSize: 11, fontFamily: FONT.regular, color: COLORS.black, opacity: 0.7, textAlign: 'right', marginTop: 2 },
  fareBoxAmount: { fontSize: 22, fontFamily: FONT.heavy, color: COLORS.black },
  riderLine: { marginTop: 12, fontSize: 12, fontFamily: FONT.regular, color: 'rgba(244,239,225,0.65)', textAlign: 'right' },
  incomingActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  rejectBtn: { flex: 1, paddingVertical: 17, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)', borderRadius: 16, alignItems: 'center' },
  rejectBtnText: { color: COLORS.cream, fontFamily: FONT.extraBold, fontSize: 15 },
  acceptBtn: { flex: 2, paddingVertical: 17, borderRadius: 16, backgroundColor: COLORS.yellow, alignItems: 'center' },
  acceptBtnText: { color: COLORS.black, fontFamily: FONT.heavy, fontSize: 16 }
});
