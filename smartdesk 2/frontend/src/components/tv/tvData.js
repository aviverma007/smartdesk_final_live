/**
 * Office TV display — content config + live data.
 *
 * Config is written by HR in the "TV Display" tab and stored in backend-userrights
 * (dbo.TvConfig). TVs open /?tv (no login) and read it from there; the last copy is
 * cached in the TV browser so the screen keeps playing if the server is unreachable.
 * Live data (attendance totals, joiners, anniversaries, holidays) comes from the
 * existing SmartDesk sources. Only display-safe fields are used — no phone numbers,
 * e-mails or individual punch times are ever shown on a TV.
 */
import { URA_API, ATT_API } from '../../config/api';
import { HOLIDAYS } from '../../config/holidays';
import dataService from '../../services/dataService';

export const SCENES = [
  { id: 'welcome', label: 'Welcome & clock', hint: 'Greeting, live time and date' },
  { id: 'attendance', label: 'Attendance pulse', hint: 'People in office today, per site (totals only)' },
  { id: 'joiners', label: 'New joiners', hint: 'Joined in the last 30 days (from DOJ)' },
  { id: 'anniversaries', label: 'Work anniversaries', hint: 'This week (from DOJ)' },
  { id: 'birthdays', label: 'Birthdays', hint: 'Entered by HR below' },
  { id: 'holidays', label: 'Holiday countdown', hint: 'Next holidays from the company calendar' },
  { id: 'announcements', label: 'Announcements', hint: 'One scene per active announcement' },
  { id: 'star', label: 'Star of the month', hint: 'Recognition with photo' },
  { id: 'events', label: 'Upcoming events', hint: 'With countdown' },
  { id: 'tips', label: 'Safety tip / thought', hint: 'One tip per loop, rotating' },
  { id: 'media', label: 'Posters & videos', hint: 'Images uploaded by HR or MP4 links' },
];

export const ANNOUNCE_COLORS = {
  blue: ['#2f6fe0', '#5b3fd6', '#00b4ff'],
  purple: ['#7c3aed', '#c026d3', '#4f46e5'],
  green: ['#059669', '#10b981', '#0ea5e9'],
  orange: ['#ea580c', '#f59e0b', '#ef4444'],
  red: ['#dc2626', '#e11d48', '#f97316'],
};

const uid = () => Math.random().toString(36).slice(2, 10);

export const defaultConfig = () => ({
  version: 1,
  scenes: SCENES.map(s => ({ id: s.id, on: true, secs: s.id === 'welcome' ? 10 : 12 })),
  welcomeTitle: 'Welcome to Smart World',
  welcomeSub: 'Building tomorrow, together.',
  joinerDays: 30,
  announcements: [
    { id: uid(), title: 'Diwali celebration', body: 'Join us in the cafeteria on Friday at 4 PM for sweets, rangoli and music. Families welcome!', color: 'orange', image: null, from: '', until: '' },
  ],
  events: [],
  birthdays: [],
  star: { on: false, name: '', role: '', dept: '', reason: '', photo: null },
  tipsLabel: 'Safety first',
  tips: [
    'Always wear your helmet and safety shoes on site — no exceptions.',
    'Keep walkways and staircases clear. A tidy site is a safe site.',
    'Report every near-miss. It helps us prevent the next accident.',
    'Stay hydrated — drink water every hour, especially on site.',
  ],
  media: [],
  ticker: [
    'Welcome to Smart World Developers',
    'Leave & payroll queries: use the Adrenalin HR portal',
    'IT help: itservicedesk@smartworlddevelopers.com',
  ],
});

/** Fill in anything missing (older saved configs, new scenes added later). */
export function normalizeConfig(c) {
  const d = defaultConfig();
  if (!c || typeof c !== 'object') return d;
  const out = { ...d, ...c };
  const known = new Map((Array.isArray(c.scenes) ? c.scenes : []).map(s => [s.id, s]));
  const ordered = (Array.isArray(c.scenes) ? c.scenes : []).filter(s => SCENES.some(x => x.id === s.id));
  SCENES.forEach(s => { if (!known.has(s.id)) ordered.push(d.scenes.find(x => x.id === s.id)); });
  out.scenes = ordered.map(s => ({ id: s.id, on: s.on !== false, secs: Math.max(5, Math.min(120, Number(s.secs) || 12)) }));
  ['announcements', 'events', 'birthdays', 'tips', 'media', 'ticker'].forEach(k => { if (!Array.isArray(out[k])) out[k] = d[k]; });
  out.star = { ...d.star, ...(c.star || {}) };
  return out;
}

export const newItem = {
  announcement: () => ({ id: uid(), title: '', body: '', color: 'blue', image: null, from: '', until: '' }),
  event: () => ({ id: uid(), title: '', date: '', time: '', place: '' }),
  birthday: () => ({ id: uid(), name: '', dept: '', date: '' }),
  media: (type = 'image') => ({ id: uid(), type, src: '', caption: '' }),
};

/* ── config storage ─────────────────────────────────────────────────────── */
const CACHE_KEY = 'sd-tv-config-cache';

export async function fetchTvVersion() {
  const r = await fetch(`${URA_API}/tv/version`, { cache: 'no-store' });
  const j = await r.json();
  if (!j.success) throw new Error(j.error || 'Server error');
  return j.version || 0;
}

export async function fetchTvConfig() {
  try {
    const r = await fetch(`${URA_API}/tv/config`, { cache: 'no-store' });
    const j = await r.json();
    if (!j.success) throw new Error(j.error || 'Server error');
    const cfg = normalizeConfig(j.config);
    try { localStorage.setItem(CACHE_KEY, JSON.stringify({ config: cfg, version: j.version })); } catch (_) { /* quota: images */ }
    return { config: cfg, version: j.version || 0, updatedBy: j.updatedBy, updatedAt: j.updatedAt, offline: false, published: !!j.config };
  } catch (e) {
    let cached = null;
    try { cached = JSON.parse(localStorage.getItem(CACHE_KEY) || 'null'); } catch (_) {}
    return { config: normalizeConfig(cached && cached.config), version: (cached && cached.version) || 0, offline: true, error: e.message };
  }
}

export async function saveTvConfig(config, user) {
  const r = await fetch(`${URA_API}/tv/config`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json', 'x-user-role': user?.role || '', 'x-user-id': user?.empId || '' },
    body: JSON.stringify({ config }),
  });
  let j = {};
  try { j = await r.json(); } catch (_) {}
  if (!r.ok || !j.success) throw new Error(j.error || `Could not publish (${r.status}).`);
  return j.version;
}

/* ── live data ──────────────────────────────────────────────────────────── */
const DAY = 86400000;
const startOfDay = (d) => { const x = new Date(d); x.setHours(0, 0, 0, 0); return x; };

export function parseDate(v) {
  if (!v) return null;
  if (v instanceof Date) return isNaN(v) ? null : v;
  const s = String(v).trim();
  let m = s.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]);
  m = s.match(/^(\d{1,2})[-/ ]([A-Za-z]{3,})[-/ ,]*(\d{4})$/);
  if (m) { const d = new Date(`${m[2]} ${m[1]}, ${m[3]}`); return isNaN(d) ? null : d; }
  m = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/); // dd/mm/yyyy
  if (m) return new Date(+m[3], +m[2] - 1, +m[1]);
  const d = new Date(s);
  return isNaN(d) ? null : d;
}

let empCache = { at: 0, list: [] };
async function employees() {
  if (Date.now() - empCache.at < 30 * 60 * 1000 && empCache.list.length) return empCache.list;
  try {
    const list = await dataService.getEmployees({});
    empCache = { at: Date.now(), list: Array.isArray(list) ? list : [] };
  } catch (_) { /* keep last */ }
  return empCache.list;
}

const pick = (e) => ({ id: e.id, name: e.name, designation: e.designation || e.grade || '', department: e.department || '', location: e.location || '', initials: e.initials || '' });

export async function loadPeople(joinerDays = 30) {
  const list = await employees();
  const today = startOfDay(new Date());
  const joiners = [], anniversaries = [];
  for (const e of list) {
    const doj = parseDate(e.dateOfJoining);
    if (!doj) continue;
    const age = (today - startOfDay(doj)) / DAY;
    if (age >= 0 && age <= joinerDays) joiners.push({ ...pick(e), doj });
    const years = today.getFullYear() - doj.getFullYear();
    if (years >= 1) {
      const thisYear = new Date(today.getFullYear(), doj.getMonth(), doj.getDate());
      const diff = (thisYear - today) / DAY;
      if (diff >= 0 && diff < 7) anniversaries.push({ ...pick(e), doj, years, on: thisYear, daysAway: Math.round(diff) });
    }
  }
  joiners.sort((a, b) => b.doj - a.doj);
  anniversaries.sort((a, b) => a.daysAway - b.daysAway || b.years - a.years);
  return { joiners: joiners.slice(0, 12), anniversaries: anniversaries.slice(0, 12), headcount: list.length };
}

export async function loadAttendance(site) {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 10000);
    const r = await fetch(`${ATT_API}/attendance`, { signal: ctrl.signal, cache: 'no-store' });
    clearTimeout(t);
    const j = await r.json();
    if (!j.success || !Array.isArray(j.data)) return null;
    let rows = j.data.filter(x => x.inTime);
    if (site) rows = rows.filter(x => String(x.inLocation || '').toLowerCase() === String(site).toLowerCase());
    const people = new Set(rows.map(x => String(x.empCode)));
    const bySite = {};
    rows.forEach(x => { const s = x.inLocation || 'Other'; bySite[s] = bySite[s] || new Set(); bySite[s].add(String(x.empCode)); });
    const sites = Object.entries(bySite).map(([name, set]) => ({ name, count: set.size })).sort((a, b) => b.count - a.count);
    const times = rows.map(x => new Date(x.inTime)).filter(d => !isNaN(d));
    const last = times.length ? new Date(Math.max(...times)) : null;
    const early = rows.filter(x => { const d = new Date(x.inTime); return d.getHours() < 9 || (d.getHours() === 9 && d.getMinutes() <= 30); });
    return { present: people.size, sites, last, onTime: new Set(early.map(x => String(x.empCode))).size };
  } catch (_) { return null; }
}

export function upcomingHolidays(n = 4) {
  const today = startOfDay(new Date());
  return HOLIDAYS.map(h => ({ ...h, d: parseDate(h.date) }))
    .filter(h => h.d && h.d >= today)
    .sort((a, b) => a.d - b.d)
    .slice(0, n)
    .map(h => ({ ...h, daysAway: Math.round((h.d - today) / DAY) }));
}

/** Which birthdays to show: today and the next 6 days (date can be YYYY-MM-DD or DD-MM / DD/MM). */
export function birthdaysThisWeek(list) {
  const today = startOfDay(new Date());
  return (list || []).map(b => {
    const s = String(b.date || '').trim();
    let m = s.match(/^(\d{4})-(\d{2})-(\d{2})$/), mm, dd;
    if (m) { mm = +m[2]; dd = +m[3]; } else if ((m = s.match(/^(\d{1,2})[/-](\d{1,2})/))) { dd = +m[1]; mm = +m[2]; } else return null;
    let on = new Date(today.getFullYear(), mm - 1, dd);
    if (on < today) on = new Date(today.getFullYear() + 1, mm - 1, dd);
    return { ...b, on, daysAway: Math.round((on - today) / DAY) };
  }).filter(b => b && b.name && b.daysAway < 7).sort((a, b) => a.daysAway - b.daysAway);
}

export function activeAnnouncements(list) {
  const today = startOfDay(new Date());
  return (list || []).filter(a => {
    if (!a.title && !a.body && !a.image) return false;
    const from = parseDate(a.from), until = parseDate(a.until);
    if (from && today < startOfDay(from)) return false;
    if (until && today > startOfDay(until)) return false;
    return true;
  });
}

export function upcomingEvents(list) {
  const today = startOfDay(new Date());
  return (list || []).map(e => ({ ...e, d: parseDate(e.date) }))
    .filter(e => e.title && e.d && e.d >= today)
    .sort((a, b) => a.d - b.d)
    .map(e => ({ ...e, daysAway: Math.round((startOfDay(e.d) - today) / DAY) }));
}

/** Shrink an uploaded image so the TV config stays small (≤1600px, WebP/JPEG). */
export function compressImage(file, max = 1600) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      const c = document.createElement('canvas');
      c.width = Math.round(img.naturalWidth * k); c.height = Math.round(img.naturalHeight * k);
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height);
      URL.revokeObjectURL(url);
      let out = c.toDataURL('image/webp', 0.82);
      if (!out.startsWith('data:image/webp')) out = c.toDataURL('image/jpeg', 0.85);
      resolve(out);
    };
    img.onerror = () => { URL.revokeObjectURL(url); reject(new Error('This image could not be read.')); };
    img.src = url;
  });
}
