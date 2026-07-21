const FT_LABEL = { pdf: 'PDF', xls: 'XLS', msg: 'MAIL', img: 'IMG', fld: 'FLD' };

// Matches the prototype's typed file chips exactly: PDF/XLS/MAIL/IMG/FLD
// badge + filename, click to "open" (simulated preview/download — real
// streaming from QMS/file store is IT-owned, out of scope here).
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
  if (f.t === 'pdf' || f.t === 'img') {
    const w = window.open('', '_blank');
    w.document.write(
      `<title>${escapeHtml(f.n)}</title><body style="font-family:Arial;padding:40px;color:#000">` +
      `<h3 style="margin-bottom:8px">${escapeHtml(f.n)}</h3>` +
      `<p>Simulated preview — in production this document streams from QMS / the dashboard file store.</p></body>`,
    );
  } else {
    const blob = new Blob([`Simulated content of ${f.n} — in production this downloads from QMS / the dashboard file store.`], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = f.n;
    a.click();
  }
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}
