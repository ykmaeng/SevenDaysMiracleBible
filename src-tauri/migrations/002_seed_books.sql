-- Seed 66 books with chapter counts
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

-- Seed available translations
INSERT OR IGNORE INTO translations (id, name, language, description, is_original, is_ai_generated, downloaded, download_size_mb) VALUES
('kjv', 'King James Version', 'en', 'The authorized King James Version (1611)', 0, 0, 1, 6.0),
('asv', 'American Standard Version', 'en', 'American Standard Version (1901)', 0, 0, 0, 6.0),
('web', 'World English Bible', 'en', 'World English Bible - Public Domain', 0, 0, 0, 6.2),
('bbe', 'Bible in Basic English', 'en', 'Bible in Basic English (1965)', 0, 0, 0, 6.1),
('sav-ko', 'SAV 한국어', 'ko', 'Selah AI Version - 원문 기반 AI 번역', 0, 1, 1, 7.3),
('cuv', '和合本', 'zh', 'Chinese Union Version (1919)', 0, 0, 0, 5.4),
('rv1909', 'Reina-Valera 1909', 'es', 'Reina-Valera 1909 - Dominio Público', 0, 0, 0, 5.9),
('hebrew', 'Westminster Leningrad Codex', 'he', 'Hebrew Old Testament (WLC)', 1, 0, 0, 7.6),
('greek', 'Open Greek New Testament', 'el', 'Greek New Testament (OpenGNT)', 1, 0, 0, 2.3),
('darby', 'Darby Translation', 'en', 'John Nelson Darby Translation (1890)', 0, 0, 0, 6.0),
('ylt', "Young's Literal Translation", 'en', "Young's Literal Translation (1862)", 0, 0, 0, 6.0),
('korrv', '개역한글', 'ko', '개역한글판 (1961)', 0, 0, 0, 11.4),
('nkrv', '개역개정', 'ko', '개역개정판 (1998)', 0, 0, 0, 6.4),
('japkougo', '口語訳聖書', 'ja', '口語訳聖書 (1955)', 0, 0, 0, 7.5),
('gerelb', 'Elberfelder Bibel', 'de', 'Elberfelder Übersetzung (1905)', 0, 0, 0, 6.6),
('frecrampon', 'Bible Crampon', 'fr', 'Traduction Crampon (1923)', 0, 0, 0, 7.5),
('porblivre', 'Bíblia Livre', 'pt', 'Bíblia Livre - Domínio Público', 0, 0, 0, 6.3),
('russynodal', 'Синодальный перевод', 'ru', 'Синодальный перевод (1876)', 0, 0, 0, 9.6);
