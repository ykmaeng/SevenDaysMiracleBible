/**
 * AI Bible Commentary Generator
 *
 * Generates chapter-level commentary in multiple languages using the Claude API.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... npx tsx scripts/generate-ai-commentary.ts \
 *     --language ko \
 *     --book 1 \
 *     --chapter 1
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const OUTPUT_DIR = join(__dirname, "data", "output", "commentary");

const LANGUAGE_NAMES: Record<string, string> = {
  ko: "Korean",
  en: "English",
  zh: "Chinese (Simplified)",
  es: "Spanish",
};

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

function buildCommentaryPrompt(
  language: string,
  languageName: string,
  bookName: string,
  chapter: number,
  kjvText: string
): string {
  return `You are a seasoned Bible scholar and pastor writing an in-depth chapter commentary (성경강해). Write in ${languageName}.

CHAPTER: ${bookName} Chapter ${chapter}

TEXT (KJV):
${kjvText}

Write a comprehensive, scholarly yet accessible commentary covering ALL of the following sections:

## 배경과 문맥 (Background & Context)
- This chapter's position within the book and the broader biblical narrative
- Historical setting: time period, author, audience, circumstances of writing
- Literary genre and structure of this chapter (narrative, poetry, prophecy, epistle, etc.)
- Connection to preceding and following chapters

## 본문 해설 (Verse-by-Verse Exposition)
- Walk through the chapter's key passages in order
- Explain difficult or significant words/phrases with reference to original Hebrew/Greek meaning where relevant
- Highlight literary devices, parallelism, chiasm, or rhetorical structures
- Note textual or translation issues where they significantly affect meaning

## 핵심 신학 주제 (Key Theological Themes)
- Central theological message(s) of this chapter
- How this chapter contributes to major biblical doctrines (God's character, salvation, covenant, kingdom, etc.)
- Typology and foreshadowing — connections to Christ and the gospel (for OT passages)
- How this passage fits into redemptive history (creation → fall → redemption → restoration)

## 교차 참조 (Cross-References)
- 3-5 most important cross-references with brief explanation of how they connect
- Show how Scripture interprets Scripture on the themes found here

## 적용 (Application)
- What did this passage mean to the original audience?
- What timeless principles emerge for believers today?
- Specific, practical challenges or encouragements for modern life
- Questions for personal reflection or group discussion (2-3 questions)

RULES:
- Write entirely in ${languageName}
- Length: 1,500-2,000 words (심도있는 강해)
- Use markdown formatting with ## headers for each section
- Be theologically orthodox and balanced (evangelical perspective)
- Avoid denominational bias
- Do not reproduce the full Bible text — reference verses by number
- Use respectful, pastoral tone — this is for spiritual edification, not academic papers
- Where relevant, include insights from church history or notable commentators`;
}

async function generateCommentary(
  apiKey: string,
  language: string,
  bookId: number,
  chapter: number,
  kjvVerses: { verse: number; text: string }[]
): Promise<string> {
  const bookName = BOOK_NAMES[bookId] ?? `Book ${bookId}`;
  const languageName = LANGUAGE_NAMES[language] ?? language;
  const kjvText = kjvVerses.map((v) => `${v.verse}. ${v.text}`).join("\n");

  const prompt = buildCommentaryPrompt(language, languageName, bookName, chapter, kjvText);

  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: "claude-sonnet-4-5-20250929",
      max_tokens: 4096,
      messages: [{ role: "user", content: prompt }],
    }),
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status} ${await response.text()}`);
  }

  const data = await response.json();
  return data.content[0]?.text ?? "";
}

async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is required");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const language = args.find((a) => a.startsWith("--language="))?.split("=")[1] ?? "ko";
  const bookFilter = args.find((a) => a.startsWith("--book="))?.split("=")[1];
  const chapterFilter = args.find((a) => a.startsWith("--chapter="))?.split("=")[1];

  if (!LANGUAGE_NAMES[language]) {
    console.error(`Unsupported language: ${language}`);
    process.exit(1);
  }

  // Load KJV data
  const kjvPath = join(__dirname, "data", "output", "kjv.json");
  if (!existsSync(kjvPath)) {
    console.error("KJV data not found. Run import-bible-data.ts first.");
    process.exit(1);
  }

  const kjvData = JSON.parse(readFileSync(kjvPath, "utf-8")) as {
    book_id: number;
    chapter: number;
    verse: number;
    text: string;
  }[];

  // Group by book+chapter
  const chapters = new Map<string, { verse: number; text: string }[]>();
  for (const v of kjvData) {
    if (bookFilter && v.book_id !== parseInt(bookFilter)) continue;
    if (chapterFilter && v.chapter !== parseInt(chapterFilter)) continue;

    const key = `${v.book_id}-${v.chapter}`;
    if (!chapters.has(key)) chapters.set(key, []);
    chapters.get(key)!.push({ verse: v.verse, text: v.text });
  }

  mkdirSync(OUTPUT_DIR, { recursive: true });

  console.log(`Generating ${language} commentary for ${chapters.size} chapters...`);

  const results: {
    book_id: number;
    chapter: number;
    language: string;
    content: string;
    model_version: string;
  }[] = [];

  let processed = 0;
  for (const [key, verses] of chapters) {
    const [bookIdStr, chapterStr] = key.split("-");
    const bookId = parseInt(bookIdStr);
    const chapter = parseInt(chapterStr);

    process.stdout.write(
      `  ${BOOK_NAMES[bookId]} ${chapter} (${++processed}/${chapters.size})... `
    );

    try {
      const content = await generateCommentary(apiKey, language, bookId, chapter, verses);

      results.push({
        book_id: bookId,
        chapter,
        language,
        content,
        model_version: "claude-sonnet-4-5-20250929",
      });

      console.log("done");

      // Rate limiting
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.log(`ERROR: ${err}`);
    }
  }

  const outPath = join(OUTPUT_DIR, `commentary-${language}.json`);
  writeFileSync(outPath, JSON.stringify(results, null, 2));
  console.log(`\nWrote ${results.length} commentaries to ${outPath}`);
}

main().catch(console.error);
