import type { Scraper, ScrapedProduct } from "../types";

// دیجی‌کالا یک API عمومی (غیررسمی) دارد که همان صفحه محصول از آن داده می‌گیرد.
// نمونه: https://api.digikala.com/v1/product/12345678/
const DIGIKALA_HOST = "digikala.com";
const API_BASE = "https://api.digikala.com/v1/product";

function extractProductId(url: string): string | null {
  // فرمت‌های رایج:
  // https://www.digikala.com/product/dkp-12345678/some-slug/
  const match = url.match(/dkp-(\d+)/i);
  return match ? match[1] : null;
}

export const digikalaScraper: Scraper = {
  source: "digikala",

  matches(url: string): boolean {
    return url.includes(DIGIKALA_HOST);
  },

  async getProduct(url: string): Promise<ScrapedProduct> {
    const productId = extractProductId(url);
    if (!productId) {
      throw new Error("لینک دیجی‌کالا قابل تشخیص نیست (dkp-XXXXX پیدا نشد)");
    }

    const res = await fetch(`${API_BASE}/${productId}/`, {
      headers: {
        // بدون User-Agent مرورگر معمولاً ۴۰۳ برمی‌گردد
        "User-Agent":
          "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0 Safari/537.36",
        Accept: "application/json",
      },
    });

    if (!res.ok) {
      throw new Error(`دیجی‌کالا وضعیت ${res.status} برگرداند`);
    }

    const data: any = await res.json();
    const product = data?.data?.product;
    if (!product) {
      throw new Error("ساختار پاسخ دیجی‌کالا تغییر کرده یا محصول یافت نشد");
    }

    const variant = product.default_variant ?? product.variants?.[0];
    const price: number | undefined = variant?.price?.selling_price;
    const available: boolean = !!variant?.price?.order_limit || variant?.stock?.status !== "out_of_stock";

    if (typeof price !== "number") {
      throw new Error("قیمت در پاسخ دیجی‌کالا پیدا نشد");
    }

    return {
      id: `digikala:${productId}`,
      title: product.title_fa ?? product.title_en ?? `dkp-${productId}`,
      price, // واحد: تومان (همان چیزی که API دیجی‌کالا برمی‌گرداند - در کل پروژه واحد پول تومان است)
      currency: "IRR",
      available,
      url,
      source: "digikala",
    };
  },
};
