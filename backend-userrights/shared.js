/**
 * Shared folder for HR — photos and the employee Excel, picked up live by SmartDesk.
 *
 *   SHARED_DIR (default C:\SmartDesk_Shared)
 *     ├─ Gallery\         any .jpg .jpeg .png .webp .gif (any file name) → Home page gallery slideshow
 *     └─ Employee Data\   the employee Excel (.xlsx / .xls / .csv) → directory, search, home, TV…
 *                         If several files are there, the most recently saved one is used.
 *
 * Routes (behind the portal's /ura-api proxy):
 *   GET /api/shared/gallery              → { images: [{ name, url, size, mtime }] }
 *   GET /api/shared/gallery/:name        → the image file
 *   GET /api/shared/employees/meta       → { file, mtime, size, version }  (cheap; polled by the portal)
 *   GET /api/shared/employees/file       → the Excel itself
 */
const fs = require('fs');
const path = require('path');

const SHARED_DIR = process.env.SHARED_DIR || 'C:\\SmartDesk_Shared';
const GALLERY_DIR = path.join(SHARED_DIR, 'Gallery');
const EMP_DIR = path.join(SHARED_DIR, 'Employee Data');
const IMG = /\.(jpe?g|png|webp|gif|bmp|avif)$/i;
const SHEET = /\.(xlsx|xls|xlsm|csv)$/i;
const MIME = { jpg: 'image/jpeg', jpeg: 'image/jpeg', png: 'image/png', webp: 'image/webp', gif: 'image/gif', bmp: 'image/bmp', avif: 'image/avif',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', xlsm: 'application/vnd.ms-excel.sheet.macroEnabled.12', xls: 'application/vnd.ms-excel', csv: 'text/csv' };

const README = `SMARTDESK SHARED FOLDER — managed by HR
=========================================

Gallery\\
  Put photos here (JPG, PNG, WEBP, GIF). Any file name is fine.
  They play as a slideshow on the SmartDesk Home page, in file-name order
  (name them 01-..., 02-... to choose the order).
  Delete a photo here to remove it from SmartDesk.
  Tip: keep each photo under ~2 MB (landscape photos look best).
  Changes appear within a few minutes, no restart needed.

Employee Data\\
  Put the employee master Excel here (.xlsx, .xls or .csv).
  Column names (first row):  Code, Name, Mobile No, DOJ, Designation, Department, Location, Email ID
  If there is more than one file, the most recently saved one is used.
  Save and close the Excel — SmartDesk picks up the change within a few minutes
  (directory, search, Home page, TV display).
`;

function ensureFolders() {
  try {
    fs.mkdirSync(GALLERY_DIR, { recursive: true });
    fs.mkdirSync(EMP_DIR, { recursive: true });
    const readme = path.join(SHARED_DIR, 'READ ME - how to use.txt');
    if (!fs.existsSync(readme)) fs.writeFileSync(readme, README.replace(/\n/g, '\r\n'));
    return true;
  } catch (e) {
    console.warn(`   ! Shared folder: could not create ${SHARED_DIR} (${e.message})`);
    return false;
  }
}

const visible = (f) => !f.startsWith('~$') && !f.startsWith('.') && !/^thumbs\.db$/i.test(f) && !/^desktop\.ini$/i.test(f);
function listFiles(dir, re) {
  try {
    return fs.readdirSync(dir).filter(f => visible(f) && re.test(f)).map(f => {
      try { const st = fs.statSync(path.join(dir, f)); return st.isFile() && st.size > 0 ? { name: f, size: st.size, mtime: st.mtimeMs } : null; } catch (_) { return null; }
    }).filter(Boolean);
  } catch (_) { return []; }
}
const natural = new Intl.Collator('en', { numeric: true, sensitivity: 'base' });

/** The employee sheet to use: newest Excel in "Employee Data", or null. */
function currentEmployeeFile() {
  const files = listFiles(EMP_DIR, SHEET).sort((a, b) => b.mtime - a.mtime);
  return files[0] ? { ...files[0], path: path.join(EMP_DIR, files[0].name) } : null;
}

/** Only plain file names inside the folder — never ../ or sub-paths. */
function safeFile(dir, name, re) {
  const base = path.basename(String(name || ''));
  if (!base || base !== name || !visible(base) || !re.test(base)) return null;
  const full = path.join(dir, base);
  try { return fs.statSync(full).isFile() ? full : null; } catch (_) { return null; }
}
const typeOf = (f) => MIME[path.extname(f).slice(1).toLowerCase()] || 'application/octet-stream';

function mountShared(app) {
  const ok = ensureFolders();

  app.get('/api/shared/gallery', (req, res) => {
    const images = listFiles(GALLERY_DIR, IMG).sort((a, b) => natural.compare(a.name, b.name))
      .map(f => ({ name: f.name, size: f.size, mtime: Math.round(f.mtime), url: `/shared/gallery/${encodeURIComponent(f.name)}?v=${Math.round(f.mtime)}` }));
    res.set('Cache-Control', 'no-store').json({ success: true, folder: GALLERY_DIR, count: images.length, images });
  });

  app.get('/api/shared/gallery/:name', (req, res) => {
    const full = safeFile(GALLERY_DIR, req.params.name, IMG);
    if (!full) return res.status(404).json({ success: false, error: 'Image not found' });
    res.set('Content-Type', typeOf(full)).set('Cache-Control', 'public, max-age=86400');
    fs.createReadStream(full).on('error', () => res.status(500).end()).pipe(res);
  });

  app.get('/api/shared/employees/meta', (req, res) => {
    const f = currentEmployeeFile();
    res.set('Cache-Control', 'no-store');
    if (!f) return res.json({ success: true, file: null, folder: EMP_DIR });
    res.json({ success: true, folder: EMP_DIR, file: f.name, size: f.size, mtime: Math.round(f.mtime), version: `${f.name}|${Math.round(f.mtime)}|${f.size}` });
  });

  app.get('/api/shared/employees/file', (req, res) => {
    const f = currentEmployeeFile();
    if (!f) return res.status(404).json({ success: false, error: `No Excel file in ${EMP_DIR}` });
    res.set('Content-Type', typeOf(f.name)).set('Cache-Control', 'no-store').set('X-File-Name', encodeURIComponent(f.name));
    // read fully first so a half-saved file is never streamed
    fs.readFile(f.path, (err, buf) => (err ? res.status(503).json({ success: false, error: 'The Excel is being saved — try again in a moment.' }) : res.end(buf)));
  });

  if (ok) {
    const g = listFiles(GALLERY_DIR, IMG).length, e = currentEmployeeFile();
    console.log(`   Shared:  ${SHARED_DIR}  (Gallery: ${g} photo${g === 1 ? '' : 's'} · Employee Data: ${e ? e.name : 'no Excel yet — using the built-in list'})`);
  }
}

module.exports = { mountShared, currentEmployeeFile, SHARED_DIR, GALLERY_DIR, EMP_DIR };
