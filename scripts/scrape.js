const fs = require("fs");
const path = require("path");
const WATCHLIST_PATH = path.join(__dirname, "..", "watchlist.json");
const OUTPUT_PATH = path.join(__dirname, "..", "prices.json");
const sleep = ms => new Promise(r => setTimeout(r, ms));

function extractProductId(url) { return url.match(/dkp-(\d+)/i)?.[1] ?? null; }

async function requestJson(url, headers) {
  let lastError;
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 15000);
      const res = await fetch(url, { headers, signal: controller.signal, redirect: "follow" });
      clearTimeout(timer);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json();
    } catch (err) {
      lastError = err;
      console.log(`attempt ${attempt} failed: ${err.message}`);
      if (attempt < 3) await sleep(attempt * 2000);
    }
  }
  throw lastError;
}

function readProduct(data) {
  const product = data?.data?.product ?? data?.product;
  if (!product) return null;
  const variants = product.variants ?? [];
  const variant = product.default_variant ?? variants.find(v => typeof v?.price?.selling_price === "number") ?? variants[0];
  const price = variant?.price?.selling_price;
  if (typeof price !== "number") return null;
  return { title: product.title_fa ?? product.title_en ?? "", price, available: variant?.stock?.status !== "out_of_stock" };
}

async function scrapeOne(entry) {
  const productId = extractProductId(entry.url);
  if (!productId) return { ...entry, error: "شناسه محصول از لینک پیدا نشد" };
  const headers = {
    Accept: "application/json, text/plain, */*",
    "Accept-Language": "fa-IR,fa;q=0.9,en;q=0.8",
    "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0.0.0 Safari/537.36",
    Referer: "https://www.digikala.com/",
    Origin: "https://www.digikala.com",
  };
  let lastError;
  for (const endpoint of [
    `https://api.digikala.com/v2/product/${productId}/`,
    `https://api.digikala.com/v1/product/${productId}/`,
  ]) {
    try {
      const parsed = readProduct(await requestJson(endpoint, headers));
      if (!parsed) throw new Error("قیمت یا ساختار محصول در پاسخ پیدا نشد");
      return { id: entry.id, url: entry.url, title: parsed.title || entry.title || `dkp-${productId}`, price: parsed.price, available: parsed.available, source: "digikala", error: null };
    } catch (err) { lastError = err; }
  }
  return { ...entry, error: `fetch failed: ${lastError?.message || "unknown error"}` };
}

async function main() {
  const watchlist = JSON.parse(fs.readFileSync(WATCHLIST_PATH, "utf-8"));
  const products = [];
  for (const entry of watchlist) {
    const result = await scrapeOne(entry);
    products.push(result);
    console.log(result.error ? `FAILED ${entry.id}: ${result.error}` : `OK ${entry.id}: ${result.price}`);
    await sleep(1500);
  }
  fs.writeFileSync(OUTPUT_PATH, JSON.stringify({ updatedAt: new Date().toISOString(), products }, null, 2));
}
main().catch(err => { console.error(err); process.exit(1); });
