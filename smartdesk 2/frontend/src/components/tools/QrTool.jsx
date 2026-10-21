import React, { useEffect, useMemo, useState } from 'react';
import { QrCode, Download, Link2, Wifi, Contact, Phone, Mail, MessageCircle, Type } from 'lucide-react';
import { downloadBlob } from '../../services/converter';
import { Btn, Field, Notice, Panel, Segmented, ToolHeader, card, font, inputStyle } from './shared';

const TYPES = [
  { value: 'url', label: 'Website', icon: Link2 },
  { value: 'text', label: 'Text', icon: Type },
  { value: 'wifi', label: 'Wi-Fi', icon: Wifi },
  { value: 'vcard', label: 'Contact card', icon: Contact },
  { value: 'whatsapp', label: 'WhatsApp', icon: MessageCircle },
  { value: 'phone', label: 'Phone', icon: Phone },
  { value: 'email', label: 'Email', icon: Mail },
];

const esc = (s) => String(s || '').replace(/([\\;,:"])/g, '\\$1'); // Wi-Fi / vCard escaping
const digits = (s) => String(s || '').replace(/[^\d+]/g, '');

function buildPayload(type, d) {
  switch (type) {
    case 'url': { const u = d.url.trim(); return u && !/^[a-z]+:\/\//i.test(u) ? `https://${u}` : u; }
    case 'text': return d.text;
    case 'wifi': return d.ssid ? `WIFI:T:${d.security};S:${esc(d.ssid)};${d.security !== 'nopass' ? `P:${esc(d.password)};` : ''}${d.hidden ? 'H:true;' : ''};` : '';
    case 'vcard': return (d.name || d.mobile || d.email) ? [
      'BEGIN:VCARD', 'VERSION:3.0', `N:${esc(d.name.split(' ').slice(-1)[0] || '')};${esc(d.name.split(' ').slice(0, -1).join(' '))};;;`, `FN:${esc(d.name)}`,
      d.company && `ORG:${esc(d.company)}`, d.title && `TITLE:${esc(d.title)}`, d.mobile && `TEL;TYPE=CELL:${digits(d.mobile)}`,
      d.office && `TEL;TYPE=WORK:${digits(d.office)}`, d.email && `EMAIL:${d.email}`, d.website && `URL:${d.website}`, d.address && `ADR;TYPE=WORK:;;${esc(d.address)};;;;`, 'END:VCARD',
    ].filter(Boolean).join('\n') : '';
    case 'whatsapp': { const n = digits(d.wa).replace(/^\+/, ''); return n ? `https://wa.me/${n.length === 10 ? '91' + n : n}${d.waText ? `?text=${encodeURIComponent(d.waText)}` : ''}` : ''; }
    case 'phone': return d.tel ? `tel:${digits(d.tel)}` : '';
    case 'email': return d.to ? `mailto:${d.to}${(d.subject || d.body) ? `?subject=${encodeURIComponent(d.subject || '')}&body=${encodeURIComponent(d.body || '')}` : ''}` : '';
    default: return '';
  }
}

const QrTool = ({ onBack }) => {
  const [type, setType] = useState('url');
  const [d, setD] = useState({
    url: 'https://smartworlddevelopers.com/', text: '', ssid: '', password: '', security: 'WPA', hidden: false,
    name: '', company: 'Smart World Developers', title: '', mobile: '', office: '', email: '', website: 'https://smartworlddevelopers.com', address: '',
    wa: '', waText: '', tel: '', to: '', subject: '', body: '',
  });
  const [style, setStyle] = useState({ size: 512, fg: '#0a1628', bg: '#ffffff', ecl: 'M', margin: 2, label: '' });
  const [png, setPng] = useState('');
  const [error, setError] = useState('');
  const payload = useMemo(() => buildPayload(type, d), [type, d]);
  const set = (k) => (e) => setD(x => ({ ...x, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));
  const setS = (k) => (e) => setStyle(x => ({ ...x, [k]: e.target.value }));

  useEffect(() => {
    let cancel = false;
    if (!payload) { setPng(''); setError(''); return undefined; }
    (async () => {
      try {
        const QR = (await import('qrcode')).default;
        const url = await QR.toDataURL(payload, { width: Number(style.size), margin: Number(style.margin), errorCorrectionLevel: style.ecl, color: { dark: style.fg, light: style.bg } });
        if (!cancel) { setPng(url); setError(''); }
      } catch (e) { if (!cancel) { setPng(''); setError(/too big|amount of data/i.test(e.message) ? 'Too much text for one QR code — shorten it.' : e.message); } }
    })();
    return () => { cancel = true; };
  }, [payload, style]);

  // PNG with an optional caption under the code (e.g. "Scan for Wi-Fi")
  const downloadPng = async () => {
    const img = new Image(); img.src = png; await img.decode();
    const pad = style.label ? Math.round(img.width * 0.14) : 0;
    const c = document.createElement('canvas'); c.width = img.width; c.height = img.height + pad;
    const ctx = c.getContext('2d'); ctx.fillStyle = style.bg; ctx.fillRect(0, 0, c.width, c.height); ctx.drawImage(img, 0, 0);
    if (style.label) { ctx.fillStyle = style.fg; ctx.font = `600 ${Math.round(pad * 0.45)}px "Plus Jakarta Sans", Arial, sans-serif`; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(style.label, c.width / 2, img.height + pad / 2 - pad * 0.1); }
    c.toBlob(b => downloadBlob(b, `qr-${type}.png`), 'image/png');
  };
  const downloadSvg = async () => {
    const QR = (await import('qrcode')).default;
    const svg = await QR.toString(payload, { type: 'svg', margin: Number(style.margin), errorCorrectionLevel: style.ecl, color: { dark: style.fg, light: style.bg } });
    downloadBlob(new Blob([svg], { type: 'image/svg+xml' }), `qr-${type}.svg`);
  };

  const row = { display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(200px,1fr))', gap: 14 };
  return (
    <div style={{ paddingBottom: 32 }}>
      <ToolHeader icon={QrCode} color="var(--chart-1)" title="QR Code Generator" subtitle="For websites, Wi-Fi, contact cards, WhatsApp, phone and email — download as PNG or SVG." onBack={onBack} />
      <div style={{ marginBottom: 14 }}><Segmented value={type} onChange={setType} options={TYPES} /></div>

      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0,1fr) 340px', gap: 16, alignItems: 'start' }} className="qr-grid">
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Panel title="Content">
            {type === 'url' && <Field label="Website address"><input style={inputStyle} value={d.url} onChange={set('url')} placeholder="https://…" /></Field>}
            {type === 'text' && <Field label="Text"><textarea style={{ ...inputStyle, minHeight: 110, resize: 'vertical' }} value={d.text} onChange={set('text')} /></Field>}
            {type === 'wifi' && <div style={row}>
              <Field label="Network name (SSID)"><input style={inputStyle} value={d.ssid} onChange={set('ssid')} /></Field>
              <Field label="Security"><select style={inputStyle} value={d.security} onChange={set('security')}><option value="WPA">WPA / WPA2 / WPA3</option><option value="WEP">WEP</option><option value="nopass">None (open)</option></select></Field>
              {d.security !== 'nopass' && <Field label="Password"><input style={inputStyle} value={d.password} onChange={set('password')} /></Field>}
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontFamily: font.body, fontSize: '.82rem', color: 'var(--text-secondary)' }}><input type="checkbox" checked={d.hidden} onChange={set('hidden')} />Hidden network</label>
            </div>}
            {type === 'vcard' && <div style={row}>
              <Field label="Full name"><input style={inputStyle} value={d.name} onChange={set('name')} /></Field>
              <Field label="Designation"><input style={inputStyle} value={d.title} onChange={set('title')} /></Field>
              <Field label="Company"><input style={inputStyle} value={d.company} onChange={set('company')} /></Field>
              <Field label="Mobile"><input style={inputStyle} value={d.mobile} onChange={set('mobile')} placeholder="+91…" /></Field>
              <Field label="Office phone"><input style={inputStyle} value={d.office} onChange={set('office')} /></Field>
              <Field label="Email"><input style={inputStyle} value={d.email} onChange={set('email')} /></Field>
              <Field label="Website"><input style={inputStyle} value={d.website} onChange={set('website')} /></Field>
              <Field label="Office address"><input style={inputStyle} value={d.address} onChange={set('address')} /></Field>
            </div>}
            {type === 'whatsapp' && <div style={row}>
              <Field label="WhatsApp number" hint="10-digit Indian numbers get +91 automatically"><input style={inputStyle} value={d.wa} onChange={set('wa')} /></Field>
              <Field label="Pre-filled message (optional)"><input style={inputStyle} value={d.waText} onChange={set('waText')} placeholder="Hi, I'm interested in…" /></Field>
            </div>}
            {type === 'phone' && <Field label="Phone number"><input style={inputStyle} value={d.tel} onChange={set('tel')} placeholder="+91…" /></Field>}
            {type === 'email' && <div style={row}>
              <Field label="To"><input style={inputStyle} value={d.to} onChange={set('to')} /></Field>
              <Field label="Subject"><input style={inputStyle} value={d.subject} onChange={set('subject')} /></Field>
              <Field label="Message" style={{ gridColumn: '1 / -1' }}><textarea style={{ ...inputStyle, minHeight: 70 }} value={d.body} onChange={set('body')} /></Field>
            </div>}
          </Panel>

          <Panel title="Style">
            <div style={row}>
              <Field label={`Size · ${style.size}px`}><input type="range" min={128} max={2048} step={64} value={style.size} onChange={setS('size')} /></Field>
              <Field label="Colour"><div style={{ display: 'flex', gap: 8 }}><input type="color" value={style.fg} onChange={setS('fg')} style={{ width: 44, height: 34, border: 'none', background: 'none' }} /><input type="color" value={style.bg} onChange={setS('bg')} style={{ width: 44, height: 34, border: 'none', background: 'none' }} /><Btn variant="ghost" onClick={() => setStyle(s => ({ ...s, fg: '#105da9', bg: '#ffffff' }))}>Brand blue</Btn></div></Field>
              <Field label="Error correction" hint="Higher = still scans if printed small or slightly damaged"><select style={inputStyle} value={style.ecl} onChange={setS('ecl')}><option value="L">Low</option><option value="M">Medium</option><option value="Q">High</option><option value="H">Highest</option></select></Field>
              <Field label="Caption under code (PNG)"><input style={inputStyle} value={style.label} onChange={setS('label')} placeholder="e.g. Scan to join Wi-Fi" /></Field>
            </div>
          </Panel>
        </div>

        <div style={{ ...card, padding: 18, position: 'sticky', top: 16, textAlign: 'center' }}>
          <div style={{ fontFamily: font.head, fontWeight: 700, fontSize: '.85rem', color: 'var(--text-primary)', marginBottom: 12, textAlign: 'left' }}>Preview</div>
          <div style={{ aspectRatio: '1', borderRadius: 12, background: style.bg, display: 'flex', alignItems: 'center', justifyContent: 'center', border: '1px solid var(--border)', overflow: 'hidden' }}>
            {png ? <img src={png} alt="QR code" style={{ width: '100%', height: '100%', imageRendering: 'pixelated' }} /> : <span style={{ fontFamily: font.body, fontSize: '.8rem', color: '#64748b', padding: 20 }}>Fill in the details to see the QR code</span>}
          </div>
          {style.label && png && <div style={{ fontFamily: font.head, fontWeight: 600, fontSize: '.85rem', color: 'var(--text-primary)', marginTop: 8 }}>{style.label}</div>}
          {error && <div style={{ marginTop: 10, textAlign: 'left' }}><Notice>{error}</Notice></div>}
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginTop: 14, flexWrap: 'wrap' }}>
            <Btn icon={Download} disabled={!png} onClick={downloadPng}>PNG</Btn>
            <Btn variant="ghost" icon={Download} disabled={!png} onClick={downloadSvg}>SVG (for print)</Btn>
          </div>
          <div style={{ fontFamily: font.body, fontSize: '.72rem', color: 'var(--text-muted)', marginTop: 10 }}>Test-scan with your phone before printing.</div>
        </div>
      </div>
      <style>{`@media (max-width: 900px){ .qr-grid{ grid-template-columns: 1fr !important; } }`}</style>
    </div>
  );
};

export default QrTool;
