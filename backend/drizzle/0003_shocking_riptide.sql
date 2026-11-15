CREATE TABLE `account_progression` (
	`user_id` text PRIMARY KEY NOT NULL,
	`xp_total` integer DEFAULT 0 NOT NULL,
	`credited_waves` integer DEFAULT 0 NOT NULL,
	`permanent_json` text DEFAULT '{}' NOT NULL,
	`migrated` integer DEFAULT 0 NOT NULL,
	`diagnostics_json` text DEFAULT '[]' NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "account_xp_nonnegative" CHECK("account_progression"."xp_total">=0),
	CONSTRAINT "account_waves_nonnegative" CHECK("account_progression"."credited_waves">=0)
);
--> statement-breakpoint
CREATE TABLE `account_run_progression` (
	`user_id` text NOT NULL,
	`run_id` text NOT NULL,
	`paid_waves` integer DEFAULT 0 NOT NULL,
	`paid_bosses_json` text DEFAULT '[]' NOT NULL,
	PRIMARY KEY(`user_id`, `run_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`run_id`) REFERENCES `fr010_runs`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `account_xp_ledger` (
	`user_id` text NOT NULL,
	`source_id` text NOT NULL,
	`amount` integer NOT NULL,
	`created_at` integer NOT NULL,
	PRIMARY KEY(`user_id`, `source_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `account_xp_receipts` (
	`user_id` text NOT NULL,
	`receipt_id` text NOT NULL,
	`run_id` text NOT NULL,
	`receipt_json` text NOT NULL,
	`acknowledged` integer DEFAULT 0 NOT NULL,
	PRIMARY KEY(`user_id`, `receipt_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`run_id`) REFERENCES `fr010_runs`(`id`) ON UPDATE no action ON DELETE no action
);
