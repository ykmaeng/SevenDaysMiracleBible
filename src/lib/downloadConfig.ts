export const DOWNLOAD_CONFIG = {
  baseUrl: "https://github.com/ykmaeng/SevenDaysMiracleBible/releases/download",
  tag: "translations-v1",
  commentaryTag: "commentary-v1",
};

export function getTranslationDownloadUrl(translationId: string): string {
  return `${DOWNLOAD_CONFIG.baseUrl}/${DOWNLOAD_CONFIG.tag}/${translationId}.json`;
}

export function getCommentaryDownloadUrl(language: string): string {
  return `${DOWNLOAD_CONFIG.baseUrl}/${DOWNLOAD_CONFIG.commentaryTag}/commentary-${language}.json`;
}

export const CORE_TRANSLATIONS = new Set(["kjv", "ai-ko"]);
export const CORE_COMMENTARY_LANGUAGES = new Set(["ko"]);

export const COMMENTARY_LANGUAGES: { language: string; name: string; sizeMb: number }[] = [
  { language: "en", name: "English", sizeMb: 3.5 },
  { language: "zh", name: "中文", sizeMb: 4.0 },
  { language: "es", name: "Español", sizeMb: 3.5 },
  { language: "ja", name: "日本語", sizeMb: 4.0 },
  { language: "de", name: "Deutsch", sizeMb: 3.5 },
  { language: "fr", name: "Français", sizeMb: 3.5 },
  { language: "ru", name: "Русский", sizeMb: 4.0 },
  { language: "pt", name: "Português", sizeMb: 3.5 },
];
