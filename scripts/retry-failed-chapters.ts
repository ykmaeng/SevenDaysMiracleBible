/**
 * Retry failed chapters that were skipped during the main translation run.
 * Reads/writes the same progress and output files, but only processes
 * specific failed chapters from books the main script has already passed.
 */

import { exec } from "child_process";
import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { promisify } from "util";

const execAsync = promisify(exec);
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "data", "output");
const PROGRESS_FILE = join(OUTPUT_DIR, "translation-progress.json");
const OUTPUT_FILE = join(OUTPUT_DIR, "ai-ko.json");
const TEMP_DIR = join(OUTPUT_DIR, "tmp-prompts");

if (!existsSync(TEMP_DIR)) mkdirSync(TEMP_DIR, { recursive: true });

const BOOK_NAMES: Record<number, string> = {
  1: "Genesis", 2: "Exodus", 3: "Leviticus", 4: "Numbers", 5: "Deuteronomy",
  6: "Joshua", 7: "Judges", 8: "Ruth", 9: "1 Samuel", 10: "2 Samuel",
  11: "1 Kings", 12: "2 Kings", 13: "1 Chronicles", 14: "2 Chronicles",
  15: "Ezra", 16: "Nehemiah", 17: "Esther", 18: "Job", 19: "Psalms",
  20: "Proverbs", 21: "Ecclesiastes", 22: "Song of Solomon", 23: "Isaiah",
  24: "Jeremiah", 25: "Lamentations", 26: "Ezekiel", 27: "Daniel",
  28: "Hosea", 29: "Joel", 30: "Amos", 31: "Obadiah", 32: "Jonah",
  33: "Micah", 34: "Nahum", 35: "Habakkuk", 36: "Zephaniah", 37: "Haggai",
  38: "Zechariah", 39: "Malachi",
  40: "Matthew", 41: "Mark", 42: "Luke", 43: "John", 44: "Acts",
  45: "Romans", 46: "1 Corinthians", 47: "2 Corinthians", 48: "Galatians",
  49: "Ephesians", 50: "Philippians", 51: "Colossians", 52: "1 Thessalonians",
  53: "2 Thessalonians", 54: "1 Timothy", 55: "2 Timothy", 56: "Titus",
  57: "Philemon", 58: "Hebrews", 59: "James", 60: "1 Peter", 61: "2 Peter",
  62: "1 John", 63: "2 John", 64: "3 John", 65: "Jude", 66: "Revelation",
};

const GLOSSARY = `Key terms: God→하나님, LORD/Lord→주, LORD God→주 하나님, Holy Spirit→성령, Christ→그리스도, Jesus→예수, heaven→하늘, earth→땅, covenant→언약, sin→죄, grace→은혜, faith→믿음, salvation→구원, righteousness→의, temple→성전, priest→제사장, prophet→선지자, angel→천사, demon→귀신, Satan→사탄, cross→십자가, resurrection→부활, baptism→세례, repentance→회개, forgiveness→용서, eternal life→영생, kingdom of God→하나님의 나라`;

interface Verse {
  translation_id: string;
  book_id: number;
  chapter: number;
  verse: number;
  text: string;
}

// Failed chapters to retry (one chapter at a time for reliability)
const FAILED_CHAPTERS: { bookId: number; chapter: number }[] = [
  // Deuteronomy 1-3
  { bookId: 5, chapter: 1 }, { bookId: 5, chapter: 2 }, { bookId: 5, chapter: 3 },
  // Joshua 9-11
  { bookId: 6, chapter: 9 }, { bookId: 6, chapter: 10 }, { bookId: 6, chapter: 11 },
  // Judges 17-19
  { bookId: 7, chapter: 17 }, { bookId: 7, chapter: 18 }, { bookId: 7, chapter: 19 },
  // 2 Chronicles 1-21
  ...Array.from({ length: 21 }, (_, i) => ({ bookId: 14, chapter: i + 1 })),
  // Nehemiah 7-9
  { bookId: 16, chapter: 7 }, { bookId: 16, chapter: 8 }, { bookId: 16, chapter: 9 },
  // Esther 1-9
  ...Array.from({ length: 9 }, (_, i) => ({ bookId: 17, chapter: i + 1 })),
];

console.log("Loading KJV reference data...");
const kjvData: Verse[] = JSON.parse(
  readFileSync(join(OUTPUT_DIR, "kjv.json"), "utf-8")
);

const bookChapters = new Map<number, Map<number, { verse: number; text: string }[]>>();
for (const v of kjvData) {
  if (!bookChapters.has(v.book_id)) bookChapters.set(v.book_id, new Map());
  const chapters = bookChapters.get(v.book_id)!;
  if (!chapters.has(v.chapter)) chapters.set(v.chapter, []);
  chapters.get(v.chapter)!.push({ verse: v.verse, text: v.text });
}

let progress: Record<string, boolean> = {};
if (existsSync(PROGRESS_FILE)) {
  progress = JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"));
}

let translations: Verse[] = [];
if (existsSync(OUTPUT_FILE)) {
  translations = JSON.parse(readFileSync(OUTPUT_FILE, "utf-8"));
}

function saveProgress() {
  writeFileSync(PROGRESS_FILE, JSON.stringify(progress, null, 2));
}

function saveTranslations() {
  writeFileSync(OUTPUT_FILE, JSON.stringify(translations, null, 2));
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function buildPrompt(bookId: number, chapter: number): string {
  const bookName = BOOK_NAMES[bookId];
  let prompt = `You are a Bible translation expert. Translate the following chapter of ${bookName} into natural, modern Korean.\n\n`;
  prompt += `Guidelines:\n`;
  prompt += `- Produce natural, modern Korean (not archaic)\n`;
  prompt += `- ${GLOSSARY}\n`;
  prompt += `- Maintain the literary style of the passage (narrative, poetry, prophecy, epistle)\n`;
  prompt += `- Each verse must be complete and accurate\n\n`;

  const verses = bookChapters.get(bookId)!.get(chapter)!;
  prompt += `=== ${bookName} Chapter ${chapter} ===\n`;
  for (const v of verses) {
    prompt += `${v.verse}. ${v.text}\n`;
  }
  prompt += `\n`;

  prompt += `Return ONLY a valid JSON array. Each element: {"book_id":${bookId},"chapter":${chapter},"verse":N,"text":"한국어 번역"}\n`;
  prompt += `Include ALL verses. No markdown, no explanation, just the JSON array.`;

  return prompt;
}

const MAX_RETRIES = 3;

async function translateChapter(bookId: number, chapter: number): Promise<Verse[]> {
  const key = `${bookId}:${chapter}`;
  if (progress[key]) {
    return [];
  }

  const prompt = buildPrompt(bookId, chapter);
  const promptFile = join(TEMP_DIR, `retry-${bookId}-${chapter}.txt`);
  writeFileSync(promptFile, prompt);

  const bookName = BOOK_NAMES[bookId];

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = attempt * 15000;
      console.log(`  Retry ${attempt}/${MAX_RETRIES} for ${bookName} ch${chapter} (waiting ${delay / 1000}s)...`);
      await sleep(delay);
    } else {
      console.log(`  Translating ${bookName} ch${chapter}...`);
    }

    try {
      const { stdout } = await execAsync(
        `unset CLAUDECODE && cat "${promptFile}" | claude -p --output-format text`,
        { timeout: 300000, maxBuffer: 10 * 1024 * 1024, shell: "/bin/zsh" }
      );

      const jsonMatch = stdout.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error(`  Failed to extract JSON for ${bookName} ch${chapter}`);
        if (attempt < MAX_RETRIES) continue;
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]) as Array<{
        book_id?: number; chapter: number; verse: number; text: string;
      }>;

      return parsed.map((v) => ({
        translation_id: "ai-ko",
        book_id: v.book_id ?? bookId,
        chapter: v.chapter,
        verse: v.verse,
        text: v.text,
      }));
    } catch (err: any) {
      if (attempt < MAX_RETRIES) {
        console.error(`  Attempt ${attempt + 1} failed for ${bookName} ch${chapter}, will retry...`);
        continue;
      }
      console.error(`  Error translating ${bookName} ch${chapter}: ${err.message}`);
      return [];
    }
  }
  return [];
}

async function main() {
  console.log("=== Retry Failed Chapters ===\n");

  // Filter out already completed
  const todo = FAILED_CHAPTERS.filter((c) => !progress[`${c.bookId}:${c.chapter}`]);
  console.log(`Failed chapters to retry: ${todo.length}\n`);

  if (todo.length === 0) {
    console.log("All failed chapters already completed!");
    return;
  }

  for (let i = 0; i < todo.length; i++) {
    const { bookId, chapter } = todo[i];
    console.log(`\n[${i + 1}/${todo.length}]`);

    const verses = await translateChapter(bookId, chapter);

    if (verses.length > 0) {
      // Re-read files to avoid overwriting main script's progress
      progress = JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"));
      translations = JSON.parse(readFileSync(OUTPUT_FILE, "utf-8"));

      translations.push(...verses);
      progress[`${bookId}:${chapter}`] = true;

      saveTranslations();
      saveProgress();

      console.log(`  ✓ ${BOOK_NAMES[bookId]} ch${chapter} - ${verses.length} verses translated`);
    }

    // Brief pause between chapters
    if (i < todo.length - 1) await sleep(3000);
  }

  console.log("\n=== Retry Complete ===");
}

main().catch(console.error);
