-- این اسکیما همین الان روی دیتابیس D1 واقعی (price-radar-db) اجرا شده.
-- این فایل فقط برای مرجع / تکرار در محیط دیگر است.

CREATE TABLE IF NOT EXISTS products (
  id TEXT PRIMARY KEY,
  url TEXT NOT NULL,
  title TEXT,
  source TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS prices (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  product_id TEXT NOT NULL,
  price INTEGER NOT NULL,
  available INTEGER DEFAULT 1,
  timestamp INTEGER DEFAULT (strftime('%s','now')),
  FOREIGN KEY(product_id) REFERENCES products(id)
);

CREATE TABLE IF NOT EXISTS usd_rates (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  rate REAL NOT NULL,
  timestamp INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS watchlist (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  chat_id INTEGER NOT NULL,
  product_id TEXT NOT NULL,
  target_price INTEGER,
  created_at INTEGER DEFAULT (strftime('%s','now')),
  UNIQUE(chat_id, product_id)
);
