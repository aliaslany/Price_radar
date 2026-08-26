// این اسکریپت روی GitHub Actions اجرا می‌شود، نه روی Cloudflare Worker.
// چون IP رنج Actions با Cloudflare Workers فرق داره، احتمال بلاک‌شدن توسط دیجی‌کالا کمتره.

const fs = require("fs");
const path = require("path");

const WATCHLIST_PATH = path.join(__dirname, "..", "watchlist.json");
const OUTPUT_PATH = path.join(__dirname, "..", "prices.json");

function extractProductId(url) {
  const match = url.match(/dkp-(\d+)/i);
  return match ? match[1] : null;
}

async function scrapeOne(entry) {
  const productId = extractProductId(entry.url);
  if (!productId) {
    return { ...entry, error: "شناسه محصول از لینک پیدا نشد" };
  }

  try {
    const res = await fetch(`https://api.digikala.com/v1/product/${productId}/`, {
      headers: {
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "application/json",
        "Accept-Language": "fa-IR,fa;q=0.9",
        Referer: "https://www.digikala.com/",
      },
    });

    if (!res.ok) {
      return { ...entry, error: `HTTP ${res.status}` };
    }

    const data = await res.json();
    const product = data?.data?.product;
    if (!product) {
      return { ...entry, error: "ساختار پاسخ ناشناخته" };
    }

    const variant = product.default_variant ?? product.variants?.[0];
    const price = variant?.price?.selling_price;
    const available = variant?.stock?.status !== "out_of_stock";

    if (typeof price !== "number") {
      return { ...entry, error: "قیمت در پاسخ پیدا نشد" };
    }

    return {
      id: entry.id,
      url: entry.url,
      title: product.title_fa ?? product.title_en ?? entry.title ?? `dkp-${productId}`,
      price,
      available,
      source: "digikala",
      error: null,
    };
  } catch (err) {
    return { ...entry, error: String(err.message ?? err) };
  }
}

async function main() {
  const watchlist = JSON.parse(fs.readFileSync(WATCHLIST_PATH, "utf-8"));

  const results = [];
  for (const entry of watchlist) {
    // یکی‌یکی با کمی فاصله، تا مثل بات رفتار نکنیم
    const result = await scrapeOne(entry);
    results.push(result);
    await new Promise((r) => setTimeout(r, 1500));
  }

  const output = {
    updatedAt: new Date().toISOString(),
    products: results,
  };

  fs.writeFileSync(OUTPUT_PATH, JSON.stringify(output, null, 2));
  console.log(`scraped ${results.length} products`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
