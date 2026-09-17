CREATE TABLE IF NOT EXISTS management_reports (
  id TEXT PRIMARY KEY,
  report_type TEXT NOT NULL,
  report_period TEXT NOT NULL,
  report_date TEXT,
  source_filename TEXT,
  data_json TEXT NOT NULL,
  created_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_management_reports_type_created
  ON management_reports(report_type, created_at DESC);
