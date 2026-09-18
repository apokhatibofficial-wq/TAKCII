import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';
import { supabase } from '../lib/supabase';
import { COLORS, FONT } from '../theme';
import type { Driver } from '@takc/shared';

// Ported from index.html's dPendingScreen block.
export default function Pending({ driver, onApproved }: { driver: Driver; onApproved: () => void }) {
  const [checking, setChecking] = useState(false);

  const checkApproval = async () => {
    setChecking(true);
    try {
      const { data } = await supabase.from('drivers').select('status').eq('id', driver.id).maybeSingle();
      if (data?.status === 'active') onApproved();
    } finally {
      setChecking(false);
    }
  };

  return (
    <View style={styles.wrap}>
      <Text style={styles.icon}>⏳</Text>
      <Text style={styles.title}>حسابك قيد المراجعة</Text>
      <Text style={styles.body}>استلمنا بياناتك ووثائق السيارة. يقوم فريق TAK-C بمراجعتها وتفعيل حسابك من لوحة التحكم.</Text>

      <View style={styles.card}>
        <Row label="الاسم" value={driver.name} />
        <Row label="اللوحة" value={driver.plate} ltr />
        <Row label="الحالة" value="قيد المراجعة" tone={COLORS.textMuted} />
      </View>

      <Pressable onPress={checkApproval} disabled={checking} style={[styles.btn, checking && { opacity: 0.6 }]}>
        {checking ? <ActivityIndicator color={COLORS.yellow} /> : <Text style={styles.btnText}>تحديث الحالة</Text>}
      </Pressable>
    </View>
  );
}

function Row({ label, value, ltr, tone }: { label: string; value: string; ltr?: boolean; tone?: string }) {
  return (
    <View style={styles.row}>
      <Text style={[styles.rowValue, ltr && { direction: 'ltr' }, tone && { color: tone }]}>{value}</Text>
      <Text style={styles.rowLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { flex: 1, backgroundColor: COLORS.white, padding: 26, justifyContent: 'center', alignItems: 'center' },
  icon: { fontSize: 44, marginBottom: 14 },
  title: { fontSize: 21, fontFamily: FONT.heavy, color: COLORS.black, textAlign: 'center' },
  body: { fontSize: 13, fontFamily: FONT.regular, color: COLORS.textMuted, textAlign: 'center', marginTop: 10, lineHeight: 21 },
  card: { width: '100%', backgroundColor: COLORS.white, borderWidth: 1, borderColor: '#efe9d8', borderRadius: 16, padding: 14, marginTop: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 7 },
  rowLabel: { fontSize: 12.5, fontFamily: FONT.medium, color: COLORS.textMuted },
  rowValue: { fontSize: 12.5, fontFamily: FONT.medium, color: COLORS.black },
  btn: { backgroundColor: COLORS.black, borderRadius: 14, paddingVertical: 14, paddingHorizontal: 28, marginTop: 18 },
  btnText: { color: COLORS.yellow, fontFamily: FONT.extraBold, fontSize: 14 }
});
