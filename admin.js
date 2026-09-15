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
  try{ sb.rpc("track_visit",{p_page:"admin",p_kind:"open",p_vkey:(localStorage.getItem("opb_vk")||"admin"),p_device:"desktop",p_pwa:false,p_ref:null}); }catch(e){}
  await load();
  const {data:co} = await sb.from("cohort").select("discord_webhook").eq("id",1).maybeSingle();
  if(co && co.discord_webhook) $("dcHook").value = co.discord_webhook;
  await loadBosses();
  await loadLoginCode();
  loadFeedback();
  loadRisk(); loadSessions(); loadRetention(); loadAudit(); loadEngagement(); loadCohortStats();
}
/* ---- กลุ่มเสี่ยง ---- */
const RISK_TH = {never:["🆕 ยังไม่เคยส่ง","no"], silent3:["⛔ หายไป 3 วัน+","no"], silent2:["⚠️ ไม่ส่ง 2 วัน","no"], burnout:["💀 กระโหลก","no"], weak:["😵 หมดแรง","no"], nopledge:["🎯 ยังไม่เลือกเป้า","no"], ok:["✅ ปกติ","ok"]};
async function loadRisk(){
  if(!$("rkHouse").options.length || $("rkHouse").options.length===1) $("rkHouse").innerHTML = '<option value="">🌏 ทั้งรุ่น</option>' + HOUSES.map(h=>`<option value="${h.id}">${h.emoji} ${h.name}</option>`).join("");
  const hid = $("rkHouse").value ? +$("rkHouse").value : null;
  let q = sb.from("v_at_risk").select("*").neq("risk","ok").order("days_silent",{ascending:false});
  if(hid) q = q.eq("house_id", hid);
  const [{data, error}, {data:txt}] = await Promise.all([q, sb.rpc("risk_text", {hid})]);
  if(error) return toast(error.message);
  const list = data || [];
  $("rkSum").textContent = `เสี่ยง ${list.length} คน`;
  $("rkRows").innerHTML = list.length ? list.map(x=>{ const h=houseOf(x.house_id), t=RISK_TH[x.risk]||[x.risk,"no"];
    return `<tr><td><span class="tag ${t[1]}">${t[0]}</span></td><td><b>${esc(x.name)}</b></td><td>${h.emoji} ${h.name}</td><td>${x.contents}</td>
      <td>${x.last_day ? "วันที่ "+x.last_day+" ("+x.days_silent+" วันก่อน)" : "—"}</td><td>${x.week_target ? x.week_done+"/"+x.week_target : '<span style="color:var(--red)">ยังไม่เลือก</span>'}</td></tr>`; }).join("")
    : '<tr><td colspan="6" style="color:var(--dim);padding:16px">ไม่มีใครเสี่ยง 🎉</td></tr>';
  $("rkText").value = txt || "";
}
$("rkHouse").onchange = loadRisk; $("rkReload").onclick = loadRisk;
$("rkCopy").onclick = async ()=>{ try{ await navigator.clipboard.writeText($("rkText").value); toast("คัดลอกแล้ว วางใน Discord ได้เลย"); }catch(e){ $("rkText").select(); toast("กด Ctrl+C เพื่อคัดลอก"); } };

/* ---- เรียนสด ---- */
async function loadSessions(){
  if(!$("lsDate").value) $("lsDate").value = new Date(Date.now()+7*3600e3).toISOString().slice(0,10);
  const {data, error} = await sb.from("v_session_attendance").select("*");
  if(error) return toast(error.message);
  const now = Date.now();
  $("lsRows").innerHTML = (data||[]).length ? data.map(s=>{
    const st=new Date(s.starts_at), en=new Date(s.ends_at); const live = now>=st.getTime()-30*60e3 && now<=en.getTime()+60*60e3;
    return `<tr><td><b>${esc(s.title)}</b>${live?' <span class="tag ok">LIVE</span>':""}</td>
      <td>${st.toLocaleString("th-TH",{dateStyle:"short",timeStyle:"short"})} – ${en.toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit"})}</td>
      <td><b class="px" style="color:var(--gold)">${s.n}</b> / ${s.students} คน <button class="btn xs" data-att="${s.id}">รายชื่อ</button><div id="att-${s.id}" style="font-size:12px;color:var(--dim);margin-top:4px"></div></td>
      <td><button class="btn xs danger" data-lsdel="${s.id}">ลบ</button></td></tr>`; }).join("")
    : '<tr><td colspan="4" style="color:var(--dim);padding:16px">ยังไม่มีคาบเรียน</td></tr>';
}
$("lsAdd").onclick = async ()=>{
  const title=$("lsTitle").value.trim(), d=$("lsDate").value, t=$("lsTime").value, min=+$("lsMin").value||90;
  if(!title || !d || !t) return toast("ใส่ชื่อคาบ วันที่ และเวลาเริ่ม");
  const starts = new Date(`${d}T${t}:00+07:00`); const ends = new Date(starts.getTime()+min*60e3);
  const {error} = await sb.from("live_sessions").insert({title, starts_at:starts.toISOString(), ends_at:ends.toISOString()});
  if(error) return toast(error.message);
  toast("สร้างคาบแล้ว นักเรียนจะเห็นปุ่มเช็คอินในแอปเมื่อถึงเวลา"); $("lsTitle").value=""; await loadSessions();
};
$("lsRows").onclick = async e=>{
  const d=e.target.closest("button[data-lsdel]");
  if(d){ if(!confirm("ลบคาบนี้และรายชื่อเช็คอิน?")) return; const {error}=await sb.from("live_sessions").delete().eq("id",+d.dataset.lsdel); if(error) return toast(error.message); await loadSessions(); return; }
  const a=e.target.closest("button[data-att]");
  if(a){ const {data}=await sb.from("checkins").select("profile_id,at").eq("session_id",+a.dataset.att); const ids=(data||[]).map(c=>c.profile_id);
    const {data:ps}= ids.length ? await sb.from("profiles").select("id,name,house_id").in("id",ids) : {data:[]};
    $("att-"+a.dataset.att).textContent = (ps||[]).map(p=>houseOf(p.house_id).emoji+" "+p.name).sort().join(", ") || "ยังไม่มีใครเช็คอิน"; }
};

/* ---- ภาพรวมรุ่น: บ้าน / เป้า ---- */
const TARGET_TH = {4:["COMPROMISE","#8a86c9"], 7:["RECOMMENDED","#39e5ff"], 10:["LASER FOCUS","#ff2436"], 14:["PRO MAX","#ffb324"]};
async function loadCohortStats(){
  $("csSum").textContent = "กำลังโหลด…";
  const {data, error} = await sb.rpc("admin_cohort_stats");
  if(error){ $("csSum").textContent = error.message; return; }
  const hs = data.houses||[], students = data.students||0, cw = data.week;
  const maxRoster = Math.max(1, ...hs.map(h=>h.roster));
  $("csSum").textContent = `สัปดาห์ที่ ${cw} · นักเรียนสมัครแล้ว ${students} คน จากรายชื่อ ${data.roster} · ยังไม่เลือกเป้าสัปดาห์นี้ ${data.no_pledge_week} คน`;
  $("csHouses").innerHTML = hs.map(h=>{ const c=houseOf(h.id); const pct=students?Math.round(h.students/students*100):0;
    return `<div class="csRow"><span style="color:${c.color}">${c.emoji} ${c.name}</span>
      <div class="bar"><i style="width:${h.students/maxRoster*100}%;background:${c.color}">${h.students}</i><i class="dim" style="width:${(h.roster-h.registered)/maxRoster*100}%">${h.roster-h.registered}</i></div>
      <span class="v">${pct}% · TA ${h.tas}</span></div>`; }).join("");
  $("csHouseWeek").innerHTML = hs.map(h=>{ const c=houseOf(h.id); const pp=h.students?Math.round(h.posted_week/h.students*100):0;
    return `<div class="csRow"><span style="color:${c.color}">${c.emoji} ${c.name}</span>
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
  renderPopular(data); loadPeople(cw);
  $("csPledgeHouse").innerHTML = hs.map(h=>{ const c=houseOf(h.id), m=ph[h.id]||{}; const tot=Object.values(m).reduce((s,v)=>s+v,0), none=Math.max(0,h.students-tot);
    return `<div class="csRow"><span style="color:${c.color}">${c.emoji} ${c.name}</span><div class="bar">${[4,7,10,14].filter(t=>m[t]).map(t=>`<i title="${TARGET_TH[t][0]} · ${m[t]} คน" style="width:${h.students?m[t]/h.students*100:0}%;background:${TARGET_TH[t][1]}">${m[t]}</i>`).join("")}<i class="dim" style="width:${h.students?none/h.students*100:0}%">${none||""}</i></div>
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
/* ---- ใครเลือกเป้าอะไร (รายคน) ---- */
let PP=null, PP_CW=1;
const TARGET_SHORT = {4:"C4", 7:"R7", 10:"L10", 14:"PM14"};
async function loadPeople(cw){
  PP_CW = cw || PP_CW;
  const {data, error} = await sb.rpc("cohort_people");
  if(error){ $("ppSum").textContent = error.message; return; }
  PP = data || []; renderPeople();
}
function renderPeople(){
  if(!PP) return;
  const hid = +($("ppHouse").value||0), tg = $("ppTarget").value, q = ($("ppFind").value||"").trim().toLowerCase();
  const maxW = Math.max(PP_CW, ...PP.flatMap(p=>p.weeks.map(w=>w.w)));
  const cur = p => (p.weeks.find(w=>w.w===PP_CW)||{}).t || 0;
  const list = PP.filter(p => (!hid || p.house_id===hid) && (tg==="" || cur(p)===+tg) && (!q || String(p.name).toLowerCase().includes(q)));
  $("ppSum").textContent = list.length + " คน";
  $("ppHead").innerHTML = "<tr><th>ชื่อ</th><th>บ้าน</th><th>ชิ้นรวม</th>" + Array.from({length:maxW},(_,i)=>`<th class="w">W${i+1}</th>`).join("") + "</tr>";
  $("ppRows").innerHTML = list.length ? list.map(p => { const c = houseOf(p.house_id);
    const cells = Array.from({length:maxW},(_,i)=>{ const w = p.weeks.find(x=>x.w===i+1);
      if(!w) return `<td class="w none">—</td>`;
      const cls = w.hit ? "hit" : (i+1 < PP_CW ? "miss" : "on");
      return `<td class="w ${cls}" title="${TARGET_TH[w.t]?TARGET_TH[w.t][0]:w.t} · ทำแล้ว ${w.d}/${w.t}">${w.d}/${w.t}<b>${TARGET_SHORT[w.t]||w.t}</b></td>`; }).join("");
    return `<tr><td><b>${esc(p.name)}</b></td><td style="color:${c.color}">${c.emoji} ${c.name}</td><td>${p.contents}</td>${cells}</tr>`; }).join("")
    : '<tr><td colspan="99" style="color:var(--dim)">ไม่มีใครตรงเงื่อนไข</td></tr>';
}
function peopleCsv(){
  if(!PP) return;
  const maxW = Math.max(PP_CW, ...PP.flatMap(p=>p.weeks.map(w=>w.w)));
  const head = ["name","house","contents"].concat(Array.from({length:maxW},(_,i)=>["W"+(i+1)+"_target","W"+(i+1)+"_done","W"+(i+1)+"_hit"]).flat());
  const rows = [head].concat(PP.map(p => [p.name, houseOf(p.house_id).name, p.contents].concat(Array.from({length:maxW},(_,i)=>{ const w=p.weeks.find(x=>x.w===i+1); return w ? [w.t, w.d, w.hit?1:0] : ["","",""]; }).flat())));
  const csv = "\ufeff" + rows.map(r=>r.map(v=>'"'+String(v==null?"":v).replace(/"/g,'""')+'"').join(",")).join("\n");
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download="pledges-by-person.csv"; a.click();
}
$("ppHouse").onchange=renderPeople; $("ppTarget").onchange=renderPeople; $("ppFind").oninput=renderPeople; $("ppCsv").onclick=peopleCsv;
HOUSES.forEach(h=>{ const o=document.createElement("option"); o.value=h.id; o.textContent=h.emoji+" "+h.name; $("ppHouse").appendChild(o); });
$("csReload").onclick=()=>{ loadCohortStats(); loadPeople(); };

/* ---- engagement / analytics ---- */
let EG=null;
const agoTH = ts => { if(!ts) return "—"; const m=Math.round((Date.now()-new Date(ts).getTime())/60000);
  if(m<1) return "เมื่อกี้"; if(m<60) return m+" นาทีที่แล้ว"; const hh=Math.round(m/60); if(hh<24) return hh+" ชม.ที่แล้ว"; const d=Math.round(hh/24); return d+" วันที่แล้ว"; };
const dTH = ts => ts ? new Date(ts).toLocaleDateString("th-TH",{day:"numeric",month:"short"}) : "—";
async function loadEngagement(){
  const days = +($("egDays").value||30);
  $("egSum").textContent = "กำลังโหลด…";
  const {data, error} = await sb.rpc("admin_engagement", {days});
  if(error){ $("egSum").textContent = error.message; return; }
  EG = data; const t = data.totals || {};
  const kpi = (v,l,s) => `<div class="kpi"><b>${v==null?"—":v}</b><span>${l}</span>${s?`<small>${s}</small>`:""}</div>`;
  $("egKpis").innerHTML =
    kpi(t.users_today, "คนเข้าวันนี้", `เปิด ${t.opens_today||0} ครั้ง · ${t.devices_today||0} เครื่อง`) +
    kpi(t.users_7d, "คนเข้าใน 7 วัน", `จากสมัครแล้ว ${data.registered} คน (${data.registered?Math.round((t.users_7d||0)/data.registered*100):0}%)`) +
    kpi(t.users_range, `คนเข้าใน ${days} วัน`, `${t.opens_range||0} ครั้ง · ${Math.round((t.minutes_range||0)/60)} ชม.รวม`) +
    kpi(t.outside_7d, "คนดูข้างนอก 7 วัน", `ไม่ล็อกอิน · ${days} วัน = ${t.outside_range||0} เครื่อง · จอ #watch ${t.watch_range||0} ครั้ง`) +
    kpi(data.never_visited, "สมัครแล้วไม่เคยเปิดแอป", `ตั้งแต่เริ่มเก็บข้อมูล`) +
    kpi((data.absent||[]).length, "หายไป 7 วัน+", "สมัครแล้วแต่ไม่ได้เปิด");
  $("egSum").textContent = `เก็บตั้งแต่ ${dTH(data.since)} · มีชื่อ ${data.roster} · สมัคร ${data.registered}`;
  /* daily */
  const daily = data.daily||[]; const mx = Math.max(1, ...daily.map(d=>Math.max(d.users, d.outside)));
  $("egDaily").innerHTML = daily.length ? daily.map(d=>`<div class="bar" data-t="${dTH(d.d)} · ล็อกอิน ${d.users} คน · ข้างนอก ${d.outside} · เปิด ${d.opens} ครั้ง">
      <i class="o" style="height:${Math.round(d.outside/mx*100)}%"></i><i style="height:${Math.round(d.users/mx*100)}%;margin-top:-1px"></i><em>${new Date(d.d).getDate()}</em></div>`).join("")
    : '<span style="color:var(--dim);align-self:center;margin:auto">ยังไม่มีข้อมูล — เริ่มเก็บหลัง deploy หน้าเว็บรอบถัดไป</span>';
  /* hours */
  const hrs = Array.from({length:24},(_,i)=>({h:i,n:0})); (data.hours||[]).forEach(x=>{ hrs[x.h].n=x.n; });
  const hm = Math.max(1, ...hrs.map(x=>x.n));
  $("egHours").innerHTML = hrs.map(x=>`<div class="bar" data-t="${x.h}:00 · ${x.n} ครั้ง"><i style="height:${Math.round(x.n/hm*100)}%"></i>${x.h%3===0?`<em>${x.h}</em>`:""}</div>`).join("");
  /* pages + device */
  const pages=data.pages||[], pm=Math.max(1,...pages.map(p=>p.n));
  const PAGE_TH={app:"🏁 สนามแข่ง (ล็อกอิน)", title:"🚪 หน้าแรก (ยังไม่ล็อกอิน)", watch:"📺 จอฉาย / คนดู", ta:"🟢 หน้า TA", admin:"⚙️ แอดมิน", install:"📲 คู่มือติดตั้ง"};
  $("egPages").innerHTML = pages.length ? pages.map(p=>`<div class="egBarRow"><span>${PAGE_TH[p.page]||p.page}</span><div><i style="width:${Math.round(p.n/pm*100)}%"></i></div><span>${p.n}</span></div>`).join("") : '<span style="color:var(--dim)">—</span>';
  const dv=[["📱 มือถือ",t.mobile_users||0],["💻 คอม",t.desktop_users||0],["📲 เปิดจากแอปที่ติดตั้ง (PWA)",t.pwa_users||0]], dm=Math.max(1,...dv.map(x=>x[1]));
  $("egDevice").innerHTML = dv.map(([l,v])=>`<div class="egBarRow"><span>${l}</span><div><i style="width:${Math.round(v/dm*100)}%"></i></div><span>${v} คน</span></div>`).join("");
  renderEgRows(); renderEgAbsent();
}
function renderEgRows(){
  if(!EG) return;
  const hid = +($("egHouse").value||0), q=($("egFind").value||"").trim().toLowerCase();
  const list=(EG.users||[]).filter(u=>(!hid||u.house_id===hid) && (!q||String(u.name||"").toLowerCase().includes(q)));
  $("egRows").innerHTML = list.length ? list.map((u,i)=>{ const h=houseOf(u.house_id);
    return `<tr><td>${i+1}</td><td><b style="color:${u.role==="coach"?"#5ef08c":"#fff"}">${esc(u.name)}</b>${u.role==="coach"?' <span class="tag">TA</span>':""}</td>
      <td style="color:${h.color}">${h.emoji} ${h.name}</td><td><b>${u.days}</b> วัน</td><td>${u.opens}</td><td>${u.minutes}</td>
      <td title="${new Date(u.last_at).toLocaleString("th-TH")}">${agoTH(u.last_at)}</td><td>${dTH(u.first_at)}</td><td>${u.mobile?"📱":"💻"}${u.pwa?" 📲":""}</td></tr>`; }).join("")
    : '<tr><td colspan="9" style="color:var(--dim)">ยังไม่มีข้อมูล</td></tr>';
}
function renderEgAbsent(){
  if(!EG) return;
  const ab=EG.absent||[]; $("egAbsN").textContent = ab.length+" คน";
  const by={}; ab.forEach(u=>{ (by[u.house_id]=by[u.house_id]||[]).push(u); });
  $("egAbsent").innerHTML = ab.length ? HOUSES.map(h=>{ const l=by[h.id]||[]; if(!l.length) return "";
    return `<div><b style="color:${h.color}">${h.emoji} ${h.name}</b> (${l.length}): ${l.map(u=>`<span title="เปิดล่าสุด ${u.last_at?agoTH(u.last_at):"ไม่เคย"} · ส่งงาน ${u.contents} ชิ้น">${esc(u.name)}${u.last_at?"":" <em style='color:var(--dim)'>(ไม่เคยเปิด)</em>"}</span>`).join(" · ")}</div>`; }).join("")
    : '<span style="color:var(--dim)">ทุกคนเข้าแอปในช่วง 7 วัน 🎉</span>';
}
function egCsv(){
  if(!EG) return;
  const rows=[["name","house","role","days_active","opens","minutes","last_at","first_at","mobile","pwa"]]
    .concat((EG.users||[]).map(u=>[u.name, houseOf(u.house_id).name, u.role, u.days, u.opens, u.minutes, u.last_at, u.first_at, u.mobile?1:0, u.pwa?1:0]));
  const csv="\ufeff"+rows.map(r=>r.map(v=>'"'+String(v==null?"":v).replace(/"/g,'""')+'"').join(",")).join("\n");
  const a=document.createElement("a"); a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"})); a.download="engagement.csv"; a.click();
}
$("egReload").onclick=loadEngagement; $("egDays").onchange=loadEngagement; $("egCsv").onclick=egCsv;
$("egHouse").onchange=renderEgRows; $("egFind").oninput=renderEgRows;
HOUSES.forEach(h=>{ const o=document.createElement("option"); o.value=h.id; o.textContent=h.emoji+" "+h.name; $("egHouse").appendChild(o); });

/* ---- retention ---- */
async function loadRetention(){
  const {data, error} = await sb.from("daily_snapshots").select("day_index,posted,role").eq("role","student");
  if(error){ $("rtRows").textContent = error.message; return; }
  const by={}; (data||[]).forEach(r=>{ const o=by[r.day_index]=by[r.day_index]||{n:0,p:0}; o.n++; if(r.posted) o.p++; });
  const days=Object.keys(by).map(Number).sort((a,b)=>a-b);
  $("rtRows").innerHTML = days.length ? days.map(d=>{ const o=by[d], pct=o.n?Math.round(o.p/o.n*100):0;
    return `<div style="display:grid;grid-template-columns:70px 1fr 120px;gap:10px;align-items:center;padding:3px 0"><span>วันที่ ${d}</span>
      <div style="height:12px;background:#0b0316;border:2px solid var(--line)"><i style="display:block;height:100%;width:${pct}%;background:linear-gradient(90deg,#20c060,#8dff9d)"></i></div>
      <span><b>${pct}%</b> · ${o.p}/${o.n} คน</span></div>`; }).join("")
    : '<span style="color:var(--dim)">ยังไม่มี snapshot (จะเริ่มเก็บทุกคืน 03:55)</span>';
}

/* ---- audit ---- */
async function loadAudit(){
  const {data, error} = await sb.from("audit_log").select("at,actor_name,action,target,detail").order("at",{ascending:false}).limit(60);
  if(error){ $("auRows").innerHTML = "<li>"+esc(error.message)+"</li>"; return; }
  const H = id => id ? houseOf(id).emoji+" "+houseOf(id).name : "—";
  $("auRows").innerHTML = (data||[]).length ? data.map(x=>{
    const d=x.detail||{}; let what=x.action;
    if(x.action==="profile.update"){ const p=[]; if(d.house&&d.house[0]!==d.house[1]) p.push("ย้าย "+H(d.house[0])+" → "+H(d.house[1])); if(d.role&&d.role[0]!==d.role[1]) p.push("บทบาท "+d.role[0]+" → "+d.role[1]); if(d.name&&d.name[0]!==d.name[1]) p.push("ชื่อ "+d.name[0]+" → "+d.name[1]); what="แก้โปรไฟล์: "+p.join(" · "); }
    else if(x.action==="roster.update"){ const p=[]; if(d.house&&d.house[0]!==d.house[1]) p.push("ย้าย "+H(d.house[0])+" → "+H(d.house[1])); if(d.role&&d.role[0]!==d.role[1]) p.push("บทบาท "+d.role[0]+" → "+d.role[1]); what="แก้รายชื่อ: "+p.join(" · "); }
    else if(x.action==="roster.add") what="เพิ่มเข้ารายชื่อ "+H(d.house);
    else if(x.action==="roster.delete") what="ลบออกจากรายชื่อ";
    else if(x.action==="profile.create") what="สมัครเข้าบ้าน "+H(d.house);
    else if(x.action==="profile.delete") what="ลบโปรไฟล์";
    else if(x.action==="submission.delete") what="ลบงาน วันที่ "+d.day+" ("+(d.platform||"")+")";
    else if(x.action==="password.reset") what="รีเซ็ตรหัส";
    else if(x.action==="login_code.set") what="ตั้งรหัสเข้าใช้รวม";
    else if(x.action==="boss.create") what="ปล่อยบอส สัปดาห์ "+d.week+" HP "+d.hp;
    else if(x.action==="boss.delete") what="ลบบอส";
    else if(x.action==="sheet.sync") what=`ซิงก์ชีท: เพิ่ม ${(d.added||[]).length} · ย้าย ${(d.moved||[]).length} · TA ใหม่ ${(d.newTa||[]).length}`;
    return `<li>${new Date(x.at).toLocaleString("th-TH",{dateStyle:"short",timeStyle:"short"})} · <b>${esc(x.actor_name||"ระบบ")}</b> · ${esc(what)}${x.target?" · "+esc(x.target):""}</li>`; }).join("")
    : "<li style=\"color:var(--dim)\">ยังไม่มีบันทึก</li>";
}

/* ---- รหัสเข้าใช้รวม ---- */
async function loadLoginCode(){
  const {data} = await sb.rpc("login_code_set");
  $("lcState").textContent = data ? "✅ ตั้งไว้แล้ว (พิมพ์ใหม่แล้วบันทึกเพื่อเปลี่ยน)" : "⚠️ ยังไม่ได้ตั้ง — ปุ่มรีเซ็ตรหัสจะยังใช้ไม่ได้";
}
$("lcSave").onclick = async ()=>{
  const c = $("lcCode").value;
  if(!c || c.trim().length < 4) return toast("รหัสต้องยาวอย่างน้อย 4 ตัว");
  if(!confirm("บันทึกรหัสนี้เป็นรหัสเข้าใช้รวม? ต้องตรงกับที่แจกนักเรียนเป๊ะ ๆ (ตัวพิมพ์ใหญ่-เล็กด้วย)")) return;
  const {error} = await sb.rpc("admin_set_login_code", {c});
  if(error) return toast(error.message);
  $("lcCode").value = ""; toast("บันทึกรหัสรวมแล้ว"); await loadLoginCode();
};

/* ---- Feedback / feature request (044) ---- */
let fbScope="open";
const FB_ST={new:"ใหม่", planned:"รับแล้ว กำลังทำ", done:"ทำแล้ว", rejected:"ไม่ทำ"};
async function loadFeedback(){
  const box=$("fbAdmin"); if(!box) return;
  let q=sb.from("v_feedback").select("*").order("votes",{ascending:false}).order("created_at",{ascending:false}).limit(300);
  if(fbScope==="open") q=q.in("status",["new","planned"]);
  const {data,error}=await q;
  if(error){ box.innerHTML=`<small class="dim">โหลดไม่ได้: ${esc(error.message)}</small>`; return; }
  if(!data.length){ box.innerHTML='<small class="dim">ไม่มีคำขอในกลุ่มนี้</small>'; return; }
  box.innerHTML=`<table><thead><tr><th>👍</th><th>ประเภท</th><th>คำขอ</th><th>จาก</th><th>สถานะ</th><th>ตอบกลับ</th><th></th></tr></thead><tbody>`+
    data.map(r=>`<tr data-fb="${r.id}">
      <td><b>${r.votes}</b></td><td>${r.kind==="bug"?"🐛 บั๊ก":"💡 ฟีเจอร์"}</td>
      <td style="max-width:420px;white-space:pre-wrap">${esc(r.text)}<br><small class="dim">${esc(r.page||"")} · ${new Date(r.created_at).toLocaleString("th-TH")}</small></td>
      <td>${esc(r.author||"")}<br><small class="dim">${(HOUSES.find(h=>h.id===r.house_id)||{}).name||""}</small></td>
      <td><select data-fbst="${r.id}">${Object.keys(FB_ST).map(k=>`<option value="${k}" ${k===r.status?"selected":""}>${FB_ST[k]}</option>`).join("")}</select></td>
      <td><input data-fbnote="${r.id}" value="${esc(r.admin_note||"")}" placeholder="โน้ตถึงนักเรียน (ไม่บังคับ)" style="min-width:200px"></td>
      <td><button class="btn xs" data-fbsave="${r.id}">บันทึก</button></td></tr>`).join("")+`</tbody></table>`;
}
$("fbFilters").onclick=e=>{ const b=e.target.closest(".fBtn"); if(!b) return; fbScope=b.dataset.fs; document.querySelectorAll("#fbFilters .fBtn").forEach(x=>x.classList.toggle("on",x===b)); loadFeedback(); };
$("fbReload").onclick=loadFeedback;
$("fbAdmin").onclick=async e=>{
  const b=e.target.closest("[data-fbsave]"); if(!b) return;
  const id=+b.dataset.fbsave, st=$("fbAdmin").querySelector(`[data-fbst="${id}"]`).value, note=$("fbAdmin").querySelector(`[data-fbnote="${id}"]`).value;
  b.disabled=true;
  const {error}=await sb.rpc("admin_feedback_set",{fid:id, st, note});
  b.disabled=false;
  if(error) return toast(error.message);
  toast("บันทึกแล้ว นักเรียนเห็นสถานะใหม่ทันที"); await loadFeedback();
};
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
    if(row && row.week_no && $("dcAwardsWeek")) $("dcAwardsWeek").value = String(Number(row.week_no));
    if(row && (row.week_no || row.day_index)){ curWeekNo = Number(row.week_no) || Math.max(1, Math.ceil(Number(row.day_index)/7)); if(!$("bsWeek").dataset.touched) $("bsWeek").value = curWeekNo; } }catch(e){}
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
(function(){ const sel=$("dcAwardsWeek"); for(let w=1; w<=12; w++){ const o=document.createElement("option"); o.value=w; o.textContent="สัปดาห์ "+w; sel.appendChild(o); } })();
$("dcAwardsPreview").onclick = async ()=>{
  const w = +$("dcAwardsWeek").value || null;
  const {data, error} = await sb.rpc("weekly_awards_text", {w});
  if(error) return toast(error.message);
  $("dcAwardsText").hidden = false; $("dcAwardsText").textContent = data || "ยังไม่มีข้อมูลสัปดาห์นี้";
};
$("dcAwardsSend").onclick = async ()=>{
  const w = +$("dcAwardsWeek").value || null;
  if(!confirm("ส่ง Weekly Awards สัปดาห์ "+(w||"ล่าสุด")+" เข้า Discord เดี๋ยวนี้?")) return;
  $("dcAwardsSend").disabled = true;
  const {data, error} = await sb.rpc("weekly_awards_text", {w});
  if(error || !data){ $("dcAwardsSend").disabled = false; return toast(error ? error.message : "ยังไม่มีข้อมูล"); }
  const r2 = await sb.rpc("notify_discord", {msg: data});
  $("dcAwardsSend").disabled = false;
  if(r2.error) return toast(r2.error.message);
  toast("ส่ง Weekly Awards แล้ว 🏆");
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

/* ---- TA WAR ---- */
function renderTAs(){
  $("taHouse").innerHTML = HOUSES.map(h=>`<option value="${h.id}">${h.emoji} ${h.name}</option>`).join("");
  const tas = roster.filter(x=>{ const pr = names[x.claimed_by]; return x.role==="ta" || (pr && pr.role==="coach" && pr.house_id); })
    .sort((a,b)=>a.house_id-b.house_id || a.email.localeCompare(b.email));
  $("taRows").innerHTML = tas.length ? tas.map(x=>{
    const pr = names[x.claimed_by];
    return `<tr>
      <td>${esc(x.email)}</td>
      <td>${pr ? `<span class="tag ok" style="color:#5ef08c">${esc(pr.name)}</span>` : '<span class="tag no">ยังไม่สมัคร</span>'}</td>
      <td><select data-move="${esc(x.email)}">${HOUSES.map(h=>`<option value="${h.id}" ${h.id===x.house_id?"selected":""}>${h.emoji} ${h.name}</option>`).join("")}</select></td>
      <td><button class="btn xs danger" data-unta="${esc(x.email)}">ถอด TA</button></td></tr>`; }).join("")
    : '<tr><td colspan="4" style="color:var(--dim);padding:16px">ยังไม่มี TA</td></tr>';
}
$("taAdd").onclick = async ()=>{
  const em = $("taEmail").value.trim().toLowerCase(), hid = +$("taHouse").value;
  if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(em)) return toast("อีเมลไม่ถูกต้อง");
  $("taAdd").disabled = true;
  try{
    const cur = roster.find(x=>x.email.toLowerCase()===em);
    if(!cur || !cur.claimed_by){
      const {error} = await sb.from("roster").upsert({email:em, house_id:hid, role:"ta", full_name: cur ? cur.full_name : null}, {onConflict:"email"});
      if(error) throw error;
    }else{
      if(cur.house_id!==hid){ const {error} = await sb.rpc("admin_set_house", {em, hid}); if(error) throw error; }
      const {error} = await sb.rpc("admin_set_role", {em, new_role:"ta"}); if(error) throw error;
    }
    toast(`ตั้ง ${em}<br>เป็น TA บ้าน ${houseOf(hid).emoji} ${houseOf(hid).name} แล้ว`);
    $("taEmail").value = ""; await load();
  }catch(e){ toast(e.message); }
  $("taAdd").disabled = false;
};
$("taRows").onclick = async e=>{
  const b = e.target.closest("button[data-unta]"); if(!b) return;
  const em = b.dataset.unta;
  if(!confirm(`ถอด ${em} ออกจาก TA (กลับเป็นนักเรียน)?`)) return;
  const {error} = await sb.rpc("admin_set_role", {em, new_role:"student"});
  if(error) return toast(error.message);
  toast(`${em} กลับเป็นนักเรียนแล้ว`); await load();
};
$("taRows").onchange = async e=>{
  const s = e.target.closest("select[data-move]"); if(!s) return;
  const em = s.dataset.move, hid = +s.value, cur = roster.find(x=>x.email===em);
  const {error} = cur && cur.claimed_by ? await sb.rpc("admin_set_house", {em, hid}) : await sb.from("roster").update({house_id:hid}).eq("email", em);
  if(error){ toast(error.message); await load(); return; }
  toast(`ย้าย ${em}<br>ไป ${houseOf(hid).emoji} ${houseOf(hid).name} แล้ว`); await load();
};

/* ================= RENDER ================= */
function render(){
  renderTAs();
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
      ? `<button class="btn xs" data-reset="${esc(x.email)}" title="รหัสของเขากลับเป็นรหัสรวม">รีเซ็ตรหัส</button> <button class="btn xs danger" data-kick="${esc(x.email)}">เตะออก</button>`
      : `<button class="btn xs" data-del="${esc(x.email)}">ลบ</button>`;
    return `<tr>
      <td style="color:var(--dim)">${i+1}</td>
      <td>${esc(x.email)}</td>
      <td class="hideSm" style="color:var(--dim)">${esc(x.full_name||"—")}</td>
      <td>${curRole==="head" ? '<span style="color:var(--dim)">— ทุกบ้าน</span>' : sel(x)}</td>
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
/* ต้องผูกกับแถบกรองของ "รายชื่อ" ไม่ใช่ .filters ตัวแรกในหน้า (แถบภาพรวมรุ่น) ไม่งั้นปุ่ม ทั้งหมด/ยังไม่สมัคร/สมัครแล้ว กดไม่ติด */
([...document.querySelectorAll(".filters")].find(f=>f.querySelector(".fBtn[data-f]")) || document.querySelector(".filters")).onclick = e => {
  const b = e.target.closest(".fBtn"); if(!b || !b.dataset.f) return;
  filter = b.dataset.f;
  b.closest(".filters").querySelectorAll(".fBtn").forEach(x=>x.classList.toggle("on", x===b));   // เฉพาะแถบนี้ ไม่ไปล้างไฮไลต์แถบ feedback
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
  const rs = e.target.closest("button[data-reset]");
  if(rs){
    const em = rs.dataset.reset;
    if(!confirm(`รีเซ็ตรหัสของ ${em} ให้กลับเป็นรหัสรวม?`)) return;
    rs.disabled = true;
    const {error} = await sb.rpc("admin_reset_password", {em});
    rs.disabled = false;
    if(error) return toast(error.message);
    return toast(`รีเซ็ตรหัสของ ${em} แล้ว<br>ให้เขา login ใหม่ด้วยรหัสรวม`);
  }
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
const PLATS = C.PLATFORMS || ["TikTok","YouTube","Instagram","Threads","Facebook","X","Blog"];
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
