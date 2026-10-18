// Development-only static server. Never accepts document uploads.
import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
const root = path.resolve(fileURLToPath(new URL('../', import.meta.url)));
// Optional alias used by integration tests to emulate a Pages repository path.
const basePath = process.env.MATCHER_BASE_PATH || '';
const types = { '.html':'text/html; charset=utf-8', '.css':'text/css; charset=utf-8', '.js':'text/javascript; charset=utf-8', '.mjs':'text/javascript; charset=utf-8', '.json':'application/json; charset=utf-8', '.woff2':'font/woff2', '.jpg':'image/jpeg', '.png':'image/png', '.svg':'image/svg+xml' };
const server = http.createServer(async (req,res)=> {
  if (!['GET','HEAD'].includes(req.method)) { res.writeHead(405); res.end(); return; }
  try {
    let pathname = decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if (basePath && pathname.startsWith(basePath+'/')) pathname=pathname.slice(basePath.length);
    const file = path.resolve(root, '.' + (pathname==='/' ? '/student-match.html' : pathname));
    if (file !== root && !file.startsWith(root+path.sep)) { res.writeHead(403); res.end(); return; }
    const data = await readFile(file);
    res.writeHead(200, { 'Content-Type':types[path.extname(file)] || 'application/octet-stream', 'Cache-Control':'no-store', 'X-Content-Type-Options':'nosniff' });
    res.end(req.method==='HEAD' ? undefined : data);
  } catch { res.writeHead(404); res.end('Not found'); }
});
const port = Number(process.env.PORT || 4173);
server.listen(port,'127.0.0.1',()=>console.log(`Local preview: http://127.0.0.1:${port}/student-match.html\nStatic files only. Press Ctrl+C to stop.`));
