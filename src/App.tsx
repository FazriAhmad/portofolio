import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { 
  Moon, Sun, Globe, Download, Eye,
  Menu, X, ExternalLink, Mail, Phone
} from 'lucide-react';

// Types
interface Project {
  id: number;
  title: { en: string; id: string };
  description: { en: string; id: string };
  longDesc: { en: string; id: string };
  image: string;
  link: string;
  tags: string[];
  category: string;
  views: number;
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
    hero: { title: "Fazri Ahmad Mustaqim", subtitle: "Fullstack Developer & IoT Enthusiast", cta: "View Projects", cv: "Download CV" },
    about: { title: "About Me", text: "Fullstack Developer & IoT Enthusiast. With a background in Computer Engineering, I transitioned into web development and now build full-stack applications using React, Next.js, and Laravel — combining clean, functional interfaces with reliable backend systems. I'm also passionate about IoT, exploring how hardware and software intersect to solve real-world problems, and I keep exploring modern frontend tooling and API-driven architectures. \"Code with heart, build for future.\"" },
    projects: { title: "Featured Projects", detail: "View Details", views: "views", mostViewed: "Most Viewed" },
    skills: { title: "Skills & Expertise" },
    contact: { title: "Let's Connect" },
    cv: { downloads: "CV Downloads" },
    analytics: { pageViews: "Page Views", projectViews: "Project Views", traffic: "Traffic Sources", downloads: "CV Downloads" },
    lang: "EN", langSwitch: "Switch to Indonesian"
  },
  id: {
    nav: { home: "Beranda", about: "Tentang", projects: "Proyek", skills: "Keahlian", contact: "Kontak" },
    hero: { title: "Fazri Ahmad Mustaqim", subtitle: "Fullstack Developer & IoT Enthusiast", cta: "Lihat Proyek", cv: "Unduh CV" },
    about: { title: "Tentang Saya", text: "Fullstack Developer & IoT Enthusiast. Berbekal ilmu Teknik Komputer, saya membangun aplikasi full-stack menggunakan React, Next.js, dan Laravel — memadukan antarmuka yang bersih dan fungsional dengan sistem backend yang andal. Saya juga tertarik pada IoT, mengeksplorasi perpaduan hardware dan software untuk menyelesaikan masalah nyata, serta terus mempelajari tooling frontend modern dan arsitektur berbasis API. \"Code with heart, build for future.\"" },
    projects: { title: "Proyek Unggulan", detail: "Lihat Detail", views: "tayangan", mostViewed: "Paling Dilihat" },
    skills: { title: "Keahlian & Keterampilan" },
    contact: { title: "Mari Terhubung" },
    cv: { downloads: "Unduhan CV" },
    analytics: { pageViews: "Tampilan Halaman", projectViews: "Tampilan Proyek", traffic: "Sumber Trafik", downloads: "Unduhan CV" },
    lang: "ID", langSwitch: "Beralih ke English"
  }
};

const skills = ["Laravel", "React", "IoT", "PHP", "MySQL", "ESP32", "JavaScript", "GIS", "Docker"];

// ponytail: password client-side & hardcode, cukup buat sembunyiin dari pengunjung biasa,
// BUKAN keamanan sungguhan (siapa pun bisa baca dari source JS). Upgrade ke backend auth kalau serius.
const ADMIN_PASSWORD = "fazri2026";
const emptyProjectForm = { title: '', description: '', image: '', link: '', tags: '', category: '' };

// Resizes/compresses an uploaded image client-side and returns a data: URL,
// so it stays well under Vercel's request body size limit and fits comfortably in a TEXT column.
function fileToCompressedDataUrl(file: File, maxDim = 1200, quality = 0.82): Promise<string> {
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
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result as string;
    };
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
  const [activeSection, setActiveSection] = useState('home');

  const t = translations[lang];

  // Projects now come from the Postgres-backed API
  useEffect(() => {
    fetch(`${API_BASE}/api/projects`).then(r => r.json()).then(setProjects).catch(console.error);
  }, []);

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
          return;
        }
        const input = window.prompt('Admin password:');
        if (input === ADMIN_PASSWORD) {
          setIsAdmin(true);
          sessionStorage.setItem('portfolioIsAdmin', 'true');
          setShowAdmin(true);
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

  // Track CV Download
  const handleDownloadCV = () => {
    const newAnalytics = { ...analytics, cvDownloads: analytics.cvDownloads + 1 };
    saveAnalytics(newAnalytics);
    
    // Simulate CV download
    const link = document.createElement('a');
    link.href = '#';
    link.download = 'Fazri_Ahmad_Mustaqim_CV.pdf';
    const blob = new Blob(['CV Content - Fazri Ahmad Mustaqim\nFullstack Developer & IoT Enthusiast'], { type: 'text/plain' });
    link.href = URL.createObjectURL(blob);
    link.click();
  };

  // Most viewed project
  const mostViewedProject = [...projects].sort((a, b) => b.views - a.views)[0];

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
            <div className="font-semibold text-2xl tracking-tighter">Fazri Ahmad Mustaqim</div>
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
            <h1 className="text-6xl md:text-8xl font-semibold tracking-[-4.4px] leading-none mb-6">{t.hero.title}</h1>
            <p className="text-3xl tracking-tight text-zinc-400 mb-12">{t.hero.subtitle}</p>

            <div className="flex flex-wrap gap-4">
              <button onClick={() => scrollToSection('projects')} className="px-10 py-4 bg-white text-black rounded-full font-medium hover:bg-zinc-200 transition flex items-center gap-3 text-lg">
                {t.hero.cta} <ExternalLink size={19} />
              </button>
              <button onClick={handleDownloadCV} className="px-10 py-4 border-2 border-white/70 hover:bg-white/10 rounded-full flex items-center gap-3 text-lg font-medium transition">
                <Download size={19} /> {t.hero.cv}
              </button>
            </div>
          </div>
          <img src="/images/profile.jpg" alt={t.hero.title} className="w-56 h-56 md:w-80 md:h-80 rounded-full object-cover object-top border-4 border-white/20 justify-self-center md:justify-self-end" />
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
            {t.about.text}
          </div>
        </div>
      </section>

      {/* PROJECTS */}
      <section id="projects" className="max-w-7xl mx-auto px-6 py-24">
        <div className="flex justify-between items-end mb-12">
          <div>
            <h2 className="text-6xl tracking-[-2.4px] font-semibold">{t.projects.title}</h2>
          </div>
          {mostViewedProject && <div className="text-right text-sm hidden md:block text-teal-600">★ {t.projects.mostViewed}: {mostViewedProject.title[lang]}</div>}
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          {projects.map((project, index) => (
            <motion.div whileHover={{ y: -4 }} key={project.id} onClick={() => openProject(project)}
              className="group relative overflow-hidden rounded-3xl aspect-[16/10] bg-zinc-900 cursor-pointer shadow-xl">
              <img src={project.image} alt={project.title[lang]} className="absolute inset-0 w-full h-full object-cover group-hover:scale-[1.04] transition-transform duration-700" />
              <div className="absolute inset-0 bg-gradient-to-b from-black/20 via-black/60 to-black" />
              <div className="absolute bottom-0 p-8 text-white">
                <div className="uppercase text-xs tracking-[3px] opacity-75 mb-2">{project.category}</div>
                <h3 className="text-4xl font-semibold tracking-tight mb-3">{project.title[lang]}</h3>
                <p className="text-lg text-white/80 pr-8">{project.description[lang]}</p>
                <div className="flex items-center gap-5 mt-7 text-sm">
                  <span className="flex items-center gap-1.5"><Eye size={16} /> {project.views} {t.projects.views}</span>
                  <span className="px-3 py-px bg-white/20 rounded">{project.tags[0]}</span>
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
            {skills.map((skill, i) => (
              <div key={i} className="px-8 py-4 rounded-2xl border border-white/20 text-lg hover:border-teal-500 transition-colors">{skill}</div>
            ))}
          </div>
        </div>
      </section>

      {/* CONTACT */}
      <section id="contact" className="max-w-3xl mx-auto px-6 py-24">
        <h2 className="text-6xl tracking-tighter font-semibold mb-9">{t.contact.title}</h2>
        <div className="flex flex-col sm:flex-row gap-4">
          <a href="https://wa.me/6281284020220" target="_blank" rel="noopener noreferrer" className="flex-1 bg-black hover:bg-zinc-800 dark:bg-white dark:text-black transition text-white py-5 rounded-2xl text-lg font-medium flex justify-center items-center gap-2">
            <Phone size={19} /> WhatsApp
          </a>
          <a href="mailto:fazriachmad898@gmail.com" className="flex-1 border-2 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition py-5 rounded-2xl text-lg font-medium flex justify-center items-center gap-2">
            <Mail size={19} /> Email
          </a>
          <a href="https://linkedin.com/in/fazriahmad" target="_blank" rel="noopener noreferrer" className="flex-1 border-2 border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-900 transition py-5 rounded-2xl text-lg font-medium flex justify-center items-center gap-2">
            <ExternalLink size={19} /> LinkedIn
          </a>
        </div>
      </section>

      {/* FOOTER */}
      <footer className="border-t py-8 text-center text-sm text-zinc-500 dark:border-zinc-800">© {new Date().getFullYear()} Fazri Ahmad Mustaqim — Crafted with ❤️ and Code.</footer>

      {/* PROJECT DETAIL MODAL - Fully Functional */}
      <AnimatePresence>
        {selectedProject && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/90 p-4" onClick={() => setSelectedProject(null)}>
            <motion.div initial={{ opacity: 0, scale: 0.96, y: 20 }} animate={{ opacity: 1, scale: 1, y: 0 }} exit={{ opacity: 0, scale: 0.95, y: 20 }} transition={{ ease: [0.22,1,0.36,1] }}
              onClick={e => e.stopPropagation()} className="bg-white dark:bg-zinc-950 max-w-4xl w-full max-h-[90vh] overflow-y-auto rounded-3xl">
              <img src={selectedProject.image} className="w-full h-[380px] object-cover" alt="" />
              <div className="p-12">
                <div className="uppercase tracking-[3px] text-teal-600 mb-3 text-sm">{selectedProject.category} • {selectedProject.views} {t.projects.views}</div>
                <h3 className="text-5xl font-semibold tracking-tight mb-5">{selectedProject.title[lang]}</h3>
                <p className="text-2xl leading-tight mb-9 text-zinc-600 dark:text-zinc-400">{selectedProject.longDesc[lang]}</p>
                
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

      {/* ADMIN CMS PANEL - only reachable via Ctrl+Shift+A + password */}
      <AnimatePresence>
        {showAdmin && isAdmin && (
          <div className="fixed inset-0 bg-black/90 z-[80] flex items-center justify-center p-5" onClick={() => setShowAdmin(false)}>
            <div onClick={e => e.stopPropagation()} className="bg-white dark:bg-zinc-950 rounded-3xl w-full max-w-5xl max-h-[92vh] overflow-auto p-10 text-sm">
              <div className="flex justify-between mb-9 items-center">
                <div><div className="font-semibold text-3xl tracking-tight">Admin CMS</div><div className="text-xs text-zinc-500 mt-1">Edit projects • View stats • No database required</div></div>
                <div className="flex items-center gap-3">
                  <button onClick={logoutAdmin} className="text-xs px-4 py-2 border rounded-full hover:bg-zinc-100 dark:hover:bg-zinc-900 dark:border-zinc-800">Logout</button>
                  <button onClick={() => setShowAdmin(false)}><X /></button>
                </div>
              </div>

              {/* Live Analytics */}
              <div className="mb-9 bg-zinc-100 dark:bg-zinc-900 rounded-2xl p-6">
                <div className="uppercase tracking-[3px] mb-4 text-teal-600 font-medium text-xs">Live Analytics</div>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-zinc-600 dark:text-zinc-400">
                  <div><div className="font-medium text-black dark:text-white mb-px">{t.analytics.pageViews}</div>{Object.values(analytics.pageViews).reduce((a,b)=>a+b,0)} total</div>
                  <div><div className="font-medium text-black dark:text-white mb-px">{t.analytics.projectViews}</div>{Object.values(analytics.projectViews).reduce((a,b)=>a+b,0)} total</div>
                  <div><div className="font-medium text-black dark:text-white mb-px">{t.cv.downloads}</div>{analytics.cvDownloads}</div>
                  <div><div className="font-medium text-black dark:text-white mb-px">{t.analytics.traffic}</div>
                    {Object.entries(analytics.trafficSources).map(([k,v]) => <div key={k}>{k}: {v}%</div>)}
                  </div>
                </div>
              </div>

              {/* Add New Project */}
              <form onSubmit={addProject} className="mb-9 border dark:border-zinc-800 rounded-2xl p-6">
                <div className="uppercase tracking-[3px] mb-4 text-teal-600 font-medium text-xs">Add New Project</div>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  <input placeholder="Title" value={newProject.title} onChange={e => setNewProject({...newProject, title: e.target.value})} className="bg-transparent border rounded-lg p-3 dark:border-zinc-800" required />
                  <input placeholder="Category (e.g. Web App)" value={newProject.category} onChange={e => setNewProject({...newProject, category: e.target.value})} className="bg-transparent border rounded-lg p-3 dark:border-zinc-800" />
                  <div className="flex gap-2 items-center">
                    <input placeholder="Image URL (e.g. /images/project1.jpg)" value={newProject.image} onChange={e => setNewProject({...newProject, image: e.target.value})} className="bg-transparent border rounded-lg p-3 dark:border-zinc-800 flex-1" />
                    <label className="shrink-0 text-xs px-3 py-3 border rounded-lg cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900 dark:border-zinc-800">
                      Upload
                      <input type="file" accept="image/*" className="hidden" onChange={async e => {
                        const file = e.target.files?.[0];
                        if (!file) return;
                        const dataUrl = await fileToCompressedDataUrl(file);
                        setNewProject(prev => ({ ...prev, image: dataUrl }));
                      }} />
                    </label>
                  </div>
                  <input placeholder="Project link (https://...)" value={newProject.link} onChange={e => setNewProject({...newProject, link: e.target.value})} className="bg-transparent border rounded-lg p-3 dark:border-zinc-800" />
                  <input placeholder="Tags, comma separated (React, Web App)" value={newProject.tags} onChange={e => setNewProject({...newProject, tags: e.target.value})} className="bg-transparent border rounded-lg p-3 dark:border-zinc-800 md:col-span-2" />
                  <textarea placeholder="Description" value={newProject.description} onChange={e => setNewProject({...newProject, description: e.target.value})} className="bg-transparent border rounded-lg p-3 dark:border-zinc-800 md:col-span-2" rows={2} required />
                </div>
                <button type="submit" className="mt-4 px-6 py-3 bg-teal-600 text-white rounded-full hover:bg-teal-700 transition">Add Project</button>
              </form>

              {/* Existing Projects */}
              <div className="uppercase tracking-[3px] mb-4 text-teal-600 font-medium text-xs">Existing Projects</div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-9">
                {projects.map(proj => (
                  <div key={proj.id} className="border p-6 rounded-2xl dark:border-zinc-800">
                    <input value={proj.title[lang]} onChange={e => updateProject(proj.id, 'title', e.target.value)} className="font-semibold text-xl w-full bg-transparent border-b pb-1 mb-2 outline-none" placeholder="Title" />
                    <textarea value={proj.description[lang]} onChange={e => updateProject(proj.id, 'description', e.target.value)} className="w-full text-sm bg-transparent border rounded p-3 mb-2" rows={2} placeholder="Short description" />
                    <textarea value={proj.longDesc[lang]} onChange={e => updateProject(proj.id, 'longDesc', e.target.value)} className="w-full text-sm bg-transparent border rounded p-3 mb-2" rows={2} placeholder="Long description (detail modal)" />
                    <div className="flex gap-2 items-center mb-2">
                      {proj.image && <img src={proj.image} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0 border dark:border-zinc-800" />}
                      <input value={proj.image} onChange={e => updateProjectField(proj.id, 'image', e.target.value)} className="text-sm bg-transparent border rounded p-2 flex-1 min-w-0" placeholder="Image URL" />
                      <label className="shrink-0 text-xs px-3 py-2 border rounded-lg cursor-pointer hover:bg-zinc-100 dark:hover:bg-zinc-900 dark:border-zinc-800">
                        Upload
                        <input type="file" accept="image/*" className="hidden" onChange={async e => {
                          const file = e.target.files?.[0];
                          if (!file) return;
                          const dataUrl = await fileToCompressedDataUrl(file);
                          updateProjectField(proj.id, 'image', dataUrl);
                        }} />
                      </label>
                    </div>
                    <div className="grid grid-cols-2 gap-2 mb-2">
                      <input value={proj.category} onChange={e => updateProjectField(proj.id, 'category', e.target.value)} className="text-sm bg-transparent border rounded p-2" placeholder="Category" />
                      <input value={proj.link} onChange={e => updateProjectField(proj.id, 'link', e.target.value)} className="text-sm bg-transparent border rounded p-2 col-span-2" placeholder="Project link" />
                      <input value={proj.tags.join(', ')} onChange={e => updateProjectField(proj.id, 'tags', e.target.value)} className="text-sm bg-transparent border rounded p-2 col-span-2" placeholder="Tags, comma separated" />
                    </div>
                    <div className="flex justify-between items-center">
                      <div className="text-xs text-teal-600">Views: {proj.views}</div>
                      <button onClick={() => deleteProject(proj.id)} className="text-xs text-red-500 hover:underline">Delete</button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="text-xs text-center text-zinc-400">All edits &amp; analytics are saved locally. Refreshing the page keeps all your data.</div>
            </div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

export default function App() {
  return <Portfolio />;
}

