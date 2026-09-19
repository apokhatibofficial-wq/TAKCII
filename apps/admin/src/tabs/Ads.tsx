import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useLang } from '../i18n/LangContext';
import { Button, Card, Chip, Input, Toast, useToast } from '../components/ui';
import type { AdAudience } from '@takc/shared';

interface AdRow {
  id: string;
  title: string;
  body: string | null;
  imageUrls: string[];
  audience: AdAudience;
  buttonLabel: string | null;
  buttonUrl: string | null;
  imageFit: string;
  height: number;
  active: boolean;
  impressionsCount: number;
  linkClicksCount: number;
}

export default function Ads() {
  const { t } = useLang();
  const [rows, setRows] = useState<AdRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [images, setImages] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);
  const [audience, setAudience] = useState<AdAudience>('all');
  const [btnLabel, setBtnLabel] = useState('');
  const [btnUrl, setBtnUrl] = useState('');
  const [fit, setFit] = useState<'cover' | 'contain'>('cover');
  const [height, setHeight] = useState(270);
  const { toastText, toast } = useToast();

  const load = async () => {
    const { data } = await supabase
      .from('ads')
      .select('id,title,body,image_urls,audience,button_label,button_url,image_fit,height,active,impressions_count,link_clicks_count')
      .order('created_at', { ascending: false });
    if (data)
      setRows(
        data.map((a) => ({
          id: a.id,
          title: a.title,
          body: a.body,
          imageUrls: a.image_urls,
          audience: a.audience,
          buttonLabel: a.button_label,
          buttonUrl: a.button_url,
          imageFit: a.image_fit,
          height: a.height,
          active: a.active,
          impressionsCount: a.impressions_count,
          linkClicksCount: a.link_clicks_count
        }))
      );
  };
  useEffect(() => {
    load();
  }, []);

  const onImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;
    setUploading(true);
    const uploaded: string[] = [];
    for (const f of files) {
      const ext = f.name.split('.').pop()?.toLowerCase() || 'jpg';
      const path = `${crypto.randomUUID()}.${ext}`;
      const { error } = await supabase.storage.from('ad-images').upload(path, f);
      if (!error) {
        uploaded.push(supabase.storage.from('ad-images').getPublicUrl(path).data.publicUrl);
      }
    }
    setImages((prev) => [...prev, ...uploaded]);
    setUploading(false);
    if (uploaded.length < files.length) toast('تعذّر رفع بعض الصور');
  };
  const removeImage = (idx: number) => setImages((prev) => prev.filter((_, i) => i !== idx));
  const moveImage = (idx: number, dir: -1 | 1) =>
    setImages((prev) => {
      const target = idx + dir;
      if (target < 0 || target >= prev.length) return prev;
      const next = [...prev];
      const tmp = next[idx]!;
      next[idx] = next[target]!;
      next[target] = tmp;
      return next;
    });

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setBody('');
    setImages([]);
    setBtnLabel('');
    setBtnUrl('');
    setFit('cover');
    setHeight(270);
    setAudience('all');
  };

  const publish = async () => {
    if (!title.trim()) {
      toast('اكتب عنوان الإعلان');
      return;
    }
    const rec = {
      title,
      body,
      image_urls: images,
      audience,
      button_label: btnLabel.trim() || null,
      button_url: btnUrl.trim() || null,
      image_fit: fit,
      height
    };
    if (editingId) {
      await supabase.from('ads').update(rec).eq('id', editingId);
      toast('تم تعديل الإعلان');
    } else {
      await supabase.from('ads').insert({ ...rec, active: true });
      toast('تم نشر الإعلان');
    }
    resetForm();
    load();
  };

  const edit = (a: AdRow) => {
    setEditingId(a.id);
    setTitle(a.title);
    setBody(a.body ?? '');
    setImages(a.imageUrls);
    setAudience(a.audience);
    setBtnLabel(a.buttonLabel ?? '');
    setBtnUrl(a.buttonUrl ?? '');
    setFit(a.imageFit as 'cover' | 'contain');
    setHeight(a.height);
  };
  const toggle = async (a: AdRow) => {
    await supabase.from('ads').update({ active: !a.active }).eq('id', a.id);
    load();
  };
  const remove = async (id: string) => {
    await supabase.from('ads').delete().eq('id', id);
    toast('تم حذف الإعلان');
    load();
  };

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ font: "700 13px/1.4 'IBM Plex Sans Arabic',sans-serif", marginBottom: 12 }}>
          {editingId ? 'تعديل الإعلان' : t.tCreateAd}
        </div>

        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 10 }}>
          {images.map((url, i) => (
            <div key={url} style={thumbWrapStyle}>
              <div style={{ ...imgThumbStyle, backgroundImage: `url(${url})` }} />
              <div style={thumbActionsStyle}>
                <button type="button" onClick={() => moveImage(i, -1)} disabled={i === 0} style={thumbBtnStyle}>
                  ←
                </button>
                <button type="button" onClick={() => removeImage(i)} style={{ ...thumbBtnStyle, color: '#b3261e' }}>
                  ×
                </button>
                <button type="button" onClick={() => moveImage(i, 1)} disabled={i === images.length - 1} style={thumbBtnStyle}>
                  →
                </button>
              </div>
            </div>
          ))}
          <label style={addImgStyle}>
            <span style={{ font: "700 20px/1 sans-serif", color: '#9a9a9a' }}>+</span>
            <input type="file" accept="image/*" multiple onChange={onImages} style={{ display: 'none' }} disabled={uploading} />
          </label>
        </div>
        {uploading && <div style={{ font: "500 11.5px/1.5 'IBM Plex Sans Arabic',sans-serif", color: '#9a9a9a', marginBottom: 8 }}>جارٍ رفع الصور…</div>}
        <div style={{ font: "400 11px/1.5 'IBM Plex Sans Arabic',sans-serif", color: '#9a9a9a', marginBottom: 12 }}>
          يمكن إضافة أكثر من صورة — يتنقل الراكب أو السائق بينها بالتحريك، بنفس ترتيبها هنا.
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10 }}>
          <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان الإعلان" />
          <Input value={btnLabel} onChange={(e) => setBtnLabel(e.target.value)} placeholder="نص الزر (اختياري)" />
          <Input value={btnUrl} onChange={(e) => setBtnUrl(e.target.value)} placeholder="الرابط الخارجي" />
          <Input type="number" value={height} onChange={(e) => setHeight(parseInt(e.target.value, 10) || 270)} placeholder="ارتفاع الصورة" />
        </div>
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="نص قصير" style={textareaStyle} />
        <div style={{ display: 'flex', gap: 16, marginTop: 10, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {(['all', 'users', 'drivers'] as AdAudience[]).map((a) => (
              <Chip key={a} active={audience === a} onClick={() => setAudience(a)}>
                {a === 'all' ? 'للجميع' : a === 'users' ? 'للمستخدمين' : 'للسائقين'}
              </Chip>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            <Chip active={fit === 'cover'} onClick={() => setFit('cover')}>
              ملء الإطار
            </Chip>
            <Chip active={fit === 'contain'} onClick={() => setFit('contain')}>
              الصورة كاملة
            </Chip>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
          <Button variant="primary" onClick={publish}>
            {editingId ? 'حفظ التعديلات' : t.tPublishAd}
          </Button>
          {editingId && <Button onClick={resetForm}>إلغاء التعديل</Button>}
        </div>
      </Card>

      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {rows.map((a) => (
          <div key={a.id} style={rowStyle}>
            <div style={{ ...thumbStyle, backgroundImage: a.imageUrls[0] ? `url(${a.imageUrls[0]})` : 'none' }}>
              {a.imageUrls.length > 1 && <div style={countBadgeStyle}>{a.imageUrls.length}</div>}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: "700 13px/1.4 'IBM Plex Sans Arabic',sans-serif" }}>{a.title}</div>
              <div style={{ font: "400 11.5px/1.5 'IBM Plex Sans Arabic',sans-serif", color: '#575757' }}>{a.body}</div>
              <div style={{ display: 'flex', gap: 12, marginTop: 4 }}>
                <span style={statTextStyle}>المشاهدات: {a.impressionsCount.toLocaleString('en-US')}</span>
                <span style={statTextStyle}>نقرات الرابط: {a.linkClicksCount.toLocaleString('en-US')}</span>
              </div>
            </div>
            <Button onClick={() => edit(a)}>{t.tEdit}</Button>
            <Button onClick={() => toggle(a)}>{a.active ? 'إيقاف' : 'تشغيل'}</Button>
            <Button variant="danger" onClick={() => remove(a.id)}>
              {t.tDelete}
            </Button>
          </div>
        ))}
      </Card>
      <Toast text={toastText} />
    </div>
  );
}

const textareaStyle = {
  width: '100%',
  minHeight: 70,
  padding: '10px 12px',
  border: '1.5px solid #e7e1d0',
  borderRadius: 11,
  background: '#faf8f2',
  fontSize: 13.5,
  fontFamily: 'inherit',
  marginTop: 10,
  resize: 'vertical'
} as const;
const rowStyle = { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #f0ece0' } as const;
const thumbStyle = {
  width: 52,
  height: 52,
  borderRadius: 10,
  backgroundColor: '#f0ece0',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat',
  flex: 'none',
  position: 'relative'
} as const;
const countBadgeStyle = {
  position: 'absolute',
  bottom: 3,
  insetInlineEnd: 3,
  background: 'rgba(24,22,25,.75)',
  color: '#fff',
  borderRadius: 6,
  padding: '1px 5px',
  font: "700 9.5px/1.4 'IBM Plex Sans Arabic',sans-serif"
} as const;
const statTextStyle = { font: "600 11px/1.6 'IBM Plex Sans Arabic',sans-serif", color: '#8b8b8b' } as const;
const thumbWrapStyle = { width: 96, flex: 'none' } as const;
const imgThumbStyle = {
  width: 96,
  height: 96,
  borderRadius: 12,
  backgroundColor: '#f0ece0',
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  backgroundRepeat: 'no-repeat'
} as const;
const thumbActionsStyle = { display: 'flex', justifyContent: 'space-between', marginTop: 4 } as const;
const thumbBtnStyle = { border: 'none', background: 'none', cursor: 'pointer', fontSize: 13, color: '#575757', padding: 2 } as const;
const addImgStyle = {
  width: 96,
  height: 96,
  borderRadius: 12,
  border: '1.5px dashed #d8d2c2',
  display: 'grid',
  placeItems: 'center',
  cursor: 'pointer',
  flex: 'none'
} as const;
