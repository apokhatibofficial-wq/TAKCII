import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { useRideMessages } from '../hooks/useRideMessages';
import { supabase } from '../lib/supabase';

// In-app messaging with the matched driver -- the only way a rider can
// reach the driver now that phone numbers are hidden from both sides
// (0021_phone_privacy_and_ride_messages.sql). Styled as a bottom-anchored
// card over a backdrop, same weight as AdOverlay.
export default function ChatOverlay({ rideId, onClose }: { rideId: string; onClose: () => void }) {
  const { messages, send, sending } = useRideMessages(rideId);
  const [text, setText] = useState('');
  const [myId, setMyId] = useState<string | null>(null);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setMyId(data.user?.id ?? null));
  }, []);

  useEffect(() => {
    listRef.current?.scrollTo({ top: listRef.current.scrollHeight });
  }, [messages.length]);

  const submit = async () => {
    const body = text.trim();
    if (!body) return;
    setText('');
    await send(body);
  };

  return (
    <div style={backdropStyle} onClick={onClose}>
      <div style={cardStyle} onClick={(e) => e.stopPropagation()}>
        <div style={headerStyle}>
          <span style={{ font: "800 15px/1.3 FreePalestine,Tajawal,sans-serif" }}>مراسلة السائق</span>
          <button onClick={onClose} style={closeIconStyle}>✕</button>
        </div>
        <div ref={listRef} style={listStyle}>
          {messages.length === 0 && <div style={emptyStyle}>لا توجد رسائل بعد</div>}
          {messages.map((m) => (
            <div key={m.id} style={m.senderId === myId ? bubbleMineWrap : bubbleTheirsWrap}>
              <div style={m.senderId === myId ? bubbleMineStyle : bubbleTheirsStyle}>{m.body}</div>
            </div>
          ))}
        </div>
        <div style={inputRowStyle}>
          <input
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && submit()}
            placeholder="اكتب رسالة…"
            style={inputStyle}
          />
          <button onClick={submit} disabled={sending || !text.trim()} style={{ ...sendBtnStyle, opacity: sending || !text.trim() ? 0.5 : 1 }}>
            إرسال
          </button>
        </div>
      </div>
    </div>
  );
}

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(24,22,25,.55)',
  zIndex: 200,
  display: 'flex',
  alignItems: 'flex-end',
  justifyContent: 'center'
};
const cardStyle: CSSProperties = {
  background: '#fff',
  borderRadius: '22px 22px 0 0',
  width: '100%',
  maxWidth: 430,
  maxHeight: '75vh',
  display: 'flex',
  flexDirection: 'column',
  boxShadow: '0 -20px 50px -20px rgba(0,0,0,.5)'
};
const headerStyle: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 16px 12px',
  borderBottom: '1px solid #f0ece0'
};
const closeIconStyle: CSSProperties = { border: 'none', background: 'none', fontSize: 16, color: '#575757', cursor: 'pointer' };
const listStyle: CSSProperties = { flex: 1, overflowY: 'auto', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: 8, minHeight: 160 };
const emptyStyle: CSSProperties = {
  margin: 'auto',
  font: "500 12.5px/1.6 'IBM Plex Sans Arabic',sans-serif",
  color: '#8b8b8b'
};
const bubbleMineWrap: CSSProperties = { display: 'flex', justifyContent: 'flex-end' };
const bubbleTheirsWrap: CSSProperties = { display: 'flex', justifyContent: 'flex-start' };
const bubbleBase: CSSProperties = {
  maxWidth: '75%',
  padding: '9px 13px',
  borderRadius: 14,
  font: "500 13px/1.5 'IBM Plex Sans Arabic',sans-serif",
  wordBreak: 'break-word'
};
const bubbleMineStyle: CSSProperties = { ...bubbleBase, background: 'var(--color-black)', color: 'var(--color-cream)', borderBottomRightRadius: 4 };
const bubbleTheirsStyle: CSSProperties = { ...bubbleBase, background: '#f0ece0', color: 'var(--color-black)', borderBottomLeftRadius: 4 };
const inputRowStyle: CSSProperties = { display: 'flex', gap: 9, padding: 14, borderTop: '1px solid #f0ece0' };
const inputStyle: CSSProperties = {
  flex: 1,
  padding: '11px 13px',
  border: '1.5px solid #e7e1d0',
  borderRadius: 13,
  background: '#faf8f2',
  fontSize: 13.5
};
const sendBtnStyle: CSSProperties = {
  padding: '11px 18px',
  border: 'none',
  borderRadius: 13,
  background: 'var(--color-green)',
  color: '#fff',
  font: "700 13px/1.35 'IBM Plex Sans Arabic',sans-serif",
  cursor: 'pointer'
};
