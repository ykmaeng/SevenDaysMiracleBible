/**
 * Download and convert Hebrew OT (WLC) and Greek NT (Byzantine) to app format.
 *
 * Sources:
 * - Hebrew: scrollmapper/bible_databases (2025 branch) - Westminster Leningrad Codex
 * - Greek: scrollmapper/bible_databases (master branch) - Byzantine Textform 2013
 *
 * Usage: npx tsx scripts/import-original-texts.ts
 */

import { writeFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "data", "output");

interface SourceVerse {
  verse: number;
  text: string;
}

interface SourceChapter {
  chapter: number;
  verses: SourceVerse[];
}

interface SourceBook {
  name: string;
  chapters: SourceChapter[];
}

interface SourceBible {
  translation: string;
  books: SourceBook[];
}

interface AppVerse {
  translation_id: string;
  book_id: number;
  chapter: number;
  verse: number;
  text: string;
}

// Standard Protestant book order (1-66) with alternate name variants
const BOOK_NAME_TO_ID: Record<string, number> = {
  "Genesis": 1, "Exodus": 2, "Leviticus": 3, "Numbers": 4, "Deuteronomy": 5,
  "Joshua": 6, "Judges": 7, "Ruth": 8,
  "1 Samuel": 9, "I Samuel": 9, "2 Samuel": 10, "II Samuel": 10,
  "1 Kings": 11, "I Kings": 11, "2 Kings": 12, "II Kings": 12,
  "1 Chronicles": 13, "I Chronicles": 13, "2 Chronicles": 14, "II Chronicles": 14,
  "Ezra": 15, "Nehemiah": 16, "Esther": 17, "Job": 18, "Psalms": 19,
  "Proverbs": 20, "Ecclesiastes": 21, "Song of Solomon": 22, "Isaiah": 23,
  "Jeremiah": 24, "Lamentations": 25, "Ezekiel": 26, "Daniel": 27,
  "Hosea": 28, "Joel": 29, "Amos": 30, "Obadiah": 31, "Jonah": 32,
  "Micah": 33, "Nahum": 34, "Habakkuk": 35, "Zephaniah": 36, "Haggai": 37,
  "Zechariah": 38, "Malachi": 39,
  "Matthew": 40, "Mark": 41, "Luke": 42, "John": 43, "Acts": 44, "Acts of the Apostles": 44,
  "Romans": 45,
  "1 Corinthians": 46, "I Corinthians": 46, "2 Corinthians": 47, "II Corinthians": 47,
  "Galatians": 48, "Ephesians": 49, "Philippians": 50, "Colossians": 51,
  "1 Thessalonians": 52, "I Thessalonians": 52, "2 Thessalonians": 53, "II Thessalonians": 53,
  "1 Timothy": 54, "I Timothy": 54, "2 Timothy": 55, "II Timothy": 55,
  "Titus": 56, "Philemon": 57, "Hebrews": 58, "James": 59,
  "1 Peter": 60, "I Peter": 60, "2 Peter": 61, "II Peter": 61,
  "1 John": 62, "I John": 62, "2 John": 63, "II John": 63,
  "3 John": 64, "III John": 64, "Jude": 65,
  "Revelation": 66, "Revelation of John": 66,
};

function convertToAppFormat(source: SourceBible, translationId: string, bookFilter?: (bookId: number) => boolean): AppVerse[] {
  const verses: AppVerse[] = [];

  for (const book of source.books) {
    const bookId = BOOK_NAME_TO_ID[book.name];
    if (!bookId) {
      console.warn(`  Unknown book name: ${book.name}, skipping`);
      continue;
    }
    if (bookFilter && !bookFilter(bookId)) continue;

    for (const chapter of book.chapters) {
      for (const verse of chapter.verses) {
        if (!verse.text || verse.text.trim() === "") continue;
        verses.push({
          translation_id: translationId,
          book_id: bookId,
          chapter: chapter.chapter,
          verse: verse.verse,
          text: verse.text.trim(),
        });
      }
    }
  }

  return verses;
}

async function fetchJSON(url: string): Promise<any> {
  console.log(`  Fetching ${url}...`);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json();
}

async function main() {
  console.log("=== Importing Original Bible Texts ===\n");

  // 1. Download Hebrew OT (WLC)
  console.log("1. Downloading Hebrew Old Testament (Westminster Leningrad Codex)...");
  const hebrewSource: SourceBible = await fetchJSON(
    "https://raw.githubusercontent.com/scrollmapper/bible_databases/2025/formats/json/WLC.json"
  );
  const hebrewVerses = convertToAppFormat(hebrewSource, "hebrew", (id) => id <= 39);
  console.log(`   ${hebrewVerses.length} Hebrew verses converted`);
  writeFileSync(join(OUTPUT_DIR, "hebrew.json"), JSON.stringify(hebrewVerses, null, 2));
  console.log(`   Saved to hebrew.json\n`);

  // 2. Download Greek NT (Byzantine Textform)
  console.log("2. Downloading Greek New Testament (Byzantine Textform 2013)...");
  const greekSource: SourceBible = await fetchJSON(
    "https://raw.githubusercontent.com/scrollmapper/bible_databases/master/formats/json/Byz.json"
  );
  const greekVerses = convertToAppFormat(greekSource, "greek", (id) => id >= 40);
  console.log(`   ${greekVerses.length} Greek verses converted`);
  writeFileSync(join(OUTPUT_DIR, "greek.json"), JSON.stringify(greekVerses, null, 2));
  console.log(`   Saved to greek.json\n`);

  console.log("=== Done ===");
  console.log(`Hebrew: ${hebrewVerses.length} verses (OT)`);
  console.log(`Greek: ${greekVerses.length} verses (NT)`);
}

main().catch(console.error);
