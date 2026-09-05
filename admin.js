/* ============================================================
   ADMIN — หน้าจัดการรายชื่อสำหรับหัวหน้าโค้ช
   เพิ่มคน / ย้ายบ้าน / ลบ / เตะออก   ใช้ config.js เดียวกับหน้าเกม
   ============================================================ */
"use strict";
const C = window.CFG;
const $ = id => document.getElementById(id);
const HOUSES = [
  {id:1, name:"WISDOM",     th:"ปัญญา",    color:"#4ee1ff", emoji:"🦉"},
  {id:2, name:"JUSTICE",    th:"ยุติธรรม", color:"#ffcc4d", emoji:"⚖️"},
  {id:3, name:"COURAGE",    th:"ความกล้า", color:"#ff4d6d", emoji:"🦁"},
  {id:4, name:"DISCIPLINE", th:"วินัย",    color:"#5ef08c", emoji:"🛡️"}
];
const houseOf = id => HOUSES.find(h=>h.id===id) || HOUSES[0];
const esc = s => String(s==null?"":s).replace(/[&<>"]/g, c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));

let toastT;
function toast(msg){
  const t=$("toast"); t.innerHTML=msg; t.classList.add("on");
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),3400);
}
function show(id){ document.querySelectorAll(".screen").forEach(s=>s.classList.toggle("on", s.id===id)); }

if(!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY)){
  document.body.innerHTML = '<div class="wrap"><div class="card bevel"><div class="body">ยังไม่ได้ใส่คีย์ Supabase ใน config.js</div></div></div>';
  throw new Error("no supabase config");
}
const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);

/* ================= STATE ================= */
let roster = [], names = {}, filter = "all", houseFilter = 0, q = "";

/* ================= AUTH ================= */
async function boot(){
  document.title = "ADMIN · " + C.TITLE;
  $("ttl").textContent = "ADMIN · " + C.TITLE;
  const {data:{session}} = await sb.auth.getSession();
  if(!session){ show("scLogin"); return; }
  const {data:head, error} = await sb.rpc("is_head_coach");
  if(error){ toast(error.message); show("scLogin"); return; }
  if(!head){ $("deniedWho").textContent = session.user.email; show("scDenied"); return; }
  $("who").textContent = session.user.email;
  show("scAdmin");
  await load();
  const {data:co} = await sb.from("cohort").select("discord_webhook").eq("id",1).maybeSingle();
  if(co && co.discord_webhook) $("dcHook").value = co.discord_webhook;
  await loadBosses();
}
/* ---- บอสประจำสัปดาห์ ---- */
let curWeekNo = 1, curSkin = "ogre";
function renderSkins(){
  $("bsSkins").innerHTML = BOSS_SKINS.map(s=>`<div class="skinOpt ${s.k===curSkin?"on":""}" data-skin="${s.k}">${bossSprite(s.k,3)}<small>${s.e} ${s.n}</small></div>`).join("");
}
$("bsSkins").onclick = e=>{
  const o = e.target.closest("[data-skin]"); if(!o) return;
  curSkin = o.dataset.skin; renderSkins();
  if(!$("bsName").value.trim()) $("bsName").placeholder = bossSkin(curSkin).n;
};
renderSkins();
async function loadBosses(){
  $("bsHouse").innerHTML = '<option value="">🌏 ทั้งรุ่นช่วยกัน</option>' + HOUSES.map(h=>`<option value="${h.id}">${h.emoji} ${h.name}</option>`).join("");
  try{ const {data:cs} = await sb.rpc("cohort_status"); const row = Array.isArray(cs) ? cs[0] : cs;
    if(row && row.day_index){ curWeekNo = Math.max(1, Math.ceil(Number(row.day_index)/7)); if(!$("bsWeek").dataset.touched) $("bsWeek").value = curWeekNo; } }catch(e){}
  const {data, error} = await sb.from("v_boss_progress").select("*").order("week_no").order("house_id");
  if(error){ toast("อ่านบอสไม่ได้: "+error.message); return; }
  const list = data || [];
  $("bsList").innerHTML = list.length ? list.map(b=>{
    const pct = Math.min(100, b.damage/b.hp*100), dead = b.damage >= b.hp, h = b.house_id ? houseOf(b.house_id) : null;
    const state = b.week_no < curWeekNo ? (dead ? "ล้มแล้ว ✅" : "หมดเวลา ❌") : b.week_no > curWeekNo ? "รอสัปดาห์นั้น" : (dead ? "ล้มแล้ว 💥" : "กำลังสู้");
    return `<tr style="${b.week_no===curWeekNo?"":"opacity:.6"}">
      <td>${b.week_no}${b.week_no===curWeekNo?" ◀":""}</td>
      <td>${h ? h.emoji+" "+h.name : "🌏 ทั้งรุ่น"}</td>
      <td><span style="display:inline-block;vertical-align:middle;margin-right:6px">${bossSprite(b.skin||"ogre",2)}</span><b>${esc(b.name)}</b>${b.reward?`<br><small style="color:var(--dim)">🎁 ${esc(b.reward)}</small>`:""}</td>
      <td>${b.hp}</td>
      <td style="min-width:180px"><div style="height:14px;background:#0b0316;border:2px solid #5b1a8a;position:relative"><i style="position:absolute;inset:0;width:${pct}%;background:${dead?"#20c060":"linear-gradient(90deg,#ff2d55,#ff8a00)"}"></i></div>
        <small>${b.damage}/${b.hp} ดาเมจ · ${b.fighters} คน · ${state}</small></td>
      <td><button class="btn sm danger" data-bsdel="${b.id}" data-nm="${esc(b.name)}">ลบ</button></td></tr>`; }).join("")
    : '<tr><td colspan="6" style="color:var(--dim);padding:16px">ยังไม่มีบอส — ตั้งตัวแรกได้เลย</td></tr>';
}
$("bsWeek").oninput = ()=>{ $("bsWeek").dataset.touched = "1"; };
$("bsAdd").onclick = async ()=>{
  const week_no = +$("bsWeek").value, name = $("bsName").value.trim() || bossSkin(curSkin).n, hp = +$("bsHp").value, skin = curSkin, emoji = bossSkin(skin).e;
  const house_id = $("bsHouse").value ? +$("bsHouse").value : null, reward = $("bsReward").value.trim() || null;
    if(!(week_no>=1) || !(hp>=1)) return toast("สัปดาห์/HP ไม่ถูกต้อง");
  $("bsAdd").disabled = true;
  const {error} = await sb.from("bosses").insert({week_no, house_id, name, emoji, skin, hp, reward});
  $("bsAdd").disabled = false;
  if(error) return toast(error.message);
  toast(`ปล่อย ${emoji} ${name} แล้ว (สัปดาห์ ${week_no})`);
  $("bsName").value = ""; $("bsReward").value = "";
  await loadBosses();
};
$("bsList").onclick = async e=>{
  const b = e.target.closest("button[data-bsdel]"); if(!b) return;
  if(!confirm(`ลบบอส "${b.dataset.nm}"?`)) return;
  const {error} = await sb.from("bosses").delete().eq("id", +b.dataset.bsdel);
  if(error) return toast(error.message);
  toast("ลบบอสแล้ว"); await loadBosses();
};
/* ---- Discord ---- */
$("dcSave").onclick = async ()=>{
  const url = $("dcHook").value.trim();
  if(url && !/^https:\/\/(discord\.com|discordapp\.com)\/api\/webhooks\//.test(url)) return toast("ต้องเป็นลิงก์ webhook ของ Discord");
  const {error} = await sb.from("cohort").update({discord_webhook: url||null}).eq("id",1);
  if(error) return toast(error.message);
  toast(url ? "บันทึก webhook แล้ว" : "ลบ webhook แล้ว");
};
$("dcTest").onclick = async ()=>{
  $("dcTest").disabled = true;
  const {error} = await sb.rpc("notify_discord", {msg: "✅ ทดสอบจากหน้า admin — ถ้าเห็นข้อความนี้ แจ้งเตือนอัตโนมัติพร้อมแล้ว 🏁"});
  $("dcTest").disabled = false;
  if(error) return toast(error.message);
  toast("ส่งแล้ว ดูในช่อง Discord");
};
$("dcDigest").onclick = async ()=>{
  $("dcDigest").disabled = true;
  const {data, error} = await sb.rpc("digest_text");
  if(error){ $("dcDigest").disabled = false; return toast(error.message); }
  if(!data){ $("dcDigest").disabled = false; return toast("รุ่นยังไม่เปิด ยังไม่มีสรุป"); }
  const r2 = await sb.rpc("notify_discord", {msg: data});
  $("dcDigest").disabled = false;
  if(r2.error) return toast(r2.error.message);
  toast("ส่งสรุปแล้ว");
};
$("lgBtn").onclick = async ()=>{
  const email=$("lgEmail").value.trim(), password=$("lgPass").value;
  if(!email || !password) return toast("ใส่อีเมลกับรหัสก่อน");
  $("lgBtn").disabled = true;
  const {error} = await sb.auth.signInWithPassword({email, password});
  $("lgBtn").disabled = false;
  if(error) return toast(/invalid/i.test(error.message) ? "อีเมลหรือรหัสไม่ถูก" : error.message);
  boot();
};
$("lgPass").onkeydown = e => { if(e.key==="Enter") $("lgBtn").click(); };
$("outBtn").onclick = $("deniedOut").onclick = async ()=>{ await sb.auth.signOut(); location.reload(); };

/* ================= DATA ================= */
async function load(){
  const [{data:r, error:e1}, {data:p}] = await Promise.all([
    sb.from("roster").select("email,house_id,full_name,claimed_by,claimed_at,added_at,role").order("house_id").order("email"),
    sb.from("profiles").select("id,name,role,house_id")
  ]);
  if(e1){ toast("อ่านรายชื่อไม่ได้: "+e1.message); return; }
  roster = r || [];
  names = {}; (p||[]).forEach(x=>{ names[x.id] = x; });
  render();
}

/* ================= RENDER ================= */
function render(){
  /* การ์ดบ้าน */
  $("houses").innerHTML = HOUSES.map(h=>{
    const rows = roster.filter(x=>x.house_id===h.id);
    const joined = rows.filter(x=>x.claimed_by).length;
    return `<div class="houseCard ${houseFilter===h.id?"on":""}" data-h="${h.id}"
      style="border-color:${h.color} #100c2c #100c2c ${h.color}">
      <div class="hr">${h.emoji}</div>
      <div class="hn" style="color:${h.color}">${h.name}</div>
      <div class="hv">${joined}<span style="font-size:16px;color:var(--dim)"> / ${rows.length}</span></div>
      <div class="hl">${h.th} · สมัครแล้ว / มีชื่อ</div></div>`;
  }).join("");

  /* ตัวเลือกบ้านในฟอร์มเพิ่ม */
  if(!$("adHouse").options.length)
    $("adHouse").innerHTML = HOUSES.map(h=>`<option value="${h.id}">${h.emoji} ${h.name} · ${h.th}</option>`).join("");

  /* ตาราง */
  const qq = q.toLowerCase();
  let list = roster.filter(x =>
    (houseFilter===0 || x.house_id===houseFilter) &&
    (filter==="all" || (filter==="claimed" ? !!x.claimed_by : !x.claimed_by)) &&
    (!qq || x.email.toLowerCase().includes(qq) || (x.full_name||"").toLowerCase().includes(qq)
         || ((names[x.claimed_by]||{}).name||"").toLowerCase().includes(qq)));

  const sel = (x) => `<select data-move="${esc(x.email)}">` + HOUSES.map(h=>
    `<option value="${h.id}" ${h.id===x.house_id?"selected":""}>${h.emoji} ${h.name}</option>`).join("") + `</select>`;

  $("rows").innerHTML = list.length ? list.map((x,i)=>{
    const pr = names[x.claimed_by];
    const curRole = !pr ? (x.role==="ta" ? "ta" : "student") : pr.role!=="coach" ? "student" : (pr.house_id ? "ta" : "head");
    const roleSel = `<select data-role="${esc(x.email)}" style="min-width:150px">
           <option value="student" ${curRole==="student"?"selected":""}>นักเรียน</option>
           <option value="ta" ${curRole==="ta"?"selected":""}>TA · ชื่อเขียว</option>
           ${x.claimed_by ? `<option value="head" ${curRole==="head"?"selected":""}>หัวหน้าโค้ช · ชื่อแดง</option>` : ""}
         </select>`;
    const st = x.claimed_by
      ? `<span class="tag ok">${esc(pr ? pr.name : "?")}</span> ${roleSel}`
      : `<span class="tag no">ยังไม่สมัคร</span> ${roleSel}`;
    const act = x.claimed_by
      ? `<button class="btn xs danger" data-kick="${esc(x.email)}">เตะออก</button>`
      : `<button class="btn xs" data-del="${esc(x.email)}">ลบ</button>`;
    return `<tr>
      <td style="color:var(--dim)">${i+1}</td>
      <td>${esc(x.email)}</td>
      <td class="hideSm" style="color:var(--dim)">${esc(x.full_name||"—")}</td>
      <td>${sel(x)}</td>
      <td>${st}</td>
      <td style="text-align:right">${act}</td></tr>`;
  }).join("") : `<tr><td colspan="6" style="text-align:center;color:var(--dim);padding:26px">ไม่มีรายชื่อในกลุ่มนี้</td></tr>`;

  const total = roster.length, joined = roster.filter(x=>x.claimed_by).length;
  $("listTitle").textContent = houseFilter ? `${houseOf(houseFilter).emoji} ${houseOf(houseFilter).name}` : "รายชื่อทั้งหมด";
  $("listSub").textContent = `แสดง ${list.length} · ทั้งรุ่น ${total} คน สมัครแล้ว ${joined} ยังไม่สมัคร ${total-joined}`;
}

/* ================= EVENTS ================= */
$("houses").onclick = e => {
  const c = e.target.closest(".houseCard"); if(!c) return;
  const id = +c.dataset.h;
  houseFilter = houseFilter===id ? 0 : id;
  $("adHouse").value = String(houseFilter || $("adHouse").value);
  render();
};
document.querySelector(".filters").onclick = e => {
  const b = e.target.closest(".fBtn"); if(!b) return;
  filter = b.dataset.f;
  document.querySelectorAll(".fBtn").forEach(x=>x.classList.toggle("on", x===b));
  render();
};
$("q").oninput = e => { q = e.target.value.trim(); render(); };

/* เพิ่มคน — วางได้ทั้งแถวจาก Google Sheets/Forms
   - หาอีเมลจากตรงไหนของบรรทัดก็ได้ (คอลัมน์แรกจะเป็น timestamp ก็ไม่เป็นไร)
   - ถ้าในบรรทัดมีชื่อบ้าน (WISDOM/JUSTICE/COURAGE/DISCIPLINE) ใช้บ้านนั้น ไม่งั้นใช้ที่เลือกในช่อง
   - อีเมลที่มีอยู่แล้ว = "แอดทับ" ย้ายไปบ้านใหม่ (หนึ่งอีเมลอยู่ได้บ้านเดียว)
   - ส่งเป็นชุดละ 150 แถว กี่ร้อยคนก็ได้ */
const EMAIL_RE = /[A-Za-z0-9._%+\-]+@[A-Za-z0-9.\-]+\.[A-Za-z]{2,}/;
function houseInLine(line){
  const u = line.toUpperCase();
  const hit = HOUSES.find(h=>u.includes(h.name));
  return hit ? hit.id : 0;
}
$("adAdd").onclick = async ()=>{
  const lines = $("adEmails").value.split(/[\n\r]+/).map(s=>s.trim()).filter(Boolean);
  const defHouse = +$("adHouse").value;
  const cur = {}; roster.forEach(x=>{ cur[x.email.toLowerCase()] = x; });
  const rows = [], bad = [];
  const seen = new Map();                       // email → row (บรรทัดหลังชนะ)
  lines.forEach(line=>{
    const m = line.match(EMAIL_RE);
    if(!m){ bad.push(line); return; }
    const em = m[0].toLowerCase();
    const house = houseInLine(line) || defHouse;
    /* ชื่อ = ข้อความที่เหลือหลังตัดอีเมล/วันที่/ชื่อบ้านออก (ถ้ามี) */
    let name = line.replace(m[0],"").replace(/\d{1,2}\/\d{1,2}\/\d{2,4}[^\t,|]*/g,"").replace(/[\t,|]+/g," ").trim();
    if(/WISDOM|JUSTICE|COURAGE|DISCIPLINE/i.test(name) || name.length>60) name = "";
    seen.set(em, {email:em, house_id:house, full_name:name||null});
  });
  const all = [...seen.values()];
  if(!all.length){
    $("adResult").innerHTML = '<span style="color:var(--red)">ไม่เจออีเมลในข้อความที่วาง</span>' + (bad.length ? `<br>ไม่ใช่อีเมล ${bad.length} บรรทัด` : "");
    return;
  }
  const added = all.filter(r=>!cur[r.email]);
  const moved = all.filter(r=>cur[r.email] && cur[r.email].house_id!==r.house_id);
  const same  = all.filter(r=>cur[r.email] && cur[r.email].house_id===r.house_id);
  /* ไม่ทับชื่อจริงเดิมด้วยค่าว่าง */
  const payload = all.map(r=>({email:r.email, house_id:r.house_id, full_name:r.full_name || (cur[r.email]?cur[r.email].full_name:null)}));

  $("adAdd").disabled = true;
  $("adResult").innerHTML = `กำลังส่ง ${payload.length} รายชื่อ…`;
  let failed = null;
  for(let i=0; i<payload.length; i+=150){
    const {error} = await sb.from("roster").upsert(payload.slice(i,i+150), {onConflict:"email"});
    if(error){ failed = error.message; break; }
  }
  /* คนที่สมัครแล้วและถูกย้ายบ้าน ต้องอัปเดตโปรไฟล์ด้วย (RLS ให้แก้ผ่านฟังก์ชันเท่านั้น) */
  const movedClaimed = moved.filter(r=>cur[r.email].claimed_by);
  for(const r of movedClaimed){
    const {error} = await sb.rpc("admin_set_house", {em:r.email, hid:r.house_id});
    if(error){ failed = failed || error.message; }
  }
  $("adAdd").disabled = false;
  if(failed){ $("adResult").innerHTML = '<span style="color:var(--red)">'+esc(failed)+'</span>'; toast(failed); await load(); return; }
  const byHouse = h => all.filter(r=>r.house_id===h.id).length;
  $("adResult").innerHTML =
    `<b>เพิ่มใหม่ ${added.length}</b> · ย้ายบ้าน ${moved.length}${movedClaimed.length?` (สมัครแล้ว ${movedClaimed.length})`:""} · เหมือนเดิม ${same.length}`
    + `<br>` + HOUSES.map(h=>`${h.emoji} ${h.name} ${byHouse(h)}`).join(" · ")
    + (bad.length ? `<br><span style="color:var(--red)">ข้าม ${bad.length} บรรทัดที่ไม่มีอีเมล</span>` : "");
  $("adEmails").value = "";
  toast(`เพิ่ม ${added.length} · ย้าย ${moved.length}`);
  await load();
};

/* ย้ายบ้าน / ลบ / เตะออก */
$("rows").onchange = async e => {
  const rs = e.target.closest("select[data-role]");
  if(rs){
    rs.disabled = true;
    const {error} = await sb.rpc("admin_set_role", {em: rs.dataset.role, new_role: rs.value});
    if(error){ toast(error.message); await load(); return; }
    toast(`ตั้ง ${rs.dataset.role}<br>เป็น ${rs.options[rs.selectedIndex].text} แล้ว`);
    await load(); return;
  }
  const s = e.target.closest("select[data-move]"); if(!s) return;
  const em = s.dataset.move, hid = +s.value;
  s.disabled = true;
  const {error} = await sb.rpc("admin_set_house", {em, hid});
  if(error){ toast(error.message); await load(); return; }
  toast(`ย้าย ${em}<br>ไป ${houseOf(hid).emoji} ${houseOf(hid).name} แล้ว`);
  await load();
};
$("rows").onclick = async e => {
  const d = e.target.closest("button[data-del]");
  const k = e.target.closest("button[data-kick]");
  if(d){
    const em = d.dataset.del;
    if(!confirm(`ลบ ${em} ออกจากรายชื่อ?\n(คนนี้ยังไม่ได้สมัคร ไม่มีข้อมูลอื่นหาย)`)) return;
    const {error} = await sb.from("roster").delete().eq("email", em);
    if(error) return toast(error.message);
    toast(`ลบ ${em} แล้ว`); await load();
  }
  if(k){
    const em = k.dataset.kick;
    if(!confirm(`เตะ ${em} ออกจากรุ่น?\n\nจะลบบัญชี งานที่ส่งทั้งหมด เป้ารายสัปดาห์ และคะแนนของคนนี้ กู้คืนไม่ได้`)) return;
    const typed = prompt(`ยืนยันอีกครั้ง — พิมพ์อีเมลของคนนี้ให้ตรง:\n${em}`);
    if((typed||"").trim().toLowerCase() !== em.toLowerCase()) return toast("ยกเลิก อีเมลไม่ตรง");
    const {error} = await sb.rpc("admin_kick", {em});
    if(error) return toast(error.message);
    toast(`เตะ ${em} ออกแล้ว`); await load();
  }
};

/* ================= งานที่ส่ง — แก้แพลตฟอร์มให้นักเรียน ================= */
const PLATS = C.PLATFORMS || ["TikTok","YouTube","Instagram","Facebook","X","Blog"];
async function findSubs(){
  const qq = $("sbQ").value.trim().toLowerCase();
  if(!qq) return toast("พิมพ์ชื่อหรืออีเมลก่อน");
  /* หาโปรไฟล์จากอีเมลในรายชื่อ หรือจากชื่อบนสนาม */
  let pid = null, label = "";
  const byEmail = roster.find(x=>x.email.toLowerCase()===qq) || roster.find(x=>x.email.toLowerCase().startsWith(qq));
  if(byEmail && byEmail.claimed_by){ pid = byEmail.claimed_by; label = ((names[pid]||{}).name||"?")+" · "+byEmail.email; }
  if(!pid){
    const hit = Object.values(names).find(p=>(p.name||"").toLowerCase()===qq) || Object.values(names).find(p=>(p.name||"").toLowerCase().includes(qq));
    if(hit){ pid = hit.id; const em = roster.find(x=>x.claimed_by===hit.id); label = hit.name + (em?" · "+em.email:""); }
  }
  if(!pid){ $("sbWho").textContent=""; $("sbList").innerHTML = '<tr><td colspan="5" style="color:var(--dim);padding:16px">ไม่เจอคนนี้ (ต้องสมัครแล้วถึงจะมีงาน)</td></tr>'; return; }
  const {data, error} = await sb.from("submissions").select("id,platform,url,day_index,created_at,status")
    .eq("profile_id", pid).order("created_at",{ascending:false}).limit(40);
  if(error) return toast(error.message);
  $("sbWho").textContent = label + ` · ${(data||[]).length} ชิ้นล่าสุด`;
  $("sbList").innerHTML = (data||[]).length ? data.map(s=>`<tr>
      <td style="color:var(--dim);white-space:nowrap">วันที่ ${s.day_index}</td>
      <td><select data-sub="${s.id}">${PLATS.map(p=>`<option ${p===s.platform?"selected":""}>${p}</option>`).join("")}</select></td>
      <td style="max-width:420px;overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><a href="${esc(s.url)}" target="_blank" rel="noopener" style="color:var(--cyan)">${esc(s.url)}</a></td>
      <td style="color:var(--dim);font-size:12px;white-space:nowrap">${new Date(s.created_at).toLocaleString("th-TH")}</td>
      <td>${s.status!=="approved"?`<span class="tag no">${esc(s.status)}</span>`:""}</td></tr>`).join("")
    : '<tr><td colspan="5" style="color:var(--dim);padding:16px">ยังไม่มีงานที่ส่ง</td></tr>';
}
$("sbFind").onclick = findSubs;
$("sbQ").onkeydown = e => { if(e.key==="Enter") findSubs(); };
$("sbList").onchange = async e => {
  const s = e.target.closest("select[data-sub]"); if(!s) return;
  s.disabled = true;
  const {error} = await sb.from("submissions").update({platform: s.value}).eq("id", +s.dataset.sub);
  s.disabled = false;
  if(error) return toast(error.message);
  toast(`เปลี่ยนเป็น ${s.value} แล้ว`);
};

boot();
