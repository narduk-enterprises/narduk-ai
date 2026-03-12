ALTER TABLE `generations` ADD `comparison_score` integer DEFAULT 1000 NOT NULL;
ALTER TABLE `generations` ADD `comparison_wins` integer DEFAULT 0 NOT NULL;
ALTER TABLE `generations` ADD `comparison_losses` integer DEFAULT 0 NOT NULL;
ALTER TABLE `generations` ADD `last_compared_at` text;

CREATE INDEX `generations_comparison_score_idx` ON `generations` (`comparison_score`);

CREATE TABLE `image_comparisons` (
  `id` text PRIMARY KEY NOT NULL,
  `user_id` text NOT NULL,
  `pair_key` text NOT NULL,
  `left_generation_id` text NOT NULL,
  `right_generation_id` text NOT NULL,
  `winner_generation_id` text NOT NULL,
  `loser_generation_id` text NOT NULL,
  `source_context` text NOT NULL,
  `created_at` text NOT NULL,
  `updated_at` text NOT NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`left_generation_id`) REFERENCES `generations`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`right_generation_id`) REFERENCES `generations`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`winner_generation_id`) REFERENCES `generations`(`id`) ON UPDATE no action ON DELETE cascade,
  FOREIGN KEY (`loser_generation_id`) REFERENCES `generations`(`id`) ON UPDATE no action ON DELETE cascade
);

CREATE UNIQUE INDEX `image_comparisons_user_pair_key_idx`
  ON `image_comparisons` (`user_id`, `pair_key`);
CREATE INDEX `image_comparisons_user_id_idx`
  ON `image_comparisons` (`user_id`);
CREATE INDEX `image_comparisons_winner_generation_id_idx`
  ON `image_comparisons` (`winner_generation_id`);
CREATE INDEX `image_comparisons_created_at_idx`
  ON `image_comparisons` (`created_at`);
