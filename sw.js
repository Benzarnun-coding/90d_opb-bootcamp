/* Service worker — รับ Web Push + ให้ติดตั้งเป็นแอปได้
   แคชแบบ network-first แต่มีเพดานเวลา: ออนไลน์ได้ของใหม่เสมอ
   ถ้าเน็ตอืดเกิน 4 วินาที (เน็ตมือถือสัญญาณอ่อน) ให้หยิบของเก่าจากแคชมาใช้ก่อน
   ของเดิมไม่มีเพดานเวลา จึงค้างรอเน็ตไปเรื่อย ๆ ทั้งที่มีของในแคชพร้อมใช้อยู่แล้ว */
const CACHE = "opb-v8";
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
    /* ยิงเน็ตไปตามปกติ และเก็บลงแคชทุกครั้งที่สำเร็จ ไม่ว่าจะทันเพดานเวลาหรือไม่ */
    const net = fetch(req).then(res => {
      /* ไม่แคชไฟล์เพลง/คำตอบบางส่วน (206) — เบราว์เซอร์ขอเพลงเป็นช่วง ๆ ถ้าเก็บช่วงเดียวไว้จะเล่นต่อไม่ได้ */
      if (res.ok && res.status !== 206 && !/\.(mp3|ogg|m4a|wav)(\?|$)/i.test(req.url)) caches.open(CACHE).then(c => c.put(req, res.clone())).catch(() => {});
      return res;
    });
    net.catch(() => {});                       // กัน unhandled rejection ตอนเราไม่ได้รอมัน

    const cached = await caches.match(req);
    if (!cached) {                             // ไม่มีของเก่าให้ใช้ ก็ต้องรอเน็ตอย่างเดียว
      try { return await net; }
      catch (err) {
        if (req.mode === "navigate") { const idx = await caches.match("/"); if (idx) return idx; }
        throw err;
      }
    }

    /* มีของเก่าอยู่: รอเน็ตแค่ 4 วินาที เกินกว่านั้นเสิร์ฟของเก่าไปก่อน
       แคชจะถูกอัปเดตอยู่ดีเมื่อ net วิ่งจบ รอบหน้าจึงได้ของใหม่ */
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
