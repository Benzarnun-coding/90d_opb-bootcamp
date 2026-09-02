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
}
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
    sb.from("roster").select("email,house_id,full_name,claimed_by,claimed_at,added_at").order("house_id").order("email"),
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
    const curRole = !pr ? "" : pr.role!=="coach" ? "student" : (pr.house_id ? "ta" : "head");
    const st = x.claimed_by
      ? `<span class="tag ok">${esc(pr ? pr.name : "?")}</span>
         <select data-role="${esc(x.email)}" style="min-width:150px">
           <option value="student" ${curRole==="student"?"selected":""}>นักเรียน</option>
           <option value="ta" ${curRole==="ta"?"selected":""}>TA · ชื่อเขียว</option>
           <option value="head" ${curRole==="head"?"selected":""}>หัวหน้าโค้ช · ชื่อแดง</option>
         </select>`
      : `<span class="tag no">ยังไม่สมัคร</span>`;
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

/* เพิ่มคน — อีเมลที่มีแล้วข้าม ไม่ทับบ้านเดิม */
$("adAdd").onclick = async ()=>{
  const lines = $("adEmails").value.split(/[\n\r]+/).map(s=>s.trim()).filter(Boolean);
  const house = +$("adHouse").value;
  const have = new Set(roster.map(x=>x.email.toLowerCase()));
  const rows = [], bad = [], dup = [];
  const seen = new Set();
  lines.forEach(line=>{
    const parts = line.split(/[,\t]/).map(s=>s.trim());
    const em = parts[0].toLowerCase();
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)){ bad.push(line); return; }
    if(have.has(em) || seen.has(em)){ dup.push(em); return; }
    seen.add(em);
    rows.push({email:em, house_id:house, full_name:parts.slice(1).join(" ")||null});
  });
  if(!rows.length){
    $("adResult").innerHTML = '<span style="color:var(--red)">ไม่มีอีเมลใหม่ที่ใช้ได้</span>'
      + (dup.length ? `<br>มีอยู่แล้ว ${dup.length}` : "") + (bad.length ? `<br>ไม่ใช่อีเมล ${bad.length}` : "");
    return;
  }
  $("adAdd").disabled = true;
  const {error} = await sb.from("roster").insert(rows);
  $("adAdd").disabled = false;
  if(error){ $("adResult").innerHTML = '<span style="color:var(--red)">'+esc(error.message)+'</span>'; return toast(error.message); }
  $("adResult").innerHTML = `เพิ่มแล้ว <b>${rows.length}</b> คน เข้าบ้าน ${houseOf(house).emoji} ${houseOf(house).name}`
    + (dup.length ? `<br><span style="color:var(--orange)">ข้าม ${dup.length} อีเมลที่มีอยู่แล้ว</span>` : "")
    + (bad.length ? `<br><span style="color:var(--red)">ข้าม ${bad.length} บรรทัดที่ไม่ใช่อีเมล</span>` : "");
  $("adEmails").value = "";
  toast(`เพิ่ม ${rows.length} คนแล้ว`);
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

boot();
