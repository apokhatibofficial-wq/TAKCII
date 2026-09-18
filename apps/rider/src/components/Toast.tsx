import { useEffect, useState, type CSSProperties } from 'react';

interface ToastMessage {
  id: number;
  text: string;
}

// Module-level pub/sub instead of context: showToast is called from a
// realtime-driven effect in Home.tsx, not from a place that naturally has a
// provider above it, and there's only ever one toast host mounted.
let nextId = 1;
const listeners = new Set<(msg: ToastMessage) => void>();

export function showToast(text: string): void {
  const msg = { id: nextId++, text };
  listeners.forEach((l) => l(msg));
}

export default function ToastHost() {
  const [messages, setMessages] = useState<ToastMessage[]>([]);

  useEffect(() => {
    const onMsg = (msg: ToastMessage) => {
      setMessages((cur) => [...cur, msg]);
      setTimeout(() => setMessages((cur) => cur.filter((m) => m.id !== msg.id)), 4000);
    };
    listeners.add(onMsg);
    return () => {
      listeners.delete(onMsg);
    };
  }, []);

  if (messages.length === 0) return null;

  return (
    <div style={hostStyle}>
      {messages.map((m) => (
        <div key={m.id} style={toastStyle}>
          {m.text}
        </div>
      ))}
    </div>
  );
}

const hostStyle: CSSProperties = {
  position: 'fixed',
  top: 12,
  left: 12,
  right: 12,
  zIndex: 50,
  display: 'flex',
  flexDirection: 'column',
  gap: 8,
  pointerEvents: 'none'
};

const toastStyle: CSSProperties = {
  background: 'var(--color-black)',
  color: 'var(--color-cream)',
  borderRadius: 13,
  padding: '12px 15px',
  font: "600 13px/1.4 'IBM Plex Sans Arabic',sans-serif",
  textAlign: 'center',
  boxShadow: '0 10px 30px -12px rgba(24,22,25,.6)'
};
