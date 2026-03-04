/**
 * Build Release Assets
 *
 * Copies non-core translation JSON files to dist/release-assets/
 * for uploading to GitHub Releases.
 *
 * Usage:
 *   npx tsx scripts/build-release-assets.ts
 */

import { existsSync, mkdirSync, copyFileSync, readdirSync } from "fs";
import { join, dirname } from "path";
import { fileURLToPath } from "url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const OUTPUT_DIR = join(__dirname, "data", "output");
const RELEASE_DIR = join(__dirname, "..", "dist", "release-assets");

const CORE_TRANSLATIONS = new Set(["kjv", "ai-ko"]);
const CORE_COMMENTARY_LANGUAGES = new Set(["ko"]);

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

// Copy commentary JSON files (excluding core language)
const COMMENTARY_DIR = join(OUTPUT_DIR, "commentary");
if (existsSync(COMMENTARY_DIR)) {
  const commentaryFiles = readdirSync(COMMENTARY_DIR).filter(
    (f) => f.startsWith("commentary-") && f.endsWith(".json")
  );

  for (const file of commentaryFiles) {
    const lang = file.replace("commentary-", "").replace(".json", "");
    if (CORE_COMMENTARY_LANGUAGES.has(lang)) continue;

    const src = join(COMMENTARY_DIR, file);
    const dest = join(RELEASE_DIR, file);
    copyFileSync(src, dest);
    console.log(`Copied commentary: ${file}`);
    copied++;
  }
}

console.log(`\n${copied} release assets copied to ${RELEASE_DIR}`);
