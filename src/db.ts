import type { Env, ScrapedProduct } from "./types";

export async function upsertProduct(env: Env, p: ScrapedProduct) {
  await env.DB.prepare(
    `INSERT INTO products (id, url, title, source)
     VALUES (?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET title = excluded.title, url = excluded.url`
  )
    .bind(p.id, p.url, p.title, p.source)
    .run();
}

export async function insertPrice(env: Env, productId: string, price: number, available: boolean) {
  await env.DB.prepare(
    `INSERT INTO prices (product_id, price, available) VALUES (?, ?, ?)`
  )
    .bind(productId, price, available ? 1 : 0)
    .run();
}

export async function insertUsdRate(env: Env, rate: number) {
  await env.DB.prepare(`INSERT INTO usd_rates (rate) VALUES (?)`).bind(rate).run();
}

export async function getLatestUsdRate(env: Env): Promise<number | null> {
  const row = await env.DB.prepare(
    `SELECT rate FROM usd_rates ORDER BY timestamp DESC LIMIT 1`
  ).first<{ rate: number }>();
  return row?.rate ?? null;
}

export async function getPriceHistory(env: Env, productId: string, limit = 30) {
  const { results } = await env.DB.prepare(
    `SELECT price, timestamp FROM prices WHERE product_id = ? ORDER BY timestamp DESC LIMIT ?`
  )
    .bind(productId, limit)
    .all<{ price: number; timestamp: number }>();
  return results;
}

export async function addWatch(env: Env, chatId: number, productId: string, targetPrice: number | null) {
  await env.DB.prepare(
    `INSERT INTO watchlist (chat_id, product_id, target_price)
     VALUES (?, ?, ?)
     ON CONFLICT(chat_id, product_id) DO UPDATE SET target_price = excluded.target_price`
  )
    .bind(chatId, productId, targetPrice)
    .run();
}

export async function getAllWatchedProducts(env: Env) {
  const { results } = await env.DB.prepare(
    `SELECT DISTINCT p.* FROM products p
     JOIN watchlist w ON w.product_id = p.id`
  ).all<{ id: string; url: string; title: string; source: string }>();
  return results;
}

export async function getWatchersForProduct(env: Env, productId: string) {
  const { results } = await env.DB.prepare(
    `SELECT chat_id, target_price FROM watchlist WHERE product_id = ?`
  )
    .bind(productId)
    .all<{ chat_id: number; target_price: number | null }>();
  return results;
}
