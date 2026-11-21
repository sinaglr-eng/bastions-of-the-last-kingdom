CREATE TABLE `rank_chests` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`rank_level` integer NOT NULL,
	`ordinal` integer NOT NULL,
	`tier` integer NOT NULL,
	`seed` integer NOT NULL,
	`earned_at` integer NOT NULL,
	`opened_at` integer,
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE cascade,
	CONSTRAINT "rank_chests_level" CHECK("rank_chests"."rank_level" BETWEEN 2 AND 15),
	CONSTRAINT "rank_chests_ordinal" CHECK("rank_chests"."ordinal" BETWEEN 1 AND 3),
	CONSTRAINT "rank_chests_tier" CHECK("rank_chests"."tier" BETWEEN 1 AND 5)
);
--> statement-breakpoint
CREATE UNIQUE INDEX `rank_chests_reward` ON `rank_chests` (`user_id`,`rank_level`,`ordinal`);--> statement-breakpoint
CREATE INDEX `rank_chests_owner` ON `rank_chests` (`user_id`,`opened_at`,`tier`,`earned_at`,`id`);