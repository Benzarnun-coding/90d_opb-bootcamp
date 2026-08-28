// ============================================================
// Supabase Edge Function — notify
//
// หยิบข้อความจากคิว public.notifications แล้วส่งเข้ากลุ่ม LINE ของรุ่น
//
// deploy:
//   supabase functions deploy notify --no-verify-jwt
//
// ตั้งค่า secret ก่อน:
//   supabase secrets set LINE_CHANNEL_TOKEN=xxxx
//   supabase secrets set LINE_TARGET_ID=Cxxxxxxxx        # groupId ของกลุ่มรุ่น
//   supabase secrets set SITE_URL=https://bootcamp.example.com
//
// SUPABASE_URL กับ SUPABASE_SERVICE_ROLE_KEY มีให้อัตโนมัติในรันไทม์
//
// วิธีหา LINE_TARGET_ID: สร้าง Messaging API channel ที่ developers.line.biz
// เชิญบอทเข้ากลุ่มรุ่น แล้วอ่าน groupId จาก webhook event แรกที่เข้ามา
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL  = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY   = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const LINE_TOKEN    = Deno.env.get("LINE_CHANNEL_TOKEN") ?? "";
const LINE_TARGET   = Deno.env.get("LINE_TARGET_ID") ?? "";
const SITE_URL      = Deno.env.get("SITE_URL") ?? "";

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

/* ---------- ประกอบข้อความ ---------- */
function buildText(kind: string, p: Record<string, unknown>): string {
  if (kind === "daily_digest") {
    const notPosted = Number(p.not_posted ?? 0);
    const noPledge  = Number(p.no_pledge ?? 0);
    const lines: string[] = [];

    lines.push(`🏁 วันที่ ${p.day} · สัปดาห์ที่ ${p.week}`);
    lines.push("");

    if (notPosted === 0) {
      lines.push("วันนี้ทุกคนส่งงานครบแล้ว 🎉");
    } else {
      lines.push(`⏳ วันนี้ยังไม่ได้ส่งงาน ${notPosted} คน`);
      lines.push("เหลืออีกไม่กี่ชั่วโมงก่อนปิดรอบตี 4");
      if (p.names) lines.push("");
      if (p.names) lines.push(String(p.names));
    }

    if (noPledge > 0) {
      lines.push("");
      lines.push(`📝 ยังไม่ได้เลือกเป้าของสัปดาห์นี้ ${noPledge} คน`);
    }

    if (p.houses) {
      lines.push("");
      lines.push("ตารางบ้าน");
      lines.push(String(p.houses));
    }

    if (SITE_URL) {
      lines.push("");
      lines.push(SITE_URL);
    }
    return lines.join("\n");
  }

  if (kind === "week_start") {
    return `📅 สัปดาห์ที่ ${p.week} เริ่มแล้ว\n`
         + `อย่าลืมเข้าไปเลือกเป้าของสัปดาห์นี้ 4 / 7 / 10 ชิ้น\n`
         + (Number(p.week) >= 7 ? "สัปดาห์นี้ PRO MAX 14 ชิ้นเปิดแล้ว 🔥\n" : "")
         + (SITE_URL ? SITE_URL : "");
  }

  if (kind === "personal_nudge") {
    return `${p.name} เหลืออีก ${p.remaining} ชิ้นถึงเป้าสัปดาห์นี้ `
         + `และเหลือเวลาอีก ${p.days_left} วัน`;
  }

  return JSON.stringify(p);
}

/* ---------- ส่งเข้า LINE ---------- */
async function pushLine(text: string): Promise<void> {
  if (!LINE_TOKEN || !LINE_TARGET) throw new Error("ยังไม่ได้ตั้ง LINE_CHANNEL_TOKEN หรือ LINE_TARGET_ID");
  const res = await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "Authorization": `Bearer ${LINE_TOKEN}`,
    },
    body: JSON.stringify({
      to: LINE_TARGET,
      messages: [{ type: "text", text: text.slice(0, 4900) }],
    }),
  });
  if (!res.ok) throw new Error(`LINE ${res.status}: ${await res.text()}`);
}

/* ---------- main ---------- */
Deno.serve(async (req) => {
  try {
    const { data: queue, error } = await db
      .from("notifications")
      .select("id,kind,payload")
      .is("sent_at", null)
      .lte("send_after", new Date().toISOString())
      .order("id")
      .limit(20);

    if (error) throw error;
    if (!queue || queue.length === 0) {
      return new Response(JSON.stringify({ sent: 0, note: "คิวว่าง" }), {
        headers: { "Content-Type": "application/json" },
      });
    }

    let sent = 0;
    const failures: string[] = [];

    for (const row of queue) {
      const text = buildText(row.kind, row.payload ?? {});
      try {
        await pushLine(text);
        await db.from("notifications")
          .update({ sent_at: new Date().toISOString(), error: null })
          .eq("id", row.id);
        sent++;
      } catch (e) {
        const msg = e instanceof Error ? e.message : String(e);
        failures.push(`#${row.id}: ${msg}`);
        // บันทึก error ไว้แต่ไม่ mark ว่าส่งแล้ว จะได้ลองใหม่รอบหน้า
        await db.from("notifications").update({ error: msg }).eq("id", row.id);
      }
    }

    return new Response(JSON.stringify({ sent, failed: failures.length, failures }), {
      headers: { "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : String(e);
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
