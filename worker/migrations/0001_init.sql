CREATE TABLE IF NOT EXISTS disclosures (
  id TEXT PRIMARY KEY,
  company TEXT NOT NULL,
  category TEXT,
  title TEXT NOT NULL,
  receipt_no TEXT,
  disclosure_date TEXT,
  is_revision INTEGER DEFAULT 0,
  note TEXT,
  link TEXT,
  score INTEGER DEFAULT 0,
  important INTEGER DEFAULT 0,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_disclosures_date ON disclosures(disclosure_date DESC);
CREATE INDEX IF NOT EXISTS idx_disclosures_company ON disclosures(company);
CREATE INDEX IF NOT EXISTS idx_disclosures_category ON disclosures(category);

CREATE TABLE IF NOT EXISTS news_articles (
  id TEXT PRIMARY KEY,
  company TEXT NOT NULL,
  category TEXT,
  title TEXT NOT NULL,
  summary TEXT,
  link TEXT,
  media TEXT,
  published_at TEXT,
  important INTEGER DEFAULT 0,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_news_published ON news_articles(published_at DESC);
CREATE INDEX IF NOT EXISTS idx_news_company ON news_articles(company);
CREATE INDEX IF NOT EXISTS idx_news_category ON news_articles(category);

CREATE TABLE IF NOT EXISTS ai_briefings (
  id TEXT PRIMARY KEY,
  briefing_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  scope TEXT NOT NULL,
  payload_json TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_ai_briefings_date ON ai_briefings(briefing_date DESC);

CREATE TABLE IF NOT EXISTS newsletter_runs (
  id TEXT PRIMARY KEY,
  newsletter_date TEXT NOT NULL,
  created_at TEXT NOT NULL,
  sent_at TEXT,
  subject TEXT,
  html TEXT,
  summary_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_newsletter_runs_sent ON newsletter_runs(sent_at DESC);

CREATE TABLE IF NOT EXISTS newsletter_items (
  run_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  company TEXT,
  title TEXT,
  PRIMARY KEY (run_id, item_type, item_id)
);

CREATE TABLE IF NOT EXISTS refresh_runs (
  id TEXT PRIMARY KEY,
  started_at TEXT NOT NULL,
  finished_at TEXT,
  disclosure_count INTEGER DEFAULT 0,
  news_count INTEGER DEFAULT 0,
  new_disclosure_count INTEGER DEFAULT 0,
  new_news_count INTEGER DEFAULT 0,
  diagnostics_json TEXT
);
