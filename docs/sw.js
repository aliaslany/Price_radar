const CACHE="price-radar-v2";
self.addEventListener("install",e=>{e.waitUntil(caches.open(CACHE).then(c=>c.addAll(["./","./index.html","./style.css","./app.js","./manifest.json"])).then(()=>self.skipWaiting()))});
self.addEventListener("activate",e=>e.waitUntil(self.clients.claim()));
self.addEventListener("fetch",e=>{if(e.request.method==="GET")e.respondWith(caches.match(e.request).then(r=>r||fetch(e.request)))});
self.addEventListener("push",e=>{let d={title:"Price Radar",body:"قیمت یک محصول تغییر کرد.",data:{url:"./"}};try{if(e.data)d={...d,...e.data.json()}}catch(_){}e.waitUntil(self.registration.showNotification(d.title,{body:d.body,icon:d.icon||"./icon-192.png",badge:d.badge||"./icon-192.png",tag:d.tag||"price-radar",data:d.data||{}}))});
self.addEventListener("notificationclick",e=>{e.notification.close();const u=e.notification.data?.url||"./";e.waitUntil(clients.matchAll({type:"window",includeUncontrolled:true}).then(list=>{for(const c of list)if("focus"in c)return c.navigate(u).then(()=>c.focus());return clients.openWindow(u)}))});
