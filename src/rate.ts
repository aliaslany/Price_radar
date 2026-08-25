// نرخ دلار بازار آزاد (نه نرخ رسمی بانک مرکزی).
// چند provider رایگان ایرانی این را می‌دهند؛ اینجا از navasan.net به‌عنوان نمونه استفاده شده.
// اگر provider تغییر کرد، فقط همین فایل را عوض کن - بقیه پروژه به آن وابسته نیست.

export async function fetchUsdIrrRate(apiKey?: string): Promise<number> {
  // نمونه: https://api.navasan.tech/latest/?api_key=XXX
  // خروجی چیزی شبیه: { "usd_sell": { "value": "605000", ... }, ... }  (واحد: تومان)
  if (!apiKey) {
    throw new Error("USD_RATE_API_KEY تنظیم نشده - در wrangler با secret put اضافه کن");
  }

  const res = await fetch(`https://api.navasan.tech/latest/?api_key=${apiKey}`);
  if (!res.ok) {
    throw new Error(`سرویس نرخ ارز وضعیت ${res.status} برگرداند`);
  }

  const data: any = await res.json();
  const raw = data?.usd_sell?.value ?? data?.usd?.value;
  const rate = Number(raw);

  if (!rate || Number.isNaN(rate)) {
    throw new Error("نرخ دلار در پاسخ provider پیدا نشد");
  }

  return rate; // تومان به ازای هر دلار
}
