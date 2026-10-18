// Runs away from the UI thread. Termination releases document buffers and text.
// No document content is returned, saved, logged, or sent over the network.
const MAX_EXPANDED = 30 * 1024 * 1024;
function checkDocxZip(buffer) {
  const view = new DataView(buffer);
  let end = -1;
  for (let i = view.byteLength - 22; i >= Math.max(0, view.byteLength - 65557); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { end = i; break; }
  }
  if (end < 0) throw new Error('invalid');
  const count = view.getUint16(end+10, true);
  let pos = view.getUint32(end+16, true), total = 0;
  if (!count || count > 2000) throw new Error('complex');
  for (let i=0; i<count; i++) {
    if (pos+46 > view.byteLength || view.getUint32(pos,true)!==0x02014b50) throw new Error('invalid');
    const expanded = view.getUint32(pos+24,true);
    total += expanded;
    if (total > MAX_EXPANDED || expanded === 0xffffffff || (view.getUint16(pos+8,true)&1)) throw new Error('complex');
    pos += 46 + view.getUint16(pos+28,true) + view.getUint16(pos+30,true) + view.getUint16(pos+32,true);
  }
}
self.onmessage = async ({ data: { buffer, format } }) => {
  try {
    let text = '';
    if (format === 'pdf') {
      const pdfjs = await import('./vendor/pdfjs/pdf.mjs');
      // Pass an explicit port: PDF.js's default browser worker bootstrap expects
      // window, which is intentionally absent in this private parsing worker.
      const port = new Worker(new URL('./vendor/pdfjs/pdf.worker.mjs', self.location.href), { type: 'module' });
      const pdfWorker = new pdfjs.PDFWorker({ port, verbosity: 0 });
      const task = pdfjs.getDocument({ data: new Uint8Array(buffer), worker: pdfWorker, verbosity: 0, isEvalSupported: false, useWasm: false, useWorkerFetch: false, disableFontFace: true, useSystemFonts: true, disableAutoFetch: true, disableStream: true, stopAtErrors: true });
      try {
        const pdf = await task.promise;
        if (pdf.numPages > 30) throw new Error('complex');
        for (let n=1; n<=pdf.numPages; n++) {
          const page = await pdf.getPage(n);
          const content = await page.getTextContent();
          text += content.items.map(item => item.str || '').join(' ')+'\n';
          page.cleanup();
          if (text.length > 200000) throw new Error('complex');
        }
      } finally { await task.destroy(); pdfWorker.destroy(); port.terminate(); }
    } else {
      checkDocxZip(buffer);
      importScripts('./vendor/mammoth/mammoth.browser.min.js');
      const result = await self.mammoth.extractRawText({ arrayBuffer: buffer }, { externalFileAccess: false });
      text = result.value;
      if (text.length > 200000) throw new Error('complex');
    }
    if ((text.match(/\p{L}/gu) || []).length < 40) throw new Error('no-text');
    const { suggestProfile } = await import('./student-match-engine.mjs');
    const suggestions = suggestProfile(text);
    text = '';
    self.postMessage({ ok: true, suggestions });
  } catch (error) {
    self.postMessage({ ok: false, code: ['no-text','complex'].includes(error.message) ? error.message : 'invalid' });
  }
};
