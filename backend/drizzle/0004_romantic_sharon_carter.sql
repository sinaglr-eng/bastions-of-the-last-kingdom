CREATE TABLE `progression_resets` (
	`id` text PRIMARY KEY NOT NULL,
	`completed_at` integer DEFAULT 0 NOT NULL,
	`scope_json` text NOT NULL
);

--> statement-breakpoint
CREATE TRIGGER account_xp_reject_pre_reset BEFORE INSERT ON account_xp_ledger
WHEN NEW.source_id LIKE 'run:%' AND EXISTS (
 SELECT 1 FROM fr010_runs r JOIN progression_resets p
 ON p.id='20261115-approved-fresh-start' AND p.completed_at>0
 WHERE r.id=substr(NEW.source_id,5,36) AND (r.started_at<p.completed_at OR r.outcome='reset')
)
BEGIN SELECT RAISE(ABORT,'Account progress reset'); END;
