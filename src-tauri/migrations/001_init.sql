-- Consolidated initial schema for Selah Bible app

-- Translation metadata
CREATE TABLE IF NOT EXISTS translations (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  language TEXT NOT NULL,
  description TEXT,
  is_original INTEGER DEFAULT 0,
  is_ai_generated INTEGER DEFAULT 0,
  downloaded INTEGER DEFAULT 0,
  download_size_mb REAL,
  version INTEGER DEFAULT 1
);

-- Bible books (66 books)
CREATE TABLE IF NOT EXISTS books (
  id INTEGER PRIMARY KEY,
  testament TEXT NOT NULL,
  chapters INTEGER NOT NULL
);

-- Book names (multilingual)
CREATE TABLE IF NOT EXISTS book_names (
  book_id INTEGER NOT NULL,
  language TEXT NOT NULL,
  name TEXT NOT NULL,
  abbreviation TEXT NOT NULL,
  PRIMARY KEY (book_id, language),
  FOREIGN KEY (book_id) REFERENCES books(id)
);

-- Original texts (Hebrew/Greek)
CREATE TABLE IF NOT EXISTS original_texts (
  book_id INTEGER NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  hebrew_text TEXT,
  greek_text TEXT,
  transliteration TEXT,
  strongs_numbers TEXT,
  PRIMARY KEY (book_id, chapter, verse),
  FOREIGN KEY (book_id) REFERENCES books(id)
);

-- Cross references
CREATE TABLE IF NOT EXISTS cross_references (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  from_book INTEGER NOT NULL,
  from_chapter INTEGER NOT NULL,
  from_verse INTEGER NOT NULL,
  to_book INTEGER NOT NULL,
  to_chapter_start INTEGER NOT NULL,
  to_verse_start INTEGER NOT NULL,
  to_chapter_end INTEGER,
  to_verse_end INTEGER,
  votes INTEGER DEFAULT 0
);

-- User feedback queue (local)
CREATE TABLE IF NOT EXISTS feedback_queue (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  translation_id TEXT NOT NULL,
  vote INTEGER NOT NULL,
  synced INTEGER DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Bookmark labels
CREATE TABLE IF NOT EXISTS bookmark_labels (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  name TEXT NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- User bookmarks and highlights
CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  note TEXT,
  color TEXT,
  translation_id TEXT,
  label_id INTEGER REFERENCES bookmark_labels(id) ON DELETE SET NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Paragraph breaks for structured reading
CREATE TABLE IF NOT EXISTS paragraph_breaks (
  book_id INTEGER NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  PRIMARY KEY (book_id, chapter, verse)
);

-- Section headings for structured reading
CREATE TABLE IF NOT EXISTS section_headings (
  book_id INTEGER NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  title_ko TEXT,
  title_en TEXT,
  PRIMARY KEY (book_id, chapter, verse)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_crossref_from ON cross_references(from_book, from_chapter, from_verse);
CREATE INDEX IF NOT EXISTS idx_feedback_sync ON feedback_queue(synced);

-- Seed 66 books
INSERT OR IGNORE INTO books (id, testament, chapters) VALUES
(1, 'OT', 50), (2, 'OT', 40), (3, 'OT', 27), (4, 'OT', 36), (5, 'OT', 34),
(6, 'OT', 24), (7, 'OT', 21), (8, 'OT', 4), (9, 'OT', 31), (10, 'OT', 24),
(11, 'OT', 22), (12, 'OT', 25), (13, 'OT', 29), (14, 'OT', 36), (15, 'OT', 10),
(16, 'OT', 13), (17, 'OT', 10), (18, 'OT', 42), (19, 'OT', 150), (20, 'OT', 31),
(21, 'OT', 12), (22, 'OT', 8), (23, 'OT', 66), (24, 'OT', 52), (25, 'OT', 5),
(26, 'OT', 48), (27, 'OT', 12), (28, 'OT', 14), (29, 'OT', 3), (30, 'OT', 9),
(31, 'OT', 1), (32, 'OT', 4), (33, 'OT', 7), (34, 'OT', 3), (35, 'OT', 3),
(36, 'OT', 3), (37, 'OT', 2), (38, 'OT', 14), (39, 'OT', 4),
(40, 'NT', 28), (41, 'NT', 16), (42, 'NT', 24), (43, 'NT', 21), (44, 'NT', 28),
(45, 'NT', 16), (46, 'NT', 16), (47, 'NT', 13), (48, 'NT', 6), (49, 'NT', 6),
(50, 'NT', 4), (51, 'NT', 4), (52, 'NT', 5), (53, 'NT', 3), (54, 'NT', 6),
(55, 'NT', 4), (56, 'NT', 3), (57, 'NT', 1), (58, 'NT', 13), (59, 'NT', 5),
(60, 'NT', 5), (61, 'NT', 3), (62, 'NT', 5), (63, 'NT', 1), (64, 'NT', 1),
(65, 'NT', 1), (66, 'NT', 22);

-- Seed available translations (7 translations)
INSERT OR IGNORE INTO translations (id, name, language, description, is_original, is_ai_generated, downloaded, download_size_mb) VALUES
('kjv', 'King James Version', 'en', 'The authorized King James Version (1611)', 0, 0, 1, 6.0),
('sav-ko', 'SAV 한국어', 'ko', 'Selah AI Version - 원문 기반 AI 번역', 0, 1, 1, 7.3),
('web', 'World English Bible', 'en', 'World English Bible - Public Domain', 0, 0, 0, 6.2),
('nkrv', '개역개정', 'ko', '개역개정판 (1998)', 0, 0, 0, 6.4),
('korrv', '개역한글', 'ko', '개역한글판 (1961)', 0, 0, 0, 11.4),
('hebrew', 'Westminster Leningrad Codex', 'he', 'Hebrew Old Testament (WLC)', 1, 0, 0, 7.6),
('greek', 'Open Greek New Testament', 'el', 'Greek New Testament (OpenGNT)', 1, 0, 0, 2.3);
