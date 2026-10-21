// Copies the PDF.js worker into /public so the File Converter can load it as a
// real web worker (CRA would otherwise run it through Babel and break it).
// Runs automatically before `npm start` and `npm run build`.
const fs = require('fs');
const path = require('path');
const src = path.join(__dirname, '..', 'node_modules', 'pdfjs-dist', 'legacy', 'build', 'pdf.worker.min.js');
const dest = path.join(__dirname, '..', 'public', 'pdf.worker.min.js');
try {
  fs.copyFileSync(src, dest);
  console.log('[converter] pdf.worker.min.js copied to public/');
} catch (e) {
  console.warn(`[converter] Could not copy the PDF worker (${e.message}). Run "npm install" first; PDF → image/text will not work until then.`);
}
