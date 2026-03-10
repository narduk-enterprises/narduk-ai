CREATE TABLE `app_settings` (
	`id` integer PRIMARY KEY NOT NULL,
	`video_model` text DEFAULT 'grok-imagine-video' NOT NULL,
	`image_model` text DEFAULT 'grok-imagine-image' NOT NULL,
	`prompt_enhance_model` text DEFAULT 'grok-3-mini' NOT NULL,
	`updated_at` text NOT NULL
);
