import type { Env } from "./types";
import { handleUpdate } from "./telegram";
import { runScheduledCheck } from "./cron";
import { addUrlToWatchlist, fetchLatestPrices, triggerScrapeWorkflow } from "./github";
import { getPriceHistory } from "./db";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type, Accept",
};

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors } });
}

function extractDigikalaId(value: string) {
  return value.match(/dkp-(\d+)/i)?.[1] ?? null;
}

async function handleWebPrice(request: Request, env: Env) {
  const requestUrl = new URL(request.url);
  const productUrl = requestUrl.searchParams.get("url")?.trim() ?? "";
  const refresh = requestUrl.searchParams.get("refresh") === "1";
  if (!productUrl) return json({ error: "پارامتر url الزامی است" }, 400);
  if (!/^https?:\/\/(www\.)?digikala\.com\//i.test(productUrl)) return json({ error: "فعلاً فقط لینک دیجی‌کالا پشتیبانی می‌شود" }, 400);

  const productId = extractDigikalaId(productUrl);
  if (!productId) return json({ error: "شناسه dkp محصول از لینک پیدا نشد" }, 400);
  const id = `digikala:${productId}`;
  const data = await fetchLatestPrices(env);
  const product = data.products.find((p) => p.id === id);

  if (product?.price != null && !product.error) {
    let history: { price: number; timestamp: number }[] = [];
    try { history = await getPriceHistory(env, id, 30); } catch (_) {}
    const prices = history.map((x) => x.price);
    const allPrices = prices.length ? prices : [product.price];
    return json({ status: "ready", id, url: product.url || productUrl, title: product.title, price: product.price, available: product.available ?? true, source: product.source ?? "digikala", updatedAt: data.updatedAt, minPrice: Math.min(...allPrices), maxPrice: Math.max(...allPrices), history });
  }

  if (refresh) {
    const added = await addUrlToWatchlist(env, id, productUrl, "");
    if (added || product?.error || !product) await triggerScrapeWorkflow(env);
  }

  return json({ status: "pending", id, message: "محصول در صف قیمت‌گیری است. معمولاً کمتر از یک دقیقه زمان می‌برد." });
}

export default {
  async fetch(request: Request, env: Env): Promise<Response> {
    const url = new URL(request.url);
    if (request.method === "OPTIONS") return new Response(null, { headers: cors });
    if (url.pathname === "/webhook" && request.method === "POST") {
      const update = await request.json();
      await handleUpdate(env, update);
      return new Response("ok");
    }
    if (url.pathname === "/api/price" && request.method === "GET") {
      try { return await handleWebPrice(request, env); }
      catch (err: any) { return json({ error: err?.message ?? "خطای داخلی" }, 500); }
    }
    if (url.pathname === "/") return new Response("Price Radar is running 🔍");
    return new Response("not found", { status: 404 });
  },
  async scheduled(_event: ScheduledEvent, env: Env, ctx: ExecutionContext): Promise<void> {
    ctx.waitUntil(runScheduledCheck(env));
  },
};
