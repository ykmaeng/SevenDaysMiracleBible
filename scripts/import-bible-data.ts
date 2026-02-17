/**
 * Bible Data Import Script
 *
 * Imports Bible data from scrollmapper/bible_databases JSON files.
 *
 * Usage:
 *   npx tsx scripts/import-bible-data.ts [--translation kjv|asv|web|bbe]
 *
 * The repo stores each translation as a JSON file with structure:
 * { books: [{ name, chapters: [{ chapter, name, verses: [{ verse, text }] }] }] }
 */

import { execFileSync } from "child_process";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const DATA_DIR = join(__dirname, "data");
const OUTPUT_DIR = join(DATA_DIR, "output");
const REPO_DIR = join(DATA_DIR, "bible_databases");

interface BibleJson {
  books: {
    name: string;
    chapters: {
      chapter: number;
      name: string;
      verses: {
        verse: number;
        chapter: number;
        name: string;
        text: string;
      }[];
    }[];
  }[];
}

// Map of translation ID → JSON file path relative to sources/
const TRANSLATIONS: Record<string, { lang: string; path: string }> = {
  kjv:    { lang: "en", path: "sources/en/KJV/KJV.json" },
  asv:    { lang: "en", path: "sources/en/ASV/ASV.json" },
  bbe:    { lang: "en", path: "sources/en/BBE/BBE.json" },
  web:    { lang: "en", path: "sources/en/OEB/OEB.json" },
  rv1909: { lang: "es", path: "sources/es/SpaRV/SpaRV.json" },
  cuv:    { lang: "zh", path: "sources/zh-hant/ChiUn/ChiUn.json" },
};

function ensureRepo() {
  if (!existsSync(REPO_DIR)) {
    console.log("Cloning scrollmapper/bible_databases...");
    mkdirSync(DATA_DIR, { recursive: true });
    execFileSync("git", [
      "clone", "--depth", "1",
      "https://github.com/scrollmapper/bible_databases.git",
      REPO_DIR,
    ], { stdio: "inherit" });
  } else {
    console.log("Repository already cloned.");
  }
}

function importTranslation(translationId: string) {
  const config = TRANSLATIONS[translationId];
  if (!config) {
    console.error(`Unknown translation: ${translationId}`);
    return 0;
  }

  const jsonPath = join(REPO_DIR, config.path);
  if (!existsSync(jsonPath)) {
    console.error(`  JSON file not found: ${jsonPath}, skipping.`);
    return 0;
  }

  console.log(`Importing ${translationId} from ${config.path}...`);
  const raw = readFileSync(jsonPath, "utf-8");
  const data: BibleJson = JSON.parse(raw);

  const output: {
    translation_id: string;
    book_id: number;
    chapter: number;
    verse: number;
    text: string;
  }[] = [];

  for (let bookIdx = 0; bookIdx < data.books.length; bookIdx++) {
    const book = data.books[bookIdx];
    const bookId = bookIdx + 1; // 1-based

    for (const ch of book.chapters) {
      for (const v of ch.verses) {
        output.push({
          translation_id: translationId,
          book_id: bookId,
          chapter: ch.chapter,
          verse: v.verse,
          text: v.text.trim(),
        });
      }
    }
  }

  console.log(`  Found ${output.length} verses across ${data.books.length} books`);

  mkdirSync(OUTPUT_DIR, { recursive: true });
  const outPath = join(OUTPUT_DIR, `${translationId}.json`);
  writeFileSync(outPath, JSON.stringify(output));
  const sizeMB = (Buffer.byteLength(JSON.stringify(output)) / 1024 / 1024).toFixed(1);
  console.log(`  Wrote ${outPath} (${sizeMB} MB)`);

  return output.length;
}

function importCrossReferences() {
  // Check for cross references in various locations
  const possiblePaths = [
    join(REPO_DIR, "sources", "extras", "cross_references.json"),
    join(REPO_DIR, "misc", "cross_references.txt"),
  ];

  for (const p of possiblePaths) {
    if (existsSync(p)) {
      console.log(`Found cross references at ${p}`);
      if (p.endsWith(".json")) {
        const content = readFileSync(p, "utf-8");
        const outPath = join(OUTPUT_DIR, "cross_references.json");
        writeFileSync(outPath, content);
        console.log(`  Copied to ${outPath}`);
      }
      return;
    }
  }

  console.log("Cross references file not found in repo, skipping.");
}

// Main
ensureRepo();

const args = process.argv.slice(2);
const translationArg = args.find((a) => a.startsWith("--translation="));
const selectedTranslation = translationArg?.split("=")[1];

if (selectedTranslation) {
  importTranslation(selectedTranslation);
} else {
  let totalVerses = 0;
  for (const tid of Object.keys(TRANSLATIONS)) {
    totalVerses += importTranslation(tid);
  }
  console.log(`\nTotal: ${totalVerses} verses imported across ${Object.keys(TRANSLATIONS).length} translations`);
  importCrossReferences();
}

console.log("\nDone! Output files are in scripts/data/output/");
