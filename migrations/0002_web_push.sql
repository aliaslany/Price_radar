CREATE TABLE IF NOT EXISTS push_subscriptions (
  endpoint TEXT PRIMARY KEY,
  p256dh TEXT NOT NULL,
  auth TEXT NOT NULL,
  created_at INTEGER DEFAULT (strftime('%s','now'))
);

CREATE TABLE IF NOT EXISTS web_watchlist (
  endpoint TEXT NOT NULL,
  product_id TEXT NOT NULL,
  target_price INTEGER,
  created_at INTEGER DEFAULT (strftime('%s','now')),
  last_notified_price INTEGER,
  PRIMARY KEY(endpoint, product_id)
);
