CREATE TABLE IF NOT EXISTS industry_performance_records (
  id TEXT PRIMARY KEY,
  report_year INTEGER NOT NULL,
  report_month INTEGER NOT NULL,
  company TEXT NOT NULL,
  business_segment TEXT NOT NULL,
  monthly_target REAL,
  monthly_actual REAL,
  monthly_achievement REAL,
  source_ytd_target REAL,
  source_ytd_actual REAL,
  source_ytd_achievement REAL,
  source_previous_year_actual REAL,
  source_yoy_amount REAL,
  source_yoy_rate REAL,
  note TEXT,
  source_filename TEXT,
  source_sheet TEXT,
  source_row INTEGER,
  record_hash TEXT NOT NULL,
  first_imported_at TEXT NOT NULL,
  last_imported_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_industry_performance_period
  ON industry_performance_records(report_year DESC, report_month DESC);

CREATE INDEX IF NOT EXISTS idx_industry_performance_company_period
  ON industry_performance_records(company, report_year DESC, report_month DESC);

CREATE TABLE IF NOT EXISTS industry_performance_imports (
  id TEXT PRIMARY KEY,
  source_filename TEXT,
  record_count INTEGER NOT NULL,
  inserted_count INTEGER NOT NULL DEFAULT 0,
  updated_count INTEGER NOT NULL DEFAULT 0,
  skipped_count INTEGER NOT NULL DEFAULT 0,
  imported_at TEXT NOT NULL
);
