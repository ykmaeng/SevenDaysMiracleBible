import { fetch } from "@tauri-apps/plugin-http";
import { execute, query } from "./db";
import { DOWNLOAD_CONFIG } from "./downloadConfig";
import { useDownloadStore } from "../stores/downloadStore";

export interface DictionaryEntry {
  word: string;
  phonetic?: string;
  meanings: {
    partOfSpeech: string;
    definitions: { definition: string; translated?: string; example?: string }[];
  }[];
}

interface DictionaryRow {
  word: string;
  phonetic: string | null;
  data: string;
}

const DICTIONARY_DOWNLOAD_ID = "english-dictionary";

function toErrorMessage(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === "string") return err;
  return JSON.stringify(err);
}

export async function ensureDictionaryTable(): Promise<void> {
  await execute(`
    CREATE TABLE IF NOT EXISTS dictionary (
      word TEXT PRIMARY KEY,
      phonetic TEXT,
      data TEXT NOT NULL
    )
  `);
}

export async function lookupOffline(word: string): Promise<DictionaryEntry | null> {
  const rows = await query<DictionaryRow>(
    "SELECT word, phonetic, data FROM dictionary WHERE word = $1",
    [word.toLowerCase()]
  );
  if (rows.length === 0) return null;
  const row = rows[0];
  return {
    word: row.word,
    phonetic: row.phonetic ?? undefined,
    meanings: JSON.parse(row.data),
  };
}

export async function lookupOnline(word: string): Promise<DictionaryEntry | null> {
  const url = `https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`;
  const response = await fetch(url);

  if (!response.ok) return null;

  const data = await response.json();
  if (!Array.isArray(data) || data.length === 0) return null;

  const entry = data[0];
  return {
    word: entry.word ?? word,
    phonetic: entry.phonetic ?? entry.phonetics?.[0]?.text ?? undefined,
    meanings: (entry.meanings ?? []).map((m: Record<string, unknown>) => ({
      partOfSpeech: m.partOfSpeech as string,
      definitions: ((m.definitions ?? []) as Record<string, unknown>[])
        .slice(0, 3)
        .map((d) => ({
          definition: d.definition as string,
          example: (d.example as string) ?? undefined,
        })),
    })),
  };
}

export async function isDictionaryDownloaded(): Promise<boolean> {
  try {
    const rows = await query<{ cnt: number }>(
      "SELECT COUNT(*) as cnt FROM dictionary",
      []
    );
    return rows[0]?.cnt > 0;
  } catch {
    return false;
  }
}

export async function downloadDictionary(): Promise<void> {
  const store = useDownloadStore.getState();
  store.startDownload(DICTIONARY_DOWNLOAD_ID);

  try {
    await ensureDictionaryTable();

    const url = `${DOWNLOAD_CONFIG.baseUrl}/${DOWNLOAD_CONFIG.tag}/english-dictionary.json`;
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Download failed: ${response.status} ${response.statusText}`);
    }

    store.updateProgress(DICTIONARY_DOWNLOAD_ID, 30);

    const entries: { word: string; phonetic?: string; meanings: DictionaryEntry["meanings"] }[] =
      await response.json();
    store.updateProgress(DICTIONARY_DOWNLOAD_ID, 50);
    store.setStatus(DICTIONARY_DOWNLOAD_ID, "importing");

    await execute("DELETE FROM dictionary");

    const batchSize = 500;
    for (let i = 0; i < entries.length; i += batchSize) {
      const batch = entries.slice(i, i + batchSize);
      for (const e of batch) {
        await execute(
          "INSERT OR IGNORE INTO dictionary (word, phonetic, data) VALUES ($1, $2, $3)",
          [e.word.toLowerCase(), e.phonetic ?? null, JSON.stringify(e.meanings)]
        );
      }
      const progress = 50 + Math.round((i / entries.length) * 45);
      store.updateProgress(DICTIONARY_DOWNLOAD_ID, Math.min(progress, 95));
    }

    store.setStatus(DICTIONARY_DOWNLOAD_ID, "done");
  } catch (err) {
    const message = toErrorMessage(err);
    store.setStatus(DICTIONARY_DOWNLOAD_ID, "error", message);
    throw err;
  }
}

export async function deleteDictionary(): Promise<void> {
  try {
    await execute("DROP TABLE IF EXISTS dictionary");
  } catch (err) {
    console.error("[dictionary] Delete error:", err);
    throw err;
  }
}

export const DICTIONARY_DOWNLOAD_KEY = DICTIONARY_DOWNLOAD_ID;

// Map app language codes to Google Translate language codes
const TRANSLATE_LANG_MAP: Record<string, string> = {
  ko: "ko",
  zh: "zh-CN",
  es: "es",
  ja: "ja",
  de: "de",
  fr: "fr",
  pt: "pt",
  ru: "ru",
  en: "en",
  he: "iw",
  el: "el",
};

function toGoogleLang(lang: string): string | null {
  return TRANSLATE_LANG_MAP[lang] ?? null;
}

const DELIMITER = "\n\n";

/** Reassemble full translated text from Google Translate response */
function extractTranslation(data: unknown): string {
  let full = "";
  if (Array.isArray(data) && Array.isArray(data[0])) {
    for (const segment of data[0]) {
      if (Array.isArray(segment) && typeof segment[0] === "string") {
        full += segment[0];
      }
    }
  }
  return full;
}

export async function translateDefinitions(
  entry: DictionaryEntry,
  sourceLang: string,
  targetLang: string
): Promise<DictionaryEntry> {
  const sl = toGoogleLang(sourceLang);
  const tl = toGoogleLang(targetLang);
  if (!sl || !tl) return entry;

  // Collect all definition texts
  const texts: string[] = [];
  for (const m of entry.meanings) {
    for (const d of m.definitions) {
      texts.push(d.definition);
    }
  }
  if (texts.length === 0) return entry;

  // Batch translate: join all texts, one API call, then split
  const joined = texts.join(DELIMITER);
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&q=${encodeURIComponent(joined)}`;

  const res = await fetch(url);
  if (!res.ok) return entry;

  const data = await res.json();
  const fullTranslated = extractTranslation(data);
  if (!fullTranslated) return entry;

  // Split back by delimiter
  const translated = fullTranslated.split(DELIMITER);

  // Map translations back into the entry
  let idx = 0;
  const translatedEntry: DictionaryEntry = {
    ...entry,
    meanings: entry.meanings.map((m) => ({
      ...m,
      definitions: m.definitions.map((d) => ({
        ...d,
        translated: idx < translated.length ? translated[idx++].trim() : undefined,
      })),
    })),
  };

  return translatedEntry;
}

/**
 * Lookup a non-English word via Google Translate.
 * Returns a DictionaryEntry with the translation as definition.
 */
export async function lookupViaTranslate(
  word: string,
  sourceLang: string,
  targetLang: string
): Promise<DictionaryEntry | null> {
  const sl = toGoogleLang(sourceLang);
  const tl = toGoogleLang(targetLang);
  if (!sl || !tl) return null;

  // Use dt=t (translation) + dt=bd (dictionary/definitions) for richer results
  const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=${sl}&tl=${tl}&dt=t&dt=bd&q=${encodeURIComponent(word)}`;

  const res = await fetch(url);
  if (!res.ok) return null;

  const data = await res.json();

  // Extract translation
  const translated = extractTranslation(data);
  if (!translated) return null;

  const meanings: DictionaryEntry["meanings"] = [];

  // data[1] contains dictionary entries: [[partOfSpeech, [translations...], ...], ...]
  if (Array.isArray(data[1])) {
    for (const group of data[1]) {
      if (!Array.isArray(group) || group.length < 2) continue;
      const partOfSpeech = typeof group[0] === "string" ? group[0] : "";
      const defs: { definition: string; translated?: string }[] = [];
      if (Array.isArray(group[1])) {
        for (const item of group[1].slice(0, 4)) {
          if (typeof item === "string") {
            defs.push({ definition: item });
          }
        }
      }
      if (defs.length > 0) {
        meanings.push({ partOfSpeech, definitions: defs });
      }
    }
  }

  // If no dictionary entries, create a simple translation entry
  if (meanings.length === 0) {
    meanings.push({
      partOfSpeech: "",
      definitions: [{ definition: translated.trim() }],
    });
  }

  return {
    word,
    meanings,
  };
}
