// Copies browser-side worker files into /public so they are served as-is
// (CRA would otherwise run them through Babel and break them).
// Runs automatically before `npm start` and `npm run build`.
//   - PDF.js worker            → public/pdf.worker.min.js      (File Converter, PDF tools, PDF Editor)
//   - Tesseract OCR worker/core → public/tesseract/            (PDF Editor: edit text on scanned pages)
//   - English OCR language data → public/tesseract/lang/
const fs = require('fs');
const path = require('path');
const nm = (...p) => path.join(__dirname, '..', 'node_modules', ...p);
const pub = (...p) => path.join(__dirname, '..', 'public', ...p);

const copies = [
  [nm('pdfjs-dist', 'legacy', 'build', 'pdf.worker.min.js'), pub('pdf.worker.min.js')],
  [nm('tesseract.js', 'dist', 'worker.min.js'), pub('tesseract', 'worker.min.js')],
  [nm('tesseract.js-core', 'tesseract-core-lstm.wasm.js'), pub('tesseract', 'tesseract-core-lstm.wasm.js')],
  [nm('tesseract.js-core', 'tesseract-core-simd-lstm.wasm.js'), pub('tesseract', 'tesseract-core-simd-lstm.wasm.js')],
  [nm('@tesseract.js-data', 'eng', '4.0.0_best_int', 'eng.traineddata.gz'), pub('tesseract', 'lang', 'eng.traineddata.gz')],
];

let ok = 0;
for (const [src, dest] of copies) {
  try {
    fs.mkdirSync(path.dirname(dest), { recursive: true });
    const s = fs.statSync(src);
    let same = false;
    try { const d = fs.statSync(dest); same = d.size === s.size && d.mtimeMs >= s.mtimeMs; } catch (_) {}
    if (!same) fs.copyFileSync(src, dest);
    ok++;
  } catch (e) {
    console.warn(`[assets] Could not copy ${path.basename(src)} (${e.message}). Run "npm install" first.`);
  }
}
console.log(`[assets] ${ok}/${copies.length} worker files ready in public/`);
