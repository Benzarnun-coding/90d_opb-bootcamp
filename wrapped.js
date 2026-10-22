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

const fN = v => (typeof fmtN==="function") ? fmtN(v) : String(v);
const wk = d => (typeof weekOf==="function") ? weekOf(d) : Math.max(1,Math.floor((d-1)/7)+1);

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
  M.forEach(m=>{ const e=Object.entries(m.duel.rivals).sort((a,b)=>b[1]-a[1])[0]; m.duel.rival=e&&P[e[0]]?{name:P[e[0]].p.name,n:e[1]}:null; });
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
 {k:"firstPost",cat:"time",e:"🥇",t:"คนแรกที่ลงมือ",g:m=>m.firstTs?-m.firstTs:null,min:-Infinity,u:"โพสต์แรกของรุ่น",w:9,fmt:(m,L)=>fd(m.firstTs,L)},
 {k:"first30",cat:"time",e:"🏃",t:"ถึง 30 ชิ้นก่อนใคร",g:m=>m.t30?-m.t30:null,min:-Infinity,u:"ถึง 30 ชิ้น",w:8,fmt:(m,L)=>fd(m.t30,L)},
 {k:"first90",cat:"time",e:"🏁",t:"เส้นชัยคนแรก ๆ",g:m=>m.t90?-m.t90:null,min:-Infinity,u:"ถึงเส้นชัย 90 ชิ้น",w:10,fmt:(m,L)=>fd(m.t90,L)},
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
      (out[x.m.id]=out[x.m.id]||[]).push({def, value:x.v, rank:x.rank, same, cat:def.cat, m:x.m, score:(4-x.rank)*100+def.w*10-Math.min(same,9)}); });
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

/* ================================================================ ชั้นแสดงผล: 2 ภาษา (ไทย/English) + ดีไซน์สไตล์ Wrapped ================================================================ */
const DOW={th:["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัสฯ","ศุกร์","เสาร์"], en:["Sunday","Monday","Tuesday","Wednesday","Thursday","Friday","Saturday"]};
function fd(ts,L,long){ if(!ts) return "—"; const d=new Date(ts); return L==="en"?d.toLocaleDateString("en-GB",{day:"numeric",month:long?"long":"short"}):d.toLocaleDateString("th-TH",{day:"numeric",month:long?"long":"short"}); }
const RECS_EN={duelWins:["Duel Champion","duels won"],duelFought:["Duel Addict","duels fought"],challenged:["Most Wanted","times you were challenged"],margin:["Landslide Victory","pieces — your biggest winning margin"],rival:["Arch Rival","duels against the same person"],lostHat:["The Brave Loser","losses — and you never ran away"],
 night:["Night Owl","posts between 10 PM and 4 AM"],earlyBird:["Early Bird","posts before 6 AM"],lastMin:["Beat the Buzzer","posts in the last 10 minutes before the weekly cut"],bestDay:["One-Day Wonder","pieces in a single day"],bestWeek:["Lightning Week","pieces in a single week"],firstPost:["First One In","your first post of the cohort"],first30:["First to 30","you reached 30 pieces"],first90:["First to the Finish","you reached 90 pieces"],
 damage:["Top Damage Dealer","damage dealt to bosses"],firstBlood:["First Blood Hunter","bosses you hit first"],lastHit:["The Closer","bosses you finished off"],critN:["Crit King","critical hits"],x10:["×10 Legend","×10 crits (a free book!)"],luck:["Lucky Charm","% of your posts were crits"],
 cheerleader:["Cohort Cheerleader","cheers you sent"],darling:["Cohort Darling","cheers you received"],nudger:["The Nudger","nudges you sent"],nudged:["Most Chased","nudges you received"],buddy:["Buddy for Life","day buddy streak"],hearts:["Teacher's Pet","Coach's Hearts received"],polyglot:["Platform Hopper","platforms used"],
 streak:["Unstoppable","days in a row"],weeksHit:["On Target","weeks you hit your goal"],holiday:["Holiday Hero","pieces posted during the break"],kudos:["Quality Work","times a TA gave you “good work”"],perfect:["Perfect Weeks","weeks with a post every single day"],
 threeAM:["The 3 AM Club","posts between 2 and 4 AM"],midnight:["Midnight Sharp","posts right at midnight"],lunch:["Lunch Break Poster","posts at noon"],pretty:["Lucky Numbers (12:12, 21:33, 14:44…)","posts at a “pretty” time"],sunday:["No Days Off","posts on Sundays"],monday:["Monday? No Problem","posts on Mondays"],exact:["Spot On","weeks you hit your goal exactly"],over:["Overachiever","× your goal in your biggest week"],coaster:["Rollercoaster","pieces — your wildest week-to-week swing"],triple:["Exactly Three","days with exactly 3 posts"]};
RECS.forEach(r=>{ const x=RECS_EN[r.k]; r.te=x?x[0]:r.t; r.ue=x?x[1]:r.u; });
const CATS={pvp:["สายนักสู้","THE FIGHTER"],time:["จังหวะเวลา","TIMING"],boss:["บอส & ดวงชะตา","BOSSES & LUCK"],social:["สายสังคม","SOCIAL"],grit:["ไม่ยอมแพ้","GRIT"],wacky:["หมวดปั่น ๆ","WACKY"]};
const STYLE_EN={early:"You start creating while the rest of us are still asleep.",night:"Your best ideas arrive after dark.",sprinter:"You go in bursts and leave everyone behind.",marathon:"Not flashy — but you never disappeared.",boss:"You can't see a boss without swinging.",social:"You gave this cohort its heartbeat.",crusher:"You set the goal. You hit the goal.",comeback:"You fell. You got back up. That's the real thing.",explorer:"Just getting started — every piece is learning."};
const STYLE_TH={early:"ตื่นมาสร้างตั้งแต่ฟ้าสาง ใครว่าเช้าไม่ดี",night:"ไอเดียมาตอนดึก มือไวตอนคนอื่นหลับ",sprinter:"พุ่งเป็นช่วง ๆ แล้วทิ้งห่างทุกคน",marathon:"ไม่หวือหวา แต่ไม่เคยหายไปไหน",boss:"เห็นบอสเมื่อไร มือก็ไวเมื่อนั้น",social:"คุณคือคนที่ทำให้รุ่นนี้มีชีวิตชีวา",crusher:"บอกเป้าไว้เท่าไร ทำได้เท่านั้น",comeback:"ล้มแล้วลุกได้ นั่นแหละตัวจริง",explorer:"เพิ่งเริ่มก้าวแรก ทุกชิ้นคือการเรียนรู้"};
const PAL={
 intro:{bg:"#121212",fg:"#ffffff",ac:"#1ed760",s1:"#1ed760",s2:"#7b2ff7"},
 vol:{bg:"#1ed760",fg:"#0a0a0a",ac:"#ffffff",s1:"#7af0a0",s2:"#12b455"},
 path:{bg:"#509bf5",fg:"#08142e",ac:"#ffffff",s1:"#a9d0ff",s2:"#7fb3f5"},
 streak:{bg:"#ff6437",fg:"#1a0800",ac:"#ffffff",s1:"#ffcd3c",s2:"#ff8a5e"},
 rhythm:{bg:"#b49bc8",fg:"#1a0f2a",ac:"#ffffff",s1:"#e3d3f0",s2:"#9a7fb3"},
 goal:{bg:"#ffcd3c",fg:"#1a1200",ac:"#ffffff",s1:"#ffe27a",s2:"#ffb400"},
 boss:{bg:"#e8115b",fg:"#ffffff",ac:"#ffcd3c",s1:"#7a0030",s2:"#ff5c93"},
 pvp:{bg:"#121212",fg:"#ffffff",ac:"#ffcd3c",s1:"#e8115b",s2:"#ffcd3c"},
 social:{bg:"#f037a5",fg:"#1a0013",ac:"#ffffff",s1:"#ff8fd0",s2:"#ff6bbd"},
 house:{bg:"#1e3264",fg:"#ffffff",ac:"#4ce1ff",s1:"#509bf5",s2:"#0d1b3d"},
 badge:{bg:"#af2896",fg:"#ffffff",ac:"#ffcd3c",s1:"#6b0f5a",s2:"#ff6bd6"},
 rec:{bg:"#ffcd3c",fg:"#121212",ac:"#ffffff",s1:"#ffa51f",s2:"#fff2b0"},
 style:{bg:"#7b2ff7",fg:"#ffffff",ac:"#ffcd3c",s1:"#f107a3",s2:"#3a0c8f"},
 cohort:{bg:"#1ed760",fg:"#0a0a0a",ac:"#ffffff",s1:"#509bf5",s2:"#7af0a0"},
 final:{bg:"#121212",fg:"#ffffff",ac:"#1ed760",s1:"#7b2ff7",s2:"#f037a5"}
};
/* รูปทรงพื้นหลัง (หน่วย u = 1% ของความกว้าง): [กว้าง, x, y, สี, มุมโค้ง, หมุน] */
const SHAPES=[
 [[92,48,-14,"s1","50%",0],[50,-22,128,"s2","50%",0],[26,70,120,"ac","22%",18]],
 [[70,-24,-10,"s2","50%",0],[100,36,112,"s1","50%",0],[22,76,28,"ac","50%",0]],
 [[58,56,-16,"ac","26%",16],[90,-34,120,"s1","50%",0],[40,60,128,"s2","50%",0]],
 [[84,30,-34,"s1","50%",0],[34,-10,120,"ac","30%",-14],[64,62,118,"s2","50%",0]]
];
const tr=(L,th,en)=>L==="en"?en:th;

/* ---------------------------------------------------------------- สร้างสไลด์ (โครงเดียวกันทั้งหน้าจอและรูปแชร์) */
function badgeMeta(k){ return (typeof BADGES!=="undefined"?BADGES:[]).find(b=>b.k===k)||{e:"🏅",n:k,th:""}; }
function slides(W,L){
  L=L||"th"; const m=W.m, raw=W.raw, role=m.p.role, hs=(typeof houseOf==="function")?houseOf(m.p.house):{name:"",emoji:"",color:"#fff"}, S=[], T=(a,b)=>tr(L,a,b);
  const add=(id,sec,o)=>S.push(Object.assign({id,sec},o));
  const rl=role==="student"?"":(role==="ta"?" · TA":T(" · หัวหน้าโค้ช"," · HEAD COACH"));
  add("intro","intro",{kick:"WRAPPED"+rl,head:T(`90 วันของ\n${m.p.name}`,`${m.p.name}'s\n90 days`),unit:T(`บ้าน ${hs.name} ${hs.emoji}`,`House ${hs.name} ${hs.emoji}`),lines:[["👉",T("ไปดูกันว่าคุณสร้างอะไรไว้บ้าง","Let's see what you built.")]],viz:{t:"sprite"}});
  if(m.n>0){
    const lines=[["🗓️",T(`ใน ${m.activeDays} วัน จาก 90 วัน`,`across ${m.activeDays} of 90 days`)]];
    if(role==="student"&&m.topPct<=50) lines.push(["🏆",T(`Top ${m.topPct}% ของรุ่น`,`Top ${m.topPct}% of the cohort`)]);
    if(m.n>=90) lines.push(["🏁",T("ถึงเส้นชัย 90 ชิ้นแล้ว!","You crossed the 90-piece finish line!")]);
    if(m.n<30) lines.push(["🌱",T("ทุกชิ้นคือก้าวที่คนส่วนใหญ่ไม่เคยเริ่ม","Every piece is a step most people never take.")]);
    add("vol","vol",{kick:T("ปริมาณ","YOUR OUTPUT"),head:T("คุณปล่อยคอนเทนต์ไป","You published"),big:m.n,unit:T("ชิ้น","pieces"),lines,sticker:"📤"});
    add("path","path",{kick:T("เส้นทาง","YOUR JOURNEY"),head:T("สัปดาห์ที่แรงที่สุดของคุณ","Your biggest week"),big:m.bestWeek.n,unit:T(`ชิ้น · สัปดาห์ที่ ${m.bestWeek.w}`,`pieces · week ${m.bestWeek.w}`),viz:{t:"strip"},
      lines:[["⚡",T(`วันที่ส่งมากสุด: ${m.bestDay.n} ชิ้น (วันที่ ${m.bestDay.d})`,`Biggest day: ${m.bestDay.n} pieces (day ${m.bestDay.d})`)],["🎬",T(`โพสต์แรกเมื่อ ${fd(m.firstTs,L,true)}`,`First post on ${fd(m.firstTs,L,true)}`)]]});
    if(m.longestStreak>=2||m.weeksTotal>0){
      const l=[]; if(m.weeksTotal) l.push(["🎯",T(`ครบเป้า ${m.weeksHit} จาก ${m.weeksTotal} สัปดาห์`,`Hit your goal in ${m.weeksHit} of ${m.weeksTotal} weeks`)]);
      if(m.maxHitRun>=3) l.push(["🔥",T(`ครบเป้าติดกัน ${m.maxHitRun} สัปดาห์`,`${m.maxHitRun} goal weeks in a row`)]); if(m.perfectWeeks) l.push(["📅",T(`ส่งครบทั้ง 7 วัน ${m.perfectWeeks} สัปดาห์`,`${m.perfectWeeks} perfect weeks (a post every day)`)]);
      add("streak","streak",{kick:T("ความสม่ำเสมอ","CONSISTENCY"),head:T("ส่งติดต่อกันนานที่สุด","Your longest streak"),big:m.longestStreak,unit:T("วันติดต่อกัน","days in a row"),lines:l,sticker:"🔥"});
    }
    const l5=[["📆",T(`วัน${DOW.th[m.topDow]}คือวันของคุณ`,`${DOW.en[m.topDow]} is your day`)]]; if(m.topPlat) l5.push(["📲",T(`แพลตฟอร์มโปรด: ${m.topPlat.k} (${Math.round(m.topPlat.n/m.n*100)}%)`,`Favorite platform: ${m.topPlat.k} (${Math.round(m.topPlat.n/m.n*100)}%)`)]);
    add("rhythm","rhythm",{kick:T("จังหวะ","YOUR RHYTHM"),head:T("คุณส่งงานบ่อยที่สุดตอน","You post most around"),big:String(m.topHour).padStart(2,"0")+":00",unit:"",viz:{t:"hours"},lines:l5});
    if(m.weeksTotal>0){
      const l=[]; if(m.promax) l.push(["💚",T(`รับเป้า PRO MAX 14 ชิ้น ${m.promax} สัปดาห์`,`PRO MAX (14 a week) for ${m.promax} weeks`)]); if(m.laser) l.push(["🔴",T(`รับเป้า LASER FOCUS ${m.laser} สัปดาห์`,`LASER FOCUS for ${m.laser} weeks`)]);
      if(m.revived) l.push(["💀",T("ล้มเป็นกระโหลกแล้วลุกกลับมาทำครบ","Went skull, came back and hit the goal")]); if(!l.length) l.push(["✅",T("เลือกเป้าที่ไหวแล้วทำให้ได้ คือสุดยอดแล้ว","Pick what's doable and do it — that's a win.")]);
      add("goal","goal",{kick:T("เป้าหมาย","YOUR GOALS"),head:T("เป้าที่คุณเลือกบ่อยที่สุด","The goal you picked most"),big:m.favTarget,unit:T("ชิ้นต่อสัปดาห์","pieces a week"),viz:{t:"weeks"},lines:l});
    }
    if(m.damage>0){
      const l=[]; if(m.slain) l.push(["🗡️",T(`ร่วมล้มบอส ${m.slain} ตัว`,`Helped slay ${m.slain} bosses`)]); if(m.fb) l.push(["🩸",`FIRST BLOOD ×${m.fb}`]); if(m.lh) l.push(["💥",`LAST HIT ×${m.lh}`]);
      const cr=m.c3+m.c5+m.c10; if(cr) l.push(["🎰",T(`ติดคริติคอล ${cr} ครั้ง (×3: ${m.c3} · ×5: ${m.c5} · ×10: ${m.c10})`,`${cr} critical hits (×3: ${m.c3} · ×5: ${m.c5} · ×10: ${m.c10})`)]);
      add("boss","boss",{kick:T("สนามบอส","BOSS ARENA"),head:T("ดาเมจที่คุณใส่บอส","Damage you dealt"),big:m.damage,unit:T("ดาเมจ","damage"),lines:l,sticker:"🗡️"});
    }
    if(m.duel.fought>0){
      const d=m.duel, rv=d.rival, l=[];
      if(rv&&rv.n>=2) l.push(["🦊",T(`คู่ปรับตลอดกาล: ${rv.name} (${rv.n} ครั้ง)`,`Arch rival: ${rv.name} (${rv.n} duels)`)]); if(d.margin>0) l.push(["💥",T(`ชนะห่างสุด ${d.margin} ชิ้น`,`Biggest win: by ${d.margin} pieces`)]); l.push(["⚔️",T(`ลงดวลทั้งหมด ${d.fought} ครั้ง`,`${d.fought} duels in total`)]);
      add("pvp","pvp",{kick:T("สังเวียนดวล","THE ARENA"),head:T("สถิติดวลของคุณ","Your duel record"),big:`${d.won}-${d.lost}`+(d.draw?`-${d.draw}`:""),unit:T(d.draw?"ชนะ – แพ้ – เสมอ":"ชนะ – แพ้",d.draw?"wins – losses – draws":"wins – losses"),lines:l,sticker:"⚔️"});
    }
    if(m.given+m.recv+m.hearts>0||m.buddies.length){
      const l=[["📣",T(`คุณเชียร์เพื่อน ${m.given} ครั้ง`,`You cheered friends ${m.given} times`)]]; if(m.buddies.length) l.push(["🤝",T(`บัดดี้: ${m.buddies.slice(0,3).map(b=>b.name).join(", ")}`,`Buddies: ${m.buddies.slice(0,3).map(b=>b.name).join(", ")}`)]);
      if(m.hearts) l.push(["💛",T(`ได้กำลังใจจากอาจารย์ ${m.hearts} ครั้ง`,`${m.hearts} Coach's Hearts received`)]); if(m.nSent) l.push(["👉",T(`สะกิดเพื่อนให้ลุก ${m.nSent} ครั้ง`,`You nudged friends ${m.nSent} times`)]);
      add("social","social",{kick:T("เพื่อนร่วมทาง","YOUR PEOPLE"),head:T("มีคนเชียร์คุณ","People cheered for you"),big:m.recv,unit:T("ครั้ง","times"),lines:l,sticker:"💖"});
    }
    if(m.p.house){
      const l=[]; if(m.houseCups) l.push(["🏆",T(`บ้านคุณได้ถ้วย ${m.houseCups} สัปดาห์`,`Your house won the cup ${m.houseCups} times`)]); if(m.kingWeeks.length) l.push(["👑",T(`คุณเป็น King of the Week ${m.kingWeeks.length} สัปดาห์`,`King of the Week × ${m.kingWeeks.length}`)]);
      const th=raw.cohort.topHouse; if(th&&th.house===m.p.house) l.push(["🥇",T("บ้านของคุณคือแชมป์รุ่นนี้","Your house is the cohort champion")]);
      add("house","house",{kick:T(`บ้าน ${hs.name}`,`HOUSE ${hs.name}`),head:role==="student"?T("ส่วนที่คุณมีในบ้าน","Your share of the house"):T("บ้านของคุณ","Your house"),big:role==="student"?`${m.houseShare}%`:hs.emoji,unit:role==="student"?T("ของชิ้นงานทั้งบ้านมาจากคุณ","of the house's output came from you"):hs.name,lines:l,sticker:hs.emoji});
    }
    const bs=m.badges.map(k=>({k,...badgeMeta(k)}));
    if(bs.length>1){
      const rare=bs.map(b=>({b,pct:Math.round((raw._holders[b.k]||0)/Math.max(1,raw._students)*100)})).sort((a,b)=>a.pct-b.pct)[0];
      add("badge","badge",{kick:T("ป้ายรางวัล","YOUR BADGES"),head:T("ป้ายที่คุณปลดล็อก","Badges unlocked"),big:bs.length,unit:T(`จาก ${(typeof BADGES!=="undefined"?BADGES.length:21)} ป้าย`,`of ${(typeof BADGES!=="undefined"?BADGES.length:21)}`),viz:{t:"badges",data:bs},
        lines:rare?[["💎",T(`หายากที่สุดของคุณ: ${rare.b.n}`,`Your rarest: ${rare.b.n}`)],["📊",T(`มีแค่ ${Math.max(1,rare.pct)}% ของรุ่นที่ได้`,`Only ${Math.max(1,rare.pct)}% of the cohort has it`)]]:[]});
    }
    if(role==="student") m.records.forEach(r=>{
      const tie=r.same>1?T(`ร่วมกับอีก ${r.same-1} คน`,`shared with ${r.same-1} other${r.same-1>1?"s":""}`):null, title=L==="en"?r.def.te:r.def.t, val=r.def.fmt?r.def.fmt(r.m,L):fN(Math.abs(r.value)), unit=L==="en"?r.def.ue:r.def.u;
      add("rec_"+r.def.k,"rec",{kick:T(`สถิติเด็ดของรุ่น · ${CATS[r.cat][0]}`,`COHORT RECORD · ${CATS[r.cat][1]}`),head:T("คุณคือ","You are"),big:"#"+r.rank,unit:title,sticker:r.def.e,rec:true,
        lines:[[r.def.e,r.def.fmt?`${unit}: ${val}`:`${val} ${unit}`]].concat(tie?[["🤝",tie]]:[])});
    });
    if(m.style&&role==="student") add("style","style",{kick:T("สไตล์ของคุณ","YOUR STYLE"),head:T("คุณคือสาย","You are a"),big:m.style.e,bigEmoji:true,unit:m.style.n,lines:[["✨",(L==="en"?STYLE_EN:STYLE_TH)[m.style.k]||m.style.th]]});
  }
  const co=raw.cohort, lc=[["👥",T(`${co.students} คนร่วมเดินทาง`,`${co.students} people on the journey`)]]; if(co.slain) lc.push(["🗡️",T(`ล้มบอสไปทั้งหมด ${co.slain} ตัว`,`${co.slain} bosses slain`)]); if(co.duels) lc.push(["⚔️",T(`ดวลกัน ${co.duels} ครั้ง`,`${co.duels} duels fought`)]); if(co.crit10) lc.push(["📖",T(`ติดคริ ×10 ไป ${co.crit10} ครั้ง`,`${co.crit10} ×10 crits landed`)]);
  add("cohort","cohort",{kick:T("ทั้งรุ่น","THE COHORT"),head:T("ทั้งรุ่นร่วมกันปล่อย","Together we published"),big:co.pieces,unit:T("ชิ้น","pieces"),lines:lc,sticker:"🌏"});
  add("final","final",{kick:T("สรุป 90 วัน","YOUR 90 DAYS")+rl,head:m.p.name,big:m.tier&&role==="student"?`${m.tier.e} ${m.tier.n}`:"",unit:role==="student"&&m.tier?T("ระดับของคุณ","your tier"):"",lines:[["💚",T("ขอบคุณที่ร่วมเดินทางด้วยกัน 90 วัน","Thanks for the 90 days together.")]],viz:{t:"summary"},final:true});
  return S;
}

/* ---------------------------------------------------------------- Viewer (สไตล์สตอรี่ เต็มจอแนวตั้ง) */
const CSS=`#wrapOv{position:fixed;inset:0;z-index:400;background:#000;display:flex;align-items:center;justify-content:center}
#wrapOv *{box-sizing:border-box}
.wrapStage{--u:min(1vw,.5625vh);position:relative;width:calc(var(--u)*100);height:calc(var(--u)*177.78);max-width:100vw;max-height:100vh;overflow:hidden;color:#fff;user-select:none;-webkit-user-select:none;touch-action:manipulation;background:#121212;font-weight:500;font-family:"Prompt","IBM Plex Sans Thai",system-ui,sans-serif}
.wrapBars{position:absolute;left:calc(var(--u)*4);right:calc(var(--u)*4);top:calc(var(--u)*3);display:flex;gap:calc(var(--u)*1.1);z-index:8}
.wrapBars i{flex:1;height:calc(var(--u)*1);background:rgba(255,255,255,.35);border-radius:9px;overflow:hidden;position:relative;mix-blend-mode:normal}
.wrapBars i b{position:absolute;inset:0;background:#fff;transform-origin:0 50%;transform:scaleX(0)}
.wrapBars i.done b{transform:scaleX(1)}
.wrapBars i.cur b{animation:wrapFill var(--dur,7s) linear forwards}
.wrapStage.paused .wrapBars i.cur b{animation-play-state:paused}
@keyframes wrapFill{to{transform:scaleX(1)}}
.wCtl{position:absolute;top:calc(var(--u)*6.4);left:calc(var(--u)*4);right:calc(var(--u)*4);display:flex;justify-content:space-between;align-items:center;z-index:9}
.wCtl button,.wLang{border:0;cursor:pointer;color:#fff;background:rgba(0,0,0,.4);backdrop-filter:blur(6px);font-family:inherit;font-weight:700;border-radius:99px;height:calc(var(--u)*8);font-size:calc(var(--u)*3.2);padding:0 calc(var(--u)*3.4)}
.wCtl .x{width:calc(var(--u)*8);padding:0;font-size:calc(var(--u)*3.8)}
.wCtl .r{display:flex;gap:calc(var(--u)*2)}
.wCtl .on{background:#fff;color:#000}
.wrapSlide{position:absolute;inset:0;background:var(--bg);color:var(--fg);overflow:hidden;display:flex;flex-direction:column;justify-content:center;padding:calc(var(--u)*20) calc(var(--u)*8) calc(var(--u)*20);animation:wFade .35s ease both}
@keyframes wFade{from{opacity:0}to{opacity:1}}
.wShapes i{position:absolute;display:block;animation:wDrift 9s ease-in-out infinite alternate}
.wShapes i:nth-child(2){animation-duration:12s;animation-delay:-3s}.wShapes i:nth-child(3){animation-duration:7s;animation-delay:-1s}
@keyframes wDrift{from{transform:translate(0,0) rotate(var(--rot,0deg)) scale(1)}to{transform:translate(calc(var(--u)*-3),calc(var(--u)*4)) rotate(calc(var(--rot,0deg) + 14deg)) scale(1.06)}}
.wRays{position:absolute;left:calc(var(--u)*-30);top:calc(var(--u)*-8);width:calc(var(--u)*160);height:calc(var(--u)*160);border-radius:50%;background:repeating-conic-gradient(from 0deg,rgba(255,255,255,.55) 0 7deg,transparent 7deg 18deg);animation:wSpin 38s linear infinite;opacity:.55;-webkit-mask-image:radial-gradient(circle,#000 0,transparent 62%);mask-image:radial-gradient(circle,#000 0,transparent 62%)}
@keyframes wSpin{to{transform:rotate(360deg)}}
.wSticker{position:absolute;right:calc(var(--u)*6);top:calc(var(--u)*26);font-size:calc(var(--u)*17);transform:rotate(10deg);filter:drop-shadow(0 calc(var(--u)*1) 0 rgba(0,0,0,.25));animation:wPop .8s cubic-bezier(.2,1.5,.4,1) .15s both;z-index:3}
@keyframes wPop{from{transform:scale(.2) rotate(-30deg);opacity:0}to{transform:rotate(10deg)}}
.wInner{position:relative;z-index:4;display:flex;flex-direction:column;gap:calc(var(--u)*3.2);text-align:left}
.wTag{align-self:flex-start;background:var(--fg);color:var(--bg);font-weight:800;font-size:calc(var(--u)*3);letter-spacing:.08em;text-transform:uppercase;padding:calc(var(--u)*1.2) calc(var(--u)*3.2);border-radius:99px;animation:wUp .6s both}
.wHead{margin:0;font-weight:800;font-size:calc(var(--u)*7.6);line-height:1.32;white-space:pre-line;animation:wUp .7s .08s both;word-break:break-word}
.wBigRow{display:flex;flex-direction:column;gap:calc(var(--u)*.6)}
.wBig{font-weight:800;font-size:calc(var(--u)*36);line-height:1.02;letter-spacing:-.02em;animation:wPopBig .8s .18s cubic-bezier(.2,1.4,.4,1) both;word-break:break-word;font-feature-settings:"tnum"}
.wBig.l4{font-size:calc(var(--u)*28)}.wBig.l5{font-size:calc(var(--u)*23)}.wBig.l7{font-size:calc(var(--u)*13.5)}.wBig.emo{font-size:calc(var(--u)*30)}
.wUnit{font-weight:700;font-size:calc(var(--u)*5.6);line-height:1.35;animation:wUp .7s .3s both}
@keyframes wUp{from{opacity:0;transform:translateY(calc(var(--u)*4))}to{opacity:1;transform:none}}
@keyframes wPopBig{from{opacity:0;transform:scale(.6) translateY(calc(var(--u)*3))}to{opacity:1;transform:none}}
.wList{list-style:none;margin:calc(var(--u)*1) 0 0;padding:0;animation:wUp .8s .42s both}
.wList li{display:flex;gap:calc(var(--u)*3);align-items:flex-start;padding:calc(var(--u)*2.1) 0;border-top:calc(var(--u)*.35) solid color-mix(in srgb,var(--fg) 24%,transparent);font-size:calc(var(--u)*4.4);line-height:1.5;font-weight:600}
.wList li b{flex:0 0 calc(var(--u)*6.5);font-weight:400;text-align:center}
.wViz{animation:wUp .8s .3s both}
.wStrip{display:grid;grid-template-columns:repeat(15,1fr);gap:calc(var(--u)*.9);width:100%}
.wStrip i{aspect-ratio:1;border-radius:calc(var(--u)*.7);background:color-mix(in srgb,var(--fg) 16%,transparent)}.wStrip i.on{background:var(--fg);opacity:.55}.wStrip i.on2{background:var(--fg);opacity:.8}.wStrip i.on3{background:var(--fg)}
.wHours{display:flex;align-items:flex-end;gap:calc(var(--u)*.7);height:calc(var(--u)*22);width:100%}.wHours i{flex:1;background:color-mix(in srgb,var(--fg) 32%,transparent);border-radius:calc(var(--u)*.8) calc(var(--u)*.8) 0 0;min-height:calc(var(--u)*.9)}.wHours i.top{background:var(--fg)}
.wWeeks{display:flex;align-items:flex-end;gap:calc(var(--u)*1.8);height:calc(var(--u)*24);width:100%}.wWeeks div{flex:1;display:flex;align-items:flex-end;gap:calc(var(--u)*.5);height:100%}.wWeeks i{flex:1;border-radius:calc(var(--u)*.8) calc(var(--u)*.8) 0 0;background:color-mix(in srgb,var(--fg) 28%,transparent)}.wWeeks i.d{background:var(--fg)}.wWeeks i.d.hit{background:var(--ac);box-shadow:0 0 0 calc(var(--u)*.4) var(--fg)}
.wBadges{display:grid;grid-template-columns:repeat(6,1fr);gap:calc(var(--u)*2);font-size:calc(var(--u)*8);text-align:center}
.wSum{display:grid;grid-template-columns:1fr 1fr;gap:calc(var(--u)*2.2)}.wSum div{background:color-mix(in srgb,var(--fg) 12%,transparent);border-radius:calc(var(--u)*3);padding:calc(var(--u)*2.6) calc(var(--u)*3);font-size:calc(var(--u)*3.4);font-weight:600}.wSum b{display:block;font-weight:800;font-size:calc(var(--u)*9);line-height:1.15}
.wSprite{display:flex;justify-content:flex-start;margin:calc(var(--u)*-2) 0}.wSprite .runner{position:relative!important;transform:none!important;width:auto!important}.wSprite svg{width:calc(var(--u)*36)!important;height:auto!important;image-rendering:pixelated;filter:drop-shadow(0 calc(var(--u)*1.4) 0 rgba(0,0,0,.35))}
.wSlide-final .wHead{font-size:calc(var(--u)*11)}.wSlide-intro .wHead{font-size:calc(var(--u)*12);line-height:1.2}.wSlide-intro .wUnit{font-size:calc(var(--u)*6)}
.wBtns{position:absolute;left:calc(var(--u)*8);right:calc(var(--u)*8);bottom:calc(var(--u)*7);display:flex;gap:calc(var(--u)*2.4);z-index:9}
.wBtns button{flex:1;font-family:inherit;font-weight:800;font-size:calc(var(--u)*3.8);padding:calc(var(--u)*3) calc(var(--u)*2);border:0;border-radius:99px;cursor:pointer;background:#fff;color:#000}
.wBtns button.g{background:#000;color:#fff}
.wLangScr{position:absolute;inset:0;z-index:10;background:#121212;display:flex;flex-direction:column;justify-content:center;gap:calc(var(--u)*5);padding:0 calc(var(--u)*9);overflow:hidden;animation:wFade .4s both}
.wLangScr .t{font-weight:800;font-size:calc(var(--u)*17);line-height:1.02;letter-spacing:-.03em;background:linear-gradient(90deg,#1ed760,#509bf5 45%,#f037a5);-webkit-background-clip:text;background-clip:text;color:transparent;position:relative;z-index:2}
.wLangScr .s{font-size:calc(var(--u)*4.6);font-weight:600;line-height:1.5;opacity:.9;position:relative;z-index:2}
.wLangScr button{position:relative;z-index:2;font-family:inherit;font-weight:800;font-size:calc(var(--u)*7);padding:calc(var(--u)*5) calc(var(--u)*6);border:0;border-radius:calc(var(--u)*5);cursor:pointer;text-align:left;display:flex;justify-content:space-between;align-items:center;color:#000}
.wLangScr button small{font-size:calc(var(--u)*3.4);font-weight:700;opacity:.7}
.wLangScr .th{background:#1ed760}.wLangScr .en{background:#ffcd3c}
.wLangScr .sh i{position:absolute;display:block;border-radius:50%}
.wPrev{position:absolute;left:calc(var(--u)*2);bottom:calc(var(--u)*-0.5);z-index:11;font-size:calc(var(--u)*2.7);background:rgba(0,0,0,.72);padding:calc(var(--u)*1.2) calc(var(--u)*2.2);border-radius:calc(var(--u)*1.6) calc(var(--u)*1.6) 0 0;display:flex;gap:calc(var(--u)*1.4);align-items:center;max-width:calc(var(--u)*96)}
.wPrev select{font-size:calc(var(--u)*2.7);max-width:calc(var(--u)*50);background:#222;color:#fff;border:1px solid #555;border-radius:6px}
@media (prefers-reduced-motion:reduce){.wrapSlide *,.wShapes i,.wRays,.wSticker{animation:none!important}.wrapBars i.cur b{animation-duration:0s}}`;
let ST=null;
function injectCss(){
  if(!document.getElementById("wrapFont")){ const l=document.createElement("link"); l.id="wrapFont"; l.rel="stylesheet"; l.href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;500;600;700;800&display=swap"; document.head.appendChild(l); }
  if(document.getElementById("wrapCss")) return; const s=document.createElement("style"); s.id="wrapCss"; s.textContent=CSS; document.head.appendChild(s);
}
function esc(t){ return String(t==null?"":t).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c])); }
function bigCls(b){ const n=String(b).length; return n<=3?"":n===4?"l4":n===5?"l5":"l7"; }
function vizHTML(sl,W){
  const m=W.m, v=sl.viz; if(!v) return "";
  if(v.t==="sprite"){ const r=(typeof S!=="undefined"?S.runners:[]).find(x=>x.id===m.id); if(r&&typeof runnerBox==="function") return `<div class="wSprite">${runnerBox(avOf(r),6,"normal")}</div>`; return ""; }
  if(v.t==="strip"){ const t=W.raw.today, cells=[]; for(let d=1; d<=90; d++){ const n=m.days[d]||0; cells.push(`<i class="${d>t?"":n>=3?"on3":n===2?"on2":n?"on":""}"></i>`); } return `<div class="wViz"><div class="wStrip">${cells.join("")}</div></div>`; }
  if(v.t==="hours"){ const mx=Math.max(1,...m.hours); return `<div class="wViz"><div class="wHours">${m.hours.map((h,i)=>`<i class="${i===m.topHour?"top":""}" style="height:${Math.max(4,h/mx*100)}%"></i>`).join("")}</div></div>`; }
  if(v.t==="weeks"){ const mx=Math.max(1,...m.wk.map(x=>Math.max(x.t,x.done))); return `<div class="wViz"><div class="wWeeks">${m.wk.map(x=>`<div><i style="height:${x.t/mx*100}%"></i><i class="d ${x.hit?"hit":""}" style="height:${Math.max(3,x.done/mx*100)}%"></i></div>`).join("")}</div></div>`; }
  if(v.t==="badges") return `<div class="wViz"><div class="wBadges">${v.data.slice(0,18).map(b=>`<span>${b.e}</span>`).join("")}</div></div>`;
  if(v.t==="summary"){ const L=W.L, cells=[[tr(L,"ชิ้นรวม","pieces"),m.n],[tr(L,"วันที่ส่ง","active days"),m.activeDays],[tr(L,"streak สูงสุด","best streak"),m.longestStreak],[tr(L,"ครบเป้า","goals hit"),m.weeksTotal?`${m.weeksHit}/${m.weeksTotal}`:"—"]];
    return `<div class="wViz"><div class="wSum">${cells.map(([l,x])=>`<div><b>${x}</b>${l}</div>`).join("")}</div><div class="wBadges" style="grid-template-columns:repeat(8,1fr);font-size:calc(var(--u)*5.6);margin-top:calc(var(--u)*3)">${m.badges.slice(0,16).map(k=>`<span>${badgeMeta(k).e}</span>`).join("")}</div></div>`; }
  return "";
}
function shapesHTML(sl,idx){
  const p=PAL[sl.sec]||PAL.intro, pre=SHAPES[idx%SHAPES.length];
  return (sl.rec?`<div class="wRays"></div>`:"")+`<div class="wShapes">${pre.map(([w,x,y,c,r,rot])=>`<i style="--rot:${rot}deg;width:calc(var(--u)*${w});height:calc(var(--u)*${w});left:calc(var(--u)*${x});top:calc(var(--u)*${y});border-radius:${r};background:${p[c]};opacity:${c==="ac"?.9:1};transform:rotate(${rot}deg)"></i>`).join("")}</div>`;
}
function slideHTML(sl,W,idx){
  const p=PAL[sl.sec]||PAL.intro, vz=vizHTML(sl,W), bigIsSprite=sl.viz&&sl.viz.t==="sprite";
  const big=(sl.big!==undefined&&sl.big!=="")?`<div class="wBig ${sl.bigEmoji?"emo":bigCls(sl.big)}" data-count="${typeof sl.big==="number"?sl.big:""}">${esc(sl.big)}</div>`:"";
  return `<div class="wrapSlide wSlide-${sl.sec}${sl.final?" wSlide-final":""}" style="--bg:${p.bg};--fg:${p.fg};--ac:${p.ac}">
    ${shapesHTML(sl,idx)}${sl.sticker?`<div class="wSticker">${sl.sticker}</div>`:""}
    <div class="wInner">
      <div class="wTag">${esc(sl.kick||"")}</div>
      ${bigIsSprite?vz:""}
      <h2 class="wHead">${esc(sl.head||"")}</h2>
      ${(big||sl.unit)?`<div class="wBigRow">${big}${sl.unit?`<div class="wUnit">${esc(sl.unit)}</div>`:""}</div>`:""}
      ${bigIsSprite?"":vz}
      ${sl.lines&&sl.lines.length?`<ul class="wList">${sl.lines.map(([e,t])=>`<li><b>${e}</b><span>${esc(t)}</span></li>`).join("")}</ul>`:""}
    </div>
  </div>`;
}
function countUp(el){ const to=+el.dataset.count; if(!to||to<10||matchMedia("(prefers-reduced-motion:reduce)").matches) return; const t0=performance.now(), dur=900; const f=t=>{ const k=Math.min(1,(t-t0)/dur), e=1-Math.pow(1-k,3); el.textContent=Math.round(to*e).toLocaleString("en-US"); if(k<1&&ST&&el.isConnected) requestAnimationFrame(f); else el.textContent=to.toLocaleString("en-US"); }; requestAnimationFrame(f); }
function ctlHTML(){ return `<div class="wCtl"><button data-w="prev">‹ ${tr(ST.lang||"th","ย้อน","Back")}</button><div class="r"><button class="wl ${ST.lang==="th"?"on":""}" data-w="lang" data-l="th">TH</button><button class="wl ${ST.lang==="en"?"on":""}" data-w="lang" data-l="en">EN</button><button class="x" data-w="close" aria-label="close">✕</button></div></div>`; }
function langScreen(){
  const dots=[["#1ed760",90,48,-14],["#7b2ff7",52,-22,122],["#f037a5",24,70,112]].map(([c,w,x,y])=>`<i style="background:${c};width:calc(var(--u)*${w});height:calc(var(--u)*${w});left:calc(var(--u)*${x});top:calc(var(--u)*${y});opacity:.95"></i>`).join("");
  return `<div class="wLangScr"><div class="sh">${dots}</div><div class="t">YOUR 90<br>DAYS,<br>WRAPPED.</div><div class="s">เลือกเวอร์ชันที่อยากดู<br>Choose your version</div><button class="th" data-w="pick" data-l="th"><span>ภาษาไทย</span><small>TH</small></button><button class="en" data-w="pick" data-l="en"><span>English</span><small>EN</small></button></div>`;
}
function show(i){
  if(!ST||!ST.lang) return; ST.i=Math.max(0,Math.min(ST.slides.length-1,i)); const stage=ST.stage, sl=ST.slides[ST.i];
  stage.querySelectorAll(".wrapSlide").forEach(e=>e.remove()); stage.insertAdjacentHTML("afterbegin",slideHTML(sl,ST.W,ST.i));
  stage.querySelectorAll(".wBig[data-count]").forEach(countUp);
  const bars=stage.querySelectorAll(".wrapBars i"); bars.forEach((b,k)=>{ b.className=k<ST.i?"done":k===ST.i?"cur":""; const cur=b.querySelector("b"); if(k===ST.i){ cur.style.animation="none"; void cur.offsetWidth; cur.style.animation=""; } });
  stage.style.setProperty("--dur",(sl.final?3600:7)+"s"); clearTimeout(ST.timer); ST.timer=null;
  if(!sl.final) ST.timer=setTimeout(()=>{ if(!ST.hold) show(ST.i+1); },7000);
  stage.querySelector(".wBtns").innerHTML=sl.final?`<button class="g" data-w="share">${tr(ST.lang,"📸 แชร์สไลด์นี้","📸 Share this slide")}</button><button data-w="shareAll">${tr(ST.lang,"💾 เซฟการ์ดสรุป","💾 Save summary card")}</button>`:`<button class="g" data-w="share">${tr(ST.lang,"📸 แชร์สไลด์นี้","📸 Share this slide")}</button>`;
}
function setLang(L,keep){
  ST.lang=L; ST.W.L=L; ST.slides=slides(ST.W,L); const stage=ST.stage; const ls=stage.querySelector(".wLangScr"); if(ls) ls.remove();
  stage.querySelector(".wCtl").outerHTML=ctlHTML(); stage.querySelector(".wrapBars").innerHTML=ST.slides.map(()=>`<i><b></b></i>`).join(""); stage.querySelector(".wrapBars").style.display="";
  show(keep?ST.i:0);
}
/* ---------------------------------------------------------------- ข้อมูลจริง: serialize / อ่านกลับ / ดึงทั้งรุ่น / อัปโหลด */
const KEEP=["id","n","activeDays","days","hours","dow","topHour","topDow","topPlat","platN","bestDay","bestWeek","longestStreak","perfectWeeks","wk","weeksHit","weeksTotal","maxHitRun","revived","laser","promax","favTarget","damage","fb","lh","slain","c3","c5","c10","given","recv","nSent","nRecv","buddies","buddyBest","hearts","houseCups","kingWeeks","houseShare","badges","topPct","firstTs","lastTs","t30","t90","c","score","exact","swing","holiday","views","kudos"];
function serialize(m,all){
  const D={}; KEEP.forEach(k=>{ D[k]=m[k]; });
  D.p={id:m.p.id,name:m.p.name,handle:m.p.handle,role:m.p.role,house:m.p.house,color:m.p.color};
  const d=m.duel; D.duel={fought:d.fought,won:d.won,lost:d.lost,draw:d.draw,done:d.done,challenged:d.challenged,margin:d.margin,rival:d.rival};
  D.style=m.style?{k:m.style.k,e:m.style.e,n:m.style.n,th:m.style.th}:null; D.tier=m.tier;
  D.records=m.records.map(r=>({k:r.def.k,value:r.value,rank:r.rank,same:r.same}));
  D.cohort=all.raw.cohort; D.holders=all.raw._holders; D.students=all.raw._students; D.today=all.raw.today; D.v=1;
  return D;
}
function wFromD(D){
  const m=Object.assign({},D); m.records=(D.records||[]).map(r=>{ const def=RECS.find(x=>x.k===r.k); return def?{def,value:r.value,rank:r.rank,same:r.same,cat:def.cat,m}:null; }).filter(Boolean);
  return {m,P:{},raw:{today:D.today,cohort:D.cohort,_holders:D.holders,_students:D.students},hideNames:false,L:"th"};
}
async function pageAll(make){ let out=[],from=0; for(;;){ const r=await make(from,from+999); if(r.error) throw new Error(r.error.message); const d=r.data||[]; out=out.concat(d); if(d.length<1000) break; from+=1000; } return out; }
async function gatherLive(sb,prog){
  const say=t=>{ if(prog) prog(t); }, tbl=(t,cols,ord)=>pageAll((a,b)=>{ let q=sb.from(t).select(cols); if(ord) q=q.order(ord); return q.range(a,b); });
  say("สถานะรุ่น…"); const cr=await sb.rpc("cohort_status"); if(cr.error) throw new Error(cr.error.message); const cs=Array.isArray(cr.data)?cr.data[0]:cr.data;
  const today=Math.min(90,N(cs.day_index)), vac=new Set(); if(cs.vacation_from_day!=null&&cs.vacation_to_day!=null) for(let d=N(cs.vacation_from_day); d<=N(cs.vacation_to_day); d++) vac.add(d);
  say("รายชื่อ…"); const board=await tbl("v_leaderboard","id,name,handle,color,role,house_id,avatar","id");
  const people=board.map(b=>({id:b.id,name:b.name,handle:b.handle,color:b.color,av:b.avatar||{},house:b.house_id||0,role:b.role==="coach"?(b.house_id?"ta":"head"):"student",pledges:{}})); const byId={}; people.forEach(p=>{ byId[p.id]=p; });
  say("เป้ารายสัปดาห์…"); (await tbl("pledges","profile_id,week_no,target","profile_id")).forEach(x=>{ if(byId[x.profile_id]) byId[x.profile_id].pledges[x.week_no]=x.target; });
  say("งานที่นับ…"); const subs=(await tbl("v_counted","id,profile_id,day_index,created_at,platform","id")).map(x=>({pid:x.profile_id,day:x.day_index,ts:Date.parse(x.created_at),plat:x.platform||"?",note:"",crit:1}));
  say("บอสและคริ…"); const bosses=await tbl("v_boss_progress","*"), bossHits=await tbl("v_boss_hits","*"), crit=(await tbl("v_crit_log","boss_id,profile_id,crit")).map(c=>({pid:c.profile_id,crit:+c.crit,boss:c.boss_id}));
  say("ดวล…"); const duels=(await tbl("v_duels","*")).map(x=>({a:x.challenger,b:x.opponent,status:x.status,winner:x.winner,sa:N(x.challenger_score),sb:N(x.opponent_score)}));
  say("เชียร์/สะกิด…"); const cheers=(await tbl("cheers","from_id,to_id,day_index","id")).map(c=>({from:c.from_id,to:c.to_id,day:c.day_index})), nudges=(await tbl("nudges","from_id,to_id","id")).map(n=>({from:n.from_id,to:n.to_id}));
  say("บัดดี้…"); const bd=await tbl("v_buddies","a,b,best,status"); const buddies=bd.filter(b=>b.status==="active").map(b=>({a:b.a,b:b.b,best:N(b.best)}));
  say("King/ถ้วย…"); const kings=(await tbl("v_week_kings","*")).concat(await tbl("v_week_ta_kings","*")), cups=await tbl("v_house_cup","*"); let houseWeeks=[]; try{ houseWeeks=await tbl("v_house_week","*"); }catch(e){}
  say("กำลังใจ/KUDOS…"); const heartN={}, kudos={}, reach={}; (await tbl("v_coach_heart_counts","profile_id,n")).forEach(x=>{ heartN[x.profile_id]=N(x.n); }); (await tbl("v_kudos","profile_id,n")).forEach(x=>{ kudos[x.profile_id]=N(x.n); }); (await tbl("v_reach","profile_id,total_views")).forEach(x=>{ reach[x.profile_id]=N(x.total_views); });
  return {preview:false,synthetic:false,people,subs,today,curWeek:wk(today),final:today>=90,bosses,bossHits,critLog:crit,duels,cheers,nudges,buddies,kings,cups,houseWeeks,kudos,reach,heartN,vacDays:vac,heartsSent:0};
}
async function buildAndUpload(sb,prog){
  const raw=await gatherLive(sb,prog); if(prog) prog("คำนวณสถิติทั้งรุ่น…"); const all=build(raw);
  const rows=all.M.filter(m=>m.n>0||m.p.role!=="student").map(m=>({pid:m.id,data:serialize(m,all)})); let done=0;
  for(let i=0;i<rows.length;i+=15){ const chunk=rows.slice(i,i+15), r=await sb.rpc("wrapped_put",{rows:chunk}); if(r.error) throw new Error(r.error.message); done+=chunk.length; if(prog) prog("อัปโหลด "+done+"/"+rows.length); }
  return {uploaded:rows.length, people:all.M.length, students:raw.cohort.students, pieces:raw.cohort.pieces, withRecords:all.M.filter(m=>m.records.length).length};
}

/* ---------------------------------------------------------------- เปิดดู */
function open(who){
  injectCss();
  if(typeof DB!=="undefined" && DB.mode==="live") return openLive(who);
  return ensureAll().then(all=>{
    const ppl=all.M.slice().sort((a,b)=>b.n-a.n); let m=all.P[who]||ppl.find(x=>x.p.name===who);
    if(!m){ const me=(typeof meId==="function")?meId():null; m=(me&&all.P[me]&&all.P[me].n>0)?all.P[me]:ppl.find(x=>x.p.role==="student"&&x.records.length>=2)||ppl[0]; }
    const mk=mm=>({m:mm,P:all.P,raw:all.raw,hideNames:false,L:"th"});
    mountW(mk(m),{picker:{cur:m.id,note:"พรีวิว"+(all.raw.synthetic?" (ข้อมูลตัวอย่าง)":""),list:ppl.map(x=>({id:x.id,label:x.p.name+" · "+(x.p.role==="student"?"นักเรียน":x.p.role==="ta"?"TA":"โค้ช")+" · "+x.n+" ชิ้น · สถิติเด็ด "+x.records.length})),load:async id=>mk(all.P[id])}});
  });
}
async function openLive(pid){
  const sb=DB._sb(), head=((await sb.rpc("is_head_coach")).data===true), tst=t=>{ if(typeof toast==="function") toast(t); };
  const getW=async id=>{ const r=(head&&id)?await sb.rpc("wrapped_for",{pid:id}):await sb.rpc("wrapped_me"); if(r.error) throw new Error(r.error.message); const x=r.data||{};
    if(!head&&!x.open) return {closed:true}; if(!x.data) return {empty:true}; return wFromD(x.data); };
  const me=(typeof meId==="function")?meId():null, id0=pid||(head?me:null), W=await getW(id0);
  if(W.closed){ tst("Wrapped ยังไม่เปิด"); return; }
  if(W.empty&&!head){ tst("ยังไม่มีสถิติ Wrapped ของคุณ"); return; }
  const opt={}; if(head){ const rs=(typeof S!=="undefined"?S.runners:[]).slice().sort((a,b)=>N(b.st&&b.st.contents)-N(a.st&&a.st.contents));
    opt.picker={cur:id0,note:"พรีวิวโค้ช",list:rs.map(r=>({id:r.id,label:r.name+" · "+(r.role==="coach"?(r.house?"TA":"โค้ช"):"นักเรียน")+" · "+N(r.st&&r.st.contents)+" ชิ้น"})),
      load:async id=>{ const w=await getW(id); if(w.empty){ tst("คนนี้ไม่มีข้อมูล Wrapped (ไม่เคยส่ง หรือยังไม่ได้กดคำนวณ)"); return null; } return w; }}; }
  if(W.empty) tst("ยังไม่มีข้อมูลของคุณ · เลือกคนอื่นจากรายชื่อ หรือกดคำนวณในหน้า admin ก่อน");
  mountW(W.empty?null:W,opt);
}
let ALL=null;
function ensureAll(){ if(ALL) return Promise.resolve(ALL);
  if(typeof DB==="undefined") return Promise.reject(new Error("no DB"));
  if(DB.mode==="demo") return DB.fetchAll().then(d=>{ ALL=build(rawFromDemo(d)); return ALL; });
  return Promise.reject(new Error("Wrapped ของจริงยังไม่เปิด"));
}
function mountW(W,opt,lang){
  opt=opt||{}; close(); const ov=document.createElement("div"); ov.id="wrapOv";
  ov.innerHTML=`<div class="wrapStage"><div class="wrapBars" style="display:none"></div><div class="wCtl"></div><div class="wBtns"></div></div>`;
  document.body.appendChild(ov);
  ST={W:W||{m:null},slides:[],i:0,lang:null,stage:ov.querySelector(".wrapStage"),timer:null,hold:false,opt};
  if(opt.picker){ const pk=opt.picker, sel=pk.list.map(x=>`<option value="${esc(x.id)}" ${x.id===pk.cur?"selected":""}>${esc(x.label)}</option>`).join("");
    ST.stage.insertAdjacentHTML("beforeend",`<div class="wPrev">👁 ${esc(pk.note||"พรีวิว")} ดูในมุมของ <select data-w="who">${sel}</select></div>`); }
  if(W) ST.stage.insertAdjacentHTML("beforeend",langScreen());
  if(!W) ST.stage.querySelector(".wCtl").innerHTML='<span></span><div class="r"><button class="x" data-w="close" aria-label="close">✕</button></div>';
  ov.addEventListener("pointerdown",e=>{ if(!ST||!ST.lang||e.target.closest("button,select")) return; ST.hold=false; ST.holdT=setTimeout(()=>{ ST.hold=true; ST.stage.classList.add("paused"); },220); });
  ov.addEventListener("pointerup",e=>{ if(!ST||!ST.lang) return; clearTimeout(ST.holdT); const held=ST.hold; ST.hold=false; ST.stage.classList.remove("paused"); if(e.target.closest("button,select")) return; if(held){ show(ST.i); return; }
    const r=ST.stage.getBoundingClientRect(); (e.clientX-r.left)<r.width*0.3 ? show(ST.i-1) : (ST.i<ST.slides.length-1?show(ST.i+1):null); });
  ov.addEventListener("click",e=>{ const b=e.target.closest("[data-w]"); if(!b||!ST) return; const a=b.dataset.w;
    if(a==="close") close(); else if(a==="prev"){ if(ST.lang) show(ST.i-1); } else if(a==="share") shareSlide(false); else if(a==="shareAll") shareSlide(true); else if(a==="pick") setLang(b.dataset.l,false); else if(a==="lang"){ if(ST.lang!==b.dataset.l) setLang(b.dataset.l,true); } });
  ov.addEventListener("change",async e=>{ if(e.target.dataset&&e.target.dataset.w==="who"){ const id=e.target.value, pk=ST.opt.picker, L=ST.lang; let W2=null; try{ W2=await pk.load(id); }catch(er){ if(typeof toast==="function") toast(er.message); }
    if(!W2){ e.target.value=pk.cur; return; } const o2=Object.assign({},ST.opt,{picker:Object.assign({},pk,{cur:id})}); mountW(W2,o2,L); } });
  document.addEventListener("keydown",keys);
  if(W&&lang) setLang(lang,false);
}
function keys(e){ if(!ST) return; if(e.key==="Escape") close(); else if(ST.lang&&(e.key==="ArrowRight"||e.key===" ")) show(ST.i+1); else if(ST.lang&&e.key==="ArrowLeft") show(ST.i-1); }
function close(){ const o=document.getElementById("wrapOv"); if(o) o.remove(); if(ST&&ST.timer) clearTimeout(ST.timer); ST=null; document.removeEventListener("keydown",keys); }

/* ---------------------------------------------------------------- การ์ดแชร์รูป (canvas) — จัดวางแบบเดียวกับหน้าจอ */
const FONT='"Prompt","IBM Plex Sans Thai","Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';
const SEG=(typeof Intl!=="undefined"&&Intl.Segmenter)?new Intl.Segmenter("th",{granularity:"word"}):null;
function toks(t){ return SEG?[...SEG.segment(t)].map(x=>x.segment):String(t).split(/(\s+)/); }
function wrapLines(ctx,text,maxW){ const out=[]; String(text).split("\n").forEach(par=>{ let line=""; toks(par).forEach(w=>{ const t=line+w; if(ctx.measureText(t).width>maxW&&line.trim()){ out.push(line.trim()); line=w.trimStart(); } else line=t; }); out.push(line.trim()); }); return out; }
function dryCtx(real){ return new Proxy({},{ get:(_,p)=>{ if(p==="measureText") return t=>real.measureText(t); const v=real[p]; return typeof v==="function"?(()=>{}):v; }, set:(_,p,v)=>{ if(p==="font"||p==="textAlign"||p==="textBaseline") real[p]=v; return true; } }); }
function rr(c,x,y,w,h,r){ c.beginPath(); c.moveTo(x+r,y); c.lineTo(x+w-r,y); c.quadraticCurveTo(x+w,y,x+w,y+r); c.lineTo(x+w,y+h-r); c.quadraticCurveTo(x+w,y+h,x+w-r,y+h); c.lineTo(x+r,y+h); c.quadraticCurveTo(x,y+h,x,y+h-r); c.lineTo(x,y+r); c.quadraticCurveTo(x,y,x+r,y); c.closePath(); }
function layoutCard(c,sl,W,L,y0,Wd,u,dry){
  const m=W.m, p=PAL[sl.sec]||PAL.intro, padX=8*u, maxW=Wd-2*padX; let y=y0; c.textAlign="left"; c.textBaseline="alphabetic";
  /* tag */
  c.font=`800 ${3*u}px ${FONT}`; const tag=String(sl.kick||"").toUpperCase(), tw=c.measureText(tag).width+6.4*u; if(!dry){ c.fillStyle=p.fg; rr(c,padX,y,tw,5.6*u,2.8*u); c.fill(); c.fillStyle=p.bg; c.fillText(tag,padX+3.2*u,y+3.95*u); } y+=5.6*u+4*u;
  /* sprite */
  if(sl.viz&&sl.viz.t==="sprite"&&typeof drawSpriteCanvas==="function"){ const r=(typeof S!=="undefined"?S.runners:[]).find(x=>x.id===m.id); if(r){ const px=Math.round(2.2*u); if(!dry) drawSpriteCanvas(c,padX-2*u,y,px,avOf(r),"normal"); y+=px*27+2*u; } }
  /* head */
  const hf=7.6*u; c.font=`800 ${hf}px ${FONT}`; wrapLines(c,sl.head||"",maxW).forEach(l=>{ if(!dry){ c.fillStyle=p.fg; c.fillText(l,padX,y+hf*0.95); } y+=hf*1.32; }); y+=2*u;
  /* big */
  if(sl.big!==undefined&&sl.big!==""){ const b=String(sl.big), n=b.length; let bs=(sl.bigEmoji?30:n<=3?36:n===4?28:n===5?23:17)*u; c.font=`800 ${bs}px ${FONT}`; while(c.measureText(b).width>maxW&&bs>6*u){ bs-=u*0.6; c.font=`800 ${bs}px ${FONT}`; } if(!dry){ c.fillStyle=p.fg; c.fillText(b,padX,y+bs*0.86); } y+=bs*1.02; }
  if(sl.unit){ const uf=5.6*u; c.font=`700 ${uf}px ${FONT}`; wrapLines(c,sl.unit,maxW).forEach(l=>{ if(!dry){ c.fillStyle=p.fg; c.fillText(l,padX,y+uf*1.0); } y+=uf*1.35; }); }
  y+=3*u;
  /* viz */
  const v=sl.viz; if(v&&v.t==="strip"){ const cols=15, gap=0.9*u, cell=(maxW-(cols-1)*gap)/cols; for(let d=1; d<=90; d++){ const n=m.days[d]||0, cx=padX+((d-1)%cols)*(cell+gap), cy=y+Math.floor((d-1)/cols)*(cell+gap); if(!dry){ c.globalAlpha=d>W.raw.today?0.16:n>=3?1:n===2?0.8:n?0.55:0.16; c.fillStyle=p.fg; rr(c,cx,cy,cell,cell,0.7*u); c.fill(); c.globalAlpha=1; } } y+=6*(cell+gap)+3*u; }
  if(v&&v.t==="hours"){ const mx=Math.max(1,...m.hours), gap=0.7*u, bw=(maxW-23*gap)/24, hh=22*u; m.hours.forEach((h,i)=>{ const bh=Math.max(0.9*u,h/mx*hh); if(!dry){ c.globalAlpha=i===m.topHour?1:0.32; c.fillStyle=p.fg; c.fillRect(padX+i*(bw+gap),y+hh-bh,bw,bh); c.globalAlpha=1; } }); y+=hh+3*u; }
  if(v&&v.t==="weeks"){ const mx=Math.max(1,...m.wk.map(x=>Math.max(x.t,x.done))), hh=24*u, gw=maxW/Math.max(1,m.wk.length); m.wk.forEach((x,i)=>{ const bw=(gw-1.8*u)/2, x0=padX+i*gw; if(!dry){ c.globalAlpha=0.28; c.fillStyle=p.fg; c.fillRect(x0,y+hh-x.t/mx*hh,bw,x.t/mx*hh); c.globalAlpha=1; c.fillStyle=x.hit?p.ac:p.fg; c.fillRect(x0+bw+0.5*u,y+hh-Math.max(3,x.done/mx*hh),bw,Math.max(3,x.done/mx*hh)); } }); y+=hh+3*u; }
  if(v&&v.t==="badges"){ const bs=v.data.slice(0,18), cw=maxW/6; c.font=`${7*u}px ${FONT}`; c.textAlign="center"; bs.forEach((b,i)=>{ if(!dry) c.fillText(b.e,padX+cw*(i%6)+cw/2,y+7*u+Math.floor(i/6)*10*u); }); c.textAlign="left"; y+=Math.ceil(bs.length/6)*10*u+3*u; }
  if(v&&v.t==="summary"){ const cells=[[tr(L,"ชิ้นรวม","pieces"),m.n],[tr(L,"วันที่ส่ง","active days"),m.activeDays],[tr(L,"streak สูงสุด","best streak"),m.longestStreak],[tr(L,"ครบเป้า","goals hit"),m.weeksTotal?`${m.weeksHit}/${m.weeksTotal}`:"—"]], cw=(maxW-2.2*u)/2, chh=15*u;
    cells.forEach(([l,x],i)=>{ const cx=padX+(i%2)*(cw+2.2*u), cy=y+Math.floor(i/2)*(chh+2.2*u); if(!dry){ c.globalAlpha=0.14; c.fillStyle=p.fg; rr(c,cx,cy,cw,chh,3*u); c.fill(); c.globalAlpha=1; c.fillStyle=p.fg; c.font=`800 ${8*u}px ${FONT}`; c.fillText(String(x),cx+3*u,cy+8.2*u); c.font=`600 ${3.2*u}px ${FONT}`; c.fillText(l,cx+3*u,cy+12.6*u); } }); y+=2*(chh+2.2*u)+2*u;
    c.font=`${5.2*u}px ${FONT}`; m.badges.slice(0,14).forEach((k,i)=>{ if(!dry) c.fillText(badgeMeta(k).e,padX+i*6.2*u,y+5.2*u); }); y+=9*u; if(m.style){ c.font=`800 ${4.6*u}px ${FONT}`; if(!dry){ c.fillStyle=p.fg; c.fillText(`${m.style.e} ${m.style.n}`,padX,y+4*u); } y+=7*u; } }
  /* list */
  (sl.lines||[]).forEach(([e,t])=>{ const lf=4.4*u; c.font=`600 ${lf}px ${FONT}`; const ls=wrapLines(c,t,maxW-9.5*u); const hgt=ls.length*lf*1.5+4.2*u; if(!dry){ c.globalAlpha=0.24; c.fillStyle=p.fg; c.fillRect(padX,y,maxW,0.35*u); c.globalAlpha=1; c.font=`${lf}px ${FONT}`; c.fillText(e,padX+0.4*u,y+2.1*u+lf*1.05); c.font=`600 ${lf}px ${FONT}`; ls.forEach((l,k)=>c.fillText(l,padX+9.5*u,y+2.1*u+lf*1.05+k*lf*1.5)); } y+=hgt; });
  return y-y0;
}
function drawCard(sl,W,L,all){
  const Wd=1080, Hd=1920, u=Wd/100, cv=document.createElement("canvas"); cv.width=Wd; cv.height=Hd; const ctx=cv.getContext("2d"), p=PAL[sl.sec]||PAL.intro, idx=W.idx||0;
  ctx.fillStyle=p.bg; ctx.fillRect(0,0,Wd,Hd);
  if(sl.rec){ ctx.save(); ctx.translate(Wd*0.15,Hd*0.12); for(let a=0;a<360;a+=18){ ctx.save(); ctx.rotate(a*Math.PI/180); ctx.globalAlpha=0.28; ctx.fillStyle="#fff"; ctx.beginPath(); ctx.moveTo(0,0); ctx.lineTo(Wd*1.3,-Wd*0.07); ctx.lineTo(Wd*1.3,Wd*0.07); ctx.closePath(); ctx.fill(); ctx.restore(); } ctx.restore(); ctx.globalAlpha=1; }
  SHAPES[idx%SHAPES.length].forEach(([w,x,y,c,r,rot])=>{ ctx.save(); ctx.globalAlpha=c==="ac"?0.9:1; ctx.fillStyle=p[c]; const S0=w*u, X=x*u*(Hd/1920>0?1:1), Y=y*u; ctx.translate(X+S0/2,Y+S0/2); ctx.rotate(rot*Math.PI/180); if(r==="50%"){ ctx.beginPath(); ctx.arc(0,0,S0/2,0,Math.PI*2); ctx.fill(); } else rr(ctx,-S0/2,-S0/2,S0,S0,S0*parseFloat(r)/100), ctx.fill(); ctx.restore(); });
  if(sl.sticker){ ctx.save(); ctx.translate(Wd-17*u,26*u+13*u); ctx.rotate(10*Math.PI/180); ctx.font=`${17*u}px ${FONT}`; ctx.textAlign="center"; ctx.fillText(sl.sticker,0,0); ctx.restore(); }
  const dry=dryCtx(ctx); ctx.textBaseline="alphabetic"; const hgt=layoutCard(dry,sl,W,L,0,Wd,u,true); const top=Math.max(9*u,(Hd-hgt)/2-4*u);
  layoutCard(ctx,sl,W,L,top,Wd,u,false);
  ctx.textAlign="left"; ctx.fillStyle=p.fg; ctx.globalAlpha=0.8; ctx.font=`700 ${2.8*u}px ${FONT}`; ctx.fillText("90 DAY ONE PERSON BUSINESS BOOTCAMP · WRAPPED",8*u,Hd-8.4*u); ctx.font=`500 ${2.6*u}px ${FONT}`; ctx.fillText(`${W.m.p.name} · By Benz Arnun`,8*u,Hd-4.8*u); ctx.globalAlpha=1;
  return cv;
}
async function shareSlide(all){
  if(!ST) return; try{ await document.fonts.load('800 60px "Prompt"'); await document.fonts.load('600 40px "Prompt"'); await document.fonts.load('700 40px "Prompt"'); }catch(e){}
  const idx=all?ST.slides.length-1:ST.i, sl=ST.slides[idx], W=Object.assign({},ST.W,{idx}), cv=drawCard(sl,W,ST.lang,all?true:null);
  const blob=await new Promise(r=>cv.toBlob(r,"image/png")), name=`wrapped-${ST.W.m.p.name}-${sl.id}.png`;
  try{ const f=new File([blob],name,{type:"image/png"}); if(navigator.canShare&&navigator.canShare({files:[f]})){ await navigator.share({files:[f],text:tr(ST.lang,"Wrapped 90 วันของฉัน 🎁","My 90-day Wrapped 🎁")}); return; } }catch(e){ if(e.name==="AbortError") return; }
  const a=document.createElement("a"); a.href=URL.createObjectURL(blob); a.download=name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(()=>URL.revokeObjectURL(a.href),3000);
  if(typeof toast==="function") toast(tr(ST.lang,"เซฟรูปแล้ว 💾<br>เอาไปโพสต์ได้เลย","Saved 💾<br>Go post it!"));
}

/* ตัวช่วยตรวจ (dev) */
function _sheet(id,L){ L=L||"th"; const all=ALL, m=all.P[id], W={m,P:all.P,raw:all.raw,hideNames:false,L}; return slides(W,L).map((sl,i)=>({id:sl.id,html:slideHTML(sl,W,i)})); }
async function _card(id,idx,L){ L=L||"th"; try{ await document.fonts.load('800 60px "Prompt"'); await document.fonts.load('600 40px "Prompt"'); await document.fonts.load('700 40px "Prompt"'); }catch(e){} const all=ALL, m=all.P[id], W={m,P:all.P,raw:all.raw,hideNames:false,L}, sl=slides(W,L), i=idx<0?sl.length-1:idx; W.idx=i; return drawCard(sl[i],W,L,i===sl.length-1?true:null); }
window.WRAP={open,close,build,slides,rawFromDemo,gatherLive,buildAndUpload,serialize,wFromD,RECS,STYLES,_all:()=>ALL,_sheet,_card};
})();
