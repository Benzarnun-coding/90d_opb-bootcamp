/* Service worker — รับ Web Push แล้วเด้งแจ้งเตือน (ไม่แคชอะไร) */
self.addEventListener("install", () => self.skipWaiting());
self.addEventListener("activate", e => e.waitUntil(self.clients.claim()));
self.addEventListener("push", e => {
  let d = {};
  try { d = e.data ? e.data.json() : {}; } catch (_) { d = { body: e.data && e.data.text() }; }
  e.waitUntil(self.registration.showNotification(d.title || "90 Day OPB Bootcamp", {
    body: d.body || "วันนี้ยังไม่ได้ส่งงาน — เหลือเวลาอีกไม่กี่ชั่วโมงก่อนปิดรอบตี 4",
    icon: d.icon || "https://opb-bootcamp.netlify.app/icon.png",
    badge: d.badge || undefined,
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
