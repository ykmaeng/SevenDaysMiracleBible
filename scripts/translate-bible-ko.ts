/**
 * Translate the full Bible to Korean using Claude Code CLI
 *
 * Processes books chapter-by-chapter in batches, using KJV as reference.
 * Saves progress incrementally and can be resumed if interrupted.
 *
 * Usage:
 *   npx tsx scripts/translate-bible-ko.ts
 */

import { exec } from "child_process";
import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
} from "fs";
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

// Book metadata
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

// Theological glossary for consistency
const GLOSSARY = `Key terms: God→하나님, LORD/Lord→주, LORD God→주 하나님, Holy Spirit→성령, Christ→그리스도, Jesus→예수, heaven→하늘, earth→땅, covenant→언약, sin→죄, grace→은혜, faith→믿음, salvation→구원, righteousness→의, temple→성전, priest→제사장, prophet→선지자, angel→천사, demon→귀신, Satan→사탄, cross→십자가, resurrection→부활, baptism→세례, repentance→회개, forgiveness→용서, eternal life→영생, kingdom of God→하나님의 나라`;

const CONCURRENCY = 1;

interface Verse {
  translation_id: string;
  book_id: number;
  chapter: number;
  verse: number;
  text: string;
}

// Load KJV reference data
console.log("Loading KJV reference data...");
const kjvData: Verse[] = JSON.parse(
  readFileSync(join(OUTPUT_DIR, "kjv.json"), "utf-8")
);

// Group by book_id → chapter → verses
const bookChapters = new Map<number, Map<number, { verse: number; text: string }[]>>();
for (const v of kjvData) {
  if (!bookChapters.has(v.book_id)) bookChapters.set(v.book_id, new Map());
  const chapters = bookChapters.get(v.book_id)!;
  if (!chapters.has(v.chapter)) chapters.set(v.chapter, []);
  chapters.get(v.chapter)!.push({ verse: v.verse, text: v.text });
}

// Load progress
let progress: Record<string, boolean> = {};
if (existsSync(PROGRESS_FILE)) {
  progress = JSON.parse(readFileSync(PROGRESS_FILE, "utf-8"));
}

// Load existing translations
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

// Create batches: group chapters into manageable chunks
interface Batch {
  bookId: number;
  chapters: number[];
  key: string;
}

function createBatches(): Batch[] {
  const batches: Batch[] = [];
  const CHAPTERS_PER_BATCH = 1; // 1 chapter per batch to stay within token limits

  for (const [bookId, chapters] of bookChapters) {
    const chapterNums = Array.from(chapters.keys()).sort((a, b) => a - b);

    // Skip already completed chapters
    const remaining = chapterNums.filter(
      (ch) => !progress[`${bookId}:${ch}`]
    );
    if (remaining.length === 0) continue;

    // Split into batches
    for (let i = 0; i < remaining.length; i += CHAPTERS_PER_BATCH) {
      const batchChapters = remaining.slice(i, i + CHAPTERS_PER_BATCH);
      batches.push({
        bookId,
        chapters: batchChapters,
        key: `${bookId}:${batchChapters[0]}-${batchChapters[batchChapters.length - 1]}`,
      });
    }
  }

  return batches;
}

function buildPrompt(bookId: number, chapters: number[]): string {
  const bookName = BOOK_NAMES[bookId];
  let prompt = `You are a Bible translation expert. Translate the following chapters of ${bookName} into natural, modern Korean.\n\n`;
  prompt += `Guidelines:\n`;
  prompt += `- Produce natural, modern Korean (not archaic)\n`;
  prompt += `- ${GLOSSARY}\n`;
  prompt += `- Maintain the literary style of each passage (narrative, poetry, prophecy, epistle)\n`;
  prompt += `- Each verse must be complete and accurate\n\n`;

  for (const ch of chapters) {
    const verses = bookChapters.get(bookId)!.get(ch)!;
    prompt += `=== ${bookName} Chapter ${ch} ===\n`;
    for (const v of verses) {
      prompt += `${v.verse}. ${v.text}\n`;
    }
    prompt += `\n`;
  }

  prompt += `Return ONLY a valid JSON array. Each element: {"book_id":${bookId},"chapter":N,"verse":N,"text":"한국어 번역"}\n`;
  prompt += `Include ALL verses from ALL chapters above. No markdown, no explanation, just the JSON array.`;

  return prompt;
}

const MAX_RETRIES = 2;

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function translateBatch(batch: Batch): Promise<Verse[]> {
  const prompt = buildPrompt(batch.bookId, batch.chapters);
  const promptFile = join(TEMP_DIR, `prompt-${batch.bookId}-${batch.chapters[0]}.txt`);
  writeFileSync(promptFile, prompt);

  const bookName = BOOK_NAMES[batch.bookId];
  const chapterRange =
    batch.chapters.length === 1
      ? `ch${batch.chapters[0]}`
      : `ch${batch.chapters[0]}-${batch.chapters[batch.chapters.length - 1]}`;

  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    if (attempt > 0) {
      const delay = attempt * 15000; // 15s, 30s backoff
      console.log(`  Retry ${attempt}/${MAX_RETRIES} for ${bookName} ${chapterRange} (waiting ${delay / 1000}s)...`);
      await sleep(delay);
    } else {
      console.log(`  Translating ${bookName} ${chapterRange}...`);
    }

    try {
      const { stdout } = await execAsync(
        `unset CLAUDECODE && cat "${promptFile}" | claude -p --output-format text`,
        {
          timeout: 300000, // 5 min timeout
          maxBuffer: 10 * 1024 * 1024,
          shell: "/bin/zsh",
        }
      );

      // Extract JSON array from response
      const jsonMatch = stdout.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error(`  Failed to extract JSON for ${bookName} ${chapterRange}`);
        if (attempt < MAX_RETRIES) continue;
        return [];
      }

      const parsed = JSON.parse(jsonMatch[0]) as Array<{
        book_id?: number;
        chapter: number;
        verse: number;
        text: string;
      }>;

      // Normalize and add translation_id
      return parsed.map((v) => ({
        translation_id: "ai-ko",
        book_id: v.book_id ?? batch.bookId,
        chapter: v.chapter,
        verse: v.verse,
        text: v.text,
      }));
    } catch (err: any) {
      if (attempt < MAX_RETRIES) {
        console.error(`  Attempt ${attempt + 1} failed for ${bookName} ${chapterRange}, will retry...`);
        continue;
      }
      console.error(`  Error translating ${bookName} ${chapterRange}: ${err.message}`);
      return [];
    }
  }
  return [];
}

async function processInParallel(batches: Batch[]): Promise<void> {
  for (let i = 0; i < batches.length; i += CONCURRENCY) {
    const chunk = batches.slice(i, i + CONCURRENCY);
    const remaining = batches.length - i;
    console.log(
      `\n[Wave ${Math.floor(i / CONCURRENCY) + 1}/${Math.ceil(batches.length / CONCURRENCY)}] ` +
        `Processing ${chunk.length} batches (${remaining} remaining)...`
    );

    const results = await Promise.all(chunk.map((b) => translateBatch(b)));

    for (let j = 0; j < chunk.length; j++) {
      const batch = chunk[j];
      const verses = results[j];

      if (verses.length > 0) {
        translations.push(...verses);

        // Mark chapters as completed
        for (const ch of batch.chapters) {
          progress[`${batch.bookId}:${ch}`] = true;
        }

        const bookName = BOOK_NAMES[batch.bookId];
        console.log(`  ✓ ${bookName} - ${verses.length} verses translated`);
      }
    }

    // Pause between waves to control token consumption
    if (i + CONCURRENCY < batches.length) {
      console.log(`  Waiting 60s before next wave...`);
      await sleep(60000);
    }

    // Save after each wave
    saveTranslations();
    saveProgress();

    const totalDone = Object.keys(progress).length;
    const totalChapters = Array.from(bookChapters.values()).reduce(
      (sum, m) => sum + m.size,
      0
    );
    console.log(
      `  Progress: ${totalDone}/${totalChapters} chapters (${((totalDone / totalChapters) * 100).toFixed(1)}%)`
    );
  }
}

async function main() {
  console.log("=== Bible Korean Translation ===\n");

  const totalChapters = Array.from(bookChapters.values()).reduce(
    (sum, m) => sum + m.size,
    0
  );
  const completedChapters = Object.keys(progress).length;
  console.log(`Total chapters: ${totalChapters}`);
  console.log(`Already completed: ${completedChapters}`);
  console.log(`Remaining: ${totalChapters - completedChapters}\n`);

  const batches = createBatches();
  console.log(`Batches to process: ${batches.length}`);
  console.log(`Concurrency: ${CONCURRENCY}`);
  console.log(`Estimated waves: ${Math.ceil(batches.length / CONCURRENCY)}\n`);

  if (batches.length === 0) {
    console.log("All chapters already translated!");
    return;
  }

  await processInParallel(batches);

  console.log("\n=== Translation Complete ===");
  console.log(`Total verses: ${translations.length}`);
  console.log(`Output: ${OUTPUT_FILE}`);
}

main().catch(console.error);
