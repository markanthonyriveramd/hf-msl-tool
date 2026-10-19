/* Service worker — keeps the tool usable offline.
   Same-origin files: cached, served instantly, refreshed in the background.
   Fonts: cached the first time they load online. */
const CACHE = 'hf-msl-v3-2';
const CORE = ['./', './index.html', './manifest.json'];

self.addEventListener('install', (e)=>{
  e.waitUntil(caches.open(CACHE).then(c=>c.addAll(CORE)).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', (e)=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

self.addEventListener('fetch', (e)=>{
  const req = e.request;
  if(req.method !== 'GET' || !/^https?:/.test(req.url)) return;
  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isFont = /(^|\.)fonts\.(googleapis|gstatic)\.com$/.test(url.hostname);
  if(!sameOrigin && !isFont) return;
  if(url.searchParams.has('nocache')) return;   // version check goes straight to the network

  e.respondWith((async ()=>{
    const cache = await caches.open(CACHE);
    const hit = await cache.match(req, {ignoreSearch:true});
    const refresh = fetch(req).then(async res=>{
      if(res && (res.ok || res.type === 'opaque')){
        try{ await cache.put(req, res.clone()); }catch(_){}
      }
      return res;
    }).catch(()=>null);
    if(hit){ e.waitUntil(refresh); return hit; }
    const net = await refresh;
    if(net) return net;
    if(req.mode === 'navigate'){ const fb = await cache.match('./index.html'); if(fb) return fb; }
    return new Response('', {status:504, statusText:'offline'});
  })());
});
