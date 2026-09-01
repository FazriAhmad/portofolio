import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Moon, Sun, Globe, Download,
  Menu, X, ExternalLink, Mail, Phone,
  GraduationCap, Briefcase, Award, MapPin
} from 'lucide-react';

import type { Project, TimelineEntry, SiteContent, Message, TimelineField } from './types';

// The dashboard is only ever opened by the owner, so it is split out of the
// visitor's bundle and fetched on demand.
const Admin = React.lazy(() => import('./Admin'));

// longDesc uses a flat "## Heading" convention (see api/projects-data.js) so the
// detail sections still fit the one TEXT column and the one admin textarea that
// already exist. Text with no headings renders as a single lead paragraph, which
// keeps older project copy working unchanged.
function LongDesc({ text }: { text: string }) {
  return (
    <div className="mb-9">
      {text.split(/\n(?=## )/).map((block, i) => {
        const match = block.match(/^## (.+?)(?:\n([\s\S]*))?$/);
        if (!match) {
          return <p key={i} className="text-2xl leading-tight text-zinc-600 dark:text-zinc-400">{block.trim()}</p>;
        }
        const [, heading, body] = match;
        const nodes: React.ReactNode[] = [];
        let bullets: string[] = [];
        const flushBullets = () => {
          if (!bullets.length) return;
          nodes.push(
            <ul key={nodes.length} className="list-disc pl-5 space-y-1.5 text-zinc-600 dark:text-zinc-400 leading-relaxed">
              {bullets.map((b, j) => <li key={j}>{b}</li>)}
            </ul>
          );
          bullets = [];
        };
        for (const line of (body ?? '').trim().split('\n').filter(Boolean)) {
          if (line.startsWith('- ')) {
            bullets.push(line.slice(2));
          } else {
            flushBullets();
            nodes.push(<p key={nodes.length} className="text-zinc-600 dark:text-zinc-400 leading-relaxed">{line}</p>);
          }
        }
        flushBullets();
        return (
          <div key={i} className="mb-7">
            <div className="uppercase tracking-[2px] text-teal-600 text-xs font-medium mb-2">{heading}</div>
            {nodes}
          </div>
        );
      })}
    </div>
  );
}

// Renders nothing at all when the list is empty, so a section the admin has not
// filled in yet leaves no empty heading behind on the public page.
function Timeline({ title, entries, icon: Icon }: {
  title: string;
  entries: TimelineEntry[];
  icon: typeof GraduationCap;
}) {
  // A row added in the admin panel and then left blank must not surface as an
  // empty heading with a floating marker, so blank rows are dropped here and the
  // section disappears entirely once nothing is left.
  const visible = (entries ?? []).filter(e =>
    [e.period, e.title, e.org, e.location, e.desc, e.image].some(v => v && v.trim())
  );
  if (!visible.length) return null;
  return (
    <div className="mb-12">
      <div className="flex items-center gap-2 mb-5">
        <Icon size={16} className="text-teal-600" />
        <div className="uppercase tracking-[3px] text-teal-600 text-xs font-medium">{title}</div>
      </div>
      <div className="border-l border-zinc-200 dark:border-zinc-800 pl-8 space-y-7">
        {visible.map((e, i) => (
          <div key={i} className="relative">
            {/* Marker sits on the rule: the entry's own logo when it has one,
                otherwise the section icon, so mixed rows still line up. */}
            <span className="absolute -left-[46px] -top-0.5 w-7 h-7 flex items-center justify-center rounded-full overflow-hidden bg-white dark:bg-zinc-950 ring-1 ring-zinc-200 dark:ring-zinc-800">
              {e.image
                ? <img src={e.image} alt="" className="w-full h-full object-contain p-0.5" decoding="async" />
                : <Icon size={15} className="text-teal-600" />}
            </span>
            {e.period && <div className="text-sm text-zinc-500 mb-1">{e.period}</div>}
            {e.title && <div className="text-xl font-semibold tracking-tight">{e.title}</div>}
            {e.org && <div className="text-zinc-600 dark:text-zinc-400">{e.org}</div>}
            {e.location && (
              <div className="flex items-center gap-1.5 text-sm text-zinc-500 mt-1">
                <MapPin size={13} className="shrink-0" />
                <span>{e.location}</span>
              </div>
            )}
            {e.desc && <p className="text-zinc-600 dark:text-zinc-400 mt-2 leading-relaxed">{e.desc}</p>}
          </div>
        ))}
      </div>
    </div>
  );
}

interface Analytics {
  pageViews: { [key: string]: number };
  projectViews: { [key: number]: number };
  cvDownloads: number;
  trafficSources: { [key: string]: number };
  contactSubmissions: number;
}

// Project data lives in Postgres now, served by server/index.js
// Dev: hits the local server (npm start in server/). Prod on Vercel: same domain, relative /api.
const API_BASE = import.meta.env.VITE_API_URL || (import.meta.env.DEV ? 'http://localhost:4000' : '');

const translations = {
  en: {
    nav: { home: "Home", about: "About", projects: "Projects", skills: "Skills", contact: "Contact" },
    hero: { cta: "View Projects", cv: "Download CV" },
    about: { title: "About Me", education: "Education", career: "Career", achievements: "Achievements" },
    projects: { title: "Featured Projects", detail: "View Details" },
    skills: { title: "Skills & Expertise" },
    contact: {
      title: "Let's Connect", formTitle: "Send a message",
      name: "Your name", email: "Email (optional)", message: "Message",
      send: "Send message", sending: "Sending…", sent: "Thanks — I'll get back to you.",
      error: "Could not send. Try WhatsApp or email above."
    },
    cv: { downloads: "CV Downloads" },
    analytics: { pageViews: "Page Views", projectViews: "Project Views", traffic: "Traffic Sources", downloads: "CV Downloads" },
    lang: "EN", langSwitch: "Switch to Indonesian"
  },
  id: {
    nav: { home: "Beranda", about: "Tentang", projects: "Proyek", skills: "Keahlian", contact: "Kontak" },
    hero: { cta: "Lihat Proyek", cv: "Unduh CV" },
    about: { title: "Tentang Saya", education: "Pendidikan", career: "Karier", achievements: "Pencapaian" },
    projects: { title: "Proyek Unggulan", detail: "Lihat Detail" },
    skills: { title: "Keahlian & Keterampilan" },
    contact: {
      title: "Mari Terhubung", formTitle: "Kirim pesan",
      name: "Nama kamu", email: "Email (opsional)", message: "Pesan",
      send: "Kirim pesan", sending: "Mengirim…", sent: "Terima kasih — saya akan segera membalas.",
      error: "Gagal mengirim. Coba WhatsApp atau email di atas."
    },
    cv: { downloads: "Unduhan CV" },
    analytics: { pageViews: "Tampilan Halaman", projectViews: "Tampilan Proyek", traffic: "Sumber Trafik", downloads: "Unduhan CV" },
    lang: "ID", langSwitch: "Beralih ke English"
  }
};

const defaultContent: SiteContent = {
  heroTitle: 'Fazri Ahmad Mustaqim',
  heroSubtitle: 'Fullstack Developer & IoT Enthusiast',
  about: { en: '', id: '' },
  skills: ["Laravel", "React", "IoT", "PHP", "MySQL", "ESP32", "JavaScript", "GIS", "Docker"],
  whatsapp: '6281284020220',
  email: 'fazriachmad898@gmail.com',
  linkedin: 'https://linkedin.com/in/fazriahmad',
  photo: '/images/profile.jpg',
  education: { en: [], id: [] },
  career: { en: [], id: [] },
  achievements: { en: [], id: [] }
};

// ponytail: password client-side & hardcode, cukup buat sembunyiin dari pengunjung biasa,
// BUKAN keamanan sungguhan (siapa pun bisa baca dari source JS). Upgrade ke backend auth kalau serius.
const ADMIN_PASSWORD = "fazri2026";
const emptyProjectForm = { title: '', description: '', image: '', link: '', tags: '', category: '' };

// Resizes/compresses an uploaded image client-side and returns a data: URL,
// so it stays well under Vercel's request body size limit and fits comfortably in a TEXT column.
// mime is worth overriding for logos: JPEG has no alpha channel, so a
// transparent PNG logo would gain a solid box that shows up against dark mode.
function fileToCompressedDataUrl(file: File, maxDim = 1200, quality = 0.82, mime = 'image/jpeg'): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => {
      const img = new Image();
      img.onerror = reject;
      img.onload = () => {
        const scale = Math.min(1, maxDim / Math.max(img.width, img.height));
        const w = Math.round(img.width * scale);
        const h = Math.round(img.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = w;
        canvas.height = h;
        const ctx = canvas.getContext('2d');
        if (!ctx) return reject(new Error('canvas not supported'));
        ctx.drawImage(img, 0, 0, w, h);
        resolve(canvas.toDataURL(mime, quality));
      };
      img.src = reader.result as string;
    };
    reader.readAsDataURL(file);
  });
}

function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(reader.error);
    reader.onload = () => resolve(reader.result as string);
    reader.readAsDataURL(file);
  });
}

// Main App Component
function Portfolio() {
  const [lang, setLang] = useState<'en' | 'id'>('en');
  const [darkMode, setDarkMode] = useState(true);
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [selectedProject, setSelectedProject] = useState<Project | null>(null);
  const [showAdmin, setShowAdmin] = useState(false);
  const [isAdmin, setIsAdmin] = useState(false);
  const [newProject, setNewProject] = useState(emptyProjectForm);
  const [analytics, setAnalytics] = useState<Analytics>({
    pageViews: {}, projectViews: {}, cvDownloads: 0, trafficSources: { Organic: 48, Social: 22, Direct: 30 }, contactSubmissions: 0
  });
  const [projects, setProjects] = useState<Project[]>([]);
  const [projectsLoaded, setProjectsLoaded] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [contactForm, setContactForm] = useState({ name: '', email: '', body: '' });
  const [sendState, setSendState] = useState<'idle' | 'sending' | 'sent' | 'error'>('idle');
  const [activeSection, setActiveSection] = useState('home');
  const [cv, setCv] = useState<{ en: { filename: string | null }; id: { filename: string | null } }>({
    en: { filename: null }, id: { filename: null }
  });
  const [content, setContent] = useState<SiteContent>(defaultContent);

  const t = translations[lang];

  // Projects now come from the Postgres-backed API
  useEffect(() => {
    fetch(`${API_BASE}/api/projects`)
      .then(r => r.json())
      .then(setProjects)
      .catch(console.error)
      .finally(() => setProjectsLoaded(true));
  }, []);

  useEffect(() => {
    fetch(`${API_BASE}/api/cv`).then(r => r.json()).then(setCv).catch(console.error);
  }, []);

  useEffect(() => {
    // Merged over the defaults rather than replacing them: an API response that
    // predates a field (a frontend deployed ahead of its migration, say) would
    // otherwise leave content.education undefined and take the whole page down
    // on the first render that reads it.
    fetch(`${API_BASE}/api/content`)
      .then(r => r.json())
      .then(c => setContent({ ...defaultContent, ...c }))
      .catch(console.error);
  }, []);

  // Site content (hero, about, skills, contact, photo) — persisted in Postgres via the API
  const updateContent = (field: 'heroTitle' | 'heroSubtitle' | 'whatsapp' | 'email' | 'linkedin' | 'photo', value: string) => {
    setContent(prev => ({ ...prev, [field]: value }));
    fetch(`${API_BASE}/api/content`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, value })
    }).catch(console.error);
  };

  const updateAbout = (aboutLang: 'en' | 'id', value: string) => {
    setContent(prev => ({ ...prev, about: { ...prev.about, [aboutLang]: value } }));
    fetch(`${API_BASE}/api/content`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field: 'about', lang: aboutLang, value })
    }).catch(console.error);
  };

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    setSendState('sending');
    try {
      const res = await fetch(`${API_BASE}/api/messages`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(contactForm)
      });
      if (!res.ok) throw new Error(String(res.status));
      setContactForm({ name: '', email: '', body: '' });
      setSendState('sent');
    } catch (err) {
      console.error(err);
      setSendState('error');
    }
  };

  // Only fetched once the dashboard is actually opened — visitors have no use
  // for the inbox, and it must never be served from cache.
  const loadMessages = () => {
    fetch(`${API_BASE}/api/messages`).then(r => r.json()).then(setMessages).catch(console.error);
  };

  const markMessageRead = (id: number, read: boolean) => {
    setMessages(prev => prev.map(m => (m.id === id ? { ...m, read } : m)));
    fetch(`${API_BASE}/api/messages/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ read })
    }).catch(console.error);
  };

  const deleteMessage = (id: number) => {
    setMessages(prev => prev.filter(m => m.id !== id));
    fetch(`${API_BASE}/api/messages/${id}`, { method: 'DELETE' }).catch(console.error);
  };

  // Education / career / achievements all edit the same way: rewrite the whole
  // list for the language currently selected in the admin panel.
  const updateTimeline = (field: TimelineField, entries: TimelineEntry[]) => {
    setContent(prev => ({ ...prev, [field]: { ...prev[field], [lang]: entries } }));
    fetch(`${API_BASE}/api/content`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, lang, value: entries })
    }).catch(console.error);
  };

  const updateSkills = (rawValue: string) => {
    const value = rawValue.split(',').map(s => s.trim()).filter(Boolean);
    setContent(prev => ({ ...prev, skills: value }));
    fetch(`${API_BASE}/api/content`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field: 'skills', value })
    }).catch(console.error);
  };

  // Load from localStorage
  useEffect(() => {
    const savedAnalytics = localStorage.getItem('portfolioAnalytics');
    if (savedAnalytics) setAnalytics(JSON.parse(savedAnalytics));

    const savedLang = localStorage.getItem('portfolioLang') as 'en' | 'id';
    if (savedLang) setLang(savedLang);
    
    const savedDark = localStorage.getItem('portfolioDark');
    if (savedDark) setDarkMode(savedDark === 'true');

    if (sessionStorage.getItem('portfolioIsAdmin') === 'true') setIsAdmin(true);
  }, []);

  // Shortcut rahasia buat buka admin: Ctrl+Shift+A (tidak ada tombol/link yang terlihat pengunjung)
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey && e.shiftKey && e.key.toLowerCase() === 'a') {
        e.preventDefault();
        if (isAdmin) {
          setShowAdmin(true);
          loadMessages();
          return;
        }
        const input = window.prompt('Admin password:');
        if (input === ADMIN_PASSWORD) {
          setIsAdmin(true);
          sessionStorage.setItem('portfolioIsAdmin', 'true');
          setShowAdmin(true);
          loadMessages();
        } else if (input !== null) {
          window.alert('Wrong password.');
        }
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isAdmin]);

  // Save to localStorage
  const saveAnalytics = (newAnalytics: Analytics) => {
    setAnalytics(newAnalytics);
    localStorage.setItem('portfolioAnalytics', JSON.stringify(newAnalytics));
  };

  // Track Page Views
  const trackPageView = (page: string) => {
    const newAnalytics = { ...analytics };
    newAnalytics.pageViews[page] = (newAnalytics.pageViews[page] || 0) + 1;
    saveAnalytics(newAnalytics);
  };

  // Track Project View - persisted in Postgres via the API
  const trackProjectView = (projectId: number) => {
    fetch(`${API_BASE}/api/projects/${projectId}/view`, { method: 'POST' })
      .then(r => r.json())
      .then(updated => setProjects(prev => prev.map(p => p.id === projectId ? updated : p)))
      .catch(console.error);

    const newAnalytics = { ...analytics };
    newAnalytics.projectViews[projectId] = (newAnalytics.projectViews[projectId] || 0) + 1;
    saveAnalytics(newAnalytics);
  };

  // Track CV Download — downloads the real file the admin uploaded for the current language.
  // The base64 payload isn't kept in state (only the filename is), so fetch it lazily on click.
  const handleDownloadCV = () => {
    if (!cv[lang].filename) {
      window.alert(lang === 'id' ? 'CV bahasa Indonesia belum diunggah.' : 'English CV has not been uploaded yet.');
      return;
    }
    fetch(`${API_BASE}/api/cv/${lang}`)
      .then(r => r.json())
      .then((full: { filename: string; data: string }) => {
        const newAnalytics = { ...analytics, cvDownloads: analytics.cvDownloads + 1 };
        saveAnalytics(newAnalytics);
        const link = document.createElement('a');
        link.href = full.data;
        link.download = full.filename;
        link.click();
      })
      .catch(console.error);
  };

  // Navigation
  const navItems = ['home', 'about', 'projects', 'skills', 'contact'] as const;

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setActiveSection(id);
      trackPageView(id);
    }
    setIsMenuOpen(false);
  };

  // Toggle Dark Mode
  const toggleDarkMode = () => {
    const newMode = !darkMode;
    setDarkMode(newMode);
    localStorage.setItem('portfolioDark', String(newMode));
  };

  // Toggle Language
  const toggleLang = () => {
    const newLang = lang === 'en' ? 'id' : 'en';
    setLang(newLang);
    localStorage.setItem('portfolioLang', newLang);
  };

  // Open Project Detail (Functional)
  const openProject = (project: Project) => {
    setSelectedProject(project);
    trackProjectView(project.id);
    trackPageView('project-detail');
  };

  // Admin CMS - Simple editable projects
  const updateProject = (id: number, field: string, value: string) => {
    setProjects(prev => prev.map(p => p.id === id ? { ...p, [field]: { ...(p[field as keyof Project] as any), [lang]: value } } : p));
    fetch(`${API_BASE}/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, lang, value })
    }).catch(console.error);
  };

  // Non-language fields: image, link, category, tags
  const updateProjectField = (id: number, field: 'image' | 'link' | 'category' | 'tags', rawValue: string) => {
    const value: string | string[] = field === 'tags' ? rawValue.split(',').map(t => t.trim()).filter(Boolean) : rawValue;
    setProjects(prev => prev.map(p => p.id === id ? { ...p, [field]: value } : p));
    fetch(`${API_BASE}/api/projects/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ field, value })
    }).catch(console.error);
  };

  const uploadCv = async (cvLang: 'en' | 'id', file: File) => {
    if (file.type !== 'application/pdf') {
      window.alert('File harus PDF.');
      return;
    }
    if (file.size > 3 * 1024 * 1024) {
      window.alert('Ukuran PDF maksimal 3MB.');
      return;
    }
    const data = await fileToDataUrl(file);
    await fetch(`${API_BASE}/api/cv/${cvLang}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ filename: file.name, data })
    });
    setCv(prev => ({ ...prev, [cvLang]: { filename: file.name } }));
  };

  const deleteCv = async (cvLang: 'en' | 'id') => {
    await fetch(`${API_BASE}/api/cv/${cvLang}`, { method: 'DELETE' });
    setCv(prev => ({ ...prev, [cvLang]: { filename: null } }));
  };

  const deleteProject = (id: number) => {
    setProjects(prev => prev.filter(p => p.id !== id));
    fetch(`${API_BASE}/api/projects/${id}`, { method: 'DELETE' }).catch(console.error);
  };

  const addProject = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newProject.title || !newProject.description) return;
    fetch(`${API_BASE}/api/projects`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: newProject.title,
        description: newProject.description,
        image: newProject.image || '/images/project1.jpg',
        link: newProject.link,
        tags: newProject.tags.split(',').map(t => t.trim()).filter(Boolean),
        category: newProject.category || 'Web App'
      })
    })
      .then(r => r.json())
      .then(created => setProjects(prev => [...prev, created]))
      .catch(console.error);
    setNewProject(emptyProjectForm);
  };

  const logoutAdmin = () => {
    setIsAdmin(false);
    setShowAdmin(false);
    sessionStorage.removeItem('portfolioIsAdmin');
  };

  return (
    <div className={`${darkMode ? 'dark bg-zinc-950 text-white' : 'bg-white text-zinc-900'} min-h-screen font-sans transition-colors`}>
      {/* NAV */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-white/95 dark:bg-zinc-950/95 backdrop-blur-lg border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-6 flex items-center justify-between h-20">
          <div className="flex items-center gap-3">
            <div className="font-semibold text-2xl tracking-tighter">{content.heroTitle}</div>
          </div>

          {/* Desktop Nav */}
          <div className="hidden md:flex items-center gap-9 text-sm font-medium">
            {navItems.map(item => (
              <button key={item} onClick={() => scrollToSection(item)} 
                className={`hover:text-teal-500 transition-colors capitalize ${activeSection === item ? 'text-teal-500' : ''}`}>
                {t.nav[item as keyof typeof t.nav]}
              </button>
            ))}
          </div>

          <div className="flex items-center gap-3">
            <button onClick={toggleLang} className="flex items-center gap-1.5 px-4 py-2 rounded-full border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900 text-sm">
              <Globe size={16} /> {t.lang}
            </button>
            <button onClick={toggleDarkMode} className="p-2.5 rounded-full border border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900">
              {darkMode ? <Sun size={18} /> : <Moon size={18} />}
            </button>
            <button onClick={() => setIsMenuOpen(!isMenuOpen)} className="md:hidden p-2">
              {isMenuOpen ? <X size={22} /> : <Menu size={22} />}
            </button>
          </div>
        </div>

        {/* Mobile Menu */}
        <AnimatePresence>
          {isMenuOpen && (
            <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0 }} className="md:hidden border-t bg-white dark:bg-zinc-950 px-6 py-8 flex flex-col gap-4 text-lg">
              {navItems.map(item => (
                <button key={item} onClick={() => scrollToSection(item)} className="text-left capitalize py-1">{t.nav[item as keyof typeof t.nav]}</button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </nav>

      {/* HERO / LANDING */}
      <section id="home" className="pt-20 min-h-[100dvh] flex items-center relative bg-zinc-950 text-white overflow-hidden">
        <div className="max-w-6xl mx-auto px-6 pt-12 pb-24 relative z-10 w-full grid md:grid-cols-[1fr_auto] items-center gap-12">
          <div className="max-w-3xl">
            <h1 className="text-6xl md:text-8xl font-semibold tracking-[-4.4px] leading-none mb-6">{content.heroTitle}</h1>
            <p className="text-3xl tracking-tight text-zinc-400 mb-12">{content.heroSubtitle}</p>

            <div className="flex flex-wrap gap-4">
              <button onClick={() => scrollToSection('projects')} className="px-10 py-4 bg-white text-black rounded-full font-medium hover:bg-zinc-200 transition flex items-center gap-3 text-lg">
                {t.hero.cta} <ExternalLink size={19} />
              </button>
              <button onClick={handleDownloadCV} className="px-10 py-4 border-2 border-white/70 hover:bg-white/10 rounded-full flex items-center gap-3 text-lg font-medium transition">
                <Download size={19} /> {t.hero.cv}
              </button>
            </div>
          </div>
          <img src={content.photo} alt={content.heroTitle} className="w-56 h-56 md:w-80 md:h-80 rounded-full object-cover object-top border-4 border-white/20 justify-self-center md:justify-self-end" />
        </div>
        <div className="absolute bottom-12 right-8 text-xs text-white/50 tracking-[4px] hidden lg:block">SCROLL TO EXPLORE ↓</div>
      </section>

      {/* ABOUT */}
      <section id="about" className="max-w-5xl mx-auto px-6 py-24 border-b border-zinc-200 dark:border-zinc-800">
        <div className="grid md:grid-cols-2 gap-x-16 gap-y-8 items-center">
          <div>
            <h2 className="text-6xl font-semibold tracking-tighter mb-8">{t.about.title}</h2>
          </div>
          <div className="text-xl text-zinc-600 dark:text-zinc-400 leading-relaxed">
            {content.about[lang]}
          </div>
        </div>

        {/* Each block hides itself while empty, so the section keeps its current
            shape until the admin actually fills these in. */}
        <div className="grid md:grid-cols-2 gap-x-16 mt-16">
          <Timeline title={t.about.education} entries={content.education[lang]} icon={GraduationCap} />
          <Timeline title={t.about.career} entries={content.career[lang]} icon={Briefcase} />
        </div>
        <Timeline title={t.about.achievements} entries={content.achievements[lang]} icon={Award} />
      </section>

      {/* PROJECTS */}
      <section id="projects" className="max-w-7xl mx-auto px-6 py-24">
        <div className="mb-12">
          <h2 className="text-6xl tracking-[-2.4px] font-semibold">{t.projects.title}</h2>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {/* Placeholders hold the grid's shape while the API answers, so the section
              never renders as a blank gap between the heading and the next one. */}
          {!projectsLoaded && Array.from({ length: 4 }).map((_, i) => (
            <div key={`skeleton-${i}`} className="rounded-3xl aspect-[16/10] bg-zinc-200 dark:bg-zinc-900 animate-pulse" />
          ))}
          {projects.map((project, index) => (
            <motion.div whileHover={{ y: -4 }} key={project.id} onClick={() => openProject(project)}
              className="group relative overflow-hidden rounded-3xl aspect-[16/10] bg-zinc-900 cursor-pointer shadow-xl">
              <img src={project.image} alt={project.title[lang]} loading={index < 2 ? 'eager' : 'lazy'} decoding="async" className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/60 to-black" />
              <div className="absolute bottom-0 p-8 text-white">
                <div className="uppercase text-xs tracking-[3px] opacity-75 mb-2">{project.category}</div>
                <h3 className="text-4xl font-semibold tracking-tight mb-3">{project.title[lang]}</h3>
                <p className="text-lg text-white/80 pr-8">{project.description[lang]}</p>
                <div className="flex flex-wrap items-center gap-2 mt-7 text-sm">
                  {project.tags.map((tag, i) => (
                    <span key={i} className="px-3 py-px bg-white/20 rounded">{tag}</span>
                  ))}
                </div>
              </div>
            </motion.div>
          ))}
        </div>
      </section>

      {/* SKILLS */}
      <section id="skills" className="bg-zinc-900 text-white py-24">
        <div className="max-w-5xl mx-auto px-6">
          <h2 className="text-6xl tracking-[-2.6px] font-semibold mb-16">{t.skills.title}</h2>
          <div className="flex flex-wrap gap-3">
            {content.skills.map((skill, i) => (
              <div key={i} className="px-8 py-4 rounded-2xl border border-white/20 text-lg hover:border-teal-500 transition-colors">{skill}</div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="max-w-3xl mx-auto px-6 py-24">
        <h2 className="text-6xl tracking-tighter font-semibold mb-9">{t.contact.title}</h2>
        <div className="flex flex-col sm:flex-row gap-4">
          <a href={`https://wa.me/${content.whatsapp}`} target="_blank" rel="noopener noreferrer" className="flex-1 bg-black hover:bg-zinc-800 dark:bg-white dark:text-black transition text-white py-5 rounded-2xl text-lg font-medium flex justify-center items-center gap-2">
            <Phone size={19} /> WhatsApp
          </a>
          <a href={`mailto:${content.email}`} className="flex-1 border-2 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition py-5 rounded-2xl text-lg font-medium flex justify-center items-center gap-2">
            <Mail size={19} /> Email
          </a>
          <a href={content.linkedin} target="_blank" rel="noopener noreferrer" className="flex-1 border-2 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition py-5 rounded-2xl text-lg font-medium flex justify-center items-center gap-2">
            <ExternalLink size={19} /> LinkedIn
          </a>
        </div>

        {/* Feeds the dashboard inbox. Kept below the direct links, which stay the
            fastest way to reach a reply. */}
        <form onSubmit={sendMessage} className="mt-8 border-2 border-zinc-200 dark:border-zinc-800 rounded-2xl p-6">
          <div className="uppercase tracking-[3px] text-teal-600 text-xs font-medium mb-4">{t.contact.formTitle}</div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-3">
            <input required maxLength={120} value={contactForm.name}
              onChange={e => setContactForm({ ...contactForm, name: e.target.value })}
              className="bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 outline-none focus:border-teal-600 transition"
              placeholder={t.contact.name} />
            <input type="email" maxLength={200} value={contactForm.email}
              onChange={e => setContactForm({ ...contactForm, email: e.target.value })}
              className="bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 outline-none focus:border-teal-600 transition"
              placeholder={t.contact.email} />
          </div>
          <textarea required maxLength={4000} rows={4} value={contactForm.body}
            onChange={e => setContactForm({ ...contactForm, body: e.target.value })}
            className="w-full bg-transparent border border-zinc-300 dark:border-zinc-700 rounded-xl px-4 py-3 outline-none focus:border-teal-600 transition mb-3"
            placeholder={t.contact.message} />
          <div className="flex items-center gap-4">
            <button type="submit" disabled={sendState === 'sending'}
              className="px-8 py-3 bg-black dark:bg-white dark:text-black text-white rounded-full font-medium hover:opacity-90 transition disabled:opacity-50">
              {sendState === 'sending' ? t.contact.sending : t.contact.send}
            </button>
            {sendState === 'sent' && <span className="text-sm text-teal-600">{t.contact.sent}</span>}
            {sendState === 'error' && <span className="text-sm text-red-500">{t.contact.error}</span>}
          </div>
        </form>
      </section>

      {/* FOOTER */}
      <footer className="border-t py-8 text-center text-sm text-zinc-500 dark:border-zinc-800">© {new Date().getFullYear()} Fazri Ahmad Mustaqim — Crafted with ❤️ and Code.</footer>

      {/* PROJECT DETAIL MODAL - Fully Functional */}
      <AnimatePresence>
        {selectedProject && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4" onClick={() => setSelectedProject(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ ease: [0.22,1,0.36,1] }}
              onClick={e => e.stopPropagation()} className="bg-white dark:bg-zinc-950 max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-3xl">
              <img src={selectedProject.image} className="w-full h-[200px] md:h-[380px] object-cover" alt="" />
              <div className="p-6 md:p-12">
                <div className="uppercase tracking-[3px] text-teal-600 mb-3 text-sm">{selectedProject.category}</div>
                <h3 className="text-3xl md:text-5xl font-semibold tracking-tight mb-5">{selectedProject.title[lang]}</h3>
                <LongDesc text={selectedProject.longDesc[lang]} />
                
                <div className="flex flex-wrap gap-2 mb-10">
                  {selectedProject.tags.map((tag,i) => <div key={i} className="px-5 py-px border text-sm rounded-full border-zinc-300 dark:border-zinc-700">{tag}</div>)}
                </div>
                <div className="flex gap-3">
                  {selectedProject.link && (
                    <a href={selectedProject.link} target="_blank" rel="noopener noreferrer" className="px-9 py-3 bg-teal-600 text-white rounded-full hover:bg-teal-700 transition flex items-center gap-2">
                      Visit <ExternalLink size={16} />
                    </a>
                  )}
                  <button onClick={() => setSelectedProject(null)} className="px-9 py-3 border rounded-full hover:bg-zinc-900 hover:text-white dark:hover:bg-white dark:hover:text-black transition">Close</button>
                </div>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* ADMIN DASHBOARD — Ctrl+Shift+A, then the password */}
      {showAdmin && isAdmin && (
        <React.Suspense fallback={
          <div className="fixed inset-0 z-[80] bg-[#0a0a0a] text-white/40 flex items-center justify-center text-sm">
            Loading dashboard…
          </div>
        }>
          <Admin
            lang={lang}
            content={content}
            projects={projects}
            messages={messages}
            cv={cv}
            newProject={newProject}
            setNewProject={setNewProject}
            addProject={addProject}
            updateContent={updateContent}
            updateAbout={updateAbout}
            updateSkills={updateSkills}
            updateTimeline={updateTimeline}
            updateProject={updateProject}
            updateProjectField={updateProjectField}
            deleteProject={deleteProject}
            uploadCv={uploadCv}
            deleteCv={deleteCv}
            markMessageRead={markMessageRead}
            deleteMessage={deleteMessage}
            compressImage={fileToCompressedDataUrl}
            onClose={() => setShowAdmin(false)}
            onLogout={logoutAdmin}
          />
        </React.Suspense>
      )}
    </div>
  );
}

export default function App() {
  return <Portfolio />;
}

