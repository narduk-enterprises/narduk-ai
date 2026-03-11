CREATE TABLE `user_prompts` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`prompt` text NOT NULL,
	`initial_presets` text,
	`chat_history` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `user_prompts_user_id_idx` ON `user_prompts` (`user_id`);--> statement-breakpoint
ALTER TABLE `generations` ADD `prompt_elements` text;--> statement-breakpoint
ALTER TABLE `generations` ADD `user_prompt_id` text REFERENCES user_prompts(id);