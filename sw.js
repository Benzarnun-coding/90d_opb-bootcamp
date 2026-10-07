/* Service worker โ€” เธฃเธฑเธ Web Push + เนเธซเนเธ•เธดเธ”เธ•เธฑเนเธเน€เธเนเธเนเธญเธเนเธ”เน
   เนเธเธเนเธเธ network-first เนเธ•เนเธกเธตเน€เธเธ”เธฒเธเน€เธงเธฅเธฒ: เธญเธญเธเนเธฅเธเนเนเธ”เนเธเธญเธเนเธซเธกเนเน€เธชเธกเธญ
   เธ–เนเธฒเน€เธเนเธ•เธญเธทเธ”เน€เธเธดเธ 4 เธงเธดเธเธฒเธ—เธต (เน€เธเนเธ•เธกเธทเธญเธ–เธทเธญเธชเธฑเธเธเธฒเธ“เธญเนเธญเธ) เนเธซเนเธซเธขเธดเธเธเธญเธเน€เธเนเธฒเธเธฒเธเนเธเธเธกเธฒเนเธเนเธเนเธญเธ
   เธเธญเธเน€เธ”เธดเธกเนเธกเนเธกเธตเน€เธเธ”เธฒเธเน€เธงเธฅเธฒ เธเธถเธเธเนเธฒเธเธฃเธญเน€เธเนเธ•เนเธเน€เธฃเธทเนเธญเธข เน เธ—เธฑเนเธเธ—เธตเนเธกเธตเธเธญเธเนเธเนเธเธเธเธฃเนเธญเธกเนเธเนเธญเธขเธนเนเนเธฅเนเธง */
const CACHE = "opb-v13";
const NET_TIMEOUT = 4000;
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil((async () => {
  const keys = await caches.keys(); await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
  await self.clients.claim();
})()));
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    /* เธขเธดเธเน€เธเนเธ•เนเธเธ•เธฒเธกเธเธเธ•เธด เนเธฅเธฐเน€เธเนเธเธฅเธเนเธเธเธ—เธธเธเธเธฃเธฑเนเธเธ—เธตเนเธชเธณเน€เธฃเนเธ เนเธกเนเธงเนเธฒเธเธฐเธ—เธฑเธเน€เธเธ”เธฒเธเน€เธงเธฅเธฒเธซเธฃเธทเธญเนเธกเน */
    const net = fetch(req).then(res => {
      /* เนเธกเนเนเธเธเนเธเธฅเนเน€เธเธฅเธ/เธเธณเธ•เธญเธเธเธฒเธเธชเนเธงเธ (206) โ€” เน€เธเธฃเธฒเธงเนเน€เธเธญเธฃเนเธเธญเน€เธเธฅเธเน€เธเนเธเธเนเธงเธ เน เธ–เนเธฒเน€เธเนเธเธเนเธงเธเน€เธ”เธตเธขเธงเนเธงเนเธเธฐเน€เธฅเนเธเธ•เนเธญเนเธกเนเนเธ”เน */
      if (res.ok && res.status !== 206 && !/\.(mp3|ogg|m4a|wav)(\?|$)/i.test(req.url)) caches.open(CACHE).then(c => c.put(req, res.clone())).catch(() => {});
      return res;
    });
    net.catch(() => {});                       // เธเธฑเธ unhandled rejection เธ•เธญเธเน€เธฃเธฒเนเธกเนเนเธ”เนเธฃเธญเธกเธฑเธ

    const cached = await caches.match(req);
    if (!cached) {                             // เนเธกเนเธกเธตเธเธญเธเน€เธเนเธฒเนเธซเนเนเธเน เธเนเธ•เนเธญเธเธฃเธญเน€เธเนเธ•เธญเธขเนเธฒเธเน€เธ”เธตเธขเธง
      try { return await net; }
      catch (err) {
        if (req.mode === "navigate") { const idx = await caches.match("/"); if (idx) return idx; }
        throw err;
      }
    }

    /* เธกเธตเธเธญเธเน€เธเนเธฒเธญเธขเธนเน: เธฃเธญเน€เธเนเธ•เนเธเน 4 เธงเธดเธเธฒเธ—เธต เน€เธเธดเธเธเธงเนเธฒเธเธฑเนเธเน€เธชเธดเธฃเนเธเธเธญเธเน€เธเนเธฒเนเธเธเนเธญเธ
       เนเธเธเธเธฐเธ–เธนเธเธญเธฑเธเน€เธ”เธ•เธญเธขเธนเนเธ”เธตเน€เธกเธทเนเธญ net เธงเธดเนเธเธเธ เธฃเธญเธเธซเธเนเธฒเธเธถเธเนเธ”เนเธเธญเธเนเธซเธกเน */
    const timeout = new Promise(r => setTimeout(() => r(null), NET_TIMEOUT));
    try {
      const res = await Promise.race([net, timeout]);
      return res || cached;
    } catch (_) {
      return cached;
    }
  })());
});
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "90 Day OPB Bootcamp", {
    body: d.body || "เธงเธฑเธเธเธตเนเธขเธฑเธเนเธกเนเนเธ”เนเธชเนเธเธเธฒเธ โ€” เน€เธซเธฅเธทเธญเน€เธงเธฅเธฒเธญเธตเธเนเธกเนเธเธตเนเธเธฑเนเธงเนเธกเธเธเนเธญเธเธเธดเธ”เธฃเธญเธเธ•เธต 4",
    icon: d.icon || "/icon-192.png",
    badge: d.badge || "/icon-192.png",
    tag: d.tag || "opb-nudge",
    data: { url: d.url || "https://opb-bootcamp.netlify.app/" }
  }));
});
self.addEventListener("notificationclick", e => {
  e.notification.close();
  const url = (e.notification.data && e.notification.data.url) || "/";
  e.waitUntil(self.clients.matchAll({ type: "window", includeUncontrolled: true }).then(cs => {
    const c = cs.find(x => x.url.startsWith(self.location.origin));
    if (c) { c.focus(); c.navigate(url); } else self.clients.openWindow(url);
  }));
});
