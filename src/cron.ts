import type { Env } from "./types";
import { digikalaScraper } from "./scrapers/digikala";
import {
  insertPrice,
  insertUsdRate,
  getLatestUsdRate,
  getPriceHistory,
  getAllWatchedProducts,
  getWatchersForProduct,
} from "./db";
import { comparePrices } from "./calc";
import { fetchUsdIrrRate } from "./rate";
import { sendMessage } from "./telegram";

const scrapers = [digikalaScraper];

export async function runScheduledCheck(env: Env) {
  // ۱) نرخ دلار را به‌روز کن (برای همه محصولات مشترک است)
  let newUsdRate: number | null = null;
  try {
    newUsdRate = await fetchUsdIrrRate(env.USD_RATE_API_KEY);
    await insertUsdRate(env, newUsdRate);
  } catch (err) {
    console.log("usd rate fetch failed:", err);
  }

  // ۲) هر محصول تحت‌نظر را دوباره چک کن
  const products = await getAllWatchedProducts(env);

  for (const product of products) {
    const scraper = scrapers.find((s) => s.source === product.source);
    if (!scraper) continue;

    try {
      const history = await getPriceHistory(env, product.id, 2);
      const oldPrice = history[0]?.price ?? null;

      const fresh = await scraper.getProduct(product.url);
      await insertPrice(env, product.id, fresh.price, fresh.available);

      if (oldPrice === null) continue; // اولین بار است، چیزی برای مقایسه نیست

      const oldUsd = await getLatestUsdRate(env); // ساده‌سازی: آخرین نرخ ذخیره‌شده قبل از این چک
      const comparison = comparePrices(oldPrice, fresh.price, oldUsd, newUsdRate);

      const watchers = await getWatchersForProduct(env, product.id);
      for (const w of watchers) {
        const hitTarget = w.target_price != null && fresh.price <= w.target_price;
        if (!comparison.isDrop && !hitTarget) continue;

        let msg = `📉 *${product.title}*\n\nقیمت جدید: ${Math.round(fresh.price).toLocaleString("fa-IR")} تومان (${comparison.rialChangePercent.toFixed(1)}٪)`;

        if (comparison.realChangePercent != null) {
          msg += `\n📊 تغییر واقعی (مستقل از دلار): ${comparison.realChangePercent.toFixed(1)}٪`;
        }
        if (hitTarget) {
          msg += `\n\n🎯 به قیمت هدفت رسید!`;
        } else if (comparison.isBigDrop) {
          msg += `\n\n🔥 افت شدید قیمت!`;
        }

        await sendMessage(env, w.chat_id, msg);
      }
    } catch (err) {
      console.log(`check failed for ${product.id}:`, err);
    }
  }
}
