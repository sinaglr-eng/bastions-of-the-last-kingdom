CREATE TABLE `account` (
	`id` text PRIMARY KEY NOT NULL,
	`accountId` text NOT NULL,
	`providerId` text NOT NULL,
	`userId` text NOT NULL,
	`accessToken` text,
	`refreshToken` text,
	`idToken` text,
	`accessTokenExpiresAt` integer,
	`refreshTokenExpiresAt` integer,
	`scope` text,
	`password` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE INDEX `account_userId_idx` ON `account` (`userId`);--> statement-breakpoint
CREATE TABLE `fr010_active` (
	`user_id` text PRIMARY KEY NOT NULL,
	`run_id` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`run_id`) REFERENCES `fr010_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `fr010_batches` (
	`run_id` text NOT NULL,
	`sequence` integer NOT NULL,
	`batch_id` text NOT NULL,
	`digest` text NOT NULL,
	`commands_json` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`run_id`, `sequence`),
	FOREIGN KEY (`run_id`) REFERENCES `fr010_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `fr010_batch_identity` ON `fr010_batches` (`run_id`,`batch_id`);--> statement-breakpoint
CREATE TABLE `fr010_grants` (
	`user_id` text NOT NULL,
	`achievement_id` text NOT NULL,
	`faction_id` text,
	`reward` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `achievement_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "fr010_positive_reward" CHECK("fr010_grants"."reward">0)
);
--> statement-breakpoint
CREATE TABLE `fr010_ledger` (
	`user_id` text NOT NULL,
	`entry_id` text NOT NULL,
	`amount` integer NOT NULL,
	`kind` text NOT NULL,
	`detail` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `entry_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `fr010_profiles` (
	`user_id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`balance` integer DEFAULT 0 NOT NULL,
	`skills_json` text DEFAULT '{}' NOT NULL,
	`equipped_json` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "fr010_nonnegative_balance" CHECK("fr010_profiles"."balance" >= 0)
);
--> statement-breakpoint
CREATE TABLE `fr010_runs` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`faction_id` text NOT NULL,
	`ruleset` text NOT NULL,
	`seed` integer NOT NULL,
	`sequence` integer DEFAULT 0 NOT NULL,
	`last_batch` text,
	`outcome` text DEFAULT 'playing' NOT NULL,
	`snapshot_json` text NOT NULL,
	`loadout_json` text NOT NULL,
	`score_text` text DEFAULT '0' NOT NULL,
	`score_digits` integer DEFAULT 1 NOT NULL,
	`highest_wave` integer DEFAULT 0 NOT NULL,
	`progress_json` text DEFAULT '{}' NOT NULL,
	`started_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`finished_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `fr010_standings` ON `fr010_runs` (`ruleset`,`faction_id`,`outcome`,"score_digits" DESC,"score_text" DESC,"highest_wave" DESC,`finished_at`,`id`);--> statement-breakpoint
CREATE UNIQUE INDEX `fr010_one_active_run` ON `fr010_runs` (`user_id`) WHERE "fr010_runs"."outcome"='playing';--> statement-breakpoint
CREATE TABLE `session` (
	`id` text PRIMARY KEY NOT NULL,
	`expiresAt` integer NOT NULL,
	`token` text NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL,
	`ipAddress` text,
	`userAgent` text,
	`userId` text NOT NULL,
	FOREIGN KEY (`userId`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
CREATE UNIQUE INDEX `session_token_unique` ON `session` (`token`);--> statement-breakpoint
CREATE INDEX `session_userId_idx` ON `session` (`userId`);--> statement-breakpoint
CREATE TABLE `user` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`email` text NOT NULL,
	`emailVerified` integer NOT NULL,
	`image` text,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE UNIQUE INDEX `user_email_unique` ON `user` (`email`);--> statement-breakpoint
CREATE TABLE `verification` (
	`id` text PRIMARY KEY NOT NULL,
	`identifier` text NOT NULL,
	`value` text NOT NULL,
	`expiresAt` integer NOT NULL,
	`createdAt` integer NOT NULL,
	`updatedAt` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `verification_identifier_idx` ON `verification` (`identifier`);