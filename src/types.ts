export interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  USD_RATE_API_KEY?: string;
}

export interface ScrapedProduct {
  id: string;        // شناسه یکتا (source + sku)
  title: string;
  price: number;      // به ریال
  currency: "IRR";
  available: boolean;
  url: string;
  source: string;      // "digikala" | "torob" | ...
}

export interface Scraper {
  source: string;
  matches(url: string): boolean;
  getProduct(url: string): Promise<ScrapedProduct>;
}
