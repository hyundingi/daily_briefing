CREATE TABLE IF NOT EXISTS disclosure_documents (
  receipt_no TEXT PRIMARY KEY,
  company TEXT NOT NULL,
  title TEXT NOT NULL,
  document_text TEXT,
  status TEXT NOT NULL,
  error TEXT,
  fetched_at TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_disclosure_documents_status ON disclosure_documents(status);
CREATE INDEX IF NOT EXISTS idx_disclosure_documents_fetched ON disclosure_documents(fetched_at DESC);
