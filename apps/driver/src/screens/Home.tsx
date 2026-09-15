import { useEffect, useState } from 'react';
import { Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { isBackgroundLocationRunning, requestLocationPermissions, startBackgroundLocation, stopBackgroundLocation } from '../location/backgroundTask';
import { useDriverRide } from '../hooks/useDriverRide';
import { useDriverStats } from '../hooks/useDriverStats';
import { useFare } from '../hooks/useFare';
import { COLORS } from '../theme';
import { fmtMoney, haversineKm, waitFareOf, type CurrencyCode, type Driver } from '@takc/shared';

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
  const { pricing, settings } = useFare();
  const stats = useDriverStats(driver.id);
  const ride = useDriverRide(driver.id, pricing);

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
      await startBackgroundLocation();
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

  return (
    <View style={styles.root}>
      <View style={styles.mapBg} />

      <View style={styles.topBar}>
        <View style={styles.profileCard}>
          <View style={styles.avatar}>
            <Text style={styles.avatarText}>{driver.name.slice(0, 1)}</Text>
          </View>
          <View style={{ flex: 1, minWidth: 0 }}>
            <Text style={styles.profileName} numberOfLines={1}>{driver.name}</Text>
            <Text style={styles.profileSub} numberOfLines={1}>{driver.plate} · {driver.car}</Text>
          </View>
        </View>
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
            <View style={{ marginTop: 10, gap: 9 }}>
              <View style={styles.tripRow}>
                <View style={styles.dotGreen} />
                <Text style={styles.tripRowText}>{ride.trip.pickupName}</Text>
              </View>
              <View style={styles.tripRow}>
                <View style={styles.dotBlack} />
                <Text style={styles.tripRowText}>{ride.trip.destName}</Text>
              </View>
            </View>
            <Pressable onPress={ride.advanceTrip} style={styles.advanceBtn}>
              <Text style={styles.advanceBtnText}>{TRIP_ACTION_LABELS[ride.trip.status] ?? 'إنهاء الرحلة'}</Text>
            </Pressable>
          </View>
        ) : (
          <View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
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
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.white },
  mapBg: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: '#e9e4d4' },
  topBar: { padding: 12, flexDirection: 'row', gap: 8, alignItems: 'center' },
  profileCard: { flex: 1, backgroundColor: COLORS.white, borderRadius: 14, padding: 10, paddingHorizontal: 13, flexDirection: 'row', alignItems: 'center', gap: 10, elevation: 3 },
  avatar: { width: 34, height: 34, borderRadius: 11, backgroundColor: COLORS.cream, alignItems: 'center', justifyContent: 'center' },
  avatarText: { fontSize: 13, fontWeight: '800', color: COLORS.black },
  profileName: { fontSize: 13, fontWeight: '700', color: COLORS.black, textAlign: 'right' },
  profileSub: { fontSize: 11, color: COLORS.textMuted, textAlign: 'right', marginTop: 2 },
  iconBtn: { width: 44, height: 44, borderRadius: 14, backgroundColor: COLORS.white, borderWidth: 1, borderColor: 'rgba(24,22,25,0.1)', alignItems: 'center', justifyContent: 'center', elevation: 3 },
  iconBtnText: { fontSize: 11, fontWeight: '700', color: COLORS.danger },
  waitBtn: { position: 'absolute', top: 120, left: 12, width: 70, borderWidth: 2, borderColor: 'rgba(24,22,25,0.1)', borderRadius: 18, paddingVertical: 10, paddingHorizontal: 6, alignItems: 'center', gap: 5, backgroundColor: COLORS.white, elevation: 4 },
  waitBtnActive: { borderColor: COLORS.danger, backgroundColor: COLORS.danger },
  waitBtnLabel: { fontSize: 10, fontWeight: '700', color: COLORS.black },
  waitBtnLabelActive: { color: COLORS.white },
  waitBtnClock: { fontSize: 12, fontWeight: '800', color: COLORS.white },
  sheet: { backgroundColor: COLORS.white, borderTopLeftRadius: 26, borderTopRightRadius: 26, padding: 18, paddingTop: 16 },
  grabber: { width: 44, height: 4, borderRadius: 4, backgroundColor: '#e2dcca', alignSelf: 'center', marginBottom: 14 },
  waitPanel: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.cream, borderRadius: 14, padding: 13, marginBottom: 12 },
  waitPanelTitle: { fontSize: 12.5, fontWeight: '700', color: COLORS.black, textAlign: 'right' },
  waitPanelSub: { fontSize: 11.5, color: COLORS.textMuted, textAlign: 'right', marginTop: 4 },
  waitPanelFare: { fontSize: 16, fontWeight: '800', color: COLORS.black },
  onlineTitle: { fontSize: 17, fontWeight: '800', color: COLORS.black, textAlign: 'right' },
  onlineSub: { fontSize: 12, color: COLORS.textMuted, textAlign: 'right', marginTop: 4 },
  onlineSwitch: { width: 62, height: 34, borderRadius: 20, backgroundColor: '#ddd7c7', padding: 3, justifyContent: 'center', alignItems: 'flex-end' },
  onlineSwitchOn: { backgroundColor: COLORS.green, alignItems: 'flex-start' },
  onlineKnob: { width: 28, height: 28, borderRadius: 14, backgroundColor: COLORS.white },
  statsRow: { flexDirection: 'row', gap: 9, marginTop: 14 },
  statCard: { flex: 1, backgroundColor: '#faf8f2', borderRadius: 14, padding: 12, alignItems: 'center' },
  statCardYellow: { backgroundColor: COLORS.yellow },
  statNum: { fontSize: 19, fontWeight: '900', color: COLORS.black },
  statLabel: { fontSize: 11, fontWeight: '500', color: COLORS.textMuted, marginTop: 5, textAlign: 'center' },
  statLabelDark: { fontSize: 11, fontWeight: '500', color: COLORS.black, marginTop: 5, textAlign: 'center' },
  tripTitle: { fontSize: 17, fontWeight: '800', color: COLORS.black, textAlign: 'right' },
  tripRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  tripRowText: { fontSize: 13, fontWeight: '600', color: COLORS.black, textAlign: 'right', flex: 1 },
  dotGreen: { width: 9, height: 9, borderRadius: 5, backgroundColor: COLORS.green },
  dotBlack: { width: 9, height: 9, borderRadius: 2, backgroundColor: COLORS.black },
  advanceBtn: { width: '100%', marginTop: 16, paddingVertical: 15, borderRadius: 14, backgroundColor: COLORS.green, alignItems: 'center' },
  advanceBtnText: { color: COLORS.white, fontWeight: '800', fontSize: 15 },
  incomingOverlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: COLORS.black },
  incomingContent: { padding: 22, paddingTop: 24, minHeight: '100%' },
  incomingHeader: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  pulseDot: { width: 10, height: 10, borderRadius: 5, backgroundColor: COLORS.yellow },
  incomingHeaderText: { fontSize: 13, fontWeight: '700', color: COLORS.yellow },
  muteBtn: { backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: 10, paddingVertical: 7, paddingHorizontal: 10 },
  muteBtnText: { color: COLORS.cream, fontSize: 11, fontWeight: '600' },
  countdownWrap: { marginVertical: 22, alignSelf: 'center', width: 118, height: 118, borderRadius: 59, borderWidth: 3, borderColor: COLORS.yellow, alignItems: 'center', justifyContent: 'center' },
  countdownNum: { fontSize: 40, fontWeight: '900', color: COLORS.yellow },
  countdownLabel: { fontSize: 11, fontWeight: '600', color: 'rgba(244,239,225,0.6)', marginTop: 4 },
  reqCard: { backgroundColor: 'rgba(255,255,255,0.06)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)', borderRadius: 20, padding: 18 },
  reqRow: { flexDirection: 'row', alignItems: 'center', gap: 11, paddingBottom: 13, borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.1)' },
  reqRowLast: { paddingTop: 13, paddingBottom: 0, borderBottomWidth: 0 },
  dotGreenSm: { width: 10, height: 10, borderRadius: 5, backgroundColor: '#22c55e' },
  dotYellowSm: { width: 10, height: 10, borderRadius: 2, backgroundColor: COLORS.yellow },
  reqLabel: { fontSize: 10.5, fontWeight: '500', color: 'rgba(244,239,225,0.6)', textAlign: 'right' },
  reqValue: { fontSize: 14.5, fontWeight: '700', color: COLORS.cream, textAlign: 'right', marginTop: 4 },
  reqDistance: { fontSize: 12, fontWeight: '700', color: COLORS.yellow },
  fareBox: { marginTop: 12, flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: COLORS.yellow, borderRadius: 16, padding: 14 },
  fareBoxTitle: { fontSize: 11.5, fontWeight: '600', color: COLORS.black, textAlign: 'right' },
  fareBoxMeta: { fontSize: 11, color: COLORS.black, opacity: 0.7, textAlign: 'right', marginTop: 2 },
  fareBoxAmount: { fontSize: 22, fontWeight: '900', color: COLORS.black },
  riderLine: { marginTop: 12, fontSize: 12, color: 'rgba(244,239,225,0.65)', textAlign: 'right' },
  incomingActions: { flexDirection: 'row', gap: 10, marginTop: 12 },
  rejectBtn: { flex: 1, paddingVertical: 17, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.22)', borderRadius: 16, alignItems: 'center' },
  rejectBtnText: { color: COLORS.cream, fontWeight: '800', fontSize: 15 },
  acceptBtn: { flex: 2, paddingVertical: 17, borderRadius: 16, backgroundColor: COLORS.yellow, alignItems: 'center' },
  acceptBtnText: { color: COLORS.black, fontWeight: '900', fontSize: 16 }
});
