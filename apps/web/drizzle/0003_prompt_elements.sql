CREATE TABLE `prompt_elements` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `prompt_elements_user_id_idx` ON `prompt_elements` (`user_id`);
--> statement-breakpoint
CREATE INDEX `prompt_elements_type_idx` ON `prompt_elements` (`type`);
