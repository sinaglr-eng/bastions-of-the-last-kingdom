CREATE TABLE account_progression (
 user_id TEXT PRIMARY KEY NOT NULL REFERENCES user(id),
 xp_total INTEGER NOT NULL DEFAULT 0 CHECK(xp_total>=0),
 credited_waves INTEGER NOT NULL DEFAULT 0 CHECK(credited_waves>=0),
 permanent_json TEXT NOT NULL DEFAULT '{}',
 migrated INTEGER NOT NULL DEFAULT 0,
 diagnostics_json TEXT NOT NULL DEFAULT '[]'
);
CREATE TABLE account_run_progression (
 user_id TEXT NOT NULL REFERENCES user(id),run_id TEXT NOT NULL REFERENCES fr010_runs(id),
 paid_waves INTEGER NOT NULL DEFAULT 0,paid_bosses_json TEXT NOT NULL DEFAULT '[]',
 PRIMARY KEY(user_id,run_id)
);
CREATE TABLE account_xp_ledger (
 user_id TEXT NOT NULL REFERENCES user(id),source_id TEXT NOT NULL,amount INTEGER NOT NULL,created_at INTEGER NOT NULL,
 PRIMARY KEY(user_id,source_id)
);
CREATE TABLE account_xp_receipts (
 user_id TEXT NOT NULL REFERENCES user(id),receipt_id TEXT NOT NULL,run_id TEXT NOT NULL REFERENCES fr010_runs(id),receipt_json TEXT NOT NULL,acknowledged INTEGER NOT NULL DEFAULT 0,
 PRIMARY KEY(user_id,receipt_id)
);
