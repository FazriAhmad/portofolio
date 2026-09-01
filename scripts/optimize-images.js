// Shrink oversized project thumbnails in public/images/.
//
// The cards render at roughly 620px wide and the detail modal caps at 896px,
// but several sources were full-resolution PNGs — iot.png alone was 1.5MB and
// took 16s to arrive. Screenshots and photos belong in a lossy format at
// display resolution; PNG only pays off for flat graphics with few colours.
//
//   node scripts/optimize-images.js          report what would change
//   node scripts/optimize-images.js --write  rewrite the files in place
//
// Re-encodes to JPEG (widely supported, no <picture> fallback needed) unless
// the source has transparency, which is kept as PNG so nothing gains a box.

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import sharp from 'sharp';

const dir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', 'public', 'images');
const write = process.argv.includes('--write');

const MAX_WIDTH = 1400;   // comfortably above the 896px modal, allows for retina
const SKIP_BELOW_KB = 120; // already small enough to not be worth touching

const files = fs.readdirSync(dir).filter(f => /\.(png|jpe?g)$/i.test(f));
let before = 0, after = 0;
const stale = [];

for (const file of files) {
  const full = path.join(dir, file);
  // Read into memory first: on Windows sharp keeps a handle on a file it opened
  // by path, which makes writing the result back to that same path fail.
  const input = fs.readFileSync(full);
  const startSize = input.length;
  const img = sharp(input);
  const meta = await img.metadata();

  if (startSize < SKIP_BELOW_KB * 1024) {
    console.log(`- skip  ${file} (${Math.round(startSize / 1024)}KB, already small)`);
    before += startSize; after += startSize;
    continue;
  }

  // hasAlpha alone is not enough: many PNGs carry a fully opaque alpha channel.
  const stats = await img.stats();
  const transparent = meta.hasAlpha && stats.isOpaque === false;

  let pipeline = sharp(input).resize({
    width: Math.min(meta.width, MAX_WIDTH),
    withoutEnlargement: true
  });
  const ext = transparent ? '.png' : '.jpg';
  pipeline = transparent
    ? pipeline.png({ compressionLevel: 9, palette: true })
    : pipeline.jpeg({ quality: 82, mozjpeg: true });

  const buf = await pipeline.toBuffer();
  const target = path.join(dir, path.basename(file, path.extname(file)) + ext);
  const pct = Math.round((1 - buf.length / startSize) * 100);

  console.log(
    `- ${write ? 'wrote' : 'would'} ${file} -> ${path.basename(target)}  ` +
    `${Math.round(startSize / 1024)}KB -> ${Math.round(buf.length / 1024)}KB (-${pct}%)  ` +
    `${meta.width}x${meta.height} -> ${Math.min(meta.width, MAX_WIDTH)}px wide` +
    (transparent ? '  [kept PNG: transparent]' : '')
  );

  before += startSize;
  after += buf.length;

  if (write) {
    fs.writeFileSync(target, buf);
    // The original is deliberately left in place when the extension changes:
    // the database still points at the old name until it is repointed, and
    // deleting here would break every card between deploy and that update.
    if (target !== full) stale.push(file);
  }
}

console.log(
  `\nTotal ${Math.round(before / 1024)}KB -> ${Math.round(after / 1024)}KB ` +
  `(-${Math.round((1 - after / before) * 100)}%)` +
  (write ? '' : '\nRe-run with --write to apply.')
);

if (stale.length) {
  console.log(
    `\nStill referenced under the old name — deploy, repoint the database, then delete:\n` +
    stale.map(f => '  ' + f).join('\n')
  );
}
