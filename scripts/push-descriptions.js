// Push the descriptions in api/projects-data.js into an already-seeded database.
// The seed array only applies to an empty table, so this is how an existing
// deployment gets updated copy.
//
//   node scripts/push-descriptions.js                     -> http://localhost:4000
//   node scripts/push-descriptions.js https://your-api    -> anywhere else
//
// Matches rows by English title. Existing rows keep their image, link, and view
// count — only description, longDesc, and tags are overwritten. A project with
// no matching row is created, since seeding only ever runs on an empty table.

import { seedProjects } from '../api/projects-data.js';

const API = process.argv[2] || 'http://localhost:4000';

// Writing is authenticated now, so the same token the dashboard uses has to be
// present here too: ADMIN_TOKEN=... node scripts/push-descriptions.js <url>
const TOKEN = process.env.ADMIN_TOKEN;
if (!TOKEN) {
  console.error('Set ADMIN_TOKEN before running this (it must match the API\'s own).');
  process.exit(1);
}
const authHeaders = { 'Content-Type': 'application/json', 'x-admin-token': TOKEN };

async function patch(id, body) {
  const res = await fetch(`${API}/api/projects/${id}`, {
    method: 'PATCH',
    headers: authHeaders,
    body: JSON.stringify(body)
  });
  if (!res.ok) throw new Error(`PATCH ${id} ${JSON.stringify(body).slice(0, 60)} -> ${res.status}`);
}

async function create(p) {
  const res = await fetch(`${API}/api/projects`, {
    method: 'POST',
    headers: authHeaders,
    body: JSON.stringify({
      title: p.title_en, description: p.description_en,
      image: p.image, link: p.link, tags: p.tags, category: p.category
    })
  });
  if (!res.ok) throw new Error(`POST ${p.title_en} -> ${res.status}`);
  return res.json();
}

const existing = await fetch(`${API}/api/projects`).then(r => r.json());
let updated = 0, created = 0;

for (const p of seedProjects) {
  let row = existing.find(e => e.title.en === p.title_en);
  const isNew = !row;
  if (isNew) row = await create(p);
  for (const lang of ['en', 'id']) {
    await patch(row.id, { field: 'description', lang, value: p[`description_${lang}`] });
    await patch(row.id, { field: 'longDesc', lang, value: p[`longdesc_${lang}`] });
  }
  await patch(row.id, { field: 'tags', value: p.tags });
  console.log(`- ${isNew ? 'created' : 'updated'}: ${p.title_en}`);
  isNew ? created++ : updated++;
}

const extra = existing.filter(e => !seedProjects.some(p => p.title_en === e.title.en));
for (const e of extra) console.log(`- left alone (only exists at target): ${e.title.en}`);

console.log(`\n${updated} updated, ${created} created at ${API}`);
