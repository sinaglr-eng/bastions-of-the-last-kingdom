CREATE TABLE `season_chests` (
	`id` text PRIMARY KEY NOT NULL,
	`season` text NOT NULL,
	`user_id` text NOT NULL,
	`tier` integer NOT NULL,
	`seed` integer NOT NULL,
	`earned_at` integer NOT NULL,
	`opened_at` integer,
	FOREIGN KEY (`season`) REFERENCES `season_settlements`(`season`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "season_chests_tier" CHECK("season_chests"."tier" IN (4,5))
);
--> statement-breakpoint
CREATE INDEX `season_chests_owner` ON `season_chests` (`user_id`,`opened_at`,`tier`,`earned_at`,`id`);--> statement-breakpoint
CREATE TABLE `season_rewards` (
	`season` text NOT NULL,
	`user_id` text NOT NULL,
	`rank` integer NOT NULL,
	`run_id` text NOT NULL,
	`legendary` integer NOT NULL,
	`epic` integer NOT NULL,
	`aquamarine` integer NOT NULL,
	`emerald` integer NOT NULL,
	`dust` integer NOT NULL,
	PRIMARY KEY(`season`, `user_id`),
	FOREIGN KEY (`season`) REFERENCES `season_settlements`(`season`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "season_rewards_top_ten" CHECK("season_rewards"."rank" BETWEEN 1 AND 10)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `season_rewards_rank` ON `season_rewards` (`season`,`rank`);--> statement-breakpoint
CREATE TABLE `season_settlements` (
	`season` text PRIMARY KEY NOT NULL,
	`token` text NOT NULL,
	`settled_at` integer NOT NULL
);
--> statement-breakpoint
CREATE INDEX `fr010_season_finish` ON `fr010_runs` (COALESCE(finished_at,updated_at)) WHERE "fr010_runs"."outcome" IN ('lost','won');