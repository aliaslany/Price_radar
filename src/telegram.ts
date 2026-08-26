import type { Env } from "./types";
import { addWatch } from "./db";
import { addUrlToWatchlist, triggerScrapeWorkflow } from "./github";

function extractDigikalaId(url: string): string | null {
  const match = url.match(/dkp-(\d+)/i);
  return match ? match[1] : null;
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
      "🔍 *Price Radar*\n\nلینک محصول دیجی‌کالا رو بفرست تا قیمتش رو رصد کنم.\n\n⏱ چون قیمت‌گیری از طریق GitHub Actions انجام می‌شه، اولین نتیجه معمولاً کمتر از یک دقیقه طول می‌کشه، نه آنی."
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
  if (!url.includes("digikala.com")) {
    await sendMessage(env, chatId, "این فروشگاه فعلاً پشتیبانی نمی‌شه. فعلاً فقط دیجی‌کالا 🙏");
    return;
  }

  const productId = extractDigikalaId(url);
  if (!productId) {
    await sendMessage(env, chatId, "شناسه محصول رو از این لینک پیدا نکردم. مطمئن شو لینک صفحه محصول (dkp-...) باشه.");
    return;
  }

  const id = `digikala:${productId}`;

  try {
    await addUrlToWatchlist(env, id, url, "");
    await addWatch(env, chatId, id, null);
    await triggerScrapeWorkflow(env);

    await sendMessage(
      env,
      chatId,
      `✅ اضافه شد به رصد.\n\n⏱ تا حدود یک دقیقه دیگه اولین قیمت رو برات می‌فرستم، و از این به بعد هر ۳۰ دقیقه چک می‌شه.\n\nبرای هدف‌گذاری قیمت مشخص:\n/target ${productId} 30000000`
    );
  } catch (err: any) {
    await sendMessage(env, chatId, `⚠️ نشد به لیست رصد اضافه کنم: ${err.message ?? err}`);
  }
}
