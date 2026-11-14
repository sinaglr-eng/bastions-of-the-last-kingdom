-- Eligibility is separate from the existing paid grants and wallet ledger.
CREATE TABLE IF NOT EXISTS fr010_eligible (
 user_id TEXT NOT NULL REFERENCES user(id),
 achievement_id TEXT NOT NULL,
 faction_id TEXT,
 reward INTEGER NOT NULL CHECK(reward > 0),
 verified_at INTEGER NOT NULL,
 run_id TEXT,
 PRIMARY KEY(user_id, achievement_id)
);
-- Existing grants have already been paid. Preserve their dates and balances.
INSERT OR IGNORE INTO fr010_eligible(user_id,achievement_id,faction_id,reward,verified_at,run_id)
 SELECT user_id,achievement_id,faction_id,reward,created_at,NULL FROM fr010_grants;
