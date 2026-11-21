CREATE TABLE rank_chests (
  id TEXT PRIMARY KEY NOT NULL,
  user_id TEXT NOT NULL REFERENCES user(id) ON DELETE CASCADE,
  rank_level INTEGER NOT NULL CHECK (rank_level BETWEEN 2 AND 15),
  ordinal INTEGER NOT NULL CHECK (ordinal BETWEEN 1 AND 3),
  tier INTEGER NOT NULL CHECK (tier BETWEEN 1 AND 5),
  seed INTEGER NOT NULL,
  earned_at INTEGER NOT NULL,
  opened_at INTEGER,
  UNIQUE (user_id, rank_level, ordinal)
);
CREATE INDEX rank_chests_owner ON rank_chests(user_id, opened_at, tier, earned_at, id);
