/**
 * AI Bible Translation Generator
 *
 * Generates Korean (and other language) Bible translations from original
 * Hebrew/Greek texts using the Claude API.
 *
 * Usage:
 *   ANTHROPIC_API_KEY=sk-... npx tsx scripts/generate-ai-translation.ts \
 *     --language ko \
 *     --book 1 \
 *     --chapter 1
 *
 * Processes one chapter at a time for context preservation.
 * Outputs JSON files per book, ready for app import.
 */

import { readFileSync, writeFileSync, existsSync, mkdirSync } from "fs";
import { join } from "path";

const OUTPUT_DIR = join(__dirname, "data", "output", "ai-translations");

// Theological term glossary for consistency
const GLOSSARY_KO: Record<string, string> = {
  God: "하나님",
  LORD: "주",
  Lord: "주",
  "Holy Spirit": "성령",
  Jesus: "예수",
  Christ: "그리스도",
  covenant: "언약",
  grace: "은혜",
  faith: "믿음",
  righteousness: "의",
  salvation: "구원",
  sin: "죄",
  repentance: "회개",
  baptism: "세례",
  resurrection: "부활",
  gospel: "복음",
  prophet: "선지자",
  apostle: "사도",
  temple: "성전",
  altar: "제단",
  sacrifice: "제사",
  angel: "천사",
  heaven: "하늘/천국",
  kingdom: "나라/왕국",
  blessing: "복/축복",
  prayer: "기도",
  worship: "예배",
  praise: "찬양",
  mercy: "긍휼",
  judgment: "심판",
};

interface TranslationConfig {
  language: string;
  languageName: string;
  glossary: Record<string, string>;
}

const LANGUAGE_CONFIGS: Record<string, TranslationConfig> = {
  ko: { language: "ko", languageName: "Korean", glossary: GLOSSARY_KO },
};

function buildPrompt(
  config: TranslationConfig,
  bookName: string,
  chapter: number,
  kjvText: string,
  originalNote: string
): string {
  const glossaryStr = Object.entries(config.glossary)
    .map(([en, local]) => `  ${en} → ${local}`)
    .join("\n");

  return `You are a Bible translator specializing in ${config.languageName} translations.

Translate the following Bible chapter from English (KJV) into natural, modern ${config.languageName}.

RULES:
1. Use the KJV text as the primary source for translation.
2. The translation must be faithful to the original meaning.
3. Use natural, readable modern ${config.languageName} — avoid archaic expressions.
4. Maintain theological term consistency using this glossary:
${glossaryStr}
5. Preserve verse numbers exactly as given.
6. Each verse should be on its own line, formatted as: verse_number|translated_text
7. Do not add commentary or notes — only the translated text.

BOOK: ${bookName}
CHAPTER: ${chapter}
${originalNote}

KJV TEXT:
${kjvText}

OUTPUT FORMAT (one verse per line):
1|[translated verse 1]
2|[translated verse 2]
...`;
}

async function translateChapter(
  apiKey: string,
  config: TranslationConfig,
  bookId: number,
  bookName: string,
  chapter: number,
  kjvVerses: { verse: number; text: string }[]
): Promise<{ verse: number; text: string }[]> {
  const kjvText = kjvVerses.map((v) => `${v.verse} ${v.text}`).join("\n");

  const testament = bookId <= 39 ? "Old Testament (originally Hebrew)" : "New Testament (originally Greek)";
  const originalNote = `NOTE: This is from the ${testament}.`;

  const prompt = buildPrompt(config, bookName, chapter, kjvText, originalNote);

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
  const content = data.content[0]?.text ?? "";

  // Parse response: each line is "verse_number|text"
  const translated = content
    .split("\n")
    .filter((line: string) => line.includes("|"))
    .map((line: string) => {
      const [numStr, ...textParts] = line.split("|");
      return {
        verse: parseInt(numStr.trim()),
        text: textParts.join("|").trim(),
      };
    })
    .filter((v: { verse: number }) => !isNaN(v.verse));

  return translated;
}

// Main
async function main() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    console.error("Error: ANTHROPIC_API_KEY environment variable is required");
    process.exit(1);
  }

  const args = process.argv.slice(2);
  const langArg = args.find((a) => a.startsWith("--language="))?.split("=")[1] ?? "ko";
  const bookArg = args.find((a) => a.startsWith("--book="))?.split("=")[1];
  const chapterArg = args.find((a) => a.startsWith("--chapter="))?.split("=")[1];

  const config = LANGUAGE_CONFIGS[langArg];
  if (!config) {
    console.error(`Unsupported language: ${langArg}. Available: ${Object.keys(LANGUAGE_CONFIGS).join(", ")}`);
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

  // English book names for prompts
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

  mkdirSync(OUTPUT_DIR, { recursive: true });

  const bookFilter = bookArg ? parseInt(bookArg) : null;
  const chapterFilter = chapterArg ? parseInt(chapterArg) : null;

  // Group KJV by book+chapter
  const chapters = new Map<string, { verse: number; text: string }[]>();
  for (const v of kjvData) {
    if (bookFilter && v.book_id !== bookFilter) continue;
    if (chapterFilter && v.chapter !== chapterFilter) continue;

    const key = `${v.book_id}-${v.chapter}`;
    if (!chapters.has(key)) chapters.set(key, []);
    chapters.get(key)!.push({ verse: v.verse, text: v.text });
  }

  console.log(`Translating ${chapters.size} chapters to ${config.languageName}...`);

  const allVerses: {
    translation_id: string;
    book_id: number;
    chapter: number;
    verse: number;
    text: string;
  }[] = [];

  let processed = 0;
  for (const [key, verses] of chapters) {
    const [bookIdStr, chapterStr] = key.split("-");
    const bookId = parseInt(bookIdStr);
    const chapter = parseInt(chapterStr);
    const bookName = BOOK_NAMES[bookId] ?? `Book ${bookId}`;

    process.stdout.write(`  ${bookName} ${chapter} (${++processed}/${chapters.size})... `);

    try {
      const translated = await translateChapter(
        apiKey,
        config,
        bookId,
        bookName,
        chapter,
        verses
      );

      for (const v of translated) {
        allVerses.push({
          translation_id: `ai-${langArg}`,
          book_id: bookId,
          chapter,
          verse: v.verse,
          text: v.text,
        });
      }

      console.log(`${translated.length} verses`);

      // Rate limiting: wait 500ms between API calls
      await new Promise((r) => setTimeout(r, 500));
    } catch (err) {
      console.log(`ERROR: ${err}`);
    }
  }

  // Write output
  const outPath = join(OUTPUT_DIR, `ai-${langArg}.json`);
  writeFileSync(outPath, JSON.stringify(allVerses, null, 2));
  console.log(`\nWrote ${allVerses.length} verses to ${outPath}`);
}

main().catch(console.error);
