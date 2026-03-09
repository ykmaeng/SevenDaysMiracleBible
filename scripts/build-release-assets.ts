/**
 * Build Release Assets
 *
 * Copies non-core translation JSON files to dist/release-assets/
 * and builds per-language commentary .db files for uploading to GitHub Releases.
 *
 * Usage:
 *   npx tsx scripts/build-release-assets.ts
 */

import { existsSync, mkdirSync, copyFileSync, readdirSync, readFileSync, unlinkSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "data", "output");
const RELEASE_DIR = join(__dirname, "..", "dist", "release-assets");

const CORE_TRANSLATIONS = new Set(["kjv", "sav-ko"]);

// Create release assets directory
if (!existsSync(RELEASE_DIR)) {
  mkdirSync(RELEASE_DIR, { recursive: true });
}

// Copy translation JSON files (excluding core)
const jsonFiles = readdirSync(OUTPUT_DIR).filter(
  (f) => f.endsWith(".json") && f !== "cross_references.json"
);

let copied = 0;
for (const file of jsonFiles) {
  const id = file.replace(".json", "");
  if (CORE_TRANSLATIONS.has(id)) continue;

  const src = join(OUTPUT_DIR, file);
  const dest = join(RELEASE_DIR, file);
  copyFileSync(src, dest);
  console.log(`Copied ${file}`);
  copied++;
}

// Build commentary .db files from JSON
const COMMENTARY_DIR = join(OUTPUT_DIR, "commentary");
if (existsSync(COMMENTARY_DIR)) {
  const commentaryFiles = readdirSync(COMMENTARY_DIR).filter(
    (f) => f.startsWith("commentary-") && f.endsWith(".json")
  );

  for (const file of commentaryFiles) {
    const lang = file.replace("commentary-", "").replace(".json", "");
    const dbPath = join(RELEASE_DIR, `commentary-${lang}.db`);

    if (existsSync(dbPath)) unlinkSync(dbPath);

    console.log(`Building commentary-${lang}.db...`);
    const db = new Database(dbPath);
    db.pragma("journal_mode = WAL");

    db.exec(`CREATE TABLE IF NOT EXISTS commentary (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER,
      language TEXT NOT NULL,
      content TEXT NOT NULL,
      model_version TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE (book_id, chapter, verse, language)
    )`);
    db.exec("CREATE INDEX IF NOT EXISTS idx_commentary_lookup ON commentary(book_id, chapter, language)");

    const entries = JSON.parse(readFileSync(join(COMMENTARY_DIR, file), "utf-8"));
    const insert = db.prepare(
      "INSERT OR IGNORE INTO commentary (book_id, chapter, verse, language, content, model_version) VALUES (?, ?, ?, ?, ?, ?)"
    );
    const insertMany = db.transaction(
      (rows: { book_id: number; chapter: number; language: string; content: string; model_version: string }[]) => {
        for (const e of rows) {
          insert.run(e.book_id, e.chapter, null, e.language, e.content, e.model_version);
        }
      }
    );
    insertMany(entries);

    db.pragma("journal_mode = DELETE");
    const count = db.prepare("SELECT COUNT(*) as c FROM commentary").get() as { c: number };
    console.log(`  ${count.c} entries`);
    db.close();
    copied++;
  }
}

console.log(`\n${copied} release assets built in ${RELEASE_DIR}`);
