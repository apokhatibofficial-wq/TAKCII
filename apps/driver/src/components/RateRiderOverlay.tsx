import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { COLORS, FONT } from '../theme';

export default function RateRiderOverlay({ rideId, riderId, onDone }: { rideId: string; riderId: string; onDone: () => void }) {
  const [riderName, setRiderName] = useState('');
  const [stars, setStars] = useState(0);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    let cancelled = false;
    supabase
      .from('riders')
      .select('name')
      .eq('id', riderId)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setRiderName(data.name);
      });
    return () => {
      cancelled = true;
    };
  }, [riderId]);

  const submit = async () => {
    if (!stars) return;
    setSubmitting(true);
    try {
      await supabase.rpc('rate_ride', { p_ride_id: rideId, p_stars: stars });
    } finally {
      onDone();
    }
  };

  return (
    <View style={styles.overlay}>
      <View style={styles.card}>
        <Text style={styles.title}>كيف كان الراكب {riderName || ''}؟</Text>
        <View style={styles.starsRow}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable key={n} onPress={() => setStars(n)} style={styles.starBtn}>
              <Text style={[styles.starText, n <= stars && styles.starTextFilled]}>{n <= stars ? '★' : '☆'}</Text>
            </Pressable>
          ))}
        </View>
        <Pressable onPress={submit} disabled={!stars || submitting} style={[styles.submitBtn, (!stars || submitting) && { opacity: 0.5 }]}>
          <Text style={styles.submitBtnText}>{submitting ? '...' : 'إرسال التقييم'}</Text>
        </Pressable>
        <Pressable onPress={onDone} disabled={submitting}>
          <Text style={styles.skipText}>تخطي</Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24,22,25,0.75)', alignItems: 'center', justifyContent: 'center', padding: 24 },
  card: { width: '100%', backgroundColor: COLORS.white, borderRadius: 22, padding: 24, alignItems: 'center' },
  title: { fontSize: 16, fontFamily: FONT.extraBold, color: COLORS.black, textAlign: 'center', marginBottom: 16 },
  starsRow: { flexDirection: 'row', gap: 4, marginBottom: 20 },
  starBtn: { padding: 4 },
  starText: { fontSize: 34, color: '#e2dcca' },
  starTextFilled: { color: COLORS.yellow },
  submitBtn: { width: '100%', backgroundColor: COLORS.black, borderRadius: 14, paddingVertical: 15, alignItems: 'center', marginBottom: 12 },
  submitBtnText: { color: COLORS.yellow, fontFamily: FONT.extraBold, fontSize: 14 },
  skipText: { fontSize: 12.5, fontFamily: FONT.medium, color: COLORS.textMuted }
});
