// Development-only helper. Re-downloads the self-hosted fonts and records
// their sources and SHA-256 hashes. The production page uses these files locally.
import { mkdir, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';

const files = [];
for (const [family, version, weights] of [['inter', '5.0.20', [400, 500, 600, 700]], ['space-grotesk', '5.0.19', [500, 700]], ['jetbrains-mono', '5.0.20', [400]]]) {
  for (const weight of weights) files.push([`fonts/${family}-${weight}.woff2`, `https://cdn.jsdelivr.net/npm/@fontsource/${family}@${version}/files/${family}-latin-${weight}-normal.woff2`]);
  files.push([`fonts/${family}-LICENSE`, `https://cdn.jsdelivr.net/npm/@fontsource/${family}@${version}/LICENSE`]);
}
const manifest = [];
for (const [name, url] of files) {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`${url}: ${res.status}`);
  const data = Buffer.from(await res.arrayBuffer());
  const dest = new URL(`../assets/vendor/${name}`, import.meta.url);
  await mkdir(new URL('.', dest), { recursive: true });
  await writeFile(dest, data);
  manifest.push({ file: name, source: url, sha256: createHash('sha256').update(data).digest('hex') });
  console.log(`Vendored ${name} (${data.length} bytes)`);
}
await writeFile(new URL('../assets/vendor/manifest.json', import.meta.url), JSON.stringify(manifest, null, 2) + '\n');
