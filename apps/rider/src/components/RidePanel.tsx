import { useEffect, useState, type CSSProperties } from 'react';
import { supabase } from '../lib/supabase';
import { fmtMoney, type CurrencyCode, type Ride } from '@takc/shared';
import { useFare } from '../hooks/useFare';
import ChatOverlay from './ChatOverlay';

interface DriverInfo {
  name: string;
  car: string;
  plate: string;
  selfieUrl: string | null;
}

const STATUS_TEXT: Record<string, string> = {
  toPickup: 'السائق في طريقه إليك الآن',
  arrived: 'السائق وصل إلى نقطة الانطلاق',
  onTrip: 'أنت في الطريق إلى وجهتك'
};

// Ported from index.html's stSearching / stMatched / stDone blocks — same
// copy, same layout. Trip progress here is driven by useRide's Realtime
// subscription, fed by the driver app's accept/reject/trip actions.
export default function RidePanel({ ride, onCancel, onReset }: { ride: Ride; onCancel: () => void; onReset: () => void }) {
  const [driver, setDriver] = useState<DriverInfo | null>(null);
  const [chatOpen, setChatOpen] = useState(false);
  const { pricing } = useFare();

  // The "riders view matched driver" RLS policy only opens once status is
  // toPickup or later — driverId is already set during 'dispatched' (the
  // negotiation window) but reads are blocked until the driver accepts, so
  // this must re-check on status changes too, not just when driverId changes
  // (the same driver staying assigned across dispatched -> toPickup wouldn't
  // otherwise trigger a re-fetch).
  const driverVisible = ride.driverId != null && ride.status !== 'searching' && ride.status !== 'dispatched';
  useEffect(() => {
    if (!driverVisible) {
      setDriver(null);
      return;
    }
    let cancelled = false;
    supabase
      .from('drivers')
      .select('name,car,plate,selfie_url')
      .eq('id', ride.driverId as string)
      .maybeSingle()
      .then(({ data }) => {
        if (!cancelled && data) setDriver({ name: data.name, car: data.car, plate: data.plate, selfieUrl: data.selfie_url });
      });
    return () => {
      cancelled = true;
    };
  }, [ride.driverId, driverVisible]);

  const isSearching = ride.status === 'searching' || ride.status === 'dispatched';

  if (isSearching) {
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, padding: '6px 0 14px' }}>
          <div style={{ position: 'relative', width: 52, height: 52, flex: 'none' }}>
            <span style={pulseStyle} />
            <span style={pulseCoreStyle}>T</span>
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ font: "800 17px/1.3 FreePalestine,Tajawal,sans-serif" }}>نبحث عن أقرب سائق…</div>
            <div style={{ font: "400 12.5px/1.6 'IBM Plex Sans Arabic',sans-serif", color: '#575757' }}>
              {ride.status === 'dispatched' ? 'وجدنا سائقاً، بانتظار تأكيده…' : 'نتحقق من السائقين المتصلين قربك'}
            </div>
          </div>
        </div>
        <button onClick={onCancel} style={cancelBtnStyle}>إلغاء الطلب</button>
      </>
    );
  }

  if (ride.status === 'toPickup' || ride.status === 'arrived' || ride.status === 'onTrip') {
    return (
      <>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {driver?.selfieUrl ? (
            <img src={driver.selfieUrl} alt="" style={{ ...avatarStyle, objectFit: 'cover' }} />
          ) : (
            <div style={avatarStyle}>{(driver?.name ?? '؟').slice(0, 1)}</div>
          )}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: "800 17px/1.3 FreePalestine,Tajawal,sans-serif" }}>{driver?.name ?? '…'}</div>
            <div style={{ font: "400 12.5px/1.5 'IBM Plex Sans Arabic',sans-serif", color: '#575757' }}>
              {driver?.car} · لوحة{' '}
              <span style={{ direction: 'ltr', display: 'inline-block', fontWeight: 700, color: 'var(--color-black)' }}>{driver?.plate}</span>
            </div>
          </div>
        </div>
        <div style={{ marginTop: 14, background: '#faf8f2', borderRadius: 14, padding: '12px 13px', font: "600 13px/1.5 'IBM Plex Sans Arabic',sans-serif" }}>
          {STATUS_TEXT[ride.status]}
        </div>
        <div style={{ display: 'flex', gap: 9, marginTop: 12 }}>
          <button onClick={() => setChatOpen(true)} style={callBtnStyle}>
            مراسلة السائق
          </button>
          <button onClick={onCancel} style={cancelInlineBtnStyle}>إلغاء</button>
        </div>
        {chatOpen && <ChatOverlay rideId={ride.id} onClose={() => setChatOpen(false)} />}
      </>
    );
  }

  if (ride.status === 'done') {
    return <DoneView ride={ride} driver={driver} pricingCurrency={pricing?.currency ?? null} onReset={onReset} />;
  }

  // Reached only when the system itself gives up after 5 minutes with no
  // driver (see migration 0017's sweep) -- the rider's own cancel button
  // resets local state immediately and unsubscribes, so a live 'cancelled'
  // update can never arrive for that path.
  if (ride.status === 'cancelled') {
    return (
      <div style={{ textAlign: 'center', padding: '10px 0 4px' }}>
        <div style={{ width: 58, height: 58, borderRadius: '50%', background: '#b3261e', color: '#fff', display: 'grid', placeItems: 'center', margin: '0 auto 12px', fontSize: 24 }}>
          !
        </div>
        <div style={{ font: "800 19px/1.3 FreePalestine,Tajawal,sans-serif" }}>لم نجد سائقاً متاحاً</div>
        <div style={{ font: "400 12.5px/1.7 'IBM Plex Sans Arabic',sans-serif", color: '#575757', marginTop: 6 }}>
          كل السائقين القريبين مشغولون حالياً، حاول مرة أخرى بعد قليل
        </div>
        <button onClick={onReset} style={newRideBtnStyle}>حسناً</button>
      </div>
    );
  }

  return null;
}

function DoneView({
  ride,
  driver,
  pricingCurrency,
  onReset
}: {
  ride: Ride;
  driver: DriverInfo | null;
  pricingCurrency: CurrencyCode | null;
  onReset: () => void;
}) {
  const [stars, setStars] = useState(0);
  const [sent, setSent] = useState(false);
  const currency: CurrencyCode = ride.fareCurrency ?? pricingCurrency ?? 'SYP';
  const hasWait = ride.waitSeconds > 0;
  const total = (ride.fareAmount ?? 0) + ride.waitFare;

  const submitRating = async () => {
    if (!stars || !ride.driverId) return;
    const { error } = await supabase.rpc('rate_ride', { p_ride_id: ride.id, p_stars: stars });
    if (!error) setSent(true);
  };

  return (
    <div style={{ textAlign: 'center', padding: '10px 0 4px' }}>
      <div style={{ width: 58, height: 58, borderRadius: '50%', background: 'var(--color-green)', color: '#fff', display: 'grid', placeItems: 'center', margin: '0 auto 12px', fontSize: 24 }}>
        ✓
      </div>
      <div style={{ font: "800 19px/1.3 FreePalestine,Tajawal,sans-serif" }}>وصلت إلى وجهتك</div>
      <div style={{ font: "400 12.5px/1.7 'IBM Plex Sans Arabic',sans-serif", color: '#575757', marginTop: 6 }}>{ride.destName}</div>

      <div style={{ marginTop: 16, background: '#faf8f2', border: '1px solid #f0ece0', borderRadius: 16, padding: '14px 15px', textAlign: 'right' }}>
        <div style={{ font: "700 13px/1.4 'IBM Plex Sans Arabic',sans-serif", marginBottom: 10 }}>فاتورة الرحلة</div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', font: "500 12.5px/1.5 'IBM Plex Sans Arabic',sans-serif" }}>
          <span style={{ color: '#575757' }}>المسافة ({ride.km?.toFixed(1)} كم)</span>
          <span style={{ direction: 'ltr' }}>{ride.fareAmount != null ? fmtMoney(currency, ride.fareAmount) : '—'}</span>
        </div>
        {hasWait && (
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '7px 0', font: "500 12.5px/1.5 'IBM Plex Sans Arabic',sans-serif" }}>
            <span style={{ color: '#575757' }}>الانتظار</span>
            <span style={{ direction: 'ltr' }}>{fmtMoney(currency, ride.waitFare)}</span>
          </div>
        )}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, padding: '11px 0 0', marginTop: 7, borderTop: '1px solid #e7e1d0', font: "700 14px/1.4 'IBM Plex Sans Arabic',sans-serif" }}>
          <span>الإجمالي</span>
          <span style={{ direction: 'ltr', fontFamily: 'FreePalestine,Tajawal,sans-serif', fontSize: 18 }}>{fmtMoney(currency, total)}</span>
        </div>
      </div>

      {sent ? (
        <div style={{ marginTop: 14, background: '#eaf6ef', borderRadius: 14, padding: 13, font: "700 13px/1.6 'IBM Plex Sans Arabic',sans-serif", color: '#00662a' }}>
          تم إرسال تقييمك للسائق ✓
        </div>
      ) : (
        <div style={{ marginTop: 14, background: '#faf8f2', border: '1px solid #f0ece0', borderRadius: 16, padding: 14 }}>
          <div style={{ font: "700 13px/1.5 'IBM Plex Sans Arabic',sans-serif" }}>كيف كانت رحلتك مع {driver?.name ?? 'السائق'}؟</div>
          <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginTop: 8 }}>
            {[1, 2, 3, 4, 5].map((n) => (
              <button key={n} onClick={() => setStars(n)} style={starBtnStyle(n <= stars)}>
                {n <= stars ? '★' : '☆'}
              </button>
            ))}
          </div>
          <button onClick={submitRating} disabled={!stars} style={{ ...rateSubmitStyle, opacity: stars ? 1 : 0.5 }}>
            إرسال التقييم
          </button>
        </div>
      )}

      <button onClick={onReset} style={newRideBtnStyle}>رحلة جديدة</button>
    </div>
  );
}

const pulseStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  borderRadius: '50%',
  background: 'var(--color-yellow)',
  animation: 'takc-pulse 1.6s ease-out infinite'
};
const pulseCoreStyle: CSSProperties = {
  position: 'absolute',
  inset: 12,
  borderRadius: '50%',
  background: 'var(--color-black)',
  display: 'grid',
  placeItems: 'center',
  color: 'var(--color-yellow)',
  font: "800 12px/1.35 Tajawal,sans-serif"
};
const cancelBtnStyle: CSSProperties = {
  width: '100%',
  marginTop: 16,
  padding: 14,
  border: '1.5px solid #e7e1d0',
  borderRadius: 14,
  background: '#fff',
  color: '#b3261e',
  font: "700 14px/1.35 'IBM Plex Sans Arabic',sans-serif",
  cursor: 'pointer'
};
const avatarStyle: CSSProperties = {
  width: 56,
  height: 56,
  borderRadius: 18,
  background: 'var(--color-cream)',
  display: 'grid',
  placeItems: 'center',
  font: "800 18px/1.35 FreePalestine,Tajawal,sans-serif",
  flex: 'none'
};
const callBtnStyle: CSSProperties = {
  flex: 1,
  padding: 13,
  border: 'none',
  borderRadius: 14,
  background: 'var(--color-green)',
  color: '#fff',
  font: "700 13.5px/1.35 'IBM Plex Sans Arabic',sans-serif",
  cursor: 'pointer',
  textAlign: 'center',
  textDecoration: 'none',
  display: 'block'
};
const cancelInlineBtnStyle: CSSProperties = {
  flex: 1,
  padding: 13,
  border: '1.5px solid #e7e1d0',
  borderRadius: 14,
  background: '#fff',
  color: '#b3261e',
  font: "700 13.5px/1.35 'IBM Plex Sans Arabic',sans-serif",
  cursor: 'pointer'
};
const starBtnStyle = (filled: boolean): CSSProperties => ({
  border: 'none',
  cursor: 'pointer',
  padding: '3px 5px',
  fontSize: 20,
  lineHeight: 1,
  borderRadius: 8,
  background: filled ? 'var(--color-black)' : '#f0ece0',
  color: filled ? 'var(--color-yellow)' : '#8b8b8b'
});
const rateSubmitStyle: CSSProperties = {
  width: '100%',
  marginTop: 10,
  padding: 13,
  border: 'none',
  borderRadius: 13,
  background: 'var(--color-green)',
  color: '#fff',
  font: "700 13.5px/1.35 'IBM Plex Sans Arabic',sans-serif",
  cursor: 'pointer'
};
const newRideBtnStyle: CSSProperties = {
  width: '100%',
  marginTop: 16,
  padding: 14,
  border: 'none',
  borderRadius: 14,
  background: 'var(--color-black)',
  color: 'var(--color-yellow)',
  font: "800 14px/1.35 Tajawal,sans-serif",
  cursor: 'pointer'
};
