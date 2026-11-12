/**
 * SmartDesk Assistant — answers questions entirely inside the browser, with NO external API.
 *
 * It reads the application's own data:
 *   • Employee directory (employee_directory.xlsx via dataService)  → people, contacts, teams, headcount, joiners
 *   • Live attendance (backend-attendance)                          → who/how many are in today, own punch times
 *   • Holiday list (config/holidays)                                → next holiday, dates, long weekends
 *   • Company policy PDFs (public/company policies, read with pdf.js) → quotes the matching rule
 *   • TV Display content (announcements, events, stars, birthdays)  → company updates
 *   • SmartDesk itself (pages, tools, quick links)                  → "how do I…", "where is…"
 *
 * answer(question, { user, allowedTabs, employees }) → { answer, people, actions, links, used }
 */
import { HOLIDAYS } from '../config/holidays';
import { TABS } from '../config/tabs';
import { ATT_API } from '../config/api';
import { POLICY_DATA } from '../components/Policies';
import { quickLinks, projectLinks } from '../components/Home';
import { fetchTvConfig, activeAnnouncements, upcomingEvents, parseDate } from '../components/tv/tvData';
import { pdfjs } from './converter';

const TZ = 'Asia/Kolkata';
const PRIVILEGED = ['admin', 'hr', 'manager'];

/* ── text helpers ────────────────────────────────────────────────────────── */
export const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9@. ]/g, ' ').replace(/\s+/g, ' ').trim();
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const word = (q, w) => new RegExp(`(^| )${esc(w)}( |$)`).test(q);
const has = (q, re) => re.test(q);
const plural = (n, w, p = `${w}s`) => `${n} ${n === 1 ? w : p}`;
const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });
const fmtDate = (iso, o = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) => new Date(`${iso}T00:00:00`).toLocaleDateString('en-IN', o);
const daysUntil = (iso) => Math.round((new Date(`${iso}T00:00:00`) - new Date(`${todayISO()}T00:00:00`)) / 86400000);
const inDays = (n) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : n > 0 ? `in ${n} days` : `${-n} days ago`);
const fmtTime = (v) => {
  if (!v) return '';
  const d = new Date(String(v).replace('T', ' ').replace('Z', '').split('.')[0]);
  return isNaN(d) ? '' : d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: true });
};

const STOP = new Set(('a an the is are was were be been do does did i me my we our you your he she it they them of to in on at for from by with and or not no can could should would will shall may might ' +
  'what whats which who whom whose when where why how much many any some this that these those there here about tell show give get find list explain please policy policies company smart world smartworld swd ' +
  'per as if than then so also just only all each every one after before during got take need want required allowed rule rules into out up use using smartdesk portal ' +
  'kya hai hain ka ki ke ko kitne kitna kab kaun kaise mujhe mera meri hum batao bata').split(' '));
const SYN = { casual: ['cl'], cl: ['casual'], sick: ['sl', 'medical'], sl: ['sick'], earned: ['el', 'privilege', 'pl'], el: ['earned', 'privilege'], pl: ['privilege', 'earned'],
  privilege: ['pl', 'el', 'earned'], wfh: ['work from home', 'remote'], timing: ['hours', 'time'], timings: ['hours', 'time'], chutti: ['leave', 'holiday'],
  resign: ['resignation', 'notice'], late: ['late', 'grace'], travel: ['tour', 'travel'], salary: ['salary', 'pay'], harassment: ['posh', 'harassment'], posh: ['harassment'] };
function keywords(q) {
  const out = new Set();
  q.split(' ').filter(w => w.length >= 2 && !STOP.has(w)).forEach(w => {
    out.add(w);
    if (w.length > 3 && w.endsWith('s')) out.add(w.slice(0, -1));
    (SYN[w] || []).forEach(s => out.add(s));
  });
  return [...out];
}

/* ── SmartDesk knowledge: what each page and tool does ───────────────────── */
const HOWTO = [
  { k: /pdf (to|2) (word|doc|docx)|convert.*(pdf|word|docx|excel|csv|image|jpg|png)|(word|doc|excel|image|jpg|png) to pdf|merge pdf|combine pdf|file convert/, page: 'tools',
    a: 'Use **Tools → File Converter**: pick the file, choose the target format (PDF → Word, Word/Excel/Image → PDF, Excel ⇄ CSV, merge PDFs) and download the result. PDF → Word runs right in your browser, so the file never leaves your PC.' },
  { k: /edit (a |the |my )?pdf|pdf editor|change text in pdf|sign (a |the )?pdf|signature|white ?out|highlight pdf|add text to pdf/, page: 'tools',
    a: 'Use **Tools → PDF Editor**: open the PDF, click any existing text to edit it (it keeps the same font, size and colour; scanned pages are read with OCR), or add text, a signature, images, highlights, drawings or white-out — then **Download**.' },
  { k: /split pdf|rotate pdf|delete pages?|reorder pages?|watermark|page numbers?|compress pdf|reduce pdf size/, page: 'tools',
    a: 'Use **Tools → PDF Tools**: reorder, rotate or delete pages, split a PDF, add a watermark or page numbers, and compress it.' },
  { k: /resize (photo|image|picture)|compress (photo|image|jpg|png)|under 200 ?kb|image size|jpg to png|png to jpg|webp/, page: 'tools',
    a: 'Use **Tools → Image Tools**: resize photos, compress them under 200 KB, and convert JPG / PNG / WEBP — many files at once.' },
  { k: /merge excel|combine excel|compare (two )?(excel|files|sheets)|remove duplicates|duplicate rows|split (excel|sheet|by)/, page: 'tools',
    a: 'Use **Tools → Excel Tools**: merge many Excel files, compare two versions, remove duplicate rows, or split a sheet by site/department.' },
  { k: /qr ?code|wifi qr|wi fi qr|vcard/, page: 'tools',
    a: 'Use **Tools → QR Code Generator**: make QR codes for a website, Wi-Fi, a contact card or WhatsApp, and download PNG or SVG for printing.' },
  { k: /\bgst\b|\bemi\b|loan calculator|amount in words|rupees in words|number to words|land area|sq ?ft|gaj|acre|kanal|calculator/, page: 'tools',
    a: 'Use **Tools → Calculators**: amount in words (₹), GST, loan EMI, and land area conversion (sq ft, gaj, acre, kanal).' },
  { k: /tv display|office tv|tv screen|show on tv|announcement on tv|put .* on (the )?tv/, page: 'tv',
    a: 'HR manages the office TVs in **TV Display**: add announcements, events, birthdays, stars of the month, photos/videos and the ticker, preview it, and **Save** — every TV (open `/?tv` on the TV browser) updates within a minute.' },
  { k: /access control|give access|tab access|permission|who can see|hide (a )?tab|enable (a )?tab|rights/, page: 'access-control',
    a: 'Admins set which tabs each person sees in **Access Control**: search the employee (or a shared login like hr / it / manager), tick the tabs, and **Save**. Admins always see everything.' },
  { k: /dark mode|light mode|theme/, a: 'Use the **Dark / Light** button at the top right of SmartDesk to switch the theme. Your choice is remembered on this PC.' },
  { k: /shortcut|ctrl ?k|keyboard/, a: 'Press **Ctrl + K** anywhere in SmartDesk to open this search. Use ↑ ↓ to move and Enter to open or ask.' },
  { k: /log ?out|sign ?out/, a: 'Use the **power button** at the bottom of the left sidebar to sign out.' },
  { k: /(forgot|reset|change|set) (my )?password|can t log ?in|cannot log ?in|login (problem|issue)/,
    a: 'On the SmartDesk login page use **Forgot / set password** — a link is emailed to your official email ID. If the email does not arrive, contact IT at **itservicedesk@smartworlddevelopers.com**.' },
  { k: /(update|change|edit) (my )?(photo|picture|profile|details|mobile|number)|wrong (details|number|designation)/, page: 'directory',
    a: 'Directory details come from the HR employee master. To correct your designation, department or mobile number, ask **HR**; IT updates the directory sheet after that.' },
  { k: /dashboard|power ?bi|smartdb|report/, page: 'dashboard', a: 'Reports (SmartDB and Power BI) are in the **Dashboard** tab. If you cannot see it, ask IT to enable it for you in Access Control.' },
  { k: /(apply|request|take) (a )?leave|leave (application|balance|request)|payslip|salary slip|pay slip|form 16|tax declaration|reimbursement claim/,
    a: 'Leave, payslips and claims are handled in the **Adrenalin HR portal** — open it from **Home → Quick links → Adrenaline**. The leave rules themselves are in the **Leave Policy** under Policies.', link: 'Adrenaline' },
  { k: /it (ticket|support|help|issue|problem)|raise (a )?ticket|helpdesk|service desk|laptop (issue|problem)|printer|vpn|internet (not|issue|problem)/,
    a: 'Raise IT tickets in **ManageEngine (ZOHO)** — **Home → Quick links → ZOHO** — or email **itservicedesk@smartworlddevelopers.com**.', link: 'ZOHO' },
  { k: /\bcrm\b|salesforce|sfdc|4qt/, a: 'CRM systems are in **Home → Quick links**: **SFDC** (Salesforce) and **4QT** (CRM).', link: 'SFDC' },
  { k: /leasing|billing|smart leasing/, a: 'Leasing & billing is in **Smart Leasing** — **Home → Quick links → Smart Leasing**.', link: 'Smart Leasing' },
  { k: /visitor|vms|gate pass/, a: 'Visitor management is in **ITS (VMS Portal)** — **Home → Quick links → ITS**.', link: 'ITS' },
  { k: /\bqms\b|quote comparison|vendorglobe|vendor/, a: 'Quote comparison is in **QMS** and the vendor portal in **VendorGlobe** — both in **Home → Quick links**.', link: 'QMS' },
  { k: /\berp\b|vista/, a: '**Vista-ERP** is in **Home → Quick links**.', link: 'Vista-ERP' },
  { k: /insurance|mediclaim|bimabro/, a: 'Insurance / employee benefits are in **BIMABRO** — **Home → Quick links → BIMABRO**.', link: 'BIMABRO' },
  { k: /\bprojects?\b.*(list|which|what|our|link)|sky arc|the edition|one dxp|orchard|gems/,
    a: () => `Our projects: ${projectLinks.map(p => `[${p.name}](${p.url})`).join(', ')}.` },
  { k: /what is smartdesk|what can (smartdesk|this|you) do|features|help/,
    a: () => `**SmartDesk** is Smart World's employee portal. Pages: ${TABS.map(t => `**${t.label}** (${t.desc})`).join('; ')}. Ask me about people, attendance, holidays, policies, tools or where to find anything.` },
];

/* ── policy text (read once from the PDFs, cached for the session) ───────── */
const POLICY_LIST = Object.entries(POLICY_DATA).flatMap(([section, list]) => list.map(p => ({ ...p, section })));
let policyText = null;
async function loadPolicies(onProgress) {
  if (policyText) return policyText;
  const lib = await pdfjs();
  const out = [];
  let done = 0;
  await Promise.all(POLICY_LIST.map(async (p) => {
    let text = '';
    try {
      const doc = await lib.getDocument({ url: encodeURI(p.link), disableFontFace: true, isEvalSupported: false, verbosity: 0 }).promise;
      for (let i = 1; i <= doc.numPages; i++) {
        const c = await (await doc.getPage(i)).getTextContent();
        text += c.items.map(x => x.str).join(' ') + '\n';
      }
    } catch (_) { /* missing / unreadable PDF */ }
    out.push({ ...p, text: text.replace(/[ \t]+/g, ' ').trim() });
    done += 1;
    onProgress && onProgress(done, POLICY_LIST.length);
  }));
  policyText = out;
  return out;
}
export const warmPolicies = () => loadPolicies().catch(() => null);

/* ── finding the right passage inside a policy ─────────────────────────────
 * The PDF text is cut into small units (sentences, bullets, "B. Casual Leave" sub-headings,
 * "3. Official Timings" sections); every run of consecutive units up to ~650 characters is
 * scored by how many of the question's words (by stem) it contains. */
const stem = (w) => (w.length <= 3 ? w : w.slice(0, Math.max(4, w.length - 2)));
const SKIP_SECTION = /^(preamble|purpose|scope|introduction|objective|objectives|applicab|definition|policy owner|review|amendment|content)/i;
function units(text) {
  return text.replace(/\s+/g, ' ')
    .split(/(?<=[.;!?])\s+(?=[A-Z0-9•(])|\s*[]\s*|\s(?=[A-H]\.\s+[A-Z][a-z])|\s(?=\d{1,2}\.\d{0,2}\s+[A-Z][A-Za-z])/)
    .map(u => u.trim()).filter(u => u.length > 3 && !/prepared by|reviewed by|approved by|p a g e|page \d+ of/i.test(u));
}
const isToc = (t) => (t.match(/\b\d{1,2}\s+[A-Z][A-Za-z/ -]{2,30}\s+\d{1,2}\b/g) || []).length >= 3;
function makeMatcher(kw) {
  const stems = kw.map(w => ({ w, s: stem(w), short: w.length <= 3 }));
  return (text) => {
    const words = norm(text).replace(/\./g, ' ').split(' ');
    return stems.filter(k => words.some(x => (k.short ? x === k.w : x.startsWith(k.s)))).map(k => k.w);
  };
}
function bestPassage(text, kw, q, wantNumber) {
  if (!kw.length) return null;
  const us = units(text);
  const match = makeMatcher(kw);
  const content = q.split(' ').filter(w => w.length >= 2 && !STOP.has(w));
  const phrases = [];
  for (let i = 0; i < content.length - 1; i++) phrases.push([stem(content[i]), stem(content[i + 1])]);
  let best = null;
  for (let i = 0; i < us.length; i++) {
    if (!match(us[i]).length && !(us[i + 1] && match(us[i + 1]).length && us[i].length < 60)) continue; // start at (or just before) a matching unit
    let txt = '';
    for (let j = i; j < us.length && (txt.length + us[j].length) < 650; j++) txt += (txt ? ' ' : '') + us[j];
    if (!txt || isToc(txt)) continue;
    const hit = match(txt);
    const words = norm(txt).replace(/\./g, ' ').split(' ');
    let sc = hit.length * 2 + match(us[i]).length * 1.5;
    for (const [a, b2] of phrases) for (let k = 0; k < words.length - 1; k++) if (words[k].startsWith(a) && words[k + 1].startsWith(b2)) { sc += 4; break; }
    if (wantNumber && /\d/.test(txt)) sc += 1;
    if (!best || sc > best.sc) best = { sc, text: txt, distinct: hit.length };
  }
  return best && best.sc >= 3.5 ? best : null;
}
/** A short overview of a policy: its first real sections after preamble/scope. */
function overview(text) {
  const t = text.replace(/\s+/g, ' ');
  const re = /(?:^|\s)(\d{1,2})\.(\d{1,2})?\s+(?=[A-Z][A-Za-z])/g;
  const cuts = [];
  let m;
  while ((m = re.exec(t))) cuts.push(m.index);
  const secs = cuts.map((c, i) => t.slice(c, cuts[i + 1] || t.length).trim().replace(/^\d{1,2}\.(\d{1,2})?\s+/, ''))
    .filter(x => x.length > 60 && !isToc(x) && !SKIP_SECTION.test(x));
  const body = (secs.length ? secs.slice(0, 2).join(' ') : units(t).slice(0, 8).join(' '));
  return body.length > 900 ? `${body.slice(0, 900).replace(/\s\S*$/, '')} …` : body;
}

/* ── live attendance ─────────────────────────────────────────────────────── */
async function fetchAttendance() {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  try {
    const r = await fetch(`${ATT_API}/attendance`, { signal: ctrl.signal, cache: 'no-store' });
    const j = await r.json();
    return j && j.success && Array.isArray(j.data) ? j : null;
  } catch (_) { return null; } finally { clearTimeout(t); }
}

/* ── the assistant ───────────────────────────────────────────────────────── */
export function createAssistant() {
  let emps = [];
  let deptCache = null, locCache = null;

  const depts = () => deptCache || (deptCache = [...new Set(emps.map(e => e.department).filter(Boolean))].map(d => [d, norm(d)]));
  const locs = () => locCache || (locCache = [...new Set(emps.map(e => e.location).filter(Boolean))].map(l => [l, norm(l)]));
  const acronym = (n) => n.split(' ').filter(w => !['and', 'of', 'the', '&'].includes(w)).map(w => w[0]).join('');

  function findDept(q) {
    let best = null;
    for (const [d, n] of depts()) {
      let s = 0;
      if (n.length >= 2 && word(q, n)) s = n.length + 10;
      else {
        const ac = acronym(n);
        if (ac.length >= 2 && word(q, ac)) s = 5;
        const first = n.split(' ')[0];
        if (!s && first.length >= 4 && word(q, first)) s = 3;
      }
      if (s && (!best || s > best.s)) best = { d, s };
    }
    return best && best.d;
  }
  function findLoc(q) {
    let best = null;
    for (const [l, n] of locs()) if (n.length >= 3 && word(q, n) && (!best || n.length > best.n.length)) best = { l, n };
    return best && best.l;
  }
  function findPeople(q, raw, strict = true) {
    const code = (raw.match(/\b\d{3,7}\b/) || [])[0];
    if (code) { const e = emps.find(x => String(x.id) === code); if (e) return [e]; }
    const emailHit = (raw.match(/[\w.+-]+@[\w.-]+/) || [])[0];
    if (emailHit) { const e = emps.find(x => norm(x.email) === norm(emailHit)); if (e) return [e]; }
    const qw = new Set(q.split(' ').filter(w => w.length >= 3 && !STOP.has(w)));
    if (!qw.size) return [];
    const hits = [];
    for (const e of emps) {
      const parts = norm(e.name).split(' ').filter(w => w.length >= 3);
      const n = parts.filter(p => qw.has(p)).length;
      if (n) hits.push({ e, n, full: n === parts.length });
    }
    if (!hits.length) return [];
    hits.sort((a, b) => b.n - a.n || b.full - a.full);
    const top = hits[0].n;
    if (strict && top === 1 && !has(q, /\b(who is|whos|who s|contact|phone|mobile|number|email|mail|designation|department|extension|kaun|reach|call|about|details|location|joined|is .* in office|punch)\b/)) return [];
    return hits.filter(x => x.n === top).slice(0, 8).map(x => x.e);
  }
  const personLine = (e, f = {}) => {
    let s = `**${e.name}** (${e.id}) — ${e.designation || e.grade || 'Employee'}, ${e.department || '—'}${e.location ? `, ${e.location}` : ''}`;
    if (f.phone && e.mobile) s += ` · 📞 ${e.mobile}`;
    if (f.email && e.email) s += ` · ✉️ ${e.email}`;
    if (f.joined && e.dateOfJoining) { const d = parseDate(e.dateOfJoining); if (d) s += ` · joined ${d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`; }
    return s;
  };
  const card = (e) => ({ id: e.id, name: e.name, designation: e.designation || e.grade, department: e.department, location: e.location, data: e });

  /* answerers: each returns null when the question isn't for it */
  const A = {};

  A.greet = (q) => (has(q, /^(hi+|hello|hey|namaste|good (morning|afternoon|evening)|thanks?|thank you|ok|okay)\b/) && q.split(' ').length <= 4
    ? { answer: has(q, /thank/) ? "You're welcome! 😊" : 'Hi! Ask me anything about SmartDesk — people, attendance, holidays, policies, tools, or where to find something.' } : null);

  A.math = (q, raw) => {
    const expr = raw.replace(/^(what is|whats|calculate|compute)\s+/i, '').replace(/[=?]\s*$/, '').replace(/×/g, '*').replace(/(\d)\s*x\s*(\d)/gi, '$1*$2').trim();
    if (!/^[\d\s+\-*/().%^]+$/.test(expr) || !/\d\s*[+\-*/%^]\s*[\d(]/.test(expr)) return null;
    try {
      // eslint-disable-next-line no-new-func
      const v = Function(`"use strict";return (${expr.replace(/\^/g, '**')})`)();
      if (typeof v !== 'number' || !isFinite(v)) return null;
      return { answer: `**${expr} = ${Number(v.toFixed(6)).toLocaleString('en-IN')}**` };
    } catch (_) { return null; }
  };

  A.datetime = (q) => {
    if (!has(q, /\b(time now|current time|what time|time is it|todays date|today s date|date today|what is the date|what day is (it|today)|which day is today|aaj kya|kitne baje)\b/)) return null;
    const now = new Date();
    return { answer: `It's **${now.toLocaleTimeString('en-IN', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })}** on **${now.toLocaleDateString('en-IN', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}**.` };
  };

  function holidayByName(q) {
    let best = null;
    for (const h of HOLIDAYS) {
      const n = norm(h.name).replace(/\b(day|ji|jayanti|ka|ki)\b/g, ' ').replace(/\s+/g, ' ').trim();
      if (n.split(' ').filter(w => w.length >= 4).some(w => word(q, w)) && (!best || n.length > best.n.length)) best = { ...h, n };
    }
    return best;
  }
  A.holidays = (q) => {
    const named = holidayByName(q);
    if (!has(q, /\b(holiday|holidays|chutti|chhutti|off day|long weekend|festival|leave on)\b/) && !(named && has(q, /\b(when|date|which day|kab|is .* (off|holiday))\b/))) return null;
    const list = [...HOLIDAYS].sort((a, b) => a.date.localeCompare(b.date));
    const today = todayISO();
    const act = [{ page: 'holiday-calendar', label: 'Open Holiday Calendar' }];
    if (named) return { answer: `**${named.name}** is on **${fmtDate(named.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}** (${inDays(daysUntil(named.date))}).${named.type ? ` It's a ${named.type.toLowerCase()} holiday.` : ''}`, actions: act, used: ['holidays'] };
    const upcoming = list.filter(h => h.date >= today);
    if (has(q, /\blong weekend/)) {
      const lw = upcoming.filter(h => { const d = new Date(`${h.date}T00:00:00`).getDay(); return d === 1 || d === 5; });
      return { answer: lw.length ? `Long weekends coming up:\n${lw.map(h => `- ${fmtDate(h.date)} — ${h.name}`).join('\n')}` : 'No more long weekends this year.', actions: act, used: ['holidays'] };
    }
    if (has(q, /\b(all|list|how many|kitne|this year|full|calendar|remaining)\b/)) {
      const show = has(q, /remaining|left|upcoming/) ? upcoming : list;
      return { answer: `**${plural(list.length, 'holiday')}** this year, ${upcoming.length} still to come:\n${show.map(h => `- ${fmtDate(h.date)} — ${h.name}${h.date < today ? ' ✓' : ''}`).join('\n')}`, actions: act, used: ['holidays'] };
    }
    if (!upcoming.length) return { answer: 'There are no more company holidays this year.', actions: act, used: ['holidays'] };
    const nx = upcoming[0];
    return {
      answer: `The next holiday is **${nx.name}** on **${fmtDate(nx.date, { weekday: 'long', day: 'numeric', month: 'long' })}** (${inDays(daysUntil(nx.date))}).` +
        (upcoming.length > 1 ? `\n\nAfter that:\n${upcoming.slice(1, 4).map(h => `- ${fmtDate(h.date)} — ${h.name}`).join('\n')}` : ''),
      actions: act, used: ['holidays'],
    };
  };

  A.attendance = async (q, raw, ctx) => {
    const live = has(q, /\b(in office|in the office|present|absent|came today|come today|punch(ed)?|punch in|in time|out time|attendance today|todays attendance|today s attendance|who is in (the )?office|who all (are|is) in|office today|aaj office|aaye|aaya|reached office|late today|came late)\b/);
    if (has(q, /\b(missing|miss|forgot|rule|rules|policy|regulari[sz]\w*|short leave|half day|late coming)\b/)) return null; // policy questions
    if (!live && !has(q, /\battendance\b/)) return null;
    const { user } = ctx;
    const priv = PRIVILEGED.includes(String(user?.role || '').toLowerCase());
    let code = '', who = null;
    if (has(q, /\b(my|mine|did i|i came|i punched|mera|meri|main)\b/)) code = String(user?.empId || '');
    else { const p = findPeople(q, raw, false); if (p.length === 1) { who = p[0]; code = String(who.id); } }
    const act = [{ page: 'attendance', label: 'Open Live Attendance' }];
    const j = await fetchAttendance();
    if (!j) return { answer: 'Live attendance is not reachable right now (the attendance service may be stopped). Please try again in a minute.', actions: act, used: ['attendance_today'] };
    const rows = j.data.filter(x => x.inTime);
    const present = new Set(rows.map(x => String(x.empCode)));
    const total = emps.length;
    let answer = '';
    if (code) {
      if (!priv && code !== String(user?.empId || '')) answer = `You can only see your own punch times. Here are today's totals instead.\n\n`;
      else {
        const rec = j.data.find(x => String(x.empCode) === code);
        const name = (who && who.name) || (emps.find(e => String(e.id) === code) || {}).name || code;
        answer = rec && rec.inTime
          ? `**${name}** punched in at **${fmtTime(rec.inTime)}**${rec.inLocation ? ` (${rec.inLocation})` : ''}${rec.outTime && fmtTime(rec.outTime) !== fmtTime(rec.inTime) ? `, last punch **${fmtTime(rec.outTime)}**${rec.outLocation ? ` (${rec.outLocation})` : ''}` : ''}.`
          : `**${name}** has **no punch recorded** today${code === String(user?.empId || '') ? '' : ' (not in office yet, on leave, or at a site without a device)'}.`;
        return { answer, actions: act, used: ['attendance_today'], people: who ? [card(who)] : [] };
      }
    }
    // site filter
    const sites = {};
    rows.forEach(x => { const s = x.inLocation || 'Other'; (sites[s] = sites[s] || new Set()).add(String(x.empCode)); });
    const siteList = Object.entries(sites).map(([s, set]) => [s, set.size]).sort((a, b) => b[1] - a[1]);
    const siteHit = siteList.find(([s]) => norm(s).length >= 3 && q.includes(norm(s)));
    if (siteHit) return { answer: `**${plural(siteHit[1], 'person', 'people')}** have punched in at **${siteHit[0]}** today.`, actions: act, used: ['attendance_today'] };
    const deptQ = findDept(q);
    if (deptQ && priv) {
      const inDept = emps.filter(e => e.department === deptQ);
      const inNow = inDept.filter(e => present.has(String(e.id)));
      return { answer: `**${inNow.length} of ${inDept.length}** people in **${deptQ}** have punched in today.${inNow.length && inNow.length <= 15 ? `\n${inNow.map(e => `- ${e.name}`).join('\n')}` : ''}`, actions: act, used: ['attendance_today'] };
    }
    answer += `**${plural(present.size, 'person', 'people')}** have punched in today${total ? ` (about ${Math.round((present.size / total) * 100)}% of ${total})` : ''}.`;
    if (siteList.length > 1) answer += `\n${siteList.slice(0, 6).map(([s, n]) => `- ${s}: **${n}**`).join('\n')}`;
    const times = rows.map(x => fmtTime(x.inTime)).filter(Boolean);
    if (times.length) answer += `\n\nFirst punch today: **${times.sort()[0]}**.`;
    return { answer, actions: act, used: ['attendance_today'] };
  };

  A.updates = async (q) => {
    if (!has(q, /\b(announcements?|news|notice board|events?|star of the month|stars?|star performer|birthdays?|janamdin|celebrations?|whats new|what s new|any updates|ticker|town ?hall|party)\b/)) return null;
    const { config } = await fetchTvConfig();
    const anns = activeAnnouncements(config.announcements);
    const evs = upcomingEvents(config.events);
    const stars = config.star && config.star.on ? (config.star.people || []).filter(p => p.name) : [];
    const bdays = (config.birthdays || []).filter(b => b.name);
    const only = (re) => has(q, re);
    const wantAll = !only(/\b(events?|stars?|birthdays?|announcements?|notice|town ?hall|party)\b/);
    const parts = [];
    if (wantAll || only(/announcement|notice|news|party/)) parts.push(anns.length ? `**Announcements**\n${anns.slice(0, 6).map(a => `- **${a.title || 'Notice'}**${a.body ? ` — ${a.body}` : ''}`).join('\n')}` : 'No active announcements right now.');
    if (wantAll || only(/event|town ?hall/)) parts.push(evs.length ? `**Upcoming events**\n${evs.slice(0, 6).map(e => `- ${e.d.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })} — **${e.title}**${e.time ? ` at ${e.time}` : ''}${e.place ? `, ${e.place}` : ''}`).join('\n')}` : 'No upcoming events are listed.');
    if (wantAll || only(/star/)) { if (stars.length || !wantAll) parts.push(stars.length ? `**${config.star.title || `Star${stars.length > 1 ? 's' : ''} of the month`}**\n${stars.map(s => `- **${s.name}**${s.role ? `, ${s.role}` : ''}${s.dept ? ` (${s.dept})` : ''}${s.reason ? ` — ${s.reason}` : ''}`).join('\n')}` : 'No star of the month has been set yet.'); }
    if (wantAll || only(/birthday|janamdin/)) { if (bdays.length || !wantAll) parts.push(bdays.length ? `**Birthdays**\n${bdays.slice(0, 10).map(b => `- **${b.name}**${b.dept ? ` (${b.dept})` : ''}${b.date ? ` — ${b.date}` : ''}`).join('\n')}` : 'HR has not added birthdays for this week.'); }
    return { answer: parts.join('\n\n'), actions: [{ page: 'home', label: 'Open Home' }], used: ['company_updates'] };
  };

  A.joiners = (q) => {
    if (!has(q, /\b(new joiners?|new joinees?|newly joined|joined (recently|this month|this week|last month)|recent joiners?|who joined|new employees?|naye)\b/)) return null;
    const days = has(q, /week/) ? 7 : has(q, /last month|60/) ? 60 : 30;
    const now = new Date();
    const list = emps.map(e => ({ e, d: parseDate(e.dateOfJoining) })).filter(x => x.d && (now - x.d) / 86400000 <= days && x.d <= now).sort((a, b) => b.d - a.d);
    if (!list.length) return { answer: `No one joined in the last ${days} days according to the directory.`, used: ['search_employees'] };
    return {
      answer: `**${plural(list.length, 'person', 'people')}** joined in the last ${days} days:\n${list.slice(0, 15).map(x => `- **${x.e.name}** — ${x.e.designation || x.e.grade || ''}, ${x.e.department} (${x.d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })})`).join('\n')}${list.length > 15 ? `\n- …and ${list.length - 15} more` : ''}`,
      people: list.slice(0, 8).map(x => card(x.e)), actions: [{ page: 'directory', label: 'Open Employee Directory' }], used: ['search_employees'],
    };
  };

  A.headcount = (q) => {
    if (!has(q, /\b(how many|total|count|number of|headcount|strength|kitne|kitna)\b/) || !has(q, /\b(employees?|people|staff|members?|headcount|log|team|department|departments|dept|location|locations|office|company|designations?)\b/)) return null;
    if (has(q, /\b(today|present|in office|punch|absent)\b/)) return null;
    const d = findDept(q), l = findLoc(q);
    const act = [{ page: 'directory', label: 'Open Employee Directory' }];
    if (has(q, /how many departments/)) return { answer: `There are **${depts().length} departments**: ${depts().map(x => x[0]).sort().join(', ')}.`, actions: act, used: ['directory_stats'] };
    if (has(q, /how many (locations|offices|sites)/)) return { answer: `Employees are spread across **${locs().length} locations**: ${locs().map(x => x[0]).sort().join(', ')}.`, actions: act, used: ['directory_stats'] };
    if (d || l) {
      const list = emps.filter(e => (!d || e.department === d) && (!l || e.location === l));
      const desig = (q.match(/\b(managers?|heads?|leads?|executives?|engineers?|directors?|officers?|assistants?|analysts?|developers?|architects?|accountants?|supervisors?)\b/) || [])[1];
      const filtered = desig ? list.filter(e => norm(e.designation || e.grade).includes(desig.replace(/s$/, ''))) : list;
      return { answer: `**${plural(filtered.length, desig ? desig.replace(/s$/, '') : 'employee')}** ${d ? `in **${d}**` : ''}${d && l ? ' ' : ''}${l ? `at **${l}**` : ''}.`, actions: act, used: ['directory_stats'] };
    }
    const count = (k) => Object.entries(emps.reduce((m, e) => { const v = e[k] || '(blank)'; m[v] = (m[v] || 0) + 1; return m; }, {})).sort((a, b) => b[1] - a[1]);
    const byLoc = has(q, /\b(location|office|site|city)\b/);
    return { answer: `Smart World has **${emps.length} employees** in the directory.\n\n**Biggest ${byLoc ? 'locations' : 'departments'}:**\n${count(byLoc ? 'location' : 'department').slice(0, 8).map(([n, c]) => `- ${n}: **${c}**`).join('\n')}`, actions: act, used: ['directory_stats'] };
  };

  A.howto = (q, raw, ctx) => {
    const hit = HOWTO.find(h => h.k.test(q));
    if (!hit) return null;
    const text = typeof hit.a === 'function' ? hit.a() : hit.a;
    const actions = [];
    if (hit.page && (hit.page !== 'access-control' || String(ctx.user?.role) === 'admin') && (ctx.allowedTabs || []).concat('home').includes(hit.page)) {
      const t = TABS.find(x => x.id === hit.page);
      actions.push({ page: hit.page, label: `Open ${t ? t.label : 'Access Control'}` });
    }
    const links = hit.link ? quickLinks.filter(l => l.title === hit.link).map(l => ({ url: l.url, title: `${l.title} — ${l.desc}` })) : [];
    return { answer: text, actions, links, used: ['smartdesk'] };
  };

  A.policy = async (q, raw, ctx, progress) => {
    const POLICY_WORDS = /\b(polic(y|ies)|leaves?|cl|el|sl|pl|casual|sick|earned|privilege|maternity|paternity|bereavement|comp ?off|dress|attire|travel|tour|conveyance|reimburse\w*|allowance|referral|incentive|posh|harass\w*|whistle\w*|conduct|ethics|working hours?|office tim\w*|timings?|late (coming|mark)|late|half day|grace|notice period|resign\w*|probation|flexi\w*|wfh|work from home|laptop|password|email|internet|software|data|backup|overtime|night|meal|asset|visitor|document|facility)\b/;
    if (!POLICY_WORDS.test(q)) return null;
    const act = [{ page: 'policies', label: 'Open Policies' }];
    if (has(q, /^(list|show|all|which|what) (are )?(the |all )?(company )?polic(y|ies)/) || q === 'policies' || q === 'policy') {
      return { answer: `There are **${POLICY_LIST.length} policy documents**:\n${Object.entries(POLICY_DATA).map(([s, l]) => `- **${s}:** ${l.map(p => p.title).join(', ')}`).join('\n')}`, actions: act, used: ['list_policies'] };
    }
    const list = (await loadPolicies(progress)).filter(p => p.text);
    if (!list.length) return { answer: 'I could not read the policy documents just now. You can open them on the **Policies** page.', actions: act, used: ['read_policy'] };
    const kw = keywords(q);
    if (!kw.length) return null;
    const wantNumber = has(q, /\b(how many|how much|kitne|kitna|days?|amount|limit|maximum|minimum|hours?|time|timing|when|rs|rupees|km)\b/);
    // pick the policy: words in its title count a lot; then find the best passage inside it
    const scored = list.map(p => {
      const title = norm(p.title);
      const titleHits = kw.filter(w => word(title, w) || title.split(' ').some(x => w.length > 3 && x.startsWith(stem(w))));
      const contentKw = kw.filter(w => !titleHits.includes(w));
      const passage = bestPassage(p.text, contentKw.length ? contentKw : kw, q, wantNumber);
      const onlyTitle = titleHits.length > 0 && (!contentKw.length || !passage || passage.distinct === 0);
      return { p, passage: onlyTitle ? null : passage, onlyTitle, score: titleHits.length * 6 + (passage ? passage.sc : 0) };
    }).filter(x => x.passage || x.onlyTitle).sort((a, b) => b.score - a.score);
    if (!scored.length) return null;
    const top = scored[0];
    const clean = (t) => t.replace(/\s*[]\s*/g, '\n- ').replace(/\s+([A-H])\.\s+(?=[A-Z][a-z])/g, '\n\n**$1.** ').replace(/ {2,}/g, ' ').trim();
    return {
      answer: top.passage ? `From the **${top.p.title}**:\n\n${clean(top.passage.text)}` : `**${top.p.title}** — in short:\n\n${clean(overview(top.p.text))}`,
      actions: act, links: [{ url: encodeURI(top.p.link), title: `${top.p.title} (PDF)` }], used: ['read_policy'],
    };
  };

  A.people = (q, raw) => {
    const f = { phone: has(q, /\b(phone|mobile|number|contact|call|whatsapp|no)\b/), email: has(q, /\b(email|mail|e mail|contact|id)\b/), joined: has(q, /\b(join|joined|joining|doj)\b/) };
    const d = findDept(q), l = findLoc(q);
    const people = findPeople(q, raw);
    const act = [{ page: 'directory', label: 'Open Employee Directory' }];
    if (people.length && (people.length <= 4 || !(d || l))) {
      const many = people.length > 1;
      return {
        answer: `${many ? `I found **${people.length} people** matching that:\n` : ''}${people.map(e => (many ? '- ' : '') + personLine(e, f)).join('\n')}${!f.phone && !f.email && !many ? '\n\nTap the card below for phone and email.' : ''}`,
        people: people.map(card), actions: act, used: ['search_employees'],
      };
    }
    if (d || l) {
      const all = emps.filter(e => (!d || e.department === d) && (!l || e.location === l));
      const desig = (q.match(/\b(managers?|heads?|leads?|executives?|engineers?|directors?|officers?|assistants?|analysts?|developers?|architects?|accountants?|supervisors?|gm|agm|dgm|vp)\b/) || [])[1];
      const list = desig ? all.filter(e => norm(e.designation || e.grade).includes(desig.replace(/s$/, ''))) : all;
      if (!list.length) return { answer: `No ${desig || 'one'} found${d ? ` in **${d}**` : ''}${l ? ` at **${l}**` : ''}.`, actions: act, used: ['search_employees'] };
      const head = list.find(e => /head|general manager|\bgm\b|director|vp|chief/i.test(e.designation || ''));
      const shown = list.slice(0, 12);
      return {
        answer: `**${plural(list.length, desig ? desig.replace(/s$/, '') : 'person', desig ? undefined : 'people')}** ${d ? `in **${d}**` : ''}${l ? ` at **${l}**` : ''}${head && !desig ? ` (head: **${head.name}**, ${head.designation})` : ''}:\n${shown.map(e => `- ${personLine(e, f)}`).join('\n')}${list.length > shown.length ? `\n- …and ${list.length - shown.length} more — see the Employee Directory` : ''}`,
        people: shown.slice(0, 8).map(card), actions: act, used: ['search_employees'],
      };
    }
    // "who is the head of X" / designation search across company
    const desigQ = q.match(/\b(ceo|coo|cfo|cto|chairman|director|head of [a-z ]+|general manager [a-z ]*)\b/);
    if (desigQ) {
      const t = desigQ[1].replace(/^head of /, '');
      const list = emps.filter(e => norm(e.designation || e.grade).includes(t) || (desigQ[1].startsWith('head of') && /head/i.test(e.designation || '') && norm(e.department).includes(t)));
      if (list.length) return { answer: list.slice(0, 8).map(e => `- ${personLine(e, f)}`).join('\n'), people: list.slice(0, 8).map(card), actions: act, used: ['search_employees'] };
    }
    return null;
  };

  A.pages = (q, raw, ctx) => {
    if (!has(q, /^(open|go to|goto|take me to|show me|where is|where can i|where do i|how do i (open|see|find))\b/) && !has(q, /\b(page|tab)\b/)) return null;
    const PAGES = [['directory', /directory|employee list|contacts?|employees/], ['attendance', /attendance|punch/], ['policies', /polic/], ['holiday-calendar', /holiday|calendar/],
      ['dashboard', /dashboard|power ?bi|report/], ['tools', /tools?|pdf|convert|editor|qr|calculator/], ['tv', /\btv\b|display/], ['access-control', /access|rights|permission/], ['home', /home/]];
    const hit = PAGES.find(([, re]) => re.test(q));
    if (!hit) return null;
    const t = TABS.find(x => x.id === hit[0]) || { label: 'Access Control', desc: 'Choose which tabs each employee can see' };
    const ok = hit[0] === 'home' || (hit[0] === 'access-control' ? String(ctx.user?.role) === 'admin' : (ctx.allowedTabs || []).includes(hit[0]));
    return ok ? { answer: `**${t.label}** — ${t.desc}.`, actions: [{ page: hit[0], label: `Open ${t.label}` }], used: ['smartdesk'] }
      : { answer: `You don't have access to **${t.label}** yet. Ask IT to enable it for you in Access Control.`, used: ['smartdesk'] };
  };

  A.quicklink = (q) => {
    const all = [...quickLinks.map(l => ({ name: l.title, desc: l.desc, url: l.url })), ...projectLinks.map(p => ({ name: p.name, desc: 'Project', url: p.url }))];
    const hit = all.find(l => norm(l.name).length >= 3 && word(q, norm(l.name)));
    if (!hit) return null;
    return { answer: `**${hit.name}** (${hit.desc}) — open it from **Home → Quick links**, or use the link below.`, links: [{ url: hit.url, title: `${hit.name} — ${hit.desc}` }], used: ['smartdesk'] };
  };

  /* last resort: search everything and show the closest matches */
  A.fallback = async (q, raw, ctx, progress) => {
    const kw = keywords(q);
    const people = findPeople(q, raw, false).slice(0, 5);
    const pages = TABS.filter(t => (ctx.allowedTabs || []).includes(t.id) && kw.some(w => norm(`${t.label} ${t.desc}`).includes(w)));
    let pol = null;
    if (kw.length) {
      try {
        const list = (await loadPolicies(progress)).filter(p => p.text);
        const scored = list.map(p => { const ps = bestPassage(p.text, kw, q, false); return { p, ps }; }).filter(x => x.ps).sort((a, b) => b.ps.sc - a.ps.sc);
        if (scored[0] && scored[0].ps.sc >= 5) pol = scored[0];
      } catch (_) { /* ignore */ }
    }
    if (!people.length && !pages.length && !pol) {
      return { answer: "I couldn't find that in SmartDesk. I can answer questions about **people** (name, team, contact), **attendance today**, **holidays**, **company policies**, **announcements & events**, **tools** and **where to find things** — try asking one of those." };
    }
    const parts = ["Here's the closest I found in SmartDesk:"];
    if (pol) parts.push(`**${pol.p.title}:**\n\n${pol.ps.text}`);
    if (people.length) parts.push(`**People:**\n${people.map(e => `- ${personLine(e)}`).join('\n')}`);
    if (pages.length) parts.push(`**Pages:** ${pages.map(t => t.label).join(', ')}`);
    return { answer: parts.join('\n\n'), people: people.map(card), actions: pages.slice(0, 2).map(t => ({ page: t.id, label: `Open ${t.label}` })), links: pol ? [{ url: encodeURI(pol.p.link), title: pol.p.title }] : [], used: ['smartdesk'] };
  };

  /* follow-ups like "and his email?" reuse the last person */
  let lastPeople = [];

  async function answer(question, ctx, progress) {
    emps = ctx.employees || emps;
    deptCache = null; locCache = null;
    const raw = String(question || '').trim();
    let q = norm(raw);
    if (lastPeople.length === 1 && has(q, /\b(his|her|their|him|uska|unka|same person)\b/) && !findPeople(q, raw).length) q = `${q} ${norm(lastPeople[0].name)}`;
    const order = [
      () => A.greet(q), () => A.math(q, raw), () => A.datetime(q),
      () => A.attendance(q, raw, ctx), () => A.holidays(q), () => A.joiners(q), () => A.updates(q),
      () => A.headcount(q), () => A.howto(q, raw, ctx), () => A.policy(q, raw, ctx, progress),
      () => A.people(q, raw), () => A.pages(q, raw, ctx), () => A.quicklink(q),
      () => A.fallback(q, raw, ctx, progress),
    ];
    for (const f of order) {
      // eslint-disable-next-line no-await-in-loop
      const r = await f();
      if (r) {
        if (r.people && r.people.length) lastPeople = r.people.map(p => p.data || p);
        return { people: [], actions: [], links: [], used: [], ...r };
      }
    }
    return { answer: 'Sorry, I could not find an answer to that.', people: [], actions: [], links: [], used: [] };
  }

  return { answer };
}
