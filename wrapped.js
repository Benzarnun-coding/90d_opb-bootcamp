/* ============================================================================
   🎁 WRAPPED — สรุป 90 วันแบบ Spotify Wrapped (นักเรียนห้ามเห็นจนกว่า Benz สั่งเปิด)
   - ไฟล์นี้โหลดตอนเรียก openWrapped() เท่านั้น (app.js ไม่ได้ <script> มันไว้) · ไม่มีปุ่มไหนในเว็บจริงเรียกมัน
   - ข้อมูลเข้าเป็นก้อน RAW ก้อนเดียว (ตอนนี้มาจากโหมด DEMO · ของจริงจะมาจากตาราง wrapped_stats ที่โค้ชกดสร้าง)
   - build(raw) → W รายคน (สถิติ + ห้องสถิติเด็ด + สไตล์นักสร้าง + ระดับ) → slides(W) → viewer + การ์ดแชร์รูป
   - กติกา: หน้าที่คนนั้นไม่ติดจะไม่ขึ้น (ไม่มีข้อความ "คุณไม่ติด") · อันดับ Top X% โชว์เฉพาะครึ่งบน
   ========================================================================== */
(function(){
"use strict";
const N = v => Number(v)||0;
const sum = a => a.reduce((x,y)=>x+y,0);
const days0 = ["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสฯ","ศุกร์","เสาร์"];
const fN = v => (typeof fmtN==="function") ? fmtN(v) : String(v);
const wk = d => (typeof weekOf==="function") ? weekOf(d) : Math.max(1,Math.floor((d-1)/7)+1);
const SEC = {intro:["#2a1a6e","#0b0626"], vol:["#ff4d6d","#5a0f2e"], path:["#2d7dff","#0b1a52"], streak:["#ff9a1f","#6b2a00"], rhythm:["#7b5cff","#1c0f5a"], goal:["#22d3a0","#053f3a"], boss:["#ff3d3d","#3a0710"],
  pvp:["#ffd23f","#5a3a00"], social:["#ff6bd6","#4a0a45"], house:["#4ee1ff","#06324a"], badge:["#ffd76b","#4a2f00"], rec:["#ffe27a","#7a4a00"], style:["#a78bfa","#26104d"], cohort:["#34d399","#05302a"], final:["#2a1a6e","#080421"]};

/* ---------------------------------------------------------------- RAW จาก DEMO */
function seeded(seed){ let s=(seed>>>0)||1; return ()=>{ s=(Math.imul(s,1664525)+1013904223)>>>0; return s/4294967296; }; }
function rawFromDemo(d){
  const rnd=seeded(20261201), ppl=d.runners.map(r=>({id:r.id, name:r.name, handle:r.handle, role:(typeof roleOf==="function"?roleOf(r):(r.role==="coach"?(r.house?"ta":"head"):"student")), house:r.house, color:r.color, av:r.avatar, pledges:r.pledges||{}}));
  const idOf=n=>{ const p=ppl.find(x=>x.name===n); return p&&p.id; };
  const subs=d.subs.map(s=>({pid:idOf(s.who), day:s.day, ts:s.ts, plat:s.plat, note:s.note||"", crit:s.crit||1})).filter(s=>s.pid);
  const stu=ppl.filter(p=>p.role==="student"), pick=a=>a[Math.floor(rnd()*a.length)];
  const raw={preview:true, synthetic:false, people:ppl, subs, today:d.today, curWeek:wk(d.today), bosses:(d.bosses||[]), bossHits:(d.bossHits||[]), critLog:(d.critLog||[]).map(c=>({pid:c.profile_id, crit:+c.crit, boss:c.boss_id})),
    duels:(d.duels||[]).map(x=>({a:x.challenger,b:x.opponent,status:x.status,winner:x.winner,sa:N(x.challenger_score),sb:N(x.opponent_score)})),
    cheers:(d.cheers||[]).map(c=>({from:c.from_id,to:c.to_id,day:c.day_index})), nudges:(d.nudges||[]).map(n=>({from:n.from_id,to:n.to_id})),
    buddies:(d.buddies||[]).map(b=>({a:b.a,b:b.b,best:N(b.best)})), kings:d.kings||[], cups:d.cups||[], houseWeeks:d.houseWeeks||[], kudos:{}, reach:{}, heartN:{}, vacDays:new Set(), heartsSent:0};
  (d.kudos||[]).forEach(k=>{ raw.kudos[k.profile_id]=N(k.n); }); (d.reach||[]).forEach(r=>{ raw.reach[r.profile_id]=N(r.total_views); });
  for(let x=43;x<=49;x++) raw.vacDays.add(x);
  /* ข้อมูลตัวอย่างสำหรับพรีวิว: ถ้าโหมด demo ยังไม่มีดวล/เชียร์/บัดดี้/คริ ให้เติมแบบคงที่ (เฉพาะพรีวิว) */
  if(stu.length>6){
    if(!raw.duels.length){ for(let i=0;i<34;i++){ const a=pick(stu), b=pick(stu); if(a.id===b.id) continue; const sa=3+Math.floor(rnd()*9), sb=3+Math.floor(rnd()*9); raw.duels.push({a:a.id,b:b.id,status:"done",winner:sa===sb?null:(sa>sb?a.id:b.id),sa,sb}); } raw.synthetic=true; }
    if(!raw.cheers.length){ for(let i=0;i<420;i++){ const a=pick(stu), b=pick(stu); if(a.id!==b.id) raw.cheers.push({from:a.id,to:b.id,day:1+Math.floor(rnd()*d.today)}); } raw.synthetic=true; }
    if(!raw.nudges.length){ for(let i=0;i<90;i++){ const a=pick(stu), b=pick(stu); if(a.id!==b.id) raw.nudges.push({from:a.id,to:b.id}); } raw.synthetic=true; }
    if(!raw.buddies.length){ for(let i=0;i<16;i++){ const a=pick(stu), b=pick(stu); if(a.id!==b.id) raw.buddies.push({a:a.id,b:b.id,best:1+Math.floor(rnd()*14)}); } raw.synthetic=true; }
    if(!raw.critLog.length){ for(let i=0;i<20;i++){ const a=pick(stu); raw.critLog.push({pid:a.id,crit:[3,3,3,5,5,10][Math.floor(rnd()*6)],boss:101}); } raw.synthetic=true; }
    for(let i=0;i<8;i++){ const a=pick(stu); raw.heartN[a.id]=(raw.heartN[a.id]||0)+1; }
    stu.slice(0,12).forEach(p=>{ raw.kudos[p.id]=raw.kudos[p.id]||Math.floor(rnd()*6); });
  }
  return raw;
}

/* ---------------------------------------------------------------- สถิติรายคน */
function metrics(m, raw){
  const subs=m.subs, today=raw.today, cw=raw.curWeek;
  const days={}, weeks={}, hours=Array(24).fill(0), dow=Array(7).fill(0), plats={};
  const c={threeAM:0, midnight:0, lunch:0, pretty:0, sunday:0, monday:0, lastMin:0, early:0, late:0};
  subs.forEach(s=>{
    days[s.day]=(days[s.day]||0)+1; const w=wk(s.day); weeks[w]=(weeks[w]||0)+1;
    const dt=new Date(s.ts), h=dt.getHours(), mi=dt.getMinutes(), g=dt.getDay();
    hours[h]++; dow[g]++; plats[s.plat]=(plats[s.plat]||0)+1;
    if(h===2||h===3) c.threeAM++; if(h===0&&mi<10) c.midnight++; if(h===12) c.lunch++;
    if(mi>0 && (mi%11===0 || h===mi)) c.pretty++; if(g===0) c.sunday++; if(g===1) c.monday++;
    if(g===3&&h===20&&mi>=20&&mi<30) c.lastMin++; if(h>=4&&h<6) c.early++; if(h>=22||h<4) c.late++;
  });
  m.n=subs.length; m.days=days; m.weeksDone=weeks; m.hours=hours; m.dow=dow; m.plats=plats; m.c=c; m.activeDays=Object.keys(days).length;
  const ts=subs.map(s=>s.ts).sort((a,b)=>a-b); m.firstTs=ts[0]||0; m.lastTs=ts[ts.length-1]||0; m.t30=ts[29]||0; m.t60=ts[59]||0; m.t90=ts[89]||0;
  let bd={n:0,d:0}; Object.entries(days).forEach(([d,n])=>{ if(n>bd.n) bd={n,d:+d}; }); m.bestDay=bd;
  let bw={n:0,w:0}; Object.entries(weeks).forEach(([w,n])=>{ if(n>bw.n) bw={n,w:+w}; }); m.bestWeek=bw;
  let run=0, best=0; for(let d=1; d<=today; d++){ if(days[d]){ run++; best=Math.max(best,run); } else if(!raw.vacDays.has(d)) run=0; } m.longestStreak=best;
  m.triples=Object.values(days).filter(n=>n===3).length;
  m.perfectWeeks=0; for(let w=1; w<=cw; w++){ let k=0; for(let d=(w-1)*7+1; d<=w*7; d++) if(days[d]) k++; if(k===7) m.perfectWeeks++; }
  m.topHour=hours.indexOf(Math.max(...hours)); m.topDow=dow.indexOf(Math.max(...dow));
  const pl=Object.entries(plats).sort((a,b)=>b[1]-a[1]); m.topPlat=pl[0]?{k:pl[0][0],n:pl[0][1]}:null; m.platN=pl.length;
  /* เป้ารายสัปดาห์ */
  m.wk=[]; let hitRun=0, maxHitRun=0, burned=false, revived=false, laser=0, promax=0, exact=0, bestRatio=0; const tcount={};
  for(let w=1; w<cw+ (raw.final?1:0); w++){
    const t=N((m.p.pledges||{})[w]); if(!t) continue; const done=weeks[w]||0, hit=done>=t;
    m.wk.push({w,t,done,hit}); tcount[t]=(tcount[t]||0)+1;
    if(hit){ hitRun++; maxHitRun=Math.max(maxHitRun,hitRun); if(burned) revived=true; } else { hitRun=0; if(t>=10) burned=true; }
    if(t>=14) promax++; else if(t>=10) laser++; if(done===t) exact++; bestRatio=Math.max(bestRatio,done/t);
  }
  m.weeksTotal=m.wk.length; m.weeksHit=m.wk.filter(x=>x.hit).length; m.maxHitRun=maxHitRun; m.revived=revived; m.laser=laser; m.promax=promax; m.exact=exact; m.bestRatio=bestRatio;
  const tc=Object.entries(tcount).sort((a,b)=>b[1]-a[1]); m.favTarget=tc[0]?+tc[0][0]:0;
  let swing=0; for(let w=2; w<=cw; w++) swing=Math.max(swing,Math.abs((weeks[w]||0)-(weeks[w-1]||0))); m.swing=swing;
  m.holiday=subs.filter(s=>raw.vacDays.has(s.day)).length;
  m.earlyAny=hours.slice(0,6).some(x=>x>0);
}

/* ---------------------------------------------------------------- ระบบ build ทั้งรุ่น */
function build(raw){
  const P={}; raw.people.forEach(p=>{ P[p.id]={p,subs:[],id:p.id}; });
  raw.subs.forEach(s=>{ if(P[s.pid]) P[s.pid].subs.push(s); });
  const M=Object.values(P); M.forEach(m=>metrics(m,raw));
  const bossDead={}; raw.bosses.forEach(b=>{ bossDead[b.id]=N(b.damage)>=N(b.hp); });
  M.forEach(m=>{ m.damage=0; m.fb=0; m.lh=0; m.slain=0; m.c3=0; m.c5=0; m.c10=0; m.duel={fought:0,won:0,lost:0,draw:0,done:0,challenged:0,margin:0,rivals:{}}; m.given=0; m.recv=0; m.nSent=0; m.nRecv=0; m.buddies=[]; m.buddyBest=0; m.cheerWeek={}; });
  raw.bossHits.forEach(h=>{ const m=P[h.profile_id]; if(!m) return; m.damage+=N(h.hits); if(h.first_blood) m.fb++; if(h.last_hit) m.lh++; if(bossDead[h.boss_id]) m.slain++; });
  raw.critLog.forEach(c=>{ const m=P[c.pid]; if(!m) return; if(c.crit>=10) m.c10++; else if(c.crit>=5) m.c5++; else if(c.crit>=3) m.c3++; });
  raw.duels.forEach(x=>{ [[x.a,x.b,x.sa,x.sb],[x.b,x.a,x.sb,x.sa]].forEach(([me,opp,ms,os],i)=>{ const m=P[me]; if(!m) return; if(x.status==="done"||x.status==="active") m.duel.fought++;
      if(x.status==="done"){ m.duel.done++; if(x.winner===me){ m.duel.won++; m.duel.margin=Math.max(m.duel.margin,ms-os); } else if(x.winner) m.duel.lost++; else m.duel.draw++; }
      if(i===1) m.duel.challenged++; m.duel.rivals[opp]=(m.duel.rivals[opp]||0)+1; }); });
  raw.cheers.forEach(c=>{ if(P[c.from]) P[c.from].given++; if(P[c.to]){ P[c.to].recv++; const w=wk(c.day||1); P[c.to].cheerWeek[w]=(P[c.to].cheerWeek[w]||0)+1; } });
  raw.nudges.forEach(n=>{ if(P[n.from]) P[n.from].nSent++; if(P[n.to]) P[n.to].nRecv++; });
  raw.buddies.forEach(b=>{ [[b.a,b.b],[b.b,b.a]].forEach(([me,o])=>{ if(!P[me]||!P[o]) return; P[me].buddies.push({id:o,name:P[o].p.name,best:b.best}); P[me].buddyBest=Math.max(P[me].buddyBest,b.best); }); });
  const houseTotal={}; M.forEach(m=>{ if(m.p.role==="student") houseTotal[m.p.house]=(houseTotal[m.p.house]||0)+m.n; });
  const kingW={}; raw.kings.forEach(k=>{ (kingW[k.profile_id]=kingW[k.profile_id]||[]).push(k.week_no); });
  const cupsBy={}; raw.cups.forEach(c=>{ cupsBy[c.house_id]=(cupsBy[c.house_id]||0)+1; });
  M.forEach(m=>{ m.kingWeeks=(kingW[m.id]||[]).sort((a,b)=>a-b); m.houseCups=cupsBy[m.p.house]||0; m.houseShare=houseTotal[m.p.house]?Math.round(m.n/houseTotal[m.p.house]*100):0;
    m.hearts=N(raw.heartN[m.id]); m.kudos=N(raw.kudos[m.id]); m.views=N(raw.reach[m.id]); m.cheerPeak=Math.max(0,...Object.values(m.cheerWeek)); });
  /* ป้าย */
  const stu=M.filter(m=>m.p.role==="student" && m.n>0);
  M.forEach(m=>{ m.badges=earnedKeys(m); });
  const holders={}; stu.forEach(m=>m.badges.forEach(k=>{ holders[k]=(holders[k]||0)+1; }));
  /* เปอร์เซ็นไทล์ + ระดับ + สไตล์ */
  const pr=(f)=>{ const vals=stu.map(f); return m=>{ if(!vals.length) return 0; const v=f(m); return (vals.filter(x=>x<v).length+0.5*vals.filter(x=>x===v).length)/vals.length; }; };
  const pVol=pr(m=>m.n), pCon=pr(m=>m.activeDays), pGoal=pr(m=>m.weeksTotal?m.weeksHit/m.weeksTotal:0), pBoss=pr(m=>m.damage+m.duel.won*3), pSoc=pr(m=>m.given+m.recv);
  M.forEach(m=>{ m.pct={vol:pVol(m),con:pCon(m),goal:pGoal(m),boss:pBoss(m),soc:pSoc(m)};
    m.score=100*(0.40*m.pct.vol+0.25*m.pct.con+0.15*m.pct.goal+0.10*m.pct.boss+0.10*m.pct.soc);
    const rankV=stu.filter(x=>x.n>m.n).length+1; m.rankVol=rankV; m.topPct=stu.length?Math.max(1,Math.ceil(rankV/stu.length*100)):100; });
  /* ห้องสถิติเด็ด */
  const recs=computeRecords(stu); M.forEach(m=>{ m.records=(recs[m.id]||[]); m.style=pickStyle(m,stu.length); m.tier=pickTier(m); });
  raw._holders=holders; raw._students=stu.length;
  /* ภาพรวมรุ่น */
  raw.cohort={students:stu.length, pieces:sum(stu.map(m=>m.n)), slain:raw.bosses.filter(b=>N(b.damage)>=N(b.hp)).length, topHouse:topHouse(raw), crit10:sum(stu.map(m=>m.c10)), duels:raw.duels.length};
  return {M, P, raw};
}
function topHouse(raw){ const t={}; (raw.houseWeeks||[]).filter(w=>w.is_final!==false).forEach(w=>{ t[w.house_id]=(t[w.house_id]||0)+N(w.points); }); const e=Object.entries(t).sort((a,b)=>b[1]-a[1])[0]; return e?{house:+e[0],pts:e[1]}:null; }

function earnedKeys(m){
  const k=[], d=m.duel;
  if(m.n>=1) k.push("first"); if(m.longestStreak>=7) k.push("streak7"); if(m.maxHitRun>=3) k.push("hit3"); if(m.earlyAny) k.push("early");
  if(m.wk.some(x=>x.t>=10&&x.t<14)) k.push("laser"); if(m.wk.some(x=>x.t>=14)) k.push("promax"); if(m.revived) k.push("revive");
  if(m.n>=30) k.push("c30"); if(m.n>=60) k.push("c60"); if(m.n>=(typeof FINISH!=="undefined"?FINISH:90)) k.push("c90");
  if(m.houseCups>0) k.push("cup"); if(m.kingWeeks.length) k.push("king"); if(m.cheerPeak>=10) k.push("popular"); if(d.fought>0) k.push("duelist");
  if(m.hearts>=1) k.push("heart"); if(m.buddyBest>=7) k.push("buddy"); if(d.done>=3) k.push("brave"); if(m.kudos>=3) k.push("quality"); if(m.views>=10000) k.push("reach");
  if(m.holiday>0) k.push("holiday"); if(m.slain>0) k.push("slayer");
  return k;
}

/* ---------------------------------------------------------------- ห้องสถิติเด็ด (ติดเฉพาะคนที่ได้ที่ 1–3 · ที่เหลือข้าม) */
const RECS=[
 /* ⚔️ PVP */
 {k:"duelWins",cat:"pvp",e:"⚔️",t:"นักสู้ผู้ชนะ",g:m=>m.duel.won,min:1,u:"ครั้งที่ชนะดวล",w:9},
 {k:"duelFought",cat:"pvp",e:"🥊",t:"นักดวลตัวยง",g:m=>m.duel.fought,min:2,u:"ครั้งที่ลงดวล",w:7},
 {k:"challenged",cat:"pvp",e:"🎯",t:"เป้าหมายยอดนิยม (ถูกท้าบ่อยสุด)",g:m=>m.duel.challenged,min:2,u:"ครั้งที่ถูกท้า",w:6},
 {k:"margin",cat:"pvp",e:"💥",t:"ชนะขาดลอย",g:m=>m.duel.margin,min:3,u:"ชิ้น คือส่วนต่างที่ชนะ",w:8},
 {k:"rival",cat:"pvp",e:"🦊",t:"คู่ปรับตลอดกาล",g:m=>Math.max(0,...Object.values(m.duel.rivals)),min:2,u:"ครั้งที่ดวลกับคนเดิม",w:6},
 {k:"lostHat",cat:"pvp",e:"🎩",t:"ผู้กล้าใส่หมวกคนแพ้",g:m=>m.duel.lost,min:2,u:"ครั้งที่แพ้ (แต่ไม่เคยหนี)",w:5},
 /* 🕐 จังหวะเวลา */
 {k:"night",cat:"time",e:"🦉",t:"นกฮูกราตรี",g:m=>m.c.late,min:3,u:"ชิ้นที่ส่งช่วง 22:00–04:00",w:6},
 {k:"earlyBird",cat:"time",e:"🌅",t:"นกตื่นเช้าตัวจริง",g:m=>m.c.early,min:2,u:"ชิ้นที่ส่งก่อนหกโมงเช้า",w:7},
 {k:"lastMin",cat:"time",e:"🚨",t:"ตัดหน้าไฟแดง",g:m=>m.c.lastMin,min:2,u:"ชิ้นที่ส่งในสิบนาทีสุดท้ายก่อนตัดรอบ",w:8},
 {k:"bestDay",cat:"time",e:"⚡",t:"วันเดียวแหลก",g:m=>m.bestDay.n,min:4,u:"ชิ้นในวันเดียว",w:7},
 {k:"bestWeek",cat:"time",e:"🚀",t:"สัปดาห์สายฟ้า",g:m=>m.bestWeek.n,min:10,u:"ชิ้นในสัปดาห์เดียว",w:7},
 {k:"firstPost",cat:"time",e:"🥇",t:"คนแรกที่ลงมือ",g:m=>m.firstTs?-m.firstTs:null,min:-Infinity,u:"โพสต์แรกของรุ่น",w:9,fmt:m=>new Date(m.firstTs).toLocaleDateString("th-TH",{day:"numeric",month:"short"})},
 {k:"first30",cat:"time",e:"🏃",t:"ถึง 30 ชิ้นก่อนใคร",g:m=>m.t30?-m.t30:null,min:-Infinity,u:"ถึง 30 ชิ้น",w:8,fmt:m=>new Date(m.t30).toLocaleDateString("th-TH",{day:"numeric",month:"short"})},
 {k:"first90",cat:"time",e:"🏁",t:"เส้นชัยคนแรก ๆ",g:m=>m.t90?-m.t90:null,min:-Infinity,u:"ถึงเส้นชัย 90 ชิ้น",w:10,fmt:m=>new Date(m.t90).toLocaleDateString("th-TH",{day:"numeric",month:"short"})},
 /* 🗡️ บอส/ดวงชะตา */
 {k:"damage",cat:"boss",e:"🗡️",t:"ดาเมจรวมสูงสุด",g:m=>m.damage,min:1,u:"ดาเมจที่ใส่บอส",w:8},
 {k:"firstBlood",cat:"boss",e:"🩸",t:"นักล่าเลือดแรก",g:m=>m.fb,min:1,u:"บอสที่คุณเป็นคนตีแรก",w:8},
 {k:"lastHit",cat:"boss",e:"☠️",t:"ผู้ปิดฉากบอส",g:m=>m.lh,min:1,u:"บอสที่คุณตีดาเมจสุดท้าย",w:9},
 {k:"critN",cat:"boss",e:"💥",t:"ราชาคริติคอล",g:m=>m.c3+m.c5+m.c10,min:2,u:"ครั้งที่ติดคริ",w:7},
 {k:"x10",cat:"boss",e:"📖",t:"ผู้ติดคริ ×10",g:m=>m.c10,min:1,u:"ครั้งที่ติด ×10 (ได้หนังสือ)",w:12},
 {k:"luck",cat:"boss",e:"🍀",t:"ดวงเทพ",g:m=>(m.c3+m.c5+m.c10)>=2?Math.round((m.c3+m.c5+m.c10)/m.n*1000)/10:0,min:3,u:"% ของชิ้นที่ติดคริ",w:7},
 /* 🤝 สังคม */
 {k:"cheerleader",cat:"social",e:"📣",t:"เชียร์ลีดเดอร์ของรุ่น",g:m=>m.given,min:5,u:"ครั้งที่เชียร์เพื่อน",w:8},
 {k:"darling",cat:"social",e:"💖",t:"ขวัญใจของรุ่น",g:m=>m.recv,min:5,u:"ครั้งที่มีคนเชียร์",w:9},
 {k:"nudger",cat:"social",e:"👉",t:"แม่บ้านสะกิด",g:m=>m.nSent,min:3,u:"ครั้งที่สะกิดเพื่อน",w:6},
 {k:"nudged",cat:"social",e:"🧲",t:"ถูกตามตัวบ่อยสุด",g:m=>m.nRecv,min:3,u:"ครั้งที่ถูกเพื่อนสะกิด",w:5},
 {k:"buddy",cat:"social",e:"🤝",t:"บัดดี้ตัวติด",g:m=>m.buddyBest,min:3,u:"วัน streak คู่ที่ยาวที่สุด",w:8},
 {k:"hearts",cat:"social",e:"💛",t:"ลูกรักอาจารย์",g:m=>m.hearts,min:2,u:"ครั้งที่ได้กำลังใจจากอาจารย์",w:8},
 {k:"polyglot",cat:"social",e:"🧭",t:"นักท่องแพลตฟอร์ม",g:m=>m.platN,min:4,u:"แพลตฟอร์มที่ใช้",w:5},
 /* 💪 ไม่ยอมแพ้ */
 {k:"streak",cat:"grit",e:"🔥",t:"ไฟไม่ดับ",g:m=>m.longestStreak,min:5,u:"วันติดต่อกันที่ยาวที่สุด",w:9},
 {k:"weeksHit",cat:"grit",e:"🎯",t:"แม่นเป้า",g:m=>m.weeksHit,min:3,u:"สัปดาห์ที่ครบเป้า",w:8},
 {k:"holiday",cat:"grit",e:"🏅",t:"ฮีโร่ปิดเทอม",g:m=>m.holiday,min:1,u:"ชิ้นที่ส่งช่วงปิดเทอม",w:7},
 {k:"kudos",cat:"grit",e:"👍",t:"งานดีเป็นที่ยอมรับ",g:m=>m.kudos,min:1,u:"ครั้งที่ TA ให้งานดี",w:7},
 {k:"perfect",cat:"grit",e:"📅",t:"ครบทั้งเจ็ดวัน",g:m=>m.perfectWeeks,min:1,u:"สัปดาห์ที่ส่งครบทุกวัน",w:7},
 /* 🤪 ปั่น ๆ */
 {k:"threeAM",cat:"wacky",e:"🌌",t:"ตีสามยังไม่นอน",g:m=>m.c.threeAM,min:1,u:"ชิ้นที่ส่งช่วงตีสอง–ตีสี่",w:9},
 {k:"midnight",cat:"wacky",e:"🕛",t:"เที่ยงคืนตรงเป๊ะ",g:m=>m.c.midnight,min:2,u:"ชิ้นที่ส่งตอนเที่ยงคืนนิด ๆ",w:8},
 {k:"lunch",cat:"wacky",e:"🍜",t:"สายพักเที่ยง",g:m=>m.c.lunch,min:5,u:"ชิ้นที่ส่งตอนเที่ยง",w:6},
 {k:"pretty",cat:"wacky",e:"🎰",t:"นักล่าเลขสวย (12:12, 21:33, 14:44 ...)",g:m=>m.c.pretty,min:3,u:"ชิ้นที่ส่งตอนเวลาเลขสวย",w:8},
 {k:"sunday",cat:"wacky",e:"😵",t:"ไม่มีวันหยุด (วันอาทิตย์ก็ส่ง)",g:m=>m.c.sunday,min:6,u:"ชิ้นที่ส่งวันอาทิตย์",w:7},
 {k:"monday",cat:"wacky",e:"☕",t:"วันจันทร์ไม่ใช่ปัญหา",g:m=>m.c.monday,min:8,u:"ชิ้นที่ส่งวันจันทร์",w:6},
 {k:"exact",cat:"wacky",e:"🎯",t:"แม่นแบบเป๊ะ ๆ (ได้เป้าพอดีเป๊ะ)",g:m=>m.exact,min:2,u:"สัปดาห์ที่ได้เป้าพอดีไม่ขาดไม่เกิน",w:8},
 {k:"over",cat:"wacky",e:"🚀",t:"เกินเป้าแบบไม่เกรงใจ",g:m=>Math.round(m.bestRatio*100)/100,min:1.5,u:"เท่าของเป้าในสัปดาห์ที่พุ่งสุด",w:7},
 {k:"coaster",cat:"wacky",e:"🎢",t:"รถไฟเหาะ",g:m=>m.swing,min:8,u:"ชิ้นคือส่วนต่างสัปดาห์ต่อสัปดาห์ที่แกว่งสุด",w:7},
 {k:"triple",cat:"wacky",e:"🔱",t:"สามชิ้นพอดี ไม่เอาเกิน",g:m=>m.triples,min:3,u:"วันที่ส่งสามชิ้นพอดี",w:6}
];
function computeRecords(stu){
  const out={};
  RECS.forEach(def=>{
    const vals=stu.map(m=>({m,v:def.g(m)})).filter(x=>x.v!==null && x.v!==undefined && x.v>=def.min && !Number.isNaN(x.v));
    if(!vals.length) return;
    vals.sort((a,b)=>b.v-a.v);
    vals.forEach(x=>{ x.rank=vals.filter(y=>y.v>x.v).length+1; });
    vals.filter(x=>x.rank<=3).forEach(x=>{ const same=vals.filter(y=>y.v===x.v).length;
      (out[x.m.id]=out[x.m.id]||[]).push({def, value:x.v, rank:x.rank, same, cat:def.cat, text:def.fmt?def.fmt(x.m):fN(Math.abs(x.v)), score:(4-x.rank)*100+def.w*10-Math.min(same,9)}); });
  });
  Object.keys(out).forEach(id=>{ const arr=out[id].sort((a,b)=>b.score-a.score), pick=[], cats={};
    arr.forEach(r=>{ if(pick.length>=3) return; if((cats[r.cat]||0)>=2) return; cats[r.cat]=(cats[r.cat]||0)+1; pick.push(r); }); out[id]=pick; });
  return out;
}

/* ---------------------------------------------------------------- สไตล์นักสร้าง + ระดับ */
const STYLES=[
 {k:"early",e:"🌅",n:"EARLY BIRD",th:"ตื่นมาสร้างตั้งแต่ฟ้าสาง ใครว่าเช้าไม่ดี",s:m=>m.n?(m.hours.slice(4,9).reduce((a,b)=>a+b,0)/m.n)*2:0},
 {k:"night",e:"🌙",n:"NIGHT OWL",th:"ไอเดียมาตอนดึก มือไวตอนคนอื่นหลับ",s:m=>m.n?(m.c.late/m.n)*2:0},
 {k:"sprinter",e:"🏃",n:"SPRINTER",th:"พุ่งเป็นช่วง ๆ แล้วทิ้งห่างทุกคน",s:m=>{ const wks=Object.keys(m.weeksDone).length||1; const avg=m.n/wks; return avg?Math.min(1,(m.bestWeek.n/avg-1.2)/1.6):0; }},
 {k:"marathon",e:"🐢",n:"MARATHONER",th:"ไม่หวือหวา แต่ไม่เคยหายไป",s:m=>{ const span=Math.max(1,m.lastTs&&m.firstTs?Math.round((m.lastTs-m.firstTs)/864e5)+1:1); return Math.min(1,(m.activeDays/span)/0.75); }},
 {k:"boss",e:"⚔️",n:"BOSS HUNTER",th:"เห็นบอสเมื่อไรมือสั่นเมื่อนั้น",s:m=>m.pct.boss*(m.damage>0?1:0)},
 {k:"social",e:"🤝",n:"SOCIAL BUTTERFLY",th:"เป็นคนทำให้รุ่นนี้มีชีวิตชีวา",s:m=>m.pct.soc*((m.given+m.recv)>5?1:0)},
 {k:"crusher",e:"🎯",n:"GOAL CRUSHER",th:"บอกเป้าไว้เท่าไร ทำให้ได้เท่านั้น",s:m=>m.weeksTotal?m.weeksHit/m.weeksTotal:0},
 {k:"comeback",e:"💀",n:"COMEBACK KID",th:"ล้มแล้วลุกได้ นั่นแหละคือตัวจริง",s:m=>m.revived?0.95:0}
];
function pickStyle(m){ if(!m.n) return null; if(m.n<8) return {k:"explorer",e:"🧭",n:"EXPLORER",th:"เพิ่งเริ่มก้าวแรก ทุกชิ้นคือการเรียนรู้ และก้าวต่อไปเป็นของคุณ"}; let best=null; STYLES.forEach(s=>{ const v=Math.max(0,s.s(m)); if(!best||v>best.v) best={s,v}; }); return best&&best.v>=0.3?best.s:{k:"explorer",e:"🧭",n:"EXPLORER",th:"ลองผิดลองถูกในแบบของตัวเอง ทุกชิ้นคือการเรียนรู้"}; }
function pickTier(m){
  if(!m.n) return null; const fin=m.n>=(typeof FINISH!=="undefined"?FINISH:90); let t=m.score>=85?0:m.score>=65?1:m.score>=40?2:m.score>=15?3:4; if(fin) t=Math.min(t,1);
  return [{k:"legend",e:"👑",n:"LEGEND"},{k:"gold",e:"🥇",n:"GOLD"},{k:"silver",e:"🥈",n:"SILVER"},{k:"bronze",e:"🥉",n:"BRONZE"},{k:"starter",e:"🌱",n:"STARTER"}][t];
}

/* ---------------------------------------------------------------- สร้างสไลด์ (ใช้ชุดเดียวกันทั้งหน้าจอและรูปแชร์) */
function badgeMeta(k){ return (typeof BADGES!=="undefined"?BADGES:[]).find(b=>b.k===k)||{e:"🏅",n:k,th:""}; }
function slides(W){
  const m=W.m, raw=W.raw, role=m.p.role, hs=(typeof houseOf==="function")?houseOf(m.p.house):{name:"",emoji:"",color:"#fff"}, S=[];
  const add=(id,sec,o)=>S.push(Object.assign({id,c:SEC[sec]||SEC.intro,sec},o));
  const roleTxt=role==="student"?"":(role==="ta"?" · TA":" · หัวหน้าโค้ช");
  add("intro","intro",{kicker:`WRAPPED${roleTxt}`,big:m.p.name,bigSmall:true,sub:`${hs.emoji} บ้าน ${hs.name}`,lines:["90 วันที่ผ่านมา คุณทำอะไรไว้บ้าง","ไปดูกัน 👉"],viz:{t:"sprite"}});
  if(m.n>0){
    const low=m.n<30, lines=[`ใน ${m.activeDays} วัน จาก 90 วัน`];
    if(role==="student" && m.topPct<=50) lines.push(`🏆 Top ${m.topPct}% ของรุ่น`);
    if(m.n>=90) lines.push("🏁 ถึงเส้นชัย 90 ชิ้นแล้ว!");
    if(low) lines.push("ทุกชิ้นคือก้าวที่คนส่วนใหญ่ไม่เคยเริ่ม");
    add("vol","vol",{kicker:"คุณปล่อยคอนเทนต์ไปทั้งหมด",big:m.n,sub:"ชิ้น",lines,emoji:"📤"});
    add("path","path",{kicker:"เส้นทางของคุณ",big:m.bestWeek.n,sub:`ชิ้นในสัปดาห์ที่ ${m.bestWeek.w} (สัปดาห์ที่แรงที่สุด)`,lines:[`วันที่ส่งมากสุด: ${m.bestDay.n} ชิ้น (วันที่ ${m.bestDay.d})`,`โพสต์แรกเมื่อ ${new Date(m.firstTs).toLocaleDateString("th-TH",{day:"numeric",month:"long"})}`],viz:{t:"strip"}});
    if(m.longestStreak>=2||m.weeksTotal>0){
      const l=[]; if(m.weeksTotal) l.push(`ครบเป้า ${m.weeksHit}/${m.weeksTotal} สัปดาห์`); if(m.maxHitRun>=3) l.push(`ครบเป้าติดกัน ${m.maxHitRun} สัปดาห์ 🎯`); if(m.perfectWeeks) l.push(`ส่งครบทั้ง 7 วัน ${m.perfectWeeks} สัปดาห์ 📅`);
      add("streak","streak",{kicker:"ความสม่ำเสมอ",big:m.longestStreak,sub:"วันติดต่อกันที่ยาวที่สุด 🔥",lines:l,emoji:"🔥"});
    }
    const ph=m.topHour, phTxt=String(ph).padStart(2,"0")+":00", lt=[`วัน${days0[m.topDow]}คือวันของคุณ`]; if(m.topPlat) lt.push(`แพลตฟอร์มโปรด: ${m.topPlat.k} (${Math.round(m.topPlat.n/m.n*100)}%)`);
    add("rhythm","rhythm",{kicker:"จังหวะการสร้างของคุณ",big:phTxt,sub:"ช่วงเวลาที่คุณส่งงานบ่อยที่สุด",lines:lt,viz:{t:"hours"}});
    if(m.weeksTotal>0){
      const l=[]; if(m.promax) l.push(`💚 รับเป้า PRO MAX 14 ชิ้น ${m.promax} สัปดาห์`); if(m.laser) l.push(`🔴 รับเป้า LASER FOCUS ${m.laser} สัปดาห์`); if(m.revived) l.push("💀→✅ ล้มเป็นกระโหลกแล้วลุกกลับมาทำครบ"); if(!l.length) l.push("เลือกเป้าที่ไหวแล้วทำให้ได้ คือสุดยอดแล้ว");
      add("goal","goal",{kicker:"เป้าที่คุณเลือกบ่อยที่สุด",big:m.favTarget,sub:"ชิ้นต่อสัปดาห์",lines:l,viz:{t:"weeks"}});
    }
    if(m.damage>0){
      const l=[]; if(m.slain) l.push(`ร่วมล้มบอส ${m.slain} ตัว 🗡️`); if(m.fb) l.push(`FIRST BLOOD ×${m.fb} 🩸`); if(m.lh) l.push(`LAST HIT ×${m.lh} 💥`);
      const cr=m.c3+m.c5+m.c10; if(cr) l.push(`ติดคริติคอล ${cr} ครั้ง (×3: ${m.c3} · ×5: ${m.c5} · ×10: ${m.c10})`);
      add("boss","boss",{kicker:"สนามบอส",big:m.damage,sub:"ดาเมจรวมที่คุณใส่บอส",lines:l,emoji:"🗡️"});
    }
    if(m.duel.fought>0){
      const d=m.duel, rv=Object.entries(d.rivals).sort((a,b)=>b[1]-a[1])[0], rvName=rv&&W.P[rv[0]]?W.P[rv[0]].p.name:null, l=[];
      if(rvName&&rv[1]>=2) l.push(`คู่ปรับตลอดกาล: ${rvName} (${rv[1]} ครั้ง)`); if(d.margin>0) l.push(`ชนะห่างสุด ${d.margin} ชิ้น`); l.push(`ลงดวลทั้งหมด ${d.fought} ครั้ง`);
      add("pvp","pvp",{kicker:"สังเวียนดวล ⚔️",big:`${d.won}-${d.lost}`+(d.draw?`-${d.draw}`:""),sub:d.draw?"ชนะ-แพ้-เสมอ":"ชนะ-แพ้",lines:l,emoji:"⚔️",hideName:!!W.hideNames});
    }
    if(m.given+m.recv+m.hearts>0||m.buddies.length){
      const l=[`คุณเชียร์เพื่อน ${m.given} ครั้ง 📣`]; if(m.buddies.length&&!W.hideNames) l.push(`บัดดี้: ${m.buddies.slice(0,3).map(b=>b.name).join(", ")} 🤝`); else if(m.buddies.length) l.push(`มีบัดดี้ ${m.buddies.length} คน · streak คู่สูงสุด ${m.buddyBest} วัน 🤝`);
      if(m.hearts) l.push(`ได้กำลังใจจากอาจารย์ ${m.hearts} ครั้ง 💛`); if(m.nSent) l.push(`สะกิดเพื่อนให้ลุก ${m.nSent} ครั้ง 👉`);
      add("social","social",{kicker:"เพื่อนร่วมทาง",big:m.recv,sub:"ครั้งที่มีคนเชียร์คุณ 💖",lines:l,emoji:"🤝"});
    }
    if(m.p.house){
      const l=[]; if(m.houseCups) l.push(`บ้านคุณได้ถ้วย ${m.houseCups} สัปดาห์ 🏆`); if(m.kingWeeks.length) l.push(`คุณเป็น King of the Week ${m.kingWeeks.length} สัปดาห์ 👑`);
      const th=raw.cohort.topHouse; if(th&&th.house===m.p.house) l.push("🏆 บ้านของคุณคือแชมป์รุ่นนี้"); if(role==="student") l.push(`คุณมีส่วนในชิ้นงานของบ้าน ${m.houseShare}%`);
      add("house","house",{kicker:`บ้าน ${hs.name}`,big:`${hs.emoji}`,bigEmoji:true,sub:hs.name,lines:l});
    }
    const bs=m.badges.map(k=>({k,...badgeMeta(k)}));
    if(bs.length>1){
      const rare=bs.map(b=>({b,pct:Math.round((raw._holders[b.k]||0)/Math.max(1,raw._students)*100)})).sort((a,b)=>a.pct-b.pct)[0];
      add("badge","badge",{kicker:"ป้ายที่คุณปลดล็อก",big:bs.length,sub:`จาก ${(typeof BADGES!=="undefined"?BADGES.length:21)} ป้าย`,lines:rare?[`ป้ายที่หายากที่สุดของคุณ: ${rare.b.e} ${rare.b.n}`,`มีแค่ ${Math.max(1,rare.pct)}% ของรุ่นที่ได้`]:[],viz:{t:"badges",data:bs}});
    }
    if(role==="student") m.records.forEach(r=>{
      const rk=r.rank===1?"#1":`#${r.rank}`, tie=r.same>1?`ร่วมกับอีก ${r.same-1} คน`:null;
      add("rec_"+r.def.k,"rec",{kicker:`🏅 สถิติเด็ดของรุ่น · ${({pvp:"สายนักสู้",time:"สายจังหวะเวลา",boss:"สายบอส/ดวงชะตา",social:"สายสังคม",grit:"สายไม่ยอมแพ้",wacky:"หมวดปั่น ๆ"})[r.cat]}`,big:rk,sub:`${r.def.e} ${r.def.t}`,
        lines:[r.def.fmt?`${r.def.u}: ${r.text}`:`${r.text} ${r.def.u}`,tie].filter(Boolean),emoji:r.def.e,rec:true});
    });
    if(m.style&&role==="student") add("style","style",{kicker:"สไตล์นักสร้างของคุณคือ",big:m.style.e,bigEmoji:true,sub:m.style.n,lines:[m.style.th]});
  }
  const co=raw.cohort; { const l=[`${co.students} คนร่วมเดินทาง`]; if(co.slain) l.push(`ล้มบอสไปทั้งหมด ${co.slain} ตัว`); if(co.duels) l.push(`ดวลกัน ${co.duels} ครั้ง`); if(co.crit10) l.push(`ติดคริ ×10 ไป ${co.crit10} ครั้ง 📖`);
    add("cohort","cohort",{kicker:"รุ่นของเราร่วมกัน",big:co.pieces,sub:"ชิ้นที่ทั้งรุ่นปล่อยออกมา",lines:l,emoji:"🌏"}); }
  add("final","final",{kicker:`สรุป 90 วัน${roleTxt}`,big:m.tier&&role==="student"?`${m.tier.e} ${m.tier.n}`:m.p.name,bigSmall:true,sub:role==="student"&&m.tier?"ระดับของคุณ":"ขอบคุณที่อยู่ด้วยกัน",lines:[],viz:{t:"summary"},final:true});
  return S;
}

/* ---------------------------------------------------------------- Viewer */
const CSS=`#wrapOv{position:fixed;inset:0;z-index:400;background:#04020c;display:flex;align-items:center;justify-content:center;font-family:var(--f-th,"Noto Sans Thai",sans-serif)}
#wrapOv *{box-sizing:border-box}
.wrapStage{--u:min(1vw,.5625vh);position:relative;width:calc(var(--u)*100);height:calc(var(--u)*177.78);max-width:100vw;max-height:100vh;overflow:hidden;color:#fff;user-select:none;-webkit-user-select:none;touch-action:manipulation;background:#111}
.wrapBars{position:absolute;left:calc(var(--u)*3);right:calc(var(--u)*3);top:calc(var(--u)*2.2);display:flex;gap:calc(var(--u)*1);z-index:5}
.wrapBars i{flex:1;height:calc(var(--u)*.9);background:rgba(255,255,255,.28);border-radius:9px;overflow:hidden;position:relative}
.wrapBars i b{position:absolute;inset:0;background:#fff;transform-origin:0 50%;transform:scaleX(0)}
.wrapBars i.done b{transform:scaleX(1)}
.wrapBars i.cur b{animation:wrapFill var(--dur,7s) linear forwards}
.wrapStage.paused .wrapBars i.cur b{animation-play-state:paused}
@keyframes wrapFill{to{transform:scaleX(1)}}
.wrapX{position:absolute;right:calc(var(--u)*3);top:calc(var(--u)*5);z-index:6;background:rgba(0,0,0,.35);border:0;color:#fff;font-size:calc(var(--u)*4.4);width:calc(var(--u)*9);height:calc(var(--u)*9);border-radius:50%;cursor:pointer}
.wrapPrev{position:absolute;left:calc(var(--u)*3);top:calc(var(--u)*5);z-index:6;background:rgba(0,0,0,.35);border:0;color:#fff;font-size:calc(var(--u)*3.4);padding:0 calc(var(--u)*3);height:calc(var(--u)*9);border-radius:99px;cursor:pointer;font-family:inherit}
.wrapSlide{position:absolute;inset:0;padding:calc(var(--u)*17) calc(var(--u)*8) calc(var(--u)*16);display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;gap:calc(var(--u)*3);animation:wrapIn .5s ease both}
@keyframes wrapIn{from{opacity:0;transform:translateY(calc(var(--u)*4)) scale(.97)}to{opacity:1;transform:none}}
.wrapSlide:before{content:"";position:absolute;inset:0;background:radial-gradient(ellipse at 50% 28%,rgba(255,255,255,.22),transparent 55%);pointer-events:none}
.wKick{font-family:var(--f-px,monospace);font-weight:700;font-size:calc(var(--u)*3.6);letter-spacing:.04em;opacity:.92;text-shadow:0 2px 0 rgba(0,0,0,.4);position:relative}
.wBig{font-family:var(--f-px,monospace);font-weight:700;font-size:calc(var(--u)*22);line-height:1.02;text-shadow:0 calc(var(--u)*.9) 0 rgba(0,0,0,.45),0 0 calc(var(--u)*6) rgba(255,255,255,.35);position:relative;word-break:break-word}
.wBig.small{font-size:calc(var(--u)*10.5)} .wBig.emo{font-size:calc(var(--u)*26)}
.wSub{font-family:var(--f-px,monospace);font-size:calc(var(--u)*4.6);font-weight:700;position:relative;text-shadow:0 2px 0 rgba(0,0,0,.4)}
.wLines{display:grid;gap:calc(var(--u)*1.6);font-size:calc(var(--u)*4);line-height:1.45;position:relative;max-width:100%}
.wLines div{background:rgba(0,0,0,.28);padding:calc(var(--u)*1.4) calc(var(--u)*3.4);border-radius:calc(var(--u)*2)}
.wEmoji{font-size:calc(var(--u)*20);filter:drop-shadow(0 0 calc(var(--u)*4) rgba(255,255,255,.6));animation:wrapPop .9s ease both;position:relative}
@keyframes wrapPop{0%{transform:scale(.3) rotate(-14deg);opacity:0}60%{transform:scale(1.15) rotate(4deg);opacity:1}100%{transform:none}}
.wRec .wBig{color:#fff3a8}.wRec .wSub{background:rgba(0,0,0,.35);padding:calc(var(--u)*1.4) calc(var(--u)*3);border-radius:99px}
.wRec{border:calc(var(--u)*1.2) solid #ffe27a;box-shadow:inset 0 0 calc(var(--u)*10) rgba(255,226,122,.55)}
.wViz{position:relative;display:flex;justify-content:center;align-items:flex-end}
.wSprite{margin:calc(var(--u)*2) 0} .wSprite .runner{position:relative!important;transform:none!important;width:auto!important} .wSprite svg{width:calc(var(--u)*34)!important;height:auto!important;image-rendering:pixelated}
.wStrip{display:grid;grid-template-columns:repeat(15,1fr);gap:calc(var(--u)*.9);width:calc(var(--u)*80)}
.wStrip i{aspect-ratio:1;border-radius:calc(var(--u)*.6);background:rgba(255,255,255,.14)} .wStrip i.on{background:#fff;box-shadow:0 0 calc(var(--u)*2) #fff} .wStrip i.on2{background:#ffe27a} .wStrip i.on3{background:#ff9a1f}
.wHours{display:flex;align-items:flex-end;gap:calc(var(--u)*.8);height:calc(var(--u)*22);width:calc(var(--u)*80)} .wHours i{flex:1;background:rgba(255,255,255,.3);border-radius:calc(var(--u)*.6) calc(var(--u)*.6) 0 0;min-height:calc(var(--u)*.8)} .wHours i.top{background:#fff}
.wWeeks{display:flex;align-items:flex-end;gap:calc(var(--u)*1.6);height:calc(var(--u)*24);width:calc(var(--u)*80);justify-content:center} .wWeeks div{flex:1;display:flex;align-items:flex-end;gap:calc(var(--u)*.4);height:100%} .wWeeks i{flex:1;border-radius:calc(var(--u)*.6) calc(var(--u)*.6) 0 0;background:rgba(255,255,255,.3)} .wWeeks i.d{background:#fff} .wWeeks i.d.hit{background:#7dffa0}
.wBadges{display:grid;grid-template-columns:repeat(6,1fr);gap:calc(var(--u)*2);width:calc(var(--u)*80);font-size:calc(var(--u)*7.4)}
.wSum{display:grid;grid-template-columns:1fr 1fr;gap:calc(var(--u)*2);width:calc(var(--u)*82)} .wSum div{background:rgba(0,0,0,.32);border-radius:calc(var(--u)*2);padding:calc(var(--u)*2);font-size:calc(var(--u)*3.2)} .wSum b{display:block;font-family:var(--f-px,monospace);font-size:calc(var(--u)*7.4)}
.wBtns{position:absolute;left:0;right:0;bottom:calc(var(--u)*5);display:flex;gap:calc(var(--u)*2);justify-content:center;z-index:6}
.wBtns button{font-family:var(--f-px,monospace);font-weight:700;font-size:calc(var(--u)*3.4);padding:calc(var(--u)*2.2) calc(var(--u)*5);border:0;border-radius:99px;cursor:pointer;background:#fff;color:#1a0f4a}
.wBtns button.g{background:#ffd76b;color:#3a2400}
.wPrev{position:absolute;left:calc(var(--u)*2);bottom:calc(var(--u)*13);z-index:7;font-size:calc(var(--u)*2.8);background:rgba(0,0,0,.55);padding:calc(var(--u)*1.4) calc(var(--u)*2.4);border-radius:calc(var(--u)*1.6);display:flex;gap:calc(var(--u)*1.4);align-items:center;max-width:calc(var(--u)*96)}
.wPrev select{font-size:calc(var(--u)*2.8);max-width:calc(var(--u)*52);background:#1c1440;color:#fff;border:1px solid #6a5cff;border-radius:6px}
@media (prefers-reduced-motion:reduce){.wrapSlide,.wEmoji{animation:none}.wrapBars i.cur b{animation-duration:0s}}`;
let ST=null;
function injectCss(){ if(document.getElementById("wrapCss")) return; const s=document.createElement("style"); s.id="wrapCss"; s.textContent=CSS; document.head.appendChild(s); }
function esc(t){ return String(t==null?"":t).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function vizHTML(sl,W){
  const m=W.m, v=sl.viz; if(!v) return "";
  if(v.t==="sprite"){ const r=(typeof S!=="undefined"?S.runners:[]).find(x=>x.id===m.id); if(r&&typeof runnerBox==="function") return `<div class="wViz wSprite">${runnerBox(avOf(r),6,"normal")}</div>`; return `<div class="wEmoji">🧑‍🚀</div>`; }
  if(v.t==="strip"){ const t=W.raw.today, cells=[]; for(let d=1; d<=90; d++){ const n=m.days[d]||0; cells.push(`<i class="${d>t?"":n>=3?"on3":n===2?"on2":n?"on":""}"></i>`); } return `<div class="wViz"><div class="wStrip">${cells.join("")}</div></div>`; }
  if(v.t==="hours"){ const mx=Math.max(1,...m.hours); return `<div class="wViz"><div class="wHours">${m.hours.map((h,i)=>`<i class="${i===m.topHour?"top":""}" style="height:${Math.max(4,h/mx*100)}%"></i>`).join("")}</div></div>`; }
  if(v.t==="weeks"){ const mx=Math.max(1,...m.wk.map(x=>Math.max(x.t,x.done))); return `<div class="wViz"><div class="wWeeks">${m.wk.map(x=>`<div><i style="height:${x.t/mx*100}%"></i><i class="d ${x.hit?"hit":""}" style="height:${Math.max(3,x.done/mx*100)}%"></i></div>`).join("")}</div></div>`; }
  if(v.t==="badges") return `<div class="wViz"><div class="wBadges">${v.data.slice(0,18).map(b=>`<span title="${esc(b.n)}">${b.e}</span>`).join("")}</div></div>`;
  if(v.t==="summary"){ const tcs=[["ชิ้นรวม",m.n],["วันที่ส่ง",m.activeDays],["streak สูงสุด",m.longestStreak],["ครบเป้า",m.weeksTotal?`${m.weeksHit}/${m.weeksTotal}`:"—"]];
    return `<div class="wViz" style="flex-direction:column;gap:calc(var(--u)*3);align-items:center"><div class="wSum">${tcs.map(([l,x])=>`<div><b>${x}</b>${l}</div>`).join("")}</div><div class="wBadges" style="grid-template-columns:repeat(8,1fr);font-size:calc(var(--u)*5.6)">${m.badges.slice(0,16).map(k=>`<span>${badgeMeta(k).e}</span>`).join("")}</div>${m.style?`<div class="wSub">${m.style.e} ${m.style.n}</div>`:""}${m.records.length?`<div class="wLines"><div>${m.records.map(r=>r.def.e+" "+r.def.t.split(" (")[0]+" #"+r.rank).join(" · ")}</div></div>`:""}</div>`; }
  return "";
}
function slideHTML(sl,W){
  const c=sl.c, bg=`background:radial-gradient(ellipse at 50% 20%,${c[0]},${c[1]} 75%)`;
  return `<div class="wrapSlide ${sl.rec?"wRec":""}" style="${bg}">
    <div class="wKick">${esc(sl.kicker||"")}</div>
    ${sl.emoji&&!sl.bigEmoji?`<div class="wEmoji">${sl.emoji}</div>`:""}
    ${sl.viz&&sl.viz.t==="sprite"?vizHTML(sl,W):""}
    <div class="wBig ${sl.bigSmall?"small":""} ${sl.bigEmoji?"emo":""}" data-count="${typeof sl.big==="number"?sl.big:""}">${esc(sl.big)}</div>
    ${sl.sub?`<div class="wSub">${esc(sl.sub)}</div>`:""}
    ${sl.viz&&sl.viz.t!=="sprite"?vizHTML(sl,W):""}
    ${sl.lines&&sl.lines.length?`<div class="wLines">${sl.lines.map(l=>`<div>${esc(l)}</div>`).join("")}</div>`:""}
  </div>`;
}
function countUp(el){ const to=+el.dataset.count; if(!to||to<10||matchMedia("(prefers-reduced-motion:reduce)").matches) return; const t0=performance.now(), dur=900; const f=t=>{ const k=Math.min(1,(t-t0)/dur), e=1-Math.pow(1-k,3); el.textContent=Math.round(to*e).toLocaleString("en-US"); if(k<1&&ST&&el.isConnected) requestAnimationFrame(f); else el.textContent=to; }; requestAnimationFrame(f); }
function show(i){
  if(!ST) return; ST.i=Math.max(0,Math.min(ST.slides.length-1,i)); const stage=ST.stage, sl=ST.slides[ST.i];
  stage.querySelectorAll(".wrapSlide").forEach(e=>e.remove()); stage.insertAdjacentHTML("afterbegin",slideHTML(sl,ST.W));
  stage.querySelectorAll(".wBig[data-count]").forEach(countUp);
  const bars=stage.querySelectorAll(".wrapBars i"); bars.forEach((b,k)=>{ b.className=k<ST.i?"done":k===ST.i?"cur":""; const cur=b.querySelector("b"); if(k===ST.i){ cur.style.animation="none"; void cur.offsetWidth; cur.style.animation=""; } });
  stage.style.setProperty("--dur",(sl.final?3600:7)+"s"); clearTimeout(ST.timer); ST.timer=null;
  if(!sl.final) ST.timer=setTimeout(()=>{ if(!ST.hold) show(ST.i+1); },7000);
  stage.querySelector(".wBtns").innerHTML=`<button class="g" data-w="share">📸 แชร์สไลด์นี้</button>`+(sl.final?`<button data-w="shareAll">💾 เซฟการ์ดสรุป</button>`:"");
}
function open(who){
  injectCss(); const W=ST&&ST.all?ST.all:null;
  return ensureAll().then(all=>{
    const ppl=all.M.slice().sort((a,b)=>b.n-a.n); let m=all.P[who]||ppl.find(x=>x.p.name===who);
    if(!m){ const me=(typeof meId==="function")?meId():null; m=(me&&all.P[me]&&all.P[me].n>0)?all.P[me]:ppl.find(x=>x.p.role==="student"&&x.records.length>=2)||ppl[0]; }
    mount(all,m);
  });
}
let ALL=null;
function ensureAll(){ if(ALL) return Promise.resolve(ALL);
  if(typeof DB==="undefined") return Promise.reject(new Error("no DB"));
  if(DB.mode==="demo") return DB.fetchAll().then(d=>{ ALL=build(rawFromDemo(d)); return ALL; });
  return Promise.reject(new Error("Wrapped ของจริงยังไม่เปิด"));
}
function mount(all,m){
  close(); const ov=document.createElement("div"); ov.id="wrapOv";
  ov.innerHTML=`<div class="wrapStage"><div class="wrapBars"></div><button class="wrapPrev" data-w="prev">‹ ย้อน</button><button class="wrapX" data-w="close" aria-label="ปิด">✕</button><div class="wBtns"></div></div>`;
  document.body.appendChild(ov);
  const W={m,P:all.P,raw:all.raw,hideNames:false}; const sl=slides(W); ST={W,slides:sl,i:0,stage:ov.querySelector(".wrapStage"),all,timer:null,hold:false};
  ST.stage.querySelector(".wrapBars").innerHTML=sl.map(()=>`<i><b></b></i>`).join("");
  if(all.raw.preview){ const sel=all.M.slice().sort((a,b)=>b.n-a.n).map(x=>`<option value="${esc(x.id)}" ${x.id===m.id?"selected":""}>${esc(x.p.name)} · ${x.p.role==="student"?"นักเรียน":x.p.role==="ta"?"TA":"โค้ช"} · ${x.n} ชิ้น · สถิติเด็ด ${x.records.length}</option>`).join("");
    ST.stage.insertAdjacentHTML("beforeend",`<div class="wPrev">👁 พรีวิว${all.raw.synthetic?" (ข้อมูลตัวอย่าง)":""} ดูในมุมของ <select data-w="who">${sel}</select></div>`); }
  ov.addEventListener("pointerdown",e=>{ if(e.target.closest("button,select")) return; ST.down=Date.now(); ST.x=e.clientX; ST.hold=false; ST.holdT=setTimeout(()=>{ ST.hold=true; ST.stage.classList.add("paused"); },220); });
  ov.addEventListener("pointerup",e=>{ if(!ST) return; clearTimeout(ST.holdT); const held=ST.hold; ST.hold=false; ST.stage.classList.remove("paused"); if(e.target.closest("button,select")) return; if(held){ show(ST.i); return; }
    const r=ST.stage.getBoundingClientRect(); (e.clientX-r.left)<r.width*0.3 ? show(ST.i-1) : (ST.i<ST.slides.length-1?show(ST.i+1):null); });
  ov.addEventListener("click",e=>{ const b=e.target.closest("[data-w]"); if(!b) return; const a=b.dataset.w; if(a==="close") close(); else if(a==="prev") show(ST.i-1); else if(a==="share") shareSlide(false); else if(a==="shareAll") shareSlide(true); });
  ov.addEventListener("change",e=>{ if(e.target.dataset&&e.target.dataset.w==="who"){ const mm=all.P[e.target.value]; if(mm) mount(all,mm); } });
  document.addEventListener("keydown",keys); show(0);
}
function keys(e){ if(!ST) return; if(e.key==="Escape") close(); else if(e.key==="ArrowRight"||e.key===" ") show(ST.i+1); else if(e.key==="ArrowLeft") show(ST.i-1); }
function close(){ const o=document.getElementById("wrapOv"); if(o) o.remove(); if(ST&&ST.timer) clearTimeout(ST.timer); ST=null; document.removeEventListener("keydown",keys); }

/* ---------------------------------------------------------------- การ์ดแชร์รูป (canvas) */
function wrapText(ctx,text,x,y,maxW,lh){ const words=String(text).split(/(\s+)/); let line="",yy=y; words.forEach(w=>{ const t=line+w; if(ctx.measureText(t).width>maxW&&line){ ctx.fillText(line.trim(),x,yy); line=w.trimStart(); yy+=lh; } else line=t; }); if(line.trim()) ctx.fillText(line.trim(),x,yy); return yy+lh; }
function drawCard(sl,W,all){
  const cv=document.createElement("canvas"), fin=!!all, Wd=1080, Hd=fin?1350:1920; cv.width=Wd; cv.height=Hd; const ctx=cv.getContext("2d"), c=sl.c, m=W.m;
  const g=ctx.createRadialGradient(Wd/2,Hd*0.2,40,Wd/2,Hd*0.45,Hd*0.9); g.addColorStop(0,c[0]); g.addColorStop(1,c[1]); ctx.fillStyle=g; ctx.fillRect(0,0,Wd,Hd);
  ctx.fillStyle="rgba(255,255,255,.07)"; for(let y=0;y<Hd;y+=24) ctx.fillRect(0,y,Wd,2);
  ctx.textAlign="center"; ctx.textBaseline="alphabetic"; ctx.shadowColor="rgba(0,0,0,.45)"; ctx.shadowBlur=0;
  const PX="'PxSeven','Pixelify Sans',monospace", TH="'Noto Sans Thai','Sarabun',sans-serif";
  let y=fin?120:230; ctx.fillStyle="#fff"; ctx.font=`700 46px ${PX}`; ctx.fillText(sl.kicker||"",Wd/2,y); y+=fin?60:110;
  if(sl.viz&&sl.viz.t==="sprite"&&typeof drawSpriteCanvas==="function"){ const r=(typeof S!=="undefined"?S.runners:[]).find(x=>x.id===m.id); if(r){ drawSpriteCanvas(ctx,Wd/2-8*16,y,16,avOf(r),"normal"); y+=16*26+20; } }
  else if(sl.emoji&&!sl.bigEmoji){ const es=sl.rec?190:230; ctx.font=es+"px sans-serif"; ctx.fillText(sl.emoji,Wd/2,y+es*0.9); y+=es*1.15; }
  const big=String(sl.big); ctx.fillStyle=sl.rec?"#fff3a8":"#fff"; ctx.shadowColor="rgba(0,0,0,.55)"; ctx.shadowOffsetY=8;
  const bs=sl.bigEmoji?260:sl.bigSmall?(big.length>10?96:130):big.length>5?190:260; ctx.font=`700 ${bs}px ${PX}`; ctx.fillText(big,Wd/2,y+bs*0.82); ctx.shadowOffsetY=0; y+=bs*1.02+34;
  if(sl.sub){ ctx.fillStyle="#fff"; let fs2=54; ctx.font=`700 ${fs2}px ${PX}`; while(ctx.measureText(sl.sub).width>Wd-140&&fs2>36){ fs2-=2; ctx.font=`700 ${fs2}px ${PX}`; } y=wrapText(ctx,sl.sub,Wd/2,y+fs2*0.7,Wd-140,fs2*1.3)+14; }
  if(sl.viz&&sl.viz.t==="strip"){ const t=W.raw.today, cell=52, gap=8, cols=15, x0=(Wd-(cols*cell+(cols-1)*gap))/2; for(let d=1; d<=90; d++){ const n=m.days[d]||0, cx=x0+((d-1)%cols)*(cell+gap), cy=y+Math.floor((d-1)/cols)*(cell+gap); ctx.fillStyle=d>t?"rgba(255,255,255,.12)":n>=3?"#ff9a1f":n===2?"#ffe27a":n?"#ffffff":"rgba(255,255,255,.16)"; ctx.fillRect(cx,cy,cell,cell); } y+=6*(cell+gap)+30; }
  if(sl.viz&&sl.viz.t==="hours"){ const mx=Math.max(1,...m.hours), bw=34, gap=8, x0=(Wd-(24*bw+23*gap))/2; m.hours.forEach((h,i)=>{ const hh=Math.max(8,h/mx*220); ctx.fillStyle=i===m.topHour?"#fff":"rgba(255,255,255,.4)"; ctx.fillRect(x0+i*(bw+gap),y+220-hh,bw,hh); }); y+=260; }
  if(sl.viz&&sl.viz.t==="badges"){ ctx.font="86px sans-serif"; sl.viz.data.slice(0,18).forEach((b,i)=>{ ctx.fillText(b.e,150+(i%6)*156,y+90+Math.floor(i/6)*120); }); y+=380; }
  if(sl.viz&&sl.viz.t==="summary"){ const cells=[["ชิ้นรวม",m.n],["วันที่ส่ง",m.activeDays],["streak สูงสุด",m.longestStreak],["ครบเป้า",m.weeksTotal?`${m.weeksHit}/${m.weeksTotal}`:"—"]];
    cells.forEach(([l,v],i)=>{ const bx=90+(i%2)*450, by=y+Math.floor(i/2)*150; ctx.fillStyle="rgba(0,0,0,.32)"; ctx.fillRect(bx,by,420,130); ctx.fillStyle="#fff"; ctx.font=`700 64px ${PX}`; ctx.fillText(String(v),bx+210,by+68); ctx.font=`30px ${TH}`; ctx.fillText(l,bx+210,by+112); }); y+=330;
    ctx.font="70px sans-serif"; m.badges.slice(0,10).forEach((k,i)=>ctx.fillText(badgeMeta(k).e,150+i*86,y)); y+=40; if(m.style){ ctx.font=`700 46px ${PX}`; ctx.fillText(`${m.style.e} ${m.style.n}`,Wd/2,y+50); y+=90; } }
  (sl.lines||[]).forEach(l=>{ let f=40; ctx.font=`${f}px ${TH}`; while(ctx.measureText(l).width>Wd-190&&f>26){ f-=2; ctx.font=`${f}px ${TH}`; } ctx.fillStyle="rgba(0,0,0,.3)"; const w=Math.min(Wd-100,ctx.measureText(l).width+70); ctx.fillRect((Wd-w)/2,y-44,w,70); ctx.fillStyle="#fff"; ctx.fillText(l,Wd/2,y+4); y+=84; });
  ctx.shadowBlur=0; ctx.fillStyle="rgba(255,255,255,.85)"; ctx.font=`700 28px ${PX}`; ctx.fillText("90 DAY ONE PERSON BUSINESS BOOTCAMP · WRAPPED",Wd/2,Hd-70); ctx.font=`26px ${TH}`; ctx.fillText(`${m.p.name} · By Benz Arnun`,Wd/2,Hd-30);
  return cv;
}
async function shareSlide(all){
  if(!ST) return; const sl=all?ST.slides[ST.slides.length-1]:ST.slides[ST.i], cv=drawCard(sl,ST.W,all?true:null);
  const blob=await new Promise(r=>cv.toBlob(r,"image/png")), name=`wrapped-${ST.W.m.p.name}-${sl.id}.png`;
  try{ const f=new File([blob],name,{type:"image/png"}); if(navigator.canShare&&navigator.canShare({files:[f]})){ await navigator.share({files:[f],text:"Wrapped 90 วันของฉัน 🎁"}); return; } }catch(e){ if(e.name==="AbortError") return; }
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),3000);
  if(typeof toast==="function") toast("เซฟรูปแล้ว 💾<br>เอาไปโพสต์ได้เลย");
}

/* ตัวช่วยตรวจ (dev): คืน HTML ของทุกสไลด์ของคนหนึ่ง เอาไปจัดเป็นแผ่นรวมดู */
function _sheet(id){ const all=ALL, m=all.P[id]; const W={m,P:all.P,raw:all.raw,hideNames:false}; return slides(W).map(sl=>({id:sl.id,html:slideHTML(sl,W)})); }
function _card(id,idx){ const all=ALL, m=all.P[id], W={m,P:all.P,raw:all.raw,hideNames:false}, sl=slides(W); const i=idx<0?sl.length-1:idx; return drawCard(sl[i],W,i===sl.length-1?true:null); }
window.WRAP={open,close,build,slides,rawFromDemo,RECS,STYLES,_all:()=>ALL,_sheet,_card};
})();
