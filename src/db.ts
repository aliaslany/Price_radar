import type { Env, ScrapedProduct } from "./types";

export async function upsertProduct(env: Env, p: ScrapedProduct) {
  await env.DB.prepare(`INSERT INTO products (id, url, title, source) VALUES (?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET title = excluded.title, url = excluded.url`).bind(p.id, p.url, p.title, p.source).run();
}
export async function insertPrice(env: Env, productId: string, price: number, available: boolean) {
  await env.DB.prepare(`INSERT INTO prices (product_id, price, available) VALUES (?, ?, ?)`).bind(productId, price, available ? 1 : 0).run();
}
export async function insertUsdRate(env: Env, rate: number) { await env.DB.prepare(`INSERT INTO usd_rates (rate) VALUES (?)`).bind(rate).run(); }
export async function getLatestUsdRate(env: Env): Promise<number | null> {
  const row = await env.DB.prepare(`SELECT rate FROM usd_rates ORDER BY timestamp DESC LIMIT 1`).first<{ rate: number }>();
  return row?.rate ?? null;
}
export async function getPriceHistory(env: Env, productId: string, limit = 30) {
  const { results } = await env.DB.prepare(`SELECT price, timestamp FROM prices WHERE product_id = ? ORDER BY timestamp DESC LIMIT ?`).bind(productId, limit).all<{ price: number; timestamp: number }>();
  return results;
}
export async function addWatch(env: Env, chatId: number, productId: string, targetPrice: number | null) {
  await env.DB.prepare(`INSERT INTO watchlist (chat_id, product_id, target_price) VALUES (?, ?, ?) ON CONFLICT(chat_id, product_id) DO UPDATE SET target_price = excluded.target_price`).bind(chatId, productId, targetPrice).run();
}
export async function getAllWatchedProducts(env: Env) {
  const { results } = await env.DB.prepare(`SELECT DISTINCT p.* FROM products p JOIN watchlist w ON w.product_id = p.id`).all<{ id: string; url: string; title: string; source: string }>();
  return results;
}
export async function getWatchersForProduct(env: Env, productId: string) {
  const { results } = await env.DB.prepare(`SELECT chat_id, target_price FROM watchlist WHERE product_id = ?`).bind(productId).all<{ chat_id: number; target_price: number | null }>();
  return results;
}

export async function savePushSubscription(env: Env, sub: { endpoint: string; keys: { p256dh: string; auth: string } }) {
  await env.DB.prepare(`INSERT INTO push_subscriptions (endpoint, p256dh, auth) VALUES (?, ?, ?) ON CONFLICT(endpoint) DO UPDATE SET p256dh=excluded.p256dh, auth=excluded.auth`).bind(sub.endpoint, sub.keys.p256dh, sub.keys.auth).run();
}
export async function removePushSubscription(env: Env, endpoint: string) {
  await env.DB.prepare(`DELETE FROM push_subscriptions WHERE endpoint = ?`).bind(endpoint).run();
  await env.DB.prepare(`DELETE FROM web_watchlist WHERE endpoint = ?`).bind(endpoint).run();
}
export async function addWebWatch(env: Env, endpoint: string, productId: string, targetPrice: number | null) {
  await env.DB.prepare(`INSERT INTO web_watchlist (endpoint, product_id, target_price) VALUES (?, ?, ?) ON CONFLICT(endpoint, product_id) DO UPDATE SET target_price=excluded.target_price`).bind(endpoint, productId, targetPrice).run();
}
export async function getWebWatchersForProduct(env: Env, productId: string) {
  const { results } = await env.DB.prepare(`SELECT w.endpoint, w.target_price, s.p256dh, s.auth FROM web_watchlist w JOIN push_subscriptions s ON s.endpoint=w.endpoint WHERE w.product_id=?`).bind(productId).all<{ endpoint: string; target_price: number | null; p256dh: string; auth: string }>();
  return results;
}
export async function markWebNotified(env: Env, endpoint: string, productId: string, price: number) {
  await env.DB.prepare(`UPDATE web_watchlist SET last_notified_price=? WHERE endpoint=? AND product_id=?`).bind(price, endpoint, productId).run();
}
