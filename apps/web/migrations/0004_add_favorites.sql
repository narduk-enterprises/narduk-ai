-- Add favorites support to generations
ALTER TABLE generations ADD COLUMN is_favorite INTEGER NOT NULL DEFAULT 0;

-- Index for filtering favorites efficiently
CREATE INDEX generations_user_favorite_idx ON generations(user_id, is_favorite);
