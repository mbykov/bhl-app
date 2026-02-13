import Database from 'better-sqlite3';

// No 'await' needed here, it's synchronous and extremely fast
export const db = new Database('./analytics.db');

// Run initialization
db.exec(`
  CREATE TABLE IF NOT EXISTS visits (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    visitor_id TEXT,
    timestamp DATETIME DEFAULT (datetime('now')),
    referrer TEXT,
    device TEXT
  )
`);
