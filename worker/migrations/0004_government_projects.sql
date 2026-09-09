CREATE TABLE IF NOT EXISTS government_projects (
  id TEXT PRIMARY KEY,
  source TEXT NOT NULL,
  title TEXT NOT NULL,
  agency TEXT,
  category TEXT,
  summary TEXT,
  link TEXT,
  announcement_date TEXT,
  deadline TEXT,
  status TEXT,
  budget TEXT,
  target TEXT,
  keywords TEXT,
  raw_json TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_government_projects_deadline ON government_projects(deadline ASC);
CREATE INDEX IF NOT EXISTS idx_government_projects_source ON government_projects(source);
CREATE INDEX IF NOT EXISTS idx_government_projects_seen ON government_projects(first_seen_at DESC);
