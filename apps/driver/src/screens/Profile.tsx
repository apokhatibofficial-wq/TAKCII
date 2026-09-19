import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from '../lib/supabase';
import { useDriverStats } from '../hooks/useDriverStats';
import { COLORS, FONT } from '../theme';
import type { Driver } from '@takc/shared';

export default function Profile({ driver, setDriver, onBack }: { driver: Driver; setDriver: (d: Driver) => void; onBack: () => void }) {
  const [name, setName] = useState(driver.name);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const stats = useDriverStats(driver.id);

  const changePhoto = async () => {
    const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!perm.granted) {
      Alert.alert('صلاحية مطلوبة', 'يحتاج التطبيق صلاحية الوصول للصور لاختيار صورة شخصية.');
      return;
    }
    const result = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.7, allowsEditing: true, aspect: [1, 1] });
    if (result.canceled || !result.assets[0]) return;

    setUploading(true);
    try {
      const asset = result.assets[0];
      const ext = asset.uri.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${driver.id}/avatar-${Date.now()}.${ext}`;
      const response = await fetch(asset.uri);
      const arrayBuffer = await response.arrayBuffer();
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(path, arrayBuffer, { contentType: asset.mimeType || 'image/jpeg' });
      if (uploadError) throw uploadError;

      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const { error: updateError } = await supabase.from('drivers').update({ selfie_url: publicUrlData.publicUrl }).eq('id', driver.id);
      if (updateError) throw updateError;

      setDriver({ ...driver, selfieUrl: publicUrlData.publicUrl });
    } catch (e) {
      Alert.alert('تعذّر تحديث الصورة', e instanceof Error ? e.message : String(e));
    } finally {
      setUploading(false);
    }
  };

  const saveName = async () => {
    const trimmed = name.trim();
    if (!trimmed || trimmed === driver.name) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('drivers').update({ name: trimmed }).eq('id', driver.id);
      if (error) throw error;
      setDriver({ ...driver, name: trimmed });
    } catch (e) {
      Alert.alert('تعذّر حفظ الاسم', e instanceof Error ? e.message : String(e));
      setName(driver.name);
    } finally {
      setSaving(false);
    }
  };

  return (
    <ScrollView style={styles.root} contentContainerStyle={styles.content}>
      <View style={styles.topBar}>
        <Pressable onPress={onBack} style={styles.backBtn}>
          <Text style={styles.backBtnText}>‹</Text>
        </Pressable>
        <Text style={styles.title}>حسابي</Text>
        <View style={styles.backBtn} />
      </View>

      <View style={styles.avatarWrap}>
        <Pressable onPress={changePhoto} disabled={uploading} style={styles.avatar}>
          {driver.selfieUrl ? (
            <Image source={{ uri: driver.selfieUrl }} style={styles.avatarImg} />
          ) : (
            <Text style={styles.avatarText}>{driver.name.slice(0, 1)}</Text>
          )}
          {uploading && (
            <View style={styles.avatarOverlay}>
              <ActivityIndicator color={COLORS.white} />
            </View>
          )}
        </Pressable>
        <Pressable onPress={changePhoto} disabled={uploading}>
          <Text style={styles.changePhotoText}>تغيير الصورة</Text>
        </Pressable>
      </View>

      <View style={styles.statsRow}>
        <View style={styles.statCard}>
          <Text style={styles.statNum}>{stats.tripsToday}</Text>
          <Text style={styles.statLabel}>رحلات اليوم</Text>
        </View>
        <View style={[styles.statCard, styles.statCardYellow]}>
          <Text style={styles.statNum}>★ {stats.avgRating}</Text>
          <Text style={styles.statLabelDark}>تقييمك</Text>
        </View>
      </View>

      <Text style={styles.label}>الاسم</Text>
      <View style={styles.nameRow}>
        <TextInput value={name} onChangeText={setName} style={styles.input} textAlign="right" />
        {name.trim() !== driver.name && (
          <Pressable onPress={saveName} disabled={saving} style={[styles.saveBtn, saving && { opacity: 0.6 }]}>
            {saving ? <ActivityIndicator color={COLORS.yellow} size="small" /> : <Text style={styles.saveBtnText}>حفظ</Text>}
          </Pressable>
        )}
      </View>

      <View style={styles.infoCard}>
        <InfoRow label="رقم الهاتف" value={driver.phone} />
        <InfoRow label="رقم اللوحة" value={driver.plate} ltr />
        <InfoRow label="السيارة" value={driver.car} />
        <InfoRow label="اسم المستخدم" value={driver.username} ltr />
      </View>
    </ScrollView>
  );
}

function InfoRow({ label, value, ltr }: { label: string; value: string; ltr?: boolean }) {
  return (
    <View style={styles.infoRow}>
      <Text style={[styles.infoValue, ltr && { direction: 'ltr' }]}>{value}</Text>
      <Text style={styles.infoLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: COLORS.white },
  content: { padding: 20, paddingTop: 54, paddingBottom: 40 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 },
  backBtn: { width: 38, height: 38, borderRadius: 12, alignItems: 'center', justifyContent: 'center' },
  backBtnText: { fontSize: 26, color: COLORS.black, fontFamily: FONT.bold },
  title: { fontSize: 16, fontFamily: FONT.extraBold, color: COLORS.black },
  avatarWrap: { alignItems: 'center', marginBottom: 22, gap: 10 },
  avatar: { width: 92, height: 92, borderRadius: 30, backgroundColor: COLORS.cream, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  avatarImg: { width: '100%', height: '100%' },
  avatarText: { fontSize: 32, fontFamily: FONT.extraBold, color: COLORS.black },
  avatarOverlay: { ...StyleSheet.absoluteFill, backgroundColor: 'rgba(0,0,0,0.4)', alignItems: 'center', justifyContent: 'center' },
  changePhotoText: { fontSize: 12.5, fontFamily: FONT.bold, color: COLORS.green },
  statsRow: { flexDirection: 'row', gap: 9, marginBottom: 24 },
  statCard: { flex: 1, backgroundColor: '#faf8f2', borderRadius: 14, padding: 14, alignItems: 'center' },
  statCardYellow: { backgroundColor: COLORS.yellow },
  statNum: { fontSize: 19, fontFamily: FONT.heavy, color: COLORS.black },
  statLabel: { fontSize: 11, fontFamily: FONT.medium, color: COLORS.textMuted, marginTop: 5 },
  statLabelDark: { fontSize: 11, fontFamily: FONT.medium, color: COLORS.black, marginTop: 5 },
  label: { fontSize: 12, fontFamily: FONT.medium, color: COLORS.textMuted, textAlign: 'right', marginBottom: 7 },
  nameRow: { flexDirection: 'row', gap: 9, marginBottom: 22 },
  input: {
    flex: 1,
    borderWidth: 1.5,
    borderColor: '#e7e1d0',
    borderRadius: 13,
    backgroundColor: '#faf8f2',
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 14,
    fontFamily: FONT.regular,
    color: COLORS.black
  },
  saveBtn: { backgroundColor: COLORS.black, borderRadius: 13, paddingHorizontal: 18, alignItems: 'center', justifyContent: 'center' },
  saveBtnText: { color: COLORS.yellow, fontFamily: FONT.extraBold, fontSize: 13 },
  infoCard: { backgroundColor: COLORS.white, borderWidth: 1, borderColor: '#efe9d8', borderRadius: 16, padding: 14 },
  infoRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#f5f1e6' },
  infoLabel: { fontSize: 12.5, fontFamily: FONT.medium, color: COLORS.textMuted },
  infoValue: { fontSize: 12.5, fontFamily: FONT.medium, color: COLORS.black }
});
