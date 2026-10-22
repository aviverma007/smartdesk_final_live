import React, { Suspense, lazy, useEffect, useState } from 'react';
import { Repeat, FileCog, FilePen, ImageDown, Table2, QrCode, Calculator, ShieldCheck, ArrowRight, Loader2 } from 'lucide-react';
import { card, font, SpinStyle, btnStyle } from './shared';
import { ArrowLeft } from 'lucide-react';

// Each tool is loaded only when opened, so the rest of the portal stays fast.
const FileConverter = lazy(() => import('../FileConverter'));
const PdfTools = lazy(() => import('./PdfTools'));
const PdfEditor = lazy(() => import('./PdfEditor'));
const ImageTools = lazy(() => import('./ImageTools'));
const ExcelTools = lazy(() => import('./ExcelTools'));
const QrTool = lazy(() => import('./QrTool'));
const Calculators = lazy(() => import('./Calculators'));

export const TOOLS = [
  { id: 'convert', title: 'File Converter', desc: 'PDF → Word, Excel ⇄ CSV, images ⇄ PDF, merge PDFs and more.', Icon: Repeat, color: 'var(--chart-1)', C: FileConverter, tags: ['PDF', 'Word', 'Excel', 'Images'] },
  { id: 'pdf-edit', title: 'PDF Editor', desc: 'Type on a PDF, sign it, highlight, draw, add images or white-out text — then download.', Icon: FilePen, color: 'var(--accent-purple, #7c3aed)', C: PdfEditor, tags: ['Sign', 'Add text', 'Highlight'] },
  { id: 'pdf', title: 'PDF Tools', desc: 'Reorder, rotate, delete pages · split · watermark · page numbers · compress.', Icon: FileCog, color: 'var(--danger)', C: PdfTools, tags: ['Split', 'Watermark', 'Compress'] },
  { id: 'image', title: 'Image Tools', desc: 'Resize photos, compress to under 200 KB, convert JPG / PNG / WEBP in bulk.', Icon: ImageDown, color: 'var(--chart-4)', C: ImageTools, tags: ['Resize', 'Compress', 'Bulk'] },
  { id: 'excel', title: 'Excel Tools', desc: 'Merge many files, compare two versions, remove duplicates, split by site/department.', Icon: Table2, color: 'var(--success)', C: ExcelTools, tags: ['Merge', 'Compare', 'Dedupe'] },
  { id: 'qr', title: 'QR Code Generator', desc: 'QR codes for websites, Wi-Fi, contact cards, WhatsApp — PNG or SVG for print.', Icon: QrCode, color: 'var(--chart-2)', C: QrTool, tags: ['Wi-Fi', 'vCard', 'Print'] },
  { id: 'calc', title: 'Calculators', desc: 'Amount in words (₹), GST, loan EMI and land area (sq ft, gaj, acre, kanal).', Icon: Calculator, color: 'var(--chart-3)', C: Calculators, tags: ['₹ in words', 'GST', 'EMI'] },
];

const LAST_KEY = 'sd-tools-last';
const Loading = () => (
  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, padding: '80px 0', fontFamily: font.body, color: 'var(--text-muted)' }}>
    <Loader2 size={18} className="tools-spin" /> Loading tool…
  </div>
);

const ToolsHub = ({ initialTool }) => {
  const [active, setActive] = useState(() => initialTool || null);
  useEffect(() => { if (initialTool) setActive(initialTool); }, [initialTool]);
  useEffect(() => { try { if (active) localStorage.setItem(LAST_KEY, active); } catch (_) {} }, [active]);

  const tool = TOOLS.find(t => t.id === active);
  if (tool) {
    const C = tool.C;
    return (
      <div className="tab-fade-in" key={tool.id}>
        <SpinStyle />
        {/* The converter has its own header; give it the same back button as the other tools */}
        {tool.id === 'convert' && (
          <button type="button" onClick={() => setActive(null)} style={{ ...btnStyle('ghost'), padding: '8px 12px', marginBottom: 14 }}><ArrowLeft size={15} />All tools</button>
        )}
        <Suspense fallback={<Loading />}><C onBack={() => setActive(null)} /></Suspense>
      </div>
    );
  }

  let last = null; try { last = localStorage.getItem(LAST_KEY); } catch (_) {}
  return (
    <div style={{ paddingBottom: 32 }}>
      <SpinStyle />
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: 16, flexWrap: 'wrap', marginBottom: 20 }}>
        <div>
          <p style={{ fontFamily: font.head, fontSize: '.68rem', fontWeight: 700, letterSpacing: '.14em', textTransform: 'uppercase', color: 'var(--accent)', marginBottom: 5 }}>Productivity</p>
          <h2 style={{ fontFamily: font.head, fontWeight: 800, fontSize: '1.5rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1 }}>Tools</h2>
          <p style={{ fontFamily: font.body, fontSize: '.82rem', color: 'var(--text-muted)', marginTop: 6 }}>Everyday file and office utilities — no software to install, no online sites needed.</p>
        </div>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 20, background: 'var(--success-bg)', border: '1px solid color-mix(in srgb, var(--success) 35%, transparent)', color: 'var(--success)', fontFamily: font.body, fontSize: '.74rem', fontWeight: 600 }}>
          <ShieldCheck size={14} /> Company files stay on your PC — safer than public converter websites
        </span>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(290px, 1fr))', gap: 16 }}>
        {TOOLS.map((t, i) => (
          <button key={t.id} type="button" onClick={() => setActive(t.id)} className="tool-card"
            style={{ ...card, textAlign: 'left', cursor: 'pointer', padding: 20, display: 'flex', flexDirection: 'column', gap: 12, animation: `tabIn .35s ease ${i * 45}ms both` }}>
            <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 3, background: t.color, opacity: .8 }} />
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <div style={{ width: 46, height: 46, borderRadius: 13, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in srgb, ${t.color} 14%, transparent)`, color: t.color }}><t.Icon size={22} /></div>
              {last === t.id && <span style={{ fontFamily: font.body, fontSize: '.68rem', fontWeight: 700, color: 'var(--text-muted)', padding: '3px 8px', borderRadius: 20, border: '1px solid var(--border)' }}>Last used</span>}
            </div>
            <div>
              <div style={{ fontFamily: font.head, fontWeight: 800, fontSize: '1.02rem', color: 'var(--text-primary)' }}>{t.title}</div>
              <div style={{ fontFamily: font.body, fontSize: '.8rem', color: 'var(--text-muted)', marginTop: 5, lineHeight: 1.45 }}>{t.desc}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginTop: 'auto' }}>
              {t.tags.map(tag => <span key={tag} style={{ fontFamily: font.body, fontSize: '.68rem', fontWeight: 600, padding: '3px 8px', borderRadius: 20, background: 'var(--bg-elevated)', border: '1px solid var(--border)', color: 'var(--text-secondary)' }}>{tag}</span>)}
              <span className="tool-go" style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 4, fontFamily: font.head, fontWeight: 700, fontSize: '.76rem', color: t.color }}>Open <ArrowRight size={14} /></span>
            </div>
          </button>
        ))}
      </div>
      <style>{`
        .tool-card{ transition: transform .2s ease, box-shadow .2s ease, border-color .2s ease; }
        .tool-card:hover{ transform: translateY(-3px); box-shadow: var(--shadow-hover); border-color: var(--accent) !important; }
        .tool-card:hover .tool-go{ transform: translateX(3px); }
        .tool-go{ transition: transform .2s ease; }
        @media (prefers-reduced-motion: reduce){ .tool-card, .tool-go{ transition:none; } .tool-card{ animation:none !important; } }
      `}</style>
    </div>
  );
};

export default ToolsHub;
