import { useEffect, useRef, useState } from 'react';
import { FlatList, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';
import { useRideMessages } from '../hooks/useRideMessages';
import { COLORS, FONT } from '../theme';

// In-app messaging with the matched rider -- the only way a driver can reach
// the rider now that phone numbers are hidden from both sides
// (0021_phone_privacy_and_ride_messages.sql). Driver-side twin of the rider
// app's ChatOverlay, styled to match RateRiderOverlay's full-screen overlay
// convention instead of a native Modal.
export default function ChatOverlay({ rideId, myId, onClose }: { rideId: string; myId: string; onClose: () => void }) {
  const { messages, send, sending } = useRideMessages(rideId);
  const [text, setText] = useState('');
  const listRef = useRef<FlatList>(null);

  useEffect(() => {
    if (messages.length) listRef.current?.scrollToEnd({ animated: true });
  }, [messages.length]);

  const submit = async () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    await send(body);
  };

  return (
    <View style={styles.overlay}>
      <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={styles.kav}>
        <View style={styles.card}>
          <View style={styles.header}>
            <Text style={styles.headerText}>مراسلة الراكب</Text>
            <Pressable onPress={onClose} style={styles.closeBtn}>
              <Text style={styles.closeBtnText}>✕</Text>
            </Pressable>
          </View>

          <FlatList
            ref={listRef}
            data={messages}
            keyExtractor={(m) => m.id}
            style={styles.list}
            contentContainerStyle={styles.listContent}
            ListEmptyComponent={<Text style={styles.emptyText}>لا توجد رسائل بعد</Text>}
            renderItem={({ item }) => (
              <View style={item.senderId === myId ? styles.bubbleMineWrap : styles.bubbleTheirsWrap}>
                <View style={item.senderId === myId ? styles.bubbleMine : styles.bubbleTheirs}>
                  <Text style={item.senderId === myId ? styles.bubbleTextMine : styles.bubbleTextTheirs}>{item.body}</Text>
                </View>
              </View>
            )}
          />

          <View style={styles.inputRow}>
            <TextInput
              value={text}
              onChangeText={setText}
              placeholder="اكتب رسالة…"
              placeholderTextColor={COLORS.textMuted}
              style={styles.input}
              textAlign="right"
              onSubmitEditing={submit}
            />
            <Pressable onPress={submit} disabled={sending || !text.trim()} style={[styles.sendBtn, (sending || !text.trim()) && { opacity: 0.5 }]}>
              <Text style={styles.sendBtnText}>إرسال</Text>
            </Pressable>
          </View>
        </View>
      </KeyboardAvoidingView>
    </View>
  );
}

const styles = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(24,22,25,0.55)', justifyContent: 'flex-end' },
  kav: { width: '100%' },
  card: { backgroundColor: COLORS.white, borderTopLeftRadius: 22, borderTopRightRadius: 22, maxHeight: '75%', minHeight: 320 },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16, paddingBottom: 12, borderBottomWidth: 1, borderBottomColor: '#f0ece0' },
  headerText: { fontSize: 15, fontFamily: FONT.extraBold, color: COLORS.black },
  closeBtn: { padding: 4 },
  closeBtnText: { fontSize: 16, color: COLORS.textMuted },
  list: { flexGrow: 0 },
  listContent: { padding: 14, gap: 8, flexGrow: 1 },
  emptyText: { margin: 'auto', fontSize: 12.5, fontFamily: FONT.medium, color: COLORS.textMuted, textAlign: 'center', marginTop: 40 },
  bubbleMineWrap: { alignItems: 'flex-end', marginBottom: 8 },
  bubbleTheirsWrap: { alignItems: 'flex-start', marginBottom: 8 },
  bubbleMine: { maxWidth: '75%', paddingVertical: 9, paddingHorizontal: 13, borderRadius: 14, borderBottomRightRadius: 4, backgroundColor: COLORS.black },
  bubbleTheirs: { maxWidth: '75%', paddingVertical: 9, paddingHorizontal: 13, borderRadius: 14, borderBottomLeftRadius: 4, backgroundColor: COLORS.cream },
  bubbleTextMine: { fontSize: 13, fontFamily: FONT.medium, color: COLORS.yellow },
  bubbleTextTheirs: { fontSize: 13, fontFamily: FONT.medium, color: COLORS.black },
  inputRow: { flexDirection: 'row', gap: 9, padding: 14, borderTopWidth: 1, borderTopColor: '#f0ece0' },
  input: { flex: 1, paddingHorizontal: 13, paddingVertical: 11, borderWidth: 1.5, borderColor: '#e7e1d0', borderRadius: 13, backgroundColor: '#faf8f2', fontSize: 13.5, fontFamily: FONT.regular, color: COLORS.black },
  sendBtn: { paddingHorizontal: 18, borderRadius: 13, backgroundColor: COLORS.green, alignItems: 'center', justifyContent: 'center' },
  sendBtnText: { color: COLORS.white, fontFamily: FONT.bold, fontSize: 13 }
});
