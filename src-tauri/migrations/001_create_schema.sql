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

-- Bible verses (core table)
CREATE TABLE IF NOT EXISTS verses (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  translation_id TEXT NOT NULL,
  book_id INTEGER NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  text TEXT NOT NULL,
  UNIQUE (translation_id, book_id, chapter, verse),
  FOREIGN KEY (translation_id) REFERENCES translations(id),
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

-- AI Commentary (per chapter)
CREATE TABLE IF NOT EXISTS commentary (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER,
  language TEXT NOT NULL,
  content TEXT NOT NULL,
  model_version TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (book_id, chapter, verse, language),
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

-- User bookmarks/notes
CREATE TABLE IF NOT EXISTS bookmarks (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  note TEXT,
  color TEXT,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Full-text search
CREATE VIRTUAL TABLE IF NOT EXISTS verses_fts USING fts5(
  text, content=verses, content_rowid=id, tokenize='unicode61'
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_verses_lookup ON verses(translation_id, book_id, chapter);
CREATE INDEX IF NOT EXISTS idx_commentary_lookup ON commentary(book_id, chapter, language);
CREATE INDEX IF NOT EXISTS idx_crossref_from ON cross_references(from_book, from_chapter, from_verse);
CREATE INDEX IF NOT EXISTS idx_feedback_sync ON feedback_queue(synced);
