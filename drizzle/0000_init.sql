CREATE TABLE `brand_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`brand_name` text DEFAULT '' NOT NULL,
	`voice` text DEFAULT '' NOT NULL,
	`language` text DEFAULT 'English' NOT NULL,
	`preset` text DEFAULT 'clean' NOT NULL,
	`shopify_store` text DEFAULT '' NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE TABLE `page_messages` (
	`id` text PRIMARY KEY NOT NULL,
	`page_id` text NOT NULL,
	`section_id` text NOT NULL,
	`role` text NOT NULL,
	`text` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `page_messages_page` ON `page_messages` (`page_id`);--> statement-breakpoint
CREATE TABLE `pages` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`product_id` text NOT NULL,
	`type` text NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`language` text NOT NULL,
	`preset` text NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`sections` text DEFAULT '[]' NOT NULL,
	`shopify_page_id` text,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `pages_slug_unique` ON `pages` (`slug`);--> statement-breakpoint
CREATE INDEX `pages_owner` ON `pages` (`owner_id`);--> statement-breakpoint
CREATE INDEX `pages_product` ON `pages` (`product_id`);--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`price_cents` integer NOT NULL,
	`currency` text NOT NULL,
	`description` text DEFAULT '' NOT NULL,
	`image_key` text,
	`buy_url` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `products_owner` ON `products` (`owner_id`);--> statement-breakpoint
CREATE TABLE `quiz_products` (
	`quiz_id` text NOT NULL,
	`product_id` text NOT NULL
);
--> statement-breakpoint
CREATE INDEX `quiz_products_quiz` ON `quiz_products` (`quiz_id`);--> statement-breakpoint
CREATE INDEX `quiz_products_product` ON `quiz_products` (`product_id`);--> statement-breakpoint
CREATE TABLE `quiz_responses` (
	`id` text PRIMARY KEY NOT NULL,
	`quiz_id` text NOT NULL,
	`result_product_id` text NOT NULL,
	`answers` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `quiz_responses_quiz` ON `quiz_responses` (`quiz_id`);--> statement-breakpoint
CREATE TABLE `quizzes` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`title` text NOT NULL,
	`slug` text NOT NULL,
	`intro` text DEFAULT '' NOT NULL,
	`status` text DEFAULT 'draft' NOT NULL,
	`questions` text DEFAULT '[]' NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL,
	`updated_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `quizzes_slug_unique` ON `quizzes` (`slug`);--> statement-breakpoint
CREATE INDEX `quizzes_owner` ON `quizzes` (`owner_id`);--> statement-breakpoint
CREATE TABLE `saved_sections` (
	`id` text PRIMARY KEY NOT NULL,
	`owner_id` text NOT NULL,
	`name` text NOT NULL,
	`kind` text NOT NULL,
	`content` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
--> statement-breakpoint
CREATE INDEX `saved_sections_owner` ON `saved_sections` (`owner_id`);--> statement-breakpoint
CREATE TABLE `users` (
	`id` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`created_at` text DEFAULT (current_timestamp) NOT NULL
);
