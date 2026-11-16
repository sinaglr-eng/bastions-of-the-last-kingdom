CREATE TABLE `artifact_accounts` (
	`user_id` text PRIMARY KEY NOT NULL,
	`revision` integer DEFAULT 0 NOT NULL,
	`dust` integer DEFAULT 0 NOT NULL,
	`owned_json` text DEFAULT '[]' NOT NULL,
	`equipment_json` text DEFAULT '{}' NOT NULL,
	`presets_json` text DEFAULT '[]' NOT NULL,
	`pity_json` text DEFAULT '{}' NOT NULL,
	`highest_tier` integer DEFAULT 0 NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "artifact_dust_nonnegative" CHECK("artifact_accounts"."dust">=0)
);
--> statement-breakpoint
CREATE TABLE `artifact_chests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`run_id` text NOT NULL,
	`boss_spawn_id` integer NOT NULL,
	`boss_id` text NOT NULL,
	`wave` integer NOT NULL,
	`tier` integer NOT NULL,
	`seed` integer NOT NULL,
	`status` text NOT NULL,
	`earned_at` integer NOT NULL,
	`opened_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	FOREIGN KEY (`run_id`) REFERENCES `fr010_runs`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "artifact_chest_tier" CHECK("artifact_chests"."tier" BETWEEN 1 AND 5),
	CONSTRAINT "artifact_chest_status" CHECK("artifact_chests"."status" IN ('locked','ready','opened'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `artifact_chest_spawn` ON `artifact_chests` (`run_id`,`boss_spawn_id`);--> statement-breakpoint
CREATE INDEX `artifact_chests_owner` ON `artifact_chests` (`user_id`,`status`,`tier`,`earned_at`,`id`);--> statement-breakpoint
CREATE TABLE `artifact_receipts` (
	`user_id` text NOT NULL,
	`request_id` text NOT NULL,
	`signature` text NOT NULL,
	`receipt_json` text NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `request_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade
);
--> statement-breakpoint
ALTER TABLE `fr010_runs` ADD `artifact_loadout_json` text DEFAULT '{}' NOT NULL;