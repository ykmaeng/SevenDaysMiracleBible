-- Ensure core translations are marked as downloaded
UPDATE translations SET downloaded = 1 WHERE id IN ('kjv', 'sav-ko');

-- Update download sizes to actual file sizes
UPDATE translations SET download_size_mb = 6.0 WHERE id = 'kjv';
UPDATE translations SET download_size_mb = 6.0 WHERE id = 'asv';
UPDATE translations SET download_size_mb = 6.2 WHERE id = 'web';
UPDATE translations SET download_size_mb = 6.1 WHERE id = 'bbe';
UPDATE translations SET download_size_mb = 7.3 WHERE id = 'sav-ko';
UPDATE translations SET download_size_mb = 5.4 WHERE id = 'cuv';
UPDATE translations SET download_size_mb = 5.9 WHERE id = 'rv1909';
UPDATE translations SET download_size_mb = 7.6 WHERE id = 'hebrew';
UPDATE translations SET download_size_mb = 2.3 WHERE id = 'greek';
UPDATE translations SET download_size_mb = 6.0 WHERE id = 'darby';
UPDATE translations SET download_size_mb = 6.0 WHERE id = 'ylt';
UPDATE translations SET download_size_mb = 11.4 WHERE id = 'korrv';
UPDATE translations SET download_size_mb = 6.4 WHERE id = 'nkrv';
UPDATE translations SET download_size_mb = 7.5 WHERE id = 'japkougo';
UPDATE translations SET download_size_mb = 6.6 WHERE id = 'gerelb';
UPDATE translations SET download_size_mb = 7.5 WHERE id = 'frecrampon';
UPDATE translations SET download_size_mb = 6.3 WHERE id = 'porblivre';
UPDATE translations SET download_size_mb = 9.6 WHERE id = 'russynodal';
