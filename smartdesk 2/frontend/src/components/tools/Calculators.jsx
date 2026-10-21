import React, { useMemo, useState } from 'react';
import { Calculator, IndianRupee, Percent, Landmark, Ruler, Copy, Check } from 'lucide-react';
import { Field, Panel, Segmented, ToolHeader, card, font, inputStyle } from './shared';

/* ── Indian number helpers ──────────────────────────────────────────────── */
const ONES = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten', 'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
const two = (n) => (n < 20 ? ONES[n] : `${TENS[Math.floor(n / 10)]}${n % 10 ? '-' + ONES[n % 10] : ''}`);
const three = (n) => [n >= 100 ? `${ONES[Math.floor(n / 100)]} Hundred` : '', two(n % 100)].filter(Boolean).join(' ');

/** Whole number → words in the Indian system (crore / lakh / thousand). */
export function intToWords(num) {
  let n = Math.floor(Math.abs(num));
  if (n === 0) return 'Zero';
  const parts = [];
  const crore = Math.floor(n / 1e7); n %= 1e7;
  const lakh = Math.floor(n / 1e5); n %= 1e5;
  const thousand = Math.floor(n / 1e3); n %= 1e3;
  if (crore) parts.push(`${crore >= 100 ? intToWords(crore) : two(crore) || intToWords(crore)} Crore`);
  if (lakh) parts.push(`${two(lakh)} Lakh`);
  if (thousand) parts.push(`${two(thousand)} Thousand`);
  if (n) parts.push(three(n));
  return parts.join(' ');
}

/** 1245000.5 → "Rupees Twelve Lakh Forty-Five Thousand and Fifty Paise Only" */
export function amountInWords(value) {
  const v = Math.round(Math.abs(Number(value) || 0) * 100) / 100;
  const rupees = Math.floor(v), paise = Math.round((v - rupees) * 100);
  const r = rupees ? `Rupees ${intToWords(rupees)}` : '';
  const p = paise ? `${two(paise)} Paise` : '';
  return `${[r, p].filter(Boolean).join(' and ') || 'Rupees Zero'} Only`;
}
export const inr = (n, dp = 2) => Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: dp, maximumFractionDigits: dp });
const num = (s) => { const v = parseFloat(String(s).replace(/,/g, '')); return Number.isFinite(v) ? v : 0; };

/* ── UI bits ─────────────────────────────────────────────────────────────── */
const CopyBtn = ({ text }) => {
  const [ok, setOk] = useState(false);
  return (
    <button type="button" title="Copy" onClick={() => { navigator.clipboard?.writeText(text).then(() => { setOk(true); setTimeout(() => setOk(false), 1400); }); }}
      style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)', color: ok ? 'var(--success)' : 'var(--text-muted)', cursor: 'pointer', fontFamily: font.body, fontSize: '.74rem', fontWeight: 600 }}>
      {ok ? <Check size={13} /> : <Copy size={13} />}{ok ? 'Copied' : 'Copy'}
    </button>
  );
};
const Stat = ({ label, value, strong, color }) => (
  <div style={{ ...card, boxShadow: 'none', padding: '12px 14px', background: strong ? 'color-mix(in srgb, var(--accent) 7%, var(--bg-card))' : 'var(--bg-card)' }}>
    <div style={{ fontFamily: font.body, fontSize: '.7rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</div>
    <div style={{ fontFamily: font.head, fontWeight: 800, fontSize: strong ? '1.35rem' : '1.1rem', color: color || 'var(--text-primary)', marginTop: 3, fontVariantNumeric: 'tabular-nums', wordBreak: 'break-word' }}>{value}</div>
  </div>
);
const grid = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(180px,1fr))', gap: 12 };

/* ── Amount in words ─────────────────────────────────────────────────────── */
const AmountWords = () => {
  const [amt, setAmt] = useState('1245000');
  const words = amountInWords(num(amt));
  return (
    <Panel title="Amount in words (₹)">
      <div style={{ ...grid, marginBottom: 14 }}>
        <Field label="Amount (₹)"><input style={{ ...inputStyle, fontSize: '1rem', fontWeight: 700 }} inputMode="decimal" value={amt} onChange={e => setAmt(e.target.value)} /></Field>
        <Stat label="Formatted" value={`₹ ${inr(num(amt))}`} />
      </div>
      <div style={{ ...card, boxShadow: 'none', padding: '14px 16px', display: 'flex', gap: 12, alignItems: 'flex-start', background: 'color-mix(in srgb, var(--accent) 6%, var(--bg-card))' }}>
        <div style={{ flex: 1, fontFamily: font.head, fontWeight: 700, fontSize: '1rem', color: 'var(--text-primary)', lineHeight: 1.5 }}>{words}</div>
        <CopyBtn text={words} />
      </div>
      <div style={{ fontFamily: font.body, fontSize: '.74rem', color: 'var(--text-muted)', marginTop: 8 }}>For cheques, NFAs, POs and invoices. Uses lakh / crore.</div>
    </Panel>
  );
};

/* ── GST ─────────────────────────────────────────────────────────────────── */
const Gst = () => {
  const [amt, setAmt] = useState('100000');
  const [rate, setRate] = useState('18');
  const [custom, setCustom] = useState('');
  const [mode, setMode] = useState('add');
  const [supply, setSupply] = useState('intra');
  const r = num(rate === 'custom' ? custom : rate);
  const a = num(amt);
  const base = mode === 'add' ? a : a / (1 + r / 100);
  const tax = base * r / 100;
  const total = base + tax;
  return (
    <Panel title="GST calculator">
      <div style={{ ...grid, marginBottom: 14, alignItems: 'end' }}>
        <Field label={mode === 'add' ? 'Amount before GST (₹)' : 'Amount including GST (₹)'}><input style={inputStyle} inputMode="decimal" value={amt} onChange={e => setAmt(e.target.value)} /></Field>
        <Field label="GST rate">
          <div style={{ display: 'flex', gap: 6 }}>
            <select style={inputStyle} value={rate} onChange={e => setRate(e.target.value)}>{['0', '3', '5', '12', '18', '28'].map(x => <option key={x} value={x}>{x}%</option>)}<option value="custom">Other…</option></select>
            {rate === 'custom' && <input style={{ ...inputStyle, width: 80 }} value={custom} onChange={e => setCustom(e.target.value)} placeholder="%" />}
          </div>
        </Field>
      </div>
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        <Segmented value={mode} onChange={setMode} options={[{ value: 'add', label: 'Add GST' }, { value: 'remove', label: 'Remove GST (amount includes GST)' }]} />
        <Segmented value={supply} onChange={setSupply} options={[{ value: 'intra', label: 'Same state (CGST + SGST)' }, { value: 'inter', label: 'Other state (IGST)' }]} />
      </div>
      <div style={grid}>
        <Stat label="Taxable value" value={`₹ ${inr(base)}`} />
        {supply === 'intra' ? <>
          <Stat label={`CGST @ ${r / 2}%`} value={`₹ ${inr(tax / 2)}`} />
          <Stat label={`SGST @ ${r / 2}%`} value={`₹ ${inr(tax / 2)}`} />
        </> : <Stat label={`IGST @ ${r}%`} value={`₹ ${inr(tax)}`} />}
        <Stat label="Total GST" value={`₹ ${inr(tax)}`} color="var(--warning)" />
        <Stat label="Total amount" value={`₹ ${inr(total)}`} strong color="var(--accent)" />
      </div>
      <div style={{ fontFamily: font.body, fontSize: '.78rem', color: 'var(--text-secondary)', marginTop: 10, display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
        <span style={{ flex: 1 }}>{amountInWords(total)}</span><CopyBtn text={`₹ ${inr(total)} (${amountInWords(total)})`} />
      </div>
    </Panel>
  );
};

/* ── EMI ─────────────────────────────────────────────────────────────────── */
const Emi = () => {
  const [p, setP] = useState('5000000');
  const [rate, setRate] = useState('8.5');
  const [years, setYears] = useState('20');
  const P = num(p), annual = num(rate), n = Math.round(num(years) * 12);
  const res = useMemo(() => {
    if (!P || !n) return null;
    const i = annual / 12 / 100;
    const emi = i ? (P * i * (1 + i) ** n) / ((1 + i) ** n - 1) : P / n;
    const rows = []; let bal = P;
    for (let y = 1; y <= Math.ceil(n / 12); y++) {
      let pr = 0, int = 0;
      for (let m = 0; m < 12 && (y - 1) * 12 + m < n; m++) { const it = bal * i; const pp = emi - it; int += it; pr += pp; bal = Math.max(0, bal - pp); }
      rows.push({ y, pr, int, bal });
    }
    return { emi, total: emi * n, interest: emi * n - P, rows };
  }, [P, annual, n]);
  return (
    <Panel title="Loan EMI calculator">
      <div style={{ ...grid, marginBottom: 14 }}>
        <Field label="Loan amount (₹)" hint={P ? `₹ ${inr(P, 0)}` : ''}><input style={inputStyle} inputMode="decimal" value={p} onChange={e => setP(e.target.value)} /></Field>
        <Field label="Interest rate (% per year)"><input style={inputStyle} inputMode="decimal" value={rate} onChange={e => setRate(e.target.value)} /></Field>
        <Field label="Tenure (years)" hint={n ? `${n} months` : ''}><input style={inputStyle} inputMode="decimal" value={years} onChange={e => setYears(e.target.value)} /></Field>
      </div>
      {res && <>
        <div style={grid}>
          <Stat label="Monthly EMI" value={`₹ ${inr(res.emi, 0)}`} strong color="var(--accent)" />
          <Stat label="Total interest" value={`₹ ${inr(res.interest, 0)}`} color="var(--warning)" />
          <Stat label="Total payment" value={`₹ ${inr(res.total, 0)}`} />
        </div>
        <div style={{ margin: '14px 0 6px', height: 10, borderRadius: 5, overflow: 'hidden', display: 'flex', background: 'var(--chart-track)' }} title="Principal vs interest">
          <div style={{ width: `${(P / res.total) * 100}%`, background: 'var(--chart-1)' }} /><div style={{ flex: 1, background: 'var(--chart-3)' }} />
        </div>
        <div style={{ display: 'flex', gap: 16, fontFamily: font.body, fontSize: '.74rem', color: 'var(--text-muted)', marginBottom: 12 }}>
          <span><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: 'var(--chart-1)', marginRight: 5 }} />Principal {Math.round((P / res.total) * 100)}%</span>
          <span><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: 'var(--chart-3)', marginRight: 5 }} />Interest {Math.round((res.interest / res.total) * 100)}%</span>
        </div>
        <div style={{ maxHeight: 280, overflowY: 'auto', border: '1px solid var(--border)', borderRadius: 10 }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: font.body, fontSize: '.78rem', fontVariantNumeric: 'tabular-nums' }}>
            <thead style={{ position: 'sticky', top: 0, background: 'var(--bg-elevated)' }}><tr>{['Year', 'Principal paid', 'Interest paid', 'Balance'].map(h => <th key={h} style={{ textAlign: h === 'Year' ? 'left' : 'right', padding: '8px 12px', color: 'var(--text-muted)', fontWeight: 700 }}>{h}</th>)}</tr></thead>
            <tbody>{res.rows.map(r => <tr key={r.y} style={{ borderTop: '1px solid var(--chart-grid)' }}><td style={{ padding: '6px 12px', color: 'var(--text-secondary)' }}>{r.y}</td><td style={{ padding: '6px 12px', textAlign: 'right', color: 'var(--text-primary)' }}>₹ {inr(r.pr, 0)}</td><td style={{ padding: '6px 12px', textAlign: 'right', color: 'var(--text-primary)' }}>₹ {inr(r.int, 0)}</td><td style={{ padding: '6px 12px', textAlign: 'right', color: 'var(--text-primary)' }}>₹ {inr(r.bal, 0)}</td></tr>)}</tbody>
          </table>
        </div>
      </>}
    </Panel>
  );
};

/* ── Area ────────────────────────────────────────────────────────────────── */
// square metres per unit
const AREA = [
  { k: 'sqft', label: 'Square feet (sq ft)', m2: 0.09290304 },
  { k: 'sqm', label: 'Square metres (sq m)', m2: 1 },
  { k: 'sqyd', label: 'Square yards / Gaj (sq yd)', m2: 0.83612736 },
  { k: 'acre', label: 'Acre', m2: 4046.8564224 },
  { k: 'hectare', label: 'Hectare', m2: 10000 },
  { k: 'kanal', label: 'Kanal (Haryana/Punjab)', m2: 505.857 },
  { k: 'marla', label: 'Marla (Haryana/Punjab)', m2: 25.2929 },
  { k: 'sqkm', label: 'Square kilometre', m2: 1e6 },
];
const Area = () => {
  const [val, setVal] = useState('1000');
  const [unit, setUnit] = useState('sqft');
  const m2 = num(val) * AREA.find(u => u.k === unit).m2;
  const fmt = (x) => (x >= 100 ? inr(x, 2) : x >= 1 ? x.toLocaleString('en-IN', { maximumFractionDigits: 4 }) : x.toLocaleString('en-IN', { maximumSignificantDigits: 5 }));
  return (
    <Panel title="Area converter">
      <div style={{ ...grid, marginBottom: 14 }}>
        <Field label="Value"><input style={{ ...inputStyle, fontSize: '1rem', fontWeight: 700 }} inputMode="decimal" value={val} onChange={e => setVal(e.target.value)} /></Field>
        <Field label="Unit"><select style={inputStyle} value={unit} onChange={e => setUnit(e.target.value)}>{AREA.map(u => <option key={u.k} value={u.k}>{u.label}</option>)}</select></Field>
      </div>
      <div style={grid}>
        {AREA.filter(u => u.k !== unit).map(u => <Stat key={u.k} label={u.label} value={fmt(m2 / u.m2)} />)}
      </div>
      <div style={{ fontFamily: font.body, fontSize: '.74rem', color: 'var(--text-muted)', marginTop: 10 }}>Kanal/Marla use the Haryana–Punjab standard (1 kanal = 20 marla = 5,445 sq ft). Bigha varies by state, so it isn't included.</div>
    </Panel>
  );
};

/* ── Container ───────────────────────────────────────────────────────────── */
const TABS = [
  { value: 'words', label: 'Amount in words', icon: IndianRupee, C: AmountWords },
  { value: 'gst', label: 'GST', icon: Percent, C: Gst },
  { value: 'emi', label: 'EMI', icon: Landmark, C: Emi },
  { value: 'area', label: 'Area', icon: Ruler, C: Area },
];
const Calculators = ({ onBack }) => {
  const [tab, setTab] = useState('words');
  const T = TABS.find(t => t.value === tab).C;
  return (
    <div style={{ paddingBottom: 32 }}>
      <ToolHeader icon={Calculator} color="var(--chart-3)" title="Calculators" subtitle="Amount in words, GST, loan EMI and land-area conversions." onBack={onBack} />
      <div style={{ marginBottom: 14 }}><Segmented value={tab} onChange={setTab} options={TABS} /></div>
      <T />
    </div>
  );
};

export default Calculators;
