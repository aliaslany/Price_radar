# 🔍 Price Radar

ربات تلگرام رصد قیمت - بدون AI، روی Cloudflare (Worker + D1 + Cron) + GitHub Actions برای اسکرپینگ.

## چرا دو تا زیرساخت؟

دیجی‌کالا درخواست‌های Cloudflare Workers رو به‌عنوان ترافیک datacenter شناسایی و بلاک می‌کنه (ریدایرکت loop). برای دور زدن این مشکل:

- **GitHub Actions** (IP رنج متفاوت) هر ۳۰ دقیقه محصولات `watchlist.json` رو اسکرپ می‌کنه و نتیجه رو در `prices.json` کامیت می‌کنه.
- **Cloudflare Worker** هر ۵ دقیقه `prices.json` رو از گیت‌هاب می‌خونه (فقط یک fetch ساده، ارزون)، با D1 مقایسه می‌کنه، و در صورت افت قیمت به تلگرام پیام می‌ده.
- وقتی کاربر لینک جدید می‌فرسته، Worker مستقیماً `watchlist.json` رو از طریق GitHub API آپدیت می‌کنه و یک اجرای فوری Action (`workflow_dispatch`) رو تریگر می‌کنه - نتیجه معمولاً کمتر از یک دقیقه آماده می‌شه.

```
تلگرام → Worker → (آپدیت watchlist.json + trigger) → GitHub Actions اسکرپ می‌کنه → prices.json
                                                                                      ↓
                                                          Worker هر ۵ دقیقه می‌خونه ← ┘
                                                                    ↓
                                                            D1 + مقایسه + اطلاع تلگرام
```

## چی همین الان آماده است؟

- ✅ دیتابیس D1 واقعی (`price-radar-db`) با اسکیمای کامل
- ✅ دامنه اختصاصی `priceradar.startstar.ir` وصل شده
- ✅ کد کامل: Worker (webhook + cron هر ۵ دقیقه) + اسکریپت اسکرپ GitHub Actions + محاسبه تغییر واقعی قیمت مستقل از دلار

## راه‌اندازی (چند قدم باقی‌مانده)

### ۱) توکن گیت‌هاب برای Worker بساز

Fine-grained token در `github.com/settings/tokens`:
- Repository access → فقط `price_radar`
- Permissions → **Contents: Read and write**, **Actions: Read and write**

### ۲) سکرت‌ها رو ست کن

```bash
npx wrangler secret put TELEGRAM_BOT_TOKEN
npx wrangler secret put USD_RATE_API_KEY
npx wrangler secret put GITHUB_TOKEN
```

### ۳) دیپلوی

```bash
npx wrangler deploy
```

### ۴) webhook تلگرام (اگر قبلاً ست نکردی)

```bash
curl "https://api.telegram.org/bot<TOKEN>/setWebhook?url=https://priceradar.startstar.ir/webhook"
```

### ۵) مطمئن شو GitHub Actions فعاله

اولین بار که ریپو رو پوش می‌کنی، برو تب **Actions** توی گیت‌هاب و workflow «Scrape Prices» رو یک بار به‌صورت دستی (Run workflow) اجرا کن - بعضی وقت‌ها GitHub بعد از اولین پوش، Actions رو غیرفعال نگه می‌داره تا دستی تأیید کنی.

## چطور کار می‌کنه

1. کاربر لینک محصول دیجی‌کالا رو به ربات می‌فرسته.
2. Worker شناسه محصول رو استخراج می‌کنه، به `watchlist.json` (روی گیت‌هاب) اضافه می‌کنه، و یک اجرای فوری Action رو تریگر می‌کنه.
3. GitHub Actions قیمت رو از API دیجی‌کالا می‌گیره (از IP خودش، نه Cloudflare) و در `prices.json` ذخیره می‌کنه.
4. هر ۵ دقیقه Worker این فایل رو می‌خونه، با آخرین قیمت ذخیره‌شده در D1 مقایسه می‌کنه.
5. اگر قیمت افت کرد یا به هدف کاربر (`/target`) رسید، پیام تلگرام می‌ره - همراه با «تغییر واقعی قیمت» (مستقل از نوسان دلار).

## اگر دیجی‌کالا IP رنج Actions رو هم بلاک کرد

این محتمله ولی فعلاً امتحان‌نشده. اگر باز هم خطا گرفتی، گزینه بعدی استفاده از یک self-hosted GitHub Actions runner (روی همین سیستم یا یک VPS ایرانی) به‌جای runner ابری گیت‌هابه - بگو تا اون رو هم بسازیم.

## قدم بعدی طبیعی (V2)

- اضافه‌کردن `torob` یا `emalls` به `scripts/scrape.js` (همون الگو رو کپی کن)
- مقایسه قیمت بین چند فروشگاه برای یک محصول
- سیستم رفرال (هر دعوت = ظرفیت رصد بیشتر)

