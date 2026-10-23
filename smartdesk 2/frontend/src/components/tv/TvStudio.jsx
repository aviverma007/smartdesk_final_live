import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ExternalLink, Copy, Send, Eye, ChevronUp, ChevronDown, Plus, Trash2, ImagePlus, Video, Pause, Play,
  Megaphone, Star, Cake, CalendarDays, ShieldCheck, Film, Type, Rows3, Loader2, Check,
} from 'lucide-react';
import { toast } from 'sonner';
import { useAuth } from '../../context/AuthContext';
import dataService from '../../services/dataService';
import TvPlayer, { useTvLive } from './TvPlayer';
import { SCENES, ANNOUNCE_COLORS, defaultConfig, fetchTvConfig, saveTvConfig, newItem, compressImage } from './tvData';
import { Field, Notice, Btn, inputStyle, font, card } from '../tools/shared';

/* HR "TV Display" tab: edit what the office TVs show, watch it live in a TV frame, publish. */

const tvLink = () => `${window.location.origin}${process.env.PUBLIC_URL || ''}/?tv`;
const sizeOf = (o) => new Blob([JSON.stringify(o)]).size;
const mb = (n) => `${(n / 1048576).toFixed(1)} MB`;

const Section = ({ icon: Icon, title, hint, right, children, open: openDefault = false }) => {
  const [open, setOpen] = useState(openDefault);
  return (
    <div style={{ ...card, overflow: 'visible' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, paddingRight: 14 }}>
        <button type="button" onClick={() => setOpen(o => !o)} aria-expanded={open}
          style={{ flex: 1, minWidth: 0, display: 'flex', alignItems: 'center', gap: 12, padding: '14px 0 14px 16px', background: 'none', border: 'none', cursor: 'pointer', textAlign: 'left' }}>
          <span style={{ width: 34, height: 34, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)', flexShrink: 0 }}><Icon size={17} /></span>
          <span style={{ flex: 1, minWidth: 0 }}>
            <span style={{ display: 'block', fontFamily: font.head, fontWeight: 700, fontSize: '.9rem', color: 'var(--text-primary)' }}>{title}</span>
            {hint && <span style={{ display: 'block', fontFamily: font.body, fontSize: '.74rem', color: 'var(--text-muted)', marginTop: 2 }}>{hint}</span>}
          </span>
        </button>
        {right}
        <button type="button" onClick={() => setOpen(o => !o)} aria-label={open ? `Collapse ${title}` : `Expand ${title}`} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: 4, display: 'flex' }}>
          <ChevronDown size={16} style={{ color: 'var(--text-muted)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
        </button>
      </div>
      {open && <div style={{ padding: '2px 16px 16px', display: 'grid', gap: 12 }}>{children}</div>}
    </div>
  );
};

const Toggle = ({ on, onChange, label }) => (
  <button type="button" role="switch" aria-checked={on} aria-label={label} onClick={() => onChange(!on)}
    style={{ width: 40, height: 22, borderRadius: 12, border: 'none', cursor: 'pointer', position: 'relative', flexShrink: 0, background: on ? 'var(--accent)' : 'var(--border)', transition: 'background .2s' }}>
    <span style={{ position: 'absolute', top: 3, left: on ? 21 : 3, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .2s', boxShadow: '0 1px 3px rgba(0,0,0,.3)' }} />
  </button>
);

const iconBtn = { width: 30, height: 30, borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: 'var(--text-secondary)', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 };
const itemBox = { padding: 12, borderRadius: 12, border: '1px solid var(--border)', background: 'var(--bg-elevated)', display: 'grid', gap: 10 };
const row2 = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10 };

function ImagePick({ value, onChange, label = 'Picture' }) {
  const ref = useRef(null);
  const [busy, setBusy] = useState(false);
  const pick = async (f) => {
    if (!f) return;
    setBusy(true);
    try { onChange(await compressImage(f)); } catch (e) { toast.error(e.message); } finally { setBusy(false); }
  };
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
      {value && <img src={value} alt="" style={{ width: 84, height: 56, objectFit: 'cover', borderRadius: 8, border: '1px solid var(--border)' }} />}
      <Btn variant="ghost" busy={busy} icon={ImagePlus} onClick={() => ref.current?.click()}>{value ? 'Change' : `Add ${label.toLowerCase()}`}</Btn>
      {value && <Btn variant="danger" icon={Trash2} onClick={() => onChange(null)}>Remove</Btn>}
      <input ref={ref} type="file" hidden accept="image/*" onChange={e => { pick(e.target.files?.[0]); e.target.value = ''; }} />
    </div>
  );
}

export default function TvStudio() {
  const { user } = useAuth();
  const [draft, setDraft] = useState(null);
  const [published, setPublished] = useState(null);
  const [meta, setMeta] = useState({});
  const [preview, setPreview] = useState(null);   // scene id or null (= whole loop)
  const [paused, setPaused] = useState(false);
  const [busy, setBusy] = useState(false);
  const [people, setPeople] = useState([]);

  useEffect(() => {
    fetchTvConfig().then(r => {
      setDraft(r.config); setPublished(r.published ? JSON.stringify(r.config) : null);
      setMeta({ offline: r.offline, updatedBy: r.updatedBy, updatedAt: r.updatedAt, published: r.published, error: r.error });
    });
    dataService.getEmployees({}).then(l => setPeople(Array.isArray(l) ? l : [])).catch(() => {});
  }, []);

  const live = useTvLive(draft || defaultConfig(), '');
  const dirty = draft && JSON.stringify(draft) !== published;
  const bytes = useMemo(() => (draft ? sizeOf(draft) : 0), [draft]);

  if (!draft) return <div style={{ padding: 60, textAlign: 'center', color: 'var(--text-muted)', fontFamily: font.body }}><Loader2 size={18} className="tools-spin" /> Loading TV display…</div>;

  const set = (patch) => setDraft(d => ({ ...d, ...patch }));
  const setList = (key, fn) => setDraft(d => ({ ...d, [key]: fn(d[key]) }));
  const upd = (key, id, patch) => setList(key, l => l.map(x => (x.id === id ? { ...x, ...patch } : x)));
  const del = (key, id) => setList(key, l => l.filter(x => x.id !== id));
  const moveScene = (i, dir) => setList('scenes', l => { const a = [...l]; const j = i + dir; if (j < 0 || j >= a.length) return a; [a[i], a[j]] = [a[j], a[i]]; return a; });

  const publish = async () => {
    setBusy(true);
    try {
      await saveTvConfig(draft, user);
      setPublished(JSON.stringify(draft));
      setMeta(m => ({ ...m, offline: false, published: true, updatedBy: user?.empId, updatedAt: new Date().toISOString() }));
      toast.success('Published to all TVs', { description: 'Screens update within a minute.' });
    } catch (e) { toast.error('Could not publish', { description: e.message }); } finally { setBusy(false); }
  };
  const copyLink = async () => {
    try { await navigator.clipboard.writeText(tvLink()); toast.success('TV link copied', { description: tvLink() }); }
    catch (_) { toast.message(tvLink()); }
  };
  const sceneOn = (id) => draft.scenes.find(s => s.id === id)?.on;
  const pickStar = (name) => {
    const e = people.find(p => p.name.toLowerCase() === String(name).toLowerCase());
    set({ star: { ...draft.star, name, ...(e ? { role: e.designation || draft.star.role, dept: e.department || draft.star.dept } : {}) } });
  };

  return (
    <div style={{ paddingBottom: 32 }}>
      {/* Header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 18 }}>
        <div>
          <p style={{ fontFamily: font.head, fontSize: '.68rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 5 }}>HR · Office screens</p>
          <h2 style={{ fontFamily: font.head, fontWeight: 800, fontSize: '1.5rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1 }}>TV Display</h2>
          <p style={{ fontFamily: font.body, fontSize: '.82rem', color: 'var(--text-muted)', marginTop: 6 }}>What plays on the office TVs. Edit on the right, watch it live, then publish.</p>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontFamily: font.body, fontSize: '.74rem', fontWeight: 600, padding: '6px 12px', borderRadius: 20, border: '1px solid var(--border)', color: dirty ? 'var(--warning)' : 'var(--success)', background: dirty ? 'var(--warning-bg)' : 'var(--success-bg)' }}>
            {dirty ? 'Unpublished changes' : meta.published ? `Live${meta.updatedAt ? ` · ${new Date(meta.updatedAt).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}` : ''}` : 'Showing defaults'}
          </span>
          <Btn variant="ghost" icon={Copy} onClick={copyLink}>Copy TV link</Btn>
          <Btn variant="ghost" icon={ExternalLink} onClick={() => window.open(tvLink(), '_blank', 'noopener')}>Open TV screen</Btn>
          <Btn icon={Send} busy={busy} disabled={!dirty && meta.published} onClick={publish}>Publish</Btn>
        </div>
      </div>

      {meta.offline && <div style={{ marginBottom: 14 }}><Notice type="warning">The SmartDesk server (backend-userrights) isn't reachable, so this shows the last saved or default content. Publishing needs the server.</Notice></div>}

      <div className="tvs-layout" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.25fr) minmax(340px, 1fr)', gap: 20, alignItems: 'start' }}>
        {/* TV preview */}
        <div className="tvs-preview" style={{ position: 'sticky', top: 0 }}>
          <div className="tvs-tv">
            <div className="tvs-screen">
              <TvPlayer config={draft} live={live} forceScene={preview} paused={paused} />
            </div>
            <div className="tvs-led" />
          </div>
          <div className="tvs-stand" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 14 }}>
            <button type="button" onClick={() => setPaused(p => !p)} style={{ ...iconBtn, width: 34, height: 32 }} aria-label={paused ? 'Play' : 'Pause'} title={paused ? 'Play' : 'Pause'}>{paused ? <Play size={15} /> : <Pause size={15} />}</button>
            <button type="button" onClick={() => setPreview(null)} className={`tvs-chip ${!preview ? 'on' : ''}`}>Whole loop</button>
            {SCENES.filter(s => sceneOn(s.id)).map(s => (
              <button key={s.id} type="button" onClick={() => setPreview(s.id)} className={`tvs-chip ${preview === s.id ? 'on' : ''}`}>{s.label}</button>
            ))}
          </div>
          <p style={{ fontFamily: font.body, fontSize: '.74rem', color: 'var(--text-muted)', marginTop: 10, lineHeight: 1.5 }}>
            On each TV, open <b style={{ color: 'var(--text-secondary)' }}>{tvLink()}</b> in the browser and click once for full screen.
            Add <code>&amp;site=Smart 66</code> to show one site's attendance. Scenes with nothing to show (e.g. no birthdays this week) are skipped automatically.
          </p>
        </div>

        {/* Editors */}
        <div style={{ display: 'grid', gap: 12 }}>
          <Section icon={Rows3} title="Scenes" hint="Turn scenes on or off, set seconds, change the order" open>
            {draft.scenes.map((s, i) => {
              const meta2 = SCENES.find(x => x.id === s.id);
              return (
                <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 0', borderTop: i ? '1px solid var(--border)' : 'none', opacity: s.on ? 1 : 0.55 }}>
                  <Toggle on={s.on} label={meta2.label} onChange={v => setList('scenes', l => l.map(x => (x.id === s.id ? { ...x, on: v } : x)))} />
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontFamily: font.head, fontWeight: 700, fontSize: '.82rem', color: 'var(--text-primary)' }}>{meta2.label}</div>
                    <div style={{ fontFamily: font.body, fontSize: '.7rem', color: 'var(--text-muted)' }}>{meta2.hint}</div>
                  </div>
                  <input type="number" min={5} max={120} value={s.secs} aria-label={`${meta2.label} seconds`}
                    onChange={e => setList('scenes', l => l.map(x => (x.id === s.id ? { ...x, secs: Math.max(5, Math.min(120, Number(e.target.value) || 5)) } : x)))}
                    style={{ ...inputStyle, width: 64, padding: '6px 8px' }} />
                  <span style={{ fontFamily: font.body, fontSize: '.72rem', color: 'var(--text-muted)' }}>s</span>
                  <button type="button" style={iconBtn} title="Preview" aria-label={`Preview ${meta2.label}`} onClick={() => setPreview(s.id)} disabled={!s.on}><Eye size={14} /></button>
                  <button type="button" style={iconBtn} title="Move up" aria-label="Move up" onClick={() => moveScene(i, -1)} disabled={!i}><ChevronUp size={14} /></button>
                  <button type="button" style={iconBtn} title="Move down" aria-label="Move down" onClick={() => moveScene(i, 1)} disabled={i === draft.scenes.length - 1}><ChevronDown size={14} /></button>
                </div>
              );
            })}
          </Section>

          <Section icon={Megaphone} title="Announcements" hint="Each active one gets its own scene" right={<span className="tvs-count">{draft.announcements.length}</span>} open>
            {draft.announcements.map(a => (
              <div key={a.id} style={itemBox}>
                <Field label="Title"><input style={inputStyle} value={a.title} maxLength={90} onChange={e => upd('announcements', a.id, { title: e.target.value })} placeholder="e.g. Town hall on Friday" /></Field>
                <Field label="Message"><textarea style={{ ...inputStyle, minHeight: 64, resize: 'vertical' }} maxLength={260} value={a.body} onChange={e => upd('announcements', a.id, { body: e.target.value })} placeholder="Short and readable from across the room" /></Field>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: font.body, fontSize: '.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Colour</span>
                  {Object.entries(ANNOUNCE_COLORS).map(([k, c]) => (
                    <button key={k} type="button" aria-label={k} title={k} onClick={() => upd('announcements', a.id, { color: k })}
                      style={{ width: 26, height: 26, borderRadius: '50%', cursor: 'pointer', background: `linear-gradient(135deg, ${c[0]}, ${c[1]})`, border: a.color === k ? '3px solid var(--text-primary)' : '2px solid transparent' }} />
                  ))}
                </div>
                <ImagePick value={a.image} onChange={v => upd('announcements', a.id, { image: v })} />
                <div style={row2}>
                  <Field label="Show from (optional)"><input type="date" style={inputStyle} value={a.from} onChange={e => upd('announcements', a.id, { from: e.target.value })} /></Field>
                  <Field label="Show until (optional)"><input type="date" style={inputStyle} value={a.until} onChange={e => upd('announcements', a.id, { until: e.target.value })} /></Field>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Btn variant="danger" icon={Trash2} onClick={() => del('announcements', a.id)}>Delete</Btn></div>
              </div>
            ))}
            <Btn variant="ghost" icon={Plus} onClick={() => setList('announcements', l => [...l, newItem.announcement()])}>Add announcement</Btn>
          </Section>

          <Section icon={Star} title="Star of the month" hint="Recognise someone on every screen" right={<Toggle on={!!draft.star.on} label="Show star of the month" onChange={v => set({ star: { ...draft.star, on: v } })} />}>
            <div style={row2}>
              <Field label="Name">
                <input style={inputStyle} list="tvs-people" value={draft.star.name} onChange={e => pickStar(e.target.value)} placeholder="Start typing a name" />
                <datalist id="tvs-people">{people.slice(0, 2000).map(p => <option key={p.id} value={p.name} />)}</datalist>
              </Field>
              <Field label="Designation"><input style={inputStyle} value={draft.star.role} onChange={e => set({ star: { ...draft.star, role: e.target.value } })} /></Field>
              <Field label="Department"><input style={inputStyle} value={draft.star.dept} onChange={e => set({ star: { ...draft.star, dept: e.target.value } })} /></Field>
            </div>
            <Field label="Why (one or two lines)"><textarea style={{ ...inputStyle, minHeight: 56, resize: 'vertical' }} maxLength={200} value={draft.star.reason} onChange={e => set({ star: { ...draft.star, reason: e.target.value } })} /></Field>
            <ImagePick value={draft.star.photo} onChange={v => set({ star: { ...draft.star, photo: v } })} label="Photo" />
          </Section>

          <Section icon={Cake} title="Birthdays" hint="Shown during the birthday week. Tip: add a DOB column to the monthly employee sheet to make this automatic" right={<span className="tvs-count">{draft.birthdays.length}</span>}>
            {draft.birthdays.map(b => (
              <div key={b.id} style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1.4fr) minmax(0,1fr) 150px 30px', gap: 8, alignItems: 'end' }}>
                <Field label="Name"><input style={inputStyle} list="tvs-people" value={b.name} onChange={e => { const p = people.find(x => x.name.toLowerCase() === e.target.value.toLowerCase()); upd('birthdays', b.id, { name: e.target.value, ...(p && !b.dept ? { dept: p.department } : {}) }); }} /></Field>
                <Field label="Department"><input style={inputStyle} value={b.dept} onChange={e => upd('birthdays', b.id, { dept: e.target.value })} /></Field>
                <Field label="Birthday"><input type="date" style={inputStyle} value={b.date} onChange={e => upd('birthdays', b.id, { date: e.target.value })} /></Field>
                <button type="button" style={{ ...iconBtn, color: 'var(--danger)', marginBottom: 2 }} aria-label="Remove" onClick={() => del('birthdays', b.id)}><Trash2 size={14} /></button>
              </div>
            ))}
            <Btn variant="ghost" icon={Plus} onClick={() => setList('birthdays', l => [...l, newItem.birthday()])}>Add birthday</Btn>
          </Section>

          <Section icon={CalendarDays} title="Upcoming events" hint="Town halls, celebrations, trainings — with a countdown" right={<span className="tvs-count">{draft.events.length}</span>}>
            {draft.events.map(e => (
              <div key={e.id} style={itemBox}>
                <Field label="Event"><input style={inputStyle} value={e.title} maxLength={80} onChange={x => upd('events', e.id, { title: x.target.value })} placeholder="e.g. Diwali celebration" /></Field>
                <div style={row2}>
                  <Field label="Date"><input type="date" style={inputStyle} value={e.date} onChange={x => upd('events', e.id, { date: x.target.value })} /></Field>
                  <Field label="Time"><input style={inputStyle} value={e.time} onChange={x => upd('events', e.id, { time: x.target.value })} placeholder="4:00 PM" /></Field>
                  <Field label="Place"><input style={inputStyle} value={e.place} onChange={x => upd('events', e.id, { place: x.target.value })} placeholder="Cafeteria, IFC" /></Field>
                </div>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Btn variant="danger" icon={Trash2} onClick={() => del('events', e.id)}>Delete</Btn></div>
              </div>
            ))}
            <Btn variant="ghost" icon={Plus} onClick={() => setList('events', l => [...l, newItem.event()])}>Add event</Btn>
          </Section>

          <Section icon={ShieldCheck} title="Safety tips / thought of the day" hint="One per loop, rotating">
            <Field label="Heading"><input style={inputStyle} value={draft.tipsLabel} onChange={e => set({ tipsLabel: e.target.value })} placeholder="Safety first" /></Field>
            <Field label="Tips — one per line"><textarea style={{ ...inputStyle, minHeight: 110, resize: 'vertical' }} value={draft.tips.join('\n')} onChange={e => set({ tips: e.target.value.split('\n') })} /></Field>
          </Section>

          <Section icon={Film} title="Posters & videos" hint="Full-screen poster images, or an MP4 link (e.g. a project walkthrough on the company server)" right={<span className="tvs-count">{draft.media.length}</span>}>
            {draft.media.map(m => (
              <div key={m.id} style={itemBox}>
                {m.type === 'image'
                  ? <ImagePick value={m.src || null} onChange={v => upd('media', m.id, { src: v || '' })} label="Poster" />
                  : <Field label="Video link (MP4)" hint="Plays muted. Must be reachable from the TV, e.g. http://192.168.66.28/videos/sky-arc.mp4"><input style={inputStyle} value={m.src} onChange={e => upd('media', m.id, { src: e.target.value.trim() })} placeholder="http://…/video.mp4" /></Field>}
                <Field label="Caption (optional)"><input style={inputStyle} value={m.caption} maxLength={80} onChange={e => upd('media', m.id, { caption: e.target.value })} /></Field>
                <div style={{ display: 'flex', justifyContent: 'flex-end' }}><Btn variant="danger" icon={Trash2} onClick={() => del('media', m.id)}>Delete</Btn></div>
              </div>
            ))}
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
              <Btn variant="ghost" icon={ImagePlus} onClick={() => setList('media', l => [...l, newItem.media('image')])}>Add poster</Btn>
              <Btn variant="ghost" icon={Video} onClick={() => setList('media', l => [...l, newItem.media('video')])}>Add video link</Btn>
            </div>
          </Section>

          <Section icon={Type} title="Welcome text & ticker" hint="Greeting scene and the scrolling line at the bottom">
            <Field label="Welcome title"><input style={inputStyle} value={draft.welcomeTitle} maxLength={60} onChange={e => set({ welcomeTitle: e.target.value })} /></Field>
            <Field label="Welcome line"><input style={inputStyle} value={draft.welcomeSub} maxLength={90} onChange={e => set({ welcomeSub: e.target.value })} /></Field>
            <Field label="Ticker messages — one per line"><textarea style={{ ...inputStyle, minHeight: 90, resize: 'vertical' }} value={draft.ticker.join('\n')} onChange={e => set({ ticker: e.target.value.split('\n') })} /></Field>
            <Field label="New joiners: show people who joined in the last … days"><input type="number" min={7} max={90} style={{ ...inputStyle, width: 100 }} value={draft.joinerDays} onChange={e => set({ joinerDays: Math.max(7, Math.min(90, Number(e.target.value) || 30)) })} /></Field>
          </Section>

          <p style={{ fontFamily: font.body, fontSize: '.72rem', color: bytes > 15 * 1048576 ? 'var(--danger)' : 'var(--text-muted)' }}>
            <Check size={12} style={{ verticalAlign: -2 }} /> Content size {mb(bytes)} of 20 MB (pictures are resized automatically). The TV only ever shows names, designations and departments — never phone numbers, e-mails or punch times.
          </p>
        </div>
      </div>

      <style>{`
        .tvs-tv{position:relative;padding:14px 14px 22px;border-radius:18px;background:linear-gradient(180deg,#1f2937,#0b1020);box-shadow:0 30px 60px rgba(0,0,0,.35),inset 0 0 0 1px rgba(255,255,255,.08)}
        .tvs-screen{aspect-ratio:16/9;border-radius:6px;overflow:hidden;background:#000;box-shadow:inset 0 0 0 1px rgba(255,255,255,.06)}
        .tvs-led{position:absolute;bottom:8px;left:50%;width:6px;height:6px;border-radius:50%;transform:translateX(-50%);background:#22c55e;box-shadow:0 0 8px #22c55e}
        .tvs-stand{width:22%;height:22px;margin:0 auto;background:linear-gradient(180deg,#374151,#111827);clip-path:polygon(18% 0,82% 0,100% 100%,0 100%);border-radius:0 0 6px 6px}
        .tvs-chip{font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:.72rem;padding:6px 11px;border-radius:20px;cursor:pointer;border:1px solid var(--border);background:var(--bg-elevated);color:var(--text-secondary);transition:all .15s}
        .tvs-chip.on,.tvs-chip:hover{border-color:var(--accent);color:var(--accent);background:color-mix(in srgb,var(--accent) 10%,var(--bg-elevated))}
        .tvs-count{font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:.7rem;min-width:22px;height:22px;padding:0 6px;border-radius:11px;display:inline-flex;align-items:center;justify-content:center;background:var(--bg-elevated);border:1px solid var(--border);color:var(--text-secondary)}
        @media (max-width: 1100px){ .tvs-layout{grid-template-columns:1fr !important} .tvs-preview{position:static !important} }
      `}</style>
    </div>
  );
}
