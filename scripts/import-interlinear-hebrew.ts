/**
 * Import Hebrew OT interlinear data into bible-core.db
 *
 * Usage: npx tsx scripts/import-interlinear-hebrew.ts
 *
 * Parses BHSA-8-layer-interlinear.csv (OpenHebrewBible) and inserts
 * word-by-word Hebrew OT data into the interlinear_words table.
 * Uses the same table as Greek NT data (distinguished by book_id range).
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = resolve(__dirname, "data/interlinear/BHSA-8-layer-interlinear.csv");
const DB_PATH = resolve(__dirname, "../src-tauri/resources/bible-core.db");

interface InterlinearWord {
  book_id: number;
  chapter: number;
  verse: number;
  word_pos: number;
  hebrew_word: string;
  lexeme: string;
  transliteration: string;
  morphology: string;
  strongs: string;
  gloss: string;
}

/** Strip HTML tags like <heb>...</heb> */
function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").trim();
}

/** Parse 〔field1｜field2｜...〕 into an array */
function parseDelimited(s: string): string[] {
  const match = s.match(/〔(.*)〕/);
  if (!match) return [];
  return match[1].split("｜");
}

function parseLine(line: string): InterlinearWord | null {
  const cols = line.split("\t");
  if (cols.length < 12) return null;

  // Column 2 (index 1): 〔KJVverseID｜book｜chapter｜verse〕
  const ref = parseDelimited(cols[1]);
  if (ref.length < 4) return null;

  const book_id = parseInt(ref[1]);
  const chapter = parseInt(ref[2]);
  const verse = parseInt(ref[3]);
  if (isNaN(book_id) || isNaN(chapter) || isNaN(verse)) return null;
  if (book_id < 1 || book_id > 39) return null; // OT only

  // Column 3 (index 2): BHSA — Hebrew word with <heb> tags
  const hebrew_word = stripHtml(cols[2]);
  if (!hebrew_word) return null;

  // Column 4 (index 3): SBL-style transliteration
  const transliteration = cols[3]?.trim() || "";

  // Column 6 (index 5): HebrewLexeme — with <heb> tags
  const lexeme = stripHtml(cols[5]);

  // Column 8 (index 7): extendedStrongNumber
  const strongs = cols[7]?.trim() || "";

  // Column 9 (index 8): morphologyCode
  const morphology = cols[8]?.trim() || "";

  // Column 11 (index 10): ETCBCgloss
  const gloss = cols[10]?.trim() || "";

  return {
    book_id,
    chapter,
    verse,
    word_pos: 0,
    hebrew_word,
    lexeme,
    transliteration,
    morphology,
    strongs,
    gloss,
  };
}

function main() {
  console.log("Reading BHSA Hebrew interlinear CSV...");
  const csv = readFileSync(CSV_PATH, "utf-8");
  const lines = csv.split("\n");
  console.log(`  ${lines.length} lines`);

  // Parse all words
  const words: InterlinearWord[] = [];
  let lastRef = "";
  let wordPos = 0;

  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const word = parseLine(line);
    if (!word) continue;

    const ref = `${word.book_id}:${word.chapter}:${word.verse}`;
    if (ref !== lastRef) {
      wordPos = 1;
      lastRef = ref;
    } else {
      wordPos++;
    }
    word.word_pos = wordPos;
    words.push(word);
  }

  console.log(`  Parsed ${words.length} Hebrew words`);

  // Insert into database
  console.log(`Opening database: ${DB_PATH}`);
  const db = new Database(DB_PATH);

  // Create table if not exists
  db.exec(`
    CREATE TABLE IF NOT EXISTS interlinear_words (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      word_pos INTEGER NOT NULL,
      greek_word TEXT NOT NULL,
      lexeme TEXT NOT NULL,
      transliteration TEXT NOT NULL,
      morphology TEXT NOT NULL,
      strongs TEXT NOT NULL,
      gloss TEXT NOT NULL,
      UNIQUE (book_id, chapter, verse, word_pos)
    );
    CREATE INDEX IF NOT EXISTS idx_interlinear_lookup ON interlinear_words(book_id, chapter, verse);
  `);

  // Clear only OT data (book_id 1-39)
  const existing = db.prepare("SELECT COUNT(*) as c FROM interlinear_words WHERE book_id <= 39").get() as { c: number };
  if (existing.c > 0) {
    console.log(`  Clearing ${existing.c} existing OT rows...`);
    db.exec("DELETE FROM interlinear_words WHERE book_id <= 39");
  }

  // Batch insert (reuse same table — greek_word column holds Hebrew text for OT)
  const insert = db.prepare(`
    INSERT INTO interlinear_words (book_id, chapter, verse, word_pos, greek_word, lexeme, transliteration, morphology, strongs, gloss)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const BATCH_SIZE = 5000;
  let count = 0;

  db.exec("BEGIN");
  for (const w of words) {
    insert.run(w.book_id, w.chapter, w.verse, w.word_pos, w.hebrew_word, w.lexeme, w.transliteration, w.morphology, w.strongs, w.gloss);
    count++;
    if (count % BATCH_SIZE === 0) {
      db.exec("COMMIT");
      db.exec("BEGIN");
      process.stdout.write(`\r  Inserted ${count}/${words.length} words`);
    }
  }
  db.exec("COMMIT");
  console.log(`\r  Inserted ${count}/${words.length} words`);

  // Verify
  const otCount = db.prepare("SELECT COUNT(*) as c FROM interlinear_words WHERE book_id <= 39").get() as { c: number };
  const ntCount = db.prepare("SELECT COUNT(*) as c FROM interlinear_words WHERE book_id >= 40").get() as { c: number };
  console.log(`  OT words: ${otCount.c}, NT words: ${ntCount.c}, Total: ${otCount.c + ntCount.c}`);

  // Show Genesis 1:1 sample
  const sample = db.prepare(
    "SELECT * FROM interlinear_words WHERE book_id = 1 AND chapter = 1 AND verse = 1 ORDER BY word_pos"
  ).all() as any[];
  console.log("\nSample — Genesis 1:1:");
  for (const w of sample) {
    console.log(`  ${w.word_pos}. ${w.greek_word} (${w.lexeme}) — ${w.transliteration} — ${w.morphology} — ${w.strongs} — "${w.gloss}"`);
  }

  db.close();
  console.log("\nDone!");
}

main();
