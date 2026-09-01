import React, { useState } from 'react';
import {
  LayoutGrid, User, FolderGit2, Award, Sparkles, Briefcase,
  GraduationCap, Mail, LogOut, ArrowUpRight, Trash2, X
} from 'lucide-react';
import type {
  Project, SiteContent, Message, TimelineEntry, TimelineField, CvState
} from './types';
import { emptyEntry } from './types';

type Section = 'dashboard' | 'profile' | 'projects' | 'achievements'
  | 'skills' | 'career' | 'education' | 'messages';

export interface AdminProps {
  lang: 'en' | 'id';
  content: SiteContent;
  projects: Project[];
  messages: Message[];
  cv: CvState;
  newProject: { title: string; description: string; image: string; link: string; tags: string; category: string };
  setNewProject: React.Dispatch<React.SetStateAction<AdminProps['newProject']>>;
  addProject: (e: React.FormEvent) => void;
  updateContent: (field: 'heroTitle' | 'heroSubtitle' | 'whatsapp' | 'email' | 'linkedin' | 'photo', value: string) => void;
  updateAbout: (lang: 'en' | 'id', value: string) => void;
  updateSkills: (raw: string) => void;
  updateTimeline: (field: TimelineField, entries: TimelineEntry[]) => void;
  updateProject: (id: number, field: string, value: string) => void;
  updateProjectField: (id: number, field: 'image' | 'link' | 'category' | 'tags', value: string) => void;
  deleteProject: (id: number) => void;
  uploadCv: (lang: 'en' | 'id', file: File) => void;
  deleteCv: (lang: 'en' | 'id') => void;
  markMessageRead: (id: number, read: boolean) => void;
  deleteMessage: (id: number) => void;
  compressImage: (file: File, maxDim?: number, quality?: number, mime?: string) => Promise<string>;
  onClose: () => void;
  onLogout: () => void;
}

const NAV: { id: Section; label: string; icon: typeof LayoutGrid }[] = [
  { id: 'dashboard', label: 'Dashboard', icon: LayoutGrid },
  { id: 'profile', label: 'Profile', icon: User },
  { id: 'projects', label: 'Projects', icon: FolderGit2 },
  { id: 'achievements', label: 'Achievements', icon: Award },
  { id: 'skills', label: 'Skills', icon: Sparkles },
  { id: 'career', label: 'Career', icon: Briefcase },
  { id: 'education', label: 'Education', icon: GraduationCap },
  { id: 'messages', label: 'Messages', icon: Mail },
];

// "2d ago" style stamps, matching the inbox in the design. Anything past a week
// falls back to a date, where the exact day matters more than the elapsed time.
function timeAgo(iso: string) {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return '';
  const mins = Math.floor((Date.now() - then) / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 8) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const field = 'w-full bg-transparent border border-white/10 rounded-lg px-3 py-2.5 text-sm ' +
  'text-white placeholder-white/25 outline-none focus:border-white/30 transition';
const card = 'border border-white/10 rounded-2xl bg-white/[0.02]';
const eyebrow = 'uppercase tracking-[3px] text-[10px] font-medium text-white/40';

function Eyebrow({ children, right }: { children: React.ReactNode; right?: React.ReactNode }) {
  return (
    <div className="flex items-end justify-between mb-4">
      <div className={eyebrow}>{children}</div>
      {right}
    </div>
  );
}

// One editor drives education, career, and achievements; they differ only by
// which slice of content they write back to.
function TimelineEditor({ entries, onChange, compressImage, Icon }: {
  entries: TimelineEntry[];
  onChange: (next: TimelineEntry[]) => void;
  compressImage: AdminProps['compressImage'];
  Icon: typeof GraduationCap;
}) {
  return (
    <div className="space-y-3">
      {!entries.length && (
        <div className={`${card} p-8 text-center text-sm text-white/35`}>
          Nothing here yet — this section stays hidden on the public page.
        </div>
      )}
      {entries.map((entry, i) => {
        const write = (patch: Partial<TimelineEntry>) =>
          onChange(entries.map((e, j) => (j === i ? { ...e, ...patch } : e)));
        return (
          <div key={i} className={`${card} p-5`}>
            <div className="flex gap-3 items-center mb-3">
              <span className="shrink-0 w-10 h-10 rounded-full border border-white/10 flex items-center justify-center overflow-hidden">
                {entry.image
                  ? <img src={entry.image} alt="" className="w-full h-full object-contain p-0.5" />
                  : <Icon size={16} className="text-white/40" />}
              </span>
              <input value={entry.image ?? ''} onChange={e => write({ image: e.target.value })}
                className={field} placeholder="Logo URL — optional" />
              <label className="shrink-0 text-xs px-3 py-2.5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/5 transition">
                Upload
                <input type="file" accept="image/*" className="hidden" onChange={async ev => {
                  const f = ev.target.files?.[0];
                  if (f) write({ image: await compressImage(f, 160, 0.9, 'image/png') });
                }} />
              </label>
              {entry.image && (
                <button onClick={() => write({ image: '' })}
                  className="shrink-0 text-xs px-3 py-2.5 border border-white/10 rounded-lg hover:bg-white/5 transition">
                  Clear
                </button>
              )}
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-2">
              <input value={entry.period} onChange={e => write({ period: e.target.value })} className={field} placeholder="Period (Agustus 2021 – Agustus 2025)" />
              <input value={entry.title} onChange={e => write({ title: e.target.value })} className={field} placeholder="Title" />
              <input value={entry.org} onChange={e => write({ org: e.target.value })} className={field} placeholder="Institution / company" />
              <input value={entry.location ?? ''} onChange={e => write({ location: e.target.value })} className={field} placeholder="Location" />
            </div>
            <div className="flex gap-2">
              <textarea value={entry.desc} onChange={e => write({ desc: e.target.value })} rows={2} className={field} placeholder="Description (optional)" />
              <button onClick={() => onChange(entries.filter((_, j) => j !== i))}
                className="shrink-0 px-3 border border-white/10 rounded-lg text-red-400/80 hover:bg-red-500/10 hover:text-red-400 transition">
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        );
      })}
      <button onClick={() => onChange([...entries, { ...emptyEntry }])}
        className="w-full py-3 rounded-xl border border-dashed border-white/15 text-sm text-white/50 hover:text-white hover:border-white/30 transition">
        + Add entry
      </button>
    </div>
  );
}

export default function Admin(p: AdminProps) {
  const [section, setSection] = useState<Section>('dashboard');
  const firstName = (p.content.heroTitle || 'there').trim().split(/\s+/)[0];

  const stats: { id: Section; label: string; value: number; icon: typeof LayoutGrid }[] = [
    { id: 'projects', label: 'Projects', value: p.projects.length, icon: FolderGit2 },
    { id: 'achievements', label: 'Achievements', value: p.content.achievements[p.lang].length, icon: Award },
    { id: 'skills', label: 'Skills', value: p.content.skills.length, icon: Sparkles },
    { id: 'career', label: 'Career', value: p.content.career[p.lang].length, icon: Briefcase },
    { id: 'education', label: 'Education', value: p.content.education[p.lang].length, icon: GraduationCap },
    { id: 'messages', label: 'Messages', value: p.messages.length, icon: Mail },
  ];

  const timeline = (f: TimelineField, Icon: typeof GraduationCap) => (
    <TimelineEditor
      entries={p.content[f][p.lang]}
      onChange={next => p.updateTimeline(f, next)}
      compressImage={p.compressImage}
      Icon={Icon}
    />
  );

  return (
    <div className="fixed inset-0 z-[80] bg-[#0a0a0a] text-white flex overflow-hidden">
      {/* SIDEBAR */}
      <aside className="w-[200px] shrink-0 border-r border-white/10 flex flex-col">
        <div className="px-6 pt-6 pb-4 font-semibold tracking-tight">Admin</div>
        <nav className="flex-1 px-3 space-y-1 overflow-y-auto">
          {NAV.map(({ id, label, icon: Icon }) => {
            const active = section === id;
            return (
              <button key={id} onClick={() => setSection(id)}
                className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition ${
                  active ? 'bg-white text-black font-medium' : 'text-white/60 hover:text-white hover:bg-white/5'
                }`}>
                <Icon size={16} />
                {label}
              </button>
            );
          })}
        </nav>
        <div className="px-3 py-4 border-t border-white/10">
          <button onClick={p.onLogout}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-white/60 hover:text-white hover:bg-white/5 transition">
            <LogOut size={16} />
            Log out
          </button>
        </div>
      </aside>

      {/* MAIN */}
      <main className="flex-1 overflow-y-auto">
        <button onClick={p.onClose}
          className="absolute top-5 right-6 z-10 text-white/40 hover:text-white transition"
          title="Back to site">
          <X size={20} />
        </button>

        {/* mx-auto: without it the column hugs the left edge and leaves a wide
            empty gutter on large screens. */}
        <div className="max-w-4xl mx-auto px-10 py-10">
          {section === 'dashboard' && (
            <>
              <div className={`${eyebrow} mb-2`}>Dashboard</div>
              <h1 className="text-3xl font-medium tracking-tight mb-9">Welcome back, {firstName}</h1>

              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-12">
                {stats.map(({ id, label, value, icon: Icon }) => (
                  <button key={id} onClick={() => setSection(id)}
                    className={`${card} p-6 text-left hover:border-white/25 transition group`}>
                    <div className="flex items-start justify-between mb-8">
                      <Icon size={18} className="text-white/70" />
                      <ArrowUpRight size={15} className="text-white/25 group-hover:text-white/60 transition" />
                    </div>
                    <div className="text-3xl font-medium">{value}</div>
                    <div className="text-sm text-white/40 mt-1">{label}</div>
                  </button>
                ))}
              </div>

              <Eyebrow right={
                <button onClick={() => setSection('messages')} className="text-xs text-white/40 hover:text-white transition">
                  View all
                </button>
              }>
                Recent messages
              </Eyebrow>
              <div className="space-y-2">
                {!p.messages.length && (
                  <div className={`${card} p-8 text-center text-sm text-white/35`}>
                    No messages yet. They arrive from the contact form on your site.
                  </div>
                )}
                {p.messages.slice(0, 3).map(m => (
                  <button key={m.id} onClick={() => setSection('messages')}
                    className={`${card} w-full p-4 text-left hover:border-white/25 transition`}>
                    <div className="flex justify-between items-baseline gap-4">
                      <span className="font-medium text-sm">{m.name}</span>
                      <span className="text-xs text-white/35 shrink-0">{timeAgo(m.createdAt)}</span>
                    </div>
                    <div className="text-sm text-white/45 mt-1 truncate">{m.body}</div>
                  </button>
                ))}
              </div>
            </>
          )}

          {section === 'profile' && (
            <>
              <div className={`${eyebrow} mb-2`}>Profile</div>
              <h1 className="text-3xl font-medium tracking-tight mb-9">Profile</h1>

              <Eyebrow>Photo &amp; hero</Eyebrow>
              <div className={`${card} p-5 space-y-3 mb-8`}>
                <div className="flex gap-3 items-center">
                  {p.content.photo && <img src={p.content.photo} alt="" className="w-12 h-12 rounded-full object-cover shrink-0 border border-white/10" />}
                  <input value={p.content.photo} onChange={e => p.updateContent('photo', e.target.value)} className={field} placeholder="Photo URL" />
                  <label className="shrink-0 text-xs px-3 py-2.5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/5 transition">
                    Upload
                    <input type="file" accept="image/*" className="hidden" onChange={async e => {
                      const f = e.target.files?.[0];
                      if (f) p.updateContent('photo', await p.compressImage(f));
                    }} />
                  </label>
                </div>
                <input value={p.content.heroTitle} onChange={e => p.updateContent('heroTitle', e.target.value)} className={field} placeholder="Name / hero title" />
                <input value={p.content.heroSubtitle} onChange={e => p.updateContent('heroSubtitle', e.target.value)} className={field} placeholder="Hero subtitle" />
              </div>

              <Eyebrow>About</Eyebrow>
              <div className={`${card} p-5 space-y-3 mb-8`}>
                <textarea value={p.content.about.en} onChange={e => p.updateAbout('en', e.target.value)} rows={4} className={field} placeholder="About text (EN)" />
                <textarea value={p.content.about.id} onChange={e => p.updateAbout('id', e.target.value)} rows={4} className={field} placeholder="About text (ID)" />
              </div>

              <Eyebrow>Contact</Eyebrow>
              <div className={`${card} p-5 grid grid-cols-1 md:grid-cols-3 gap-2 mb-8`}>
                <input value={p.content.whatsapp} onChange={e => p.updateContent('whatsapp', e.target.value)} className={field} placeholder="WhatsApp (62812...)" />
                <input value={p.content.email} onChange={e => p.updateContent('email', e.target.value)} className={field} placeholder="Email" />
                <input value={p.content.linkedin} onChange={e => p.updateContent('linkedin', e.target.value)} className={field} placeholder="LinkedIn URL" />
              </div>

              <Eyebrow>CV file</Eyebrow>
              <div className={`${card} p-5 space-y-3`}>
                {(['id', 'en'] as const).map(l => (
                  <div key={l} className="flex items-center gap-4">
                    <span className="shrink-0 text-xs font-bold w-7 text-white/40">{l.toUpperCase()}</span>
                    <div className="flex-1 text-sm">
                      {p.cv[l].filename
                        ? <span className="text-white/70">{p.cv[l].filename}</span>
                        : <span className="text-white/35">Not uploaded — the download button is off for this language.</span>}
                    </div>
                    <label className="shrink-0 text-xs px-4 py-2 border border-white/10 rounded-full cursor-pointer hover:bg-white/5 transition">
                      {p.cv[l].filename ? 'Replace' : 'Upload'}
                      <input type="file" accept="application/pdf" className="hidden" onChange={e => {
                        const f = e.target.files?.[0];
                        if (f) p.uploadCv(l, f);
                      }} />
                    </label>
                    {p.cv[l].filename && (
                      <button onClick={() => p.deleteCv(l)} className="shrink-0 text-xs px-4 py-2 border border-white/10 rounded-full text-red-400/80 hover:bg-red-500/10 transition">
                        Remove
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </>
          )}

          {section === 'projects' && (
            <>
              <div className={`${eyebrow} mb-2`}>Projects</div>
              <h1 className="text-3xl font-medium tracking-tight mb-9">Projects</h1>

              <Eyebrow>Add new</Eyebrow>
              <form onSubmit={p.addProject} className={`${card} p-5 mb-10`}>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
                  <input placeholder="Title" value={p.newProject.title} onChange={e => p.setNewProject({ ...p.newProject, title: e.target.value })} className={field} required />
                  <input placeholder="Category (e.g. Web App)" value={p.newProject.category} onChange={e => p.setNewProject({ ...p.newProject, category: e.target.value })} className={field} />
                  <div className="flex gap-2 items-center">
                    <input placeholder="Image URL" value={p.newProject.image} onChange={e => p.setNewProject({ ...p.newProject, image: e.target.value })} className={field} />
                    <label className="shrink-0 text-xs px-3 py-2.5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/5 transition">
                      Upload
                      <input type="file" accept="image/*" className="hidden" onChange={async e => {
                        const f = e.target.files?.[0];
                        if (f) { const d = await p.compressImage(f); p.setNewProject(prev => ({ ...prev, image: d })); }
                      }} />
                    </label>
                  </div>
                  <input placeholder="Project link (https://...)" value={p.newProject.link} onChange={e => p.setNewProject({ ...p.newProject, link: e.target.value })} className={field} />
                  <input placeholder="Tags, comma separated" value={p.newProject.tags} onChange={e => p.setNewProject({ ...p.newProject, tags: e.target.value })} className={`${field} md:col-span-2`} />
                  <textarea placeholder="Short description" value={p.newProject.description} onChange={e => p.setNewProject({ ...p.newProject, description: e.target.value })} rows={2} className={`${field} md:col-span-2`} required />
                </div>
                <button type="submit" className="mt-4 px-6 py-2.5 bg-white text-black text-sm font-medium rounded-full hover:bg-white/90 transition">
                  Add project
                </button>
              </form>

              <Eyebrow right={<span className="text-xs text-white/35">Editing {p.lang.toUpperCase()}</span>}>
                Existing
              </Eyebrow>
              <div className="space-y-3">
                {p.projects.map(proj => (
                  <div key={proj.id} className={`${card} p-5`}>
                    <div className="flex gap-3 items-center mb-3">
                      {proj.image && <img src={proj.image} alt="" className="w-12 h-12 rounded-lg object-cover shrink-0 border border-white/10" />}
                      <input value={proj.title[p.lang]} onChange={e => p.updateProject(proj.id, 'title', e.target.value)} className={`${field} font-medium`} placeholder="Title" />
                    </div>
                    <textarea value={proj.description[p.lang]} onChange={e => p.updateProject(proj.id, 'description', e.target.value)} rows={2} className={`${field} mb-2`} placeholder="Short description" />
                    <textarea value={proj.longDesc[p.lang]} onChange={e => p.updateProject(proj.id, 'longDesc', e.target.value)} rows={10} className={`${field} mb-2 font-mono text-xs`} placeholder="Detail — use ## Heading per section" />
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
                      <div className="flex gap-2 items-center">
                        <input value={proj.image} onChange={e => p.updateProjectField(proj.id, 'image', e.target.value)} className={field} placeholder="Image URL" />
                        <label className="shrink-0 text-xs px-3 py-2.5 border border-white/10 rounded-lg cursor-pointer hover:bg-white/5 transition">
                          Upload
                          <input type="file" accept="image/*" className="hidden" onChange={async e => {
                            const f = e.target.files?.[0];
                            if (f) p.updateProjectField(proj.id, 'image', await p.compressImage(f));
                          }} />
                        </label>
                      </div>
                      <input value={proj.category} onChange={e => p.updateProjectField(proj.id, 'category', e.target.value)} className={field} placeholder="Category" />
                      <input value={proj.link} onChange={e => p.updateProjectField(proj.id, 'link', e.target.value)} className={field} placeholder="Project link" />
                      <input value={proj.tags.join(', ')} onChange={e => p.updateProjectField(proj.id, 'tags', e.target.value)} className={field} placeholder="Tags, comma separated" />
                    </div>
                    <div className="flex justify-between items-center">
                      <span className="text-xs text-white/35">{proj.views} views</span>
                      <button onClick={() => p.deleteProject(proj.id)}
                        className="text-xs px-3 py-1.5 border border-white/10 rounded-full text-red-400/80 hover:bg-red-500/10 transition">
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}

          {section === 'skills' && (
            <>
              <div className={`${eyebrow} mb-2`}>Skills</div>
              <h1 className="text-3xl font-medium tracking-tight mb-9">Skills</h1>
              <div className={`${card} p-5`}>
                <textarea value={p.content.skills.join(', ')} onChange={e => p.updateSkills(e.target.value)} rows={4}
                  className={field} placeholder="Skills, comma separated" />
                <div className="flex flex-wrap gap-2 mt-4">
                  {p.content.skills.map((s, i) => (
                    <span key={i} className="px-3 py-1 rounded-full border border-white/10 text-xs text-white/70">{s}</span>
                  ))}
                </div>
              </div>
            </>
          )}

          {section === 'achievements' && (
            <>
              <div className={`${eyebrow} mb-2`}>Achievements</div>
              <h1 className="text-3xl font-medium tracking-tight mb-2">Achievements</h1>
              <p className="text-sm text-white/35 mb-8">Editing the {p.lang.toUpperCase()} list — switch language on the site to edit the other.</p>
              {timeline('achievements', Award)}
            </>
          )}

          {section === 'career' && (
            <>
              <div className={`${eyebrow} mb-2`}>Career</div>
              <h1 className="text-3xl font-medium tracking-tight mb-2">Career</h1>
              <p className="text-sm text-white/35 mb-8">Editing the {p.lang.toUpperCase()} list — switch language on the site to edit the other.</p>
              {timeline('career', Briefcase)}
            </>
          )}

          {section === 'education' && (
            <>
              <div className={`${eyebrow} mb-2`}>Education</div>
              <h1 className="text-3xl font-medium tracking-tight mb-2">Education</h1>
              <p className="text-sm text-white/35 mb-8">Editing the {p.lang.toUpperCase()} list — switch language on the site to edit the other.</p>
              {timeline('education', GraduationCap)}
            </>
          )}

          {section === 'messages' && (
            <>
              <div className={`${eyebrow} mb-2`}>Messages</div>
              <h1 className="text-3xl font-medium tracking-tight mb-9">Messages</h1>
              <div className="space-y-2">
                {!p.messages.length && (
                  <div className={`${card} p-10 text-center text-sm text-white/35`}>
                    No messages yet. They arrive from the contact form on your site.
                  </div>
                )}
                {p.messages.map(m => (
                  <div key={m.id} className={`${card} p-5 ${m.read ? 'opacity-60' : ''}`}>
                    <div className="flex justify-between items-baseline gap-4 mb-1">
                      <div className="font-medium text-sm">
                        {m.name}
                        {m.email && <span className="text-white/35 font-normal ml-2">{m.email}</span>}
                      </div>
                      <span className="text-xs text-white/35 shrink-0">{timeAgo(m.createdAt)}</span>
                    </div>
                    <p className="text-sm text-white/60 whitespace-pre-wrap">{m.body}</p>
                    <div className="flex gap-2 mt-4">
                      <button onClick={() => p.markMessageRead(m.id, !m.read)}
                        className="text-xs px-3 py-1.5 border border-white/10 rounded-full hover:bg-white/5 transition">
                        Mark as {m.read ? 'unread' : 'read'}
                      </button>
                      {m.email && (
                        <a href={`mailto:${m.email}`}
                          className="text-xs px-3 py-1.5 border border-white/10 rounded-full hover:bg-white/5 transition">
                          Reply
                        </a>
                      )}
                      <button onClick={() => p.deleteMessage(m.id)}
                        className="text-xs px-3 py-1.5 border border-white/10 rounded-full text-red-400/80 hover:bg-red-500/10 transition">
                        Delete
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}
