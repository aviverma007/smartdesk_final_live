import React, { useEffect, useMemo, useRef, useState } from 'react';
import { PartyPopper, Newspaper, Activity, Star, Cake, Award, Sparkles, CalendarDays, MapPin, Megaphone, Palmtree, UserPlus } from 'lucide-react';
import {
  fetchTvConfig, loadPeople, loadAttendance, upcomingHolidays, birthdaysThisWeek, activeAnnouncements, upcomingEvents, ANNOUNCE_COLORS,
} from './tv/tvData';

/*
 * Home bottom row — live, not placeholders:
 *   Celebrations   stars of the month, birthdays, work anniversaries, new joiners (rotating)
 *   Company news   HR announcements + upcoming events (same content HR publishes to the office TVs)
 *   Today          people in office now, busiest sites, new joiners, next holiday countdown
 * Content comes from the TV Display settings (HR), the employee sheet (DOJ) and live attendance.
 */

const font = { head: "'Plus Jakarta Sans',sans-serif", body: "'DM Sans',sans-serif", label: "'Orbitron', monospace" };
const initialsOf = (n = '') => n.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();
const fmt = (d, o = { day: 'numeric', month: 'short' }) => d.toLocaleDateString('en-IN', o);
const when = (n, d) => (n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : fmt(d, { weekday: 'short', day: 'numeric', month: 'short' }));
const ago = (d) => { if (!d) return ''; const m = Math.max(0, Math.round((Date.now() - d) / 60000)); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ago`; };

function useHighlights() {
  const [cfg, setCfg] = useState(null);
  const [people, setPeople] = useState({ joiners: [], anniversaries: [] });
  const [att, setAtt] = useState(undefined); // undefined = loading, null = unavailable
  useEffect(() => {
    let alive = true;
    fetchTvConfig().then(r => alive && setCfg(r.config)).catch(() => {});
    loadPeople(30).then(p => alive && setPeople(p)).catch(() => {});
    const a = () => loadAttendance().then(x => alive && setAtt(x)).catch(() => alive && setAtt(null));
    a();
    const t = setInterval(a, 60 * 1000);
    return () => { alive = false; clearInterval(t); };
  }, []);
  return { cfg, people, att };
}

function useCountUp(target, ms = 1300) {
  const [v, setV] = useState(0);
  useEffect(() => {
    if (!target) { setV(0); return undefined; }
    let raf; const t0 = performance.now();
    const step = (t) => { const p = Math.min(1, (t - t0) / ms); setV(Math.round(target * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}

const Header = ({ icon: Icon, color, label, right }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
    <span className="hh-icon" style={{ '--c': color }}><Icon size={13} /></span>
    <span style={{ fontFamily: font.label, fontSize: '.62rem', fontWeight: 700, color: 'var(--text-primary)', letterSpacing: '.08em' }}>{label}</span>
    <span style={{ flex: 1 }} />
    {right}
  </div>
);

const Avatar = ({ name, photo, hue = 0, size = 46 }) => (photo
  ? <img src={photo} alt="" className="hh-avatar" style={{ width: size, height: size, objectFit: 'cover' }} />
  : <div className="hh-avatar" style={{ width: size, height: size, fontSize: size * 0.36, '--h': `${hue}deg` }}>{initialsOf(name)}</div>);

const Empty = ({ icon: Icon, text }) => (
  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 8, padding: '18px 0', color: 'var(--text-muted)', fontFamily: font.body, fontSize: '.76rem', textAlign: 'center' }}>
    <Icon size={22} style={{ opacity: 0.6 }} />{text}
  </div>
);

/* ── Celebrations ─────────────────────────────────────────────────────────── */
function Celebrations({ cfg, people, CyberCard }) {
  const items = useMemo(() => {
    const out = [];
    const stars = cfg?.star?.on ? (cfg.star.people || []).filter(p => p.name) : [];
    stars.forEach((s, i) => out.push({ key: `s${i}`, kind: 'star', name: s.name, photo: s.photo, sub: [s.role, s.dept].filter(Boolean).join(' · '), note: s.reason, tag: cfg.star.title || (stars.length > 1 ? 'Stars of the month' : 'Star of the month') }));
    birthdaysThisWeek(cfg?.birthdays).forEach((b, i) => out.push({ key: `b${i}`, kind: 'birthday', name: b.name, sub: b.dept, tag: `Birthday · ${when(b.daysAway, b.on)}`, today: b.daysAway === 0 }));
    people.anniversaries.forEach((a, i) => out.push({ key: `a${i}`, kind: 'anniversary', name: a.name, sub: [a.designation, a.department].filter(Boolean).join(' · '), tag: `${a.years} yr${a.years > 1 ? 's' : ''} at Smart World · ${when(a.daysAway, a.on)}`, years: a.years, today: a.daysAway === 0 }));
    people.joiners.slice(0, 6).forEach((j, i) => out.push({ key: `j${i}`, kind: 'joiner', name: j.name, sub: [j.designation, j.department].filter(Boolean).join(' · '), tag: `New joiner · ${fmt(j.doj)}` }));
    return out;
  }, [cfg, people]);
  const [i, setI] = useState(0);
  const [paused, setPaused] = useState(false);
  useEffect(() => { setI(0); }, [items.length]);
  useEffect(() => {
    if (items.length < 2 || paused) return undefined;
    const t = setTimeout(() => setI(x => (x + 1) % items.length), 4500);
    return () => clearTimeout(t);
  }, [i, items.length, paused]);
  const it = items[i];
  // Animate only when the card rotates to the next person — never when the tab first opens
  const startI = useRef(i); const rotated = useRef(false);
  if (i !== startI.current) rotated.current = true;
  const meta = it && {
    star: { Icon: Star, color: '#f59e0b' }, birthday: { Icon: Cake, color: '#ec4899' },
    anniversary: { Icon: Award, color: '#8b5cf6' }, joiner: { Icon: UserPlus, color: '#10b981' },
  }[it.kind];
  const counts = useMemo(() => ['star', 'birthday', 'anniversary', 'joiner'].map(k => [k, items.filter(x => x.kind === k).length]).filter(([, n]) => n), [items]);

  return (
    <CyberCard color="#ff6b00" style={{ height: '100%' }}>
      <div style={{ padding: '14px 16px', height: '100%', display: 'flex', flexDirection: 'column' }} onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}>
        <Header icon={PartyPopper} color="#ff6b00" label="CELEBRATIONS" right={items.length > 0 && <span className="hh-pill" style={{ '--c': '#ff6b00' }}>{items.length} this week</span>} />
        {!it ? <Empty icon={Sparkles} text="Nothing to celebrate yet this week — HR can add stars and birthdays in TV Display." /> : (
          <>
            <div key={it.key} className={rotated.current ? "hh-swap hh-celebrate" : "hh-celebrate"} style={{ '--c': meta.color }}>
              {(it.kind === 'star' || it.today) && <div className="hh-confetti">{Array.from({ length: 14 }, (_, k) => <i key={k} style={{ '--x': `${(k * 37) % 100}%`, '--d': `${(k % 7) * 0.35}s`, '--h': `${(k * 53) % 360}deg` }} />)}</div>}
              <div style={{ position: 'relative' }}>
                <div className={it.kind === 'star' ? 'hh-ring' : ''} style={{ padding: it.kind === 'star' ? 3 : 0, borderRadius: '50%' }}>
                  <Avatar name={it.name} photo={it.photo} hue={(i * 67) % 360} size={52} />
                </div>
                <span className="hh-badge" style={{ background: meta.color }}>{it.kind === 'anniversary' ? it.years : <meta.Icon size={11} />}</span>
              </div>
              <div style={{ minWidth: 0, flex: 1 }}>
                <div className="hh-tag" style={{ color: meta.color, '--tc': meta.color }}>{it.tag}</div>
                <div className="hh-name">{it.name}</div>
                {it.sub && <div className="hh-sub">{it.sub}</div>}
                {it.note && <div className="hh-note">“{it.note}”</div>}
              </div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 'auto', paddingTop: 12 }}>
              <div className="hh-faces">
                {items.length > 1 && Array.from({ length: Math.min(6, items.length - 1) }, (_, k) => {
                  const idx = (i + 1 + k) % items.length, x = items[idx];
                  const c = { star: '#f59e0b', birthday: '#ec4899', anniversary: '#8b5cf6', joiner: '#10b981' }[x.kind];
                  return (
                    <button key={x.key} type="button" title={`${x.name} — ${x.tag}`} aria-label={`Show ${x.name}`} onClick={() => setI(idx)} className="hh-face" style={{ '--c': c, zIndex: 10 - k }}>
                      <Avatar name={x.name} photo={x.photo} hue={(idx * 67) % 360} size={26} />
                    </button>
                  );
                })}
                {items.length > 7 && <span className="hh-more">+{items.length - 7}</span>}
              </div>
              <span style={{ flex: 1 }} />
              <span className="hh-more" style={{ fontFamily: font.body, fontSize: '.66rem', color: 'var(--text-muted)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', minWidth: 0 }}>
                {counts.map(([k, n]) => `${n} ${{ star: n > 1 ? 'stars' : 'star', birthday: n > 1 ? 'birthdays' : 'birthday', anniversary: n > 1 ? 'anniversaries' : 'anniversary', joiner: n > 1 ? 'joiners' : 'joiner' }[k]}`).join(' · ')}
              </span>
            </div>
          </>
        )}
      </div>
    </CyberCard>
  );
}

/* ── Company news ─────────────────────────────────────────────────────────── */
function CompanyNews({ cfg, CyberCard }) {
  const news = useMemo(() => {
    const ann = activeAnnouncements(cfg?.announcements).map(a => ({ key: `a${a.id}`, kind: 'ann', title: a.title || 'Announcement', body: a.body, color: (ANNOUNCE_COLORS[a.color] || ANNOUNCE_COLORS.blue)[0], image: a.image }));
    const ev = upcomingEvents(cfg?.events).map(e => ({ key: `e${e.id}`, kind: 'event', title: e.title, body: [e.time, e.place].filter(Boolean).join(' · '), d: e.d, daysAway: e.daysAway }));
    const list = [...ann, ...ev];
    if (list.length < 3) upcomingHolidays(3 - list.length).forEach(h => list.push({ key: `h${h.id}`, kind: 'holiday', title: h.name, body: fmt(h.d, { weekday: 'long', day: 'numeric', month: 'long' }), d: h.d, daysAway: h.daysAway }));
    return list;
  }, [cfg]);
  const shown = news.slice(0, 3);
  return (
    <CyberCard color="#0066ff" style={{ height: '100%' }}>
      <div style={{ padding: '14px 16px', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Header icon={Newspaper} color="#0066ff" label="COMPANY NEWS" right={news.some(n => n.kind === 'ann') && <span className="hh-pill hh-live" style={{ '--c': '#ef4444' }}><i />NEW</span>} />
        {!shown.length ? <Empty icon={Megaphone} text="No announcements right now." /> : (
          <div style={{ display: 'grid', gap: 8 }}>
            {shown.map((n, k) => (
              <div key={n.key} className="hh-news" style={{ '--c': n.kind === 'ann' ? n.color : n.kind === 'event' ? '#06b6d4' : '#f97316' }}>
                {n.kind === 'ann'
                  ? (n.image ? <img src={n.image} alt="" className="hh-thumb" /> : <span className="hh-newsicon"><Megaphone size={15} /></span>)
                  : <span className="hh-date"><b>{n.d.getDate()}</b>{fmt(n.d, { month: 'short' })}</span>}
                <div style={{ minWidth: 0, flex: 1 }}>
                  <div className="hh-newstitle">{n.title}</div>
                  {n.body && <div className="hh-newsbody">{n.body}</div>}
                </div>
                {n.kind !== 'ann' && <span className="hh-when">{n.daysAway === 0 ? 'Today' : n.daysAway === 1 ? 'Tomorrow' : `${n.daysAway}d`}</span>}
              </div>
            ))}
          </div>
        )}
        {news.length > 3 && <div style={{ marginTop: 'auto', paddingTop: 8, fontFamily: font.body, fontSize: '.68rem', color: 'var(--text-muted)' }}>+{news.length - 3} more on the office TV</div>}
      </div>
    </CyberCard>
  );
}

/* ── Today at Smart World ─────────────────────────────────────────────────── */
function Today({ people, att, CyberCard }) {
  const present = att?.present || 0;
  const n = useCountUp(present);
  const sites = (att?.sites || []).slice(0, 3);
  const max = Math.max(1, ...sites.map(s => s.count));
  const hol = upcomingHolidays(1)[0];
  return (
    <CyberCard color="#105da9" style={{ height: '100%' }}>
      <div style={{ padding: '14px 16px', height: '100%', display: 'flex', flexDirection: 'column' }}>
        <Header icon={Activity} color="#10b981" label="TODAY AT SMART WORLD" right={att && <span className="hh-pill hh-live" style={{ '--c': '#10b981' }}><i />LIVE</span>} />
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, minWidth: 0 }}>
          <div className="hh-big">{att === undefined ? '…' : att ? n : '—'}</div>
          <div className="hh-sub" style={{ minWidth: 0 }}>{att ? `in office · last check-in ${ago(att.last)}` : att === null ? 'attendance unavailable' : 'loading…'}</div>
        </div>
        {sites.length > 0 && (
          <div style={{ display: 'grid', gap: 5, marginTop: 10, minWidth: 0 }}>
            {sites.map((s, k) => (
              <div key={s.name} className="hh-site">
                <MapPin size={10} style={{ flexShrink: 0, opacity: 0.6 }} />
                <span className="hh-sitename">{s.name}</span>
                <span className="hh-bar"><i style={{ width: `${(s.count / max) * 100}%` }} /></span>
                <b>{s.count}</b>
              </div>
            ))}
          </div>
        )}
        {att && present > 0 && (
          <div style={{ marginTop: 12 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: font.body, fontSize: '.66rem', color: 'var(--text-muted)', marginBottom: 4 }}>
              <span>Checked in by 9:30 AM</span><b style={{ color: 'var(--text-primary)', fontFamily: font.head }}>{Math.round((att.onTime / present) * 100)}%</b>
            </div>
            <span className="hh-bar" style={{ display: 'block', height: 8 }}><i style={{ width: `${(att.onTime / present) * 100}%`, background: 'linear-gradient(90deg,#f59e0b,#10b981)' }} /></span>
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 'auto', paddingTop: 12 }}>
          <div className="hh-stat" style={{ '--c': '#10b981' }}>
            <UserPlus size={14} />
            <div><b>{people.joiners.length}</b><span>new joiners · 30 days</span></div>
          </div>
          <div className="hh-stat" style={{ '--c': '#f97316' }}>
            {hol ? <><Palmtree size={14} /><div><b>{hol.daysAway === 0 ? 'Today' : `${hol.daysAway} days`}</b><span>to {hol.name}</span></div></>
              : <><CalendarDays size={14} /><div><b>{fmt(new Date(), { weekday: 'short' })}</b><span>{fmt(new Date(), { day: 'numeric', month: 'long' })}</span></div></>}
          </div>
        </div>
      </div>
    </CyberCard>
  );
}

export default function HomeHighlights({ CyberCard }) {
  const { cfg, people, att } = useHighlights();
  return (
    <>
      {/* minmax(0,1fr): long names or designations can never push a card off the screen */}
      <div className="hh-row" style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 14, alignItems: 'stretch', width: '100%', minWidth: 0 }}>
        <div style={{ minHeight: 200, minWidth: 0 }}><Celebrations cfg={cfg} people={people} CyberCard={CyberCard} /></div>
        <div style={{ minHeight: 200, minWidth: 0 }}><CompanyNews cfg={cfg} CyberCard={CyberCard} /></div>
        <div style={{ minHeight: 200, minWidth: 0 }}><Today people={people} att={att} CyberCard={CyberCard} /></div>
      </div>
      <style>{`
        .hh-icon{width:24px;height:24px;border-radius:7px;display:inline-flex;align-items:center;justify-content:center;color:var(--c);background:color-mix(in srgb,var(--c) 16%,transparent)}
        .hh-pill{font-family:'DM Sans',sans-serif;font-size:.62rem;font-weight:700;padding:3px 8px;border-radius:20px;color:var(--c);background:color-mix(in srgb,var(--c) 14%,transparent);border:1px solid color-mix(in srgb,var(--c) 35%,transparent);display:inline-flex;align-items:center;gap:5px;letter-spacing:.04em}
        .hh-live i{width:6px;height:6px;border-radius:50%;background:var(--c);animation:hhPulse 1.6s infinite}
        @keyframes hhPulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--c) 70%,transparent)}100%{box-shadow:0 0 0 8px transparent}}
        .hh-avatar{border-radius:50%;display:flex;align-items:center;justify-content:center;font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;color:#fff;flex-shrink:0;background:linear-gradient(135deg,hsl(var(--h,0deg) 80% 58%),hsl(calc(var(--h,0deg) + 60deg) 75% 46%))}
        .hh-ring{background:conic-gradient(#f59e0b,#ec4899,#8b5cf6,#f59e0b);animation:hhSpin 5s linear infinite}
        .hh-ring > *{animation:hhSpin 5s linear infinite reverse}
        @keyframes hhSpin{to{transform:rotate(360deg)}}
        .hh-badge{position:absolute;right:-3px;bottom:-3px;min-width:20px;height:20px;padding:0 4px;border-radius:10px;display:flex;align-items:center;justify-content:center;color:#fff;font-family:'Plus Jakarta Sans',sans-serif;font-size:.66rem;font-weight:800;border:2px solid var(--bg-card)}
        .hh-celebrate{position:relative;display:flex;min-width:0;align-items:center;gap:14px;padding:12px;border-radius:12px;overflow:hidden;
          background:linear-gradient(135deg,color-mix(in srgb,var(--c) 14%,transparent),transparent 70%);border:1px solid color-mix(in srgb,var(--c) 28%,transparent)}
        .hh-swap{animation:hhSwap .55s cubic-bezier(.2,.8,.2,1) both}
        @keyframes hhSwap{from{opacity:0;transform:translateY(10px) scale(.98);filter:blur(4px)}to{opacity:1;transform:none;filter:none}}
        .hh-tag{font-family:'DM Sans',sans-serif;font-size:.64rem;font-weight:700;text-transform:uppercase;letter-spacing:.06em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .hh-name{font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:.95rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:2px}
        .hh-sub{font-family:'DM Sans',sans-serif;font-size:.7rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .hh-note{font-family:'DM Sans',sans-serif;font-size:.7rem;color:var(--text-secondary);font-style:italic;margin-top:4px;display:-webkit-box;-webkit-line-clamp:2;-webkit-box-orient:vertical;overflow:hidden}
        .hh-confetti{position:absolute;inset:0;pointer-events:none;overflow:hidden}
        .hh-confetti i{position:absolute;top:-10px;left:var(--x);width:5px;height:9px;border-radius:2px;background:hsl(var(--h) 90% 60%);opacity:.8;animation:hhFall 3.2s linear var(--d) infinite}
        @keyframes hhFall{to{transform:translateY(120px) rotate(540deg)}}
        .hh-faces{display:flex;align-items:center;padding-left:6px;flex-shrink:0}
        .hh-face{margin-left:-7px;padding:2px;border-radius:50%;border:none;cursor:pointer;background:var(--c);box-shadow:0 0 0 2px var(--bg-card);transition:transform .2s;position:relative}
        .hh-face:hover{transform:translateY(-3px) scale(1.1);z-index:20 !important}
        .hh-more{margin-left:6px;font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:.66rem;color:var(--text-muted)}
        .hh-news{display:flex;min-width:0;align-items:center;gap:10px;padding:8px 10px;border-radius:10px;background:color-mix(in srgb,var(--c) 7%,transparent);border-left:3px solid var(--c);transition:transform .2s}
        .hh-news:hover{transform:translateX(3px)}
        .hh-newsicon{width:34px;height:34px;border-radius:9px;display:flex;align-items:center;justify-content:center;color:#fff;background:var(--c);flex-shrink:0}
        .hh-thumb{width:34px;height:34px;border-radius:9px;object-fit:cover;flex-shrink:0}
        .hh-date{width:34px;height:34px;border-radius:9px;display:flex;flex-direction:column;align-items:center;justify-content:center;flex-shrink:0;font-family:'DM Sans',sans-serif;font-size:.52rem;text-transform:uppercase;color:var(--c);background:color-mix(in srgb,var(--c) 14%,transparent);line-height:1}
        .hh-date b{font-family:'Plus Jakarta Sans',sans-serif;font-size:.85rem;margin-bottom:1px}
        .hh-newstitle{font-family:'Plus Jakarta Sans',sans-serif;font-weight:700;font-size:.78rem;color:var(--text-primary);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .hh-newsbody{font-family:'DM Sans',sans-serif;font-size:.68rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .hh-when{font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:.64rem;color:var(--c);padding:3px 7px;border-radius:12px;background:color-mix(in srgb,var(--c) 14%,transparent);white-space:nowrap}
        .hh-big{font-family:'Plus Jakarta Sans',sans-serif;font-weight:800;font-size:2.5rem;line-height:1;letter-spacing:-.03em;font-variant-numeric:tabular-nums;
          background:linear-gradient(135deg,#10b981,#0ea5e9);-webkit-background-clip:text;background-clip:text;color:transparent}
        .hh-site{display:grid;grid-template-columns:auto minmax(0,1fr) minmax(40px,38%) 30px;align-items:center;gap:6px;font-family:'DM Sans',sans-serif;font-size:.66rem;color:var(--text-secondary)}
        .hh-sitename{white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        .hh-site b{text-align:right;color:var(--text-primary);font-family:'Plus Jakarta Sans',sans-serif}
        .hh-bar{height:6px;border-radius:4px;background:var(--border);overflow:hidden}
        .hh-bar i{display:block;height:100%;border-radius:4px;background:linear-gradient(90deg,#10b981,#0ea5e9);transition:width .6s ease}
        .hh-stat{display:flex;align-items:center;gap:8px;padding:8px 10px;border-radius:10px;color:var(--c);background:color-mix(in srgb,var(--c) 10%,transparent);border:1px solid color-mix(in srgb,var(--c) 25%,transparent);min-width:0}
        .hh-stat div{min-width:0;display:flex;flex-direction:column}
        .hh-stat b{font-family:'Plus Jakarta Sans',sans-serif;font-size:.9rem;color:var(--text-primary);line-height:1.1}
        .hh-stat span{font-family:'DM Sans',sans-serif;font-size:.62rem;color:var(--text-muted);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
        /* keep the accent colours inside .home-card (which forces one text colour) */
        html .home-card .hh-tag{color:var(--tc) !important}
        html .home-card .hh-big{color:transparent !important;-webkit-text-fill-color:transparent}
        html .home-card .hh-pill, html .home-card .hh-icon, html .home-card .hh-icon *, html .home-card .hh-date, html .home-card .hh-date b, html .home-card .hh-when, html .home-card .hh-stat > svg{color:var(--c) !important}
        html .home-card .hh-avatar, html .home-card .hh-badge, html .home-card .hh-badge *, html .home-card .hh-newsicon, html .home-card .hh-newsicon *{color:#fff !important}
        html .home-card .hh-sub, html .home-card .hh-newsbody, html .home-card .hh-stat span, html .home-card .hh-more{color:var(--text-muted) !important;font-weight:500 !important}
        html .home-card .hh-note{color:var(--text-secondary) !important;font-weight:500 !important}
        .hh-row .home-card{min-width:0;max-width:100%}
        @media (max-width: 1100px){ .hh-row{grid-template-columns:minmax(0,1fr) !important} }
        @media (prefers-reduced-motion: reduce){ .hh-row *{animation:none !important} }
      `}</style>
    </>
  );
}
