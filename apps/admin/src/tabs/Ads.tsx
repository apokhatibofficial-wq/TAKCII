import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useLang } from '../i18n/LangContext';
import { Button, Card, Chip, Input, Toast, useToast } from '../components/ui';
import type { AdAudience } from '@takc/shared';

interface AdRow {
  id: string;
  title: string;
  body: string | null;
  imageUrl: string | null;
  audience: AdAudience;
  buttonLabel: string | null;
  buttonUrl: string | null;
  imageFit: string;
  height: number;
  active: boolean;
}

export default function Ads() {
  const { t } = useLang();
  const [rows, setRows] = useState<AdRow[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [image, setImage] = useState('');
  const [audience, setAudience] = useState<AdAudience>('all');
  const [btnLabel, setBtnLabel] = useState('');
  const [btnUrl, setBtnUrl] = useState('');
  const [fit, setFit] = useState<'cover' | 'contain'>('cover');
  const [height, setHeight] = useState(270);
  const { toastText, toast } = useToast();

  const load = async () => {
    const { data } = await supabase
      .from('ads')
      .select('id,title,body,image_url,audience,button_label,button_url,image_fit,height,active')
      .order('created_at', { ascending: false });
    if (data)
      setRows(
        data.map((a) => ({
          id: a.id,
          title: a.title,
          body: a.body,
          imageUrl: a.image_url,
          audience: a.audience,
          buttonLabel: a.button_label,
          buttonUrl: a.button_url,
          imageFit: a.image_fit,
          height: a.height,
          active: a.active
        }))
      );
  };
  useEffect(() => {
    load();
  }, []);

  const onImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (!f) return;
    const reader = new FileReader();
    reader.onload = () => setImage(String(reader.result));
    reader.readAsDataURL(f);
  };

  const resetForm = () => {
    setEditingId(null);
    setTitle('');
    setBody('');
    setImage('');
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
    const rec = { title, body, image_url: image || null, audience, button_label: btnLabel.trim() || null, button_url: btnUrl.trim() || null, image_fit: fit, height };
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
    setImage(a.imageUrl ?? '');
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
        <label style={imgPickerStyle(image)}>
          <span style={imgLabelStyle}>{image ? 'تغيير الصورة' : '+ صورة الإعلان'}</span>
          <input type="file" accept="image/*" onChange={onImage} style={{ display: 'none' }} />
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 10, marginTop: 12 }}>
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
            <div style={{ ...thumbStyle, backgroundImage: a.imageUrl ? `url(${a.imageUrl})` : 'none' }} />
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: "700 13px/1.4 'IBM Plex Sans Arabic',sans-serif" }}>{a.title}</div>
              <div style={{ font: "400 11.5px/1.5 'IBM Plex Sans Arabic',sans-serif", color: '#575757' }}>{a.body}</div>
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

const imgPickerStyle = (hasImage: string) =>
  ({
    display: 'block',
    height: 140,
    borderRadius: 14,
    border: '1.5px dashed #d8d2c2',
    backgroundSize: 'cover',
    backgroundPosition: 'center',
    backgroundImage: hasImage ? `url(${hasImage})` : 'none',
    cursor: 'pointer',
    position: 'relative'
  }) as const;
const imgLabelStyle = {
  position: 'absolute',
  bottom: 10,
  insetInlineStart: 10,
  background: 'rgba(255,255,255,.92)',
  padding: '6px 10px',
  borderRadius: 8,
  font: "700 11.5px/1.35 'IBM Plex Sans Arabic',sans-serif"
} as const;
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
const thumbStyle = { width: 52, height: 52, borderRadius: 10, background: '#eee2 no-repeat center/cover', backgroundColor: '#f0ece0', flex: 'none' } as const;
