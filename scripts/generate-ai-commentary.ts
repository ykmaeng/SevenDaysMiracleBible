/**
 * AI Bible Commentary Generator
 *
 * Generates chapter-level commentary in multiple languages using Claude Code CLI.
 *
 * Usage:
 *   npx tsx scripts/generate-ai-commentary.ts
 *   npx tsx scripts/generate-ai-commentary.ts --book=9
 *   npx tsx scripts/generate-ai-commentary.ts --book=9 --chapter=1
 *   npx tsx scripts/generate-ai-commentary.ts --model=claude-sonnet-4-6
 *   npx tsx scripts/generate-ai-commentary.ts --sync-db   # bulk import JSON → DB
 */

import { writeFileSync, existsSync, readFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const OUTPUT_DIR = join(__dirname, "data", "output", "commentary");
const DB_PATH = join(__dirname, "..", "src-tauri", "resources", "bible-core.db");

const LANGUAGE_NAMES: Record<string, string> = {
  ko: "Korean",
  en: "English",
  zh: "Chinese (Simplified)",
  es: "Spanish",
};

const BOOK_NAMES: Record<number, string> = {
  1: "Genesis", 2: "Exodus", 3: "Leviticus", 4: "Numbers", 5: "Deuteronomy",
  6: "Joshua", 7: "Judges", 8: "Ruth", 9: "1 Samuel", 10: "2 Samuel",
  11: "1 Kings", 12: "2 Kings", 13: "1 Chronicles", 14: "2 Chronicles",
  15: "Ezra", 16: "Nehemiah", 17: "Esther", 18: "Job", 19: "Psalms",
  20: "Proverbs", 21: "Ecclesiastes", 22: "Song of Solomon", 23: "Isaiah",
  24: "Jeremiah", 25: "Lamentations", 26: "Ezekiel", 27: "Daniel",
  28: "Hosea", 29: "Joel", 30: "Amos", 31: "Obadiah", 32: "Jonah",
  33: "Micah", 34: "Nahum", 35: "Habakkuk", 36: "Zephaniah", 37: "Haggai",
  38: "Zechariah", 39: "Malachi", 40: "Matthew", 41: "Mark", 42: "Luke",
  43: "John", 44: "Acts", 45: "Romans", 46: "1 Corinthians",
  47: "2 Corinthians", 48: "Galatians", 49: "Ephesians", 50: "Philippians",
  51: "Colossians", 52: "1 Thessalonians", 53: "2 Thessalonians",
  54: "1 Timothy", 55: "2 Timothy", 56: "Titus", 57: "Philemon",
  58: "Hebrews", 59: "James", 60: "1 Peter", 61: "2 Peter",
  62: "1 John", 63: "2 John", 64: "3 John", 65: "Jude", 66: "Revelation",
};

const CHAPTER_COUNTS: Record<number, number> = {
  1:50,2:40,3:27,4:36,5:34,6:24,7:21,8:4,9:31,10:24,
  11:22,12:25,13:29,14:36,15:10,16:13,17:10,18:42,19:150,
  20:31,21:12,22:8,23:66,24:52,25:5,26:48,27:12,28:14,29:3,
  30:9,31:1,32:4,33:7,34:3,35:3,36:3,37:2,38:14,39:4,
  40:28,41:16,42:24,43:21,44:28,45:16,46:16,47:13,48:6,49:6,
  50:4,51:4,52:5,53:3,54:6,55:4,56:3,57:1,
  58:13,59:5,60:5,61:3,62:5,63:1,64:1,65:1,66:22,
};

function buildCommentaryPrompt(
  languageName: string,
  bookName: string,
  chapter: number,
): string {
  return `You are a seasoned Bible scholar and pastor writing an in-depth chapter commentary (성경강해). Write in ${languageName}.

CHAPTER: ${bookName} Chapter ${chapter}

Write a comprehensive, scholarly yet accessible commentary covering ALL of the following sections:

## 배경과 문맥 (Background & Context)
- This chapter's position within the book and the broader biblical narrative
- Historical setting: time period, author, audience, circumstances of writing
- Literary genre and structure of this chapter (narrative, poetry, prophecy, epistle, etc.)
- Connection to preceding and following chapters

## 본문 해설 (Verse-by-Verse Exposition)
- Walk through the chapter's key passages in order
- Explain difficult or significant words/phrases with reference to original Hebrew/Greek meaning where relevant
- Highlight literary devices, parallelism, chiasm, or rhetorical structures
- Note textual or translation issues where they significantly affect meaning

## 핵심 신학 주제 (Key Theological Themes)
- Central theological message(s) of this chapter
- How this chapter contributes to major biblical doctrines (God's character, salvation, covenant, kingdom, etc.)
- Typology and foreshadowing — connections to Christ and the gospel (for OT passages)
- How this passage fits into redemptive history (creation → fall → redemption → restoration)

## 교차 참조 (Cross-References)
- 3-5 most important cross-references with brief explanation of how they connect
- Show how Scripture interprets Scripture on the themes found here

## 적용 (Application)
- What did this passage mean to the original audience?
- What timeless principles emerge for believers today?
- Specific, practical challenges or encouragements for modern life
- Questions for personal reflection or group discussion (2-3 questions)

RULES:
- Write entirely in ${languageName}
- Length: 1,500-2,000 words (심도있는 강해)
- Use markdown formatting with ## headers for each section
- Be theologically orthodox and balanced (evangelical perspective)
- Avoid denominational bias
- Do not reproduce the full Bible text — reference verses by number
- Use respectful, pastoral tone — this is for spiritual edification, not academic papers
- Where relevant, include insights from church history or notable commentators
- Output ONLY the commentary text, no preamble or explanation.`;
}

function callClaude(prompt: string, model: string): string {
  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;

  const result = spawnSync("claude", ["-p", "--model", model], {
    input: prompt,
    encoding: "utf-8",
    env,
    timeout: 300_000,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || `exit code ${result.status}`);

  return (result.stdout ?? "").trim();
}

async function main() {
  const args = process.argv.slice(2);
  const language = args.find((a) => a.startsWith("--language="))?.split("=")[1] ?? "ko";
  const bookFilter = args.find((a) => a.startsWith("--book="))?.split("=")[1];
  const chapterFilter = args.find((a) => a.startsWith("--chapter="))?.split("=")[1];
  const model = args.find((a) => a.startsWith("--model="))?.split("=")[1] ?? "claude-sonnet-4-6";

  const syncOnly = args.includes("--sync-db");

  if (!LANGUAGE_NAMES[language]) {
    console.error(`Unsupported language: ${language}`);
    process.exit(1);
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });

  // Open DB for direct writes
  const db = existsSync(DB_PATH) ? new Database(DB_PATH) : null;
  const insertDb = db?.prepare(
    "INSERT OR REPLACE INTO commentary (book_id, chapter, verse, language, content, model_version) VALUES (?, ?, ?, ?, ?, ?)"
  );
  if (db) {
    console.log(`DB: ${DB_PATH}`);
  } else {
    console.log("Warning: bible-core.db not found, skipping DB writes.");
  }

  // Load existing commentary data for resume support
  const outPath = join(OUTPUT_DIR, `commentary-${language}.json`);
  const existing: {
    book_id: number;
    chapter: number;
    language: string;
    content: string;
    model_version: string;
  }[] = existsSync(outPath) ? JSON.parse(readFileSync(outPath, "utf-8")) : [];

  const existingKeys = new Set(existing.map((e) => `${e.book_id}-${e.chapter}`));
  console.log(`Found ${existing.length} existing commentaries.`);

  // --sync-db: bulk import existing JSON into DB and exit
  if (syncOnly) {
    if (!db) {
      console.error("Cannot sync: bible-core.db not found.");
      process.exit(1);
    }
    const bulkInsert = db.transaction(() => {
      for (const e of existing) {
        insertDb!.run(e.book_id, e.chapter, null, e.language, e.content, e.model_version);
      }
    });
    bulkInsert();
    const dbCount = db.prepare("SELECT COUNT(*) as c FROM commentary").get() as { c: number };
    console.log(`Synced ${existing.length} entries to DB. Total in DB: ${dbCount.c}`);
    db.close();
    return;
  }

  // Build pending list
  const pending: { bookId: number; chapter: number }[] = [];
  const startBook = bookFilter ? parseInt(bookFilter) : 1;
  const endBook = bookFilter ? parseInt(bookFilter) : 66;

  for (let bookId = startBook; bookId <= endBook; bookId++) {
    const maxCh = CHAPTER_COUNTS[bookId] ?? 0;
    const startCh = chapterFilter ? parseInt(chapterFilter) : 1;
    const endCh = chapterFilter ? parseInt(chapterFilter) : maxCh;

    for (let ch = startCh; ch <= endCh; ch++) {
      const key = `${bookId}-${ch}`;
      if (!existingKeys.has(key)) {
        pending.push({ bookId, chapter: ch });
      }
    }
  }

  if (pending.length === 0) {
    console.log("All requested chapters already have commentary. Nothing to do.");
    return;
  }

  console.log(`Generating ${language} commentary for ${pending.length} chapters (model: ${model})...\n`);

  const results = [...existing];
  let processed = 0;

  for (const { bookId, chapter } of pending) {
    const bookName = BOOK_NAMES[bookId] ?? `Book ${bookId}`;
    const languageName = LANGUAGE_NAMES[language] ?? language;

    process.stdout.write(
      `  [${++processed}/${pending.length}] ${bookName} ${chapter}... `
    );

    const MAX_RETRIES = 3;
    let success = false;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const prompt = buildCommentaryPrompt(languageName, bookName, chapter);
        const content = callClaude(prompt, model);

        if (!content) {
          if (attempt < MAX_RETRIES) {
            process.stdout.write(`empty, retry ${attempt}/${MAX_RETRIES}... `);
            continue;
          }
          console.log("EMPTY (gave up)");
          break;
        }

        results.push({
          book_id: bookId,
          chapter,
          language,
          content,
          model_version: model,
        });

        // Write to JSON + DB simultaneously
        writeFileSync(outPath, JSON.stringify(results, null, 2));
        insertDb?.run(bookId, chapter, null, language, content, model);
        console.log(`done (${content.length} chars)`);
        success = true;
        break;
      } catch (err) {
        if (attempt < MAX_RETRIES) {
          process.stdout.write(`retry ${attempt}/${MAX_RETRIES}... `);
          // Wait before retry
          await new Promise((r) => setTimeout(r, 5000));
        } else {
          console.log(`FAILED after ${MAX_RETRIES} attempts: ${err}`);
          writeFileSync(outPath, JSON.stringify(results, null, 2));
        }
      }
    }
  }

  const newCount = results.length - existing.length;
  console.log(`\nTotal: ${results.length} commentaries (${newCount} new) → ${outPath}`);
  if (db) {
    const dbCount = db.prepare("SELECT COUNT(*) as c FROM commentary").get() as { c: number };
    console.log(`DB commentary entries: ${dbCount.c}`);
    db.close();
  }
}

main().catch(console.error);
