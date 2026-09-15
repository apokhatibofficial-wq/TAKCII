import { useState, type ButtonHTMLAttributes, type CSSProperties, type InputHTMLAttributes } from 'react';

export function Card({ children, style }: { children: React.ReactNode; style?: CSSProperties }) {
  return (
    <div style={{ background: '#fff', border: '1px solid #ece6d6', borderRadius: 16, padding: 20, ...style }}>{children}</div>
  );
}

export function Input(props: InputHTMLAttributes<HTMLInputElement>) {
  return <input {...props} style={{ ...inputBase, ...props.style }} />;
}

const inputBase: CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  border: '1.5px solid #e7e1d0',
  borderRadius: 11,
  background: '#faf8f2',
  fontSize: 13.5
};

type Variant = 'primary' | 'secondary' | 'danger' | 'ghost';

export function Button({ variant = 'secondary', style, ...props }: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return <button {...props} style={{ ...buttonBase, ...variantStyle(variant), ...style }} />;
}

const buttonBase: CSSProperties = {
  padding: '9px 14px',
  border: 'none',
  borderRadius: 10,
  font: "700 12.5px/1.35 'IBM Plex Sans Arabic',sans-serif",
  cursor: 'pointer'
};

function variantStyle(v: Variant): CSSProperties {
  if (v === 'primary') return { background: 'var(--color-black)', color: 'var(--color-yellow)' };
  if (v === 'danger') return { background: '#fdecec', color: '#b3261e' };
  if (v === 'ghost') return { background: 'transparent', color: '#575757', border: '1.5px solid #e7e1d0' };
  return { background: '#eef0ea', color: '#181619' };
}

export function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '7px 12px',
        borderRadius: 10,
        border: `1.5px solid ${active ? 'var(--color-black)' : '#e7e1d0'}`,
        background: active ? 'var(--color-black)' : '#fff',
        color: active ? 'var(--color-yellow)' : '#575757',
        font: "700 12px/1.35 'IBM Plex Sans Arabic',sans-serif",
        cursor: 'pointer'
      }}
    >
      {children}
    </button>
  );
}

export function Badge({ tone, children }: { tone: 'green' | 'yellow' | 'red' | 'gray'; children: React.ReactNode }) {
  const tones: Record<string, CSSProperties> = {
    green: { background: '#eaf6ef', color: '#00662a' },
    yellow: { background: '#fff6cc', color: '#7a5f00' },
    red: { background: '#fdecec', color: '#b3261e' },
    gray: { background: '#eef0ea', color: '#575757' }
  };
  return (
    <span style={{ padding: '4px 9px', borderRadius: 8, font: "700 11px/1.3 'IBM Plex Sans Arabic',sans-serif", ...tones[tone] }}>
      {children}
    </span>
  );
}

export function Toast({ text }: { text: string }) {
  if (!text) return null;
  return (
    <div
      style={{
        position: 'fixed',
        bottom: 24,
        insetInlineStart: '50%',
        transform: 'translateX(-50%)',
        background: 'var(--color-black)',
        color: 'var(--color-yellow)',
        borderRadius: 14,
        padding: '13px 20px',
        font: "700 13px/1.4 'IBM Plex Sans Arabic',sans-serif",
        boxShadow: '0 18px 40px -18px rgba(24,22,25,.8)',
        zIndex: 300
      }}
    >
      {text}
    </div>
  );
}

export function useToast() {
  const [text, setText] = useState('');
  const toast = (t: string) => {
    setText(t);
    setTimeout(() => setText(''), 2600);
  };
  return { toastText: text, toast };
}
