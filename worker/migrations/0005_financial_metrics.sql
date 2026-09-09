CREATE TABLE IF NOT EXISTS financial_metrics (
  id TEXT PRIMARY KEY,
  company TEXT NOT NULL,
  fiscal_year TEXT NOT NULL,
  report_code TEXT NOT NULL,
  account_name TEXT NOT NULL,
  account_detail TEXT,
  amount INTEGER,
  currency TEXT,
  statement_name TEXT,
  raw_json TEXT,
  first_seen_at TEXT NOT NULL,
  last_seen_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_financial_metrics_company ON financial_metrics(company);
CREATE INDEX IF NOT EXISTS idx_financial_metrics_year ON financial_metrics(fiscal_year DESC, report_code);
CREATE INDEX IF NOT EXISTS idx_financial_metrics_account ON financial_metrics(account_name);
