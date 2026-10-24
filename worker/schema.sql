CREATE TABLE IF NOT EXISTS events (
  kind TEXT NOT NULL,
  id TEXT NOT NULL,
  submitted_at TEXT NOT NULL,
  record_json TEXT NOT NULL,
  PRIMARY KEY(kind,id)
);
