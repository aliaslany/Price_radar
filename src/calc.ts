export interface PriceComparison {
  oldPrice: number;
  newPrice: number;
  rialChangePercent: number;
  usdOld: number | null;
  usdNew: number | null;
  realChangePercent: number | null; // تغییر قیمت مستقل از نوسان دلار
  isDrop: boolean;
  isBigDrop: boolean; // >= 10%
}

export function comparePrices(
  oldPrice: number,
  newPrice: number,
  oldUsdRate: number | null,
  newUsdRate: number | null
): PriceComparison {
  const rialChangePercent = ((newPrice - oldPrice) / oldPrice) * 100;

  let usdOld: number | null = null;
  let usdNew: number | null = null;
  let realChangePercent: number | null = null;

  if (oldUsdRate && newUsdRate) {
    usdOld = oldPrice / oldUsdRate;
    usdNew = newPrice / newUsdRate;
    realChangePercent = ((usdNew - usdOld) / usdOld) * 100;
  }

  return {
    oldPrice,
    newPrice,
    rialChangePercent,
    usdOld,
    usdNew,
    realChangePercent,
    isDrop: newPrice < oldPrice,
    isBigDrop: rialChangePercent <= -10,
  };
}

export function isGreatDeal(currentPrice: number, sevenDayAveragePrice: number): boolean {
  return currentPrice < sevenDayAveragePrice * 0.92; // حدود ۸٪ یا بیشتر پایین‌تر از میانگین هفته
}

export function average(nums: number[]): number {
  return nums.reduce((a, b) => a + b, 0) / nums.length;
}
