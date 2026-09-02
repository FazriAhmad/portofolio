import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pg from 'pg';
import { seedProjects } from './projects-data.js';

const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '');
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? undefined : { rejectUnauthorized: false }
});

const app = express();
app.use(cors({ exposedHeaders: [], allowedHeaders: ['Content-Type', 'x-admin-token'] }));
// Bumped from Express's 100kb default so uploaded (base64) thumbnails fit; Vercel's own request limit is ~4.5mb.
app.use(express.json({ limit: '5mb' }));

// Everything the public site legitimately needs, and nothing else. Anything not
// listed here requires the admin token, so a route added later is protected by
// default rather than accidentally left open.
const PUBLIC_ROUTES = [
  ['GET', /^\/api\/projects$/],
  ['GET', /^\/api\/content$/],
  ['GET', /^\/api\/cv$/],
  ['GET', /^\/api\/cv\/(en|id)$/],
  ['POST', /^\/api\/projects\/\d+\/view$/],
  ['POST', /^\/api\/messages$/],          // the contact form
];

const ADMIN_TOKEN = process.env.ADMIN_TOKEN;

app.use((req, res, next) => {
  if (req.method === 'OPTIONS') return next();
  if (PUBLIC_ROUTES.some(([m, re]) => m === req.method && re.test(req.path))) return next();

  // Refusing outright when the server has no token configured: falling back to
  // "open" would silently restore the very hole this closes.
  if (!ADMIN_TOKEN) {
    return res.status(503).json({ error: 'ADMIN_TOKEN is not configured on the server' });
  }
  const sent = req.get('x-admin-token') || '';
  // Constant-length compare avoids leaking the token's length through timing.
  if (sent.length === ADMIN_TOKEN.length && timingSafeEqualStr(sent, ADMIN_TOKEN)) return next();
  res.status(401).json({ error: 'unauthorized' });
});

function timingSafeEqualStr(a, b) {
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

let ready;
function init() {
  if (!ready) {
    ready = (async () => {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS projects (
          id SERIAL PRIMARY KEY,
          title_en TEXT, title_id TEXT,
          description_en TEXT, description_id TEXT,
          longdesc_en TEXT, longdesc_id TEXT,
          image TEXT, link TEXT,
          tags TEXT[] DEFAULT '{}',
          category TEXT, views INT DEFAULT 0
        )
      `);
      const { rows } = await pool.query('SELECT COUNT(*) FROM projects');
      if (Number(rows[0].count) === 0) {
        for (const p of seedProjects) {
          await pool.query(
            `INSERT INTO projects (title_en, title_id, description_en, description_id, longdesc_en, longdesc_id, image, link, tags, category)
             VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10)`,
            [p.title_en, p.title_id, p.description_en, p.description_id, p.longdesc_en, p.longdesc_id, p.image, p.link, p.tags, p.category]
          );
        }
      }
      await pool.query(`
        CREATE TABLE IF NOT EXISTS cv_file (
          lang TEXT PRIMARY KEY CHECK (lang IN ('en', 'id')),
          filename TEXT,
          data TEXT
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS messages (
          id SERIAL PRIMARY KEY,
          name TEXT NOT NULL,
          email TEXT,
          body TEXT NOT NULL,
          read BOOLEAN DEFAULT FALSE,
          created_at TIMESTAMPTZ DEFAULT NOW()
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS site_content (
          id INT PRIMARY KEY DEFAULT 1,
          hero_title TEXT, hero_subtitle TEXT,
          about_en TEXT, about_id TEXT,
          skills TEXT[] DEFAULT '{}',
          whatsapp TEXT, email TEXT, linkedin TEXT,
          photo TEXT
        )
      `);
      // Added after the table shipped, so CREATE TABLE IF NOT EXISTS above would
      // never introduce them on an existing deployment — hence the explicit ALTERs.
      // Each holds a list of { period, title, org, desc }, one column per language.
      for (const col of ['education', 'career', 'achievements']) {
        for (const lang of ['en', 'id']) {
          await pool.query(
            `ALTER TABLE site_content ADD COLUMN IF NOT EXISTS ${col}_${lang} JSONB DEFAULT '[]'::jsonb`
          );
        }
      }
      await pool.query(
        `INSERT INTO site_content (id, hero_title, hero_subtitle, about_en, about_id, skills, whatsapp, email, linkedin, photo)
         VALUES (1, $1, $2, $3, $4, $5, $6, $7, $8, $9)
         ON CONFLICT (id) DO NOTHING`,
        [
          'Fazri Ahmad Mustaqim',
          'Fullstack Developer & IoT Enthusiast',
          `Fullstack Developer & IoT Enthusiast. With a background in Computer Engineering, I transitioned into web development and now build full-stack applications using React, Next.js, and Laravel — combining clean, functional interfaces with reliable backend systems. I'm also passionate about IoT, exploring how hardware and software intersect to solve real-world problems, and I keep exploring modern frontend tooling and API-driven architectures. "Code with heart, build for future."`,
          'Fullstack Developer & IoT Enthusiast. Berbekal ilmu Teknik Komputer, saya membangun aplikasi full-stack menggunakan React, Next.js, dan Laravel — memadukan antarmuka yang bersih dan fungsional dengan sistem backend yang andal. Saya juga tertarik pada IoT, mengeksplorasi perpaduan hardware dan software untuk menyelesaikan masalah nyata, serta terus mempelajari tooling frontend modern dan arsitektur berbasis API. "Code with heart, build for future."',
          ['Laravel', 'React', 'IoT', 'PHP', 'MySQL', 'ESP32', 'JavaScript', 'GIS', 'Docker'],
          '6281284020220',
          'fazriachmad898@gmail.com',
          'https://linkedin.com/in/fazriahmad',
          '/images/profile.jpg'
        ]
      );
    })();
  }
  return ready;
}
app.use((req, res, next) => { init().then(next).catch(next); });

// Public read-only data, so let Vercel's CDN answer most visits instead of
// waking a lambda and round-tripping to Postgres (~500ms) for every one of them.
// stale-while-revalidate keeps serving instantly while the refresh happens in the
// background, so an admin edit shows up within the minute without anyone waiting.
// max-age=0 keeps the *browser* revalidating every time (a cheap 304), while
// s-maxage lets Vercel's CDN absorb the load. Without it the browser applies its
// own heuristic freshness and can serve an edit-stale copy for minutes — which
// is exactly what happened after repointing image paths.
const publicCache = (res) =>
  res.set('Cache-Control', 'public, max-age=0, s-maxage=60, stale-while-revalidate=600');

const toProject = (row) => ({
  id: row.id,
  title: { en: row.title_en, id: row.title_id },
  description: { en: row.description_en, id: row.description_id },
  longDesc: { en: row.longdesc_en, id: row.longdesc_id },
  image: row.image,
  link: row.link,
  tags: row.tags,
  category: row.category,
  views: row.views
});

app.get('/api/projects', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM projects ORDER BY id');
  publicCache(res);
  res.json(rows.map(toProject));
});

app.post('/api/projects', async (req, res) => {
  const { title, description, image, link, tags, category } = req.body;
  const { rows } = await pool.query(
    `INSERT INTO projects (title_en, title_id, description_en, description_id, longdesc_en, longdesc_id, image, link, tags, category)
     VALUES ($1,$1,$2,$2,$2,$2,$3,$4,$5,$6) RETURNING *`,
    [title, description, image, link, tags, category]
  );
  res.status(201).json(toProject(rows[0]));
});

const LANG_FIELDS = { title: 'title', description: 'description', longDesc: 'longdesc' };
const PLAIN_FIELDS = ['image', 'link', 'category', 'tags'];

app.patch('/api/projects/:id', async (req, res) => {
  const { field, lang, value } = req.body;
  let column, val = value;

  if (LANG_FIELDS[field]) {
    if (!['en', 'id'].includes(lang)) return res.status(400).json({ error: 'invalid lang' });
    column = `${LANG_FIELDS[field]}_${lang}`;
  } else if (PLAIN_FIELDS.includes(field)) {
    column = field;
    if (field === 'tags') val = Array.isArray(value) ? value : String(value).split(',').map(s => s.trim()).filter(Boolean);
  } else {
    return res.status(400).json({ error: 'invalid field' });
  }

  const { rows } = await pool.query(
    `UPDATE projects SET ${column} = $1 WHERE id = $2 RETURNING *`,
    [val, req.params.id]
  );
  if (!rows[0]) return res.status(404).end();
  res.json(toProject(rows[0]));
});

app.post('/api/projects/:id/view', async (req, res) => {
  const { rows } = await pool.query(
    'UPDATE projects SET views = views + 1 WHERE id = $1 RETURNING *',
    [req.params.id]
  );
  if (!rows[0]) return res.status(404).end();
  res.json(toProject(rows[0]));
});

app.delete('/api/projects/:id', async (req, res) => {
  await pool.query('DELETE FROM projects WHERE id = $1', [req.params.id]);
  res.status(204).end();
});

// Metadata only (no base64 payload) — cheap to load on every page visit.
app.get('/api/cv', async (req, res) => {
  const { rows } = await pool.query('SELECT lang, filename FROM cv_file');
  const byLang = { en: { filename: null }, id: { filename: null } };
  for (const r of rows) byLang[r.lang] = { filename: r.filename };
  publicCache(res);
  res.json(byLang);
});

// Full file (with base64 data) — fetched on demand when the visitor actually clicks download.
app.get('/api/cv/:lang', async (req, res) => {
  if (!['en', 'id'].includes(req.params.lang)) return res.status(400).json({ error: 'invalid lang' });
  const { rows } = await pool.query('SELECT filename, data FROM cv_file WHERE lang = $1', [req.params.lang]);
  res.json(rows[0] || { filename: null, data: null });
});

app.put('/api/cv/:lang', async (req, res) => {
  if (!['en', 'id'].includes(req.params.lang)) return res.status(400).json({ error: 'invalid lang' });
  const { filename, data } = req.body;
  if (!filename || !data) return res.status(400).json({ error: 'filename and data required' });
  await pool.query(
    `INSERT INTO cv_file (lang, filename, data) VALUES ($1, $2, $3)
     ON CONFLICT (lang) DO UPDATE SET filename = $2, data = $3`,
    [req.params.lang, filename, data]
  );
  res.json({ filename, data });
});

app.delete('/api/cv/:lang', async (req, res) => {
  if (!['en', 'id'].includes(req.params.lang)) return res.status(400).json({ error: 'invalid lang' });
  await pool.query('DELETE FROM cv_file WHERE lang = $1', [req.params.lang]);
  res.status(204).end();
});

const toMessage = (row) => ({
  id: row.id,
  name: row.name,
  email: row.email,
  body: row.body,
  read: row.read,
  createdAt: row.created_at
});

// Never cached: the admin inbox has to show a message the moment it arrives.
app.get('/api/messages', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM messages ORDER BY created_at DESC');
  res.json(rows.map(toMessage));
});

// Public — this is what the contact form posts to. Bounded so a bot cannot
// stuff the table with megabytes; the field limits mirror the form's own.
app.post('/api/messages', async (req, res) => {
  const name = String(req.body.name ?? '').trim().slice(0, 120);
  const email = String(req.body.email ?? '').trim().slice(0, 200);
  const body = String(req.body.body ?? '').trim().slice(0, 4000);
  if (!name || !body) return res.status(400).json({ error: 'name and body required' });
  const { rows } = await pool.query(
    'INSERT INTO messages (name, email, body) VALUES ($1,$2,$3) RETURNING *',
    [name, email, body]
  );
  res.status(201).json(toMessage(rows[0]));
});

app.patch('/api/messages/:id', async (req, res) => {
  const { rows } = await pool.query(
    'UPDATE messages SET read = $1 WHERE id = $2 RETURNING *',
    [!!req.body.read, req.params.id]
  );
  if (!rows[0]) return res.status(404).end();
  res.json(toMessage(rows[0]));
});

app.delete('/api/messages/:id', async (req, res) => {
  await pool.query('DELETE FROM messages WHERE id = $1', [req.params.id]);
  res.status(204).end();
});

const toContent = (row) => ({
  heroTitle: row.hero_title,
  heroSubtitle: row.hero_subtitle,
  about: { en: row.about_en, id: row.about_id },
  skills: row.skills,
  whatsapp: row.whatsapp,
  email: row.email,
  linkedin: row.linkedin,
  photo: row.photo,
  education: { en: row.education_en ?? [], id: row.education_id ?? [] },
  career: { en: row.career_en ?? [], id: row.career_id ?? [] },
  achievements: { en: row.achievements_en ?? [], id: row.achievements_id ?? [] }
});

app.get('/api/content', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM site_content WHERE id = 1');
  publicCache(res);
  res.json(toContent(rows[0]));
});

const CONTENT_LANG_FIELDS = {
  about: 'about', education: 'education', career: 'career', achievements: 'achievements'
};
// Stored as jsonb, so the value is sent as a JSON string and cast on the way in.
const CONTENT_JSON_FIELDS = new Set(['education', 'career', 'achievements']);
const CONTENT_PLAIN_COLUMNS = {
  heroTitle: 'hero_title', heroSubtitle: 'hero_subtitle',
  skills: 'skills', whatsapp: 'whatsapp', email: 'email', linkedin: 'linkedin', photo: 'photo'
};

app.patch('/api/content', async (req, res) => {
  const { field, lang, value } = req.body;
  let column, val = value, cast = '';

  if (CONTENT_LANG_FIELDS[field]) {
    if (!['en', 'id'].includes(lang)) return res.status(400).json({ error: 'invalid lang' });
    column = `${CONTENT_LANG_FIELDS[field]}_${lang}`;
    if (CONTENT_JSON_FIELDS.has(field)) {
      if (!Array.isArray(value)) return res.status(400).json({ error: `${field} must be an array` });
      val = JSON.stringify(value);
      cast = '::jsonb';
    }
  } else if (CONTENT_PLAIN_COLUMNS[field]) {
    column = CONTENT_PLAIN_COLUMNS[field];
    if (field === 'skills') val = Array.isArray(value) ? value : String(value).split(',').map(s => s.trim()).filter(Boolean);
  } else {
    return res.status(400).json({ error: 'invalid field' });
  }

  const { rows } = await pool.query(
    `UPDATE site_content SET ${column} = $1${cast} WHERE id = 1 RETURNING *`,
    [val]
  );
  res.json(toContent(rows[0]));
});

export default app;
