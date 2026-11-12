/**
 * SmartDesk AI search — answers with Claude when ANTHROPIC_API_KEY is set; otherwise with the free
 * engine in freeai.js (SmartDesk data + free web sources, optional free Groq/Gemini key).
 *
 * The API key stays on this server (ANTHROPIC_API_KEY in .env); the browser never sees it.
 * Claude can call these tools to answer from real company data, then reply with sources:
 *   search_employees / directory_stats   employee sheet (frontend/public/employee_directory.xlsx)
 *   attendance_today                     live attendance (backend-attendance); employees only see their own punches
 *   company_updates                      announcements, events, stars, birthdays (TV Display settings in SQL)
 *   list_policies / read_policy          the company policy PDFs (frontend/public/company policies)
 *   suggest_page                         offers a button to open a SmartDesk page
 *   web_search (Anthropic server tool)   weather, news, anything current outside the company
 */
const fs = require('fs');
const { createFreeEngine, askFree, llmConfig } = require('./freeai');
const path = require('path');

const API_URL = process.env.ANTHROPIC_API_URL || 'https://api.anthropic.com/v1/messages';
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-5-5';
const EFFORT = process.env.ANTHROPIC_EFFORT || 'low';
const FRONTEND_PUBLIC = process.env.FRONTEND_PUBLIC_DIR || path.join(__dirname, '..', 'smartdesk 2', 'frontend', 'public');
const EMP_XLSX = process.env.EMPLOYEE_XLSX || path.join(FRONTEND_PUBLIC, 'employee_directory.xlsx');
const POLICY_DIR = process.env.POLICY_DIR || path.join(FRONTEND_PUBLIC, 'company policies');
const ATT_URL = (process.env.ATTENDANCE_API_URL || 'http://localhost:5092/api').replace(/\/$/, '');
const PRIVILEGED = ['admin', 'hr', 'manager'];

/* ── employee sheet (cached, reloaded when the file changes) ─────────────── */
let empCache = { mtime: 0, list: [] };
function excelDate(v) {
  if (v == null || v === '') return '';
  if (typeof v === 'number') return new Date(Math.round((v - 25569) * 86400 * 1000)).toISOString().slice(0, 10);
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  return String(v).slice(0, 10);
}
function employees() {
  try {
    const st = fs.statSync(EMP_XLSX);
    if (st.mtimeMs === empCache.mtime) return empCache.list;
    const XLSX = require('xlsx');
    const wb = XLSX.readFile(EMP_XLSX, { cellDates: false });
    const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { defval: '' });
    const list = rows.map(r => ({
      code: String(r['Code'] || '').trim(),
      name: String(r['Name'] || '').trim(),
      designation: String(r['Designation'] || '').trim(),
      department: String(r['Department'] || '').trim(),
      location: String(r['Location'] || '').trim(),
      email: String(r['Email ID'] || '').trim(),
      mobile: String(r['Mobile No'] || '').trim(),
      joined: excelDate(r['DOJ']),
    })).filter(e => e.name && e.code);
    empCache = { mtime: st.mtimeMs, list };
    return list;
  } catch (e) {
    console.warn(`   ! AI: could not read ${EMP_XLSX} (${e.message})`);
    return empCache.list;
  }
}

const norm = (s) => String(s || '').toLowerCase().normalize('NFKD').replace(/[^a-z0-9@. ]/g, ' ').replace(/\s+/g, ' ').trim();
// Short filters ("IT", "HR") must match a whole word, so "IT" doesn't match "security"
const fieldMatch = (value, f) => (f.length <= 3 ? new RegExp(`(^| )${f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( |$)`).test(norm(value)) : norm(value).includes(f));

function searchEmployees({ query = '', department = '', location = '', designation = '', limit = 15 }) {
  const list = employees();
  const q = norm(query), dep = norm(department), loc = norm(location), des = norm(designation);
  const words = q.split(' ').filter(Boolean);
  const scored = [];
  for (const e of list) {
    if (dep && !fieldMatch(e.department, dep)) continue;
    if (loc && !fieldMatch(e.location, loc)) continue;
    if (des && !fieldMatch(e.designation, des)) continue;
    let score = 1;
    if (words.length) {
      const hay = norm(`${e.name} ${e.code} ${e.designation} ${e.department} ${e.location} ${e.email}`);
      if (!words.every(w => hay.includes(w))) continue;
      score = (norm(e.name) === q ? 100 : 0) + (norm(e.name).startsWith(q) ? 30 : 0) + (e.code === query.trim() ? 100 : 0) + words.filter(w => norm(e.name).includes(w)).length * 5;
    }
    scored.push({ e, score });
  }
  scored.sort((a, b) => b.score - a.score || a.e.name.localeCompare(b.e.name));
  const n = Math.max(1, Math.min(40, Number(limit) || 15));
  return { total_matches: scored.length, shown: Math.min(n, scored.length), employees: scored.slice(0, n).map(x => x.e) };
}

function directoryStats() {
  const list = employees();
  const count = (key) => Object.entries(list.reduce((m, e) => { const k = e[key] || '(blank)'; m[k] = (m[k] || 0) + 1; return m; }, {}))
    .sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ name, employees: n }));
  const cutoff = new Date(Date.now() - 30 * 86400000).toISOString().slice(0, 10);
  return { total_employees: list.length, by_department: count('department'), by_location: count('location'), joined_last_30_days: list.filter(e => e.joined && e.joined >= cutoff).length };
}

/* ── attendance (via backend-attendance) ─────────────────────────────────── */
async function attendanceToday({ site = '', emp_code = '' }, user) {
  const ctrl = new AbortController();
  const t = setTimeout(() => ctrl.abort(), 10000);
  let data;
  try {
    const r = await fetch(`${ATT_URL}/attendance`, { signal: ctrl.signal });
    data = await r.json();
  } catch (e) {
    return { error: 'The attendance system is not reachable right now.' };
  } finally { clearTimeout(t); }
  if (!data || !data.success || !Array.isArray(data.data)) return { error: 'No attendance data available.' };
  let rows = data.data.filter(x => x.inTime);
  if (site) rows = rows.filter(x => norm(x.inLocation).includes(norm(site)));
  const out = { date: data.date, present: new Set(rows.map(x => String(x.empCode))).size };
  const bySite = {};
  rows.forEach(x => { const s = x.inLocation || 'Other'; bySite[s] = (bySite[s] || 0) + 1; });
  out.by_site = Object.entries(bySite).sort((a, b) => b[1] - a[1]).map(([name, n]) => ({ site: name, present: n }));
  if (emp_code) {
    const code = String(emp_code).trim();
    const allowed = PRIVILEGED.includes(user.role) || code === String(user.empId || '').trim();
    if (!allowed) out.individual = { error: 'Employees can only see their own punch times. Totals are shown instead.' };
    else {
      const rec = data.data.find(x => String(x.empCode) === code);
      const emp = employees().find(e => e.code === code);
      out.individual = rec
        ? { code, name: emp?.name, in_time: rec.inTime, out_time: rec.outTime, in_site: rec.inLocation, out_site: rec.outLocation, punches: rec.totalPunches }
        : { code, name: emp?.name, status: 'No punch recorded today' };
    }
  }
  return out;
}

/* ── company updates (TV Display content) ────────────────────────────────── */
async function companyUpdates(getPool) {
  try {
    const p = await getPool();
    const r = await p.request().query(`SELECT Config FROM dbo.TvConfig WHERE Id=1`);
    const cfg = r.recordset[0] ? JSON.parse(r.recordset[0].Config) : {};
    const today = new Date().toISOString().slice(0, 10);
    const active = (a) => (!a.from || a.from <= today) && (!a.until || a.until >= today);
    const star = cfg.star || {};
    const stars = Array.isArray(star.people) ? star.people : (star.name ? [star] : []);
    return {
      announcements: (cfg.announcements || []).filter(a => (a.title || a.body) && active(a)).map(a => ({ title: a.title, message: a.body, from: a.from || null, until: a.until || null })),
      upcoming_events: (cfg.events || []).filter(e => e.title && e.date && e.date >= today).map(e => ({ title: e.title, date: e.date, time: e.time, place: e.place })),
      stars_of_the_month: star.on ? stars.filter(s => s.name).map(s => ({ name: s.name, designation: s.role, department: s.dept, reason: s.reason })) : [],
      birthdays_entered_by_hr: (cfg.birthdays || []).filter(b => b.name).map(b => ({ name: b.name, department: b.dept, date: b.date })),
      ticker: (cfg.ticker || []).filter(Boolean),
    };
  } catch (e) {
    return { error: 'Company updates are not available right now.' };
  }
}

/* ── policies (PDF text, cached) ─────────────────────────────────────────── */
let policyCache = null;
const policyName = (f) => f.replace(/^_\d+_\d+_[0-9a-f]{16}_/i, '').replace(/\.pdf$/i, '').replace(/\.xlsx$/i, '').trim();
async function policies() {
  if (policyCache) return policyCache;
  const out = [];
  try {
    // pdf.js prints a harmless warning about the optional "canvas" module in Node — keep the log clean
    const warn = console.warn, log = console.log;
    console.warn = () => {}; console.log = () => {};
    let pdfjs;
    try { pdfjs = require('pdfjs-dist/legacy/build/pdf.js'); } finally { console.warn = warn; console.log = log; }
    pdfjs.GlobalWorkerOptions.workerSrc = require.resolve('pdfjs-dist/legacy/build/pdf.worker.js');
    for (const f of fs.readdirSync(POLICY_DIR).filter(x => /\.pdf$/i.test(x))) {
      try {
        const doc = await pdfjs.getDocument({ data: new Uint8Array(fs.readFileSync(path.join(POLICY_DIR, f))), disableFontFace: true, isEvalSupported: false, verbosity: 0 }).promise;
        let text = '';
        for (let i = 1; i <= doc.numPages; i++) {
          const c = await (await doc.getPage(i)).getTextContent();
          text += c.items.map(x => x.str).join(' ') + '\n';
        }
        out.push({ name: policyName(f), file: f, text: text.replace(/[ \t]+/g, ' ').trim() });
      } catch (e) { out.push({ name: policyName(f), file: f, text: '' }); }
    }
  } catch (e) { console.warn(`   ! AI: could not read policies (${e.message})`); }
  policyCache = out;
  return out;
}
async function readPolicy({ name = '', question = '' }) {
  const list = await policies();
  const want = norm(name);
  const STOP = new Set(['policy', 'policies', 'the', 'of', 'for', 'and', 'swd', 'smartworld', 'smart', 'world']);
  const words = want.split(' ').filter(w => w.length >= 2 && !STOP.has(w));
  const score = (p) => {
    const n = norm(p.name);
    if (n === want) return 100;
    if (want && n.includes(want)) return 50;
    return words.reduce((t, w) => t + (fieldMatch(p.name, w) ? 3 : n.includes(w) ? 1 : 0), 0);
  };
  const scored = list.map(p => ({ p, s: score(p) })).sort((a, b) => b.s - a.s);
  const hit = scored[0] && scored[0].s > 0 ? scored[0].p : null;
  if (!hit) return { error: `No policy matches "${name}".`, available: list.map(p => p.name) };
  if (!hit.text) return { policy: hit.name, error: 'This PDF has no readable text (it may be scanned).' };
  if (hit.text.length <= 14000) return { policy: hit.name, file: hit.file, text: hit.text };
  // Long policy: return the parts most related to the question
  const chunks = hit.text.match(/[\s\S]{1,1600}(\s|$)/g) || [];
  const qw = norm(question).split(' ').filter(w => w.length > 3);
  const ranked = chunks.map((c, i) => ({ c, i, s: qw.filter(w => norm(c).includes(w)).length })).sort((a, b) => b.s - a.s || a.i - b.i).slice(0, 7).sort((a, b) => a.i - b.i);
  return { policy: hit.name, file: hit.file, note: 'Long policy — most relevant sections only.', text: ranked.map(x => x.c.trim()).join('\n…\n') };
}

/* ── tool definitions ────────────────────────────────────────────────────── */
const TOOLS = [
  {
    name: 'search_employees',
    description: 'Search the Smart World employee directory. Use for any question about a person (contact, designation, department, location, joining date) or to list/count people in a department, location or role. Returns matching employees and the total number of matches.',
    input_schema: { type: 'object', properties: {
      query: { type: 'string', description: 'Name, employee code, email or keywords. Leave empty to list by filters only.' },
      department: { type: 'string', description: 'Filter: department contains this text (e.g. "IT", "Human Resources")' },
      location: { type: 'string', description: 'Filter: location contains this text (e.g. "Gurugram", "IFC")' },
      designation: { type: 'string', description: 'Filter: designation contains this text (e.g. "Manager")' },
      limit: { type: 'integer', description: 'Max people to return (default 15, max 40)' },
    } },
  },
  { name: 'directory_stats', description: 'Headcount totals: total employees, counts per department and per location, and joiners in the last 30 days.', input_schema: { type: 'object', properties: {} } },
  {
    name: 'attendance_today',
    description: "Today's live biometric attendance: how many people are present overall and per site. With emp_code, the punch-in/out of one person — allowed only for the asking employee's own code, or for HR/admin/managers.",
    input_schema: { type: 'object', properties: { site: { type: 'string', description: 'Optional site filter, e.g. "IFC 14th Floor", "Smart 66"' }, emp_code: { type: 'string', description: 'Optional employee code for one person' } } },
  },
  { name: 'company_updates', description: 'Current HR announcements, upcoming company events, stars of the month and birthdays entered by HR.', input_schema: { type: 'object', properties: {} } },
  { name: 'list_policies', description: 'List the company policy documents available.', input_schema: { type: 'object', properties: {} } },
  {
    name: 'read_policy',
    description: 'Read a company policy document (leave, attendance, working hours, dress code, travel, conveyance, referral, IT, code of conduct, POSH, whistleblower, holiday lists, flexible work…). Always use this before answering a policy question, and quote the rule.',
    input_schema: { type: 'object', properties: { name: { type: 'string', description: 'Policy name or keywords, e.g. "Leave Policy"' }, question: { type: 'string', description: 'What the user wants to know (used to pick sections of long policies)' } }, required: ['name'] },
  },
  {
    name: 'suggest_page',
    description: 'Offer the user a button to open a SmartDesk page that helps with their question. Call at most twice per answer.',
    input_schema: { type: 'object', properties: { page: { type: 'string', enum: ['home', 'directory', 'attendance', 'policies', 'holiday-calendar', 'dashboard', 'tools', 'tv'] }, label: { type: 'string', description: 'Short button text, e.g. "Open Live Attendance"' } }, required: ['page'] },
  },
];

function systemPrompt(user, ctx) {
  const now = new Date();
  const date = now.toLocaleString('en-IN', { timeZone: 'Asia/Kolkata', weekday: 'long', day: 'numeric', month: 'long', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  const holidays = (ctx.holidays || []).map(h => `${h.date} ${h.name}`).join('; ');
  const tabs = (ctx.tabs || []).join(', ');
  return `You are SmartDesk AI, the search assistant inside SmartDesk — the internal employee portal of Smart World Developers, a real-estate developer in Gurugram, India (projects include Sky Arc, The Edition, One DXP, Orchard and Gems; offices include IFC Gurugram).

Now: ${date} (India time).
The person asking: ${user.name || 'an employee'} (role: ${user.role || 'employee'}${user.empId ? `, employee code ${user.empId}` : ''}).
SmartDesk pages they can open: ${tabs || 'home, directory, attendance, policies, holiday-calendar, tools'}.
Company holidays this year: ${holidays || 'see the Holiday Calendar page'}.

How to answer:
- Use the tools for anything about Smart World: people, headcount, attendance, announcements, events, policies. Never guess employee details or policy rules — look them up, and say so plainly if the data does not have it.
- For policy questions, read the policy and answer with the specific rule (numbers, days, amounts), naming the policy.
- Use web search for current outside information (weather, news, prices, traffic, general facts that may have changed). Default location: Gurugram, Haryana, India.
- Answer the question directly first, in 1–4 short sentences or a short bullet list. Use **bold** for key facts. No preamble, no "As an AI".
- When listing people, give name, designation and department; include phone/email only if asked.
- Attendance: anyone may see totals; individual punch times only for the asker's own code or for HR/admin/managers.
- If a SmartDesk page would help, call suggest_page.
- Answer in the user's language (English or Hindi/Hinglish).`;
}

/* ── Claude call loop ────────────────────────────────────────────────────── */
async function callClaude(body) {
  const r = await fetch(API_URL, {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'x-api-key': process.env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01' },
    body: JSON.stringify(body),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (j.error && j.error.message) || `Claude API error ${r.status}`;
    const err = new Error(msg); err.status = r.status; throw err;
  }
  return j;
}

async function ask(args, user, getPool) {
  // No Claude key → free engine (SmartDesk data + free web sources, optional free Groq/Gemini key)
  if (!process.env.ANTHROPIC_API_KEY) return askFree(freeEngine(getPool), args, user);
  try { return await askClaude(args, user, getPool); }
  catch (e) {
    console.warn(`   ! AI (Claude): ${e.message} — answering with the free engine instead`);
    return askFree(freeEngine(getPool), args, user);
  }
}

let _free = null;
function freeEngine(getPool) {
  if (!_free) _free = createFreeEngine({ employees, searchEmployees, directoryStats, attendanceToday, companyUpdates: () => companyUpdates(getPool), policies });
  return _free;
}
function aiMode() {
  if (process.env.ANTHROPIC_API_KEY) return { mode: 'claude', label: 'Claude', model: MODEL };
  const c = llmConfig();
  return c ? { mode: 'free-llm', label: c.name, model: c.model } : { mode: 'free', label: 'SmartDesk', model: 'smartdesk-free' };
}

async function askClaude({ question, history = [], context = {} }, user, getPool) {
  const people = new Map(), actions = [], used = new Set();
  const messages = [];
  (Array.isArray(history) ? history : []).slice(-6).forEach(h => {
    if (h && (h.role === 'user' || h.role === 'assistant') && typeof h.content === 'string' && h.content.trim()) messages.push({ role: h.role, content: h.content.slice(0, 4000) });
  });
  while (messages.length && messages[0].role !== 'user') messages.shift();
  messages.push({ role: 'user', content: String(question).slice(0, 2000) });

  const tools = [
    ...TOOLS,
    { type: 'web_search_20250305', name: 'web_search', max_uses: 3, user_location: { type: 'approximate', city: 'Gurugram', region: 'Haryana', country: 'IN', timezone: 'Asia/Kolkata' } },
  ];
  const run = async (name, input) => {
    used.add(name);
    switch (name) {
      case 'search_employees': {
        const r = searchEmployees(input || {});
        r.employees.slice(0, 8).forEach(e => people.set(e.code, e));
        return r;
      }
      case 'directory_stats': return directoryStats();
      case 'attendance_today': return attendanceToday(input || {}, user);
      case 'company_updates': return companyUpdates(getPool);
      case 'list_policies': return { policies: (await policies()).map(p => p.name) };
      case 'read_policy': return readPolicy(input || {});
      case 'suggest_page': if (input && input.page && actions.length < 2 && !actions.some(a => a.page === input.page)) actions.push({ page: input.page, label: input.label || '' }); return { ok: true };
      default: return { error: `Unknown tool ${name}` };
    }
  };

  let res;
  for (let step = 0; step < 8; step++) {
    res = await callClaude({ model: MODEL, max_tokens: 4000, system: systemPrompt(user, context), messages, tools, output_config: { effort: EFFORT } });
    if (res.stop_reason === 'pause_turn') { messages.push({ role: 'assistant', content: res.content }); continue; }
    if (res.stop_reason !== 'tool_use') break;
    messages.push({ role: 'assistant', content: res.content });
    const results = [];
    for (const b of res.content) {
      if (b.type !== 'tool_use') continue;
      let out;
      try { out = await run(b.name, b.input); } catch (e) { out = { error: e.message }; }
      results.push({ type: 'tool_result', tool_use_id: b.id, content: JSON.stringify(out).slice(0, 60000) });
    }
    messages.push({ role: 'user', content: results });
  }

  // Final text + web citations
  const blocks = (res && res.content) || [];
  let answer = '';
  const cites = new Map();
  for (const b of blocks) {
    if (b.type === 'text') {
      answer += b.text;
      (b.citations || []).forEach(c => { if (c.url && !cites.has(c.url)) cites.set(c.url, { url: c.url, title: c.title || c.url }); });
    }
    if (b.type === 'server_tool_use' && b.name === 'web_search') used.add('web_search');
  }
  return {
    answer: answer.trim() || 'Sorry, I could not find an answer to that.',
    sources: [...cites.values()].slice(0, 6),
    people: [...people.values()].slice(0, 8).map(e => ({ code: e.code, name: e.name, designation: e.designation, department: e.department, location: e.location })),
    actions,
    used: [...used],
    model: res && res.model,
  };
}

/* ── express routes ──────────────────────────────────────────────────────── */
function mountAi(app, { getPool }) {
  const hits = new Map(); // simple per-user rate limit: 20 questions / minute
  app.get('/api/ai/status', (req, res) => res.json({ success: true, enabled: true, ...aiMode() }));
  app.post('/api/ai/ask', async (req, res) => {
    const user = { role: String(req.headers['x-user-role'] || '').toLowerCase(), empId: String(req.headers['x-user-id'] || ''), name: String((req.body && req.body.context && req.body.context.userName) || '') };
    if (!user.role) return res.status(401).json({ success: false, error: 'Please sign in to SmartDesk first.' });
    const key = user.empId || req.ip;
    const now = Date.now();
    const list = (hits.get(key) || []).filter(t => now - t < 60000);
    if (list.length >= 20) return res.status(429).json({ success: false, error: 'Too many questions in a minute — please wait a moment.' });
    list.push(now); hits.set(key, list);
    const question = String((req.body && req.body.question) || '').trim();
    if (!question) return res.status(400).json({ success: false, error: 'Ask a question.' });
    try {
      const out = await ask({ question, history: req.body.history, context: req.body.context || {} }, user, getPool);
      res.json({ success: true, ...out });
    } catch (e) {
      console.warn(`   ! AI: ${e.message}`);
      res.status(e.status && e.status < 600 ? (e.status === 401 ? 502 : e.status) : 500).json({ success: false, error: e.status === 401 ? 'The Anthropic API key was rejected — check ANTHROPIC_API_KEY in .env.' : e.message });
    }
  });
  // Warm the policy text in the background so the first question is fast
  setTimeout(() => { policies().then(p => { const m = aiMode(); console.log(`   AI: ${p.length} policy documents ready · answers by ${m.mode === 'free' ? 'built-in engine + free web sources (Wikipedia, DuckDuckGo, Open-Meteo, Google News)' : `${m.label} (${m.model})`}`); }).catch(() => {}); }, 2000);
}

module.exports = { mountAi, searchEmployees, directoryStats, readPolicy, policies, employees, freeEngine };
