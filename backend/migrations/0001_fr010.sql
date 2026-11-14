-- Additive migration: existing runs/run_waves and their ownership remain exact.
CREATE TABLE IF NOT EXISTS fr010_profiles (
 user_id TEXT PRIMARY KEY NOT NULL REFERENCES user(id),
 revision INTEGER NOT NULL DEFAULT 0,
 balance INTEGER NOT NULL DEFAULT 0 CHECK(balance >= 0),
 skills_json TEXT NOT NULL DEFAULT '{}',
 equipped_json TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE IF NOT EXISTS fr010_grants (
 user_id TEXT NOT NULL REFERENCES user(id),
 achievement_id TEXT NOT NULL,
 faction_id TEXT,
 reward INTEGER NOT NULL CHECK(reward > 0),
 created_at INTEGER NOT NULL,
 PRIMARY KEY(user_id, achievement_id)
);
CREATE TABLE IF NOT EXISTS fr010_ledger (
 user_id TEXT NOT NULL REFERENCES user(id),
 entry_id TEXT NOT NULL,
 amount INTEGER NOT NULL,
 kind TEXT NOT NULL,
 detail TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 PRIMARY KEY(user_id, entry_id)
);
CREATE TABLE IF NOT EXISTS fr010_runs (
 id TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL REFERENCES user(id),
 faction_id TEXT NOT NULL,
 ruleset TEXT NOT NULL,
 seed INTEGER NOT NULL,
 sequence INTEGER NOT NULL DEFAULT 0,
 last_batch TEXT,
 outcome TEXT NOT NULL DEFAULT 'playing',
 snapshot_json TEXT NOT NULL,
 loadout_json TEXT NOT NULL,
 score_text TEXT NOT NULL DEFAULT '0',
 score_digits INTEGER NOT NULL DEFAULT 1,
 highest_wave INTEGER NOT NULL DEFAULT 0,
 progress_json TEXT NOT NULL DEFAULT '{}',
 started_at INTEGER NOT NULL,
 updated_at INTEGER NOT NULL,
 finished_at INTEGER
);
CREATE INDEX IF NOT EXISTS fr010_standings ON fr010_runs(ruleset,faction_id,outcome,score_digits DESC,score_text DESC,highest_wave DESC,finished_at,id);
CREATE UNIQUE INDEX IF NOT EXISTS fr010_one_active_run ON fr010_runs(user_id) WHERE outcome='playing';
CREATE TABLE IF NOT EXISTS fr010_active (
 user_id TEXT PRIMARY KEY NOT NULL REFERENCES user(id),
 run_id TEXT NOT NULL REFERENCES fr010_runs(id)
);
CREATE TABLE IF NOT EXISTS fr010_batches (
 run_id TEXT NOT NULL REFERENCES fr010_runs(id),
 sequence INTEGER NOT NULL,
 batch_id TEXT NOT NULL,
 digest TEXT NOT NULL,
 commands_json TEXT NOT NULL,
 created_at INTEGER NOT NULL,
 PRIMARY KEY(run_id,sequence),
 UNIQUE(run_id,batch_id)
);
