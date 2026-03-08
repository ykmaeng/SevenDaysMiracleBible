/**
 * AI Section Headings Generator
 *
 * Generates section headings (소제목) for Bible chapters using Claude CLI.
 * Processes one book per request for efficiency.
 *
 * Usage:
 *   npx tsx scripts/generate-section-headings.ts
 *   npx tsx scripts/generate-section-headings.ts --book=1
 *   npx tsx scripts/generate-section-headings.ts --interval=5
 */

import { writeFileSync, existsSync, readFileSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_PATH = join(__dirname, "data", "output", "section_headings.json");

const BOOK_NAMES: Record<number, string> = {
  1: "Genesis", 2: "Exodus", 3: "Leviticus", 4: "Numbers", 5: "Deuteronomy",
  6: "Joshua", 7: "Judges", 8: "Ruth", 9: "1 Samuel", 10: "2 Samuel",
  11: "1 Kings", 12: "2 Kings", 13: "1 Chronicles", 14: "2 Chronicles",
  15: "Ezra", 16: "Nehemiah", 17: "Esther", 18: "Job", 19: "Psalms",
  20: "Proverbs", 21: "Ecclesiastes", 22: "Song of Solomon", 23: "Isaiah",
  24: "Jeremiah", 25: "Lamentations", 26: "Ezekiel", 27: "Daniel",
  28: "Hosea", 29: "Joel", 30: "Amos", 31: "Obadiah", 32: "Jonah",
  33: "Micah", 34: "Nahum", 35: "Habakkuk", 36: "Zephaniah", 37: "Haggai",
  38: "Zechariah", 39: "Malachi", 40: "Matthew", 41: "Mark", 42: "Luke",
  43: "John", 44: "Acts", 45: "Romans", 46: "1 Corinthians",
  47: "2 Corinthians", 48: "Galatians", 49: "Ephesians", 50: "Philippians",
  51: "Colossians", 52: "1 Thessalonians", 53: "2 Thessalonians",
  54: "1 Timothy", 55: "2 Timothy", 56: "Titus", 57: "Philemon",
  58: "Hebrews", 59: "James", 60: "1 Peter", 61: "2 Peter",
  62: "1 John", 63: "2 John", 64: "3 John", 65: "Jude", 66: "Revelation",
};

const CHAPTER_COUNTS: Record<number, number> = {
  1:50,2:40,3:27,4:36,5:34,6:24,7:21,8:4,9:31,10:24,
  11:22,12:25,13:29,14:36,15:10,16:13,17:10,18:42,19:150,
  20:31,21:12,22:8,23:66,24:52,25:5,26:48,27:12,28:14,29:3,
  30:9,31:1,32:4,33:7,34:3,35:3,36:3,37:2,38:14,39:4,
  40:28,41:16,42:24,43:21,44:28,45:16,46:16,47:13,48:6,49:6,
  50:4,51:4,52:5,53:3,54:6,55:4,56:3,57:1,
  58:13,59:5,60:5,61:3,62:5,63:1,64:1,65:1,66:22,
};

interface SectionHeading {
  book_id: number;
  chapter: number;
  verse: number;
  title_ko: string;
  title_en: string;
}

// Parse args
const args = process.argv.slice(2);
const getArg = (name: string) => {
  const arg = args.find((a) => a.startsWith(`--${name}=`));
  return arg ? arg.split("=")[1] : undefined;
};

const startBook = parseInt(getArg("book") ?? "1");
const interval = parseInt(getArg("interval") ?? "3");
const model = getArg("model") ?? "claude-sonnet-4-6";

// Load existing data
let allHeadings: SectionHeading[] = [];
if (existsSync(OUTPUT_PATH)) {
  allHeadings = JSON.parse(readFileSync(OUTPUT_PATH, "utf-8"));
  console.log(`Loaded ${allHeadings.length} existing section headings`);
}

const completedBooks = new Set(allHeadings.map((h) => h.book_id));

function buildPrompt(bookId: number): string {
  const bookName = BOOK_NAMES[bookId];
  const chapters = CHAPTER_COUNTS[bookId];

  return `You are a Bible scholar. Generate section headings (소제목) for ${bookName} (${chapters} chapters).

For each thematic section, provide:
- The chapter and starting verse number
- A concise Korean title (2-6 words, no parentheses)
- A concise English title (2-6 words)

Guidelines:
- Typically 2-5 sections per chapter depending on content
- Short chapters (under 15 verses) may have 1-2 sections
- Psalms: 1 section per psalm (the psalm title/theme)
- Section should start where a new theme/narrative/argument begins
- Use well-known traditional section names where applicable
- Keep titles descriptive but brief

Output ONLY valid JSON array, no markdown code fences, no explanation:
[{"chapter":1,"verse":1,"title_ko":"천지 창조","title_en":"Creation of Heaven and Earth"},{"chapter":1,"verse":6,"title_ko":"궁창의 창조","title_en":"Creation of the Firmament"}]`;
}

function generateForBook(bookId: number): SectionHeading[] | null {
  const bookName = BOOK_NAMES[bookId];
  console.log(`\nGenerating: ${bookName} (book ${bookId})...`);

  const prompt = buildPrompt(bookId);

  // Clean env to avoid nested Claude Code issues
  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;

  for (let attempt = 1; attempt <= 3; attempt++) {
    const result = spawnSync("claude", ["-p", prompt, "--model", model], {
      encoding: "utf-8",
      timeout: 120_000,
      env,
      stdio: ["pipe", "pipe", "pipe"],
      maxBuffer: 10 * 1024 * 1024,
    });

    const output = (result.stdout ?? "").trim();

    if (!output) {
      console.error(`  Attempt ${attempt}: No output (stderr: ${result.stderr?.slice(0, 200)})`);
      if (attempt < 3) continue;
      return null;
    }

    try {
      // Extract JSON array from output (may have surrounding text)
      const jsonMatch = output.match(/\[[\s\S]*\]/);
      if (!jsonMatch) {
        console.error(`  Attempt ${attempt}: No JSON array found`);
        if (attempt < 3) continue;
        return null;
      }

      const parsed = JSON.parse(jsonMatch[0]) as { chapter: number; verse: number; title_ko: string; title_en: string }[];

      const headings: SectionHeading[] = parsed.map((h) => ({
        book_id: bookId,
        chapter: h.chapter,
        verse: h.verse,
        title_ko: h.title_ko,
        title_en: h.title_en,
      }));

      console.log(`  Generated ${headings.length} section headings`);
      return headings;
    } catch (e) {
      console.error(`  Attempt ${attempt}: Parse error: ${e}`);
      if (attempt < 3) continue;
      return null;
    }
  }
  return null;
}

// Main loop
console.log(`Starting from book ${startBook}, model: ${model}, interval: ${interval}s`);

for (let bookId = startBook; bookId <= 66; bookId++) {
  if (completedBooks.has(bookId)) {
    console.log(`Skipping ${BOOK_NAMES[bookId]} (already done)`);
    continue;
  }

  const headings = generateForBook(bookId);
  if (headings) {
    allHeadings.push(...headings);
    // Save after each book
    writeFileSync(OUTPUT_PATH, JSON.stringify(allHeadings, null, 2));
    console.log(`  Saved (total: ${allHeadings.length} headings)`);
  } else {
    console.error(`  FAILED: ${BOOK_NAMES[bookId]}`);
  }

  // Rate limiting
  if (bookId < 66) {
    console.log(`  Waiting ${interval}s...`);
    spawnSync("sleep", [String(interval)]);
  }
}

console.log(`\nDone! Total: ${allHeadings.length} section headings → ${OUTPUT_PATH}`);
