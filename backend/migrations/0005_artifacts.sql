CREATE TABLE artifact_accounts (
 user_id TEXT PRIMARY KEY NOT NULL REFERENCES user(id) ON DELETE CASCADE,
 revision INTEGER NOT NULL DEFAULT 0, dust INTEGER NOT NULL DEFAULT 0 CHECK(dust>=0),
 owned_json TEXT NOT NULL DEFAULT '[]', equipment_json TEXT NOT NULL DEFAULT '{}',
 presets_json TEXT NOT NULL DEFAULT '[]', pity_json TEXT NOT NULL DEFAULT '{}', highest_tier INTEGER NOT NULL DEFAULT 0
);
CREATE TABLE artifact_chests (
 id TEXT PRIMARY KEY NOT NULL,user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
 run_id TEXT NOT NULL REFERENCES fr010_runs(id) ON DELETE CASCADE,boss_spawn_id INTEGER NOT NULL,boss_id TEXT NOT NULL,wave INTEGER NOT NULL,
 tier INTEGER NOT NULL CHECK(tier BETWEEN 1 AND 5),seed INTEGER NOT NULL,status TEXT NOT NULL CHECK(status IN ('locked','ready','opened')),
 earned_at INTEGER NOT NULL,opened_at INTEGER, UNIQUE(run_id,boss_spawn_id)
);
CREATE INDEX artifact_chests_owner ON artifact_chests(user_id,status,tier,earned_at,id);
CREATE TABLE artifact_receipts (
 user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,request_id TEXT NOT NULL,
 signature TEXT NOT NULL,receipt_json TEXT NOT NULL,created_at INTEGER NOT NULL,PRIMARY KEY(user_id,request_id)
);
ALTER TABLE fr010_runs ADD COLUMN artifact_loadout_json TEXT NOT NULL DEFAULT '{}';
