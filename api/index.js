import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import pg from 'pg';

const isLocal = /localhost|127\.0\.0\.1/.test(process.env.DATABASE_URL || '');
const pool = new pg.Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: isLocal ? undefined : { rejectUnauthorized: false }
});

const app = express();
app.use(cors());
// Bumped from Express's 100kb default so uploaded (base64) thumbnails fit; Vercel's own request limit is ~4.5mb.
app.use(express.json({ limit: '5mb' }));

const seedProjects = [
  { title_en: "Japanese Flash Card", title_id: "Flash Card Kata Jepang",
    description_en: "Interactive platform to learn Hiragana & Katakana", description_id: "Platform interaktif untuk mempelajari Hiragana & Katakana dengan metode pengulangan cerdas",
    longdesc_en: "Interactive platform to learn Hiragana & Katakana with a smart spaced-repetition method.", longdesc_id: "Platform interaktif untuk mempelajari Hiragana & Katakana dengan metode pengulangan cerdas.",
    image: "/images/flashcard.png", link: "https://flascard-japan.netlify.app", tags: ["React", "Web App"], category: "Education Tech" },
  { title_en: "Money Manager", title_id: "Money Manager",
    description_en: "Personal finance dashboard with cash flow insights", description_id: "Dashboard finansial pribadi untuk memantau arus kas dengan visualisasi data yang informatif",
    longdesc_en: "Personal finance dashboard to monitor cash flow with informative data visualizations.", longdesc_id: "Dashboard finansial pribadi untuk memantau arus kas dengan visualisasi data yang informatif.",
    image: "/images/money.png", link: "", tags: ["Laravel", "MySQL"], category: "In Progress" },
  { title_en: "IoT Waste Sorter", title_id: "IoT Pemilah Sampah",
    description_en: "ESP32-based smart metal/non-metal waste sorting", description_id: "Sistem cerdas berbasis ESP32 untuk memilah sampah logam dan non-logam secara otomatis",
    longdesc_en: "Smart ESP32-based system that automatically sorts metal and non-metal waste.", longdesc_id: "Sistem cerdas berbasis ESP32 untuk memilah sampah logam dan non-logam secara otomatis.",
    image: "/images/iot.png", link: "https://www.youtube.com/watch?v=x6azcS7iumg", tags: ["ESP32", "Sensors"], category: "IoT" },
  { title_en: "Sebaran Masjid Bandung", title_id: "Sebaran Masjid Bandung",
    description_en: "Mosque location mapping app for Bandung", description_id: "Aplikasi pemetaan lokasi masjid di area Bandung untuk mempermudah pencarian tempat ibadah",
    longdesc_en: "Mapping application for mosque locations across Bandung to make finding places of worship easier.", longdesc_id: "Aplikasi pemetaan lokasi masjid di area Bandung untuk mempermudah pencarian tempat ibadah.",
    image: "/images/masjid.png", link: "https://sebaran-masjid-bandung.free.je/masjid.php", tags: ["PHP", "GIS"], category: "Web App" },
  { title_en: "Shiritori Zen", title_id: "Shiritori Zen",
    description_en: "Traditional Japanese word-chain game, modern UI", description_id: "Game sambung kata tradisional Jepang yang dikemas dengan UI modern dan minimalis",
    longdesc_en: "Traditional Japanese word-chain game wrapped in a modern, minimal UI.", longdesc_id: "Game sambung kata tradisional Jepang yang dikemas dengan UI modern dan minimalis.",
    image: "/images/shiritorizen.png", link: "https://game-kata-fazriahmads-projects.vercel.app/", tags: ["JS", "Gaming"], category: "Gaming" },
  { title_en: "Video Tutorial Apps", title_id: "Video Tutorial Apps",
    description_en: "In-depth tutorials on my own apps' features", description_id: "Produksi konten tutorial mendalam mengenai penggunaan fitur-fitur aplikasi buatan saya",
    longdesc_en: "Producing in-depth tutorial content covering the features of apps I built.", longdesc_id: "Produksi konten tutorial mendalam mengenai penggunaan fitur-fitur aplikasi buatan saya.",
    image: "/images/panduan.png", link: "https://www.youtube.com/watch?v=ujRnZO3aUGU", tags: ["Content", "Youtube"], category: "Content" }
];

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
        CREATE TABLE IF NOT EXISTS site_content (
          id INT PRIMARY KEY DEFAULT 1,
          hero_title TEXT, hero_subtitle TEXT,
          about_en TEXT, about_id TEXT,
          skills TEXT[] DEFAULT '{}',
          whatsapp TEXT, email TEXT, linkedin TEXT,
          photo TEXT
        )
      `);
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

const toContent = (row) => ({
  heroTitle: row.hero_title,
  heroSubtitle: row.hero_subtitle,
  about: { en: row.about_en, id: row.about_id },
  skills: row.skills,
  whatsapp: row.whatsapp,
  email: row.email,
  linkedin: row.linkedin,
  photo: row.photo
});

app.get('/api/content', async (req, res) => {
  const { rows } = await pool.query('SELECT * FROM site_content WHERE id = 1');
  res.json(toContent(rows[0]));
});

const CONTENT_LANG_FIELDS = { about: 'about' };
const CONTENT_PLAIN_COLUMNS = {
  heroTitle: 'hero_title', heroSubtitle: 'hero_subtitle',
  skills: 'skills', whatsapp: 'whatsapp', email: 'email', linkedin: 'linkedin', photo: 'photo'
};

app.patch('/api/content', async (req, res) => {
  const { field, lang, value } = req.body;
  let column, val = value;

  if (CONTENT_LANG_FIELDS[field]) {
    if (!['en', 'id'].includes(lang)) return res.status(400).json({ error: 'invalid lang' });
    column = `${CONTENT_LANG_FIELDS[field]}_${lang}`;
  } else if (CONTENT_PLAIN_COLUMNS[field]) {
    column = CONTENT_PLAIN_COLUMNS[field];
    if (field === 'skills') val = Array.isArray(value) ? value : String(value).split(',').map(s => s.trim()).filter(Boolean);
  } else {
    return res.status(400).json({ error: 'invalid field' });
  }

  const { rows } = await pool.query(
    `UPDATE site_content SET ${column} = $1 WHERE id = 1 RETURNING *`,
    [val]
  );
  res.json(toContent(rows[0]));
});

export default app;
