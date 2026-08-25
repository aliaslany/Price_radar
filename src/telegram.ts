import type { Env } from "./types";
import { digikalaScraper } from "./scrapers/digikala";
import { upsertProduct, insertPrice, getLatestUsdRate, getPriceHistory, addWatch } from "./db";
import { isGreatDeal, average } from "./calc";

const scrapers = [digikalaScraper]; // برای اضافه‌کردن فروشگاه جدید فقط اینجا اضافه کن

function findScraper(url: string) {
  return scrapers.find((s) => s.matches(url)) ?? null;
}

export async function sendMessage(env: Env, chatId: number, text: string) {
  await fetch(`https://api.telegram.org/bot${env.TELEGRAM_BOT_TOKEN}/sendMessage`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ chat_id: chatId, text, parse_mode: "Markdown" }),
  });
}

function fmt(n: number) {
  return Math.round(n).toLocaleString("fa-IR");
}

export async function handleUpdate(env: Env, update: any) {
  const message = update.message;
  if (!message) return;

  const chatId: number = message.chat.id;
  const text: string = message.text ?? "";

  if (text === "/start") {
    await sendMessage(
      env,
      chatId,
      "🔍 *Price Radar*\n\nلینک محصول یکی از فروشگاه‌های پشتیبانی‌شده رو بفرست تا قیمتش رو رصد کنم.\n\nفعلاً پشتیبانی می‌شه: دیجی‌کالا"
    );
    return;
  }

  if (text.startsWith("/target")) {
    const parts = text.trim().split(/\s+/);
    const shortId = parts[1];
    const target = Number(parts[2]);
    if (!shortId || !target) {
      await sendMessage(env, chatId, "فرمت درست: /target <شناسه محصول> <قیمت هدف به تومان>");
      return;
    }
    await addWatch(env, chatId, `digikala:${shortId}`, target);
    await sendMessage(env, chatId, `🎯 باشه، وقتی قیمت به ${fmt(target)} تومان یا کمتر رسید خبرت می‌کنم.`);
    return;
  }

  const urlMatch = text.match(/https?:\/\/\S+/);
  if (!urlMatch) {
    await sendMessage(env, chatId, "یه لینک محصول معتبر بفرست 🙏 (یا /start رو بزن)");
    return;
  }

  const url = urlMatch[0];
  const scraper = findScraper(url);
  if (!scraper) {
    await sendMessage(env, chatId, "این فروشگاه فعلاً پشتیبانی نمی‌شه. فعلاً فقط دیجی‌کالا 🙏");
    return;
  }

  try {
    const product = await scraper.getProduct(url);
    await upsertProduct(env, product);
    await insertPrice(env, product.id, product.price, product.available);

    const history = await getPriceHistory(env, product.id, 30);
    const lowest = history.length ? Math.min(...history.map((h) => h.price)) : product.price;
    const sevenDayAvg = history.length ? average(history.map((h) => h.price)) : product.price;

    let dealLine = "";
    if (isGreatDeal(product.price, sevenDayAvg)) {
      dealLine = "\n\n🟢 *قیمت بسیار خوب* - قیمت فعلی حدود ۸٪ یا بیشتر پایین‌تر از میانگین اخیر است.";
    }

    await sendMessage(
      env,
      chatId,
      `📱 *${product.title}*\n\n💰 قیمت فعلی: ${fmt(product.price)} تومان\n📉 کمترین قیمت ثبت‌شده: ${fmt(lowest)} تومان${dealLine}\n\n🔔 می‌خوای وقتی قیمت افت کرد خبرت کنم؟ برای هدف‌گذاری قیمت مشخص بنویس:\n/target ${product.id.split(":")[1]} 30000000`
    );

    // با ارسال لینک به‌صورت پیش‌فرض روی رصد ساده (بدون قیمت هدف) قرار می‌گیره
    await addWatch(env, chatId, product.id, null);
  } catch (err: any) {
    await sendMessage(env, chatId, `⚠️ نشد قیمت رو بگیرم: ${err.message ?? err}`);
  }
}
