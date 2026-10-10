// Deletes images in the images table that nothing points at any more — what is
// left behind when an entry's image is replaced or the entry itself is removed.
//
//   node scripts/clean-unused-images.js [apiUrl]                 report only
//   ADMIN_TOKEN=... node scripts/... [apiUrl] --apply            delete them
//   node scripts/clean-unused-images.js --selftest               check the matching
//
// Two guards, because this destroys data:
//   - an image counts as referenced if its id appears anywhere in the projects
//     or content JSON, so a reference in a field added later still protects it
//   - an image younger than --min-age-hours (default 24) is never touched: one
//     uploaded a moment ago has not been attached to its entry yet, and would
//     otherwise look exactly like an orphan

const ID_IN_TEXT = /\/api\/images\/([a-f0-9]{32})/g;

/** Every image id referenced anywhere in the given JSON-serialisable values. */
export function referencedIds(...docs) {
  const found = new Set();
  for (const doc of docs) {
    for (const m of JSON.stringify(doc ?? null).matchAll(ID_IN_TEXT)) found.add(m[1]);
  }
  return found;
}

/** Stored images that nothing references and that are old enough to be safe. */
export function orphans(stored, referenced, now, minAgeMs) {
  return stored.filter(img =>
    !referenced.has(img.id) && now - new Date(img.created_at).getTime() >= minAgeMs
  );
}

function selftest() {
  const assert = (cond, msg) => { if (!cond) { console.error('FAIL:', msg); process.exit(1); } };
  const A = 'a'.repeat(32), B = 'b'.repeat(32), C = 'c'.repeat(32);

  const refs = referencedIds(
    [{ image: `/api/images/${A}` }],
    { photo: '/images/profile.jpg', achievements: { id: [{ image: `/api/images/${B}` }] } }
  );
  assert(refs.has(A) && refs.has(B), 'finds ids in both documents');
  assert(!refs.has(C), 'does not invent ids');
  assert(refs.size === 2, 'finds exactly the two');

  const now = Date.parse('2026-01-02T00:00:00Z');
  const day = 24 * 60 * 60 * 1000;
  const stored = [
    { id: A, created_at: '2026-01-01T00:00:00Z' },  // referenced, old
    { id: C, created_at: '2026-01-01T00:00:00Z' },  // unreferenced, old   -> orphan
    { id: B, created_at: '2026-01-01T23:00:00Z' },  // referenced, young
    { id: 'd'.repeat(32), created_at: '2026-01-01T23:00:00Z' }, // unreferenced but young
  ];
  const got = orphans(stored, refs, now, day).map(o => o.id);
  assert(got.length === 1 && got[0] === C, `only the old unreferenced one, got ${JSON.stringify(got)}`);

  // An id mentioned in any field at all protects the image.
  assert(orphans([{ id: C, created_at: '2026-01-01T00:00:00Z' }],
    referencedIds({ anything: `see /api/images/${C} here` }), now, day).length === 0,
    'a mention anywhere counts as a reference');

  console.log('selftest OK');
}

const args = process.argv.slice(2);
if (args.includes('--selftest')) { selftest(); process.exit(0); }

const apply = args.includes('--apply');
const API = args.find(a => !a.startsWith('--')) || 'http://localhost:4000';
const minAgeHours = Number(
  (args.find(a => a.startsWith('--min-age-hours=')) || '').split('=')[1] ?? 24
);
const TOKEN = process.env.ADMIN_TOKEN;

if (!TOKEN) {
  console.error('Set ADMIN_TOKEN — listing stored images is an admin action.');
  process.exit(1);
}
if (!Number.isFinite(minAgeHours) || minAgeHours < 0) {
  console.error('--min-age-hours must be a non-negative number.');
  process.exit(1);
}

const authHeaders = { 'x-admin-token': TOKEN };
const get = async path => {
  const r = await fetch(`${API}${path}`, { headers: authHeaders });
  if (!r.ok) throw new Error(`GET ${path} -> ${r.status}`);
  return r.json();
};

const [stored, projects, content] = await Promise.all([
  get('/api/images'),
  get(`/api/projects?f=${Date.now()}`),
  get(`/api/content?f=${Date.now()}`)
]);

const referenced = referencedIds(projects, content);
const dead = orphans(stored, referenced, Date.now(), minAgeHours * 3600_000);
const youngSkipped = stored.filter(i =>
  !referenced.has(i.id) && Date.now() - new Date(i.created_at).getTime() < minAgeHours * 3600_000
);

console.log(`${stored.length} stored, ${referenced.size} referenced, ${dead.length} unused and older than ${minAgeHours}h`);
if (youngSkipped.length) {
  console.log(`${youngSkipped.length} unused but too recent to touch — they may be mid-edit`);
}

let freed = 0;
for (const img of dead) {
  freed += Number(img.size) || 0;
  console.log(`- ${apply ? 'deleted' : 'would delete'} ${img.id} (${Math.round((img.size || 0) / 1024)}KB, ${img.mime}, ${String(img.created_at).slice(0, 10)})`);
  if (apply) {
    const r = await fetch(`${API}/api/images/${img.id}`, { method: 'DELETE', headers: authHeaders });
    if (!r.ok) throw new Error(`DELETE ${img.id} -> ${r.status}`);
  }
}

console.log(
  dead.length
    ? `\n${Math.round(freed / 1024)}KB ${apply ? 'freed' : 'would be freed'}.` +
      (apply ? '' : '\nRe-run with --apply to delete them.')
    : '\nNothing to clean.'
);
