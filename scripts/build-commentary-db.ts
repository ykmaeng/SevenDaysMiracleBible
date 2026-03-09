/**
 * Build Commentary SQLite Databases (per-language)
 *
 * Creates separate commentary-{lang}.db files for each language.
 * These are uploaded to GitHub Releases for on-demand download.
 *
 * Usage:
 *   npx tsx scripts/build-commentary-db.ts              # Build all languages
 *   npx tsx scripts/build-commentary-db.ts --lang=ko    # Build specific language
 */

import { existsSync, readFileSync, readdirSync, unlinkSync, mkdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import Database from "better-sqlite3";

const __dirname = dirname(fileURLToPath(import.meta.url));
const COMMENTARY_DIR = join(__dirname, "data", "output", "commentary");
const OUTPUT_DIR = join(__dirname, "data", "output", "commentary-dbs");

// Parse --lang= argument
const langArg = process.argv.find((a) => a.startsWith("--lang="));
const targetLang = langArg ? langArg.split("=")[1] : null;

if (!existsSync(COMMENTARY_DIR)) {
  console.error("Commentary directory not found:", COMMENTARY_DIR);
  process.exit(1);
}

if (!existsSync(OUTPUT_DIR)) {
  mkdirSync(OUTPUT_DIR, { recursive: true });
}

const commentaryFiles = readdirSync(COMMENTARY_DIR)
  .filter((f) => f.startsWith("commentary-") && f.endsWith(".json"))
  .filter((f) => {
    if (!targetLang) return true;
    return f === `commentary-${targetLang}.json`;
  });

if (commentaryFiles.length === 0) {
  console.error("No commentary JSON files found");
  process.exit(1);
}

for (const file of commentaryFiles) {
  const lang = file.replace("commentary-", "").replace(".json", "");
  const dbPath = join(OUTPUT_DIR, `commentary-${lang}.db`);

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
  console.log(`  ${count.c} entries → ${dbPath}`);
  db.close();
}

console.log("\nDone!");
