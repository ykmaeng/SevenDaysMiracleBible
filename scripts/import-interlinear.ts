/**
 * Import OpenGNT interlinear data into bible-core.db
 *
 * Usage: npx tsx scripts/import-interlinear.ts
 *
 * Parses OpenGNT_version3_3.csv and inserts word-by-word Greek NT data
 * into the interlinear_words table.
 */

import { readFileSync } from "fs";
import { resolve, dirname } from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));
const CSV_PATH = resolve(__dirname, "data/interlinear/OpenGNT_version3_3.csv");
const DB_PATH = resolve(__dirname, "../src-tauri/resources/bible-core.db");

interface InterlinearWord {
  book_id: number;
  chapter: number;
  verse: number;
  word_pos: number;
  greek_word: string;
  lexeme: string;
  transliteration: string;
  morphology: string;
  strongs: string;
  gloss: string;
}

/** Parse 〔field1｜field2｜...〕 into an array */
function parseDelimited(s: string): string[] {
  const match = s.match(/〔(.*)〕/);
  if (!match) return [];
  return match[1].split("｜");
}

function parseLine(line: string): InterlinearWord | null {
  const cols = line.split("\t");
  if (cols.length < 11) return null;

  // Column 7 (index 6): 〔Book｜Chapter｜Verse〕
  const ref = parseDelimited(cols[6]);
  if (ref.length < 3) return null;

  const book_id = parseInt(ref[0]);
  const chapter = parseInt(ref[1]);
  const verse = parseInt(ref[2]);
  if (isNaN(book_id) || isNaN(chapter) || isNaN(verse)) return null;

  // Column 8 (index 7): 〔OGNTk｜OGNTu｜OGNTa｜lexeme｜rmac｜sn〕
  const wordData = parseDelimited(cols[7]);
  if (wordData.length < 6) return null;

  const greek_word = wordData[2]; // OGNTa (accented)
  const lexeme = wordData[3];
  const morphology = wordData[4]; // Robinson morphology code
  const strongs = wordData[5];    // e.g., G1722

  // Column 10 (index 9): 〔transSBLcap｜transSBL｜modernGreek｜Fonética〕
  const translit = parseDelimited(cols[9]);
  const transliteration = translit[1] || translit[0] || ""; // prefer lowercase SBL

  // Column 11 (index 10): 〔TBESG｜IT｜LT｜ST｜Español〕
  const glosses = parseDelimited(cols[10]);
  // Use IT (Interlinear Translation from Berean) as primary gloss
  const gloss = glosses[1] || glosses[0] || "";

  return {
    book_id,
    chapter,
    verse,
    word_pos: 0, // will be set during insertion
    greek_word,
    lexeme,
    transliteration,
    morphology,
    strongs,
    gloss,
  };
}

function main() {
  console.log("Reading OpenGNT CSV...");
  const csv = readFileSync(CSV_PATH, "utf-8");
  const lines = csv.split("\n");
  console.log(`  ${lines.length} lines`);

  // Parse all words
  const words: InterlinearWord[] = [];
  let lastRef = "";
  let wordPos = 0;

  for (let i = 1; i < lines.length; i++) { // skip header
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

  console.log(`  Parsed ${words.length} words`);

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

  // Clear existing data
  const existing = db.prepare("SELECT COUNT(*) as c FROM interlinear_words").get() as { c: number };
  if (existing.c > 0) {
    console.log(`  Clearing ${existing.c} existing rows...`);
    db.exec("DELETE FROM interlinear_words");
  }

  // Batch insert
  const insert = db.prepare(`
    INSERT INTO interlinear_words (book_id, chapter, verse, word_pos, greek_word, lexeme, transliteration, morphology, strongs, gloss)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const BATCH_SIZE = 5000;
  let count = 0;

  db.exec("BEGIN");
  for (const w of words) {
    insert.run(w.book_id, w.chapter, w.verse, w.word_pos, w.greek_word, w.lexeme, w.transliteration, w.morphology, w.strongs, w.gloss);
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
  const verifyCount = db.prepare("SELECT COUNT(*) as c FROM interlinear_words").get() as { c: number };
  console.log(`  Total rows in interlinear_words: ${verifyCount.c}`);

  // Show John 1:1 sample
  const sample = db.prepare(
    "SELECT * FROM interlinear_words WHERE book_id = 43 AND chapter = 1 AND verse = 1 ORDER BY word_pos"
  ).all();
  console.log("\nSample — John 1:1:");
  for (const w of sample as InterlinearWord[]) {
    console.log(`  ${w.word_pos}. ${w.greek_word} (${w.lexeme}) — ${w.transliteration} — ${w.morphology} — ${w.strongs} — "${w.gloss}"`);
  }

  db.close();
  console.log("\nDone!");
}

main();
