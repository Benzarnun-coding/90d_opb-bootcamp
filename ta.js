/* ============================================================
   TA — หน้าดูแลบ้านของตัวเอง (สำหรับ TA ประจำบ้าน)
   เห็นเฉพาะบ้านตัวเอง · ลบ/แก้แพลตฟอร์มงานของนักเรียนในบ้าน · ย้ายนักเรียนไปบ้านอื่น (ต้องยืนยันรหัส)
   ไม่มีสิทธิ์: เพิ่มคน ลบคน ตั้งบทบาท ตั้งบอส (ของหัวหน้าโค้ชเท่านั้น)
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
const PLATS = C.PLATFORMS || ["TikTok","YouTube","Instagram","Facebook","X","Blog"];

let toastT;
function toast(msg){ const t=$("toast"); t.innerHTML=msg; t.classList.add("on"); clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),3400); }
function show(id){ document.querySelectorAll(".screen").forEach(s=>s.classList.toggle("on", s.id===id)); }
const ago = ts => { const m=Math.floor((Date.now()-new Date(ts).getTime())/60000); return m<1?"เมื่อกี้":m<60?`${m} นาที`:m<1440?`${Math.floor(m/60)} ชม.`:`${Math.floor(m/1440)} วัน`; };

if(!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY)){
  document.body.innerHTML = '<div class="wrap"><div class="card bevel"><div class="body">ยังไม่ได้ใส่คีย์ Supabase ใน config.js</div></div></div>';
  throw new Error("no supabase config");
}
const sb = window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);

/* ================= STATE ================= */
let ME = null, HOUSE = 0, IS_HEAD = false, today = 1;
let roster = [], board = [], postedToday = new Set(), q = "", filter = "all", openPid = null;

/* ================= AUTH ================= */
async function boot(){
  document.title = "TA · " + C.TITLE;
  const {data:{session}} = await sb.auth.getSession();
  if(!session){ show("scLogin"); return; }
  const {data:me, error} = await sb.from("profiles").select("id,name,role,house_id").eq("id", session.user.id).maybeSingle();
  if(error){ toast(error.message); show("scLogin"); return; }
  const isTA = me && me.role==="coach" && me.house_id;
  IS_HEAD = !!(me && me.role==="coach" && !me.house_id);
  if(!isTA && !IS_HEAD){ $("deniedWho").textContent = session.user.email; show("scDenied"); return; }
  ME = me; HOUSE = isTA ? me.house_id : 1;
  $("who").textContent = `${me.name} · ${session.user.email}`;
  $("headPick").style.display = IS_HEAD ? "" : "none";
  if(IS_HEAD){ $("headHouse").innerHTML = HOUSES.map(h=>`<option value="${h.id}">${h.emoji} ${h.name}</option>`).join(""); $("headHouse").value = HOUSE; }
  show("scTA");
  loadCohortStats();
  try{ sb.rpc("track_visit",{p_page:"ta",p_kind:"open",p_vkey:(localStorage.getItem("opb_vk")||"ta"),p_device:/Mobi|Android|iPhone/i.test(navigator.userAgent)?"mobile":"desktop",p_pwa:false,p_ref:null}); }catch(e){}
  await load();
}
$("lgBtn").onclick = async ()=>{
  const email = $("lgEmail").value.trim(), password = $("lgPass").value;
  if(!email || !password) return toast("ใส่อีเมลกับรหัสก่อน");
  $("lgBtn").disabled = true;
  const {error} = await sb.auth.signInWithPassword({email, password});
  $("lgBtn").disabled = false;
  if(error) return toast(/invalid/i.test(error.message) ? "อีเมลหรือรหัสไม่ถูก" : error.message);
  boot();
};
$("lgPass").onkeydown = e => { if(e.key==="Enter") $("lgBtn").click(); };
$("outBtn").onclick = $("deniedOut").onclick = async ()=>{ await sb.auth.signOut(); location.reload(); };
$("headHouse").onchange = async ()=>{ HOUSE = +$("headHouse").value; openPid = null; await load(); };

/* ================= LOAD ================= */
/* ---- ภาพรวมรุ่น (ใช้ฟังก์ชันเดียวกับหน้า admin — TA เรียกได้) ---- */
const TARGET_TH = {4:["COMPROMISE","#8a86c9"], 7:["RECOMMENDED","#39e5ff"], 10:["LASER FOCUS","#ff2436"], 14:["PRO MAX","#ffb324"]};
async function loadCohortStats(){
  $("csSum").textContent = "กำลังโหลด…";
  const {data, error} = await sb.rpc("admin_cohort_stats");
  if(error){ $("csSum").textContent = error.message; return; }
  const hs = data.houses||[], students = data.students||0, cw = data.week;
  const maxRoster = Math.max(1, ...hs.map(h=>h.roster));
  $("csSum").textContent = `สัปดาห์ที่ ${cw} · นักเรียนสมัครแล้ว ${students} คน จากรายชื่อ ${data.roster} · ยังไม่เลือกเป้าสัปดาห์นี้ ${data.no_pledge_week} คน`;
  $("csHouses").innerHTML = hs.map(h=>{ const c=houseOf(h.id); const pct=students?Math.round(h.students/students*100):0;
    return `<div class="csRow ${h.id===HOUSE?"mine":""}"><span style="color:${c.color}">${c.emoji} ${c.name}</span>
      <div class="bar"><i style="width:${h.students/maxRoster*100}%;background:${c.color}">${h.students}</i><i class="dim" style="width:${(h.roster-h.registered)/maxRoster*100}%">${h.roster-h.registered}</i></div>
      <span class="v">${pct}% · TA ${h.tas}</span></div>`; }).join("");
  $("csHouseWeek").innerHTML = hs.map(h=>{ const c=houseOf(h.id); const pp=h.students?Math.round(h.posted_week/h.students*100):0;
    return `<div class="csRow ${h.id===HOUSE?"mine":""}"><span style="color:${c.color}">${c.emoji} ${c.name}</span>
      <div class="bar"><i style="width:${h.students?h.pledged_week/h.students*100:0}%;background:#8a86c9;opacity:.7">${h.pledged_week}</i></div>
      <span class="v">ส่ง ${h.posted_week}/${h.students} (${pp}%) · ${h.contents} ชิ้น</span></div>`; }).join("");
  /* pledge tiers per week */
  const byW={}; (data.pledges||[]).forEach(p=>{ (byW[p.week_no]=byW[p.week_no]||[]).push(p); });
  const weeks=Object.keys(byW).map(Number).sort((a,b)=>a-b);
  $("csPledges").innerHTML = weeks.length ? weeks.map(w=>{ const rows=byW[w]; const tot=rows.reduce((s,r)=>s+r.n,0); const none=Math.max(0, students-tot);
    return `<div class="csRow"><span>สัปดาห์ ${w}${w===cw?" (นี้)":""}</span><div class="bar">${rows.map(r=>{ const t=TARGET_TH[r.target]||[r.target,"#fff"]; const hitW=r.n?r.hit/r.n*100:0;
        return `<i title="${t[0]} ${r.target} ชิ้น · ${r.n} คน · ครบเป้าแล้ว ${r.hit}" style="width:${r.n/students*100}%;background:linear-gradient(90deg,${t[1]} ${hitW}%,${t[1]}bb ${hitW}%)">${r.n}</i>`; }).join("")}<i class="dim" style="width:${none/students*100}%" title="ยังไม่เลือกเป้า">${none||""}</i></div>
      <span class="v">${rows.map(r=>`${r.target}:${Math.round(r.n/students*100)}%`).join(" ")}</span></div>`; }).join("")
    : '<span style="color:var(--dim)">ยังไม่มีใครเลือกเป้า</span>';
  const ph={}; (data.pledges_by_house||[]).forEach(p=>{ (ph[p.house_id]=ph[p.house_id]||{})[p.target]=p.n; });
  renderPopular(data);
  $("csPledgeHouse").innerHTML = hs.map(h=>{ const c=houseOf(h.id), m=ph[h.id]||{}; const tot=Object.values(m).reduce((s,v)=>s+v,0), none=Math.max(0,h.students-tot);
    return `<div class="csRow ${h.id===HOUSE?"mine":""}"><span style="color:${c.color}">${c.emoji} ${c.name}</span><div class="bar">${[4,7,10,14].filter(t=>m[t]).map(t=>`<i title="${TARGET_TH[t][0]} · ${m[t]} คน" style="width:${h.students?m[t]/h.students*100:0}%;background:${TARGET_TH[t][1]}">${m[t]}</i>`).join("")}<i class="dim" style="width:${h.students?none/h.students*100:0}%">${none||""}</i></div>
      <span class="v">${[4,7,10,14].filter(t=>m[t]).map(t=>`${t}:${m[t]}`).join(" ")}</span></div>`; }).join("");
}
function renderPopular(data){
  const list=data.popular||[]; $("csPopSum").textContent = `${data.cheer_total||0} ครั้ง · สัปดาห์นี้ ${data.cheer_week||0} · คนกดเชียร์ ${data.cheer_givers||0} คน`;
  const mx=Math.max(1,...list.map(p=>p.total));
  $("csPopRows").innerHTML = list.length ? list.map((p,i)=>{ const c=houseOf(p.house_id); const medal=i<3?["🥇","🥈","🥉"][i]:i+1;
    return `<tr><td>${medal}</td><td><b>${esc(p.name)}</b></td><td style="color:${c.color}">${c.emoji} ${c.name}</td>
      <td><div style="display:flex;align-items:center;gap:8px"><b>${p.total}</b><span style="display:inline-block;height:8px;width:${Math.round(p.total/mx*120)}px;background:linear-gradient(90deg,#ff4d6d,#ffb324)"></span></div></td>
      <td>${p.week}</td><td>${p.fans}</td><td style="font-size:18px">${p.top_emoji||""}</td></tr>`; }).join("")
    : '<tr><td colspan="7" style="color:var(--dim)">ยังไม่มีใครกดเชียร์</td></tr>';
}
$("csReload").onclick=loadCohortStats;

async function load(){
  const h = houseOf(HOUSE);
  $("ttl").innerHTML = `TA · <span style="color:${h.color}">${h.emoji} ${h.name}</span>`;
  const [{data:cs}, {data:r, error:e1}, {data:b, error:e2}] = await Promise.all([
    sb.rpc("cohort_status"),
    sb.from("roster").select("email,house_id,role,full_name,claimed_by,claimed_at").eq("house_id", HOUSE).order("email"),
    sb.from("v_leaderboard").select("id,name,handle,role,house_id,contents,active_days,week_target,week_done,day_streak,week_streak,last_at,pledge_style").eq("house_id", HOUSE)
  ]);
  if(e1){ toast("อ่านรายชื่อไม่ได้: "+e1.message); return; }
  if(e2){ toast("อ่านกระดานไม่ได้: "+e2.message); return; }
  const row = Array.isArray(cs) ? cs[0] : cs; today = row ? Number(row.day_index) : 1;
  roster = r || []; board = b || [];
  const ids = board.map(x=>x.id);
  postedToday = new Set();
  if(ids.length){
    const {data:sub} = await sb.from("submissions").select("profile_id").eq("day_index", today).eq("status","approved").in("profile_id", ids);
    (sub||[]).forEach(s=>postedToday.add(s.profile_id));
  }
  try{ const {data:rk}=await sb.from("v_at_risk").select("name,risk,days_silent,contents,week_target,week_done").eq("house_id",HOUSE).neq("risk","ok").order("days_silent",{ascending:false});
    const RT={never:"🆕 ยังไม่เคยส่ง",silent3:"⛔ หายไป 3 วัน+",silent2:"⚠️ ไม่ส่ง 2 วัน",burnout:"💀 กระโหลก",weak:"😵 หมดแรง",nopledge:"🎯 ยังไม่เลือกเป้า"};
    $("rkRows").innerHTML = (rk||[]).length ? rk.map(x=>`<div><span class="tag no">${RT[x.risk]||x.risk}</span> <b>${esc(x.name)}</b> · ${x.contents} ชิ้น${x.last_day?"":""}${x.week_target?" · เป้า "+x.week_done+"/"+x.week_target:""}</div>`).join("") : '<span style="color:var(--dim)">ไม่มีใครเสี่ยง 🎉</span>';
    const {data:txt}=await sb.rpc("risk_text",{hid:HOUSE}); $("rkText").value=txt||""; }catch(e){}
  const {data:mv} = await sb.from("house_moves").select("email,from_house,to_house,moved_at,note").or(`from_house.eq.${HOUSE},to_house.eq.${HOUSE}`).order("moved_at",{ascending:false}).limit(30);
  renderMoves(mv||[]);
  render();
}

/* ================= RENDER ================= */
function render(){
  const h = houseOf(HOUSE);
  const students = board.filter(x=>x.role==="student");
  const tas = board.filter(x=>x.role==="coach");
  const unclaimed = roster.filter(x=>!x.claimed_by);
  const notToday = students.filter(x=>!postedToday.has(x.id));
  const avg = students.length ? (students.reduce((n,x)=>n+(x.contents||0),0)/students.length).toFixed(1) : "0";
  $("cards").innerHTML = [
    ["สมาชิกในบ้าน", roster.length, `สมัครแล้ว ${students.length+tas.length} · ยังไม่สมัคร ${unclaimed.length}`],
    ["วันนี้ส่งแล้ว", `${students.length-notToday.length}/${students.length}`, `ยังไม่ส่ง ${notToday.length} คน`],
    ["เฉลี่ยต่อคน", avg, "ชิ้น (นักเรียนที่สมัครแล้ว)"],
    ["TA ประจำบ้าน", tas.length, tas.map(t=>t.name).join(", ") || "—"]
  ].map(([l,v,s])=>`<div class="houseCard" style="border-color:${h.color}"><div class="hl">${l}</div><div class="hv">${v}</div><div class="hl">${s}</div></div>`).join("");

  const byEmail = {}; roster.forEach(x=>{ byEmail[x.email.toLowerCase()] = x; });
  const claimedEmail = {}; roster.forEach(x=>{ if(x.claimed_by) claimedEmail[x.claimed_by] = x.email; });
  let rows = students.map(s=>({kind:"student", s, email: claimedEmail[s.id] || ""}));
  if(filter==="today") rows = rows.filter(r=>!postedToday.has(r.s.id));
  if(filter==="unclaimed") rows = unclaimed.map(x=>({kind:"unclaimed", email:x.email}));
  if(filter==="all") rows = rows.concat(unclaimed.map(x=>({kind:"unclaimed", email:x.email})));
  if(q){ const qq=q.toLowerCase(); rows = rows.filter(r=>(r.email||"").toLowerCase().includes(qq) || (r.s && r.s.name.toLowerCase().includes(qq))); }
  rows.sort((a,b)=>((b.s&&b.s.contents)||0)-((a.s&&a.s.contents)||0));

  $("rows").innerHTML = rows.length ? rows.map(r=>{
    if(r.kind==="unclaimed") return `<tr>
      <td><span class="tag no">ยังไม่สมัคร</span></td>
      <td>${esc(r.email)}</td><td class="hideSm">—</td><td class="hideSm">—</td><td class="hideSm">—</td>
      <td><button class="btn xs" data-move="${esc(r.email)}">ย้ายบ้าน</button></td></tr>`;
    const s=r.s, posted=postedToday.has(s.id);
    const wk = s.week_target ? `${s.week_done}/${s.week_target}` : "ยังไม่เลือกเป้า";
    return `<tr class="${openPid===s.id?"open":""}">
      <td><span class="tag ${posted?"ok":"no"}">${posted?"ส่งแล้ว":"ยังไม่ส่ง"}</span></td>
      <td><b class="px" style="color:#fff">${esc(s.name)}</b><br><small style="color:var(--dim)">${esc(r.email)}</small></td>
      <td class="hideSm"><b class="px" style="color:var(--gold)">${s.contents}</b> ชิ้น</td>
      <td class="hideSm">${wk} · 🔥${s.day_streak}</td>
      <td class="hideSm">${s.last_at ? ago(s.last_at)+"ที่แล้ว" : "ยังไม่เคยส่ง"}</td>
      <td style="white-space:nowrap"><button class="btn xs" data-subs="${s.id}" data-nm="${esc(s.name)}">${openPid===s.id?"ซ่อนงาน":"ดูงาน"}</button>
        <button class="btn xs" data-move="${esc(r.email)}" data-nm="${esc(s.name)}">ย้ายบ้าน</button></td></tr>
      ${openPid===s.id ? `<tr class="subRow"><td colspan="6"><div id="subBox">กำลังโหลด…</div></td></tr>` : ""}`;
  }).join("") : `<tr><td colspan="6" style="color:var(--dim);padding:16px">ไม่มีรายการ</td></tr>`;
  document.querySelectorAll(".fBtn[data-f]").forEach(b=>b.classList.toggle("on", b.dataset.f===filter));
  if(openPid) loadSubs(openPid);
}
function renderMoves(mv){
  $("moves").innerHTML = mv.length ? mv.map(m=>`<li>${new Date(m.moved_at).toLocaleString("th-TH",{dateStyle:"short",timeStyle:"short"})} · <b>${esc(m.email)}</b> ${houseOf(m.from_house).emoji} ${houseOf(m.from_house).name} → ${houseOf(m.to_house).emoji} ${houseOf(m.to_house).name}${m.note?" · "+esc(m.note):""}</li>`).join("")
    : `<li style="color:var(--dim)">ยังไม่มีการย้ายที่เกี่ยวกับบ้านนี้</li>`;
}

/* ================= งานของนักเรียน ================= */
async function loadSubs(pid){
  const box = $("subBox"); if(!box) return;
  const {data, error} = await sb.from("submissions").select("id,day_index,platform,url,created_at,views,likes,kind,note,kudos(submission_id)").eq("profile_id", pid).order("created_at",{ascending:false}).limit(200);
  if(error){ box.textContent = error.message; return; }
  const KI={short:"🎬",long:"🎥",image:"🖼",article:"📝",live:"🔴",other:"✨"};
  box.innerHTML = (data||[]).length ? `<table><thead><tr><th>วัน</th><th>แพลตฟอร์ม</th><th>ลิงก์</th><th>👁 วิว</th><th>❤ ไลก์</th><th>👍</th><th></th></tr></thead><tbody>` +
    data.map(s=>{ const k=!!(s.kudos&&s.kudos.length); return `<tr>
      <td>${s.day_index}</td>
      <td><select data-plat="${s.id}">${PLATS.map(p=>`<option ${p===s.platform?"selected":""}>${p}</option>`).join("")}</select>${s.kind?" "+KI[s.kind]:""}</td>
      <td style="max-width:320px"><div style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap"><a href="${esc(s.url)}" target="_blank" rel="noopener" style="color:var(--cyan)">${esc(s.url)}</a></div>${s.note?`<div style="font-size:12px;color:var(--dim)">💬 ${esc(s.note)}</div>`:""}</td>
      <td><input type="number" min="0" data-views="${s.id}" value="${s.views||""}" style="width:80px;padding:4px 6px;font-size:12px"></td>
      <td><input type="number" min="0" data-likes="${s.id}" value="${s.likes||""}" style="width:80px;padding:4px 6px;font-size:12px"></td>
      <td><button class="btn xs" data-kudo="${s.id}" data-on="${k?1:0}" style="${k?"background:linear-gradient(180deg,#ffd96b,#e0a018 60%,#a86f06);color:#3a2600;text-shadow:none":""}">${k?"👍 งานดี":"👍"}</button></td>
      <td><button class="btn xs danger" data-del="${s.id}">ลบ</button></td></tr>`; }).join("") + `</tbody></table>
    <div class="hint">👍 = งานดี (นักเรียนได้ป้าย QUALITY เมื่อครบ 3) · ใส่ยอดวิว/ไลก์แทนนักเรียนได้ · ลบ = งานหายจากคะแนนทันที</div>`
    : `<div style="color:var(--dim)">ยังไม่มีงาน</div>`;
}
$("rows").onclick = async e=>{
  const sBtn = e.target.closest("button[data-subs]");
  if(sBtn){ openPid = openPid===sBtn.dataset.subs ? null : sBtn.dataset.subs; render(); return; }
  const del = e.target.closest("button[data-del]");
  if(del){
    if(!confirm("ลบงานชิ้นนี้ออกจากคะแนน?")) return;
    del.disabled = true;
    const {error} = await sb.rpc("ta_delete_submission", {sid: +del.dataset.del});
    if(error){ del.disabled=false; return toast(error.message); }
    toast("ลบแล้ว"); await load(); return;
  }
  const mv = e.target.closest("button[data-move]");
  if(mv) openMove(mv.dataset.move, mv.dataset.nm || "");
  const kd = e.target.closest("button[data-kudo]");
  if(kd){ kd.disabled=true; const give = kd.dataset.on!=="1";
    const {error} = await sb.rpc("ta_kudos", {sid:+kd.dataset.kudo, give});
    if(error){ kd.disabled=false; return toast(error.message); }
    toast(give ? "ให้ 👍 งานดีแล้ว" : "ยกเลิก 👍 แล้ว"); if(openPid) loadSubs(openPid); }
};
$("rows").onchange = async e=>{
  const vi = e.target.closest("input[data-views], input[data-likes]");
  if(vi){ vi.disabled=true; const p = vi.dataset.views!=null ? {sid:+vi.dataset.views, v:+vi.value||0} : {sid:+vi.dataset.likes, lk:+vi.value||0};
    const {error} = await sb.rpc("ta_update_submission", p); vi.disabled=false; if(error) return toast(error.message); toast("บันทึกยอดแล้ว"); return; }
  const s = e.target.closest("select[data-plat]"); if(!s) return;
  s.disabled = true;
  const {error} = await sb.rpc("ta_fix_platform", {sid: +s.dataset.plat, plat: s.value});
  s.disabled = false;
  if(error) return toast(error.message);
  toast(`เปลี่ยนเป็น ${s.value} แล้ว`);
};

/* ================= ย้ายบ้าน (ต้องยืนยันรหัส) ================= */
function openMove(email, name){
  $("mvWho").innerHTML = `<b>${esc(name||email)}</b>${name?`<br><small style="color:var(--dim)">${esc(email)}</small>`:""}`;
  $("mvEmail").value = email;
  $("mvHouse").innerHTML = HOUSES.filter(h=>h.id!==HOUSE).map(h=>`<option value="${h.id}">${h.emoji} ${h.name} · ${h.th}</option>`).join("");
  $("mvCode").value = "";
  $("mvModal").classList.add("on");
  setTimeout(()=>$("mvCode").focus(), 100);
}
$("mvCancel").onclick = ()=>$("mvModal").classList.remove("on");
$("mvGo").onclick = async ()=>{
  const em = $("mvEmail").value, hid = +$("mvHouse").value, code = $("mvCode").value;
  if(!code) return toast("ใส่รหัสยืนยันก่อน");
  $("mvGo").disabled = true;
  const {error} = await sb.rpc("ta_move_student", {em, hid, code});
  $("mvGo").disabled = false;
  if(error) return toast(error.message);
  $("mvModal").classList.remove("on");
  toast(`ย้าย ${em}<br>ไป ${houseOf(hid).emoji} ${houseOf(hid).name} แล้ว`);
  await load();
};
$("mvCode").onkeydown = e => { if(e.key==="Enter") $("mvGo").click(); };

/* ================= FILTERS ================= */
$("filters").onclick = e => { const b=e.target.closest(".fBtn[data-f]"); if(!b) return; filter=b.dataset.f; render(); };
$("q").oninput = e => { q=e.target.value.trim(); render(); };
$("reload").onclick = load;
$("rkCopy").onclick = async ()=>{ try{ await navigator.clipboard.writeText($("rkText").value); toast("คัดลอกแล้ว"); }catch(e){ $("rkText").select(); toast("กด Ctrl+C เพื่อคัดลอก"); } };

boot();
