CREATE TABLE IF NOT EXISTS item_ai_summaries (
  item_type TEXT NOT NULL,
  item_id TEXT NOT NULL,
  company TEXT NOT NULL,
  title TEXT NOT NULL,
  summary TEXT,
  key_points TEXT,
  caution TEXT,
  generated_by TEXT NOT NULL,
  model TEXT,
  created_at TEXT NOT NULL,
  PRIMARY KEY (item_type, item_id)
);

CREATE INDEX IF NOT EXISTS idx_item_ai_summaries_company ON item_ai_summaries(company);
CREATE INDEX IF NOT EXISTS idx_item_ai_summaries_created ON item_ai_summaries(created_at DESC);
