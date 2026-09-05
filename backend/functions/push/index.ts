// ============================================================
// Supabase Edge Function — push
//
// ส่ง Web Push เตือน "วันนี้ยังไม่ได้ส่งงาน" ให้คนที่เปิดแจ้งเตือนไว้
// เรียกจาก pg_cron ทุกวัน 13:00 UTC (20:00 ไทย) ด้วย header x-cron-key
//
// secrets ที่ต้องมี: VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT (mailto:), PUSH_CRON_KEY
// SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY มีให้อัตโนมัติ
//
// body (optional): { "profile_id": "<uuid>", "title": "...", "body": "..." }  → ส่งทดสอบให้คนเดียวทันที
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";
import webpush from "npm:web-push@3.6.7";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const VAPID_PUBLIC = Deno.env.get("VAPID_PUBLIC") ?? "";
const VAPID_PRIVATE= Deno.env.get("VAPID_PRIVATE") ?? "";
const VAPID_SUBJECT= Deno.env.get("VAPID_SUBJECT") ?? "mailto:arnun.tre@benzarnun.com";
const CRON_KEY     = Deno.env.get("PUSH_CRON_KEY") ?? "";
const SITE_URL     = Deno.env.get("SITE_URL") ?? "https://opb-bootcamp.netlify.app";

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC, VAPID_PRIVATE);

type Sub = { profile_id: string; endpoint: string; p256dh: string; auth: string };

async function sendAll(subs: Sub[], payload: Record<string, unknown>) {
  let sent = 0, dropped = 0, failed = 0;
  await Promise.all(subs.map(async (s) => {
    try {
      await webpush.sendNotification({ endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } }, JSON.stringify(payload), { TTL: 6 * 3600 });
      sent++;
    } catch (e) {
      const code = (e as { statusCode?: number }).statusCode;
      if (code === 404 || code === 410) { dropped++; await db.from("push_subs").delete().eq("endpoint", s.endpoint); }
      else { failed++; console.error("push fail", code, (e as Error).message); }
    }
  }));
  return { sent, dropped, failed };
}

Deno.serve(async (req) => {
  const key = req.headers.get("x-cron-key") ?? "";
  if (!CRON_KEY || key !== CRON_KEY) return new Response("forbidden", { status: 403 });
  if (!VAPID_PUBLIC || !VAPID_PRIVATE) return Response.json({ error: "VAPID keys missing" }, { status: 500 });

  let body: Record<string, unknown> = {};
  try { body = await req.json(); } catch (_) { /* no body */ }

  /* ส่งทดสอบให้คนเดียว */
  if (typeof body.profile_id === "string") {
    const { data: subs } = await db.from("push_subs").select("profile_id,endpoint,p256dh,auth").eq("profile_id", body.profile_id);
    const r = await sendAll((subs ?? []) as Sub[], {
      title: (body.title as string) || "90 Day OPB Bootcamp",
      body: (body.body as string) || "ทดสอบการแจ้งเตือน 🔔 ทำงานแล้ว",
      url: SITE_URL, tag: "opb-test",
    });
    return Response.json({ mode: "test", subs: (subs ?? []).length, ...r });
  }

  /* เตือนประจำวัน: คนที่ลงสปรินต์ไว้แต่วันนี้ยังไม่ส่ง และเปิด push ไว้ */
  const { data: need, error } = await db.from("v_needs_nudge").select("id,name,remaining,days_left_in_week,week_target,week_done");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const ids = (need ?? []).map((x) => x.id as string);
  if (!ids.length) return Response.json({ mode: "daily", need: 0, sent: 0 });

  const { data: subs } = await db.from("push_subs").select("profile_id,endpoint,p256dh,auth").in("profile_id", ids);
  const byId = new Map<string, typeof need[number]>(); (need ?? []).forEach((x) => byId.set(x.id as string, x));

  let sent = 0, dropped = 0, failed = 0;
  for (const s of (subs ?? []) as Sub[]) {
    const n = byId.get(s.profile_id);
    const left = n ? Number(n.remaining) : 0;
    const bodyTxt = left > 0
      ? `ยังไม่ได้ส่งงานวันนี้ · เป้าสัปดาห์นี้เหลืออีก ${left} ชิ้น (${n?.week_done}/${n?.week_target}) — ปิดรอบตี 4`
      : "ยังไม่ได้ส่งงานวันนี้ — ส่งสักชิ้นก่อนปิดรอบตี 4 รักษา streak ไว้ 🔥";
    const r = await sendAll([s], { title: `🔥 ${n?.name ?? ""} ยังไม่ได้ส่งงานวันนี้`, body: bodyTxt, url: SITE_URL, tag: "opb-nudge" });
    sent += r.sent; dropped += r.dropped; failed += r.failed;
  }
  return Response.json({ mode: "daily", need: ids.length, subs: (subs ?? []).length, sent, dropped, failed });
});
