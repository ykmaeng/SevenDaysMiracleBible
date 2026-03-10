export const DOWNLOAD_CONFIG = {
  baseUrl: "https://github.com/ykmaeng/selah-bible/releases/download",
  tag: "translations-v2",
  commentaryTag: "commentary-v2",
};

export function getTranslationDownloadUrl(translationId: string): string {
  return `${DOWNLOAD_CONFIG.baseUrl}/${DOWNLOAD_CONFIG.tag}/${translationId}.db`;
}

export function getCommentaryDownloadUrl(language: string): string {
  return `${DOWNLOAD_CONFIG.baseUrl}/${DOWNLOAD_CONFIG.commentaryTag}/commentary-${language}.db`;
}

export const BUNDLED_TRANSLATIONS = new Set(["kjv", "sav-ko"]);

export const COMMENTARY_LANGUAGES: { language: string; name: string; sizeMb: number; ready?: boolean }[] = [
  { language: "ko", name: "한국어", sizeMb: 14, ready: true },
  { language: "en", name: "English", sizeMb: 10, ready: true },
];
