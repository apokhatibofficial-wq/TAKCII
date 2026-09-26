import { useEffect, type CSSProperties } from 'react';
import type { useVoiceCall } from '../hooks/useVoiceCall';

const ENDED_REASON_TEXT: Record<string, string> = {
  hangup: 'أنهى السائق المكالمة',
  busy: 'السائق مشغول بمكالمة أخرى',
  'no-answer': 'لم يجب السائق',
  error: 'تعذّر إجراء الاتصال'
};

// In-app voice call with the matched driver -- phone numbers stay hidden on
// both sides (0021), and now so does the call itself: it never leaves
// WebRTC/the ride's own signaling channel (0022_voice_call_signaling.sql).
export default function CallOverlay({ call }: { call: ReturnType<typeof useVoiceCall> }) {
  const { status, muted, endedReason, remoteAudioRef, acceptCall, declineCall, hangUp, toggleMute, clearEndedReason } = call;

  useEffect(() => {
    if (status !== 'idle' || !endedReason) return;
    const t = setTimeout(clearEndedReason, 2800);
    return () => clearTimeout(t);
  }, [status, endedReason, clearEndedReason]);

  if (status === 'idle') {
    if (!endedReason) return null;
    return (
      <div style={toastStyle}>
        <span>{ENDED_REASON_TEXT[endedReason] ?? ''}</span>
      </div>
    );
  }

  const title =
    status === 'ringing-incoming'
      ? 'مكالمة واردة من السائق'
      : status === 'ringing-outgoing'
        ? 'جارٍ الاتصال بالسائق…'
        : status === 'connecting'
          ? 'جارٍ الاتصال…'
          : 'مكالمة جارية';

  return (
    <div style={backdropStyle}>
      <audio ref={remoteAudioRef} autoPlay />
      <div style={cardStyle}>
        <div style={iconWrapStyle}>
          <span style={status === 'connected' ? iconCoreStyle : { ...iconCoreStyle, ...pulseStyle }}>☎</span>
        </div>
        <div style={titleStyle}>{title}</div>

        {status === 'ringing-incoming' ? (
          <div style={actionsRowStyle}>
            <button onClick={declineCall} style={declineBtnStyle}>رفض</button>
            <button onClick={acceptCall} style={acceptBtnStyle}>قبول</button>
          </div>
        ) : (
          <div style={actionsRowStyle}>
            {status === 'connected' && (
              <button onClick={toggleMute} style={muteBtnStyle}>{muted ? 'إلغاء الكتم' : 'كتم الصوت'}</button>
            )}
            <button onClick={hangUp} style={hangupBtnStyle}>إنهاء</button>
          </div>
        )}
      </div>
    </div>
  );
}

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(24,22,25,.7)',
  zIndex: 210,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  padding: 24
};
const cardStyle: CSSProperties = {
  background: '#fff',
  borderRadius: 24,
  width: '100%',
  maxWidth: 340,
  padding: '30px 24px 24px',
  textAlign: 'center',
  boxShadow: '0 24px 60px -20px rgba(0,0,0,.5)'
};
const iconWrapStyle: CSSProperties = { position: 'relative', width: 72, height: 72, margin: '0 auto 18px' };
const iconCoreStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: '50%',
  background: 'var(--color-green)',
  color: '#fff',
  display: 'grid',
  placeItems: 'center',
  fontSize: 28
};
const pulseStyle: CSSProperties = { boxShadow: '0 0 0 0 rgba(0,134,55,.5)', animation: 'takc-pulse 1.6s ease-out infinite' };
const titleStyle: CSSProperties = { font: "800 16px/1.4 FreePalestine,Tajawal,sans-serif", color: 'var(--color-black)', marginBottom: 22 };
const actionsRowStyle: CSSProperties = { display: 'flex', gap: 10, justifyContent: 'center' };
const acceptBtnStyle: CSSProperties = {
  flex: 1,
  padding: 14,
  border: 'none',
  borderRadius: 14,
  background: 'var(--color-green)',
  color: '#fff',
  font: "700 14px/1.35 'IBM Plex Sans Arabic',sans-serif",
  cursor: 'pointer'
};
const declineBtnStyle: CSSProperties = {
  flex: 1,
  padding: 14,
  border: '1.5px solid #e7e1d0',
  borderRadius: 14,
  background: '#fff',
  color: '#b3261e',
  font: "700 14px/1.35 'IBM Plex Sans Arabic',sans-serif",
  cursor: 'pointer'
};
const hangupBtnStyle: CSSProperties = {
  flex: 1,
  padding: 14,
  border: 'none',
  borderRadius: 14,
  background: '#b3261e',
  color: '#fff',
  font: "700 14px/1.35 'IBM Plex Sans Arabic',sans-serif",
  cursor: 'pointer'
};
const muteBtnStyle: CSSProperties = {
  flex: 1,
  padding: 14,
  border: '1.5px solid #e7e1d0',
  borderRadius: 14,
  background: '#fff',
  color: 'var(--color-black)',
  font: "700 14px/1.35 'IBM Plex Sans Arabic',sans-serif",
  cursor: 'pointer'
};
const toastStyle: CSSProperties = {
  position: 'fixed',
  bottom: 20,
  left: '50%',
  transform: 'translateX(-50%)',
  background: 'var(--color-black)',
  color: '#fff',
  padding: '11px 18px',
  borderRadius: 12,
  font: "600 12.5px/1.5 'IBM Plex Sans Arabic',sans-serif",
  zIndex: 210,
  boxShadow: '0 10px 30px -10px rgba(0,0,0,.5)'
};
