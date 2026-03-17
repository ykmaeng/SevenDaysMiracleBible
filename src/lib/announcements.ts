import { fetch } from "@tauri-apps/plugin-http";

export interface AnnouncementRaw {
  id: string;
  date: string;
  title_ko: string;
  title_en: string;
  content_ko: string;
  content_en: string;
}

export interface Announcement {
  id: string;
  date: string;
  title: string;
  content: string;
}

const ANNOUNCEMENTS_URL =
  "https://github.com/ykmaeng/selah-bible/releases/download/announcements/announcements.json";
const LAST_SEEN_KEY = "selah-last-announcement";

let cachedRaw: AnnouncementRaw[] | null = null;

function localize(raw: AnnouncementRaw[], lang: string): Announcement[] {
  const isKo = lang.startsWith("ko");
  return raw.map((a) => ({
    id: a.id,
    date: a.date,
    title: isKo ? a.title_ko : (a.title_en || a.title_ko),
    content: isKo ? a.content_ko : (a.content_en || a.content_ko),
  }));
}

export async function fetchAnnouncements(lang = "ko"): Promise<Announcement[]> {
  if (cachedRaw) return localize(cachedRaw, lang);
  try {

    const res = await fetch(ANNOUNCEMENTS_URL, { method: "GET" });
    if (!res.ok) return [];
    const data = (await res.json()) as AnnouncementRaw[];
    cachedRaw = data;
    return localize(data, lang);
  } catch {
    return [];
  }
}

export function getLastSeenId(): string | null {
  return localStorage.getItem(LAST_SEEN_KEY);
}

export function markAsSeen(id: string): void {
  localStorage.setItem(LAST_SEEN_KEY, id);
}

export function hasNewAnnouncement(announcements: Announcement[]): boolean {
  if (announcements.length === 0) return false;
  const lastSeen = getLastSeenId();
  return announcements[0].id !== lastSeen;
}
