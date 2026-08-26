import type { Env } from "./types";
import { handleUpdate } from "./telegram";
import { runScheduledCheck } from "./cron";
import { addUrlToWatchlist, fetchLatestPrices, triggerScrapeWorkflow } from "./github";
import { getPriceHistory, savePushSubscription, removePushSubscription, addWebWatch } from "./db";
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Methods": "GET, POST, OPTIONS", "Access-Control-Allow-Headers": "Content-Type, Accept" };
function json(data: unknown, status = 200) { return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors } }); }
function extractDigikalaId(value: string) { return value.match(/dkp-(\d+)/i)?.[1] ?? null; }
async function handleWebPrice(request: Request, env: Env) {
  const u = new URL(request.url), productUrl = u.searchParams.get("url")?.trim() ?? "", refresh = u.searchParams.get("refresh") === "1";
  if (!productUrl) return json({ error: "پارامتر url الزامی است" }, 400);
  if (!/^https?:\/\/(www\.)?digikala\.com\//i.test(productUrl)) return json({ error: "فعلاً فقط لینک دیجی‌کالا پشتیبانی می‌شود" }, 400);
  const productId = extractDigikalaId(productUrl); if (!productId) return json({ error: "شناسه dkp محصول از لینک پیدا نشد" }, 400);
  const id = `digikala:${productId}`, data = await fetchLatestPrices(env), product = data.products.find(p => p.id === id);
  if (product?.price != null && !product.error) { let history: { price: number; timestamp: number }[] = []; try { history = await getPriceHistory(env, id, 30); } catch (_) {} const prices = history.map(x => x.price), all = prices.length ? prices : [product.price]; return json({ status: "ready", id, url: product.url || productUrl, title: product.title, price: product.price, available: product.available ?? true, source: product.source ?? "digikala", updatedAt: data.updatedAt, minPrice: Math.min(...all), maxPrice: Math.max(...all), history }); }
  if (refresh) { const added = await addUrlToWatchlist(env, id, productUrl, ""); if (added || product?.error || !product) await triggerScrapeWorkflow(env); }
  return json({ status: "pending", id, message: "محصول در صف قیمت‌گیری است." });
}
async function subscribe(request: Request, env: Env) { const sub = await request.json(); if (!sub?.endpoint || !sub?.keys?.p256dh || !sub?.keys?.auth) return json({ error: "Push subscription نامعتبر است" }, 400); await savePushSubscription(env, sub); return json({ ok: true }); }
async function watch(request: Request, env: Env) { const b = await request.json(); if (!b?.endpoint || !b?.productId) return json({ error: "endpoint و productId الزامی است" }, 400); const target = b.targetPrice == null ? null : Number(b.targetPrice); if (target !== null && (!Number.isFinite(target) || target < 0)) return json({ error: "قیمت هدف نامعتبر است" }, 400); await addWebWatch(env, b.endpoint, b.productId, target); return json({ ok: true }); }
async function unsubscribe(request: Request, env: Env) { const b = await request.json(); if (!b?.endpoint) return json({ error: "endpoint الزامی است" }, 400); await removePushSubscription(env, b.endpoint); return json({ ok: true }); }
export default { async fetch(request: Request, env: Env): Promise<Response> { const u = new URL(request.url); if (request.method === "OPTIONS") return new Response(null, { headers: cors }); try { if (u.pathname === "/webhook" && request.method === "POST") { await handleUpdate(env, await request.json()); return new Response("ok"); } if (u.pathname === "/api/price" && request.method === "GET") return handleWebPrice(request, env); if (u.pathname === "/api/push/subscribe" && request.method === "POST") return subscribe(request, env); if (u.pathname === "/api/push/watch" && request.method === "POST") return watch(request, env); if (u.pathname === "/api/push/unsubscribe" && request.method === "POST") return unsubscribe(request, env); if (u.pathname === "/api/push/public-key" && request.method === "GET") return json({ publicKey: env.VAPID_PUBLIC_KEY ?? null }); if (u.pathname === "/") return new Response("Price Radar is running 🔍"); return new Response("not found", { status: 404 }); } catch (err: any) { return json({ error: err?.message ?? "خطای داخلی" }, 500); } }, async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> { ctx.waitUntil(runScheduledCheck(env)); } };
