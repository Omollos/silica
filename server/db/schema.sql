CREATE TABLE IF NOT EXISTS schema_migrations (
  version INTEGER PRIMARY KEY,
  applied_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS runs (
  run_id TEXT PRIMARY KEY,
  seed INTEGER NOT NULL,
  difficulty TEXT NOT NULL CHECK (difficulty IN ('cadet', 'standard', 'commander')),
  live_flare_bonus INTEGER NOT NULL CHECK (live_flare_bonus IN (0, 5, 10)),
  status TEXT NOT NULL CHECK (status IN ('playing', 'won', 'partial', 'lost')),
  failure_reason TEXT CHECK (failure_reason IS NULL OR failure_reason IN ('oxygen', 'health')),
  rounds_survived INTEGER NOT NULL,
  score INTEGER,
  final_power INTEGER,
  final_oxygen INTEGER,
  final_health INTEGER,
  final_moon_dirt INTEGER,
  final_shield INTEGER,
  verified INTEGER NOT NULL DEFAULT 0 CHECK (verified IN (0, 1)),
  mismatch TEXT,
  report_json TEXT,
  started_at TEXT NOT NULL,
  updated_at TEXT NOT NULL,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS run_choices (
  run_id TEXT NOT NULL,
  round INTEGER NOT NULL CHECK (round BETWEEN 1 AND 12),
  choice_id TEXT NOT NULL,
  PRIMARY KEY (run_id, round),
  FOREIGN KEY (run_id) REFERENCES runs(run_id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_runs_status ON runs(status);
CREATE INDEX IF NOT EXISTS idx_runs_completed_at ON runs(completed_at);
CREATE INDEX IF NOT EXISTS idx_runs_verified ON runs(verified);
CREATE INDEX IF NOT EXISTS idx_run_choices_run ON run_choices(run_id);