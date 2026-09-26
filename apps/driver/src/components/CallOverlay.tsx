import { useEffect } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import type { useVoiceCall } from '../hooks/useVoiceCall';
import { COLORS, FONT } from '../theme';

const ENDED_REASON_TEXT: Record<string, string> = {
  hangup: 'أنهى الراكب المكالمة',
  busy: 'الراكب مشغول بمكالمة أخرى',
  'no-answer': 'لم يجب الراكب',
  error: 'تعذّر إجراء الاتصال'
};

// In-app voice call with the matched rider -- driver-side twin of the rider
// app's CallOverlay, styled like RateRiderOverlay's full-screen overlay.
export default function CallOverlay({ call }: { call: ReturnType<typeof useVoiceCall> }) {
  const { status, muted, endedReason, acceptCall, declineCall, hangUp, toggleMute, clearEndedReason } = call;

  useEffect(() => {
    if (status !== 'idle' || !endedReason) return;
    const t = setTimeout(clearEndedReason, 2800);
    return () => clearTimeout(t);
  }, [status, endedReason, clearEndedReason]);

  if (status === 'idle') {
    if (!endedReason) return null;
    return (
      <View style={styles.toast}>
        <Text style={styles.toastText}>{ENDED_REASON_TEXT[endedReason] ?? ''}</Text>
      </View>
    );
  }

  const title =
    status === 'ringing-incoming'
      ? 'مكالمة واردة من الراكب'
      : status === 'ringing-outgoing'
        ? 'جارٍ الاتصال بالراكب…'
        : status === 'connecting'
          ? 'جارٍ الاتصال…'
          : 'مكالمة جارية';

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <View style={styles.iconWrap}>
          <Text style={styles.iconText}>☎</Text>
        </View>
        <Text style={styles.title}>{title}</Text>

        {status === 'ringing-incoming' ? (
          <View style={styles.actionsRow}>
            <Pressable onPress={declineCall} style={styles.declineBtn}>
              <Text style={styles.declineBtnText}>رفض</Text>
            </Pressable>
            <Pressable onPress={acceptCall} style={styles.acceptBtn}>
              <Text style={styles.acceptBtnText}>قبول</Text>
            </Pressable>
          </View>
        ) : (
          <View style={styles.actionsRow}>
            {status === 'connected' && (
              <Pressable onPress={toggleMute} style={styles.muteBtn}>
                <Text style={styles.muteBtnText}>{muted ? 'إلغاء الكتم' : 'كتم الصوت'}</Text>
              </Pressable>
            )}
            <Pressable onPress={hangUp} style={styles.hangupBtn}>
              <Text style={styles.hangupBtnText}>إنهاء</Text>
            </Pressable>
          </View>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24,22,25,0.75)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', maxWidth: 340, backgroundColor: COLORS.white, borderRadius: 24, paddingVertical: 30, paddingHorizontal: 24, alignItems: 'center' },
  iconWrap: { width: 72, height: 72, borderRadius: 36, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center', marginBottom: 18 },
  iconText: { fontSize: 28, color: COLORS.white },
  title: { fontSize: 16, fontFamily: FONT.extraBold, color: COLORS.black, textAlign: 'center', marginBottom: 22 },
  actionsRow: { flexDirection: 'row', gap: 10, width: '100%' },
  acceptBtn: { flex: 1, paddingVertical: 15, borderRadius: 14, backgroundColor: COLORS.green, alignItems: 'center' },
  acceptBtnText: { color: COLORS.white, fontFamily: FONT.bold, fontSize: 14 },
  declineBtn: { flex: 1, paddingVertical: 15, borderWidth: 1.5, borderColor: '#e7e1d0', borderRadius: 14, alignItems: 'center' },
  declineBtnText: { color: COLORS.danger, fontFamily: FONT.bold, fontSize: 14 },
  hangupBtn: { flex: 1, paddingVertical: 15, borderRadius: 14, backgroundColor: COLORS.danger, alignItems: 'center' },
  hangupBtnText: { color: COLORS.white, fontFamily: FONT.bold, fontSize: 14 },
  muteBtn: { flex: 1, paddingVertical: 15, borderWidth: 1.5, borderColor: '#e7e1d0', borderRadius: 14, alignItems: 'center' },
  muteBtnText: { color: COLORS.black, fontFamily: FONT.bold, fontSize: 14 },
  toast: { position: 'absolute', bottom: 30, left: 24, right: 24, backgroundColor: COLORS.black, borderRadius: 12, paddingVertical: 11, paddingHorizontal: 16, alignItems: 'center' },
  toastText: { color: COLORS.white, fontFamily: FONT.medium, fontSize: 12.5 }
});
