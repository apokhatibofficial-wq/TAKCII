import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { fetchStreets } from '@takc/shared';
import { Button, Card, Input, Toast, useToast } from '../components/ui';

interface PlaceRow {
  id: string;
  name: string;
  area: string;
  lat: number;
  lng: number;
  source: string;
  image_url: string | null;
}

export default function Places() {
  const [rows, setRows] = useState<PlaceRow[]>([]);
  const [name, setName] = useState('');
  const [area, setArea] = useState('');
  const [lat, setLat] = useState('');
  const [lng, setLng] = useState('');
  const [image, setImage] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [osmBusy, setOsmBusy] = useState(false);
  const [osmStatus, setOsmStatus] = useState('');
  const { toastText, toast } = useToast();

  const load = async () => {
    const { data } = await supabase.from('places').select('id,name,area,lat,lng,source,image_url').order('name');
    if (data) setRows(data);
  };
  useEffect(() => {
    load();
  }, []);

  const onImage = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploading(true);
    const ext = file.name.split('.').pop()?.toLowerCase() || 'jpg';
    const path = `${crypto.randomUUID()}.${ext}`;
    const { error } = await supabase.storage.from('place-images').upload(path, file);
    setUploading(false);
    if (error) {
      toast('تعذّر رفع الصورة');
      return;
    }
    setImage(supabase.storage.from('place-images').getPublicUrl(path).data.publicUrl);
  };

  const addPlace = async () => {
    if (!name.trim()) {
      toast('اكتب اسم المكان أولاً');
      return;
    }
    const { error } = await supabase.from('places').insert({
      name,
      area: area || 'غير محدد',
      lat: parseFloat(lat) || 36.201,
      lng: parseFloat(lng) || 36.742,
      source: 'manual',
      image_url: image
    });
    if (error) {
      toast('تعذّرت إضافة المكان');
      return;
    }
    setName('');
    setArea('');
    setLat('');
    setLng('');
    setImage(null);
    toast('تمت إضافة المكان — ظهر فوراً في التطبيقين');
    load();
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from('places').delete().eq('id', id);
    if (error) {
      toast('تعذّر حذف المكان');
      return;
    }
    toast('تم حذف المكان');
    load();
  };

  const syncOsm = async () => {
    setOsmBusy(true);
    try {
      const payload = await fetchStreets((m) => setOsmStatus(m));
      const { error: delErr } = await supabase.from('places').delete().eq('source', 'osm');
      if (delErr) throw delErr;
      const rowsToInsert = payload.places.map((p) => ({ name: p.name, area: p.area, kind: p.kind, lat: p.lat, lng: p.lng, source: 'osm' }));
      for (let i = 0; i < rowsToInsert.length; i += 200) {
        await supabase.from('places').insert(rowsToInsert.slice(i, i + 200));
      }
      toast(`تم تنزيل ${payload.count} شارع/مكان من OpenStreetMap`);
      load();
    } catch {
      toast('تعذّر الاتصال بخادم الخرائط — حاول عند توفر إنترنت');
    } finally {
      setOsmBusy(false);
      setOsmStatus('');
    }
  };

  const osmCount = rows.filter((r) => r.source === 'osm').length;

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ font: "700 13px/1.4 'IBM Plex Sans Arabic',sans-serif", marginBottom: 4 }}>إضافة مكان أو شارع</div>
        <div style={{ font: "400 12px/1.6 'IBM Plex Sans Arabic',sans-serif", color: '#575757', marginBottom: 12 }}>
          يظهر فوراً في بحث تطبيق المستخدم وتطبيق السائق.
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(150px,1fr))', gap: 10 }}>
          <Input value={name} onChange={(e) => setName(e.target.value)} placeholder="اسم المكان / الشارع" />
          <Input value={area} onChange={(e) => setArea(e.target.value)} placeholder="المنطقة" />
          <Input value={lat} onChange={(e) => setLat(e.target.value)} placeholder="خط العرض 36.21" />
          <Input value={lng} onChange={(e) => setLng(e.target.value)} placeholder="خط الطول 36.76" />
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 12 }}>
          <label style={addImgStyle}>
            {image ? (
              <img src={image} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: 10 }} />
            ) : (
              <span style={{ font: "700 20px/1 sans-serif", color: '#9a9a9a' }}>+</span>
            )}
            <input type="file" accept="image/*" onChange={onImage} style={{ display: 'none' }} disabled={uploading} />
          </label>
          <span style={{ font: "400 11.5px/1.5 'IBM Plex Sans Arabic',sans-serif", color: '#9a9a9a' }}>
            {uploading ? 'جارٍ رفع الصورة…' : 'صورة أو أيقونة للمكان (اختياري)'}
          </span>
        </div>
        <Button variant="primary" onClick={addPlace} style={{ marginTop: 12 }}>
          حفظ المكان
        </Button>
      </Card>

      <Card style={{ marginBottom: 16 }}>
        <div style={{ font: "700 13px/1.4 'IBM Plex Sans Arabic',sans-serif" }}>خريطة الشوارع الحقيقية — الدانا وسرمدا</div>
        <div style={{ font: "400 12px/1.6 'IBM Plex Sans Arabic',sans-serif", color: '#575757', margin: '6px 0 12px' }}>
          ينزّل كل شارع ومَعلم مسمّى من OpenStreetMap مباشرة. شوارع من OSM: {osmCount}
        </div>
        <Button variant="primary" onClick={syncOsm} disabled={osmBusy}>
          {osmBusy ? osmStatus || '...' : 'تنزيل وتحديث الشوارع'}
        </Button>
      </Card>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {rows.map((p) => (
          <div key={p.id} style={rowStyle}>
            {p.image_url ? (
              <img src={p.image_url} alt="" style={{ width: 36, height: 36, borderRadius: 8, objectFit: 'cover', flex: 'none' }} />
            ) : (
              <span style={{ width: 36, height: 36, borderRadius: 8, background: '#f5f2e8', display: 'grid', placeItems: 'center', color: '#9a9a9a', flex: 'none' }}>◎</span>
            )}
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: "700 13px/1.3 'IBM Plex Sans Arabic',sans-serif" }}>{p.name}</div>
              <div style={{ font: "400 11.5px/1.4 'IBM Plex Sans Arabic',sans-serif", color: '#575757' }}>
                {p.area} · {p.lat.toFixed(4)}, {p.lng.toFixed(4)} {p.source === 'osm' && '· OSM'}
              </div>
            </div>
            <button onClick={() => remove(p.id)} style={{ background: 'none', border: 'none', color: '#b3261e', cursor: 'pointer', fontSize: 13 }}>
              حذف
            </button>
          </div>
        ))}
      </Card>
      <Toast text={toastText} />
    </div>
  );
}

const rowStyle = { display: 'flex', alignItems: 'center', gap: 12, padding: '11px 16px', borderBottom: '1px solid #f0ece0' } as const;
const addImgStyle = {
  width: 64,
  height: 64,
  borderRadius: 12,
  border: '1.5px dashed #d8d2c2',
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
  flex: 'none',
  overflow: 'hidden'
} as const;
