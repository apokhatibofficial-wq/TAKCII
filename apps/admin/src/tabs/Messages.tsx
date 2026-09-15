import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useLang } from '../i18n/LangContext';
import { Badge, Button, Card, Chip, Input } from '../components/ui';
import { useToast, Toast } from '../components/ui';
import type { MessageAudience } from '@takc/shared';

interface Person {
  id: string;
  name: string;
}
interface MessageRow {
  id: string;
  title: string;
  body: string;
  audience: MessageAudience;
  createdAt: string;
}

export default function Messages() {
  const { t } = useLang();
  const [audience, setAudience] = useState<MessageAudience>('all');
  const [targetKind, setTargetKind] = useState<'user' | 'driver'>('user');
  const [targetId, setTargetId] = useState('');
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [users, setUsers] = useState<Person[]>([]);
  const [drivers, setDrivers] = useState<Person[]>([]);
  const [log, setLog] = useState<MessageRow[]>([]);
  const { toastText, toast } = useToast();

  const load = async () => {
    const { data: u } = await supabase.from('riders').select('id,name');
    if (u) setUsers(u);
    const { data: d } = await supabase.from('drivers').select('id,name');
    if (d) setDrivers(d);
    const { data: m } = await supabase.from('messages').select('id,title,body,audience,created_at').order('created_at', { ascending: false }).limit(30);
    if (m) setLog(m.map((r) => ({ id: r.id, title: r.title, body: r.body, audience: r.audience, createdAt: r.created_at })));
  };
  useEffect(() => {
    load();
  }, []);

  const send = async () => {
    if (!title.trim() || !body.trim()) {
      toast('اكتب عنواناً ونصاً للرسالة');
      return;
    }
    await supabase.from('messages').insert({
      title,
      body,
      audience,
      target_kind: audience === 'one' ? targetKind : null,
      target_id: audience === 'one' ? targetId || null : null
    });
    setTitle('');
    setBody('');
    toast('تم إرسال الرسالة');
    load();
  };

  const people = targetKind === 'user' ? users : drivers;

  return (
    <div>
      <Card style={{ marginBottom: 16 }}>
        <div style={{ font: "700 13px/1.4 'IBM Plex Sans Arabic',sans-serif", marginBottom: 10 }}>إرسال رسالة</div>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12, flexWrap: 'wrap' }}>
          {(['all', 'users', 'drivers', 'one'] as MessageAudience[]).map((a) => (
            <Chip key={a} active={audience === a} onClick={() => setAudience(a)}>
              {a === 'all' ? t.audAll : a === 'users' ? t.audUsers : a === 'drivers' ? t.audDrivers : t.audOne}
            </Chip>
          ))}
        </div>
        {audience === 'one' && (
          <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
            <select value={targetKind} onChange={(e) => setTargetKind(e.target.value as 'user' | 'driver')} style={selectStyle}>
              <option value="user">مستخدم</option>
              <option value="driver">سائق</option>
            </select>
            <select value={targetId} onChange={(e) => setTargetId(e.target.value)} style={{ ...selectStyle, flex: 1 }}>
              <option value="">اختر...</option>
              {people.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>
        )}
        <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="عنوان الرسالة" style={{ marginBottom: 10 }} />
        <textarea value={body} onChange={(e) => setBody(e.target.value)} placeholder="نص الرسالة" style={textareaStyle} />
        <Button variant="primary" onClick={send} style={{ marginTop: 12 }}>
          {t.tSend}
        </Button>
      </Card>

      <div style={{ font: "700 13px/1.4 'IBM Plex Sans Arabic',sans-serif", marginBottom: 10 }}>{t.tMsgLog}</div>
      <Card style={{ padding: 0, overflow: 'hidden' }}>
        {log.map((m) => (
          <div key={m.id} style={rowStyle}>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: "700 13px/1.4 'IBM Plex Sans Arabic',sans-serif" }}>{m.title}</div>
              <div style={{ font: "400 12px/1.6 'IBM Plex Sans Arabic',sans-serif", color: '#575757' }}>{m.body}</div>
            </div>
            <Badge tone={m.audience === 'drivers' ? 'yellow' : m.audience === 'users' ? 'green' : 'gray'}>
              {m.audience === 'all' ? t.audAll : m.audience === 'users' ? t.audUsers : m.audience === 'drivers' ? t.audDrivers : t.audOne}
            </Badge>
          </div>
        ))}
      </Card>
      <Toast text={toastText} />
    </div>
  );
}

const selectStyle = { padding: '9px 12px', border: '1.5px solid #e7e1d0', borderRadius: 11, background: '#faf8f2', fontSize: 13 } as const;
const textareaStyle = {
  width: '100%',
  minHeight: 90,
  padding: '10px 12px',
  border: '1.5px solid #e7e1d0',
  borderRadius: 11,
  background: '#faf8f2',
  fontSize: 13.5,
  fontFamily: 'inherit',
  resize: 'vertical'
} as const;
const rowStyle = { display: 'flex', alignItems: 'flex-start', gap: 12, padding: '12px 16px', borderBottom: '1px solid #f0ece0' } as const;
