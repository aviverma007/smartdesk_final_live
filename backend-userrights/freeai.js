/**
 * SmartDesk free answer engine — works with NO paid API key.
 *
 * 1. Reads SmartDesk's own data to answer: employees (directory sheet), headcount, live attendance,
 *    holidays, HR announcements/events/stars (TV config), and the company policy PDFs.
 * 2. Uses free, key-less web sources for outside questions:
 *      weather   → Open-Meteo (api.open-meteo.com)
 *      currency  → open.er-api.com
 *      news      → Google News RSS
 *      facts     → DuckDuckGo Instant Answers + Wikipedia
 * 3. Optional: if a free LLM key is set (GROQ_API_KEY or GEMINI_API_KEY, both have free tiers),
 *    the facts found above are handed to that model so it writes a natural, chat-style answer.
 *
 * Returns the same shape as the Claude path: { answer, sources, people, actions, used, model }.
 */

const UA = 'SmartDesk/1.0 (Smart World Developers internal portal)';
const TZ = 'Asia/Kolkata';
const HOME = { name: 'Gurugram', lat: 28.4595, lon: 77.0266 };

const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9@. ]/g, ' ').replace(/\s+/g, ' ').trim();
const has = (q, re) => re.test(q);
const esc = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const word = (q, w) => new RegExp(`(^| )${esc(w)}( |$)`).test(q);
const fmtDate = (iso, opts = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) =>
  new Date(`${iso}T00:00:00+05:30`).toLocaleDateString('en-IN', { timeZone: TZ, ...opts });
const todayISO = () => new Date().toLocaleDateString('en-CA', { timeZone: TZ });
const daysUntil = (iso) => Math.round((new Date(`${iso}T00:00:00+05:30`) - new Date(`${todayISO()}T00:00:00+05:30`)) / 86400000);
const inDays = (n) => (n === 0 ? 'today' : n === 1 ? 'tomorrow' : n > 0 ? `in ${n} days` : `${-n} days ago`);

async function getJSON(url, { timeout = 8000, headers = {} } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': UA, accept: 'application/json', ...headers } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.json();
  } finally { clearTimeout(t); }
}
async function getText(url, { timeout = 8000 } = {}) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), timeout);
  try {
    const r = await fetch(url, { signal: ctrl.signal, headers: { 'user-agent': UA } });
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    return await r.text();
  } finally { clearTimeout(t); }
}

/* ── words that help pick the right policy ───────────────────────────────── */
const POLICY_WORDS = /\b(polic(y|ies)|leaves?|cl|el|sl|pl|casual|sick|earned|privilege|maternity|paternity|bereavement|comp ?off|dress|travel|conveyance|reimburse\w*|referral|posh|harass\w*|whistle\w*|conduct|working hours?|office tim\w*|timings?|late (coming|mark)|half day|notice period|resign\w*|probation|confirmation|flexi\w*|wfh|work from home|laptop|password|email usage|overtime|gratuity|insurance|mediclaim|bonus|salary advance|loan|appraisal|increment|joining|exit|full and final|f ?f|holiday list|chutti)\b/;
const SYN = { casual: ['cl'], cl: ['casual'], sick: ['sl', 'medical'], sl: ['sick'], earned: ['el', 'privilege', 'pl'], el: ['earned', 'privilege'], pl: ['privilege', 'earned'],
  privilege: ['pl', 'el', 'earned'], wfh: ['work from home', 'remote'], timing: ['hours', 'time'], timings: ['hours', 'time'], late: ['late', 'grace'], chutti: ['leave', 'holiday'], resign: ['resignation', 'notice'] };
const STOP = new Set(('a an the is are was were be do does did i me my we our you your he she it they them of to in on at for from by with and or not no can could should would will shall may might ' +
  'what whats what s which who whom whose when where why how much many any some this that these those there here about tell show give get find list explain please policy policies company smart world smartworld swd ' +
  'per as if than then so also just only all each every one after before during get got take need want required allowed rule rules into out up kya hai kitne kitna kab kaun kaise mujhe mera meri hum').split(' '));

function keywords(q) {
  const out = new Set();
  q.split(' ').filter(w => w.length >= 2 && !STOP.has(w)).forEach(w => {
    out.add(w); if (w.length > 3 && w.endsWith('s')) out.add(w.slice(0, -1));
    (SYN[w] || []).forEach(s => out.add(s));
  });
  return [...out];
}

/* ── the engine ──────────────────────────────────────────────────────────── */
function createFreeEngine(h) {
  // h = { employees, searchEmployees, directoryStats, attendanceToday, companyUpdates, policies }

  const deptIndex = () => {
    const m = new Map();
    h.employees().forEach(e => { if (e.department) m.set(e.department, norm(e.department)); });
    return [...m.entries()];
  };
  const locIndex = () => {
    const m = new Map();
    h.employees().forEach(e => { if (e.location) m.set(e.location, norm(e.location)); });
    return [...m.entries()];
  };
  const acronym = (n) => n.split(' ').filter(w => w.length > 2 || /^[a-z]+$/.test(w)).filter(w => !['and', 'of', 'the'].includes(w)).map(w => w[0]).join('');

  function findDepartment(q) {
    let best = null;
    for (const [dept, n] of deptIndex()) {
      let score = 0;
      if (n.length >= 2 && word(q, n)) score = n.length + 10;
      else {
        const ac = acronym(n);
        if (ac.length >= 2 && word(q, ac)) score = 5;
        const short = n.split(' ')[0];
        if (!score && short.length >= 4 && word(q, short) && n.split(' ').length <= 3) score = 3;
      }
      if (score && (!best || score > best.score)) best = { dept, score };
    }
    return best && best.dept;
  }
  function findLocation(q) {
    let best = null;
    for (const [loc, n] of locIndex()) {
      if (n.length >= 3 && word(q, n) && (!best || n.length > best.n.length)) best = { loc, n };
    }
    return best && best.loc;
  }
  function findPeople(q, raw) {
    const code = (raw.match(/\b\d{3,7}\b/) || [])[0];
    if (code) { const e = h.employees().find(x => x.code === code); if (e) return [e]; }
    const qw = new Set(q.split(' ').filter(w => w.length >= 3 && !STOP.has(w)));
    if (!qw.size) return [];
    const hits = [];
    for (const e of h.employees()) {
      const parts = norm(e.name).split(' ').filter(w => w.length >= 3);
      const n = parts.filter(p => qw.has(p)).length;
      if (n) hits.push({ e, n, full: n === parts.length });
    }
    if (!hits.length) return [];
    hits.sort((a, b) => b.n - a.n || (b.full - a.full));
    const top = hits[0].n;
    const best = hits.filter(x => x.n === top);
    // a single first name is only trusted when the question is clearly about a person
    if (top === 1 && !has(q, /\b(who is|whos|who s|contact|phone|mobile|number|email|mail|designation|department|extension|kaun|reach|call)\b/)) return [];
    return best.slice(0, 8).map(x => x.e);
  }
  const personLine = (e, fields) => {
    let s = `**${e.name}** (${e.code}) — ${e.designation || 'Employee'}, ${e.department || '—'}${e.location ? `, ${e.location}` : ''}`;
    if (fields.phone && e.mobile) s += ` · 📞 ${e.mobile}`;
    if (fields.email && e.email) s += ` · ✉️ ${e.email}`;
    if (fields.joined && e.joined) s += ` · joined ${fmtDate(e.joined)}`;
    return s;
  };

  /* individual answerers — each returns null when it doesn't apply */
  const A = {};

  A.help = (q) => {
    if (q && !has(q, /^(hi|hello|hey|hii+|namaste|good (morning|afternoon|evening)|help|what can you do)\b/)) return null;
    return { answer: 'Hi! I can answer from SmartDesk data and the web, for example:\n- **People:** "Who is Rahul Sharma?", "Phone number of …", "Who is in the IT team?"\n- **Attendance:** "How many people are in office today?", "My punch time"\n- **Holidays:** "When is the next holiday?", "When is Diwali?"\n- **Policies:** "How many casual leaves do I get?", "What is the dress code?"\n- **Outside:** weather, USD to INR, news, and general facts.' };
  };

  A.math = (q, raw) => {
    const expr = raw.replace(/^(what is|whats|calculate|compute)\s+/i, '').replace(/[=?]\s*$/, '').replace(/x/gi, '*').trim();
    if (!/^[\d\s+\-*/().%^]+$/.test(expr) || !/\d\s*[+\-*/%^]\s*[\d(]/.test(expr)) return null;
    try {
      // only digits and operators reach here
      const v = Function(`"use strict";return (${expr.replace(/\^/g, '**')})`)();
      if (typeof v !== 'number' || !isFinite(v)) return null;
      return { answer: `**${expr} = ${Number.isInteger(v) ? v.toLocaleString('en-IN') : Number(v.toFixed(6)).toLocaleString('en-IN')}**` };
    } catch { return null; }
  };

  A.datetime = (q) => {
    if (!has(q, /\b(time now|current time|what time|time is it|today s date|todays date|date today|what is the date|what day is|which day is|aaj kya|samay|kitne baje)\b/)) return null;
    const now = new Date();
    return { answer: `It's **${now.toLocaleTimeString('en-IN', { timeZone: TZ, hour: '2-digit', minute: '2-digit' })}** on **${now.toLocaleDateString('en-IN', { timeZone: TZ, weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}** (India time).` };
  };

  A.holidays = (q, raw, ctx) => {
    if (!has(q, /\b(holiday|holidays|chutti|chhutti|off day|long weekend|festival)\b/) && !findHolidayByName(q, ctx)) return null;
    const list = (ctx.holidays || []).filter(x => x && x.date).sort((a, b) => a.date.localeCompare(b.date));
    if (!list.length) return { answer: 'The holiday list is on the **Holiday Calendar** page.', actions: [{ page: 'holiday-calendar', label: 'Open Holiday Calendar' }], used: ['holidays'] };
    const today = todayISO();
    const named = findHolidayByName(q, ctx);
    if (named) {
      const n = daysUntil(named.date);
      return { answer: `**${named.name}** is on **${fmtDate(named.date, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}** (${inDays(n)}).`, actions: [{ page: 'holiday-calendar', label: 'Open Holiday Calendar' }], used: ['holidays'] };
    }
    const upcoming = list.filter(x => x.date >= today);
    if (has(q, /\b(all|list|how many|kitne|this year|full|calendar)\b/)) {
      const lines = list.map(x => `- ${fmtDate(x.date)} — ${x.name}${x.date < today ? ' (done)' : ''}`).join('\n');
      return { answer: `There are **${list.length} holidays** this year (${upcoming.length} still to come):\n${lines}`, actions: [{ page: 'holiday-calendar', label: 'Open Holiday Calendar' }], used: ['holidays'] };
    }
    if (!upcoming.length) return { answer: 'There are no more company holidays this year.', actions: [{ page: 'holiday-calendar', label: 'Open Holiday Calendar' }], used: ['holidays'] };
    const nx = upcoming[0], more = upcoming.slice(1, 4);
    return {
      answer: `The next holiday is **${nx.name}** on **${fmtDate(nx.date, { weekday: 'long', day: 'numeric', month: 'long' })}** (${inDays(daysUntil(nx.date))}).` +
        (more.length ? `\n\nAfter that:\n${more.map(x => `- ${fmtDate(x.date)} — ${x.name}`).join('\n')}` : ''),
      actions: [{ page: 'holiday-calendar', label: 'Open Holiday Calendar' }], used: ['holidays'],
    };
  };
  function findHolidayByName(q, ctx) {
    let best = null;
    for (const x of ctx.holidays || []) {
      const n = norm(x.name).replace(/\b(day|ji|jayanti)\b/g, ' ').replace(/\s+/g, ' ').trim();
      const main = n.split(' ').filter(w => w.length >= 4);
      if (main.some(w => word(q, w)) && (!best || n.length > best.n.length)) best = { ...x, n };
    }
    return best;
  }

  A.attendance = async (q, raw, ctx, user) => {
    const live = has(q, /\b(in office|in the office|present|came today|come today|punch(ed)?|in time|out time|attendance today|today s attendance|todays attendance|who is in (the )?office|who all (are|is) in|how many (people|employees|staff).*(today|office)|office today|aaj office|aaye|aya)\b/);
    if (!live && !(has(q, /\battendance\b/) && !has(q, /\bpolicy\b/))) return null;
    let emp_code = '';
    let who = null;
    if (has(q, /\b(my|mine|i punch|did i|i came|mera|meri)\b/)) emp_code = String(user.empId || '');
    else {
      const p = findPeople(q, raw);
      if (p.length === 1) { who = p[0]; emp_code = who.code; }
    }
    const site = (has(q, /\b(at|in) /) && !emp_code) ? siteFrom(q) : '';
    const r = await h.attendanceToday({ site, emp_code }, user);
    if (r.error) return { answer: r.error, used: ['attendance_today'], actions: [{ page: 'attendance', label: 'Open Live Attendance' }] };
    const total = h.employees().length;
    let answer = '';
    if (r.individual) {
      const i = r.individual;
      if (i.error) answer = `${i.error}\n\n`;
      else if (i.status) answer = `**${i.name || i.code}** — ${i.status}.\n\n`;
      else answer = `**${i.name || i.code}** punched in at **${i.in_time}**${i.in_site ? ` (${i.in_site})` : ''}${i.out_time && i.out_time !== i.in_time ? `, last punch **${i.out_time}**${i.out_site ? ` (${i.out_site})` : ''}` : ''}.\n\n`;
    }
    answer += `**${r.present} people** have punched in today${site ? ` at ${site}` : ''}${total && !site ? ` (about ${Math.round((r.present / total) * 100)}% of ${total})` : ''}.`;
    if (r.by_site && r.by_site.length > 1 && !emp_code) answer += `\n${r.by_site.slice(0, 6).map(s => `- ${s.site}: **${s.present}**`).join('\n')}`;
    return { answer, used: ['attendance_today'], people: who ? [who] : [], actions: [{ page: 'attendance', label: 'Open Live Attendance' }] };
  };
  function siteFrom(q) { const m = q.match(/\b(?:at|in) ([a-z0-9 ]{3,30}?)(?: today| now|$)/); return m && !/office|the office/.test(m[1]) ? m[1].trim() : ''; }

  A.updates = async (q) => {
    if (!has(q, /\b(announcement|announcements|news from hr|hr news|notice board|event|events|star of the month|stars|star performer|birthday|birthdays|janamdin|celebration|celebrations|whats new|what s new|any updates)\b/)) return null;
    const u = await h.companyUpdates();
    if (u.error) return { answer: u.error, used: ['company_updates'] };
    const parts = [];
    const wantAll = !has(q, /\b(event|events|star|stars|birthday|birthdays|announcement|announcements|notice board)\b/);
    if ((wantAll || has(q, /announcement|notice board|news/)) ) parts.push(u.announcements.length ? `**Announcements**\n${u.announcements.slice(0, 6).map(a => `- **${a.title || 'Notice'}**${a.message ? ` — ${a.message}` : ''}`).join('\n')}` : 'No active announcements right now.');
    if (wantAll || has(q, /event/)) parts.push(u.upcoming_events.length ? `**Upcoming events**\n${u.upcoming_events.slice(0, 6).map(e => `- ${fmtDate(e.date)} — **${e.title}**${e.time ? ` at ${e.time}` : ''}${e.place ? `, ${e.place}` : ''}`).join('\n')}` : 'No upcoming events are listed.');
    if (wantAll || has(q, /star/)) parts.push(u.stars_of_the_month.length ? `**Star${u.stars_of_the_month.length > 1 ? 's' : ''} of the month**\n${u.stars_of_the_month.map(s => `- **${s.name}**${s.designation ? `, ${s.designation}` : ''}${s.department ? ` (${s.department})` : ''}${s.reason ? ` — ${s.reason}` : ''}`).join('\n')}` : (wantAll ? '' : 'No star of the month is set yet.'));
    if (wantAll || has(q, /birthday|janamdin/)) parts.push(u.birthdays_entered_by_hr.length ? `**Birthdays**\n${u.birthdays_entered_by_hr.slice(0, 8).map(b => `- **${b.name}**${b.department ? ` (${b.department})` : ''}${b.date ? ` — ${b.date}` : ''}`).join('\n')}` : (wantAll ? '' : 'No birthdays have been added by HR this week.'));
    return { answer: parts.filter(Boolean).join('\n\n'), used: ['company_updates'], actions: [{ page: 'home', label: 'Open Home' }] };
  };

  A.headcount = (q) => {
    if (!has(q, /\b(how many|total|count|number of|headcount|strength|kitne)\b/) || !has(q, /\b(employees?|people|staff|members?|headcount|log|team|department|dept|location|office|company)\b/)) return null;
    if (has(q, /\b(today|present|in office|punch)\b/)) return null; // live attendance question
    const dept = findDepartment(q), loc = findLocation(q);
    if (dept || loc) {
      const r = h.searchEmployees({ department: dept || '', location: loc || '', limit: 40 });
      // department totals must use the exact department name
      const n = h.employees().filter(e => (!dept || e.department === dept) && (!loc || e.location === loc)).length || r.total_matches;
      return { answer: `**${n} employee${n === 1 ? '' : 's'}** ${dept ? `in **${dept}**` : ''}${dept && loc ? ' ' : ''}${loc ? `at **${loc}**` : ''}.`, used: ['directory_stats'], actions: [{ page: 'directory', label: 'Open Employee Directory' }] };
    }
    const s = h.directoryStats();
    const top = (arr) => arr.slice(0, 6).map(x => `- ${x.name}: **${x.employees}**`).join('\n');
    const byLoc = has(q, /\b(location|office|site|city)\b/);
    return {
      answer: `Smart World has **${s.total_employees} employees** in the directory${s.joined_last_30_days ? ` (${s.joined_last_30_days} joined in the last 30 days)` : ''}.\n\n**Biggest ${byLoc ? 'locations' : 'departments'}:**\n${top(byLoc ? s.by_location : s.by_department)}`,
      used: ['directory_stats'], actions: [{ page: 'directory', label: 'Open Employee Directory' }],
    };
  };

  A.policy = async (q) => {
    if (!POLICY_WORDS.test(q)) return null;
    const list = (await h.policies()).filter(p => p.text);
    if (!list.length) return { answer: 'The policy documents are on the **Policies** page.', actions: [{ page: 'policies', label: 'Open Policies' }], used: ['read_policy'] };
    const kw = keywords(q);
    if (!kw.length || has(q, /^(list|show|all|which) (of )?(the )?(company )?polic/)) {
      return { answer: `There are **${list.length} policies**:\n${list.map(p => `- ${p.name}`).join('\n')}`, actions: [{ page: 'policies', label: 'Open Policies' }], used: ['list_policies'] };
    }
    // pick the policy: name matches count a lot, text matches a little
    const scored = list.map(p => {
      const n = norm(p.name), t = norm(p.text);
      let s = 0;
      for (const w of kw) {
        if (word(n, w)) s += 8;
        const c = (t.match(new RegExp(`(^| )${esc(w)}( |$)`, 'g')) || []).length;
        s += Math.min(c, 15) * 0.4;
      }
      return { p, s };
    }).sort((a, b) => b.s - a.s);
    const best = scored[0];
    if (!best || best.s < 1) return null;
    // pick the best sentences in that policy
    const sentences = best.p.text.split(/(?<=[.;:!?])\s+(?=[A-Z0-9•(])|\n+|\s(?=•)|\s(?=\(?[a-z0-9]{1,2}[.)]\s+[A-Z])/).map(s => s.trim()).filter(s => s.length > 25 && s.length < 600 && !/prepared by|reviewed by|approved by|version no|document no/i.test(s));
    const wantNumber = has(q, /\b(how many|how much|kitne|kitna|days?|amount|limit|maximum|minimum|hours?|time|timing|when)\b/);
    const ranked = sentences.map((s, i) => {
      const n = norm(s);
      let sc = kw.reduce((t, w) => t + (word(n, w) ? (w.length <= 2 ? 2 : 1.5) : n.includes(w) ? 0.5 : 0), 0);
      if (wantNumber && /\d/.test(s)) sc += 1.2;
      const distinct = kw.filter(w => word(n, w)).length;
      if (distinct < Math.min(2, kw.length)) sc = 0; // needs at least two of the question's key words
      return { s, i, sc };
    }).filter(x => x.sc >= 1.5).sort((a, b) => b.sc - a.sc)
      .filter((x, _, all) => x.sc >= all[0].sc * 0.6).slice(0, 3).sort((a, b) => a.i - b.i);
    if (!ranked.length) {
      return { answer: `This looks like it's covered in the **${best.p.name}**, but I couldn't find the exact line. Open it on the Policies page to read it.`, actions: [{ page: 'policies', label: 'Open Policies' }], used: ['read_policy'] };
    }
    const clean = (s) => s.replace(/\s+/g, ' ').replace(/^[•\-–]\s*/, '').slice(0, 420);
    return {
      answer: `From the **${best.p.name}**:\n${ranked.map(x => `- ${clean(x.s)}`).join('\n')}`,
      actions: [{ page: 'policies', label: 'Open Policies' }], used: ['read_policy'], policy: best.p.name,
    };
  };

  A.people = (q, raw) => {
    const fields = { phone: has(q, /\b(phone|mobile|number|contact|call|whatsapp|no)\b/), email: has(q, /\b(email|mail|e mail|contact)\b/), joined: has(q, /\b(join|joined|joining|doj)\b/) };
    const listing = has(q, /\b(who|list|show|people|employees|members|team|staff|works? in|working in|kaun)\b/);
    const dept = findDepartment(q), loc = findLocation(q);
    const people = findPeople(q, raw);
    if (people.length && (people.length <= 3 || !(dept || loc))) {
      const many = people.length > 1;
      return {
        answer: `${many ? `I found **${people.length} people** matching that:\n` : ''}${people.map(e => (many ? '- ' : '') + personLine(e, fields)).join('\n')}` +
          (!fields.phone && !fields.email ? '\n\nTap a person below for phone and email.' : ''),
        people, used: ['search_employees'], actions: [{ page: 'directory', label: 'Open Employee Directory' }],
      };
    }
    if ((dept || loc) && listing) {
      const all = h.employees().filter(e => (!dept || e.department === dept) && (!loc || e.location === loc));
      const desig = (q.match(/\b(manager|head|lead|executive|engineer|director|officer|assistant|analyst|developer)s?\b/) || [])[1];
      const list = desig ? all.filter(e => norm(e.designation).includes(desig)) : all;
      if (!list.length) return null;
      const shown = list.slice(0, 12);
      return {
        answer: `**${list.length} ${desig ? `${desig}${list.length === 1 ? '' : 's'}` : `employee${list.length === 1 ? '' : 's'}`}** ${dept ? `in **${dept}**` : ''}${loc ? ` at **${loc}**` : ''}:\n${shown.map(e => `- ${personLine(e, fields)}`).join('\n')}${list.length > shown.length ? `\n- …and ${list.length - shown.length} more (see the Employee Directory)` : ''}`,
        people: shown.slice(0, 8), used: ['search_employees'], actions: [{ page: 'directory', label: 'Open Employee Directory' }],
      };
    }
    return null;
  };

  A.pages = (q, raw, ctx) => {
    const m = q.match(/^(open|go to|goto|take me to|show me|where is|where can i (find|see)|how do i (open|see|use))\s+(the )?(.+)$/);
    if (!m) return null;
    const PAGES = [['directory', /directory|employee list|contacts?/], ['attendance', /attendance|punch/], ['policies', /polic/], ['holiday-calendar', /holiday|calendar/],
      ['dashboard', /dashboard|power bi|report/], ['tools', /tools?|pdf|convert|editor/], ['tv', /tv|display/], ['home', /home/]];
    const hit = PAGES.find(([, re]) => re.test(m[m.length - 1]));
    if (!hit) return null;
    const allowed = !ctx.tabs || !ctx.tabs.length || ctx.tabs.includes(hit[0]) || hit[0] === 'home';
    return allowed
      ? { answer: 'Here you go:', actions: [{ page: hit[0], label: 'Open it' }] }
      : { answer: "You don't have access to that page. Ask IT to enable it for you in Access Control." };
  };

  A.weather = async (q) => {
    if (!has(q, /\b(weather|temperature|temp|rain|raining|forecast|humidity|hot|cold|mausam|baarish|aqi)\b/)) return null;
    let place = HOME;
    const m = q.match(/\b(?:in|at|of|for)\s+([a-z .]{3,40}?)(?:\s+(?:today|tomorrow|now|this week|right now))?$/) || q.match(/^([a-z .]{3,30}?)\s+(?:weather|temperature|mausam)\b/);
    const cand = m && m[1].replace(/\b(the|weather|today|tomorrow|now)\b/g, '').trim();
    if (cand && !/^(gurugram|gurgaon|office)$/.test(cand)) {
      try {
        const g = await getJSON(`https://geocoding-api.open-meteo.com/v1/search?name=${encodeURIComponent(cand)}&count=1&language=en&format=json`);
        const r = g.results && g.results[0];
        if (r) place = { name: [r.name, r.admin1, r.country_code === 'IN' ? '' : r.country].filter(Boolean).join(', '), lat: r.latitude, lon: r.longitude };
      } catch { /* keep Gurugram */ }
    }
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${place.lat}&longitude=${place.lon}&current=temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m&daily=weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max&timezone=${encodeURIComponent(TZ)}&forecast_days=3`;
    let w;
    try { w = await getJSON(url); } catch (e) { return { answer: "I couldn't reach the weather service just now. Please try again in a minute.", used: ['web_search'] }; }
    const c = w.current || {}, d = w.daily || {};
    const day = (i) => `${i === 0 ? 'Today' : i === 1 ? 'Tomorrow' : fmtDate(d.time[i], { weekday: 'long' })}: ${WMO[d.weather_code[i]] || '—'}, **${Math.round(d.temperature_2m_min[i])}–${Math.round(d.temperature_2m_max[i])}°C**${d.precipitation_probability_max && d.precipitation_probability_max[i] != null ? `, rain chance ${d.precipitation_probability_max[i]}%` : ''}`;
    let aqi = '';
    if (has(q, /\baqi|pollution|air\b/)) {
      try {
        const a = await getJSON(`https://air-quality-api.open-meteo.com/v1/air-quality?latitude=${place.lat}&longitude=${place.lon}&current=us_aqi,pm2_5,pm10&timezone=${encodeURIComponent(TZ)}`);
        if (a.current) aqi = `\n\n**Air quality:** US AQI **${a.current.us_aqi}** (${aqiLabel(a.current.us_aqi)}) · PM2.5 ${Math.round(a.current.pm2_5)} · PM10 ${Math.round(a.current.pm10)}`;
      } catch { /* ignore */ }
    }
    return {
      answer: `**${place.name}** now: **${Math.round(c.temperature_2m)}°C** (feels like ${Math.round(c.apparent_temperature)}°C), ${WMO[c.weather_code] || ''}, humidity ${c.relative_humidity_2m}%, wind ${Math.round(c.wind_speed_10m)} km/h.\n${d.time ? [0, 1, 2].map(i => `- ${day(i)}`).join('\n') : ''}${aqi}`,
      sources: [{ url: 'https://open-meteo.com/', title: 'Open-Meteo weather' }], used: ['web_search'],
    };
  };

  A.currency = async (q) => {
    const CODES = { dollar: 'USD', dollars: 'USD', usd: 'USD', euro: 'EUR', euros: 'EUR', eur: 'EUR', pound: 'GBP', pounds: 'GBP', gbp: 'GBP', dirham: 'AED', aed: 'AED', yen: 'JPY', jpy: 'JPY',
      rupee: 'INR', rupees: 'INR', inr: 'INR', rs: 'INR', sgd: 'SGD', cad: 'CAD', aud: 'AUD', riyal: 'SAR', sar: 'SAR', yuan: 'CNY', cny: 'CNY', chf: 'CHF' };
    if (!has(q, /\b(rate|convert|exchange|to inr|in inr|in rupees|to rupees|price of (dollar|euro|pound))\b/) && !has(q, /\b\d+(\.\d+)? ?(usd|eur|gbp|aed|dollars?|euros?|pounds?)\b/)) return null;
    const found = q.split(' ').map(w => CODES[w]).filter(Boolean);
    if (!found.length) return null;
    let from = found[0], to = found[1] || (from === 'INR' ? 'USD' : 'INR');
    if (from === to) to = from === 'INR' ? 'USD' : 'INR';
    const amt = parseFloat((q.match(/\b(\d+(?:\.\d+)?)\b/) || [])[1] || '1');
    try {
      const r = await getJSON(`https://open.er-api.com/v6/latest/${from}`);
      const rate = r.rates && r.rates[to];
      if (!rate) return null;
      return {
        answer: `**${amt.toLocaleString('en-IN')} ${from} = ${(amt * rate).toLocaleString('en-IN', { maximumFractionDigits: 2 })} ${to}**\n\nRate: 1 ${from} = ${rate.toFixed(4)} ${to} (updated ${r.time_last_update_utc ? new Date(r.time_last_update_utc).toLocaleDateString('en-IN', { timeZone: TZ, day: 'numeric', month: 'short' }) : 'today'}).`,
        sources: [{ url: 'https://www.exchangerate-api.com', title: 'ExchangeRate-API (open access)' }], used: ['web_search'],
      };
    } catch { return { answer: "I couldn't reach the exchange-rate service just now.", used: ['web_search'] }; }
  };

  A.news = async (q) => {
    if (!has(q, /\b(news|headlines|latest on|khabar|samachar)\b/)) return null;
    const topic = q.replace(/\b(latest|today s|todays|top|news|headlines|about|on|the|what is|what s|whats|show|me|give|any|in|of|for|khabar|samachar|please)\b/g, ' ').replace(/\s+/g, ' ').trim();
    const url = topic ? `https://news.google.com/rss/search?q=${encodeURIComponent(topic)}&hl=en-IN&gl=IN&ceid=IN:en` : 'https://news.google.com/rss?hl=en-IN&gl=IN&ceid=IN:en';
    let xml;
    try { xml = await getText(url); } catch { return { answer: "I couldn't reach the news service just now.", used: ['web_search'] }; }
    const items = [...xml.matchAll(/<item>([\s\S]*?)<\/item>/g)].slice(0, 6).map(m => {
      const get = (t) => ((m[1].match(new RegExp(`<${t}[^>]*>([\\s\\S]*?)</${t}>`)) || [])[1] || '').replace(/<!\[CDATA\[|\]\]>/g, '').replace(/&amp;/g, '&').replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&lt;|&gt;/g, '').trim();
      return { title: get('title'), link: get('link'), source: get('source'), date: get('pubDate') };
    }).filter(x => x.title && x.link);
    if (!items.length) return { answer: `I couldn't find recent news${topic ? ` about **${topic}**` : ''}.`, used: ['web_search'] };
    return {
      answer: `**Latest ${topic ? `news on ${topic}` : 'headlines (India)'}:**\n${items.map(x => `- [${x.title.replace(/ - [^-]+$/, '')}](${x.link})${x.source ? ` — ${x.source}` : ''}`).join('\n')}`,
      sources: items.slice(0, 4).map(x => ({ url: x.link, title: x.title })), used: ['web_search'],
    };
  };

  A.web = async (q, raw) => {
    const query = raw.replace(/\?+$/, '').replace(/^(please\s+)?(tell me|can you tell me|do you know|search( for)?|google|explain|define|what is|what are|who is|who was|who are|what's|whats|meaning of)\s+/i, '').trim() || raw;
    // 1) DuckDuckGo instant answer
    try {
      const d = await getJSON(`https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&no_html=1&skip_disambig=1&t=smartdesk`);
      const text = d.Answer || d.AbstractText || d.Definition;
      if (text && String(text).length > 3) {
        const src = d.AbstractURL || d.DefinitionURL;
        return { answer: `${d.Heading ? `**${d.Heading}** — ` : ''}${String(text).slice(0, 900)}`, sources: src ? [{ url: src, title: d.AbstractSource || d.Heading || 'Source' }] : [], used: ['web_search'] };
      }
    } catch { /* try Wikipedia */ }
    // 2) Wikipedia search + summary
    try {
      const s = await getJSON(`https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&srlimit=1&format=json&origin=*`);
      const title = s.query && s.query.search && s.query.search[0] && s.query.search[0].title;
      if (title) {
        const p = await getJSON(`https://en.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(title.replace(/ /g, '_'))}`);
        if (p.extract) return { answer: `**${p.title}** — ${p.extract.slice(0, 900)}`, sources: [{ url: (p.content_urls && p.content_urls.desktop && p.content_urls.desktop.page) || `https://en.wikipedia.org/wiki/${encodeURIComponent(title)}`, title: `Wikipedia: ${p.title}` }], used: ['web_search'] };
      }
    } catch { /* nothing */ }
    return null;
  };

  /** Runs the answerers in order; returns the first answer that fits. */
  async function answer(question, ctx, user) {
    const raw = String(question || '').trim();
    const q = norm(raw);
    const order = [
      () => A.help(q), () => A.math(q, raw), () => A.datetime(q), () => A.pages(q, raw, ctx),
      () => A.weather(q), () => A.currency(q), () => A.news(q),
      () => A.holidays(q, raw, ctx), () => A.attendance(q, raw, ctx, user), () => A.updates(q),
      () => A.headcount(q), () => A.policy(q), () => A.people(q, raw),
      () => A.web(q, raw),
    ];
    for (const f of order) {
      const r = await f();
      if (r) return { found: true, ...r };
    }
    return {
      found: false,
      answer: "I couldn't find an answer to that in SmartDesk or on the web. Try rephrasing, or ask about people, attendance, holidays, policies, weather, news or currency.",
    };
  }

  return { answer, findPeople };
}

const WMO = { 0: 'clear sky ☀️', 1: 'mostly clear 🌤️', 2: 'partly cloudy ⛅', 3: 'overcast ☁️', 45: 'fog 🌫️', 48: 'fog 🌫️', 51: 'light drizzle 🌦️', 53: 'drizzle 🌦️', 55: 'heavy drizzle 🌧️',
  61: 'light rain 🌦️', 63: 'rain 🌧️', 65: 'heavy rain 🌧️', 71: 'light snow 🌨️', 73: 'snow 🌨️', 75: 'heavy snow ❄️', 80: 'rain showers 🌦️', 81: 'rain showers 🌧️', 82: 'heavy showers ⛈️',
  95: 'thunderstorm ⛈️', 96: 'thunderstorm with hail ⛈️', 99: 'thunderstorm with hail ⛈️' };
const aqiLabel = (v) => (v <= 50 ? 'good' : v <= 100 ? 'moderate' : v <= 150 ? 'unhealthy for sensitive groups' : v <= 200 ? 'unhealthy' : v <= 300 ? 'very unhealthy' : 'hazardous');

/* ── optional free LLM (Groq / Gemini free tiers, OpenAI-compatible) ─────── */
function llmConfig() {
  if (process.env.GROQ_API_KEY) return { name: 'Groq', key: process.env.GROQ_API_KEY, url: 'https://api.groq.com/openai/v1/chat/completions', model: process.env.LLM_MODEL || 'llama-3.3-70b-versatile' };
  if (process.env.GEMINI_API_KEY) return { name: 'Gemini', key: process.env.GEMINI_API_KEY, url: 'https://generativelanguage.googleapis.com/v1beta/openai/chat/completions', model: process.env.LLM_MODEL || 'gemini-2.5-flash' };
  if (process.env.LLM_API_KEY && process.env.LLM_API_URL) return { name: 'LLM', key: process.env.LLM_API_KEY, url: process.env.LLM_API_URL, model: process.env.LLM_MODEL || 'default' };
  return null;
}

async function polishWithLLM(cfg, { question, history, found, user }) {
  const now = new Date().toLocaleString('en-IN', { timeZone: TZ, dateStyle: 'full', timeStyle: 'short' });
  const sys = `You are SmartDesk AI, the assistant in Smart World Developers' internal employee portal (Gurugram, India). Now: ${now}. Asking: ${user.name || 'an employee'} (${user.role || 'employee'}).
Rules: Answer briefly (1–5 sentences or a short bullet list) using **bold** for key facts. When FACTS are given, rely on them only and never invent company data (names, numbers, policy rules). Keep any markdown links from the facts. If FACTS say nothing was found, answer from general knowledge only for general questions and say it may be out of date; for company questions say you don't have that data. Reply in the user's language (English or Hinglish).`;
  const messages = [{ role: 'system', content: sys }];
  (history || []).slice(-4).forEach(m => { if (m && (m.role === 'user' || m.role === 'assistant') && typeof m.content === 'string') messages.push({ role: m.role, content: m.content.slice(0, 1500) }); });
  messages.push({ role: 'user', content: `QUESTION: ${question}\n\nFACTS (from SmartDesk data and web lookups):\n${found.found ? found.answer : 'Nothing was found in SmartDesk data or the free web sources.'}` });
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 20000);
  try {
    const r = await fetch(cfg.url, { method: 'POST', signal: ctrl.signal, headers: { 'content-type': 'application/json', authorization: `Bearer ${cfg.key}` }, body: JSON.stringify({ model: cfg.model, messages, temperature: 0.2, max_tokens: 700 }) });
    const j = await r.json().catch(() => ({}));
    if (!r.ok) throw new Error((j.error && (j.error.message || j.error)) || `HTTP ${r.status}`);
    return (j.choices && j.choices[0] && j.choices[0].message && j.choices[0].message.content || '').trim();
  } finally { clearTimeout(t); }
}

async function askFree(engine, { question, history = [], context = {} }, user) {
  const found = await engine.answer(question, context, user);
  const cfg = llmConfig();
  let text = found.answer, model = 'smartdesk-free';
  // People lists and policy quotes are already exact — the LLM only rewrites when it adds value
  if (cfg && !(found.people && found.people.length > 1)) {
    try {
      const t = await polishWithLLM(cfg, { question, history, found, user });
      if (t) { text = t; model = `${cfg.name.toLowerCase()}:${cfg.model}`; }
    } catch (e) { console.warn(`   ! AI (${cfg.name}): ${e.message} — using the built-in answer`); }
  }
  return {
    answer: text,
    sources: (found.sources || []).slice(0, 6),
    people: (found.people || []).slice(0, 8).map(e => ({ code: e.code, name: e.name, designation: e.designation, department: e.department, location: e.location })),
    actions: (found.actions || []).slice(0, 2),
    used: found.used || [],
    model,
  };
}

module.exports = { createFreeEngine, askFree, llmConfig };
