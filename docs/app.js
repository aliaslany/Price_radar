const API_BASE="https://priceradar.startstar.ir";
const form=document.getElementById("price-form"),urlInput=document.getElementById("url"),statusEl=document.getElementById("status"),resultEl=document.getElementById("result"),targetInput=document.getElementById("target"),notifyBtn=document.getElementById("notify-btn");
let currentProduct=null,pollTimer=null,pushSubscription=null;
const fmt=n=>new Intl.NumberFormat("fa-IR").format(Math.round(n)),toNumber=v=>Number(String(v).replace(/[^0-9]/g,""));
function status(t,type=""){statusEl.textContent=t;statusEl.className=`status ${type}`} function hideStatus(){statusEl.className="status hidden"} function showResult(){resultEl.classList.remove("hidden")}
async function registerSW(){if(!("serviceWorker"in navigator))return null;return navigator.serviceWorker.register("sw.js")}
async function enableNotifications(){
 if(!("Notification"in window)||!("PushManager"in window)){status("مرورگر شما از Push Notification پشتیبانی نمی‌کند.","error");return}
 if(Notification.permission==="denied"){status("اعلان‌ها برای این سایت مسدود شده‌اند.","error");return}
 const permission=await Notification.requestPermission(); if(permission!=="granted"){status("اجازه اعلان داده نشد.","error");return}
 try{
  const reg=await registerSW(),keyRes=await fetch(`${API_BASE}/api/push/public-key`),{publicKey}=await keyRes.json();
  if(!publicKey)throw new Error("VAPID هنوز روی Worker تنظیم نشده است.");
  pushSubscription=await reg.pushManager.getSubscription();
  if(!pushSubscription)pushSubscription=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:publicKeyToBytes(publicKey)});
  await fetch(`${API_BASE}/api/push/subscribe`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(pushSubscription.toJSON())});
  notifyBtn.textContent="🔔 اعلان Push فعال است";notifyBtn.classList.add("enabled");status("✅ اعلان واقعی فعال شد؛ حتی با بسته بودن سایت هم اعلان دریافت می‌کنی.","success");
  if(currentProduct)await saveWatch();
 }catch(e){status(`⚠️ فعال‌سازی اعلان ناموفق بود: ${e.message}`,"error")}
}
function publicKeyToBytes(base64){const pad="=".repeat((4-base64.length%4)%4),raw=atob((base64+pad).replace(/-/g,"+").replace(/_/g,"/"));return Uint8Array.from(raw,c=>c.charCodeAt(0))}
async function saveWatch(){if(!currentProduct||!pushSubscription)return;const target=toNumber(targetInput.value);await fetch(`${API_BASE}/api/push/watch`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify({endpoint:pushSubscription.endpoint,productId:currentProduct.id,targetPrice:target||null})})}
async function render(data){currentProduct=data;document.getElementById("title").textContent=data.title||"محصول دیجی‌کالا";document.getElementById("price").textContent=data.price!=null?fmt(data.price/10):"—";document.getElementById("product-link").href=data.url;document.getElementById("availability").textContent=data.available?"موجود":"ناموجود";document.getElementById("availability").className=`availability ${data.available?"":"out"}`;document.getElementById("updated").textContent=data.updatedAt?new Date(data.updatedAt).toLocaleString("fa-IR"):"—";document.getElementById("min-price").textContent=data.minPrice!=null?fmt(data.minPrice/10):"—";document.getElementById("max-price").textContent=data.maxPrice!=null?fmt(data.maxPrice/10):"—";targetInput.value=localStorage.getItem(`target:${data.id}`)||"";showResult();renderHistory(data.history||[])}
function renderHistory(h){const b=document.getElementById("history");if(!h.length){b.innerHTML="";return}const p=h.map(x=>x.price/10),min=Math.min(...p),max=Math.max(...p),span=max-min||1;b.innerHTML=`<div class="history-title">روند آخرین ثبت‌های قیمت</div><div class="bars">${p.slice().reverse().map(x=>`<div class="bar" style="height:${18+((x-min)/span)*72}%"><span>${fmt(x)} تومان</span></div>`).join("")}</div>`}
async function lookup(url,refresh=false){const q=`?url=${encodeURIComponent(url)}${refresh?"&refresh=1":""}`,r=await fetch(`${API_BASE}/api/price${q}`,{headers:{Accept:"application/json"}}),d=await r.json().catch(()=>({}));if(!r.ok)throw new Error(d.error||"خطا در دریافت اطلاعات");return d}
async function poll(url){clearTimeout(pollTimer);try{const d=await lookup(url);if(d.status==="ready"){hideStatus();await render(d);return}status("⏳ قیمت هنوز آماده نشده؛ دوباره بررسی می‌کنیم…");pollTimer=setTimeout(()=>poll(url),7000)}catch(e){status(`⚠️ ${e.message}`,"error")}}
form.addEventListener("submit",async e=>{e.preventDefault();clearTimeout(pollTimer);resultEl.classList.add("hidden");const u=urlInput.value.trim();if(!/https?:\/\/(www\.)?digikala\.com\//i.test(u)){status("لطفاً یک لینک معتبر از دیجی‌کالا وارد کن.","error");return}status("🔎 در حال بررسی لینک…");try{const d=await lookup(u,true);if(d.status==="ready"){hideStatus();await render(d)}else{status("⏳ محصول ثبت شد و قیمت‌گیری شروع شد.");pollTimer=setTimeout(()=>poll(u),7000)}}catch(e){status(`⚠️ ${e.message}`,"error")}});
document.getElementById("save-target").addEventListener("click",async()=>{if(!currentProduct)return;const v=toNumber(targetInput.value);if(v)localStorage.setItem(`target:${currentProduct.id}`,String(v));else localStorage.removeItem(`target:${currentProduct.id}`);if(pushSubscription)await saveWatch();else if(Notification.permission!=="denied")await enableNotifications();status(v?`🎯 قیمت هدف ${fmt(v)} تومان ذخیره شد.`:"قیمت هدف حذف شد.","success")});
notifyBtn.addEventListener("click",enableNotifications);registerSW().catch(()=>{});
if("Notification"in window&&Notification.permission==="granted")enableNotifications().catch(()=>{});
