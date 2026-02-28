# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

SevenDaysMiracleBible — a desktop Bible reader app built with **Tauri 2 + React 19 + TypeScript**. It bundles a core SQLite database with KJV and AI-Korean translations, and allows users to download additional translations on demand from GitHub releases.

## Development Commands

```bash
pnpm dev                    # Vite dev server (port 1420)
pnpm tauri dev              # Full Tauri app with hot reload
pnpm build                  # tsc + vite build (frontend only)
pnpm tauri build            # Full production app bundle
pnpm build:db               # Build full bible.db from scripts/data/output/*.json
pnpm build:db:core          # Build bible-core.db (kjv + ai-ko only, bundled with app)
pnpm build:release-assets   # Generate release JSON files for downloadable translations
```

Scripts run via `tsx` (TypeScript executor). Bible data scripts are in `scripts/`.

## Architecture

### Frontend (`src/`)

React SPA rendered inside Tauri's webview. Three top-level views controlled by `App.tsx`: **reader**, **downloads**, **settings**.

- **Components** organized by feature: `BibleReader/`, `Navigation/`, `Settings/`, `TabBar/`, `Commentary/`, `Feedback/`
- **State**: Zustand stores with Immer middleware in `src/stores/`
  - `settingsStore` — language, fontSize, theme, defaultTranslation, parallelTranslations (persisted to localStorage as `"bible-settings"`)
  - `tabStore` — multi-tab reader state with independent scroll positions (persisted as `"bible-tabs"`)
  - `downloadStore` — runtime-only download progress tracking
- **Data access**: `src/lib/db.ts` wraps Tauri SQL plugin; `src/lib/bible.ts` provides typed query functions (getChapter, getBooks, searchVerses, etc.)
- **i18n**: i18next with 4 locales (`src/i18n/locales/` — ko, en, zh, es), browser language detection
- **Types**: All interfaces in `src/types/bible.ts` (Translation, Verse, Book, BookName, etc.)
- **Styling**: Tailwind CSS 4 via Vite plugin

### Backend (`src-tauri/`)

Rust/Tauri 2 shell. Minimal custom Rust code — most logic is in the frontend.

- `lib.rs` initializes Tauri plugins: SQL (SQLite), HTTP, FS, Opener
- SQLite schema in `migrations/` (001_create_schema.sql, 002_seed_books.sql)
- `resources/bible-core.db` is bundled with the app and copied to the app data directory on first run

### Data Pipeline (`scripts/`)

- `build-bible-db.ts` — reads JSON from `scripts/data/output/` and creates SQLite databases
- `generate-ai-translation.ts` / `translate-bible-ko.ts` — AI-powered Korean translation generation
- `generate-ai-commentary.ts` — AI commentary generation
- `build-release-assets.ts` — creates per-translation JSON files for GitHub releases
- Translation data files live in `scripts/data/output/` (e.g., `ai-ko.json`, `kjv.json`)

### Data Flow

1. Core translations (KJV, AI-Korean) are pre-built into `bible-core.db` and bundled with the app
2. Additional translations are downloaded as JSON from GitHub releases via Tauri HTTP plugin
3. Downloaded JSON is batch-inserted (500 verses per batch) into the local SQLite database
4. Frontend queries SQLite through Tauri SQL plugin (`@tauri-apps/plugin-sql`)
5. User feedback (verse votes) queues locally in `feedback_queue` table and syncs to Supabase

### Database Schema

Core tables: `translations`, `books`, `book_names`, `verses`, `original_texts`, `commentary`, `cross_references`, `feedback_queue`, `bookmarks`. FTS5 virtual table `verses_fts` for full-text search. See `src-tauri/migrations/001_create_schema.sql` for full schema.

## Key Conventions

- Package manager: **pnpm**
- TypeScript strict mode with `noUnusedLocals` and `noUnusedParameters`
- Korean (`ko`) is the default language
- Translation IDs follow the pattern: `kjv`, `ai-ko`, `hebrew`, `greek`, `asv`, `web`, `ylt`, etc.
- Book IDs are 1-66 (Genesis=1 through Revelation=66), matching standard Protestant canon order
- Bible verse JSON format: `{ translation_id, book_id, chapter, verse, text }`
