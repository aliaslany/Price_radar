const API_BASE = "https://priceradar.startstar.ir";
const form = document.getElementById("price-form");
const urlInput = document.getElementById("url");
const statusEl = document.getElementById("status");
const resultEl = document.getElementById("result");
const targetInput = document.getElementById("target");
let currentProduct = null;
let pollTimer = null;

const fmt = n => new Intl.NumberFormat("fa-IR").format(Math.round(n));
const toNumber = value => Number(String(value).replace(/[^0-9]/g, ""));
function status(text,type=""){statusEl.textContent=text;statusEl.className=`status ${type}`}
function hideStatus(){statusEl.className="status hidden"}
function showResult(){resultEl.classList.remove("hidden")}

function render(data){
  currentProduct=data;
  document.getElementById("title").textContent=data.title||"محصول دیجی‌کالا";
  document.getElementById("price").textContent=data.price!=null?fmt(data.price/10):"—";
  document.getElementById("product-link").href=data.url;
  document.getElementById("availability").textContent=data.available?"موجود":"ناموجود";
  document.getElementById("availability").className=`availability ${data.available?"":"out"}`;
  document.getElementById("updated").textContent=data.updatedAt?new Date(data.updatedAt).toLocaleString("fa-IR"):"—";
  document.getElementById("min-price").textContent=data.minPrice!=null?fmt(data.minPrice/10):"—";
  document.getElementById("max-price").textContent=data.maxPrice!=null?fmt(data.maxPrice/10):"—";
  const saved=localStorage.getItem(`target:${data.id}`); targetInput.value=saved?fmt(Number(saved)):"";
  renderHistory(data.history||[]); showResult();
}
function renderHistory(history){
  const box=document.getElementById("history"); if(!history.length){box.innerHTML="";return}
  const prices=history.map(x=>x.price/10),min=Math.min(...prices),max=Math.max(...prices),span=max-min||1;
  box.innerHTML=`<div class="history-title">روند آخرین ثبت‌های قیمت</div><div class="bars">${prices.slice().reverse().map(p=>`<div class="bar" style="height:${18+((p-min)/span)*72}%"><span>${fmt(p)} تومان</span></div>`).join("")}</div>`;
}
async function lookup(url,refresh=false){
  const query=`?url=${encodeURIComponent(url)}${refresh?"&refresh=1":""}`;
  const res=await fetch(`${API_BASE}/api/price${query}`,{headers:{Accept:"application/json"}});
  const data=await res.json().catch(()=>({})); if(!res.ok)throw new Error(data.error||"خطا در دریافت اطلاعات"); return data;
}
async function poll(url){
  clearTimeout(pollTimer);
  try{
    const data=await lookup(url,false);
    if(data.status==="ready"){hideStatus();render(data);return}
    status("⏳ قیمت هنوز آماده نشده؛ دوباره بررسی می‌کنیم…"); pollTimer=setTimeout(()=>poll(url),7000);
  }catch(err){status(`⚠️ ${err.message}`,"error")}
}
form.addEventListener("submit",async e=>{
  e.preventDefault(); clearTimeout(pollTimer); resultEl.classList.add("hidden");
  const url=urlInput.value.trim();
  if(!/https?:\/\/(www\.)?digikala\.com\//i.test(url)){status("لطفاً یک لینک معتبر از دیجی‌کالا وارد کن.","error");return}
  status("🔎 در حال بررسی لینک…");
  try{
    const data=await lookup(url,true);
    if(data.status==="ready"){hideStatus();render(data)}
    else{status("⏳ محصول ثبت شد و قیمت‌گیری شروع شد. معمولاً کمتر از یک دقیقه زمان می‌برد.");pollTimer=setTimeout(()=>poll(url),7000)}
  }catch(err){status(`⚠️ ${err.message}`,"error")}
});

document.getElementById("save-target").addEventListener("click",()=>{
  if(!currentProduct)return;
  const value=toNumber(targetInput.value);
  if(!value){localStorage.removeItem(`target:${currentProduct.id}`);status("قیمت هدف حذف شد.","success");return}
  localStorage.setItem(`target:${currentProduct.id}`,String(value));
  status(`🎯 قیمت هدف ${fmt(value)} تومان ذخیره شد. این هشدار فقط روی همین مرورگر فعال است.`,"success");
  if("Notification" in window&&Notification.permission==="default")Notification.requestPermission();
});

setInterval(()=>{
  if(!currentProduct)return;
  const target=Number(localStorage.getItem(`target:${currentProduct.id}`)),price=currentProduct.price/10;
  if(target&&price<=target&&!sessionStorage.getItem(`alerted:${currentProduct.id}`)){
    sessionStorage.setItem(`alerted:${currentProduct.id}`,"1");
    if("Notification" in window&&Notification.permission==="granted")new Notification("Price Radar",{body:`قیمت به ${fmt(price)} تومان رسید.`});
    status(`🎯 قیمت محصول به هدف شما رسید: ${fmt(price)} تومان`,"success");
  }
},5000);
