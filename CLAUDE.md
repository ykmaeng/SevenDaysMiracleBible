# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Selah Bible — a cross-platform (desktop + Android) Bible reader app built with **Tauri 2 + React 19 + TypeScript**. App identifier: `bible.selah`. It bundles a core SQLite database with KJV, SAV-KO translations, AI commentary, section headings, and Greek interlinear data, and allows users to download additional translations on demand from GitHub releases.

## Development Commands

```bash
pnpm dev                    # Vite dev server (port 1420, frontend only — no SQLite)
pnpm tauri dev              # Full Tauri desktop app with hot reload
pnpm tauri android dev      # Deploy to connected Android device
pnpm build                  # tsc + vite build (frontend only)
pnpm tauri build            # Full production app bundle
pnpm tauri android build    # Android APK/AAB
pnpm build:db               # Build full bible.db from scripts/data/output/*.json
pnpm build:db:core          # Build bible-core.db (kjv + sav-ko only, bundled with app)
pnpm build:release-assets   # Generate release JSON files for downloadable translations
```

Scripts run via `tsx` (TypeScript executor). Bible data scripts are in `scripts/`. No test framework or linter is configured — `pnpm build` (tsc strict mode) is the primary validation.

## Architecture

### Frontend (`src/`)

React SPA rendered inside Tauri's webview. Top-level views controlled by `App.tsx`: **reader**, **settings**, **features**, **bookmarks**, **highlights**.

- **Components** organized by feature: `BibleReader/`, `Navigation/`, `Settings/`, `TabBar/`, `Commentary/`, `Interlinear/`, `Bookmarks/`, `Highlights/`, `Feedback/`
- **State**: Zustand stores with Immer middleware in `src/stores/`
  - `settingsStore` — language, fontSize, theme, defaultTranslation, parallelTranslations, TTS settings (persisted to localStorage as `"bible-settings"`)
  - `tabStore` — multi-tab reader state with independent scroll positions (persisted as `"bible-tabs"`)
  - `featureStore` — toggle-based feature plugin system (persisted as `"bible-features"`)
  - `bookmarkStore` — chapter-scoped bookmark/highlight state with label management
  - `downloadStore` — runtime-only download progress tracking
- **Data access**: `src/lib/db.ts` wraps Tauri SQL plugin; `src/lib/bible.ts` provides typed query functions. Core translations query `bible.db` directly; downloaded translations use separate per-translation `.db` files via `queryTranslation()`
- **i18n**: i18next with 9 locales (`src/i18n/locales/` — ko, en, zh, ja, es, de, fr, pt, ru), browser language detection
- **Types**: All interfaces in `src/types/bible.ts` (Translation, Verse, Book, BookName, InterlinearWord, Bookmark, etc.)
- **Styling**: Tailwind CSS 4 via Vite plugin

### Feature Plugin System

Features are registered in `FEATURE_REGISTRY` (featureStore.ts) with config for tab bar visibility and floating menu. Currently: **bookmarks**, **highlights**, **notes**. Users toggle features on/off; enabled features appear in bottom nav.

### BibleReader Component Pattern

`ChapterView` is the core reader component using `@tanstack/react-virtual` for virtualized scrolling. It loads verses, paragraph breaks, section headings, parallel translations, and interlinear data, then renders via `ParagraphGroup` components. Key patterns:
- **Paragraph mode** (no parallels): verses grouped by section headings + paragraph breaks into flowing text
- **Per-verse mode** (with parallels): each verse rendered individually with parallel translations below
- **Interlinear**: Greek word glosses rendered inline below each verse when enabled (NT only)
- **Verse selection**: multi-select via `Map<number, Verse>`, triggers `VerseActionToolbar` bottom sheet
- **Immersive mode**: scroll-triggered fullscreen that hides tab bar and bottom nav

### Bookmark/Highlight System

Single `bookmarks` table, distinguished by `color` field:
- **Bookmarks**: `color IS NULL` — shown in BookmarksView, support labels for organizing
- **Highlights**: `color IS NOT NULL` — 5 colors (yellow, green, blue, red, purple), shown in HighlightsView
- **Labels**: `bookmark_labels` table, bookmarks reference via `label_id` (for worship/study group organizing)

### TTS System

- **Desktop**: Web Speech API via `useTTS()` hook
- **Android**: Native TTS via Tauri plugin (`src-tauri/src/tts_plugin/`), registered as `"bible.selah.tts"` with commands: `tts_speak`, `tts_stop`, `tts_is_speaking`, `tts_get_voices`
- **Pause on Android**: Simulated by stopping and remembering verse position (no native pause API)

### Backend (`src-tauri/`)

Rust/Tauri 2 shell. Minimal custom Rust code — most logic is in the frontend.

- `lib.rs` initializes Tauri plugins: SQL (SQLite), HTTP, FS, Opener, TTS (custom), Sharesheet (mobile only)
- SQLite migrations in `migrations/` (versions 1-8, registered in `lib.rs`). Note: migration 004 exists as a file but is NOT registered
- `resources/bible-core.db` is bundled and copied to app data dir on first run (only if db missing or < 1MB)
- App data dir: `~/Library/Application Support/bible.selah/` (macOS)

### Data Pipeline (`scripts/`)

- `build-bible-db.ts` — reads JSON from `scripts/data/output/` and creates SQLite databases
- `generate-ai-commentary.ts` — AI commentary generation using `spawnSync('claude', ['-p'])`
- `import-interlinear.ts` — parses OpenGNT CSV into `interlinear_words` table (138K Greek NT words)
- `build-release-assets.ts` — creates per-translation JSON files for GitHub releases
- Translation data files in `scripts/data/output/` (e.g., `sav-ko.json`, `kjv.json`)
- Interlinear source data in `scripts/data/interlinear/OpenGNT_version3_3.csv`

### Data Flow

1. Core translations (KJV, SAV-KO), commentary (ko), section headings, and interlinear data are pre-built into `bible-core.db`
2. Additional translations are downloaded as JSON from GitHub releases via Tauri HTTP plugin
3. Downloaded JSON is batch-inserted (500 verses per batch) into the local SQLite database
4. Frontend queries SQLite through Tauri SQL plugin (`@tauri-apps/plugin-sql`)
5. Core vs downloaded translation routing handled by `CORE_TRANSLATIONS` set in `src/lib/downloadConfig.ts`

### Database Schema

Core tables: `translations`, `books`, `book_names`, `verses`, `original_texts`, `commentary`, `cross_references`, `feedback_queue`, `bookmarks`, `bookmark_labels`, `paragraph_breaks`, `section_headings`, `interlinear_words`. FTS5 virtual table `verses_fts` for full-text search. See `src-tauri/migrations/` for full schema.

## Key Conventions

- Package manager: **pnpm**
- TypeScript strict mode with `noUnusedLocals` and `noUnusedParameters`
- Korean (`ko`) is the default language
- Translation IDs follow the pattern: `kjv`, `sav-ko`, `hebrew`, `greek`, `asv`, `web`, `ylt`, etc.
- Book IDs are 1-66 (Genesis=1 through Revelation=66), matching standard Protestant canon order
- Bible verse JSON format: `{ translation_id, book_id, chapter, verse, text }`
- When adding new DB tables: create migration SQL file, register in `lib.rs` migrations vec, update `bible-core.db` via script, and update the live app db separately (existing installs won't re-copy bible-core.db)
- When adding i18n keys: update all 9 locale files
