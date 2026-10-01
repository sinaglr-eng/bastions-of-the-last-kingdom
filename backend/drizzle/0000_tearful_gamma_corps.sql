CREATE TABLE `request_limits` (
	`key` text PRIMARY KEY NOT NULL,
	`period` integer NOT NULL,
	`hits` integer NOT NULL
);
--> statement-breakpoint
CREATE TABLE `run_waves` (
	`run_id` text NOT NULL,
	`wave` integer NOT NULL,
	`snapshot_json` text NOT NULL,
	`sequence` integer NOT NULL,
	PRIMARY KEY(`run_id`, `wave`),
	FOREIGN KEY (`run_id`) REFERENCES `runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `runs` (
	`id` text PRIMARY KEY NOT NULL,
	`token_hash` text NOT NULL,
	`version` text NOT NULL,
	`mode` integer NOT NULL,
	`seed` text NOT NULL,
	`started_at` integer NOT NULL,
	`updated_at` integer NOT NULL,
	`finished_at` integer,
	`sequence` integer DEFAULT 0 NOT NULL,
	`outcome` text DEFAULT 'playing' NOT NULL,
	`score` integer DEFAULT 0 NOT NULL,
	`waves_survived` integer DEFAULT 0 NOT NULL,
	`duration_ms` integer DEFAULT 0 NOT NULL,
	`health` integer DEFAULT 30 NOT NULL,
	`kingdom_level` integer DEFAULT 1 NOT NULL,
	`gold` integer DEFAULT 0 NOT NULL,
	`name` text,
	`summary_json` text DEFAULT '{"draws":[],"decisions":[]}' NOT NULL
);
--> statement-breakpoint
CREATE INDEX `idx_runs_leaderboard` ON `runs` (`mode`,`version`,"score" DESC,`finished_at`,`id`) WHERE "runs"."name" IS NOT NULL;