CREATE TABLE progression_resets (
 id TEXT PRIMARY KEY NOT NULL,
 completed_at INTEGER NOT NULL DEFAULT 0,
 scope_json TEXT NOT NULL
);
CREATE TRIGGER account_xp_reject_pre_reset BEFORE INSERT ON account_xp_ledger
WHEN NEW.source_id LIKE 'run:%' AND EXISTS (
 SELECT 1 FROM fr010_runs r JOIN progression_resets p
 ON p.id='20261115-approved-fresh-start' AND p.completed_at>0
 WHERE r.id=substr(NEW.source_id,5,36) AND (r.started_at<p.completed_at OR r.outcome='reset')
)
BEGIN SELECT RAISE(ABORT,'Account progress reset'); END;
