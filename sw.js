/* Service worker — รับ Web Push + ให้ติดตั้งเป็นแอปได้
   แคชแบบ network-first: ออนไลน์ได้ของใหม่เสมอ ออฟไลน์ค่อยใช้ของที่เคยโหลด */
const CACHE = "opb-v1";
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil((async () => {
  const keys = await caches.keys(); await Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)));
  await self.clients.claim();
})()));
self.addEventListener("fetch", e => {
  const req = e.request;
  if (req.method !== "GET" || new URL(req.url).origin !== self.location.origin) return;
  e.respondWith((async () => {
    try {
      const res = await fetch(req);
      if (res.ok) { const c = await caches.open(CACHE); c.put(req, res.clone()); }
      return res;
    } catch (_) {
      const hit = await caches.match(req);
      if (hit) return hit;
      if (req.mode === "navigate") { const idx = await caches.match("/"); if (idx) return idx; }
      throw _;
    }
  })());
});
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "90 Day OPB Bootcamp", {
    body: d.body || "วันนี้ยังไม่ได้ส่งงาน — เหลือเวลาอีกไม่กี่ชั่วโมงก่อนปิดรอบตี 4",
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
