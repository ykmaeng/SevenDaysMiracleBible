-- Add verse text directly to bookmarks for resilience (no dependency on translation DB)
ALTER TABLE bookmarks ADD COLUMN text TEXT;
