/**
 * Children's Story Bible Generator
 *
 * Generates easy-to-understand Bible translations for children (ages 5-10).
 * Supports multiple languages (ko, en). Writes directly to SQLite DB.
 *
 * Usage:
 *   npx tsx scripts/generate-story-bible.ts
 *   npx tsx scripts/generate-story-bible.ts --language=en
 *   npx tsx scripts/generate-story-bible.ts --book=1 --chapter=1
 *   npx tsx scripts/generate-story-bible.ts --model=claude-sonnet-4-6
 *   npx tsx scripts/generate-story-bible.ts --interval=30
 */

import { existsSync, readFileSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "data", "output");
const KJV_PATH = join(OUTPUT_DIR, "kjv.json");

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

interface KjvVerse {
  translation_id: string;
  book_id: number;
  chapter: number;
  verse: number;
  text: string;
}

function loadKjvChapter(kjvData: KjvVerse[], bookId: number, chapter: number): string {
  const verses = kjvData.filter((v) => v.book_id === bookId && v.chapter === chapter);
  return verses.map((v) => `${v.verse}. ${v.text}`).join("\n");
}

function buildPrompt(bookName: string, bookId: number, chapter: number, kjvText: string, language: string, translationId: string): string {
  if (language === "en") {
    return `You are a Bible story translator for children.

## Role
Translate KJV Bible text into simple, warm English stories that children ages 5-10 can easily understand.

## Translation Principles
1. **Simple words**: Use everyday vocabulary. Avoid theological jargon and archaic language.
   - "begat" → "became the father of" or "had a son named"
   - "firmament" → "big beautiful sky"
   - "covenant" → "special promise"
   - "sacrifice" → "special gift to God"
   - "transgression" → "wrong things"
   - "righteousness" → "doing what is right"
2. **Storytelling tone**: Write as if telling a bedtime story to a child — warm, lively, and engaging.
3. **Wonder and excitement**: Add expressions like "How amazing!", "What a wonderful thing!" where appropriate.
4. **Faithful to source**: Follow the verse structure and content of the original. Do not skip or add content. Translate every single verse.
5. **God's name**: Use "God" consistently. Translate LORD as "God".
6. **Proper nouns**: Keep standard English Bible names (Abraham, Moses, Israel, etc.)

## Input
${bookName} Chapter ${chapter} (book_id: ${bookId})

${kjvText}

## Output Format
Output ONLY a JSON array. No explanations, no markdown code blocks — just pure JSON.
[
  {"translation_id": "${translationId}", "book_id": ${bookId}, "chapter": ${chapter}, "verse": 1, "text": "Translated text"},
  ...
]`;
  }

  // Korean (default)
  return `당신은 어린이를 위한 성경 이야기 번역가입니다.

## 역할
KJV 원문 성경 텍스트를 5-10세 어린이가 이해할 수 있는 쉽고 따뜻한 한국어 이야기체로 번역합니다.

## 번역 원칙
1. **쉬운 단어**: 어려운 한자어나 신학 용어를 피하고 일상적인 단어를 사용하세요
   - 창조하셨다 → 만드셨어요
   - 궁창 → 넓은 하늘
   - 수면 → 물 위
   - 권세 → 힘
   - 언약 → 약속
   - 제사 → 예물을 드리는 것
2. **존댓말 해요체**: "~했어요", "~이에요" 체를 사용하세요
3. **이야기체**: 마치 아이에게 이야기를 들려주듯 따뜻하고 생동감 있게 표현하세요
4. **감탄과 생동감**: 적절히 "정말로!", "참 좋았어요" 같은 표현을 넣으세요
5. **원문 충실**: 절 구조와 내용은 원문을 따르되, 표현만 쉽게 바꾸세요. 내용을 빼거나 추가하지 마세요. 모든 절을 빠짐없이 번역하세요.
6. **하나님 호칭**: "하나님"을 그대로 사용하세요. LORD는 "하나님"으로, God은 "하나님"으로 번역하세요.
7. **고유명사**: 인명과 지명은 한국어 성경에서 일반적으로 사용되는 표기를 따르세요 (예: Abraham → 아브라함, Moses → 모세, Israel → 이스라엘)

## 입력
${bookName} Chapter ${chapter} (book_id: ${bookId})

${kjvText}

## 출력 형식
JSON 배열만 출력하세요. 다른 설명이나 마크다운 코드블록 없이 순수 JSON만 출력하세요.
[
  {"translation_id": "${translationId}", "book_id": ${bookId}, "chapter": ${chapter}, "verse": 1, "text": "번역된 텍스트"},
  ...
]`;
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

function parseResponse(raw: string): { verse: number; text: string }[] {
  // Strip markdown code block if present
  let cleaned = raw;
  if (cleaned.startsWith("```")) {
    cleaned = cleaned.replace(/^```(?:json)?\n?/, "").replace(/\n?```$/, "");
  }

  const parsed = JSON.parse(cleaned);
  if (!Array.isArray(parsed)) throw new Error("Response is not an array");

  return parsed.map((v: { verse: number; text: string }) => ({
    verse: v.verse,
    text: v.text,
  }));
}

function initDb(dbPath: string): Database.Database {
  mkdirSync(OUTPUT_DIR, { recursive: true });
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec(`CREATE TABLE IF NOT EXISTS verses (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    translation_id TEXT NOT NULL,
    book_id INTEGER NOT NULL,
    chapter INTEGER NOT NULL,
    verse INTEGER NOT NULL,
    text TEXT NOT NULL,
    UNIQUE (translation_id, book_id, chapter, verse)
  )`);
  db.exec("CREATE INDEX IF NOT EXISTS idx_verses_lookup ON verses(translation_id, book_id, chapter)");

  return db;
}

function getCompletedChapters(db: Database.Database, translationId: string): Set<string> {
  const rows = db
    .prepare("SELECT DISTINCT book_id, chapter FROM verses WHERE translation_id = ?")
    .all(translationId) as { book_id: number; chapter: number }[];
  return new Set(rows.map((r) => `${r.book_id}-${r.chapter}`));
}

async function main() {
  const args = process.argv.slice(2);
  const language = args.find((a) => a.startsWith("--language="))?.split("=")[1] ?? "ko";
  const bookFilter = args.find((a) => a.startsWith("--book="))?.split("=")[1];
  const chapterFilter = args.find((a) => a.startsWith("--chapter="))?.split("=")[1];
  const model = args.find((a) => a.startsWith("--model="))?.split("=")[1] ?? "claude-sonnet-4-6";
  const intervalSec = args.find((a) => a.startsWith("--interval="))?.split("=")[1];
  const INTERVAL_MS = intervalSec ? parseInt(intervalSec) * 1000 : 0;

  const TRANSLATION_ID = `story-${language}`;
  const DB_PATH = join(OUTPUT_DIR, `story-${language}.db`);

  // Load KJV data
  if (!existsSync(KJV_PATH)) {
    console.error("KJV data not found:", KJV_PATH);
    process.exit(1);
  }
  console.log("Loading KJV data...");
  const kjvData: KjvVerse[] = JSON.parse(readFileSync(KJV_PATH, "utf-8"));
  console.log(`Loaded ${kjvData.length} KJV verses.`);

  // Init DB
  const db = initDb(DB_PATH);
  const completed = getCompletedChapters(db, TRANSLATION_ID);
  console.log(`Language: ${language}, Translation: ${TRANSLATION_ID}`);
  console.log(`DB: ${DB_PATH}`);
  console.log(`Already completed: ${completed.size} chapters.\n`);

  const insertVerse = db.prepare(
    "INSERT OR REPLACE INTO verses (translation_id, book_id, chapter, verse, text) VALUES (?, ?, ?, ?, ?)"
  );
  const insertChapter = db.transaction((verses: { verse: number; text: string }[], bookId: number, chapter: number) => {
    for (const v of verses) {
      insertVerse.run(TRANSLATION_ID, bookId, chapter, v.verse, v.text);
    }
  });

  // Build pending list
  const pending: { bookId: number; chapter: number }[] = [];
  const startBook = bookFilter ? parseInt(bookFilter) : 1;
  const endBook = bookFilter ? parseInt(bookFilter) : 66;

  for (let bookId = startBook; bookId <= endBook; bookId++) {
    const maxCh = CHAPTER_COUNTS[bookId] ?? 0;
    const startCh = chapterFilter ? parseInt(chapterFilter) : 1;
    const endCh = chapterFilter ? parseInt(chapterFilter) : maxCh;

    for (let ch = startCh; ch <= endCh; ch++) {
      if (!completed.has(`${bookId}-${ch}`)) {
        pending.push({ bookId, chapter: ch });
      }
    }
  }

  if (pending.length === 0) {
    console.log("All requested chapters already translated. Nothing to do.");
    db.close();
    return;
  }

  console.log(`Generating ${TRANSLATION_ID} for ${pending.length} chapters (model: ${model})...\n`);

  let processed = 0;

  for (const { bookId, chapter } of pending) {
    const bookName = BOOK_NAMES[bookId] ?? `Book ${bookId}`;
    const kjvText = loadKjvChapter(kjvData, bookId, chapter);

    if (!kjvText) {
      console.log(`  [${++processed}/${pending.length}] ${bookName} ${chapter}... SKIPPED (no KJV data)`);
      continue;
    }

    process.stdout.write(`  [${++processed}/${pending.length}] ${bookName} ${chapter}... `);

    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const prompt = buildPrompt(bookName, bookId, chapter, kjvText, language, TRANSLATION_ID);
        const raw = callClaude(prompt, model);

        if (!raw) {
          if (attempt < MAX_RETRIES) {
            process.stdout.write(`empty, retry ${attempt}/${MAX_RETRIES}... `);
            continue;
          }
          console.log("EMPTY (gave up)");
          break;
        }

        const verses = parseResponse(raw);

        if (verses.length === 0) {
          if (attempt < MAX_RETRIES) {
            process.stdout.write(`no verses, retry ${attempt}/${MAX_RETRIES}... `);
            continue;
          }
          console.log("NO VERSES (gave up)");
          break;
        }

        insertChapter(verses, bookId, chapter);
        console.log(`done (${verses.length} verses)`);

        if (INTERVAL_MS > 0) {
          await new Promise((r) => setTimeout(r, INTERVAL_MS));
        }
        break;
      } catch (err) {
        if (attempt < MAX_RETRIES) {
          process.stdout.write(`retry ${attempt}/${MAX_RETRIES}... `);
          await new Promise((r) => setTimeout(r, 5000));
        } else {
          console.log(`FAILED after ${MAX_RETRIES} attempts: ${err}`);
        }
      }
    }
  }

  const totalCount = db.prepare("SELECT COUNT(*) as c FROM verses WHERE translation_id = ?").get(TRANSLATION_ID) as { c: number };
  const chapterCount = db.prepare("SELECT COUNT(DISTINCT book_id || '-' || chapter) as c FROM verses WHERE translation_id = ?").get(TRANSLATION_ID) as { c: number };
  console.log(`\nTotal: ${totalCount.c} verses in ${chapterCount.c} chapters → ${DB_PATH}`);

  db.pragma("journal_mode = DELETE");
  db.close();
}

main().catch(console.error);
