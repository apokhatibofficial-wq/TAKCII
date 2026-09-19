import { useEffect, useRef, useState, type CSSProperties } from 'react';
import type { Ad } from '@takc/shared';
import { trackAdImpression, trackAdLinkClick } from '@takc/shared';
import { supabase } from '../lib/supabase';

// Ported from index.html's adOpenAny block (lines ~74-93), extended for a
// swipeable multi-image carousel (CSS scroll-snap — no gesture library
// needed, and it gets native momentum/rubber-banding for free on mobile).
export default function AdOverlay({ ad, onClose }: { ad: Ad; onClose: () => void }) {
  const hasBtn = !!(ad.buttonLabel && ad.buttonUrl);
  const images = ad.imageUrls;
  const [slide, setSlide] = useState(0);
  const trackRef = useRef<HTMLDivElement>(null);
  const gradient =
    ad.imageFit === 'contain'
      ? 'linear-gradient(180deg,rgba(24,22,25,.1) 0%,rgba(24,22,25,.9) 100%)'
      : 'linear-gradient(180deg,rgba(24,22,25,0) 28%,rgba(24,22,25,.94) 100%)';

  useEffect(() => {
    trackAdImpression(supabase, ad.id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ad.id]);

  const onScroll = () => {
    const el = trackRef.current;
    if (!el || el.clientWidth === 0) return;
    setSlide(Math.round(el.scrollLeft / el.clientWidth));
  };

  const openButton = () => {
    trackAdLinkClick(supabase, ad.id);
    if (ad.buttonUrl) window.open(ad.buttonUrl, '_blank', 'noopener');
    onClose();
  };

  return (
    <div style={backdropStyle}>
      <div style={cardStyle}>
        <div style={{ position: 'relative', height: ad.height, backgroundColor: '#101010' }}>
          {images.length > 0 ? (
            <div ref={trackRef} onScroll={onScroll} style={trackStyle}>
              {images.map((url) => (
                <div
                  key={url}
                  style={{
                    ...slideStyle,
                    backgroundSize: ad.imageFit,
                    backgroundImage: `url(${url})`
                  }}
                />
              ))}
            </div>
          ) : (
            <div style={slideStyle} />
          )}
          <div style={{ position: 'absolute', inset: 0, background: gradient, pointerEvents: 'none' }} />
          <div style={badgeStyle}>إعلان</div>
          {images.length > 1 && (
            <div style={dotsStyle}>
              {images.map((url, i) => (
                <div key={url} style={dotStyle(i === slide)} />
              ))}
            </div>
          )}
          <div style={textWrapStyle}>
            <div style={titleStyle}>{ad.title}</div>
            {ad.body && <div style={bodyStyle}>{ad.body}</div>}
          </div>
        </div>
        <div style={{ padding: '14px 16px', display: 'flex', flexDirection: 'column', gap: 9 }}>
          {hasBtn && (
            <button onClick={openButton} style={ctaBtnStyle}>
              {ad.buttonLabel}
            </button>
          )}
          <button onClick={onClose} style={closeBtnStyle}>إغلاق</button>
        </div>
      </div>
    </div>
  );
}

const backdropStyle: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(24,22,25,.75)',
  zIndex: 200,
  display: 'grid',
  placeItems: 'center',
  padding: 20
};
const cardStyle: CSSProperties = {
  background: 'var(--color-black)',
  borderRadius: 24,
  overflow: 'hidden',
  width: '100%',
  maxWidth: 340,
  boxShadow: '0 30px 70px -30px rgba(0,0,0,.85)'
};
const trackStyle: CSSProperties = {
  display: 'flex',
  height: '100%',
  overflowX: 'auto',
  scrollSnapType: 'x mandatory',
  WebkitOverflowScrolling: 'touch'
};
const slideStyle: CSSProperties = {
  flex: '0 0 100%',
  height: '100%',
  scrollSnapAlign: 'start',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat'
};
const badgeStyle: CSSProperties = {
  position: 'absolute',
  top: 14,
  insetInlineStart: 14,
  background: 'var(--color-yellow)',
  color: 'var(--color-black)',
  borderRadius: 8,
  padding: '5px 9px',
  font: "700 10.5px/1.35 'IBM Plex Sans Arabic',sans-serif",
  pointerEvents: 'none'
};
const dotsStyle: CSSProperties = {
  position: 'absolute',
  top: 16,
  insetInlineEnd: 14,
  display: 'flex',
  gap: 5,
  pointerEvents: 'none'
};
const dotStyle = (active: boolean): CSSProperties => ({
  width: active ? 14 : 5,
  height: 5,
  borderRadius: 3,
  background: active ? 'var(--color-yellow)' : 'rgba(255,255,255,.5)',
  transition: 'width .2s ease'
});
const textWrapStyle: CSSProperties = { position: 'absolute', insetInlineEnd: 18, insetInlineStart: 18, bottom: 16, pointerEvents: 'none' };
const titleStyle: CSSProperties = { font: "900 22px/1.35 FreePalestine,Tajawal,sans-serif", color: 'var(--color-yellow)' };
const bodyStyle: CSSProperties = { font: "500 12.5px/1.7 'IBM Plex Sans Arabic',sans-serif", color: 'var(--color-cream)', marginTop: 6 };
const ctaBtnStyle: CSSProperties = {
  width: '100%',
  padding: 14,
  border: 'none',
  borderRadius: 13,
  background: 'var(--color-yellow)',
  color: 'var(--color-black)',
  font: "800 14px/1.35 Tajawal,sans-serif",
  cursor: 'pointer'
};
const closeBtnStyle: CSSProperties = {
  width: '100%',
  padding: 13,
  border: '1.5px solid rgba(244,239,225,.22)',
  borderRadius: 13,
  background: 'transparent',
  color: 'var(--color-cream)',
  font: "700 13px/1.35 'IBM Plex Sans Arabic',sans-serif",
  cursor: 'pointer'
};
