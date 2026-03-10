/**
 * Build standalone interlinear.db from Greek and Hebrew CSV data
 *
 * Reuses parsing logic from import-interlinear.ts and import-interlinear-hebrew.ts
 * but writes to a separate interlinear.db instead of bible-core.db.
 *
 * Usage: npx tsx scripts/build-interlinear-db.ts
 */

import { existsSync, readFileSync, unlinkSync, mkdirSync, statSync } from "fs";
import { join, dirname, resolve } from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "data", "output", "commentary-dbs");
const DB_PATH = join(OUTPUT_DIR, "interlinear.db");
const GREEK_CSV = resolve(__dirname, "data/interlinear/OpenGNT_version3_3.csv");
const HEBREW_CSV = resolve(__dirname, "data/interlinear/BHSA-8-layer-interlinear.csv");

function parseDelimited(s: string): string[] {
  const match = s.match(/〔(.*)〕/);
  if (!match) return [];
  return match[1].split("｜");
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").trim();
}

mkdirSync(OUTPUT_DIR, { recursive: true });
if (existsSync(DB_PATH)) unlinkSync(DB_PATH);

console.log("Building interlinear.db...");
const db = new Database(DB_PATH);
db.pragma("journal_mode = WAL");

db.exec(`CREATE TABLE IF NOT EXISTS interlinear_words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  word_pos INTEGER NOT NULL,
  greek_word TEXT,
  lexeme TEXT,
  transliteration TEXT,
  morphology TEXT,
  strongs TEXT,
  gloss TEXT
)`);
db.exec("CREATE INDEX IF NOT EXISTS idx_interlinear_lookup ON interlinear_words(book_id, chapter, verse)");

const insert = db.prepare(
  "INSERT INTO interlinear_words (book_id, chapter, verse, word_pos, greek_word, lexeme, transliteration, morphology, strongs, gloss) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
);

// --- Import Greek NT (same parsing as import-interlinear.ts) ---
if (existsSync(GREEK_CSV)) {
  console.log("Importing Greek NT...");
  const lines = readFileSync(GREEK_CSV, "utf-8").split("\n");
  let count = 0;
  let lastRef = "";
  let wordPos = 0;

  const insertMany = db.transaction((rows: unknown[][]) => {
    for (const row of rows) insert.run(...row);
  });

  const batch: unknown[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split("\t");
    if (cols.length < 11) continue;

    // Column 7 (index 6): 〔Book｜Chapter｜Verse〕
    const ref = parseDelimited(cols[6]);
    if (ref.length < 3) continue;

    const bookId = parseInt(ref[0]);
    const chapter = parseInt(ref[1]);
    const verse = parseInt(ref[2]);
    if (isNaN(bookId) || isNaN(chapter) || isNaN(verse)) continue;

    const refKey = `${bookId}:${chapter}:${verse}`;
    if (refKey !== lastRef) { wordPos = 1; lastRef = refKey; } else { wordPos++; }

    // Column 8 (index 7): 〔OGNTk｜OGNTu｜OGNTa｜lexeme｜rmac｜sn〕
    const wordData = parseDelimited(cols[7]);
    if (wordData.length < 6) continue;

    const greekWord = wordData[2]; // OGNTa (accented)
    const lexeme = wordData[3];
    const morph = wordData[4];
    const strongs = wordData[5];

    // Column 10 (index 9): transliteration
    const translit = parseDelimited(cols[9]);
    const transliteration = translit[1] || translit[0] || "";

    // Column 11 (index 10): glosses
    const glosses = parseDelimited(cols[10]);
    const gloss = glosses[1] || glosses[0] || "";

    count++;
    batch.push([bookId, chapter, verse, wordPos, greekWord, lexeme, transliteration, morph, strongs, gloss]);

    if (batch.length >= 5000) { insertMany(batch); batch.length = 0; }
  }
  if (batch.length) insertMany(batch);
  console.log(`  ${count} Greek words imported`);
}

// --- Import Hebrew OT (same parsing as import-interlinear-hebrew.ts) ---
if (existsSync(HEBREW_CSV)) {
  console.log("Importing Hebrew OT...");
  const lines = readFileSync(HEBREW_CSV, "utf-8").split("\n");
  let count = 0;
  let lastRef = "";
  let wordPos = 0;

  const insertMany = db.transaction((rows: unknown[][]) => {
    for (const row of rows) insert.run(...row);
  });

  const batch: unknown[][] = [];
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    const cols = line.split("\t");
    if (cols.length < 12) continue;

    // Column 2 (index 1): 〔KJVverseID｜book｜chapter｜verse〕
    const ref = parseDelimited(cols[1]);
    if (ref.length < 4) continue;

    const bookId = parseInt(ref[1]);
    const chapter = parseInt(ref[2]);
    const verse = parseInt(ref[3]);
    if (isNaN(bookId) || isNaN(chapter) || isNaN(verse)) continue;
    if (bookId < 1 || bookId > 39) continue;

    const refKey = `${bookId}:${chapter}:${verse}`;
    if (refKey !== lastRef) { wordPos = 1; lastRef = refKey; } else { wordPos++; }

    const hebrewWord = stripHtml(cols[2]);
    if (!hebrewWord) continue;
    const transliteration = cols[3]?.trim() || "";
    const lexeme = stripHtml(cols[5]);
    const strongs = cols[7]?.trim() || "";
    const morph = cols[8]?.trim() || "";
    const gloss = cols[10]?.trim() || "";

    count++;
    batch.push([bookId, chapter, verse, wordPos, hebrewWord, lexeme, transliteration, morph, strongs, gloss]);

    if (batch.length >= 5000) { insertMany(batch); batch.length = 0; }
  }
  if (batch.length) insertMany(batch);
  console.log(`  ${count} Hebrew words imported`);
}

db.pragma("journal_mode = DELETE");
const total = db.prepare("SELECT COUNT(*) as c FROM interlinear_words").get() as { c: number };
const sizeMb = (statSync(DB_PATH).size / 1024 / 1024).toFixed(1);
console.log(`\nTotal: ${total.c} words → ${DB_PATH}`);
console.log(`Size: ${sizeMb} MB`);
db.close();
console.log("Done!");
