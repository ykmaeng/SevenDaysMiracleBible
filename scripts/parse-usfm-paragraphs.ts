/**
 * Parse USFM files to extract paragraph breaks
 *
 * Reads KJV USFM files and outputs paragraph_breaks.json
 * Each entry: { book_id, chapter, verse } indicating a paragraph starts at that verse
 *
 * Usage: npx tsx scripts/parse-usfm-paragraphs.ts
 */

import { readFileSync, writeFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const USFM_DIR = "/tmp/kjv-usfm";
const OUTPUT_PATH = join(__dirname, "data", "output", "paragraph_breaks.json");

// USFM file prefix → book_id mapping
const USFM_TO_BOOK_ID: Record<string, number> = {
  "02-GEN": 1, "03-EXO": 2, "04-LEV": 3, "05-NUM": 4, "06-DEU": 5,
  "07-JOS": 6, "08-JDG": 7, "09-RUT": 8, "10-1SA": 9, "11-2SA": 10,
  "12-1KI": 11, "13-2KI": 12, "14-1CH": 13, "15-2CH": 14, "16-EZR": 15,
  "17-NEH": 16, "18-EST": 17, "19-JOB": 18, "20-PSA": 19, "21-PRO": 20,
  "22-ECC": 21, "23-SNG": 22, "24-ISA": 23, "25-JER": 24, "26-LAM": 25,
  "27-EZK": 26, "28-DAN": 27, "29-HOS": 28, "30-JOL": 29, "31-AMO": 30,
  "32-OBA": 31, "33-JON": 32, "34-MIC": 33, "35-NAM": 34, "36-HAB": 35,
  "37-ZEP": 36, "38-HAG": 37, "39-ZEC": 38, "40-MAL": 39,
  "70-MAT": 40, "71-MRK": 41, "72-LUK": 42, "73-JHN": 43, "74-ACT": 44,
  "75-ROM": 45, "76-1CO": 46, "77-2CO": 47, "78-GAL": 48, "79-EPH": 49,
  "80-PHP": 50, "81-COL": 51, "82-1TH": 52, "83-2TH": 53, "84-1TI": 54,
  "85-2TI": 55, "86-TIT": 56, "87-PHM": 57, "88-HEB": 58, "89-JAS": 59,
  "90-1PE": 60, "91-2PE": 61, "92-1JN": 62, "93-2JN": 63, "94-3JN": 64,
  "95-JUD": 65, "96-REV": 66,
};

interface ParagraphBreak {
  book_id: number;
  chapter: number;
  verse: number;
}

const breaks: ParagraphBreak[] = [];

const files = readdirSync(USFM_DIR)
  .filter((f) => f.endsWith(".usfm"))
  .sort();

for (const file of files) {
  const prefix = file.replace(/eng-kjv2006\.usfm$/, "");
  const bookId = USFM_TO_BOOK_ID[prefix];
  if (!bookId) {
    console.warn(`Unknown file: ${file}, prefix: ${prefix}`);
    continue;
  }

  const content = readFileSync(join(USFM_DIR, file), "utf-8").replace(/\r/g, "");
  const lines = content.split("\n");

  let currentChapter = 0;
  let pendingParagraph = false;

  for (const line of lines) {
    const trimmed = line.trim();

    // Chapter marker
    const chapterMatch = trimmed.match(/^\\c\s+(\d+)/);
    if (chapterMatch) {
      currentChapter = parseInt(chapterMatch[1]);
      pendingParagraph = false;
      continue;
    }

    // Paragraph marker (\p, \pi, \m, \nb etc.)
    if (/^\\p\b|^\\m\b|^\\pi\b/.test(trimmed)) {
      pendingParagraph = true;
      continue;
    }

    // Verse marker
    const verseMatch = trimmed.match(/^\\v\s+(\d+)\b/);
    if (verseMatch && currentChapter > 0) {
      const verseNum = parseInt(verseMatch[1]);
      if (pendingParagraph || verseNum === 1) {
        breaks.push({ book_id: bookId, chapter: currentChapter, verse: verseNum });
        pendingParagraph = false;
      }
    }
  }

  const bookBreaks = breaks.filter((b) => b.book_id === bookId).length;
  console.log(`${prefix} (book ${bookId}): ${bookBreaks} paragraph breaks`);
}

writeFileSync(OUTPUT_PATH, JSON.stringify(breaks, null, 2));
console.log(`\nTotal: ${breaks.length} paragraph breaks → ${OUTPUT_PATH}`);
