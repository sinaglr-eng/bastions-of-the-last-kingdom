CREATE TABLE runs (
  id TEXT PRIMARY KEY NOT NULL,
  token_hash TEXT NOT NULL,
  version TEXT NOT NULL,
  mode INTEGER NOT NULL,
  seed TEXT NOT NULL,
  started_at INTEGER NOT NULL,
  updated_at INTEGER NOT NULL,
  finished_at INTEGER,
  sequence INTEGER NOT NULL DEFAULT 0,
  outcome TEXT NOT NULL DEFAULT 'playing',
  score INTEGER NOT NULL DEFAULT 0,
  waves_survived INTEGER NOT NULL DEFAULT 0,
  duration_ms INTEGER NOT NULL DEFAULT 0,
  health INTEGER NOT NULL DEFAULT 30,
  kingdom_level INTEGER NOT NULL DEFAULT 1,
  gold INTEGER NOT NULL DEFAULT 0,
  name TEXT,
  summary_json TEXT NOT NULL DEFAULT '{"draws":[],"decisions":[]}'
);
CREATE INDEX idx_runs_leaderboard ON runs (mode, version, score DESC, finished_at, id) WHERE name IS NOT NULL;
CREATE TABLE run_waves (
  run_id TEXT NOT NULL REFERENCES runs(id),
  wave INTEGER NOT NULL,
  snapshot_json TEXT NOT NULL,
  sequence INTEGER NOT NULL,
  PRIMARY KEY (run_id, wave)
);
CREATE TABLE request_limits (
  key TEXT PRIMARY KEY NOT NULL,
  period INTEGER NOT NULL,
  hits INTEGER NOT NULL
);
