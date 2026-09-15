import { useEffect, useState } from 'react';

// Ported from index.html's splash: logo reveal (right-to-left mask, matching RTL
// reading direction) then a full fade+scale out. Timing kept identical (2.6s hold,
// 0.72s exit) so it still reads as one continuous motion.
export default function Splash() {
  const [out, setOut] = useState(false);

  useEffect(() => {
    const t = setTimeout(() => setOut(true), 2600);
    return () => clearTimeout(t);
  }, []);

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 999,
        display: 'grid',
        placeItems: 'center',
        overflow: 'hidden',
        background: 'var(--color-yellow)',
        transition: 'opacity .72s cubic-bezier(.4,0,.2,1), transform .72s cubic-bezier(.4,0,.2,1)',
        opacity: out ? 0 : 1,
        transform: out ? 'scale(1.05)' : 'scale(1)',
        pointerEvents: out ? 'none' : 'auto'
      }}
    >
      <div style={{ overflow: 'hidden', animation: 'sp-mask 1.9s cubic-bezier(.5,0,.25,1) .4s both' }}>
        <img
          src="/assets/logo.png"
          alt="TAK-C.TAXI"
          style={{ width: 'min(74vw, 300px)', height: 'auto', display: 'block' }}
        />
      </div>
    </div>
  );
}
