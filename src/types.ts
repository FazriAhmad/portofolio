// Shared between the public site (App.tsx) and the admin dashboard (Admin.tsx).
// Kept in its own module so the admin can be lazy-loaded without either file
// importing the other for the sake of a type.

export interface Project {
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

// One shape for education, career, and achievements — they are all a dated line
// with a name, a place, and an optional note, so they share an editor and a
// renderer instead of three near-identical copies. org/desc may be left blank.
export interface TimelineEntry {
  period: string;
  title: string;
  org: string;
  location: string;
  desc: string;
  /** Optional logo (campus, company, issuer). Falls back to the section icon. */
  image: string;
}

export type Bilingual<T> = { en: T; id: T };

export interface SiteContent {
  heroTitle: string;
  heroSubtitle: string;
  about: { en: string; id: string };
  skills: string[];
  whatsapp: string;
  email: string;
  linkedin: string;
  photo: string;
  education: Bilingual<TimelineEntry[]>;
  career: Bilingual<TimelineEntry[]>;
  achievements: Bilingual<TimelineEntry[]>;
}

export interface Message {
  id: number;
  name: string;
  email: string;
  body: string;
  read: boolean;
  createdAt: string;
}

export type TimelineField = 'education' | 'career' | 'achievements';

export type CvState = {
  en: { filename: string | null };
  id: { filename: string | null };
};

export const emptyEntry: TimelineEntry = {
  period: '', title: '', org: '', location: '', desc: '', image: ''
};
