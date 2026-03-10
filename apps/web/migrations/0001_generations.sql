-- Generations table: tracks all AI-generated images and videos
CREATE TABLE IF NOT EXISTS `generations` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL REFERENCES `users`(`id`) ON DELETE CASCADE,
  `type` text NOT NULL,
  `mode` text NOT NULL,
  `prompt` text NOT NULL,
  `source_generation_id` text,
  `status` text NOT NULL DEFAULT 'pending',
  `xai_request_id` text,
  `r2_key` text,
  `media_url` text,
  `duration` integer,
  `aspect_ratio` text,
  `resolution` text,
  `metadata` text,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL
);

CREATE INDEX IF NOT EXISTS `generations_user_id_idx` ON `generations` (`user_id`);
CREATE INDEX IF NOT EXISTS `generations_status_idx` ON `generations` (`status`);
CREATE INDEX IF NOT EXISTS `generations_xai_request_id_idx` ON `generations` (`xai_request_id`);
