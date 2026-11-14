const CACHE="coach-echecs-shell-v11";
const FILES=["./","./index.html","./styles.css","./app.js","./analysis.js","./lesson.js","./openings.js","./engine-worker.js","./manifest.webmanifest","./favicon.svg"];

self.addEventListener("install",event=>{
  event.waitUntil((async()=>{
    const cache=await caches.open(CACHE);
    await cache.addAll(FILES);
    await self.skipWaiting();
  })());
});

self.addEventListener("activate",event=>{
  event.waitUntil((async()=>{
    const keys=await caches.keys();
    await Promise.all(keys.filter(key=>key.startsWith("coach-echecs-shell-")&&key!==CACHE).map(key=>caches.delete(key)));
    await self.clients.claim();
  })());
});

// Réseau d'abord : les mises à jour sont visibles dès la prochaine ouverture.
// Le cache ne sert que de secours hors connexion.
self.addEventListener("fetch",event=>{
  const request=event.request;
  if(request.method!=="GET")return;
  const url=new URL(request.url);
  if(url.origin!==self.location.origin)return;
  event.respondWith((async()=>{
    try{
      const response=await fetch(request,{cache:"no-store"});
      if(response&&response.ok){
        const cache=await caches.open(CACHE);
        await cache.put(request,response.clone());
      }
      return response;
    }catch(error){
      const cached=await caches.match(request);
      if(cached)return cached;
      if(request.mode==="navigate"){
        const fallback=await caches.match("./index.html");
        if(fallback)return fallback;
      }
      throw error;
    }
  })());
});