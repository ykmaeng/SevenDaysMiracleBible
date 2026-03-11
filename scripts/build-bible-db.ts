/**
 * Build Bible SQLite Databases
 *
 * New architecture:
 *   - bible-core.db: metadata only (translations, books, book_names, paragraph_breaks,
 *     section_headings, cross_references, etc.) — NO verses
 *   - {translation_id}.db: per-translation verse data + FTS index
 *
 * Usage:
 *   npx tsx scripts/build-bible-db.ts              # Build all (core + all translation DBs)
 *   npx tsx scripts/build-bible-db.ts --core        # Build only bible-core.db
 *   npx tsx scripts/build-bible-db.ts --translation kjv   # Build only kjv.db
 *   npx tsx scripts/build-bible-db.ts --translation sav-ko --bundle  # Build + copy to resources/
 *
 * Output: scripts/data/output/
 */

import { existsSync, readFileSync, readdirSync, unlinkSync, copyFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "data", "output");
const RESOURCES_DIR = join(__dirname, "..", "src-tauri", "resources");

// Bundled translations are copied to src-tauri/resources/ for app distribution
const BUNDLED_TRANSLATIONS = new Set(["kjv", "sav-ko"]);

// Parse CLI args
const args = process.argv.slice(2);
const buildCoreOnly = args.includes("--core");
const bundleFlag = args.includes("--bundle");
const translationArgIdx = args.indexOf("--translation");
const singleTranslation = translationArgIdx >= 0 ? args[translationArgIdx + 1] : null;

// ─── Core DB ───────────────────────────────────────────────

function buildCoreDb() {
  const dbPath = join(OUTPUT_DIR, "bible-core.db");

  if (existsSync(dbPath)) {
    console.log("Removing existing bible-core.db...");
    unlinkSync(dbPath);
  }

  console.log("Creating bible-core.db (metadata only)...");
  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  // Schema — no verses table
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

  db.exec(`CREATE TABLE IF NOT EXISTS original_texts (
    book_id INTEGER NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL,
    hebrew_text TEXT, greek_text TEXT, transliteration TEXT, strongs_numbers TEXT,
    PRIMARY KEY (book_id, chapter, verse)
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
    note TEXT, color TEXT, label_id INTEGER,
    translation_id TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS bookmark_labels (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL UNIQUE,
    color TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS paragraph_breaks (
    book_id INTEGER NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL,
    PRIMARY KEY (book_id, chapter, verse)
  )`);

  db.exec(`CREATE TABLE IF NOT EXISTS section_headings (
    book_id INTEGER NOT NULL, chapter INTEGER NOT NULL, verse INTEGER NOT NULL,
    title_ko TEXT, title_en TEXT,
    PRIMARY KEY (book_id, chapter, verse)
  )`);

  db.exec("CREATE INDEX IF NOT EXISTS idx_crossref_from ON cross_references(from_book, from_chapter, from_verse)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_feedback_sync ON feedback_queue(synced)");
  db.exec("CREATE INDEX IF NOT EXISTS idx_bookmarks_chapter ON bookmarks(book_id, chapter)");

  // Seed books
  console.log("  Seeding books...");
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
  console.log("  Seeding translations...");
  const translationData: [string, string, string, string, number, number, number, number][] = [
    ['kjv','King James Version','en','The authorized King James Version (1611)',0,0,1,1.5],
    ['asv','American Standard Version','en','American Standard Version (1901)',0,0,0,1.5],
    ['web','World English Bible','en','Modern English public domain translation (2006)',0,0,0,1.5],
    ['bbe','Bible in Basic English','en','Bible in Basic English (1965)',0,0,0,1.5],
    ['ylt',"Young's Literal Translation",'en',"Young's Literal Translation (1898)",0,0,0,1.5],
    ['darby','Darby Bible','en','Darby Translation (1889)',0,0,0,1.5],
    ['cuv','和合本','zh','Chinese Union Version (1919)',0,0,0,2.0],
    ['rv1909','Reina-Valera','es','Reina-Valera - Dominio Público',0,0,0,1.5],
    ['korrv','개역한글','ko','개역한글판 (1961)',0,0,0,2.0],
    ['nkrv','개역개정','ko','개역개정판 (1998)',0,0,0,2.0],
    ['sav-ko','SAV 한국어','ko','Selah AI Version - 원문 기반 AI 번역',0,1,1,2.0],
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
    // Bundled translations are marked as downloaded=1
    const downloaded = BUNDLED_TRANSLATIONS.has(t[0]) ? 1 : 0;
    insertTranslation.run(t[0], t[1], t[2], t[3], t[4], t[5], downloaded, t[7]);
  }

  // Paragraph breaks
  const paragraphFile = join(OUTPUT_DIR, "paragraph_breaks.json");
  if (existsSync(paragraphFile)) {
    console.log("  Loading paragraph breaks...");
    const paragraphs = JSON.parse(readFileSync(paragraphFile, "utf-8"));
    const insertParagraph = db.prepare(
      "INSERT OR IGNORE INTO paragraph_breaks (book_id, chapter, verse) VALUES (?, ?, ?)"
    );
    const insertManyParagraphs = db.transaction(
      (items: { book_id: number; chapter: number; verse: number }[]) => {
        for (const p of items) insertParagraph.run(p.book_id, p.chapter, p.verse);
      }
    );
    insertManyParagraphs(paragraphs);
    console.log(`    ${paragraphs.length} paragraph breaks`);
  }

  // Section headings
  const sectionsFile = join(OUTPUT_DIR, "section_headings.json");
  if (existsSync(sectionsFile)) {
    console.log("  Loading section headings...");
    const sections = JSON.parse(readFileSync(sectionsFile, "utf-8"));
    const insertSection = db.prepare(
      "INSERT OR IGNORE INTO section_headings (book_id, chapter, verse, title_ko, title_en) VALUES (?, ?, ?, ?, ?)"
    );
    const insertManySections = db.transaction(
      (items: { book_id: number; chapter: number; verse: number; title_ko: string; title_en: string }[]) => {
        for (const s of items) insertSection.run(s.book_id, s.chapter, s.verse, s.title_ko, s.title_en);
      }
    );
    insertManySections(sections);
    console.log(`    ${sections.length} section headings`);
  }

  db.pragma("journal_mode = DELETE");

  // Verify
  const bookCount = (db.prepare("SELECT COUNT(*) as c FROM books").get() as { c: number }).c;
  const trCount = (db.prepare("SELECT COUNT(*) as c FROM translations").get() as { c: number }).c;
  console.log(`\n  bible-core.db built!`);
  console.log(`    Books: ${bookCount}, Translations: ${trCount}`);

  db.close();

  // Copy to resources
  const destPath = join(RESOURCES_DIR, "bible-core.db");
  copyFileSync(dbPath, destPath);
  console.log(`    Copied to ${destPath}`);
}

// ─── Translation DB ────────────────────────────────────────

function buildTranslationDb(translationId: string) {
  const jsonFile = join(OUTPUT_DIR, `${translationId}.json`);
  if (!existsSync(jsonFile)) {
    console.log(`  Skipping ${translationId}: no JSON file found`);
    return;
  }

  const dbPath = join(OUTPUT_DIR, `${translationId}.db`);
  if (existsSync(dbPath)) unlinkSync(dbPath);

  console.log(`Building ${translationId}.db...`);
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

  // Load and insert verses
  const verses = JSON.parse(readFileSync(jsonFile, "utf-8")) as {
    translation_id: string; book_id: number; chapter: number; verse: number; text: string;
  }[];

  const insertVerse = db.prepare(
    "INSERT OR IGNORE INTO verses (translation_id, book_id, chapter, verse, text) VALUES (?, ?, ?, ?, ?)"
  );
  const insertMany = db.transaction(() => {
    for (const v of verses) {
      insertVerse.run(v.translation_id, v.book_id, v.chapter, v.verse, v.text);
    }
  });
  insertMany();

  // Build FTS index
  db.exec(`CREATE VIRTUAL TABLE IF NOT EXISTS verses_fts USING fts5(
    text, content=verses, content_rowid=id, tokenize='unicode61'
  )`);
  db.exec("INSERT INTO verses_fts(verses_fts) VALUES('rebuild')");

  db.pragma("journal_mode = DELETE");

  const count = (db.prepare("SELECT COUNT(*) as c FROM verses").get() as { c: number }).c;
  const chapters = (db.prepare("SELECT COUNT(DISTINCT book_id || ':' || chapter) as c FROM verses").get() as { c: number }).c;
  console.log(`  ${count} verses, ${chapters} chapters`);

  db.close();

  // Copy bundled translations to resources
  if (BUNDLED_TRANSLATIONS.has(translationId) || bundleFlag) {
    const destPath = join(RESOURCES_DIR, `${translationId}.db`);
    copyFileSync(dbPath, destPath);
    console.log(`  Copied to ${destPath}`);
  }
}

// ─── Main ──────────────────────────────────────────────────

function getTranslationIds(): string[] {
  return readdirSync(OUTPUT_DIR)
    .filter((f) => {
      if (!f.endsWith(".json")) return false;
      const id = f.replace(".json", "");
      // Exclude non-translation JSON files
      const excluded = [
        "cross_references", "translation-progress", "paragraph_breaks",
        "section_headings", "bible",
      ];
      return !excluded.includes(id);
    })
    .map((f) => f.replace(".json", ""));
}

console.log("=== Bible DB Builder ===\n");

if (singleTranslation) {
  // Build single translation DB only
  buildTranslationDb(singleTranslation);
} else if (buildCoreOnly) {
  // Build core DB only
  buildCoreDb();
} else {
  // Build everything
  buildCoreDb();
  console.log("");

  const ids = getTranslationIds();
  console.log(`Building ${ids.length} translation DBs...\n`);
  for (const id of ids) {
    buildTranslationDb(id);
  }
}

console.log("\nDone!");
