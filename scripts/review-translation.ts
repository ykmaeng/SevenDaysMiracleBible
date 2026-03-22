/**
 * SAV Translation QA Review
 *
 * Reviews SAV-KO and SAV-EN translations against original Hebrew/Greek
 * interlinear data using Claude Opus for scholarly analysis.
 *
 * Usage:
 *   npx tsx scripts/review-translation.ts                    # full run
 *   npx tsx scripts/review-translation.ts --book=1           # from specific book
 *   npx tsx scripts/review-translation.ts --book=1 --chapter=3  # single chapter
 *   npx tsx scripts/review-translation.ts --interval=30      # seconds between API calls
 *   npx tsx scripts/review-translation.ts --summary          # generate summary only
 */

import { writeFileSync, existsSync, readFileSync, mkdirSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";
import { spawnSync } from "child_process";
import Database from "better-sqlite3";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
const REVIEW_DIR = join(__dirname, "review");
const DATA_DIR = join(__dirname, "data", "output");
const INTERLINEAR_DIR = join(__dirname, "data", "interlinear");

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

// ── Data types ──

interface Verse {
  translation_id: string;
  book_id: number;
  chapter: number;
  verse: number;
  text: string;
}

interface ReviewIssue {
  verse: number;
  translation: string;
  severity: "critical" | "major" | "minor" | "info";
  category: string;
  current_text?: string;
  original_text?: string;
  description: string;
  suggestion?: string;
  corrected_text?: string;
  original_word_detail?: string;
}

interface ReviewReport {
  book_id: number;
  chapter: number;
  book_name: string;
  reviewed_at: string;
  model: string;
  verse_count: number;
  matched_original_count: number;
  overall_score: { sav_en: number; sav_ko: number };
  summary: string;
  issues: ReviewIssue[];
}

// ── Interlinear parsing ──

function parseDelimited(s: string): string[] {
  const match = s.match(/〔(.*)〕/);
  if (!match) return [];
  return match[1].split("｜");
}

function stripHtml(s: string): string {
  return s.replace(/<[^>]+>/g, "").trim();
}

/** Parse BHSA CSV into Map<"book:chapter", Map<verse, words[]>> */
function loadBHSA(): Map<string, Map<number, string[]>> {
  console.log("Loading BHSA interlinear...");
  const csv = readFileSync(join(INTERLINEAR_DIR, "BHSA-8-layer-interlinear.csv"), "utf-8");
  const lines = csv.split("\n").slice(1); // skip header

  const chapters = new Map<string, Map<number, string[]>>();

  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = line.split("\t");
    if (cols.length < 12) continue;

    const ref = parseDelimited(cols[1]);
    if (ref.length < 4) continue;

    const bookId = parseInt(ref[1]);
    const chapter = parseInt(ref[2]);
    const verse = parseInt(ref[3]);
    if (isNaN(bookId) || isNaN(chapter) || isNaN(verse)) continue;
    if (bookId < 1 || bookId > 39) continue;

    const hebrewWord = stripHtml(cols[2]);
    const lexeme = stripHtml(cols[5]);
    const strongs = cols[7]?.trim() || "";
    const gloss = cols[10]?.trim() || "";

    const key = `${bookId}:${chapter}`;
    if (!chapters.has(key)) chapters.set(key, new Map());
    const verseMap = chapters.get(key)!;
    if (!verseMap.has(verse)) verseMap.set(verse, []);
    verseMap.get(verse)!.push(`${hebrewWord}(${strongs} "${gloss}")`);
  }

  console.log(`  BHSA: ${chapters.size} chapters loaded`);
  return chapters;
}

/** Parse OpenGNT CSV into Map<"book:chapter", Map<verse, words[]>> */
function loadOpenGNT(): Map<string, Map<number, string[]>> {
  console.log("Loading OpenGNT interlinear...");
  const csv = readFileSync(join(INTERLINEAR_DIR, "OpenGNT_version3_3.csv"), "utf-8");
  const lines = csv.split("\n").slice(1);

  const chapters = new Map<string, Map<number, string[]>>();

  for (const line of lines) {
    if (!line.trim()) continue;
    const cols = line.split("\t");
    if (cols.length < 11) continue;

    const ref = parseDelimited(cols[6]);
    if (ref.length < 3) continue;

    const bookId = parseInt(ref[0]);
    const chapter = parseInt(ref[1]);
    const verse = parseInt(ref[2]);
    if (isNaN(bookId) || isNaN(chapter) || isNaN(verse)) continue;

    const wordData = parseDelimited(cols[7]);
    if (wordData.length < 6) continue;

    const greekWord = wordData[2]; // OGNTa (accented)
    const strongs = wordData[5];

    const glosses = parseDelimited(cols[10]);
    const gloss = glosses[1] || glosses[0] || "";

    const key = `${bookId}:${chapter}`;
    if (!chapters.has(key)) chapters.set(key, new Map());
    const verseMap = chapters.get(key)!;
    if (!verseMap.has(verse)) verseMap.set(verse, []);
    verseMap.get(verse)!.push(`${greekWord}(${strongs} "${gloss}")`);
  }

  console.log(`  OpenGNT: ${chapters.size} chapters loaded`);
  return chapters;
}

/** Format interlinear data for a chapter into compressed text */
function formatInterlinear(verseMap: Map<number, string[]>): string {
  const lines: string[] = [];
  const sortedVerses = [...verseMap.keys()].sort((a, b) => a - b);
  for (const v of sortedVerses) {
    const words = verseMap.get(v)!;
    lines.push(`Verse ${v}: ${words.join(" ")}`);
  }
  return lines.join("\n");
}

// ── Claude API ──
// Uses spawnSync with array arguments (no shell interpolation, safe from injection)

function callClaude(prompt: string, model: string): string {
  const env = { ...process.env };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE_ENTRYPOINT;

  const result = spawnSync("claude", ["-p", "--model", model], {
    input: prompt,
    encoding: "utf-8",
    env,
    timeout: 300_000,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) throw new Error(result.stderr || `exit code ${result.status}`);

  return (result.stdout ?? "").trim();
}

// ── Prompt ──

function buildReviewPrompt(
  bookName: string,
  bookId: number,
  chapter: number,
  interlinear: string,
  savEnVerses: Map<number, string>,
  savKoVerses: Map<number, string>,
): string {
  const verseNums = [...new Set([...savEnVerses.keys(), ...savKoVerses.keys()])].sort((a, b) => a - b);
  const savLines: string[] = [];
  for (const v of verseNums) {
    const en = savEnVerses.get(v) || "(missing)";
    const ko = savKoVerses.get(v) || "(missing)";
    savLines.push(`Verse ${v}:\n  EN: ${en}\n  KO: ${ko}`);
  }

  const testament = bookId <= 39 ? "OT" : "NT";
  const langLabel = testament === "OT" ? "Hebrew" : "Greek";

  return `You are an expert biblical scholar fluent in Hebrew, Greek, English, and Korean, specializing in Translation Studies and textual criticism.

TASK: Review SAV-EN and SAV-KO translations of ${bookName} Chapter ${chapter} against the original ${langLabel} text.

TRANSLATION LINEAGE: SAV (Selah Authorized Version) is a modern re-translation of the KJV (King James Version), which is based on the Textus Receptus (NT) and Masoretic Text (OT) using formal equivalence. When SAV follows a KJV translation choice that reflects the TR/MT tradition, this is NOT an error — it is an intentional choice within this translation lineage.

TEXTUAL TRADITION: This translation follows the TR tradition. Differences from CT (NA28/UBS5) are expected and NOT errors. Examples: μονογενής → "only begotten" (KJV tradition), Mark 16:9-20 (Long Ending), John 7:53-8:11 (Pericope Adulterae), 1 John 5:7-8 (Comma Johanneum) are all expected.

ORIGINAL ${langLabel.toUpperCase()} INTERLINEAR (word-by-word with Strong's numbers and glosses):
${interlinear}

SAV TRANSLATIONS:
${savLines.join("\n")}

REVIEW INSTRUCTIONS:
1. Compare BOTH SAV-EN and SAV-KO against the original interlinear data
2. Check for accuracy, nuance preservation, and consistency
3. Also check SAV-EN vs SAV-KO consistency — they should convey the same meaning from the same source
4. Score each translation 1-10:
   - 10: Faithful and natural, perfect translation
   - 8-9: Minor issues only (nuance, style)
   - 6-7: 1-2 major issues (meaning distortion but no doctrinal change)
   - 4-5: Multiple major or critical issues
   - 1-3: Severe mistranslations throughout

ISSUE CATEGORIES:
- mistranslation: Translated meaning differs from original (word/phrase level). If following KJV tradition, lower severity.
- theological_error: Translation changes doctrinal implications (deity, soteriology, Trinity, Christology)
- missing_nuance: Loss of original nuance (Hebrew qal/hiphil, Greek aorist/present, emphasis, waw-consecutive)
- added_meaning: Meaning added that is not in the original (interpretive insertion)
- omission: Original content omitted (word/phrase level)
- term_consistency: Same original word (by Strong's number) translated inconsistently within this chapter
- inconsistency: SAV-EN and SAV-KO interpret the same source text differently (contradictory)
- style: Readability/naturalness issue (meaning is correct but awkward)
- grammar: Grammar error (subject-verb agreement, particle errors, etc.)

SEVERITY:
- critical: Changes core doctrine (Trinity, salvation, Christology, pneumatology)
- major: Meaning distortion — reader gets wrong understanding
- minor: Nuance loss, style issue, better alternative exists
- info: Academic note, style suggestion

OUTPUT: Pure JSON only (no markdown fences, no explanation before/after). Use this exact structure:
{
  "book_id": ${bookId},
  "chapter": ${chapter},
  "book_name": "${bookName}",
  "reviewed_at": "${new Date().toISOString()}",
  "model": "claude-opus-4-6",
  "verse_count": ${verseNums.length},
  "matched_original_count": ${verseNums.length},
  "overall_score": { "sav_en": <1-10>, "sav_ko": <1-10> },
  "summary": "<2-3 sentence overall assessment>",
  "issues": [
    {
      "verse": <number>,
      "translation": "<sav-en or sav-ko>",
      "severity": "<critical|major|minor|info>",
      "category": "<category>",
      "current_text": "<current translation text for this verse or phrase>",
      "original_text": "<original language text>",
      "description": "<what's wrong and why>",
      "suggestion": "<suggested correction for the problematic phrase>",
      "corrected_text": "<FOR critical/major/minor: the complete corrected verse text, ready to replace the current translation in the database. Must be the FULL verse, not just the changed phrase. Omit this field for info severity.>",
      "original_word_detail": "<Strong's number, lexeme, morphology detail>"
    }
  ]
}

IMPORTANT: For "critical", "major", and "minor" severity issues, you MUST include "corrected_text" — the full corrected verse translation that can directly replace the current text in the database. For "info" severity, omit "corrected_text".

LANGUAGE RULES for issue fields:
- For sav-ko issues: write "description" and "suggestion" in Korean (한국어). "corrected_text" is naturally in Korean.
- For sav-en issues: write "description" and "suggestion" in English. "corrected_text" is naturally in English.
- "original_word_detail" is always in English (scholarly notation with Strong's numbers).
- "summary" is always in English (covers both translations).

If there are no issues, return an empty issues array. Be thorough but avoid false positives — do NOT flag KJV/TR tradition choices as errors.`;
}

// ── Summary generation ──

function generateSummary() {
  console.log("\nGenerating summary report...");

  const files = readdirSync(REVIEW_DIR).filter(f => f.match(/^review-\d+-\d+\.json$/));
  if (files.length === 0) {
    console.log("No review files found.");
    return;
  }

  const allReports: ReviewReport[] = [];
  for (const f of files) {
    const report = JSON.parse(readFileSync(join(REVIEW_DIR, f), "utf-8")) as ReviewReport;
    allReports.push(report);
  }
  allReports.sort((a, b) => a.book_id * 1000 + a.chapter - (b.book_id * 1000 + b.chapter));

  const totalChapters = allReports.length;
  const totalIssues = allReports.reduce((s, r) => s + r.issues.length, 0);

  const bySeverity: Record<string, number> = { critical: 0, major: 0, minor: 0, info: 0 };
  const byCategory: Record<string, number> = {};
  const byBook: Record<number, { issues: number; scoreEn: number[]; scoreKo: number[] }> = {};

  for (const r of allReports) {
    if (!byBook[r.book_id]) byBook[r.book_id] = { issues: 0, scoreEn: [], scoreKo: [] };
    byBook[r.book_id].scoreEn.push(r.overall_score.sav_en);
    byBook[r.book_id].scoreKo.push(r.overall_score.sav_ko);

    for (const issue of r.issues) {
      bySeverity[issue.severity] = (bySeverity[issue.severity] || 0) + 1;
      byCategory[issue.category] = (byCategory[issue.category] || 0) + 1;
      byBook[r.book_id].issues++;
    }
  }

  const avgScoreEn = allReports.reduce((s, r) => s + r.overall_score.sav_en, 0) / totalChapters;
  const avgScoreKo = allReports.reduce((s, r) => s + r.overall_score.sav_ko, 0) / totalChapters;

  const worstChapters = [...allReports]
    .sort((a, b) => {
      const aMin = Math.min(a.overall_score.sav_en, a.overall_score.sav_ko);
      const bMin = Math.min(b.overall_score.sav_en, b.overall_score.sav_ko);
      return aMin - bMin;
    })
    .slice(0, 20)
    .map(r => ({
      book: BOOK_NAMES[r.book_id],
      chapter: r.chapter,
      score_en: r.overall_score.sav_en,
      score_ko: r.overall_score.sav_ko,
      issues: r.issues.length,
    }));

  const criticalMajor: (ReviewIssue & { book_name: string; chapter: number })[] = [];
  for (const r of allReports) {
    for (const issue of r.issues) {
      if (issue.severity === "critical" || issue.severity === "major") {
        criticalMajor.push({ ...issue, book_name: r.book_name, chapter: r.chapter });
      }
    }
  }
  criticalMajor.sort((a, b) => {
    const sevOrder: Record<string, number> = { critical: 0, major: 1, minor: 2, info: 3 };
    return (sevOrder[a.severity] ?? 3) - (sevOrder[b.severity] ?? 3);
  });

  const summaryJson = {
    generated_at: new Date().toISOString(),
    total_chapters: totalChapters,
    total_issues: totalIssues,
    average_score: { sav_en: +avgScoreEn.toFixed(2), sav_ko: +avgScoreKo.toFixed(2) },
    by_severity: bySeverity,
    by_category: byCategory,
    worst_chapters: worstChapters,
    top_critical_major: criticalMajor.slice(0, 50),
  };

  writeFileSync(join(REVIEW_DIR, "review-summary.json"), JSON.stringify(summaryJson, null, 2));

  // Markdown summary
  let md = `# SAV Translation Review Summary\n\n`;
  md += `Generated: ${summaryJson.generated_at}\n\n`;
  md += `## Overview\n`;
  md += `- Chapters reviewed: **${totalChapters}** / 1189\n`;
  md += `- Total issues: **${totalIssues}**\n`;
  md += `- Average score — SAV-EN: **${avgScoreEn.toFixed(2)}** / SAV-KO: **${avgScoreKo.toFixed(2)}**\n\n`;
  md += `## By Severity\n`;
  md += `| Severity | Count |\n|----------|-------|\n`;
  for (const sev of ["critical", "major", "minor", "info"]) {
    md += `| ${sev} | ${bySeverity[sev] || 0} |\n`;
  }
  md += `\n## By Category\n`;
  md += `| Category | Count |\n|----------|-------|\n`;
  for (const [cat, count] of Object.entries(byCategory).sort((a, b) => b[1] - a[1])) {
    md += `| ${cat} | ${count} |\n`;
  }
  md += `\n## Worst Chapters (by lowest score)\n`;
  md += `| Book | Ch | EN | KO | Issues |\n|------|----|----|----|---------|\n`;
  for (const w of worstChapters) {
    md += `| ${w.book} | ${w.chapter} | ${w.score_en} | ${w.score_ko} | ${w.issues} |\n`;
  }
  if (criticalMajor.length > 0) {
    md += `\n## Top Critical/Major Issues\n`;
    for (const issue of criticalMajor.slice(0, 30)) {
      md += `\n### ${issue.book_name} ${issue.chapter}:${issue.verse} (${issue.translation}) — ${issue.severity}\n`;
      md += `**Category:** ${issue.category}\n`;
      md += `**Description:** ${issue.description}\n`;
      if (issue.suggestion) md += `**Suggestion:** ${issue.suggestion}\n`;
    }
  }

  writeFileSync(join(REVIEW_DIR, "review-summary.md"), md);
  console.log(`Summary: ${join(REVIEW_DIR, "review-summary.json")}`);
  console.log(`Summary: ${join(REVIEW_DIR, "review-summary.md")}`);

  buildReviewDb(allReports);
}

function buildReviewDb(reports: ReviewReport[]) {
  const dbPath = join(REVIEW_DIR, "review.db");
  console.log(`\nBuilding review.db...`);

  const db = new Database(dbPath);
  db.pragma("journal_mode = WAL");

  db.exec("DROP TABLE IF EXISTS review_chapters");
  db.exec("DROP TABLE IF EXISTS review_issues");

  db.exec(`
    CREATE TABLE review_chapters (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      reviewed_at TEXT NOT NULL,
      model TEXT NOT NULL,
      verse_count INTEGER NOT NULL,
      score_en INTEGER NOT NULL,
      score_ko INTEGER NOT NULL,
      summary TEXT NOT NULL,
      UNIQUE(book_id, chapter)
    );

    CREATE TABLE review_issues (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      book_id INTEGER NOT NULL,
      chapter INTEGER NOT NULL,
      verse INTEGER NOT NULL,
      translation TEXT NOT NULL,
      severity TEXT NOT NULL,
      category TEXT NOT NULL,
      current_text TEXT,
      original_text TEXT,
      description TEXT NOT NULL,
      suggestion TEXT,
      corrected_text TEXT,
      original_word_detail TEXT
    );

    CREATE INDEX idx_review_verse ON review_issues(book_id, chapter, verse);
    CREATE INDEX idx_review_severity ON review_issues(severity);
  `);

  const insertChapter = db.prepare(
    "INSERT INTO review_chapters (book_id, chapter, reviewed_at, model, verse_count, score_en, score_ko, summary) VALUES (?, ?, ?, ?, ?, ?, ?, ?)"
  );
  const insertIssue = db.prepare(
    "INSERT INTO review_issues (book_id, chapter, verse, translation, severity, category, current_text, original_text, description, suggestion, corrected_text, original_word_detail) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
  );

  const insertAll = db.transaction(() => {
    for (const r of reports) {
      insertChapter.run(
        r.book_id, r.chapter, r.reviewed_at, r.model,
        r.verse_count, r.overall_score.sav_en, r.overall_score.sav_ko, r.summary
      );
      for (const issue of r.issues) {
        insertIssue.run(
          r.book_id, r.chapter, issue.verse, issue.translation,
          issue.severity, issue.category, issue.current_text || null,
          issue.original_text || null, issue.description,
          issue.suggestion || null, issue.corrected_text || null,
          issue.original_word_detail || null
        );
      }
    }
  });

  insertAll();

  const chCount = (db.prepare("SELECT COUNT(*) as c FROM review_chapters").get() as { c: number }).c;
  const issueCount = (db.prepare("SELECT COUNT(*) as c FROM review_issues").get() as { c: number }).c;
  console.log(`  review.db: ${chCount} chapters, ${issueCount} issues → ${dbPath}`);

  db.pragma("journal_mode = DELETE");
  db.close();
}

// ── Main ──

async function main() {
  const args = process.argv.slice(2);
  const bookFilter = args.find(a => a.startsWith("--book="))?.split("=")[1];
  const chapterFilter = args.find(a => a.startsWith("--chapter="))?.split("=")[1];
  const model = args.find(a => a.startsWith("--model="))?.split("=")[1] ?? "claude-opus-4-6";
  const intervalSec = args.find(a => a.startsWith("--interval="))?.split("=")[1];
  const INTERVAL_MS = intervalSec ? parseInt(intervalSec) * 1000 : 0;
  const summaryOnly = args.includes("--summary");

  mkdirSync(REVIEW_DIR, { recursive: true });

  if (summaryOnly) {
    generateSummary();
    return;
  }

  // Load SAV translations
  console.log("Loading SAV translations...");
  const savKoRaw: Verse[] = JSON.parse(readFileSync(join(DATA_DIR, "sav-ko.json"), "utf-8"));
  const savEnRaw: Verse[] = JSON.parse(readFileSync(join(DATA_DIR, "sav-en.json"), "utf-8"));

  const savKo = new Map<string, string>();
  const savEn = new Map<string, string>();
  for (const v of savKoRaw) savKo.set(`${v.book_id}:${v.chapter}:${v.verse}`, v.text);
  for (const v of savEnRaw) savEn.set(`${v.book_id}:${v.chapter}:${v.verse}`, v.text);
  console.log(`  SAV-KO: ${savKo.size} verses, SAV-EN: ${savEn.size} verses`);

  // Load interlinear data
  const bhsa = loadBHSA();
  const ognt = loadOpenGNT();

  // Build pending list
  const pending: { bookId: number; chapter: number }[] = [];
  const startBook = bookFilter ? parseInt(bookFilter) : 1;
  const endBook = bookFilter && !chapterFilter ? 66 : (bookFilter ? parseInt(bookFilter) : 66);

  for (let bookId = startBook; bookId <= endBook; bookId++) {
    const maxCh = CHAPTER_COUNTS[bookId] ?? 0;
    const startCh = chapterFilter ? parseInt(chapterFilter) : 1;
    const endCh = chapterFilter ? parseInt(chapterFilter) : maxCh;

    for (let ch = startCh; ch <= endCh; ch++) {
      const reportPath = join(REVIEW_DIR, `review-${bookId}-${ch}.json`);
      if (!existsSync(reportPath)) {
        pending.push({ bookId, chapter: ch });
      }
    }
  }

  if (pending.length === 0) {
    console.log("\nAll requested chapters already reviewed. Nothing to do.");
    generateSummary();
    return;
  }

  console.log(`\nReviewing ${pending.length} chapters (model: ${model})...\n`);

  let processed = 0;

  for (const { bookId, chapter } of pending) {
    const bookName = BOOK_NAMES[bookId] ?? `Book ${bookId}`;
    const isOT = bookId <= 39;
    const chapterKey = `${bookId}:${chapter}`;

    process.stdout.write(`  [${++processed}/${pending.length}] ${bookName} ${chapter}... `);

    // Get interlinear data
    const interlinearMap = isOT ? bhsa.get(chapterKey) : ognt.get(chapterKey);

    if (!interlinearMap || interlinearMap.size === 0) {
      console.log("skipped (no interlinear data)");
      continue;
    }

    // Get SAV verses for this chapter
    const savEnVerses = new Map<number, string>();
    const savKoVerses = new Map<number, string>();

    for (const v of interlinearMap.keys()) {
      const key = `${bookId}:${chapter}:${v}`;
      if (savEn.has(key)) savEnVerses.set(v, savEn.get(key)!);
      if (savKo.has(key)) savKoVerses.set(v, savKo.get(key)!);
    }

    const interlinearText = formatInterlinear(interlinearMap);

    const prompt = buildReviewPrompt(
      bookName, bookId, chapter,
      interlinearText, savEnVerses, savKoVerses
    );

    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const response = callClaude(prompt, model);

        if (!response) {
          if (attempt < MAX_RETRIES) {
            process.stdout.write(`empty, retry ${attempt}/${MAX_RETRIES}... `);
            await new Promise(r => setTimeout(r, 5000));
            continue;
          }
          console.log("EMPTY (gave up)");
          break;
        }

        // Parse JSON — handle potential markdown wrapping
        let jsonStr = response;
        if (!jsonStr.startsWith("{")) {
          const match = jsonStr.match(/\{[\s\S]*\}/);
          if (match) jsonStr = match[0];
        }

        const report = JSON.parse(jsonStr) as ReviewReport;
        const reportPath = join(REVIEW_DIR, `review-${bookId}-${chapter}.json`);
        writeFileSync(reportPath, JSON.stringify(report, null, 2));

        const issueCount = report.issues.length;
        const critical = report.issues.filter(i => i.severity === "critical").length;
        const major = report.issues.filter(i => i.severity === "major").length;
        console.log(
          `EN:${report.overall_score.sav_en} KO:${report.overall_score.sav_ko} ` +
          `(${issueCount} issues${critical ? `, ${critical} critical` : ""}${major ? `, ${major} major` : ""})`
        );

        if (INTERVAL_MS > 0) {
          await new Promise(r => setTimeout(r, INTERVAL_MS));
        }
        break;
      } catch (err) {
        if (attempt < MAX_RETRIES) {
          process.stdout.write(`retry ${attempt}/${MAX_RETRIES}... `);
          await new Promise(r => setTimeout(r, 5000));
        } else {
          console.log(`FAILED: ${err}`);
        }
      }
    }
  }

  console.log(`\nReview complete. ${processed} chapters processed.`);
  generateSummary();
}

main().catch(console.error);
