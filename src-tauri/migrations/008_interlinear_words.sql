-- Word-by-word interlinear data for Greek NT (from OpenGNT)
CREATE TABLE IF NOT EXISTS interlinear_words (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  book_id INTEGER NOT NULL,
  chapter INTEGER NOT NULL,
  verse INTEGER NOT NULL,
  word_pos INTEGER NOT NULL,
  greek_word TEXT NOT NULL,
  lexeme TEXT NOT NULL,
  transliteration TEXT NOT NULL,
  morphology TEXT NOT NULL,
  strongs TEXT NOT NULL,
  gloss TEXT NOT NULL,
  UNIQUE (book_id, chapter, verse, word_pos),
  FOREIGN KEY (book_id) REFERENCES books(id)
);

CREATE INDEX IF NOT EXISTS idx_interlinear_lookup ON interlinear_words(book_id, chapter, verse);
