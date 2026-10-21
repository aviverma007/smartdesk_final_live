import React, { useRef, useState } from 'react';
import { Upload, ArrowLeft, Download, AlertCircle, CheckCircle2, Loader2 } from 'lucide-react';

/* Shared building blocks for the Tools tab (theme-aware, light + dark). */

export const font = { head: "'Plus Jakarta Sans',sans-serif", body: "'DM Sans',sans-serif" };

export const card = {
  background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 14,
  boxShadow: 'var(--shadow-card)', position: 'relative', overflow: 'hidden',
};

export const btnStyle = (variant = 'primary', disabled = false) => ({
  display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: 7, padding: '9px 16px', borderRadius: 9,
  cursor: disabled ? 'not-allowed' : 'pointer', fontFamily: font.head, fontWeight: 700, fontSize: '.8rem',
  transition: 'all .15s', opacity: disabled ? .5 : 1, whiteSpace: 'nowrap',
  ...(variant === 'primary'
    ? { background: 'linear-gradient(135deg,#105da9,#1a7fd4)', color: '#fff', border: 'none', boxShadow: disabled ? 'none' : 'var(--shadow-active)' }
    : variant === 'success'
      ? { background: 'var(--success-bg)', color: 'var(--success)', border: '1px solid color-mix(in srgb, var(--success) 45%, transparent)' }
      : variant === 'danger'
        ? { background: 'var(--danger-bg)', color: 'var(--danger)', border: '1px solid color-mix(in srgb, var(--danger) 40%, transparent)' }
        : { background: 'var(--bg-elevated)', color: 'var(--text-secondary)', border: '1px solid var(--border)' }),
});

export const Btn = ({ variant = 'primary', disabled, busy, icon: Icon, children, ...rest }) => (
  <button type="button" style={btnStyle(variant, disabled || busy)} disabled={disabled || busy} {...rest}>
    {busy ? <Loader2 size={14} className="tools-spin" /> : Icon ? <Icon size={14} /> : null}{children}
  </button>
);

export const inputStyle = {
  padding: '8px 11px', borderRadius: 8, border: '1px solid var(--border)', background: 'var(--bg-elevated)',
  color: 'var(--text-primary)', fontFamily: font.body, fontSize: '.84rem', outline: 'none', width: '100%',
};

export const Field = ({ label, hint, children, style }) => (
  <label style={{ display: 'flex', flexDirection: 'column', gap: 5, minWidth: 0, ...style }}>
    <span style={{ fontFamily: font.body, fontSize: '.72rem', fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>{label}</span>
    {children}
    {hint && <span style={{ fontFamily: font.body, fontSize: '.7rem', color: 'var(--text-muted)' }}>{hint}</span>}
  </label>
);

export const Segmented = ({ value, onChange, options }) => (
  <div style={{ display: 'inline-flex', flexWrap: 'wrap', gap: 4, padding: 4, borderRadius: 10, background: 'var(--bg-elevated)', border: '1px solid var(--border)' }}>
    {options.map(o => {
      const on = o.value === value;
      return (
        <button key={o.value} type="button" onClick={() => onChange(o.value)} style={{
          display: 'inline-flex', alignItems: 'center', gap: 6, padding: '6px 12px', borderRadius: 7, cursor: 'pointer', border: 'none',
          fontFamily: font.head, fontWeight: 700, fontSize: '.76rem', transition: 'all .15s',
          background: on ? 'var(--accent)' : 'transparent', color: on ? '#fff' : 'var(--text-secondary)',
        }}>{o.icon && <o.icon size={13} />}{o.label}</button>
      );
    })}
  </div>
);

export const DropZone = ({ accept, multiple = true, onFiles, title, hint, compact }) => {
  const ref = useRef(null);
  const [drag, setDrag] = useState(false);
  return (
    <div
      role="button" tabIndex={0}
      onClick={() => ref.current?.click()}
      onKeyDown={e => (e.key === 'Enter' || e.key === ' ') && ref.current?.click()}
      onDragOver={e => { e.preventDefault(); setDrag(true); }}
      onDragLeave={() => setDrag(false)}
      onDrop={e => { e.preventDefault(); setDrag(false); if (e.dataTransfer.files?.length) onFiles(Array.from(e.dataTransfer.files)); }}
      style={{
        ...card, padding: compact ? '16px' : '28px 20px', textAlign: 'center', cursor: 'pointer',
        border: `2px dashed ${drag ? 'var(--accent)' : 'var(--border)'}`,
        background: drag ? 'color-mix(in srgb, var(--accent) 7%, var(--bg-card))' : 'var(--bg-card)', transition: 'all .18s',
      }}>
      <input ref={ref} type="file" hidden multiple={multiple} accept={accept}
        onChange={e => { if (e.target.files?.length) onFiles(Array.from(e.target.files)); e.target.value = ''; }} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, flexDirection: compact ? 'row' : 'column' }}>
        <div style={{ width: compact ? 36 : 50, height: compact ? 36 : 50, borderRadius: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'color-mix(in srgb, var(--accent) 12%, transparent)', color: 'var(--accent)' }}>
          <Upload size={compact ? 17 : 22} />
        </div>
        <div>
          <div style={{ fontFamily: font.head, fontWeight: 700, fontSize: compact ? '.85rem' : '.95rem', color: 'var(--text-primary)' }}>{drag ? 'Drop to add' : (title || 'Drag & drop files here, or click to browse')}</div>
          {hint && <div style={{ fontFamily: font.body, fontSize: '.76rem', color: 'var(--text-muted)', marginTop: 4 }}>{hint}</div>}
        </div>
      </div>
    </div>
  );
};

export const ToolHeader = ({ icon: Icon, color = 'var(--accent)', title, subtitle, onBack }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 18, flexWrap: 'wrap' }}>
    {onBack && (
      <button type="button" onClick={onBack} title="All tools" style={{ ...btnStyle('ghost'), padding: '8px 12px' }}>
        <ArrowLeft size={15} />All tools
      </button>
    )}
    <div style={{ width: 42, height: 42, borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center', background: `color-mix(in srgb, ${color} 14%, transparent)`, color }}>
      <Icon size={20} />
    </div>
    <div style={{ minWidth: 0 }}>
      <h2 style={{ fontFamily: font.head, fontWeight: 800, fontSize: '1.3rem', color: 'var(--text-primary)', margin: 0, lineHeight: 1.1 }}>{title}</h2>
      {subtitle && <p style={{ fontFamily: font.body, fontSize: '.8rem', color: 'var(--text-muted)', margin: '4px 0 0' }}>{subtitle}</p>}
    </div>
  </div>
);

export const Notice = ({ type = 'error', children }) => {
  const c = type === 'error' ? 'var(--danger)' : type === 'success' ? 'var(--success)' : type === 'warning' ? 'var(--warning)' : 'var(--info)';
  const bg = type === 'error' ? 'var(--danger-bg)' : type === 'success' ? 'var(--success-bg)' : type === 'warning' ? 'var(--warning-bg)' : 'var(--info-bg)';
  const Icon = type === 'success' ? CheckCircle2 : AlertCircle;
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8, padding: '10px 14px', borderRadius: 10, background: bg, border: `1px solid color-mix(in srgb, ${c} 40%, transparent)`, color: c, fontFamily: font.body, fontSize: '.8rem', lineHeight: 1.45 }}>
      <Icon size={15} style={{ flexShrink: 0, marginTop: 1 }} /><div>{children}</div>
    </div>
  );
};

export const ResultRow = ({ name, size, before, onDownload }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 14px', borderRadius: 10, background: 'var(--success-bg)', border: '1px solid color-mix(in srgb, var(--success) 35%, transparent)', flexWrap: 'wrap' }}>
    <CheckCircle2 size={16} style={{ color: 'var(--success)' }} />
    <div style={{ flex: 1, minWidth: 0, fontFamily: font.body, fontSize: '.82rem', color: 'var(--text-primary)', fontWeight: 600, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{name}</div>
    <span style={{ fontFamily: font.body, fontSize: '.76rem', color: 'var(--text-muted)' }}>
      {before != null && <>{fmtBytes(before)} → </>}<b style={{ color: 'var(--success)' }}>{fmtBytes(size)}</b>
      {before != null && before > 0 && <> ({size <= before ? '−' : '+'}{Math.abs(Math.round((1 - size / before) * 100))}%)</>}
    </span>
    <Btn variant="success" icon={Download} onClick={onDownload}>Download</Btn>
  </div>
);

export const fmtBytes = (n) => n < 1024 ? `${n} B` : n < 1048576 ? `${(n / 1024).toFixed(1)} KB` : `${(n / 1048576).toFixed(2)} MB`;

export const SpinStyle = () => <style>{`.tools-spin{animation:spin .8s linear infinite}`}</style>;

export const Panel = ({ title, children, style, right }) => (
  <div style={{ ...card, padding: '16px 18px', ...style }}>
    {(title || right) && (
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        {title && <div style={{ fontFamily: font.head, fontWeight: 700, fontSize: '.88rem', color: 'var(--text-primary)' }}>{title}</div>}
        {right}
      </div>
    )}
    {children}
  </div>
);
