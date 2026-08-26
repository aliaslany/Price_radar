import type { Env } from "./types";
import { upsertProduct, insertPrice, insertUsdRate, getLatestUsdRate, getPriceHistory, getWatchersForProduct, getWebWatchersForProduct, markWebNotified, removePushSubscription } from "./db";
import { comparePrices } from "./calc";
import { fetchUsdIrrRate } from "./rate";
import { fetchLatestPrices } from "./github";
import { sendMessage } from "./telegram";
import { sendWebPush } from "./push";
export async function runScheduledCheck(env: Env) {
 let newUsdRate:number|null=null, usdForCompare:number|null=null;
 try { usdForCompare=await getLatestUsdRate(env); newUsdRate=await fetchUsdIrrRate(env.USD_RATE_API_KEY); await insertUsdRate(env,newUsdRate); } catch(err){ console.log("usd rate fetch failed:",err); }
 let data; try { data=await fetchLatestPrices(env); } catch(err){ console.log("fetch prices.json failed:",err); return; }
 for(const product of data.products){
  if(product.error||typeof product.price!=="number") continue;
  const history=await getPriceHistory(env,product.id,1), oldPrice=history[0]?.price??null;
  await upsertProduct(env,{id:product.id,title:product.title,url:product.url,price:product.price,available:product.available??true,currency:"IRR",source:product.source??"digikala"});
  await insertPrice(env,product.id,product.price,product.available??true);
  if(oldPrice===null) continue;
  const comparison=comparePrices(oldPrice,product.price,usdForCompare,newUsdRate);
  for(const w of await getWatchersForProduct(env,product.id)){
   const hitTarget=w.target_price!=null&&product.price<=w.target_price; if(!comparison.isDrop&&!hitTarget) continue;
   let msg=`📉 *${product.title}*\n\nقیمت جدید: ${Math.round(product.price).toLocaleString("fa-IR")} تومان (${comparison.rialChangePercent.toFixed(1)}٪)`;
   if(comparison.realChangePercent!=null) msg+=`\n📊 تغییر واقعی: ${comparison.realChangePercent.toFixed(1)}٪`; if(hitTarget) msg+=`\n\n🎯 به قیمت هدفت رسید!`; else if(comparison.isBigDrop) msg+=`\n\n🔥 افت شدید قیمت!`; await sendMessage(env,w.chat_id,msg);
  }
  for(const w of await getWebWatchersForProduct(env,product.id)){
   const hitTarget=w.target_price!=null&&product.price<=w.target_price; if(!hitTarget&&!comparison.isDrop) continue; if(w.last_notified_price===product.price) continue;
   const body=hitTarget?`قیمت ${product.title||"محصول"} به ${Math.round(product.price/10).toLocaleString("fa-IR")} تومان رسید.`:`قیمت ${product.title||"محصول"} کاهش یافت: ${Math.round(product.price/10).toLocaleString("fa-IR")} تومان`;
   try { await sendWebPush(env,{endpoint:w.endpoint,keys:{p256dh:w.p256dh,auth:w.auth}},hitTarget?"🎯 Price Radar":"📉 Price Radar",body,product.url); await markWebNotified(env,w.endpoint,product.id,product.price); } catch(err:any){ console.log("web push failed",err?.message); if(err?.status===404||err?.status===410) await removePushSubscription(env,w.endpoint); }
  }
 }
}
