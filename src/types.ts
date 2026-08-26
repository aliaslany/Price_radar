export interface Env {
  DB: D1Database;
  TELEGRAM_BOT_TOKEN: string;
  USD_RATE_API_KEY?: string;
  GITHUB_TOKEN: string;
  GITHUB_REPO: string;
  VAPID_PUBLIC_KEY?: string;
  VAPID_PRIVATE_KEY?: string;
  VAPID_SUBJECT?: string;
}

export interface ScrapedProduct {
  id: string;
  title: string;
  price: number;
  currency: "IRR";
  available: boolean;
  url: string;
  source: string;
}

export interface Scraper {
  source: string;
  matches(url: string): boolean;
  getProduct(url: string): Promise<ScrapedProduct>;
}
