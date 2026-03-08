-- Paragraph breaks and section headings for structured Bible reading
CREATE TABLE IF NOT EXISTS paragraph_breaks (
  book_id INTEGER NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  PRIMARY KEY (book_id, chapter, verse)
);

CREATE TABLE IF NOT EXISTS section_headings (
  book_id INTEGER NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  title_ko TEXT,
  title_en TEXT,
  PRIMARY KEY (book_id, chapter, verse)
);
