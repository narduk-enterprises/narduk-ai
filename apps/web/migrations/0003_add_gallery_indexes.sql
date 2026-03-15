-- Composite indexes for gallery query performance
-- Covers: default sort (userId + createdAt), delta polls (userId + updatedAt),
-- and pending-video lookups (userId + status + type).
CREATE INDEX IF NOT EXISTS `generations_user_created_idx` ON `generations` (`user_id`, `created_at`);
CREATE INDEX IF NOT EXISTS `generations_user_updated_idx` ON `generations` (`user_id`, `updated_at`);
CREATE INDEX IF NOT EXISTS `generations_user_status_type_idx` ON `generations` (`user_id`, `status`, `type`);
