-- Rename SAV translations
UPDATE translations SET name = '셀라 AI 한국어' WHERE id = 'sav-ko';
UPDATE translations SET name = 'Selah AI English' WHERE id = 'sav-en';

-- Add story bible translations
INSERT OR IGNORE INTO translations (id, name, language, description, is_original, is_ai_generated, downloaded, download_size_mb)
VALUES ('story-ko', '셀라 어린이 성경', 'ko', '5-10세 어린이를 위한 쉬운 한국어 이야기 성경', 0, 1, 0, 7.0);

INSERT OR IGNORE INTO translations (id, name, language, description, is_original, is_ai_generated, downloaded, download_size_mb)
VALUES ('story-en', "Selah Children's Bible", 'en', 'Simple Bible stories for children ages 5-10', 0, 1, 0, 6.5);
