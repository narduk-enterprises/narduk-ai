CREATE TABLE `lucky_prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`prompt` text NOT NULL,
	`media_type` text NOT NULL,
	`presets` text NOT NULL,
	`preset_content` text NOT NULL,
	`consumed` integer DEFAULT 0 NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `lucky_prompts_user_avail_idx` ON `lucky_prompts` (`user_id`,`consumed`);