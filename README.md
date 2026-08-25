# 🔍 Price Radar

ربات تلگرام رصد قیمت - کاملاً بدون AI، کاملاً روی Cloudflare (Worker + D1 + Cron).

## چی همین الان آماده است؟

- ✅ دیتابیس D1 واقعی به اسم `price-radar-db` ساخته و اسکیمای کامل (`products`, `prices`, `usd_rates`, `watchlist`) روش اجرا شده. `database_id` داخل `wrangler.toml` هست.
- ✅ کد کامل Worker: webhook تلگرام + cron هر ۳۰ دقیقه + یک اسکریپر برای دیجی‌کالا + محاسبه «تغییر واقعی قیمت مستقل از دلار».
- ⚠️ من نمی‌تونم مستقیم کد رو روی حساب Cloudflare تو دیپلوی کنم (ابزاری که در اختیارم هست فقط D1/KV/R2 می‌سازه، نه دیپلوی Worker) و نمی‌تونم مستقیم به گیت‌هاب پوش کنم چون توکن دسترسی ندارم. پس این چند قدم آخر با خودته:

## دیپلوی (۵ دقیقه)

```bash
npm install
npx wrangler login          # اگر قبلاً login نکردی
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put USD_RATE_API_KEY     # از navasan.tech یا هر provider نرخ بازار آزاد بگیر
npx wrangler deploy
```

بعد از دیپلوی، webhook تلگرام رو ست کن (یک بار کافیه):

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://price-radar.<your-subdomain>.workers.dev/webhook"
```

## پوش به گیت‌هاب

```bash
git init
git add .
git commit -m "Price Radar MVP"
git remote add origin https://github.com/aliaslany/price-radar.git
git push -u origin main
```

## چطور کار می‌کنه

1. کاربر لینک محصول دیجی‌کالا رو به ربات می‌فرسته.
2. `scrapers/digikala.ts` از API عمومی دیجی‌کالا قیمت لحظه‌ای رو می‌گیره.
3. قیمت در `prices` ذخیره می‌شه، محصول به‌صورت خودکار به `watchlist` کاربر اضافه می‌شه.
4. هر ۳۰ دقیقه Cron همه محصولات تحت‌نظر رو دوباره چک می‌کنه، نرخ دلار آزاد رو هم آپدیت می‌کنه.
5. اگر قیمت افت کرد یا به هدف کاربر رسید، پیام تلگرام می‌ره - همراه با «تغییر واقعی قیمت» (قیمت مستقل از نوسان دلار، طبق فرمول‌هایی که خودت پیشنهاد داده بودی).

## قدم بعدی طبیعی (V2)

- اضافه‌کردن `scrapers/torob.ts` یا `scrapers/emalls.ts` - فقط پیاده‌سازی interface `Scraper` در `src/types.ts` کافیه.
- مقایسه قیمت بین چند فروشگاه برای یک محصول.
- سیستم رفرال (هر دعوت = ظرفیت رصد بیشتر) - می‌تونی از منطق hydra-sender الگو بگیری.

## نکته مهم درباره Scraping

دیجی‌کالا ممکنه هر زمان ساختار API یا محافظت WAF رو عوض کنه. اگر بعد از مدتی خطای مکرر گرفتی، اول بررسی کن که پاسخ API هنوز همون ساختار `data.product.default_variant.price.selling_price` رو داره یا نه.
