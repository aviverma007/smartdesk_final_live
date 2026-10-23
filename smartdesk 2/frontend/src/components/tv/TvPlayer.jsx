import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ANNOUNCE_COLORS, loadPeople, loadAttendance, upcomingHolidays, birthdaysThisWeek,
  activeAnnouncements, upcomingEvents,
} from './tvData';

/*
 * The office TV loop. Everything is laid out on a fixed 1920×1080 stage and scaled to
 * fit (a TV, or the small preview in the HR tab), so it looks identical everywhere.
 * "Morph" look: SVG blobs whose outlines morph continuously, colour fields that blend
 * into each scene's palette, circular reveal between scenes, words that rise out of a blur.
 */

const W = 1920, H = 1080;

const PALETTES = {
  welcome: ['#2f6fe0', '#5b3fd6', '#00b4ff'],
  attendance: ['#059669', '#0ea5e9', '#2f6fe0'],
  joiners: ['#f59e0b', '#ef4444', '#a855f7'],
  anniversaries: ['#a855f7', '#ec4899', '#f59e0b'],
  birthdays: ['#ec4899', '#f97316', '#facc15'],
  holidays: ['#f97316', '#eab308', '#ef4444'],
  star: ['#f59e0b', '#facc15', '#a855f7'],
  events: ['#06b6d4', '#3b82f6', '#8b5cf6'],
  tips: ['#16a34a', '#14b8a6', '#0ea5e9'],
  media: ['#334155', '#1e3a8a', '#475569'],
};

/* ── live data hook (attendance every minute, people every 30 min) ──────── */
export function useTvLive(config, site) {
  const [people, setPeople] = useState({ joiners: [], anniversaries: [] });
  const [attendance, setAttendance] = useState(null);
  const [tick, setTick] = useState(0);
  const joinerDays = config?.joinerDays || 30;
  useEffect(() => {
    let alive = true;
    const loadP = () => loadPeople(joinerDays).then(p => alive && setPeople(p)).catch(() => {});
    const loadA = () => loadAttendance(site).then(a => alive && setAttendance(a)).catch(() => {});
    loadP(); loadA();
    const a = setInterval(loadA, 60 * 1000);
    const p = setInterval(loadP, 30 * 60 * 1000);
    const t = setInterval(() => setTick(x => x + 1), 60 * 60 * 1000); // re-evaluate dates hourly
    return () => { alive = false; clearInterval(a); clearInterval(p); clearInterval(t); };
  }, [joinerDays, site]);
  return useMemo(() => ({ ...people, attendance, holidays: upcomingHolidays(4), tick }), [people, attendance, tick]);
}

/* ── playlist ───────────────────────────────────────────────────────────── */
function buildPlaylist(cfg, live, tipIdx) {
  const out = [];
  for (const s of cfg.scenes) {
    if (!s.on) continue;
    const base = { scene: s.id, secs: s.secs, palette: PALETTES[s.id] };
    switch (s.id) {
      case 'welcome': out.push({ ...base, key: 'welcome' }); break;
      case 'attendance': if (live.attendance && live.attendance.present > 0) out.push({ ...base, key: 'attendance' }); break;
      case 'joiners': if (live.joiners?.length) out.push({ ...base, key: 'joiners' }); break;
      case 'anniversaries': if (live.anniversaries?.length) out.push({ ...base, key: 'anniversaries' }); break;
      case 'birthdays': { const b = birthdaysThisWeek(cfg.birthdays); if (b.length) out.push({ ...base, key: 'birthdays', payload: b }); break; }
      case 'holidays': if (live.holidays?.length) out.push({ ...base, key: 'holidays' }); break;
      case 'announcements': activeAnnouncements(cfg.announcements).forEach(a => out.push({ ...base, key: `ann-${a.id}`, payload: a, palette: ANNOUNCE_COLORS[a.color] || ANNOUNCE_COLORS.blue })); break;
      case 'star': if (cfg.star?.on && cfg.star.name) out.push({ ...base, key: 'star', payload: cfg.star }); break;
      case 'events': { const e = upcomingEvents(cfg.events); if (e.length) out.push({ ...base, key: 'events', payload: e }); break; }
      case 'tips': { const t = (cfg.tips || []).filter(Boolean); if (t.length) out.push({ ...base, key: 'tips', payload: { label: cfg.tipsLabel, text: t[tipIdx % t.length] } }); break; }
      case 'media': (cfg.media || []).filter(m => m.src).forEach(m => out.push({ ...base, key: `media-${m.id}`, payload: m })); break;
      default:
    }
  }
  return out.length ? out : [{ scene: 'welcome', key: 'welcome', secs: 12, palette: PALETTES.welcome }];
}

/* ── morphing blobs ─────────────────────────────────────────────────────── */
function rng(seed) { let s = seed; return () => { s = (s * 16807) % 2147483647; return (s - 1) / 2147483646; }; }
function blobPath(cx, cy, r, rand, n = 7) {
  const pts = Array.from({ length: n }, (_, i) => {
    const a = (i / n) * Math.PI * 2, rr = r * (0.72 + rand() * 0.5);
    return [cx + Math.cos(a) * rr, cy + Math.sin(a) * rr];
  });
  // Catmull-Rom → cubic Bézier, closed
  let d = `M${pts[0][0].toFixed(1)},${pts[0][1].toFixed(1)}`;
  for (let i = 0; i < n; i++) {
    const p0 = pts[(i - 1 + n) % n], p1 = pts[i], p2 = pts[(i + 1) % n], p3 = pts[(i + 2) % n];
    const c1 = [p1[0] + (p2[0] - p0[0]) / 6, p1[1] + (p2[1] - p0[1]) / 6];
    const c2 = [p2[0] - (p3[0] - p1[0]) / 6, p2[1] - (p3[1] - p1[1]) / 6];
    d += ` C${c1[0].toFixed(1)},${c1[1].toFixed(1)} ${c2[0].toFixed(1)},${c2[1].toFixed(1)} ${p2[0].toFixed(1)},${p2[1].toFixed(1)}`;
  }
  return `${d} Z`;
}
const BLOBS = [
  { cx: 1500, cy: 260, r: 420, seed: 11, dur: 16 },
  { cx: 380, cy: 860, r: 380, seed: 29, dur: 19 },
  { cx: 1180, cy: 900, r: 260, seed: 47, dur: 13 },
  { cx: 260, cy: 200, r: 200, seed: 83, dur: 15 },
].map(b => {
  const rand = rng(b.seed);
  const shapes = Array.from({ length: 4 }, () => blobPath(b.cx, b.cy, b.r, rand));
  return { ...b, values: [...shapes, shapes[0]].join(';') };
});

function MorphBackground({ palette }) {
  const [c1, c2, c3] = palette;
  return (
    <div className="tvp-bg">
      <div className="tvp-orb tvp-orb1" /><div className="tvp-orb tvp-orb2" /><div className="tvp-orb tvp-orb3" />
      <svg className="tvp-blobs" viewBox={`0 0 ${W} ${H}`} width={W} height={H} aria-hidden="true">
        <defs>
          {BLOBS.map((b, i) => (
            <linearGradient key={i} id={`tvpg${i}`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" style={{ stopColor: [c1, c2, c3, c2][i], transition: 'stop-color 1.8s ease' }} />
              <stop offset="1" style={{ stopColor: [c2, c3, c1, c3][i], transition: 'stop-color 1.8s ease' }} />
            </linearGradient>
          ))}
        </defs>
        {BLOBS.map((b, i) => (
          <path key={i} d={b.values.split(';')[0]} fill={`url(#tvpg${i})`} opacity={[0.55, 0.45, 0.35, 0.4][i]}>
            <animate attributeName="d" dur={`${b.dur}s`} repeatCount="indefinite" values={b.values}
              calcMode="spline" keyTimes="0;0.25;0.5;0.75;1" keySplines=".45 0 .55 1;.45 0 .55 1;.45 0 .55 1;.45 0 .55 1" />
          </path>
        ))}
      </svg>
      <div className="tvp-grid" />
      <div className="tvp-vignette" />
    </div>
  );
}

/* ── small pieces ───────────────────────────────────────────────────────── */
function useNow(ms = 1000) {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => { const t = setInterval(() => setNow(new Date()), ms); return () => clearInterval(t); }, [ms]);
  return now;
}
function useCountUp(target, ms = 1600) {
  const [v, setV] = useState(0);
  useEffect(() => {
    let raf; const t0 = performance.now();
    const step = (t) => { const p = Math.min(1, (t - t0) / ms); setV(Math.round(target * (1 - Math.pow(1 - p, 3)))); if (p < 1) raf = requestAnimationFrame(step); };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [target, ms]);
  return v;
}
const fmtTime = (d) => d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true }).replace(/\s?(am|pm)/i, (_, x) => ` ${x.toUpperCase()}`);
const fmtDate = (d, o = { weekday: 'long', day: 'numeric', month: 'long' }) => d.toLocaleDateString('en-IN', o);
const greeting = (d) => (d.getHours() < 12 ? 'Good morning' : d.getHours() < 17 ? 'Good afternoon' : 'Good evening');
const ago = (d) => { if (!d) return ''; const m = Math.max(0, Math.round((Date.now() - d) / 60000)); return m < 1 ? 'just now' : m < 60 ? `${m} min ago` : `${Math.floor(m / 60)} h ago`; };
const whenLabel = (n, d) => (n === 0 ? 'Today' : n === 1 ? 'Tomorrow' : fmtDate(d, { weekday: 'short', day: 'numeric', month: 'short' }));
const initialsOf = (name = '') => name.split(/\s+/).filter(Boolean).slice(0, 2).map(w => w[0]).join('').toUpperCase();

function MorphTitle({ text, size = 104, delay = 0.15, className = '' }) {
  const words = String(text || '').split(/\s+/).filter(Boolean);
  return (
    <h1 className={`tvp-title ${className}`} style={{ fontSize: size }}>
      {words.map((w, i) => <span key={i} className="tvp-word" style={{ '--d': `${delay + i * 0.09}s` }}>{w}&nbsp;</span>)}
    </h1>
  );
}
const Eyebrow = ({ children, d = 0.05 }) => <div className="tvp-eyebrow tvp-rise" style={{ '--d': `${d}s` }}><span className="tvp-dot" />{children}</div>;
const Avatar = ({ name, size = 110, i = 0 }) => (
  <div className="tvp-avatar" style={{ width: size, height: size, fontSize: size * 0.36, '--h': `${(i * 47) % 360}deg` }}>{initialsOf(name)}</div>
);
const fitSize = (text, big, small, longAt = 40) => (String(text || '').length > longAt * 2 ? small : String(text || '').length > longAt ? (big + small) / 2 : big);

/* ── scenes ─────────────────────────────────────────────────────────────── */
function Welcome({ cfg, live }) {
  const now = useNow();
  const hol = live.holidays?.[0];
  return (
    <div className="tvp-split">
      <div>
        <Eyebrow>{greeting(now)}</Eyebrow>
        <MorphTitle text={cfg.welcomeTitle || 'Welcome to Smart World'} size={fitSize(cfg.welcomeTitle, 128, 92, 22)} />
        <p className="tvp-sub tvp-rise" style={{ '--d': '0.7s' }}>{cfg.welcomeSub}</p>
      </div>
      <div className="tvp-glass tvp-clockcard tvp-pop" style={{ '--d': '0.45s' }}>
        <div className="tvp-bigtime">{fmtTime(now).replace(/ (AM|PM)/, '')}<span>{/AM/.test(fmtTime(now)) ? 'AM' : 'PM'}</span></div>
        <div className="tvp-bigdate">{fmtDate(now)}</div>
        <div className="tvp-chips">
          {live.attendance?.present > 0 && <span className="tvp-chip"><b>{live.attendance.present}</b> in office today</span>}
          {hol && <span className="tvp-chip">{hol.name} {hol.daysAway === 0 ? 'today' : `in ${hol.daysAway} day${hol.daysAway > 1 ? 's' : ''}`}</span>}
        </div>
      </div>
    </div>
  );
}

function Attendance({ live, site }) {
  const a = live.attendance || { present: 0, sites: [] };
  const n = useCountUp(a.present);
  const sites = a.sites.slice(0, 8);
  const max = Math.max(1, ...sites.map(s => s.count));
  return (
    <div className="tvp-split">
      <div>
        <Eyebrow>Live attendance{site ? ` · ${site}` : ''}</Eyebrow>
        <MorphTitle text="In office today" size={104} />
        <div className="tvp-mega tvp-pop" style={{ '--d': '0.35s' }}>{n}<small>people</small></div>
        <p className="tvp-sub tvp-rise" style={{ '--d': '0.8s' }}>
          {a.onTime > 0 && <>{a.onTime} checked in by 9:30 AM · </>}last check-in {ago(a.last)}
        </p>
      </div>
      {sites.length > 1 && (
        <div className="tvp-glass tvp-bars tvp-pop" style={{ '--d': '0.4s' }}>
          {sites.map((s, i) => (
            <div key={s.name} className="tvp-barrow tvp-rise" style={{ '--d': `${0.5 + i * 0.08}s` }}>
              <span className="tvp-barname">{s.name}</span>
              <span className="tvp-bartrack"><i style={{ width: `${(s.count / max) * 100}%`, '--d': `${0.7 + i * 0.08}s` }} /></span>
              <b>{s.count}</b>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function PeopleGrid({ items, render }) {
  const shown = items.slice(0, 6);
  return (
    <div className={`tvp-cards n${shown.length}`}>
      {shown.map((p, i) => (
        <div key={p.id || p.name + i} className="tvp-glass tvp-card tvp-pop" style={{ '--d': `${0.45 + i * 0.12}s` }}>{render(p, i)}</div>
      ))}
      {items.length > 6 && <div className="tvp-more tvp-rise" style={{ '--d': '1.3s' }}>+{items.length - 6} more</div>}
    </div>
  );
}

function Joiners({ live }) {
  return (
    <div className="tvp-col">
      <Eyebrow>New joiners</Eyebrow>
      <MorphTitle text="Welcome to the family" size={96} />
      <PeopleGrid items={live.joiners} render={(p, i) => (<>
        <Avatar name={p.name} i={i} />
        <div className="tvp-cardtext">
          <div className="tvp-name">{p.name}</div>
          {p.designation && <div className="tvp-role">{p.designation}</div>}
          <div className="tvp-meta">{p.department && <span className="tvp-tag">{p.department}</span>}<span>Joined {fmtDate(p.doj, { day: 'numeric', month: 'short' })}</span></div>
        </div>
      </>)} />
    </div>
  );
}

function Anniversaries({ live }) {
  return (
    <div className="tvp-col">
      <Eyebrow>Work anniversaries</Eyebrow>
      <MorphTitle text="Thank you for growing with us" size={92} />
      <PeopleGrid items={live.anniversaries} render={(p) => (<>
        <div className="tvp-years"><b>{p.years}</b><span>{p.years > 1 ? 'years' : 'year'}</span></div>
        <div className="tvp-cardtext">
          <div className="tvp-name">{p.name}</div>
          {p.designation && <div className="tvp-role">{p.designation}</div>}
          <div className="tvp-meta">{p.department && <span className="tvp-tag">{p.department}</span>}<span>{whenLabel(p.daysAway, p.on)}</span></div>
        </div>
      </>)} />
    </div>
  );
}

function Birthdays({ item }) {
  return (
    <div className="tvp-col">
      <div className="tvp-confetti">{Array.from({ length: 36 }, (_, i) => <i key={i} style={{ '--x': `${(i * 53) % 100}%`, '--t': `${4 + (i % 5)}s`, '--dl': `${(i % 9) * 0.45}s`, '--h': `${(i * 67) % 360}deg` }} />)}</div>
      <Eyebrow>Birthdays</Eyebrow>
      <MorphTitle text="Happy birthday! 🎂" size={104} />
      <PeopleGrid items={item.payload} render={(p, i) => (<>
        <Avatar name={p.name} i={i + 3} />
        <div className="tvp-cardtext">
          <div className="tvp-name">{p.name}</div>
          <div className="tvp-meta">{p.dept && <span className="tvp-tag">{p.dept}</span>}<span>{whenLabel(p.daysAway, p.on)}</span></div>
        </div>
      </>)} />
    </div>
  );
}

function Holidays({ live }) {
  const [next, ...rest] = live.holidays;
  const n = useCountUp(next.daysAway, 1200);
  return (
    <div className="tvp-split">
      <div>
        <Eyebrow>Next holiday</Eyebrow>
        <MorphTitle text={next.name} size={fitSize(next.name, 136, 100, 14)} />
        {next.daysAway === 0
          ? <div className="tvp-mega tvp-pop" style={{ '--d': '0.35s' }}>Today!</div>
          : <div className="tvp-mega tvp-pop" style={{ '--d': '0.35s' }}>{n}<small>{next.daysAway === 1 ? 'day to go' : 'days to go'}</small></div>}
        <p className="tvp-sub tvp-rise" style={{ '--d': '0.8s' }}>{fmtDate(next.d, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}</p>
      </div>
      {rest.length > 0 && (
        <div className="tvp-glass tvp-list tvp-pop" style={{ '--d': '0.45s' }}>
          <div className="tvp-listhead">Coming up</div>
          {rest.map((h, i) => (
            <div key={h.id} className="tvp-listrow tvp-rise" style={{ '--d': `${0.6 + i * 0.12}s` }}>
              <div className="tvp-datebox"><b>{h.d.getDate()}</b><span>{fmtDate(h.d, { month: 'short' })}</span></div>
              <div><div className="tvp-name">{h.name}</div><div className="tvp-role">{fmtDate(h.d, { weekday: 'long' })} · in {h.daysAway} days</div></div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function Announcement({ item }) {
  const a = item.payload;
  return (
    <div className={a.image ? 'tvp-split' : 'tvp-col tvp-center'}>
      <div>
        <Eyebrow>Announcement</Eyebrow>
        <MorphTitle text={a.title} size={fitSize(a.title, a.image ? 104 : 124, 80, 26)} />
        {a.body && <p className="tvp-body tvp-rise" style={{ '--d': '0.75s', fontSize: fitSize(a.body, 44, 34, 120) }}>{a.body}</p>}
      </div>
      {a.image && <div className="tvp-photo tvp-pop" style={{ '--d': '0.4s' }}><img src={a.image} alt="" /></div>}
    </div>
  );
}

function Star({ item }) {
  const s = item.payload;
  return (
    <div className="tvp-split tvp-star">
      <div className="tvp-starphoto tvp-pop" style={{ '--d': '0.3s' }}>
        <div className="tvp-ring" />
        {s.photo ? <img src={s.photo} alt="" /> : <div className="tvp-avatar" style={{ width: '100%', height: '100%', fontSize: 150, '--h': '30deg' }}>{initialsOf(s.name)}</div>}
      </div>
      <div>
        <Eyebrow>Star of the month ★</Eyebrow>
        <MorphTitle text={s.name} size={fitSize(s.name, 120, 90, 16)} />
        <p className="tvp-sub tvp-rise" style={{ '--d': '0.7s' }}>{[s.role, s.dept].filter(Boolean).join(' · ')}</p>
        {s.reason && <p className="tvp-quote tvp-rise" style={{ '--d': '0.9s' }}>“{s.reason}”</p>}
      </div>
    </div>
  );
}

function Events({ item }) {
  const list = item.payload.slice(0, 4);
  return (
    <div className="tvp-col">
      <Eyebrow>Upcoming events</Eyebrow>
      <MorphTitle text={list.length === 1 ? list[0].title : "What's coming up"} size={96} />
      <div className="tvp-events">
        {list.map((e, i) => (
          <div key={e.id} className="tvp-glass tvp-event tvp-pop" style={{ '--d': `${0.45 + i * 0.12}s` }}>
            <div className="tvp-datebox big"><b>{e.d.getDate()}</b><span>{fmtDate(e.d, { month: 'short' })}</span></div>
            <div className="tvp-eventtext">
              <div className="tvp-name">{e.title}</div>
              <div className="tvp-role">{[fmtDate(e.d, { weekday: 'long' }), e.time, e.place].filter(Boolean).join(' · ')}</div>
            </div>
            <span className="tvp-count">{e.daysAway === 0 ? 'Today' : e.daysAway === 1 ? 'Tomorrow' : `in ${e.daysAway} days`}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function Tip({ item }) {
  const { label, text } = item.payload;
  return (
    <div className="tvp-col tvp-center tvp-tip">
      <div className="tvp-tipicon tvp-pop" style={{ '--d': '0.15s' }}>
        <svg viewBox="0 0 24 24" width="96" height="96" fill="none" stroke="#fff" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round"><path d="M12 3l8 3v6c0 5-3.5 8-8 9-4.5-1-8-4-8-9V6z" /><path d="M8.5 12l2.5 2.5 4.5-5" /></svg>
      </div>
      <Eyebrow d={0.3}>{label || 'Tip of the day'}</Eyebrow>
      <MorphTitle text={text} size={fitSize(text, 92, 64, 50)} delay={0.45} className="tvp-tiptext" />
    </div>
  );
}

function Media({ item, onEnded }) {
  const m = item.payload;
  return (
    <div className="tvp-media">
      {m.type === 'video'
        ? <video src={m.src} autoPlay muted playsInline onEnded={onEnded} />
        : (<><div className="tvp-mediabg" style={{ backgroundImage: `url("${m.src}")` }} /><img className="tvp-kenburns" src={m.src} alt="" /></>)}
      {m.caption && <div className="tvp-caption tvp-rise" style={{ '--d': '0.6s' }}>{m.caption}</div>}
    </div>
  );
}

function SceneView({ item, cfg, live, site, phase, onEnded }) {
  let body = null;
  switch (item.scene) {
    case 'welcome': body = <Welcome cfg={cfg} live={live} />; break;
    case 'attendance': body = <Attendance live={live} site={site} />; break;
    case 'joiners': body = <Joiners live={live} />; break;
    case 'anniversaries': body = <Anniversaries live={live} />; break;
    case 'birthdays': body = <Birthdays item={item} />; break;
    case 'holidays': body = <Holidays live={live} />; break;
    case 'announcements': body = <Announcement item={item} />; break;
    case 'star': body = <Star item={item} />; break;
    case 'events': body = <Events item={item} />; break;
    case 'tips': body = <Tip item={item} />; break;
    case 'media': body = <Media item={item} onEnded={onEnded} />; break;
    default:
  }
  return <div className={`tvp-scene ${phase} ${item.scene === 'media' ? 'full' : ''}`}>{body}</div>;
}

/* ── player ─────────────────────────────────────────────────────────────── */
export default function TvPlayer({ config, live, site = '', forceScene = null, paused = false, showChrome = true }) {
  const wrapRef = useRef(null);
  const [box, setBox] = useState({ w: W, h: H });
  const [tipIdx, setTipIdx] = useState(0);
  const playlist = useMemo(() => {
    const all = buildPlaylist(config, live, tipIdx);
    if (!forceScene) return all;
    const only = all.filter(x => x.scene === forceScene);
    return only.length ? only : all;
  }, [config, live, tipIdx, forceScene]);

  const [state, setState] = useState({ key: null, n: 0, prev: null });
  const cur = playlist.find(x => x.key === state.key) || playlist[0];
  const prev = state.prev;
  const now = useNow(1000);

  // advance
  const next = () => setState(s => {
    const i = playlist.findIndex(x => x.key === (s.key || playlist[0].key));
    const nx = playlist[(i + 1) % playlist.length];
    if (nx.scene === 'tips') setTipIdx(t => t + 1);
    return { key: nx.key, n: s.n + 1, prev: cur };
  });
  useEffect(() => {
    if (paused) return undefined;
    const secs = cur.scene === 'media' && cur.payload?.type === 'video' ? Math.max(cur.secs, 5) : cur.secs;
    const t = setTimeout(next, secs * 1000);
    return () => clearTimeout(t);
  }, [state.n, cur.key, paused, playlist.length]); // eslint-disable-line
  // jump to forced scene immediately
  useEffect(() => { if (forceScene) setState(s => ({ key: playlist[0].key, n: s.n + 1, prev: null })); }, [forceScene]); // eslint-disable-line
  // drop the outgoing scene after its exit animation
  useEffect(() => { if (!prev) return undefined; const t = setTimeout(() => setState(s => ({ ...s, prev: null })), 1100); return () => clearTimeout(t); }, [state.n]); // eslint-disable-line

  useEffect(() => {
    const el = wrapRef.current; if (!el) return undefined;
    const ro = new ResizeObserver(([e]) => setBox({ w: e.contentRect.width, h: e.contentRect.height }));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);
  const k = Math.min(box.w / W, box.h / H) || 0.1;
  const ticker = (config.ticker || []).filter(Boolean);
  const pos = Math.max(0, playlist.findIndex(x => x.key === cur.key));

  return (
    <div ref={wrapRef} className="tvp-wrap">
      <div className="tvp-stage" style={{ transform: `scale(${k})`, left: (box.w - W * k) / 2, top: (box.h - H * k) / 2, '--c1': (cur.palette || PALETTES.welcome)[0], '--c2': (cur.palette || PALETTES.welcome)[1], '--c3': (cur.palette || PALETTES.welcome)[2] }}>
        <MorphBackground palette={cur.palette || PALETTES.welcome} />

        {showChrome && (
          <div className="tvp-top">
            <div className="tvp-brand"><img src="/images/swd-logo.png" alt="" /><div><b>Smart World</b><span>SmartDesk TV{site ? ` · ${site}` : ''}</span></div></div>
            <div className="tvp-clock"><b>{fmtTime(now)}</b><span>{fmtDate(now, { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' })}</span></div>
          </div>
        )}

        <div className="tvp-scenes">
          {prev && prev.key !== cur.key && <SceneView key={`out-${state.n}`} item={prev} cfg={config} live={live} site={site} phase="out" />}
          <SceneView key={`in-${state.n}-${cur.key}`} item={cur} cfg={config} live={live} site={site} phase="in" onEnded={next} />
        </div>

        {showChrome && (
          <>
            <div className="tvp-progress">
              {playlist.slice(0, 24).map((x, i) => (
                <span key={x.key} className={i === pos ? 'on' : i < pos ? 'done' : ''}>
                  {i === pos && <i key={state.n} style={{ animationDuration: `${cur.secs}s`, animationPlayState: paused ? 'paused' : 'running' }} />}
                </span>
              ))}
            </div>
            {ticker.length > 0 && (
              <div className="tvp-ticker">
                <span className="tvp-tickerlabel">Updates</span>
                <div className="tvp-tickerwin">
                  <div className="tvp-tickermove" style={{ animationDuration: `${Math.max(20, ticker.join(' ').length * 0.28)}s` }}>
                    {[0, 1].map(r => <span key={r}>{ticker.map((t, i) => <span key={i} className="tvp-tickeritem">{t}<i>◆</i></span>)}</span>)}
                  </div>
                </div>
              </div>
            )}
          </>
        )}
      </div>
      <style>{CSS}</style>
    </div>
  );
}

const CSS = `
@property --c1 { syntax: '<color>'; inherits: true; initial-value: #2f6fe0; }
@property --c2 { syntax: '<color>'; inherits: true; initial-value: #5b3fd6; }
@property --c3 { syntax: '<color>'; inherits: true; initial-value: #00b4ff; }
.tvp-wrap{position:relative;width:100%;height:100%;overflow:hidden;background:#040814}
.tvp-stage{transition:--c1 1.8s ease,--c2 1.8s ease,--c3 1.8s ease;position:absolute;width:${W}px;height:${H}px;transform-origin:0 0;overflow:hidden;font-family:'Plus Jakarta Sans','DM Sans','Segoe UI',Arial,sans-serif;color:#fff;background:#060b1f}
.tvp-bg{position:absolute;inset:0;
  background:radial-gradient(1100px 700px at 85% 15%, color-mix(in srgb,var(--c1) 45%,transparent), transparent 70%),
             radial-gradient(900px 650px at 10% 95%, color-mix(in srgb,var(--c2) 40%,transparent), transparent 70%),
             linear-gradient(135deg,#070c22 0%,#0a1233 55%,#0b0a2a 100%)}
.tvp-orb{position:absolute;border-radius:50%;will-change:transform;opacity:.55}
.tvp-orb1{width:900px;height:900px;left:-200px;top:-300px;background:radial-gradient(circle,color-mix(in srgb,var(--c3) 55%,transparent),transparent 65%);animation:tvpDrift1 22s ease-in-out infinite alternate}
.tvp-orb2{width:800px;height:800px;right:-260px;bottom:-320px;background:radial-gradient(circle,color-mix(in srgb,var(--c1) 55%,transparent),transparent 65%);animation:tvpDrift2 26s ease-in-out infinite alternate}
.tvp-orb3{width:600px;height:600px;left:45%;top:30%;background:radial-gradient(circle,color-mix(in srgb,var(--c2) 45%,transparent),transparent 65%);animation:tvpDrift3 30s ease-in-out infinite alternate}
@keyframes tvpDrift1{to{transform:translate(260px,180px) scale(1.15)}}
@keyframes tvpDrift2{to{transform:translate(-300px,-140px) scale(1.2)}}
@keyframes tvpDrift3{to{transform:translate(-420px,160px) scale(.85)}}
.tvp-blobs{position:absolute;inset:0;filter:blur(2px);mix-blend-mode:screen}
.tvp-grid{position:absolute;inset:0;opacity:.07;background-image:linear-gradient(#fff 1px,transparent 1px),linear-gradient(90deg,#fff 1px,transparent 1px);background-size:80px 80px;
  -webkit-mask-image:radial-gradient(ellipse at center,#000 30%,transparent 75%);mask-image:radial-gradient(ellipse at center,#000 30%,transparent 75%)}
.tvp-vignette{position:absolute;inset:0;background:radial-gradient(ellipse at center,transparent 55%,rgba(2,4,14,.65) 100%)}

.tvp-top{position:absolute;left:80px;right:80px;top:44px;display:flex;align-items:center;justify-content:space-between;z-index:5}
.tvp-brand{display:flex;align-items:center;gap:18px}
.tvp-brand img{width:62px;height:62px;object-fit:contain;filter:brightness(0) invert(1);padding:10px;border-radius:18px;background:rgba(255,255,255,.1);border:1px solid rgba(255,255,255,.2)}
.tvp-brand b{display:block;font-size:30px;font-weight:800;letter-spacing:-.01em}
.tvp-brand span{font-size:20px;opacity:.65}
.tvp-clock{text-align:right}
.tvp-clock b{display:block;font-size:46px;font-weight:800;font-variant-numeric:tabular-nums;letter-spacing:-.01em}
.tvp-clock span{font-size:20px;opacity:.7}

.tvp-scenes{position:absolute;left:0;right:0;top:150px;bottom:150px;z-index:4}
.tvp-scene{position:absolute;inset:0;padding:30px 120px;display:flex;flex-direction:column;justify-content:center}
.tvp-scene.full{padding:0}
.tvp-scene.in{animation:tvpReveal 1.1s cubic-bezier(.7,0,.2,1) both}
.tvp-scene.out{animation:tvpLeave .9s ease both;pointer-events:none}
@keyframes tvpReveal{from{clip-path:circle(0% at 82% 30%);transform:scale(1.04)}to{clip-path:circle(150% at 82% 30%);transform:none}}
@keyframes tvpLeave{to{opacity:0;transform:scale(.94) translateY(-30px);filter:blur(14px)}}

.tvp-rise{animation:tvpRise .9s cubic-bezier(.2,.8,.2,1) var(--d,0s) both}
.tvp-pop{animation:tvpPop 1s cubic-bezier(.2,.9,.25,1.15) var(--d,0s) both}
@keyframes tvpRise{from{opacity:0;transform:translateY(40px);filter:blur(10px)}to{opacity:1;transform:none;filter:none}}
@keyframes tvpPop{from{opacity:0;transform:translateY(50px) scale(.9);filter:blur(12px)}to{opacity:1;transform:none;filter:none}}
.tvp-title{margin:0 0 18px;font-weight:800;line-height:1.02;letter-spacing:-.025em}
.tvp-word{display:inline-block;animation:tvpWord 1s cubic-bezier(.2,.8,.2,1) var(--d) both;background:linear-gradient(180deg,#fff 40%,color-mix(in srgb,var(--c3) 35%,#fff));-webkit-background-clip:text;background-clip:text;color:transparent}
@keyframes tvpWord{from{opacity:0;transform:translateY(60px) rotateX(55deg);filter:blur(16px);letter-spacing:.2em}to{opacity:1;transform:none;filter:none;letter-spacing:normal}}
.tvp-eyebrow{display:inline-flex;align-items:center;gap:14px;font-size:26px;font-weight:700;letter-spacing:.2em;text-transform:uppercase;color:color-mix(in srgb,var(--c3) 55%,#fff);margin-bottom:22px}
.tvp-dot{width:14px;height:14px;border-radius:50%;background:var(--c3);box-shadow:0 0 0 0 var(--c3);animation:tvpPulse 2s infinite}
@keyframes tvpPulse{0%{box-shadow:0 0 0 0 color-mix(in srgb,var(--c3) 70%,transparent)}100%{box-shadow:0 0 0 22px transparent}}
.tvp-sub{font-size:40px;line-height:1.35;opacity:.85;margin:6px 0 0;font-weight:500}
.tvp-body{line-height:1.45;opacity:.9;margin:10px 0 0;max-width:1100px;font-weight:500}
.tvp-quote{font-size:40px;line-height:1.4;margin-top:26px;opacity:.92;font-style:italic;max-width:1000px}

.tvp-split{display:grid;grid-template-columns:1.15fr .85fr;gap:90px;align-items:center}
.tvp-split.tvp-star{grid-template-columns:.7fr 1.3fr}
.tvp-col{display:flex;flex-direction:column}
.tvp-center{align-items:center;text-align:center}
.tvp-center .tvp-title{max-width:1500px}
.tvp-glass{background:linear-gradient(160deg,rgba(255,255,255,.14),rgba(255,255,255,.05));border:1px solid rgba(255,255,255,.18);border-radius:34px;box-shadow:0 30px 80px rgba(0,0,0,.35);backdrop-filter:blur(18px);-webkit-backdrop-filter:blur(18px)}

.tvp-clockcard{padding:56px 60px}
.tvp-bigtime{font-size:150px;font-weight:800;line-height:1;letter-spacing:-.04em;font-variant-numeric:tabular-nums}
.tvp-bigtime span{font-size:46px;margin-left:14px;opacity:.7;letter-spacing:0}
.tvp-bigdate{font-size:40px;opacity:.85;margin-top:14px}
.tvp-chips{display:flex;flex-wrap:wrap;gap:14px;margin-top:34px}
.tvp-chip{font-size:26px;padding:12px 22px;border-radius:999px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2)}
.tvp-chip b{color:color-mix(in srgb,var(--c3) 50%,#fff)}

.tvp-mega{font-size:240px;font-weight:800;line-height:.95;letter-spacing:-.05em;font-variant-numeric:tabular-nums;background:linear-gradient(180deg,#fff,color-mix(in srgb,var(--c3) 60%,#fff));-webkit-background-clip:text;background-clip:text;color:transparent}
.tvp-mega small{font-size:56px;letter-spacing:0;margin-left:22px;font-weight:700;-webkit-text-fill-color:rgba(255,255,255,.75)}

.tvp-bars{padding:44px 48px;display:flex;flex-direction:column;gap:22px}
.tvp-barrow{display:grid;grid-template-columns:260px 1fr 70px;align-items:center;gap:20px;font-size:28px}
.tvp-barname{white-space:nowrap;overflow:hidden;text-overflow:ellipsis;opacity:.9}
.tvp-bartrack{height:22px;border-radius:12px;background:rgba(255,255,255,.1);overflow:hidden}
.tvp-bartrack i{display:block;height:100%;border-radius:12px;background:linear-gradient(90deg,var(--c1),var(--c3));transform-origin:left;animation:tvpGrow 1.2s cubic-bezier(.2,.8,.2,1) var(--d) both}
@keyframes tvpGrow{from{transform:scaleX(0)}to{transform:scaleX(1)}}
.tvp-barrow b{text-align:right;font-size:32px}

.tvp-cards{display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:30px;margin-top:20px}
.tvp-cards.n1{grid-template-columns:minmax(0,760px)}
.tvp-cards.n2{grid-template-columns:repeat(2,minmax(0,700px))}
.tvp-cards.n4{grid-template-columns:repeat(2,minmax(0,1fr))}
.tvp-card{display:flex;align-items:center;gap:28px;padding:30px 34px;min-width:0}
.tvp-cardtext{min-width:0;flex:1}
.tvp-avatar{flex-shrink:0;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:800;color:#fff;
  background:linear-gradient(135deg,hsl(var(--h,0deg) 80% 58%),hsl(calc(var(--h,0deg) + 60deg) 75% 48%));box-shadow:0 0 0 6px rgba(255,255,255,.12)}
.tvp-name{font-size:38px;font-weight:800;line-height:1.15;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tvp-role{font-size:26px;opacity:.75;margin-top:4px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.tvp-meta{display:flex;align-items:center;gap:14px;flex-wrap:wrap;margin-top:12px;font-size:22px;opacity:.85}
.tvp-tag{padding:5px 14px;border-radius:999px;background:color-mix(in srgb,var(--c1) 40%,transparent);border:1px solid rgba(255,255,255,.25)}
.tvp-more{font-size:30px;opacity:.75;align-self:center}
.tvp-years{flex-shrink:0;width:120px;height:120px;border-radius:28px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--c1),var(--c2));box-shadow:0 0 0 6px rgba(255,255,255,.12)}
.tvp-years b{font-size:60px;line-height:1}
.tvp-years span{font-size:18px;text-transform:uppercase;letter-spacing:.12em;opacity:.85}

.tvp-list{padding:40px 44px}
.tvp-listhead{font-size:24px;letter-spacing:.18em;text-transform:uppercase;opacity:.65;margin-bottom:18px}
.tvp-listrow{display:flex;align-items:center;gap:26px;padding:16px 0;border-top:1px solid rgba(255,255,255,.1)}
.tvp-datebox{flex-shrink:0;width:96px;height:96px;border-radius:22px;background:rgba(255,255,255,.12);border:1px solid rgba(255,255,255,.2);display:flex;flex-direction:column;align-items:center;justify-content:center}
.tvp-datebox b{font-size:44px;line-height:1}
.tvp-datebox span{font-size:20px;text-transform:uppercase;letter-spacing:.1em;opacity:.8}
.tvp-datebox.big{width:120px;height:120px}
.tvp-datebox.big b{font-size:56px}

.tvp-events{display:flex;flex-direction:column;gap:22px;margin-top:20px;max-width:1500px}
.tvp-event{display:flex;align-items:center;gap:34px;padding:24px 34px}
.tvp-eventtext{flex:1;min-width:0}
.tvp-count{font-size:28px;font-weight:700;padding:12px 24px;border-radius:999px;background:linear-gradient(90deg,var(--c1),var(--c3));white-space:nowrap}

.tvp-photo{border-radius:34px;overflow:hidden;box-shadow:0 30px 80px rgba(0,0,0,.4);border:1px solid rgba(255,255,255,.2);max-height:640px}
.tvp-photo img{width:100%;height:100%;max-height:640px;object-fit:cover;display:block;animation:tvpKen 14s ease-out both}
@keyframes tvpKen{from{transform:scale(1.15)}to{transform:scale(1)}}
.tvp-starphoto{position:relative;width:440px;height:440px;justify-self:center}
.tvp-starphoto img,.tvp-starphoto .tvp-avatar{position:absolute;inset:22px;width:calc(100% - 44px)!important;height:calc(100% - 44px)!important;border-radius:50%;object-fit:cover}
.tvp-ring{position:absolute;inset:0;border-radius:50%;background:conic-gradient(from 0deg,var(--c1),var(--c2),var(--c3),var(--c1));animation:tvpSpin 6s linear infinite;
  -webkit-mask:radial-gradient(circle,transparent 63%,#000 64%);mask:radial-gradient(circle,transparent 63%,#000 64%);box-shadow:0 0 120px color-mix(in srgb,var(--c1) 60%,transparent)}
@keyframes tvpSpin{to{transform:rotate(360deg)}}

.tvp-tip .tvp-title{font-weight:700;line-height:1.15}
.tvp-tipicon{width:170px;height:170px;border-radius:50%;display:flex;align-items:center;justify-content:center;background:linear-gradient(135deg,var(--c1),var(--c3));box-shadow:0 0 0 14px rgba(255,255,255,.08),0 0 120px color-mix(in srgb,var(--c1) 60%,transparent);margin-bottom:30px}

.tvp-media{position:absolute;inset:-150px 0;overflow:hidden;background:#000}
.tvp-media video{width:100%;height:100%;object-fit:contain;background:#000}
.tvp-mediabg{position:absolute;inset:-40px;background-size:cover;background-position:center;filter:blur(40px) brightness(.5)}
.tvp-kenburns{position:relative;width:100%;height:100%;object-fit:contain;animation:tvpKen 16s ease-out both}
.tvp-caption{position:absolute;left:120px;bottom:230px;font-size:46px;font-weight:800;padding:18px 32px;border-radius:22px;background:rgba(0,0,0,.45);backdrop-filter:blur(10px)}

.tvp-confetti{position:absolute;inset:-150px 0 -150px 0;pointer-events:none;overflow:hidden}
.tvp-confetti i{position:absolute;top:-40px;left:var(--x);width:14px;height:26px;border-radius:4px;background:hsl(var(--h) 90% 62%);animation:tvpFall var(--t) linear var(--dl) infinite;opacity:.85}
@keyframes tvpFall{to{transform:translateY(1300px) rotate(720deg)}}

.tvp-progress{position:absolute;left:80px;right:80px;bottom:108px;display:flex;gap:10px;z-index:5}
.tvp-progress span{flex:1;height:6px;border-radius:4px;background:rgba(255,255,255,.18);overflow:hidden;position:relative}
.tvp-progress span.done{background:rgba(255,255,255,.55)}
.tvp-progress span i{position:absolute;inset:0;background:#fff;transform-origin:left;animation:tvpGrow linear both}
.tvp-ticker{position:absolute;left:0;right:0;bottom:0;height:84px;display:flex;align-items:center;background:rgba(3,6,20,.55);border-top:1px solid rgba(255,255,255,.12);z-index:5;backdrop-filter:blur(12px)}
.tvp-tickerlabel{height:100%;display:flex;align-items:center;padding:0 34px 0 80px;font-size:24px;font-weight:800;letter-spacing:.18em;text-transform:uppercase;background:linear-gradient(90deg,var(--c1),var(--c2));clip-path:polygon(0 0,100% 0,calc(100% - 28px) 100%,0 100%);padding-right:58px;flex-shrink:0}
.tvp-tickerwin{flex:1;overflow:hidden;white-space:nowrap;-webkit-mask-image:linear-gradient(90deg,transparent,#000 4%,#000 96%,transparent);mask-image:linear-gradient(90deg,transparent,#000 4%,#000 96%,transparent)}
.tvp-tickermove{display:inline-flex;animation:tvpMarquee linear infinite}
.tvp-tickeritem{font-size:30px;font-weight:500;padding-right:40px}
.tvp-tickeritem i{font-style:normal;margin-left:40px;color:var(--c3);font-size:20px;vertical-align:middle}
@keyframes tvpMarquee{from{transform:translateX(0)}to{transform:translateX(-50%)}}
@media (prefers-reduced-motion: reduce){.tvp-stage *{animation-duration:.01ms!important;animation-iteration-count:1!important}}
`;
