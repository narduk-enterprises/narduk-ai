ALTER TABLE `quick_modifiers` ADD COLUMN `usage_count` integer DEFAULT 0 NOT NULL;
CREATE INDEX IF NOT EXISTS `quick_modifiers_usage_idx` ON `quick_modifiers` (`usage_count`);
