import { useEffect, useRef, useState, type CSSProperties } from 'react';
import { supabase } from '../lib/supabase';

interface RiderRow {
  id: string;
  name: string;
  photoUrl: string | null;
}

export default function Profile({ onBack }: { onBack: () => void }) {
  const [rider, setRider] = useState<RiderRow | null>(null);
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [avgRating, setAvgRating] = useState('—');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const { data: userData } = await supabase.auth.getUser();
      const userId = userData.user?.id;
      if (!userId || cancelled) return;

      const [{ data: riderRow }, { data: ratings }] = await Promise.all([
        supabase.from('riders').select('id,name,photo_url').eq('id', userId).maybeSingle(),
        supabase.from('ratings').select('rider_stars').eq('rider_id', userId).not('rider_stars', 'is', null)
      ]);
      if (cancelled) return;
      if (riderRow) {
        setRider({ id: riderRow.id, name: riderRow.name, photoUrl: riderRow.photo_url });
        setName(riderRow.name);
      }
      if (ratings && ratings.length) {
        setAvgRating((ratings.reduce((s, r) => s + (r.rider_stars ?? 0), 0) / ratings.length).toFixed(1));
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  const saveName = async () => {
    const trimmed = name.trim();
    if (!rider || !trimmed || trimmed === rider.name) return;
    setSaving(true);
    try {
      const { error } = await supabase.from('riders').update({ name: trimmed }).eq('id', rider.id);
      if (error) throw error;
      setRider({ ...rider, name: trimmed });
    } catch {
      setName(rider.name);
    } finally {
      setSaving(false);
    }
  };

  const onPickPhoto = () => fileInputRef.current?.click();

  const onPhotoSelected = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file || !rider) return;
    setUploading(true);
    try {
      const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${rider.id}/avatar-${Date.now()}.${ext}`;
      const { error: uploadError } = await supabase.storage.from('avatars').upload(path, file, { contentType: file.type || 'image/jpeg' });
      if (uploadError) throw uploadError;
      const { data: publicUrlData } = supabase.storage.from('avatars').getPublicUrl(path);
      const { error: updateError } = await supabase.from('riders').update({ photo_url: publicUrlData.publicUrl }).eq('id', rider.id);
      if (updateError) throw updateError;
      setRider({ ...rider, photoUrl: publicUrlData.publicUrl });
    } catch {
      // Best-effort — a failed avatar upload shouldn't disrupt the rest of the profile screen.
    } finally {
      setUploading(false);
    }
  };

  if (!rider) return null;

  return (
    <div style={rootStyle} dir="rtl">
      <div style={topBarStyle}>
        <button onClick={onBack} style={backBtnStyle}>›</button>
        <div style={{ font: "800 16px/1.3 Tajawal,sans-serif" }}>حسابي</div>
        <div style={{ width: 38 }} />
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10, marginTop: 10 }}>
        <button onClick={onPickPhoto} disabled={uploading} style={avatarBtnStyle}>
          {rider.photoUrl ? (
            <img src={rider.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          ) : (
            <span style={{ font: "800 32px/1 FreePalestine,Tajawal,sans-serif" }}>{rider.name.slice(0, 1)}</span>
          )}
          {uploading && <div style={avatarOverlayStyle}>...</div>}
        </button>
        <input ref={fileInputRef} type="file" accept="image/*" onChange={onPhotoSelected} style={{ display: 'none' }} />
        <button onClick={onPickPhoto} disabled={uploading} style={changePhotoBtnStyle}>
          تغيير الصورة
        </button>
      </div>

      <div style={statsRowStyle}>
        <div style={statCardStyle}>
          <div style={{ font: "800 19px/1.2 FreePalestine,Tajawal,sans-serif" }}>★ {avgRating}</div>
          <div style={{ font: "500 11px/1.5 'IBM Plex Sans Arabic',sans-serif", color: '#575757', marginTop: 4 }}>تقييمك</div>
        </div>
      </div>

      <div style={{ font: "600 12px/1.5 'IBM Plex Sans Arabic',sans-serif", color: '#575757', textAlign: 'right', marginBottom: 7 }}>الاسم</div>
      <div style={{ display: 'flex', gap: 9, marginBottom: 20 }}>
        <input value={name} onChange={(e) => setName(e.target.value)} style={inputStyle} />
        {name.trim() !== rider.name && (
          <button onClick={saveName} disabled={saving} style={{ ...saveBtnStyle, opacity: saving ? 0.6 : 1 }}>
            حفظ
          </button>
        )}
      </div>
    </div>
  );
}

const rootStyle: CSSProperties = { flex: 1, background: '#fff', padding: '20px', paddingTop: 24, overflow: 'auto' };
const topBarStyle: CSSProperties = { display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 22 };
const backBtnStyle: CSSProperties = { width: 38, height: 38, border: 'none', background: 'none', fontSize: 26, cursor: 'pointer', color: 'var(--color-black)' };
const avatarBtnStyle: CSSProperties = {
  position: 'relative',
  width: 92,
  height: 92,
  borderRadius: 30,
  background: 'var(--color-cream)',
  border: 'none',
  overflow: 'hidden',
  cursor: 'pointer',
  display: 'grid',
  placeItems: 'center'
};
const avatarOverlayStyle: CSSProperties = {
  position: 'absolute',
  inset: 0,
  background: 'rgba(0,0,0,0.4)',
  color: '#fff',
  display: 'grid',
  placeItems: 'center',
  font: "600 12px/1.4 'IBM Plex Sans Arabic',sans-serif"
};
const changePhotoBtnStyle: CSSProperties = { border: 'none', background: 'none', color: 'var(--color-green)', font: "700 12.5px/1.4 'IBM Plex Sans Arabic',sans-serif", cursor: 'pointer' };
const statsRowStyle: CSSProperties = { display: 'flex', gap: 9, margin: '22px 0' };
const statCardStyle: CSSProperties = { flex: 1, background: '#faf8f2', borderRadius: 14, padding: 14, textAlign: 'center' };
const inputStyle: CSSProperties = {
  flex: 1,
  border: '1.5px solid #e7e1d0',
  borderRadius: 13,
  background: '#faf8f2',
  padding: '13px 14px',
  fontSize: 14,
  font: "400 14px/1.4 'IBM Plex Sans Arabic',sans-serif",
  textAlign: 'right'
};
const saveBtnStyle: CSSProperties = { border: 'none', borderRadius: 13, background: 'var(--color-black)', color: 'var(--color-yellow)', padding: '0 18px', font: "800 13px/1.4 Tajawal,sans-serif", cursor: 'pointer' };
