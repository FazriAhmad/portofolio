// Moves data: URLs still stored in project rows and in the About lists into the
// images table, replacing each with its /api/images/<id> URL.
//
// Uploads from the admin panel used to be inlined, so they travelled inside
// every /api/projects and /api/content response. This clears what is already
// stored; new uploads go straight to the table.
//
//   node scripts/migrate-inline-images.js [apiUrl]            report only
//   ADMIN_TOKEN=... node scripts/... [apiUrl] --apply         move them

const args = process.argv.slice(2);
const apply = args.includes('--apply');
const API = args.find(a => !a.startsWith('--')) || 'http://localhost:4000';
const TOKEN = process.env.ADMIN_TOKEN;

if (apply && !TOKEN) {
  console.error('Set ADMIN_TOKEN to run with --apply.');
  process.exit(1);
}

const authHeaders = { 'Content-Type': 'application/json', 'x-admin-token': TOKEN ?? '' };
const isInline = v => typeof v === 'string' && v.startsWith('data:');
const kb = s => Math.round(s.length / 1024);

async function store(dataUrl) {
  const res = await fetch(`${API}/api/images`, {
    method: 'POST', headers: authHeaders, body: JSON.stringify({ dataUrl })
  });
  if (!res.ok) throw new Error(`POST /api/images -> ${res.status}`);
  return (await res.json()).url;
}

let moved = 0, freed = 0;

// --- projects -------------------------------------------------------------
const projects = await fetch(`${API}/api/projects?f=${Date.now()}`).then(r => r.json());
for (const p of projects) {
  if (!isInline(p.image)) continue;
  console.log(`- ${apply ? 'moving' : 'would move'} project "${p.title.en}" (${kb(p.image)}KB)`);
  freed += p.image.length;
  moved++;
  if (!apply) continue;
  const url = await store(p.image);
  const res = await fetch(`${API}/api/projects/${p.id}`, {
    method: 'PATCH', headers: authHeaders, body: JSON.stringify({ field: 'image', value: url })
  });
  if (!res.ok) throw new Error(`PATCH project ${p.id} -> ${res.status}`);
  console.log(`    -> ${url}`);
}

// --- site content: the photo, and every timeline entry --------------------
const content = await fetch(`${API}/api/content?f=${Date.now()}`).then(r => r.json());

if (isInline(content.photo)) {
  console.log(`- ${apply ? 'moving' : 'would move'} profile photo (${kb(content.photo)}KB)`);
  freed += content.photo.length;
  moved++;
  if (apply) {
    const url = await store(content.photo);
    const res = await fetch(`${API}/api/content`, {
      method: 'PATCH', headers: authHeaders, body: JSON.stringify({ field: 'photo', value: url })
    });
    if (!res.ok) throw new Error(`PATCH photo -> ${res.status}`);
    console.log(`    -> ${url}`);
  }
}

for (const field of ['education', 'career', 'achievements']) {
  for (const lang of ['en', 'id']) {
    const list = content[field]?.[lang] ?? [];
    if (!list.some(e => isInline(e.image))) continue;

    const next = [];
    for (const entry of list) {
      if (!isInline(entry.image)) { next.push(entry); continue; }
      console.log(`- ${apply ? 'moving' : 'would move'} ${field}.${lang} "${(entry.title || '(untitled)').slice(0, 34)}" (${kb(entry.image)}KB)`);
      freed += entry.image.length;
      moved++;
      next.push(apply ? { ...entry, image: await store(entry.image) } : entry);
    }

    if (apply) {
      const res = await fetch(`${API}/api/content`, {
        method: 'PATCH', headers: authHeaders, body: JSON.stringify({ field, lang, value: next })
      });
      if (!res.ok) throw new Error(`PATCH ${field}.${lang} -> ${res.status}`);
    }
  }
}

console.log(
  moved
    ? `\n${moved} image(s), ${Math.round(freed / 1024)}KB out of the JSON payloads.` +
      (apply ? '' : '\nRe-run with --apply (and ADMIN_TOKEN set) to move them.')
    : '\nNo inline images left.'
);
