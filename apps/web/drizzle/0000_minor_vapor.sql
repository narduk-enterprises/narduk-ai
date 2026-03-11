CREATE TABLE `app_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`video_model` text DEFAULT 'grok-imagine-video' NOT NULL,
	`image_model` text DEFAULT 'grok-imagine-image' NOT NULL,
	`prompt_enhance_model` text DEFAULT 'grok-3-mini' NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `generations` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`mode` text NOT NULL,
	`prompt` text NOT NULL,
	`source_generation_id` text,
	`status` text DEFAULT 'pending' NOT NULL,
	`xai_request_id` text,
	`r2_key` text,
	`media_url` text,
	`thumbnail_url` text,
	`duration` integer,
	`aspect_ratio` text,
	`resolution` text,
	`metadata` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `generations_user_id_idx` ON `generations` (`user_id`);--> statement-breakpoint
CREATE INDEX `generations_status_idx` ON `generations` (`status`);--> statement-breakpoint
CREATE INDEX `generations_xai_request_id_idx` ON `generations` (`xai_request_id`);--> statement-breakpoint
CREATE TABLE `prompt_elements` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`type` text NOT NULL,
	`name` text NOT NULL,
	`content` text NOT NULL,
	`metadata` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `prompt_elements_user_id_idx` ON `prompt_elements` (`user_id`);--> statement-breakpoint
CREATE INDEX `prompt_elements_type_idx` ON `prompt_elements` (`type`);--> statement-breakpoint
CREATE TABLE `api_keys` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`name` text NOT NULL,
	`key_hash` text NOT NULL,
	`key_prefix` text NOT NULL,
	`last_used_at` text,
	`expires_at` integer,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `kv_cache` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text NOT NULL,
	`expires_at` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`expires_at` integer NOT NULL,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `todos` (
	`id` integer PRIMARY KEY AUTOINCREMENT NOT NULL,
	`user_id` text NOT NULL,
	`title` text NOT NULL,
	`completed` integer DEFAULT false,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`password_hash` text,
	`name` text,
	`apple_id` text,
	`is_admin` integer DEFAULT false,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `users_email_unique` ON `users` (`email`);--> statement-breakpoint
CREATE UNIQUE INDEX `users_apple_id_unique` ON `users` (`apple_id`);