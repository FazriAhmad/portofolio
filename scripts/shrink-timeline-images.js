// Re-encodes the images stored inline in education / career / achievements.
//
// These live as data: URLs inside site_content, so every visitor downloads them
// with /api/content on first paint. A scanned certificate saved as PNG is a
// photograph: three of them made that response 504KB and eleven seconds. Images
// that genuinely use transparency are left as PNG.
//
//   node scripts/shrink-timeline-images.js [apiUrl]           report only
//   ADMIN_TOKEN=... node scripts/... [apiUrl] --apply         rewrite them

import sharp from 'sharp';

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const API = args.find(a => !a.startsWith('--')) || 'http://localhost:4000';
const TOKEN = process.env.ADMIN_TOKEN;

if (apply && !TOKEN) {
  console.error('Set ADMIN_TOKEN to run with --apply.');
  process.exit(1);
}

const FIELDS = ['education', 'career', 'achievements'];
const MAX_WIDTH = 900;

const content = await fetch(`${API}/api/content?f=${Date.now()}`).then(r => r.json());
let before = 0, after = 0, changed = 0;

for (const fieldName of FIELDS) {
  for (const lang of ['en', 'id']) {
    const list = content[fieldName]?.[lang] ?? [];
    let touched = false;

    const next = [];
    for (const entry of list) {
      const src = entry.image;
      if (!src || !src.startsWith('data:')) { next.push(entry); continue; }

      const m = src.match(/^data:image\/(\w+);base64,(.*)$/s);
      if (!m) { next.push(entry); continue; }

      const buf = Buffer.from(m[2], 'base64');
      before += src.length;

      const img = sharp(buf);
      const meta = await img.metadata();
      const stats = await img.stats();
      const transparent = meta.hasAlpha && stats.isOpaque === false;

      let pipeline = sharp(buf).resize({ width: Math.min(meta.width, MAX_WIDTH), withoutEnlargement: true });
      pipeline = transparent
        ? pipeline.png({ compressionLevel: 9, palette: true })
        : pipeline.jpeg({ quality: 82, mozjpeg: true });

      const out = await pipeline.toBuffer();
      const dataUrl = `data:image/${transparent ? 'png' : 'jpeg'};base64,${out.toString('base64')}`;
      after += dataUrl.length;

      const label = `${fieldName}.${lang} "${(entry.title || '(untitled)').slice(0, 38)}"`;
      if (dataUrl.length < src.length) {
        console.log(
          `- ${apply ? 'rewrote' : 'would shrink'} ${label}: ` +
          `${Math.round(src.length / 1024)}KB -> ${Math.round(dataUrl.length / 1024)}KB` +
          (transparent ? '  [kept PNG: transparent]' : '  [-> JPEG]')
        );
        next.push({ ...entry, image: dataUrl });
        touched = true;
        changed++;
      } else {
        console.log(`- keep ${label}: already ${Math.round(src.length / 1024)}KB`);
        next.push(entry);
      }
    }

    if (apply && touched) {
      const res = await fetch(`${API}/api/content`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json', 'x-admin-token': TOKEN },
        body: JSON.stringify({ field: fieldName, lang, value: next })
      });
      if (!res.ok) throw new Error(`PATCH ${fieldName}.${lang} -> ${res.status}`);
    }
  }
}

if (!changed) {
  console.log('\nNothing to shrink.');
} else {
  console.log(
    `\n${changed} image(s): ${Math.round(before / 1024)}KB -> ${Math.round(after / 1024)}KB` +
    (apply ? '' : '\nRe-run with --apply (and ADMIN_TOKEN set) to write them back.')
  );
}
