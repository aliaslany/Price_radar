import type { Env } from "./types";
import {
  upsertProduct,
  insertPrice,
  insertUsdRate,
  getLatestUsdRateWithAge,
  getPriceHistory,
  getWatchersForProduct,
} from "./db";
import { comparePrices } from "./calc";
import { fetchUsdIrrRate } from "./rate";
import { fetchLatestPrices } from "./github";
import { sendMessage } from "./telegram";

const USD_RATE_MIN_INTERVAL_SECONDS = 6 * 60 * 60; // navasan.tech رایگان فقط ۴ درخواست در روز اجازه می‌ده، پس هر ۶ ساعت یک‌بار کافیه

export async function runScheduledCheck(env: Env) {
  // ۱) نرخ دلار را فقط اگر قدیمی شده به‌روز کن (برای رعایت محدودیت ۴ درخواست/روز navasan)
  const cached = await getLatestUsdRateWithAge(env);
  let usdForCompare: number | null = cached?.rate ?? null;
  let newUsdRate: number | null = cached?.rate ?? null;

  const shouldRefreshUsd = !cached || cached.ageSeconds >= USD_RATE_MIN_INTERVAL_SECONDS;
  if (shouldRefreshUsd) {
    try {
      const fresh = await fetchUsdIrrRate(env.USD_RATE_API_KEY);
      await insertUsdRate(env, fresh);
      newUsdRate = fresh;
      // usdForCompare عمداً همون نرخ قبلی (cached) می‌مونه تا مقایسه قبل/بعد درست باشه
    } catch (err) {
      console.log("usd rate fetch failed:", err);
    }
  }

  // ۲) آخرین نتایج اسکرپ را از prices.json روی گیت‌هاب بخوان
  //    (این فایل توسط GitHub Actions هر ۳۰ دقیقه یا با درخواست فوری آپدیت می‌شود)
  let data;
  try {
    data = await fetchLatestPrices(env);
  } catch (err) {
    console.log("fetch prices.json failed:", err);
    return;
  }

  for (const product of data.products) {
    if (product.error || typeof product.price !== "number") {
      console.log(`skip ${product.id}: ${product.error}`);
      continue;
    }

    const history = await getPriceHistory(env, product.id, 1);
    const oldPrice = history[0]?.price ?? null;

    await upsertProduct(env, {
      id: product.id,
      title: product.title,
      url: product.url,
      price: product.price,
      available: product.available ?? true,
      currency: "IRR",
      source: product.source ?? "digikala",
    });
    await insertPrice(env, product.id, product.price, product.available ?? true);

    if (oldPrice === null) continue; // اولین بار است، چیزی برای مقایسه نیست

    const comparison = comparePrices(oldPrice, product.price, usdForCompare, newUsdRate);

    const watchers = await getWatchersForProduct(env, product.id);
    for (const w of watchers) {
      const hitTarget = w.target_price != null && product.price <= w.target_price;
      if (!comparison.isDrop && !hitTarget) continue;

      let msg = `📉 *${product.title}*\n\nقیمت جدید: ${Math.round(product.price).toLocaleString("fa-IR")} تومان (${comparison.rialChangePercent.toFixed(1)}٪)`;

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
  }
}
