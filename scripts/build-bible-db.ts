/**
 * Build Bible SQLite Database
 *
 * Takes the JSON output from import-bible-data.ts and creates a
 * pre-built SQLite database that can be bundled with the app.
 *
 * Usage:
 *   npx tsx scripts/build-bible-db.ts
 *
 * Output: scripts/data/output/bible.db
 */

import { existsSync, readFileSync, readdirSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "data", "output");

const CORE_TRANSLATIONS = new Set(["kjv", "ai-ko"]);
const buildCore = process.argv.includes("--core");
const DB_FILENAME = buildCore ? "bible-core.db" : "bible.db";
const DB_PATH = join(OUTPUT_DIR, DB_FILENAME);

// Delete existing db if exists
if (existsSync(DB_PATH)) {
  console.log("Removing existing database...");
  unlinkSync(DB_PATH);
}

console.log("Creating database...");
const db = new Database(DB_PATH);

// Enable WAL mode for better performance
db.pragma("journal_mode = WAL");

// Create schema
console.log("Creating schema...");
db.exec(`CREATE TABLE IF NOT EXISTS translations (
  id TEXT PRIMARY KEY, name TEXT NOT NULL, language TEXT NOT NULL,
  description TEXT, is_original INTEGER DEFAULT 0, is_ai_generated INTEGER DEFAULT 0,
  downloaded INTEGER DEFAULT 0, download_size_mb REAL, version INTEGER DEFAULT 1
)`);

db.exec(`CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY, testament TEXT NOT NULL, chapters INTEGER NOT NULL
)`);

db.exec(`CREATE TABLE IF NOT EXISTS book_names (
  book_id INTEGER NOT NULL, language TEXT NOT NULL, name TEXT NOT NULL,
  abbreviation TEXT NOT NULL, PRIMARY KEY (book_id, language)
)`);

db.exec(`CREATE TABLE IF NOT EXISTS verses (
  id INTEGER PRIMARY KEY AUTOINCREMENT, translation_id TEXT NOT NULL,
  book_id INTEGER NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL,
  text TEXT NOT NULL, UNIQUE (translation_id, book_id, chapter, verse)
)`);

db.exec(`CREATE TABLE IF NOT EXISTS original_texts (
  book_id INTEGER NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL,
  hebrew_text TEXT, greek_text TEXT, transliteration TEXT, strongs_numbers TEXT,
  PRIMARY KEY (book_id, chapter, verse)
)`);

db.exec(`CREATE TABLE IF NOT EXISTS commentary (
  id INTEGER PRIMARY KEY AUTOINCREMENT, book_id INTEGER NOT NULL,
  chapter INTEGER NOT NULL, verse INTEGER, language TEXT NOT NULL,
  content TEXT NOT NULL, model_version TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (book_id, chapter, verse, language)
)`);

db.exec(`CREATE TABLE IF NOT EXISTS cross_references (
  id INTEGER PRIMARY KEY AUTOINCREMENT, from_book INTEGER NOT NULL,
  from_chapter INTEGER NOT NULL, from_verse INTEGER NOT NULL,
  to_book INTEGER NOT NULL, to_chapter_start INTEGER NOT NULL,
  to_verse_start INTEGER NOT NULL, to_chapter_end INTEGER,
  to_verse_end INTEGER, votes INTEGER DEFAULT 0
)`);

db.exec(`CREATE TABLE IF NOT EXISTS feedback_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT, book_id INTEGER NOT NULL,
  chapter INTEGER NOT NULL, verse INTEGER NOT NULL,
  translation_id TEXT NOT NULL, vote INTEGER NOT NULL,
  synced INTEGER DEFAULT 0, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.exec(`CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT, book_id INTEGER NOT NULL,
  chapter INTEGER NOT NULL, verse INTEGER NOT NULL,
  note TEXT, color TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
)`);

db.exec("CREATE INDEX IF NOT EXISTS idx_verses_lookup ON verses(translation_id, book_id, chapter)");
db.exec("CREATE INDEX IF NOT EXISTS idx_commentary_lookup ON commentary(book_id, chapter, language)");
db.exec("CREATE INDEX IF NOT EXISTS idx_crossref_from ON cross_references(from_book, from_chapter, from_verse)");
db.exec("CREATE INDEX IF NOT EXISTS idx_feedback_sync ON feedback_queue(synced)");

// Seed books
console.log("Seeding books...");
const bookData: [number, string, number][] = [
  [1,'OT',50],[2,'OT',40],[3,'OT',27],[4,'OT',36],[5,'OT',34],
  [6,'OT',24],[7,'OT',21],[8,'OT',4],[9,'OT',31],[10,'OT',24],
  [11,'OT',22],[12,'OT',25],[13,'OT',29],[14,'OT',36],[15,'OT',10],
  [16,'OT',13],[17,'OT',10],[18,'OT',42],[19,'OT',150],[20,'OT',31],
  [21,'OT',12],[22,'OT',8],[23,'OT',66],[24,'OT',52],[25,'OT',5],
  [26,'OT',48],[27,'OT',12],[28,'OT',14],[29,'OT',3],[30,'OT',9],
  [31,'OT',1],[32,'OT',4],[33,'OT',7],[34,'OT',3],[35,'OT',3],
  [36,'OT',3],[37,'OT',2],[38,'OT',14],[39,'OT',4],
  [40,'NT',28],[41,'NT',16],[42,'NT',24],[43,'NT',21],[44,'NT',28],
  [45,'NT',16],[46,'NT',16],[47,'NT',13],[48,'NT',6],[49,'NT',6],
  [50,'NT',4],[51,'NT',4],[52,'NT',5],[53,'NT',3],[54,'NT',6],
  [55,'NT',4],[56,'NT',3],[57,'NT',1],[58,'NT',13],[59,'NT',5],
  [60,'NT',5],[61,'NT',3],[62,'NT',5],[63,'NT',1],[64,'NT',1],
  [65,'NT',1],[66,'NT',22],
];
const insertBook = db.prepare("INSERT OR IGNORE INTO books (id, testament, chapters) VALUES (?, ?, ?)");
for (const [id, t, c] of bookData) insertBook.run(id, t, c);

// Seed translations
console.log(`Seeding translations (${buildCore ? "core" : "full"} mode)...`);
const translationData: [string, string, string, string, number, number, number, number][] = [
  ['kjv','King James Version','en','The authorized King James Version (1611)',0,0,1,1.5],
  ['asv','American Standard Version','en','American Standard Version (1901)',0,0,0,1.5],
  ['web','World English Bible','en','Modern English public domain translation (2006)',0,0,0,1.5],
  ['bbe','Bible in Basic English','en','Bible in Basic English (1965)',0,0,0,1.5],
  ['ylt',"Young's Literal Translation",'en',"Young's Literal Translation (1898)",0,0,0,1.5],
  ['darby','Darby Bible','en','Darby Translation (1889)',0,0,0,1.5],
  ['cuv','和合本','zh','Chinese Union Version (1919)',0,0,0,2.0],
  ['rv1909','Reina-Valera','es','Reina-Valera - Dominio Público',0,0,0,1.5],
  ['ai-ko','AI 한국어 번역','ko','원문 기반 AI 번역',0,1,1,2.0],
  ['hebrew','Westminster Leningrad Codex','he','Hebrew Old Testament (WLC)',1,0,0,2.0],
  ['greek','Open Greek New Testament','el','Greek New Testament (OpenGNT)',1,0,0,1.0],
  ['japkougo','口語訳聖書','ja','口語訳聖書 (1955)',0,0,0,1.5],
  ['gerelb','Elberfelder Bibel','de','Elberfelder Übersetzung (1905)',0,0,0,1.5],
  ['frecrampon','Bible Crampon','fr','Traduction Crampon (1923)',0,0,0,1.5],
  ['russynodal','Синодальный перевод','ru','Синодальный перевод (1876)',0,0,0,2.0],
  ['porblivre','Bíblia Livre','pt','Bíblia Livre - Domínio Público',0,0,0,1.5],
];
const insertTranslation = db.prepare(
  "INSERT OR IGNORE INTO translations (id,name,language,description,is_original,is_ai_generated,downloaded,download_size_mb) VALUES (?,?,?,?,?,?,?,?)"
);
for (const t of translationData) {
  if (buildCore && !CORE_TRANSLATIONS.has(t[0])) {
    // In core mode, non-core translations get downloaded=0
    insertTranslation.run(t[0], t[1], t[2], t[3], t[4], t[5], 0, t[7]);
  } else {
    insertTranslation.run(...t);
  }
}

// Insert verses from JSON files
const insertVerse = db.prepare(
  "INSERT OR IGNORE INTO verses (translation_id, book_id, chapter, verse, text) VALUES (?, ?, ?, ?, ?)"
);

let jsonFiles = readdirSync(OUTPUT_DIR).filter(
  (f) => f.endsWith(".json") && f !== "cross_references.json"
);

if (buildCore) {
  // In core mode, only load core translation JSON files
  // Hebrew/Greek are in original_texts table, not verse JSONs
  jsonFiles = jsonFiles.filter((f) => {
    const id = f.replace(".json", "");
    return CORE_TRANSLATIONS.has(id);
  });
  console.log(`Core mode: loading only ${jsonFiles.join(", ")}`);
}

const insertMany = db.transaction(
  (verses: { translation_id: string; book_id: number; chapter: number; verse: number; text: string }[]) => {
    for (const v of verses) {
      insertVerse.run(v.translation_id, v.book_id, v.chapter, v.verse, v.text);
    }
  }
);

let totalInserted = 0;
for (const file of jsonFiles) {
  const filePath = join(OUTPUT_DIR, file);
  console.log(`Loading ${file}...`);
  const verses = JSON.parse(readFileSync(filePath, "utf-8"));
  insertMany(verses);
  totalInserted += verses.length;
  console.log(`  Inserted ${verses.length} verses`);
}

// Create FTS index
console.log("Building full-text search index...");
db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS verses_fts USING fts5(
  text, content=verses, content_rowid=id, tokenize='unicode61'
)`);
db.exec("INSERT INTO verses_fts(verses_fts) VALUES('rebuild')");

// Switch from WAL to DELETE journal mode for portability
db.pragma("journal_mode = DELETE");

// Verify
const count = db.prepare("SELECT COUNT(*) as c FROM verses").get() as { c: number };
const ftsCount = db.prepare("SELECT COUNT(*) as c FROM verses_fts").get() as { c: number };
console.log(`\nDatabase built successfully! (${buildCore ? "core" : "full"})`);
console.log(`  Verses: ${count.c}`);
console.log(`  FTS entries: ${ftsCount.c}`);
console.log(`  Output: ${DB_PATH}`);

db.close();
