export const DOWNLOAD_CONFIG = {
  baseUrl: "https://github.com/ykmaeng/SevenDaysMiracleBible/releases/download",
  tag: "translations-v1",
};

export function getTranslationDownloadUrl(translationId: string): string {
  return `${DOWNLOAD_CONFIG.baseUrl}/${DOWNLOAD_CONFIG.tag}/${translationId}.json`;
}

export const CORE_TRANSLATIONS = new Set(["kjv", "ai-ko"]);
