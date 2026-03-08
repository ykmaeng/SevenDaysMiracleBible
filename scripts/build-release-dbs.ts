/**
 * Build Release DB Assets
 *
 * Creates per-translation SQLite .db files for fast mobile download + ATTACH import.
 * Each .db contains only a `verses` table with that translation's data.
 *
 * Usage:
 *   npx tsx scripts/build-release-dbs.ts
 *   npx tsx scripts/build-release-dbs.ts --only=asv,web
 */

import { existsSync, mkdirSync, readFileSync, readdirSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "data", "output");
const RELEASE_DIR = join(__dirname, "..", "dist", "release-assets");

const CORE_TRANSLATIONS = new Set(["kjv", "sav-ko"]);
const SKIP_FILES = new Set(["cross_references.json", "paragraph_breaks.json", "section_headings.json", "translation-progress.json"]);

// Parse args
const onlyArg = process.argv.find((a) => a.startsWith("--only="));
const onlyIds = onlyArg ? new Set(onlyArg.split("=")[1].split(",")) : null;

if (!existsSync(RELEASE_DIR)) {
  mkdirSync(RELEASE_DIR, { recursive: true });
}

const jsonFiles = readdirSync(DATA_DIR).filter(
  (f) => f.endsWith(".json") && !SKIP_FILES.has(f)
);

let built = 0;

for (const file of jsonFiles) {
  const id = file.replace(".json", "");
  if (CORE_TRANSLATIONS.has(id)) continue;
  if (onlyIds && !onlyIds.has(id)) continue;

  const dbPath = join(RELEASE_DIR, `${id}.db`);

  // Remove existing
  if (existsSync(dbPath)) unlinkSync(dbPath);

  console.log(`Building ${id}.db ...`);

  const jsonPath = join(DATA_DIR, file);
  const verses = JSON.parse(readFileSync(jsonPath, "utf-8")) as {
    translation_id: string;
    book_id: number;
    chapter: number;
    verse: number;
    text: string;
  }[];

  const db = new Database(dbPath);
  db.pragma("journal_mode = OFF");
  db.pragma("synchronous = OFF");

  db.exec(`
    CREATE TABLE verses (
      translation_id TEXT NOT NULL,
      book_id INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      text TEXT NOT NULL
    )
  `);

  const insert = db.prepare(
    "INSERT INTO verses (translation_id, book_id, chapter, verse, text) VALUES (?, ?, ?, ?, ?)"
  );

  const batchInsert = db.transaction((rows: typeof verses) => {
    for (const v of rows) {
      insert.run(v.translation_id, v.book_id, v.chapter, v.verse, v.text);
    }
  });

  batchInsert(verses);

  // Create index for fast queries
  db.exec("CREATE INDEX idx_verses_tid ON verses(translation_id)");
  db.exec("CREATE INDEX idx_verses_lookup ON verses(translation_id, book_id, chapter)");

  // Create FTS5 index for full-text search
  db.exec("CREATE VIRTUAL TABLE verses_fts USING fts5(text, content=verses, content_rowid=rowid)");
  db.exec("INSERT INTO verses_fts(rowid, text) SELECT rowid, text FROM verses");

  db.close();

  console.log(`  ${id}.db — ${verses.length} verses`);
  built++;
}

console.log(`\n${built} translation .db files built in ${RELEASE_DIR}`);
