// ============================================================
// Supabase Edge Function — sheet-sync
//
// ดึงฟอร์มสมัคร (ชีทหลัก) + ฟอร์ม TA จาก Google Sheets เป็น CSV แล้วซิงก์เข้า roster
//   กติกา: เพิ่มคนที่ยังไม่มี · ย้ายบ้านตามชีท (แถวล่าสุดของอีเมลนั้นชนะ) · ไม่ลบใคร
//           อีเมลในฟอร์ม TA → role = ta (โปรไฟล์ที่สมัครแล้วเป็น coach ประจำบ้าน)
//   เรียกจาก pg_cron ทุกชั่วโมง ด้วย header x-cron-key (ใช้ PUSH_CRON_KEY เดิม)
//   body {"dry": true} = แค่รายงาน ไม่เขียน
//
// secrets: SHEET_MAIN_CSV, SHEET_TA_CSV (ลิงก์ CSV ที่เปิดอ่านได้ไม่ต้องล็อกอิน เช่น
//          https://docs.google.com/spreadsheets/d/<id>/gviz/tq?tqx=out:csv&gid=<gid>  หรือ ลิงก์ "เผยแพร่เป็น CSV")
//          PUSH_CRON_KEY, SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY
// ============================================================
import { createClient } from "npm:@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY  = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const CRON_KEY     = Deno.env.get("PUSH_CRON_KEY") ?? "";
const MAIN_CSV     = Deno.env.get("SHEET_MAIN_CSV") ?? "";
const TA_CSV       = Deno.env.get("SHEET_TA_CSV") ?? "";
const HOUSES: Record<string, number> = { WISDOM: 1, JUSTICE: 2, COURAGE: 3, DISCIPLINE: 4 };
const EMAIL_RE = /[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}/;

const db = createClient(SUPABASE_URL, SERVICE_KEY, { auth: { persistSession: false } });

/* CSV เล็ก ๆ รองรับช่องที่มีเครื่องหมายคำพูดและคอมมา */
function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = []; let cell = ""; let q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) {
      if (c === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; }
      else cell += c;
    } else if (c === '"') q = true;
    else if (c === ",") { row.push(cell); cell = ""; }
    else if (c === "\n") { row.push(cell); rows.push(row); row = []; cell = ""; }
    else if (c !== "\r") cell += c;
  }
  if (cell.length || row.length) { row.push(cell); rows.push(row); }
  return rows;
}

async function fetchCsv(url: string): Promise<string[][] | null> {
  if (!url) return null;
  const r = await fetch(url, { redirect: "follow" });
  if (!r.ok) { console.error("csv fetch failed", url.slice(0, 60), r.status); return null; }
  const t = await r.text();
  if (t.trimStart().startsWith("<")) { console.error("csv is HTML (sheet not shared)"); return null; }
  return parseCsv(t);
}

/* ชีทหลัก: อีเมล + บ้าน (แถวล่าสุดของอีเมลชนะ) */
function readMain(rows: string[][]): Map<string, number> {
  const out = new Map<string, number>();
  for (const r of rows.slice(1)) {
    const line = r.join(" ");
    const em = (line.match(EMAIL_RE) || [])[0]; if (!em || em.toLowerCase() === "jj@gmail.com") continue;
    const up = line.toUpperCase(); const key = Object.keys(HOUSES).find(k => up.includes(k)); if (!key) continue;
    out.set(em.toLowerCase().replace(/\\_/g, "_"), HOUSES[key]);
  }
  return out;
}
function readTa(rows: string[][]): Set<string> {
  const out = new Set<string>();
  for (const r of rows.slice(1)) { const em = (r.join(" ").match(EMAIL_RE) || [])[0]; if (em) out.add(em.toLowerCase()); }
  return out;
}

Deno.serve(async (req) => {
  if (!CRON_KEY || (req.headers.get("x-cron-key") ?? "") !== CRON_KEY) return new Response("forbidden", { status: 403 });
  let body: Record<string, unknown> = {}; try { body = await req.json(); } catch (_) { /* none */ }
  const dry = body.dry === true;

  const mainRows = await fetchCsv(MAIN_CSV);
  const taRows   = await fetchCsv(TA_CSV);
  if (!mainRows && !taRows) return Response.json({ error: "no sheet readable — share the sheets (anyone with link, viewer) or publish as CSV", main: !!MAIN_CSV, ta: !!TA_CSV }, { status: 424 });

  const { data: roster, error } = await db.from("roster").select("email,house_id,role,claimed_by");
  if (error) return Response.json({ error: error.message }, { status: 500 });
  const cur = new Map((roster ?? []).map(r => [String(r.email).toLowerCase(), r]));

  const added: string[] = [], moved: string[] = [], newTa: string[] = [], taMissing: string[] = [];

  if (mainRows) {
    const sheet = readMain(mainRows);
    for (const [em, hid] of sheet) {
      const r = cur.get(em);
      if (!r) {
        added.push(`${em},${hid}`);
        if (!dry) { const { error: e } = await db.from("roster").insert({ email: em, house_id: hid }); if (e) console.error("insert", em, e.message); }
      } else if (r.house_id !== hid && r.role !== "ta") {
        moved.push(`${em},${r.house_id}->${hid}`);
        if (!dry) {
          await db.from("roster").update({ house_id: hid }).eq("email", em);
          if (r.claimed_by) await db.from("profiles").update({ house_id: hid }).eq("id", r.claimed_by).eq("role", "student");
        }
      }
    }
  }
  if (taRows) {
    const tas = readTa(taRows);
    for (const em of tas) {
      const r = cur.get(em);
      if (!r) { taMissing.push(em); continue; }         // ยังไม่มีในชีทหลัก → รอให้กรอกฟอร์มสมัครก่อน
      if (r.role === "ta") continue;
      newTa.push(em);
      if (!dry) {
        await db.from("roster").update({ role: "ta" }).eq("email", em);
        if (r.claimed_by) await db.from("profiles").update({ role: "coach" }).eq("id", r.claimed_by).eq("role", "student");
      }
    }
  }
  if (!dry && (added.length || moved.length || newTa.length)) {
    await db.from("audit_log").insert({ actor: null, actor_name: "sheet-sync", action: "sheet.sync",
      target: null, detail: { added, moved, newTa, taMissing } });
  }
  return Response.json({ dry, added, moved, newTa, taMissing, rosterBefore: cur.size });
});
