import { API_BASE } from '../api/client';

const FT_LABEL = { pdf: 'PDF', xls: 'XLS', msg: 'MAIL', img: 'IMG', fld: 'FLD' };

// Matches the prototype's typed file chips: PDF/XLS/MAIL/IMG/FLD badge +
// filename. Real uploads (src:'upload', has storedAs) open/download from
// this server's /uploads static route. QMS-sourced files (src:'qms') have
// no real backing document yet (the live QMS file-store integration is
// IT-owned, still pending) — those show a simulated preview instead.
export default function FileChips({ files, removable, onRemove }) {
  if (!files || !files.length) return <span className="st grey">—</span>;
  return (
    <div className="fchips">
      {files.map((f, i) => (
        <span key={i} className={`fchip ft-${f.t}`} title={f.n}>
          <span className={`ft ${f.t}`}>{FT_LABEL[f.t] || 'FILE'}</span>
          <span className="fn" onClick={() => openFile(f)}>{f.n}</span>
          {removable && (
            <button className="fx" title="Deselect file" onClick={() => onRemove?.(i)}>×</button>
          )}
        </span>
      ))}
    </div>
  );
}

function openFile(f) {
  if (f.storedAs) {
    // Real uploaded file — open/download directly from the API server's
    // /uploads static route (API_BASE looks like http://host:port/api).
    const origin = API_BASE.replace(/\/api\/?$/, '');
    window.open(`${origin}/uploads/${f.storedAs}`, '_blank');
    return;
  }
  if (f.t === 'pdf' || f.t === 'img') {
    const w = window.open('', '_blank');
    w.document.write(
      `<title>${escapeHtml(f.n)}</title><body style="font-family:Arial;padding:40px;color:#000">` +
      `<h3 style="margin-bottom:8px">${escapeHtml(f.n)}</h3>` +
      `<p>Simulated preview — QMS file-store integration is pending; once wired, this opens the real document.</p></body>`,
    );
  } else {
    const blob = new Blob([`Simulated content of ${f.n} — QMS file-store integration is pending.`], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = f.n;
    a.click();
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
