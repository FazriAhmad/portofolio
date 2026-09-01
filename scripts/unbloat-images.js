// Moves base64 images out of the database and into public/images/.
//
// The admin panel stores uploaded thumbnails as data: URLs, so they travel
// inside every /api/projects response — 117KB of the 120KB payload at the time
// this was written, roughly a second of load time for every visitor. As static
// files they are cached by the CDN and the browser, and load in parallel.
//
// Two phases, because the file has to be live before the database points at it:
//
//   node scripts/unbloat-images.js [apiUrl]           extract to public/images/
//   <deploy, so the new files are actually served>
//   node scripts/unbloat-images.js [apiUrl] --apply   repoint the rows
//
// apiUrl defaults to http://localhost:4000.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const apply = args.includes('--apply');
const API = args.find(a => !a.startsWith('--')) || 'http://localhost:4000';

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

const projects = await fetch(`${API}/api/projects`).then(r => r.json());
const bloated = projects.filter(p => typeof p.image === 'string' && p.image.startsWith('data:'));

if (!bloated.length) {
  console.log(`No base64 images at ${API} — nothing to do.`);
  process.exit(0);
}

for (const p of bloated) {
  const m = p.image.match(/^data:image\/(\w+);base64,(.*)$/s);
  if (!m) {
    console.log(`- skipped ${p.title.en}: unrecognised data URL`);
    continue;
  }
  const [, type, b64] = m;
  const ext = type === 'jpeg' ? 'jpg' : type;
  const file = `${slug(p.title.en)}.${ext}`;
  const dest = path.join(root, 'public', 'images', file);
  const kb = Math.round(b64.length / 1024);

  if (apply) {
    const res = await fetch(`${API}/api/projects/${p.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field: 'image', value: `/images/${file}` })
    });
    if (!res.ok) throw new Error(`PATCH ${p.id} -> ${res.status}`);
    console.log(`- repointed ${p.title.en} -> /images/${file}`);
  } else {
    fs.writeFileSync(dest, Buffer.from(b64, 'base64'));
    console.log(`- extracted ${p.title.en} -> public/images/${file} (${kb}KB was inline)`);
  }
}

const saved = Math.round(bloated.reduce((s, p) => s + p.image.length, 0) / 1024);
console.log(
  apply
    ? `\n${bloated.length} row(s) repointed at ${API}.`
    : `\n${bloated.length} file(s) written. Deploy them, then re-run with --apply to drop ~${saved}KB from every /api/projects response.`
);
