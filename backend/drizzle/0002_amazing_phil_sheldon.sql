CREATE TABLE `fr010_eligible` (
	`user_id` text NOT NULL,
	`achievement_id` text NOT NULL,
	`faction_id` text,
	`reward` integer NOT NULL,
	`verified_at` integer NOT NULL,
	`run_id` text,
	PRIMARY KEY(`user_id`, `achievement_id`),
	FOREIGN KEY (`user_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE no action,
	CONSTRAINT "fr010_eligible_positive_reward" CHECK("fr010_eligible"."reward">0)
);

--> statement-breakpoint
INSERT OR IGNORE INTO fr010_eligible(user_id,achievement_id,faction_id,reward,verified_at,run_id) SELECT user_id,achievement_id,faction_id,reward,created_at,NULL FROM fr010_grants;
