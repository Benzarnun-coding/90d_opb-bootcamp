/* ============================================================
   CREATOR BOOTCAMP — logic
   DEMO  — ไม่ได้ใส่คีย์ Supabase ใน config.js → ข้อมูลปลอมในเครื่อง
   LIVE  — ใส่คีย์แล้ว → ฐานข้อมูลจริง เห็นกันสด ๆ ทุกเครื่อง
   ============================================================ */
const C       = window.CFG;
const SPRINTS = C.SPRINTS;
const PLATS   = C.PLATFORMS;
const PLEDGES = C.PLEDGES;
const SPD     = C.SPRINT_DAYS;
const NSP     = SPRINTS.length;
const SPRINT_DAYS_TOTAL = SPD * NSP;       // 84 วันที่มีโครงสร้างสปรินต์
const TOTAL   = C.COHORT_DAYS || SPD*NSP;  // ความยาวรุ่นทั้งหมด (รวมช่วงต่อเวลา)
const OT_DAYS = TOTAL - SPRINT_DAYS_TOTAL; // จำนวนวันต่อเวลา
const HEAVY   = C.HEAVY_TARGET || 10;      // รับเป้าตั้งแต่เท่านี้ขึ้นไปแล้วทำไม่ถึง = หมดแรงสัปดาห์ถัดไป
const WEEKS   = Math.round((SPD * NSP) / 7);
const FINISH  = C.GOAL_TOTAL || 7 * WEEKS; // เส้นชัย = ปล่อยครบกี่ชิ้น (ส่งเกินได้)
const NEAR    = C.NEAR_RANGE || 3;
const LIVE    = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY);
const COLORS  = ["#ff4d6d","#4ee1ff","#5ef08c","#ffcc4d","#ff9f43","#ff7bc6","#b06bff","#3ddbb8"];
const HOUSES  = [
  {id:1, key:"wisdom",     name:"WISDOM",     th:"ปัญญา",    color:"#4ee1ff", emoji:"🦉"},
  {id:2, key:"justice",    name:"JUSTICE",    th:"ยุติธรรม", color:"#ffcc4d", emoji:"⚖️"},
  {id:3, key:"courage",    name:"COURAGE",    th:"ความกล้า", color:"#ff4d6d", emoji:"🦁"},
  {id:4, key:"discipline", name:"DISCIPLINE", th:"วินัย",    color:"#5ef08c", emoji:"🛡️"}
];
const houseOf = id => HOUSES.find(h=>h.id===id) || HOUSES[0];
const $ = id => document.getElementById(id);

/* ================= SPRITE ================= */
const HEAD=[".....OOOOO......","...OOhhhhhOO....","..OhhhhhhhhhO...","..OhHHHHHHHhO...",
  ".OHHSSSSSSSHHO..",".OHSSSSSSSSSHO..",".OHSESSSSESSsO..",".OHSSSSSSSSSsO..",
  "..OSSssSSssSsO..","...OsssssssO...."];
/* ร่างหมดแรง — โผล่เมื่อสัปดาห์ที่แล้วรับเป้าหนักแล้วทำไม่ถึง */
const HEAD_SKULL=[".....OOOOO......","...OOKKKKKOO....","..OKKKKKKKKKO...","..OKKKKKKKKKO...",
  ".OKKKKKKKKKKKO..",".OKKEEKKKEEKKO..",".OKKEEKKKEEKKO..",".OKKKKKOKKKKKO..",
  "..OKKEKEKEKKO...","...OKKKKKKKO...."];
const TORSO=["...OOCCCCCCOO...","..OClCCCCCCcCO..",".OSClCCCCCCccSO.",".OSCllCCCCccCSO.",
  ".OsCCllCCccCCsO.","..OCCCCCCCCCCO..","...OCCCCCCCCO..."];
const LEGS={
  a:["...OPPPPPPPPO...","...OPPPPppppO...","...OPPO.OppO....","..OPPO...OppO...",
     "..OPO.....OpO...",".OBBBO....OBBO..",".OBBBO...OBBBO.."],
  b:["...OPPPPPPPPO...","..OPPPPppppO....",".OPPO....OppO...","OPPO......OppO..",
     "OPO........OpO..","OBBBO.....OBBBO.",".OBBO......OBBO."],
  c:["...OPPPPPPPPO...","...OPPPPppppO...","....OPPOppO.....","....OPPOppO.....",
     "....OPOOpO......","...OBBBOBBBO....","...OBBBOBBBO...."]};
const FRAMES=[LEGS.a, LEGS.b, LEGS.c, LEGS.b.map(r=>[...r].reverse().join(""))];

function shift(hex,amt){
  const n=parseInt(hex.slice(1),16);
  const ch=i=>Math.max(0,Math.min(255,((n>>(16-8*i))&255)+amt));
  return "#"+[0,1,2].map(i=>ch(i).toString(16).padStart(2,"0")).join("");
}
/* จานสีตามโหมดของสัปดาห์: ปกติ / แดง (LASER) / ไฟ (PRO MAX ผมทอง) */
function palette(color, style){
  /* สี่ขั้น ให้ดูออกจากอีกฝั่งของสนามว่าใครอยู่สถานะไหน
       ปกติ    — สีที่ตัวเองเลือก ผมน้ำตาล ตาดำ
       LASER   — ชุดแดงเลือดนกทับสีส่วนตัว + ตายิงเลเซอร์
       PRO MAX — ชุดทอง ผมทอง ตาแดง + ไฟลุกรอบตัว
       BURNOUT — ร่างกระโหลกสีกระดูก หมดแรง เลือกเป้าหนักไม่ได้ทั้งสัปดาห์ */
  if(style==="burnout"){
    return {O:"#1a1622", K:"#d8d4c8", E:"#241f18", S:"#d8d4c8", s:"#a9a496",
      C:"#6b6a78", c:"#43424f", l:"#8f8e9c",
      P:"#3a3946", p:"#2a2934", B:"#8d8a9a", b:"#5d5b68",
      H:"#d8d4c8", h:"#eae7dc"};
  }
  const suit = style==="red" ? "#ff2436" : style==="flame" ? "#ffb324" : color;
  const p = {O:"#140d2e", H:"#2e1c14", h:"#5a3a22", S:"#ffd2a8", s:"#d99a6c",
    E:"#140d2e",
    C:suit, c:shift(suit,-62), l:shift(suit,58),
    P:"#3450a8", p:"#22357a", B:"#eceaf6", b:"#a8a4c4"};
  if(style==="red"){
    p.E="#fff2f2";                      // ตาขาวร้อน ต้นทางของลำเลเซอร์
  }
  if(style==="flame"){
    p.H="#ffd23a"; p.h="#fff8c4";      // ผมทองแบบซูเปอร์ไซย่า
    p.l="#fff3a0";                      // ไฮไลต์ชุดขาวร้อน
    p.P="#c85a10"; p.p="#8a3606";      // กางเกงส้มเข้ม
    p.O="#3a1a05";                      // เส้นขอบอุ่นขึ้น ไม่ตัดกับไฟ
    p.E="#ff1f1f";                      // ตาแดงเรือง
  }
  return p;
}
function sprite(color, px=2, style="normal"){
  const pal=palette(color,style);
  const rects=(rows,yOff)=>rows.map((row,y)=>
    [...row.padEnd(16,".")].slice(0,16).map((ch,x)=>
      pal[ch]?`<rect x="${x*px}" y="${(y+yOff)*px}" width="${px}" height="${px}" fill="${pal[ch]}"/>`:"").join("")).join("");
  const legs=FRAMES.map((f,i)=>
    `<g class="leg k${i}" style="animation-delay:-${(i*.12).toFixed(2)}s">${rects(f,17)}</g>`).join("");
  const head = style==="burnout" ? HEAD_SKULL : HEAD;
  /* ลำเลเซอร์ยิงไปข้างหน้าจากตา เฉพาะโหมด LASER FOCUS */
  const laser = style==="red"
    ? `<rect x="${10*px}" y="${6*px}" width="${6*px}" height="${px}" fill="#ff2020"/>`
    + `<rect x="${10*px}" y="${6*px}" width="${3*px}" height="${px}" fill="#fff2f2"/>`
    : "";
  return `<svg width="${16*px}" height="${24*px}" viewBox="0 0 ${16*px} ${24*px}" shape-rendering="crispEdges">
    ${rects(head,0)}${rects(TORSO,10)}${legs}${laser}</svg>`;
}
const aura = () => `<span class="aura"><i></i><i></i><i></i></span>`;
function runnerBox(color, px, style="normal"){
  return `<div class="runner ${style}" style="position:relative;transform:none;width:auto">
    <div class="body">${style==="flame"?aura():""}${sprite(color,px,style)}</div></div>`;
}

/* ================= MATH ================= */
const spOf      = d => Math.min(Math.floor((d-1)/SPD), NSP-1);   // ช่วงต่อเวลาปัดเข้าสปรินต์สุดท้าย
const inOvertime = () => S.today > SPRINT_DAYS_TOTAL;
const spStart   = s => s*SPD+1;
const spEnd     = s => (s+1)*SPD;
const weekOf    = d => Math.max(1, Math.floor((d-1)/7)+1);
const weekStart = w => (w-1)*7+1;
const weekEnd   = w => w*7;
const spOfWeek  = w => Math.floor(((w-1)*7)/SPD);
const curSp     = () => spOf(S.today);
const curWeek   = () => weekOf(S.today);
const joinedIn  = (r,s) => r.joined.includes(s);
const joinedWeek= (r,w) => joinedIn(r, spOfWeek(w));
const meR       = () => S.runners.find(r=>r.name===S.me) || S.runners[0];
const optOf     = t => PLEDGES.find(o=>o.target===t) || PLEDGES[1];
const styleOf   = r => { const t=r.pledges&&r.pledges[curWeek()]; return t?optOf(t).style:"normal"; };

const subsOf = name => S.subs.filter(s=>s.who===name);
const EMPTY_ST = {contents:0,activeDays:0,weekDone:0,weekTarget:0,target:0,pace:0,rate:0,
                  weekStreak:0,dayStreak:0,byDay:{},weeksHit:0,style:"normal"};
/* โหมด LIVE: Postgres คิดมาให้แล้วใน v_leaderboard → อ่านจาก r.st
   โหมด DEMO: คิดเองในเบราว์เซอร์จากข้อมูลปลอม */
const stats = r => (r && r.st) ? r.st : computeStats(r);
function computeStats(r){
  if(!r) return {contents:0,activeDays:0,weekDone:0,weekTarget:0,target:0,pace:0,rate:0,
                 weekStreak:0,dayStreak:0,byDay:{},weeksHit:0,style:"normal"};
  const my=subsOf(r.name);
  const byDay={};
  my.forEach(s=>{ byDay[s.day]=(byDay[s.day]||0)+1; });
  const cw=curWeek();
  const weekDone = my.filter(s=>weekOf(s.day)===cw).length;
  const weekTarget = (r.pledges&&r.pledges[cw]) || 0;

  let target=0;
  for(let w=1; w<=cw; w++){
    if(r.pledges && r.pledges[w] && joinedWeek(r,w)) target += r.pledges[w];
  }
  /* streak รายสัปดาห์: สัปดาห์ที่ไม่ได้ลง ข้ามไปไม่ตัด สัปดาห์นี้ยังไม่ตัดสินถ้ายังไม่ครบ */
  let ws=0, weeksHit=0;
  for(let w=cw; w>=1; w--){
    const t=r.pledges&&r.pledges[w];
    if(!t || !joinedWeek(r,w)) continue;
    const done=my.filter(s=>weekOf(s.day)===w).length;
    if(done>=t){ ws++; if(w<cw) weeksHit++; }
    else if(w===cw) continue;
    else break;
  }
  for(let w=1; w<cw; w++){
    const t=r.pledges&&r.pledges[w];
    if(t && joinedWeek(r,w) && my.filter(s=>weekOf(s.day)===w).length>=t && weeksHit===0) weeksHit++;
  }
  /* streak รายวัน */
  let ds=0;
  for(let d=S.today; d>=1; d--){
    if(!joinedIn(r,spOf(d))) continue;
    if(byDay[d]) ds++;
    else if(d===S.today) continue;
    else break;
  }
  /* หมดแรง: สัปดาห์ที่แล้วรับเป้าหนัก (10+) ไว้แล้วทำไม่ถึง
     สัปดาห์นี้ตัวละครกลายเป็นร่างกระโหลก และเลือกได้แค่ 4 หรือ 7 */
  let burnout = !!r.burnout;
  if(!burnout && cw > 1){
    const pw = cw - 1, pt = r.pledges && r.pledges[pw];
    if(pt >= HEAVY && joinedWeek(r, pw)){
      burnout = my.filter(s=>weekOf(s.day)===pw).length < pt;
    }
  }
  const contents=my.length;
  return {contents, activeDays:Object.keys(byDay).length, weekDone, weekTarget, target,
    pace:contents-target, rate: target?Math.round(contents/target*100):0,
    weekStreak:ws, dayStreak:ds, byDay, weeksHit, burnout,
    style: burnout ? "burnout" : (weekTarget ? optOf(weekTarget).style : "normal")};
}

/* ================= DATA LAYER ================= */
const DemoDB = (()=>{
  const KEY="creatorBootcamp.demo.v3";
  const NAMES=[["MILD","@mild.studio"],["POND","@pondcuts"],["NAMTAN","@namtan.tv"],["BAS","@basdaily"],
    ["JAAB","@jaabmakes"],["TAE","@taeontape"],["OAK","@oak.films"],["PLOY","@ploystory"],
    ["GIFT","@giftvlog"],["NOTE","@notemotion"],["FILM","@filmcuts"],["MAY","@maydaily"]];
  let uid=1, db=null, onChange=()=>{};
  const save=()=>{ try{ db.uid=uid; localStorage.setItem(KEY,JSON.stringify(db)); }catch(e){} };

  function build(me){
    const today=Math.min(38,TOTAL), cw=weekOf(today);
    const runners=NAMES.map(([n,h],i)=>({
      id:"d"+i, name:n, handle:h, color:COLORS[(i+1)%COLORS.length],
      house:1+(i%4), role:"student",
      joined:[0,1,2,3,4,5].filter(s=> s<=2 || Math.random()<.7),
      pledges:{}
    }));
    runners.unshift({id:"me", name:me.name, handle:me.handle||("@"+me.name.toLowerCase()), color:me.color,
      house:me.house||1, role:"student", joined:me.joined, pledges:{}});

    runners.forEach((r,i)=>{
      const grit = i===0 ? 1.02 : .3+Math.random()*.65;   // ผู้เล่นเริ่มต้นเกาะเป้าพอดี
      for(let w=1; w<=cw; w++){
        if(!joinedWeek(r,w)) continue;
        const roll=Math.random();
        r.pledges[w] = w>=7 && roll<.12 ? 14 : roll<.25 ? 4 : roll<.8 ? 7 : 10;
      }
      r._grit=grit;
    });

    let subs=[];
    runners.forEach((r,i)=>{
      for(let d=1; d<=today; d++){
        if(!joinedIn(r,spOf(d))) continue;
        if(i===0 && d===today) continue;              // เว้นวันนี้ให้ผู้เล่นกดเอง
        const t=r.pledges[weekOf(d)]||7;
        const perDay=t/7;
        let n=Math.floor(perDay);
        if(Math.random() < (perDay-n)) n++;
        if(Math.random() > r._grit) n=Math.max(0,n-1);
        for(let k=0;k<n;k++){
          subs.push({id:uid++, who:r.name, day:d, sp:spOf(d), plat:PLATS[(Math.random()*PLATS.length)|0],
            url:`https://tiktok.com/${r.handle.slice(1)}/${d}-${k}-${(Math.random()*9e4|0)}`,
            ts:Date.now()-(today-d)*864e5-(Math.random()*6e7|0)});
        }
      }
      delete r._grit;
    });
    return {today, me:runners[0].name, runners, subs, uid};
  }
  return {
    mode:"demo", canSim:true,
    async init(){ try{ db=JSON.parse(localStorage.getItem(KEY)||"null"); }catch(e){ db=null; }
      if(db) uid=db.uid||1;
      return {needsAuth:false, needsProfile:!db}; },
    async signIn(){}, async signInGoogle(){},
    async signOut(){ try{localStorage.removeItem(KEY);}catch(e){} db=null; },
    async createProfile(p){ db=build(p); uid=db.uid; save(); },
    async fetchAll(){
      const postedToday = db.subs.some(s=>s.who===db.me && s.day===db.today);
      return {today:db.today, me:db.me, runners:db.runners, subs:db.subs, postedToday,
              started:true, daysUntil:0, startDate:null};
    },
    async rosterList(){
      return db.runners.filter(r=>r.role==="student").map((r,i)=>({
        email:r.name.toLowerCase()+"@example.com", house_id:r.house,
        full_name:r.name, claimed_by:i<db.runners.length-3?r.id:null, claimed_at:null}));
    },
    async rosterAdd(){ throw new Error("โหมด DEMO เพิ่มรายชื่อจริงไม่ได้ ต้องต่อ Supabase ก่อน"); },
    async detail(runner){
      const my=db.subs.filter(s=>s.who===runner.name);
      const byDay={}; my.forEach(s=>{ byDay[s.day]=(byDay[s.day]||0)+1; });
      return {byDay, recent:[...my].sort((a,b)=>b.ts-a.ts).slice(0,15)};
    },
    async submit({url, platform}){
      const r=db.runners.find(x=>x.name===db.me);
      if(db.subs.some(s=>s.url.toLowerCase()===url.toLowerCase())) throw new Error("ลิงก์นี้ถูกส่งไปแล้ว");
      const s=spOf(db.today);
      if(!r.joined.includes(s)) throw new Error(`ไม่ได้ลงสปรินต์ ${s+1}`);
      db.subs.push({id:uid++, who:r.name, day:db.today, sp:s, plat:platform, url, ts:Date.now()});
      save(); onChange();
    },
    async setPledge(week, target){
      const r=db.runners.find(x=>x.name===db.me);
      const cur=r.pledges[week];
      if(week<weekOf(db.today)) throw new Error("สัปดาห์นั้นผ่านไปแล้ว");
      if(week===weekOf(db.today) && cur && target<cur)
        throw new Error(`สัปดาห์นี้เริ่มแล้ว เพิ่มได้ ลดไม่ได้ (เดิม ${cur})`);
      r.pledges[week]=target; save(); onChange();
    },
    async setSprints(list){ db.runners.find(r=>r.name===db.me).joined=[...list].sort((a,b)=>a-b); save(); onChange(); },
    subscribe(cb){ onChange=cb; },
    simulateDay(){
      if(db.today>TOTAL) throw new Error("จบหลักสูตรแล้ว ดูใบประกาศที่หน้า MY STATUS");
      const bw=weekOf(db.today); db.today++; const cw=weekOf(db.today);
      let n=0;
      db.runners.forEach((r,i)=>{
        if(i===0 || !r.joined.includes(spOf(db.today))) return;
        if(db.today<=SPRINT_DAYS_TOTAL && cw!==bw && !r.pledges[cw]){
          const roll=Math.random();
          r.pledges[cw] = cw>=7 && roll<.15 ? 14 : roll<.25 ? 4 : roll<.8 ? 7 : 10;
        }
        const t=r.pledges[cw]||7, perDay=t/7;
        let k=Math.floor(perDay); if(Math.random()<(perDay-k)) k++;
        if(Math.random()<.28) k=Math.max(0,k-1);
        for(let j=0;j<k;j++){
          db.subs.push({id:uid++, who:r.name, day:db.today, sp:spOf(db.today),
            plat:PLATS[(Math.random()*PLATS.length)|0],
            url:`https://tiktok.com/${r.handle.slice(1)}/${db.today}-${j}-${(Math.random()*9e4|0)}`,
            ts:Date.now()-(Math.random()*3e7|0)});
          n++;
        }
      });
      save(); onChange();
      return {weekChanged: bw!==cw, week:cw, day:db.today, n};
    }
  };
})();

const LiveDB = (()=>{
  let sb=null, session=null, cohort=null, onChange=()=>{}, timer=null;
  const bump=()=>{ clearTimeout(timer); timer=setTimeout(()=>onChange(), 400); };
  const todayFrom = sd => {
    const shifted=new Date(Date.now()-C.CUTOFF_HOUR*3600e3);
    return Math.max(1, Math.floor((shifted-new Date(sd+"T00:00:00"))/864e5)+1);
  };
  return {
    mode:"live", canSim:false,
    async init(){
      sb=window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
      const {data:{session:s}}=await sb.auth.getSession(); session=s;
      sb.auth.onAuthStateChange((_e,ns)=>{ if(!!ns!==!!session) location.reload(); session=ns; });
      if(!session) return {needsAuth:true, needsProfile:false};
      const {data:prof}=await sb.from("profiles").select("id").eq("id",session.user.id).maybeSingle();
      return {needsAuth:false, needsProfile:!prof, email:session.user.email};
    },
    async signIn(email){
      const {error}=await sb.auth.signInWithOtp({email,options:{emailRedirectTo:location.href.split("#")[0]}});
      if(error) throw new Error(error.message);
    },
    async signInGoogle(){
      const {error}=await sb.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.href.split("#")[0]}});
      if(error) throw new Error(error.message);
    },
    async signOut(){ await sb.auth.signOut(); location.reload(); },
    async createProfile(p){
      const {error}=await sb.from("profiles").insert({id:session.user.id, name:p.name, color:p.color});
      if(error){
        /* บอกให้ตรงว่าชนตรงไหน ไม่งั้นผู้ใช้จะเปลี่ยนชื่อไปเรื่อย ๆ ทั้งที่ปัญหาอยู่ที่อื่น */
        const m = error.message || "";
        if(/profiles_name_key/i.test(m))        throw new Error("ชื่อนี้มีคนใช้แล้ว ลองชื่ออื่น");
        if(/profiles_pkey/i.test(m))            throw new Error("คุณมีโปรไฟล์อยู่แล้ว ลองรีเฟรชหน้าเว็บ");
        if(/profiles_handle_key/i.test(m))      throw new Error("ระบบตั้ง handle ให้ไม่สำเร็จ แจ้งทีมงาน");
        if(/ไม่อยู่ในรายชื่อ|ถูกใช้สมัครไปแล้ว/.test(m)) throw new Error(m);
        throw new Error(m);
      }
      const {error:e2}=await sb.from("enrollments").insert(p.joined.map(s=>({profile_id:session.user.id,sprint_idx:s})));
      if(e2) throw new Error(e2.message);
    },
    /* ดึงเฉพาะผลสรุปที่ Postgres คิดมาแล้ว
       250 คน = 250 แถว + ฟีด 50 แถว + คำสัญญาของตัวเองอีก 12 แถว
       แทนที่จะลากงานทั้งรุ่นสองหมื่นกว่าแถวมาคำนวณในเครื่องนักเรียน */
    async fetchAll(){
      const uidNow = session.user.id;
      const [{data:co},{data:board,error:be},{data:feed},{data:pls},{data:burn}]=await Promise.all([
        sb.from("cohort").select("*").eq("id",1).single(),
        sb.from("v_leaderboard").select("*"),
        sb.from("v_feed").select("*").limit(50),
        sb.from("pledges").select("week_no,target").eq("profile_id",uidNow),
        sb.from("v_burnout").select("profile_id")
      ]);
      if(be) throw new Error("อ่าน v_leaderboard ไม่ได้ — รัน migration 002-005 ครบหรือยัง? ("+be.message+")");
      cohort=co;
      const runners=(board||[]).map(b=>({
        id:b.id, name:b.name, handle:b.handle, color:b.color,
        house:b.house_id||1, role:b.role,
        joined:(b.joined||[]).slice().sort((x,y)=>x-y),
        pledges:{},
        st:{
          contents:   b.contents||0,
          activeDays: b.active_days||0,
          weekDone:   b.week_done||0,
          weekTarget: b.week_target||0,
          target:     b.target_to_date||0,
          pace:       b.pace||0,
          rate:       b.rate||0,
          weekStreak: b.week_streak||0,
          dayStreak:  b.day_streak||0,
          weeksHit:   b.weeks_hit||0,
          byDay:      {},                      // โหลดเฉพาะตอนเปิดโปรไฟล์
          style:      b.pledge_style||"normal"
        }
      }));
      const burntIds = new Set((burn||[]).map(b=>b.profile_id));
      runners.forEach(r=>{
        if(burntIds.has(r.id)){ r.burnout = true; r.st.burnout = true; r.st.style = "burnout"; }
      });
      const me=runners.find(r=>r.id===uidNow);
      if(me) (pls||[]).forEach(x=>{ me.pledges[x.week_no]=x.target; });
      /* สถานะรุ่นต้องเอาจากเซิร์ฟเวอร์ เพราะมันคิดตามเวลาไทยและตัดรอบตี 4
         ถ้าปล่อยให้เบราว์เซอร์คิดเอง คนที่ตั้งไทม์โซนไม่ตรงจะเห็นวันเหลื่อมไปหนึ่งวัน
         และต้องรู้ด้วยว่ารุ่นเริ่มหรือยัง ไม่งั้นช่วงก่อนเปิดจะโชว์ว่าเป็นวันที่ 1 */
      let todayIdx, started = true, daysUntil = 0;
      try{
        const {data:cs,error:e0}=await sb.rpc("cohort_status");
        if(e0) throw e0;
        const row = Array.isArray(cs) ? cs[0] : cs;
        todayIdx  = Number(row.day_index);
        started   = !!row.started;
        daysUntil = Number(row.days_until) || 0;
        if(row.total_days && Number(row.total_days) !== TOTAL)
          console.warn("cohort.total_days ("+row.total_days+") ไม่ตรงกับ COHORT_DAYS ใน config.js ("+TOTAL+")");
      }catch(e){
        console.warn("cohort_status RPC ไม่ตอบ ใช้เวลาเครื่องแทนชั่วคราว", e.message||e);
        todayIdx = todayFrom(co.start_date);
        started  = new Date() >= new Date(co.start_date + "T00:00:00");
      }
      if(!todayIdx || !isFinite(todayIdx)) todayIdx=todayFrom(co.start_date);
      const {count:todayCount}=await sb.from("submissions")
        .select("id",{count:"exact",head:true})
        .eq("profile_id",uidNow).eq("day_index",todayIdx).eq("status","approved");
      return {
        today: todayIdx,
        me: me ? me.name : null,
        postedToday: (todayCount||0) > 0,
        started, daysUntil, startDate: co.start_date,
        runners,
        subs:(feed||[]).map(f=>({
          id:f.id, who:f.name, day:f.day_index, sp:f.sprint_idx,
          plat:f.platform, url:f.url, ts:new Date(f.created_at).getTime()}))
      };
    },
    /* ---- รายชื่อนักเรียน (RLS ให้เฉพาะหัวหน้าโค้ช) ---- */
    async rosterList(){
      const {data,error}=await sb.from("roster")
        .select("email,house_id,full_name,claimed_by,claimed_at").order("house_id").order("email");
      if(error) throw new Error(error.message);
      return data||[];
    },
    async rosterAdd(rows){
      const {error}=await sb.from("roster").upsert(rows,{onConflict:"email"});
      if(error) throw new Error(error.message);
      return rows.length;
    },
    /* รายละเอียดของคนเดียว — ใช้ตอนเปิดโปรไฟล์หรือหน้า Status */
    async detail(runner){
      const {data}=await sb.from("submissions")
        .select("id,platform,url,day_index,sprint_idx,created_at")
        .eq("profile_id",runner.id).eq("status","approved")
        .order("created_at",{ascending:false}).limit(400);
      const byDay={};
      (data||[]).forEach(s=>{ byDay[s.day_index]=(byDay[s.day_index]||0)+1; });
      return {byDay, recent:(data||[]).slice(0,15).map(s=>({
        id:s.id, who:runner.name, day:s.day_index, sp:s.sprint_idx,
        plat:s.platform, url:s.url, ts:new Date(s.created_at).getTime()}))};
    },
    async submit({url, platform}){
      const {error}=await sb.from("submissions").insert({
        profile_id:session.user.id, url, url_key:url, platform, day_index:1, sprint_idx:0});
      if(error){
        if(error.code==="23505"||/duplicate/i.test(error.message)) throw new Error("ลิงก์นี้ถูกส่งไปแล้ว");
        throw new Error(error.message.replace(/^.*?:\s*/,""));
      }
    },
    async setPledge(week,target){
      const {error}=await sb.from("pledges")
        .upsert({profile_id:session.user.id, week_no:week, target}, {onConflict:"profile_id,week_no"});
      if(error) throw new Error(error.message.replace(/^.*?:\s*/,""));
    },
    async setSprints(list){
      const cur=meR().joined;
      const add=list.filter(s=>!cur.includes(s)), del=cur.filter(s=>!list.includes(s));
      if(add.length){
        const {error}=await sb.from("enrollments").insert(add.map(s=>({profile_id:session.user.id,sprint_idx:s})));
        if(error) throw new Error(error.message);
      }
      for(const s of del){
        const {error}=await sb.from("enrollments").delete().eq("profile_id",session.user.id).eq("sprint_idx",s);
        if(error) throw new Error(error.message);
      }
    },
    subscribe(cb){
      onChange=cb;
      sb.channel("bootcamp")
        .on("postgres_changes",{event:"*",schema:"public",table:"submissions"},bump)
        .on("postgres_changes",{event:"*",schema:"public",table:"pledges"},bump)
        .on("postgres_changes",{event:"*",schema:"public",table:"profiles"},bump)
        .subscribe();
    }
  };
})();
const DB = LIVE ? LiveDB : DemoDB;

/* ================= STATE ================= */
let S = {today:1, me:null, runners:[], subs:[], raceFilter:"near", boardFilter:"all"};
let BOOTSTATE = null;

/* ================= UI HELPERS ================= */
let toastT;
function toast(msg){
  const t=$("toast"); t.innerHTML=msg; t.classList.add("on");
  clearTimeout(toastT); toastT=setTimeout(()=>t.classList.remove("on"),3200);
}
function show(id){
  document.querySelectorAll(".screen").forEach(s=>s.classList.toggle("on", s.id===id));
  $("sky").style.opacity = id==="scArena" ? ".28" : "1";
  window.scrollTo(0,0);
}
window.showPage=showPage;
function showPage(id){
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("on", p.id===id));
  document.querySelectorAll(".navBtn").forEach(b=>b.classList.toggle("on", b.dataset.page===id));
  if(id==="pgStatus") renderStatus();
  if(id==="pgBoard")  renderBoard();
  if(id==="pgAdmin")  renderAdmin();
  window.scrollTo(0,0);
}
function ago(ts){
  const m=Math.round((Date.now()-ts)/60000);
  if(m<1) return "เมื่อกี้";
  if(m<60) return m+" นาทีที่แล้ว";
  const h=Math.round(m/60);
  return h<24?h+" ชม.ที่แล้ว":Math.round(h/24)+" วันที่แล้ว";
}
function cutoffLeft(){
  const now=new Date(), c=new Date(now);
  c.setHours(C.CUTOFF_HOUR,0,0,0);
  if(now>=c) c.setDate(c.getDate()+1);
  const s=Math.floor((c-now)/1000);
  return [Math.floor(s/3600),Math.floor(s%3600/60),s%60].map(v=>String(v).padStart(2,"0")).join(":");
}
/* โค้ชไม่ลงแข่ง — ไม่โผล่บนสนาม ไม่อยู่ในกระดาน ไม่ถ่วงค่าเฉลี่ยของบ้าน
   ถ้าโค้ชอยากวิ่งด้วย ให้สมัครอีกบัญชีเป็นนักเรียน */
const students = () => S.runners.filter(r => r.role !== "coach");
const ranked = () => [...students()].sort((a,b)=>{
  const A=stats(a), B=stats(b);
  return B.contents-A.contents || B.rate-A.rate || B.weekStreak-A.weekStreak;
});

/* ================= PLEDGE CARD ================= */
function renderPledge(){
  const r=meR(); if(!r) return;
  if(!S.started){
    const d = new Date((S.startDate||"") + "T00:00:00");
    const th = isNaN(d) ? "" : d.toLocaleDateString("th-TH",{day:"numeric",month:"long",year:"numeric"});
    $("pledgeCard").innerHTML =
      '<div class="paceNum on">' + S.daysUntil + '</div>'
      + '<div class="pledgeTxt"><span class="big normal">อีก ' + S.daysUntil + ' วันจะเริ่ม</span><br>'
      + 'รุ่นเปิด ' + th + ' · ระหว่างนี้ตั้งชื่อ เลือกสี และรับเป้าของสัปดาห์แรกไว้ก่อนได้'
      + '<br><span style="color:var(--dim)">ส่งงานได้ตั้งแต่วันเปิดรุ่นเป็นต้นไป</span></div>';
    return;
  }
  if(inOvertime() && !finished()){
    const st=stats(r), left=Math.max(0,FINISH-st.contents), dleft=TOTAL-S.today+1;
    $("pledgeCard").innerHTML =
      '<div class="paceNum ' + (st.contents>=FINISH?"ahead":"behind") + '">' + dleft + '</div>'
      + '<div class="pledgeTxt"><span class="big normal">ช่วงต่อเวลา · เหลือ ' + dleft + ' วัน</span><br>'
      + 'สปรินต์จบครบ ' + NSP + ' อันแล้ว ไม่มีเป้ารายสัปดาห์ในช่วงนี้ ส่งเก็บให้ถึง ' + FINISH + ' ชิ้นได้เลย<br>'
      + '<span style="color:var(--dim)">ตอนนี้ ' + st.contents + '/' + FINISH + ' ชิ้น'
      + (left ? ' · ขาดอีก ' + left : ' · ครบเป้าแล้ว 🏆') + '</span></div>';
    return;
  }
  if(finished()){
    const st=stats(r), hit=st.contents>=FINISH;
    $("pledgeCard").innerHTML =
      '<div class="paceNum ' + (hit?"ahead":"on") + '">' + (hit?"🏆":"🎓") + '</div>'
      + '<div class="pledgeTxt"><span class="big normal">จบ ' + TOTAL + ' วันแล้ว</span><br>'
      + 'ปล่อยไปทั้งหมด ' + st.contents + ' ชิ้น'
      + (hit ? ' · ครบเป้า ' + FINISH + ' ชิ้น' : ' จากเป้า ' + FINISH)
      + '<br><span style="color:var(--dim)">ใบประกาศอยู่ที่หน้า MY STATUS กดแชร์ได้เลย</span></div>'
      + '<button class="btn gold" style="padding:13px 18px" onclick="showPage(&quot;pgStatus&quot;)">🎓 ดูใบประกาศ</button>';
    return;
  }
  const st=stats(r), cw=curWeek();
  if(!st.weekTarget){
    $("pledgeCard").innerHTML=`
      <div class="pledgeTxt"><span class="big normal">ยังไม่ได้เลือกเป้าของสัปดาห์ที่ ${cw}</span><br>
        เลือกก่อนว่าสัปดาห์นี้จะปล่อยกี่ชิ้น แล้วค่อยเริ่มส่งงาน</div>
      <button class="btn go" style="max-width:240px" onclick="openPledge()">▶ เลือกเป้าสัปดาห์นี้</button>`;
    return;
  }
  const o=optOf(st.weekTarget);
  const pct=Math.min(100, st.weekDone/st.weekTarget*100);
  const dash=2*Math.PI*44;
  const ringColor = o.style==="flame" ? "#ffb020" : o.style==="red" ? "#ff2436" : r.color;
  const dayLeft = weekEnd(cw)-S.today+1;
  /* เตือนว่าวันนี้ยังไม่ได้ส่งงาน — ตัวเดียวที่ทำงานได้โดยไม่ต้องพึ่งบริการภายนอก */
  const left = cutoffLeft().split(":");
  const nudge = S.postedToday ? "" :
    '<div style="flex-basis:100%;margin-top:12px;padding:11px 13px;font-size:13px;line-height:1.7;'
    + 'background:linear-gradient(180deg,#5c3a10,#33200a);border:2px solid #ffb020 #8a5a08 #8a5a08 #ffb020">'
    + '<b style="font-family:var(--f-px);color:#ffd24d">วันนี้ยังไม่ได้ส่งงาน</b> · '
    + 'เหลืออีก ' + left[0] + ' ชั่วโมง ' + left[1] + ' นาที ก่อนปิดรอบตี ' + C.CUTOFF_HOUR
    + '</div>';
  const paceCls = st.pace>0?"ahead":st.pace<0?"behind":"on";
  $("pledgeCard").innerHTML=`
    <div class="ring">
      <svg width="104" height="104">
        <circle cx="52" cy="52" r="44" fill="none" stroke="#150f36" stroke-width="14"/>
        <circle cx="52" cy="52" r="44" fill="none" stroke="${ringColor}" stroke-width="14"
          stroke-dasharray="${dash}" stroke-dashoffset="${dash*(1-pct/100)}"/>
      </svg>
      <div class="val"><b>${st.weekDone}</b><span>/ ${st.weekTarget}</span></div>
    </div>
    <div class="pledgeTxt">
      <span class="big ${o.style}">${o.name} · ${o.target} ชิ้น/สัปดาห์</span><br>
      ${o.th}<br>
      <span style="color:var(--dim)">
        สัปดาห์ที่ ${cw}/${WEEKS} · เหลืออีก ${dayLeft} วัน ·
        ${st.weekDone>=st.weekTarget ? "ครบเป้าแล้ว 🎉 ส่งเพิ่มได้อีก"
          : "ขาดอีก "+(st.weekTarget-st.weekDone)+" ชิ้น"} ·
        streak ${st.weekStreak} สัปดาห์ 🔥
      </span>
    </div>
    <div style="text-align:center">
      <div class="paceNum ${paceCls}">${st.pace>0?"+":""}${st.pace}</div>
      <div style="font-size:11px;color:var(--dim);margin-top:4px">
        ${st.pace>0?"นำเป้ารวม":st.pace<0?"ตามหลังเป้ารวม":"ตรงเป้ารวม"}<br>
        ${st.contents} / ${st.target} ชิ้น
      </div>
      <div style="font-size:12px;margin-top:8px;color:${st.contents>=FINISH?"var(--gold)":"var(--dim)"}">
        ${st.contents>=FINISH ? `🏆 ถึงเส้นชัยแล้ว! เกินมา +${st.contents-FINISH}`
          : `เส้นชัย ${FINISH} ชิ้น · เหลืออีก ${FINISH-st.contents}`}
      </div>
    </div>` + nudge;
}

/* ================= TRACK ================= */
function raceList(){
  const all=ranked();
  if(S.raceFilter==="all") return all;
  if(S.raceFilter!=="near") return all.filter(r=>r.house===+S.raceFilter);
  const i=all.findIndex(r=>r.name===S.me);
  if(i<0) return all.slice(0,NEAR*2+1);
  return all.slice(Math.max(0,i-NEAR), i+NEAR+1);
}
function renderFilters(){
  const mk=(cur,pfx)=>[`<button class="fBtn ${cur==="near"?"on":""}" data-f="near"
      style="${cur==="near"?"background:linear-gradient(180deg,#5b51c4,#332a80)":""}">ใกล้ฉัน</button>`,
    `<button class="fBtn ${cur==="all"?"on":""}" data-f="all"
      style="${cur==="all"?"background:linear-gradient(180deg,#5b51c4,#332a80)":""}">ทั้งรุ่น</button>`]
    .concat(HOUSES.map(h=>`<button class="fBtn ${cur===String(h.id)?"on":""}" data-f="${h.id}"
      style="${cur===String(h.id)?`background:linear-gradient(180deg,${h.color},${shift(h.color,-90)});color:#0d0a22`:""}">
      ${h.emoji} ${h.name}</button>`)).join("");
  $("raceFilters").innerHTML=mk(S.raceFilter,"r");
  $("boardFilters").innerHTML=mk(S.boardFilter,"b");
}
function renderTrack(){
  const list=raceList();
  $("zones").innerHTML=SPRINTS.map((sp,i)=>`<div class="zone"><b>S${i+1} ${sp.e} ${sp.n}</b></div>`).join("");
  const st=stats(meR());
  $("cps").innerHTML =
    [Math.round(FINISH/3),Math.round(FINISH*2/3),FINISH].filter((v,i,a)=>a.indexOf(v)===i)
      .map(v=>`<div class="cp${v===FINISH?" finish":""}" style="left:calc(${v/FINISH*100}% - 7px)"><em>${v===FINISH?"🏁 ":""}${v} ชิ้น</em></div>`).join("")
    + (st.target ? `<div class="cp pace" style="left:${Math.min(100,st.target/FINISH*100)}%"><em>เป้าของคุณ ${st.target}</em></div>` : "");

  $("lanes").innerHTML = list.length ? list.map(r=>{
    const s=stats(r), h=houseOf(r.house);
    const p=Math.min(s.contents/FINISH,1);
    return `<div class="lane ${r.name===S.me?"meLane":""}" data-n="${r.name}">
      <span class="name"><i>${h.emoji}</i> ${r.name}${s.weekTarget?` · ${s.weekDone}/${s.weekTarget}`:""}</span>
      <div class="runner ${r.name===S.me?"me":""} ${s.dayStreak?"":"idle"} ${s.style}" style="--p:${p}">
        <div class="tag">${s.contents}${s.contents>=FINISH?" 🏆":""}</div>
        <div class="body">${s.style==="flame"?aura():""}${sprite(r.color,2,s.style)}
          ${s.dayStreak?'<span class="dust"></span><span class="dust b"></span>':''}</div>
        <div class="shadow"></div>
      </div></div>`;
  }).join("") : `<div class="noJoin">ยังไม่มีใครในกลุ่มนี้</div>`;

  $("trackTitle").textContent=`RACE TRACK · ${FINISH} CONTENTS`;
  $("trackSub").textContent="ระยะทาง = จำนวนคอนเทนต์ · เส้นฟ้า = เป้าของคุณ ณ สัปดาห์นี้";
}

/* ================= SCOREBOARD ================= */
function renderHouses(){
  const rows=HOUSES.map(h=>{
    const mem=students().filter(r=>r.house===h.id);
    const sts=mem.map(stats);
    const avg = sts.length ? sts.reduce((a,s)=>a+s.contents,0)/sts.length : 0;
    const rate= sts.length ? sts.reduce((a,s)=>a+s.rate,0)/sts.length : 0;
    const behind = sts.filter(s=>s.pace<-3).length;
    const laser = sts.filter(s=>s.style!=="normal").length;
    return {h, mem:mem.length, avg, rate, behind, laser};
  }).sort((a,b)=>b.rate-a.rate || b.avg-a.avg);

  $("houseGrid").innerHTML=rows.map((x,i)=>`
    <div class="houseCard" style="border-color:${x.h.color} ${shift(x.h.color,-110)} ${shift(x.h.color,-110)} ${x.h.color}">
      <div class="hr">${x.h.emoji}</div>
      <div class="hn" style="color:${x.h.color}">${i===0?"👑 ":""}${x.h.name}</div>
      <div class="hth">${x.h.th} · ${x.mem} คน</div>
      <div class="hv">${x.avg.toFixed(1)}</div>
      <div class="hl">คอนเทนต์เฉลี่ยต่อคน · ทำได้ ${Math.round(x.rate)}% ของเป้า</div>
      <div class="hl" style="margin-top:8px">
        🔥 โหมดเร่ง ${x.laser} คน · ⚠ ตามหลัง ${x.behind} คน
      </div>
    </div>`).join("");
}
function boardList(){
  const all=ranked();
  return S.boardFilter==="all"||S.boardFilter==="near" ? all : all.filter(r=>r.house===+S.boardFilter);
}
function renderBoard(){
  renderHouses();
  const full=ranked();
  const list=boardList();
  $("board").innerHTML=list.map(r=>{
    const s=stats(r), h=houseOf(r.house);
    const i=full.findIndex(x=>x.name===r.name);
    const medal=i===0?"👑":i===1?"🥈":i===2?"🥉":String(i+1).padStart(2,"0");
    const o=s.weekTarget?optOf(s.weekTarget):null;
    const wk = o ? `<span class="wkTag ${s.weekDone>=s.weekTarget?"hit":o.style}">${s.weekDone}/${s.weekTarget}${o.style==="red"?" 🔴":o.style==="flame"?" 🔥":""}</span>`
                 : `<span class="wkTag normal" style="opacity:.5">—</span>`;
    const pc = s.pace>0?"var(--green)":s.pace<0?"var(--orange)":"var(--cyan)";
    return `<tr class="${r.name===S.me?"me":""}" data-n="${r.name}" id="row-${r.name}">
      <td class="rk ${i<3?"top"+(i+1):""}">${medal}</td>
      <td class="nm" style="color:${r.color}">${r.name}
        <span style="font-family:var(--f-th);font-size:11px;color:var(--dim)">${r.handle}</span></td>
      <td class="hideSm"><span class="hs">${h.emoji}</span>
        <span style="color:${h.color};font-size:12px">${h.name}</span></td>
      <td class="num" style="color:${r.color}">${s.contents}</td>
      <td>${wk}</td>
      <td class="hideSm streak">${s.weekStreak}🔥</td>
      <td class="hideMd num" style="color:${pc}">${s.pace>0?"+":""}${s.pace}</td>
      <td class="hideMd"><div class="bar">
        <i style="width:${Math.min(100,s.contents/FINISH*100)}%;
          background:linear-gradient(180deg,${shift(r.color,55)},${r.color} 55%,${shift(r.color,-55)})"></i>
        ${s.target?`<span class="goal" style="left:${Math.min(100,s.target/FINISH*100)}%"></span>`:""}
      </div></td></tr>`;
  }).join("");
}

/* ================= FEED ================= */
function renderFeed(){
  const list=[...S.subs].sort((a,b)=>b.ts-a.ts).slice(0,50);
  $("feed").innerHTML = list.length ? list.map(f=>{
    const r=S.runners.find(x=>x.name===f.who)||{};
    const h=houseOf(r.house);
    return `<li><span class="who" style="color:${r.color||"#fff"}">${h.emoji} ${f.who}</span>
      <span class="sp">S${f.sp+1}</span><span class="plat">${f.plat}</span>
      <a href="${f.url}" target="_blank" rel="noopener">${f.url}</a>
      <span class="when">${ago(f.ts)}</span></li>`;
  }).join("") : `<li style="color:var(--dim)">ยังไม่มีงานที่ส่ง</li>`;
}

/* ================= SPRINT MAP ================= */
function mapHTML(r, byDay){
  byDay = byDay || (stats(r).byDay || {});
  return SPRINTS.map((sp,si)=>{
    const on=joinedIn(r,si);
    let cells="", tot=0;
    for(let k=0;k<SPD;k++){
      const d=spStart(si)+k, n=byDay[d]||0;
      tot+=n;
      const cls = n?" done" : (on&&d<=S.today?" miss":"");
      const bg = n?`style="background:linear-gradient(180deg,${shift(r.color,50)},${r.color} 55%,${shift(r.color,-50)});border-color:${shift(r.color,40)} ${shift(r.color,-70)} ${shift(r.color,-70)} ${shift(r.color,40)}"`:"";
      cells+=`<div class="cell${cls}" ${bg} title="วันที่ ${d} · ${n} ชิ้น">${n>1?`<em>${n}</em>`:""}</div>`;
    }
    return `<div class="spRow ${on?"":"off"}">
      <div class="lbl"><b>S${si+1} ${sp.e}</b><span>${sp.n}</span></div>
      <div class="days">${cells}</div>
      <div class="sc">${on?tot+" ชิ้น":"ไม่ได้ลง"}</div></div>`;
  }).join("") + overtimeRow(r, byDay);
}

/* แถวช่วงต่อเวลา วันที่ 85-90 — ไม่มีเป้ารายสัปดาห์ เก็บตกให้ถึงเป้ารวม */
function overtimeRow(r, byDay){
  if(OT_DAYS <= 0) return "";
  let cells="", tot=0;
  for(let k=0;k<OT_DAYS;k++){
    const d=SPRINT_DAYS_TOTAL+1+k, n=byDay[d]||0;
    tot+=n;
    const cls = n?" done" : (d<=S.today?" miss":"");
    const bg = n?`style="background:linear-gradient(180deg,${shift(r.color,50)},${r.color} 55%,${shift(r.color,-50)});border-color:${shift(r.color,40)} ${shift(r.color,-70)} ${shift(r.color,-70)} ${shift(r.color,40)}"`:"";
    cells+=`<div class="cell${cls}" ${bg} title="วันที่ ${d} · ${n} ชิ้น">${n>1?`<em>${n}</em>`:""}</div>`;
  }
  return `<div class="spRow" style="border-top:2px dashed var(--line);margin-top:8px;padding-top:12px">
    <div class="lbl"><b>ต่อเวลา ⏱</b><span>วันที่ ${SPRINT_DAYS_TOTAL+1}–${TOTAL}</span></div>
    <div class="days" style="flex:0 0 auto">${cells}</div>
    <div class="sc">${tot} ชิ้น</div></div>`;
}

/* ================= PROFILE ================= */
async function openProfile(name){
  const r=S.runners.find(x=>x.name===name); if(!r) return;
  $("pMap").innerHTML=`<div class="noJoin">กำลังโหลด…</div>`;
  $("modal").classList.add("on");
  const s=stats(r), h=houseOf(r.house);
  const rank=ranked().findIndex(x=>x.name===name)+1;
  $("mSprite").innerHTML=runnerBox(r.color,3,s.style);
  $("mName").innerHTML=`<span style="color:${r.color}">${r.name}</span>
    <span style="font-family:var(--f-th);font-size:12px;color:var(--dim)"> ${r.handle}</span>`;
  $("mRank").textContent=`${h.emoji} ${h.name} · อันดับ ${rank} จาก ${students().length} · ลงไว้ ${r.joined.length}/${NSP} สปรินต์`;
  $("mStats").innerHTML=[
    ["CONTENTS", s.contents],["สัปดาห์นี้", s.weekTarget?`${s.weekDone}/${s.weekTarget}`:"—"],
    ["STREAK 🔥", s.weekStreak+" สัปดาห์"],["ห่างจากเป้า", (s.pace>0?"+":"")+s.pace]
  ].map(([l,v])=>`<div class="statBox"><b>${v}</b><span>${l}</span></div>`).join("");
  let det={byDay:{},recent:[]};
  try{ det=await DB.detail(r); }catch(e){ console.error(e); }
  $("pMap").innerHTML=mapHTML(r, det.byDay);
  $("mFeed").innerHTML=det.recent.slice(0,12)
    .map(f=>`<li><span class="plat">${f.plat}</span>
      <a href="${f.url}" target="_blank" rel="noopener">${f.url}</a>
      <span class="when">${ago(f.ts)}</span></li>`).join("") || `<li style="color:var(--dim)">ยังไม่มีงาน</li>`;
}

/* ================= STATUS CARD ================= */
function drawSpriteCanvas(ctx, x, y, px, color, style){
  const pal=palette(color,style);
  const put=(rows,yOff)=>rows.forEach((row,ry)=>[...row.padEnd(16,".")].slice(0,16).forEach((ch,cx)=>{
    if(!pal[ch]) return;
    ctx.fillStyle=pal[ch];
    ctx.fillRect(x+cx*px, y+(ry+yOff)*px, px, px);
  }));
  if(style==="flame"){
    const g=ctx.createRadialGradient(x+8*px, y+20*px, 2*px, x+8*px, y+18*px, 15*px);
    g.addColorStop(0,"rgba(255,220,90,.95)"); g.addColorStop(.4,"rgba(255,140,20,.6)");
    g.addColorStop(.7,"rgba(255,70,10,.25)"); g.addColorStop(1,"rgba(255,70,10,0)");
    ctx.fillStyle=g; ctx.fillRect(x-8*px, y-6*px, 32*px, 34*px);
  }
  put(style==="burnout" ? HEAD_SKULL : HEAD, 0); put(TORSO,10); put(LEGS.b,17);
  if(style==="red"){
    ctx.fillStyle="#ff2020"; ctx.fillRect(x+10*px, y+6*px, 6*px, px);
    ctx.fillStyle="#fff2f2"; ctx.fillRect(x+10*px, y+6*px, 3*px, px);
  }
}
function drawCard(){
  const cv=$("shareCanvas"), ctx=cv.getContext("2d");
  const r=meR(); if(!r) return;
  const s=stats(r), h=houseOf(r.house);
  const W=cv.width, H=cv.height;
  ctx.imageSmoothingEnabled=false;

  const bg=ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,"#150f3a"); bg.addColorStop(.45,"#2d1f6b");
  bg.addColorStop(.8,"#4a2a72"); bg.addColorStop(1,"#0a0820");
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

  const glow=ctx.createRadialGradient(W/2,H*.42,40,W/2,H*.42,W*.62);
  glow.addColorStop(0,h.color+"55"); glow.addColorStop(1,"transparent");
  ctx.fillStyle=glow; ctx.fillRect(0,0,W,H);

  ctx.globalAlpha=.14; ctx.fillStyle="#000";
  for(let y=0;y<H;y+=6) ctx.fillRect(0,y,W,2);
  ctx.globalAlpha=1;

  ctx.textAlign="center";
  ctx.font="700 40px 'Pixelify Sans', monospace";
  ctx.fillStyle="#cdc7ff"; ctx.fillText(C.TITLE, W/2, 92);
  ctx.font="500 30px 'IBM Plex Sans Thai', sans-serif";
  ctx.fillStyle="#9a92d8";
  ctx.fillText(`สัปดาห์ที่ ${curWeek()} จาก ${WEEKS} · วันที่ ${S.today}`, W/2, 142);

  const px=22, sw=16*px;
  drawSpriteCanvas(ctx, (W-sw)/2, 200, px, r.color, s.style);

  ctx.font="700 84px 'Pixelify Sans', monospace";
  ctx.fillStyle="#fff"; ctx.shadowColor="#000"; ctx.shadowOffsetY=6;
  ctx.fillText(r.name, W/2, 850);
  ctx.shadowOffsetY=0;
  ctx.font="500 32px 'IBM Plex Sans Thai', sans-serif";
  ctx.fillStyle=h.color;
  ctx.fillText(`${h.emoji} ${h.name} · ${r.handle}`, W/2, 900);

  ctx.font="700 190px 'Pixelify Sans', monospace";
  ctx.fillStyle=s.style==="flame"?"#ffc24d":s.style==="red"?"#ff6b85":"#ffcc4d";
  ctx.shadowColor=ctx.fillStyle; ctx.shadowBlur=40;
  ctx.fillText(String(s.contents), W/2, 1075);
  ctx.shadowBlur=0;
  ctx.font="700 40px 'Pixelify Sans', monospace";
  ctx.fillStyle="#e6e1ff";
  ctx.fillText(s.contents>=FINISH ? `🏆 ครบ ${FINISH} ชิ้นแล้ว` : `CONTENTS · เป้า ${FINISH} ชิ้น`, W/2, 1125);

  const boxes=[
    ["สัปดาห์นี้", s.weekTarget?`${s.weekDone}/${s.weekTarget}`:"—"],
    ["STREAK", `${s.weekStreak} สัปดาห์`],
    ["ห่างจากเป้า", `${s.pace>0?"+":""}${s.pace}`]
  ];
  const bw=300, gap=20, x0=(W-(bw*3+gap*2))/2;
  boxes.forEach(([l,v],i)=>{
    const x=x0+i*(bw+gap), y=1170;
    ctx.fillStyle="rgba(13,10,34,.72)"; ctx.fillRect(x,y,bw,110);
    ctx.strokeStyle=h.color+"88"; ctx.lineWidth=3; ctx.strokeRect(x,y,bw,110);
    ctx.font="700 52px 'Pixelify Sans', monospace"; ctx.fillStyle="#fff";
    ctx.fillText(String(v), x+bw/2, y+62);
    ctx.font="500 24px 'IBM Plex Sans Thai', sans-serif"; ctx.fillStyle="#a49ce0";
    ctx.fillText(l, x+bw/2, y+95);
  });

  if(s.style!=="normal"){
    const o=optOf(s.weekTarget);
    ctx.font="700 34px 'Pixelify Sans', monospace";
    ctx.fillStyle=s.style==="flame"?"#ffb020":"#ff4d6d";
    ctx.fillText(`${s.style==="flame"?"🔥":"🔴"} ${o.name} MODE`, W/2, 178);
  }
  ctx.font="500 24px 'IBM Plex Sans Thai', sans-serif";
  ctx.fillStyle="#6f68a8"; ctx.fillText("#CreatorBootcamp", W/2, H-34);
}
/* ================= จบรุ่น: ใบประกาศ ================= */
const finished = () => S.today > TOTAL;

function drawCert(){
  const cv=$("shareCanvas"), ctx=cv.getContext("2d");
  const r=meR(); if(!r) return;
  const s=stats(r), h=houseOf(r.house);
  const W=cv.width, H=cv.height;
  const hit = s.contents >= FINISH;
  ctx.imageSmoothingEnabled=false;

  /* พื้นหลังกระดาษเข้มไล่เฉด */
  const bg=ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,"#1a1340"); bg.addColorStop(.5,"#241a52"); bg.addColorStop(1,"#120d2e");
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

  const glow=ctx.createRadialGradient(W/2,H*.38,40,W/2,H*.38,W*.7);
  glow.addColorStop(0,(hit?"#ffcc4d":h.color)+"3a"); glow.addColorStop(1,"transparent");
  ctx.fillStyle=glow; ctx.fillRect(0,0,W,H);

  ctx.globalAlpha=.12; ctx.fillStyle="#000";
  for(let y=0;y<H;y+=6) ctx.fillRect(0,y,W,2);
  ctx.globalAlpha=1;

  /* กรอบแบบพิกเซลสองชั้น */
  const gold = hit ? "#ffcc4d" : h.color;
  ctx.strokeStyle=gold; ctx.lineWidth=8;  ctx.strokeRect(38,38,W-76,H-76);
  ctx.strokeStyle=gold+"66"; ctx.lineWidth=3; ctx.strokeRect(60,60,W-120,H-120);
  /* มุมทั้งสี่ */
  [[38,38,1,1],[W-38,38,-1,1],[38,H-38,1,-1],[W-38,H-38,-1,-1]].forEach(([x,y,dx,dy])=>{
    ctx.fillStyle=gold;
    ctx.fillRect(x, y, 46*dx, 14*dy);
    ctx.fillRect(x, y, 14*dx, 46*dy);
  });

  ctx.textAlign="center";
  ctx.font="700 34px 'Pixelify Sans', monospace";
  ctx.fillStyle="#cdc7ff";
  ctx.fillText("CERTIFICATE OF COMPLETION", W/2, 148);
  ctx.font="500 26px 'IBM Plex Sans Thai', sans-serif";
  ctx.fillStyle="#9a92d8";
  ctx.fillText("ใบรับรองการจบหลักสูตร", W/2, 190);

  ctx.font="700 40px 'Pixelify Sans', monospace";
  ctx.fillStyle=gold; ctx.shadowColor=gold; ctx.shadowBlur=24;
  ctx.fillText(C.TITLE, W/2, 254);
  ctx.shadowBlur=0;

  const px=17, sw=16*px;
  drawSpriteCanvas(ctx,(W-sw)/2, 300, px, r.color, s.style);

  ctx.font="500 26px 'IBM Plex Sans Thai', sans-serif";
  ctx.fillStyle="#a49ce0";
  ctx.fillText("มอบให้แก่", W/2, 760);

  ctx.font="700 96px 'Pixelify Sans', monospace";
  ctx.fillStyle="#fff"; ctx.shadowColor="#000"; ctx.shadowOffsetY=6;
  ctx.fillText(r.name, W/2, 858);
  ctx.shadowOffsetY=0;

  ctx.font="500 28px 'IBM Plex Sans Thai', sans-serif";
  ctx.fillStyle=h.color;
  ctx.fillText(h.emoji+"  บ้าน "+h.name+" · "+h.th, W/2, 906);

  ctx.font="500 28px 'IBM Plex Sans Thai', sans-serif";
  ctx.fillStyle="#e6e1ff";
  ctx.fillText("ปล่อยคอนเทนต์รวมทั้งสิ้น", W/2, 976);

  ctx.font="700 150px 'Pixelify Sans', monospace";
  ctx.fillStyle=gold; ctx.shadowColor=gold; ctx.shadowBlur=36;
  ctx.fillText(String(s.contents), W/2, 1108);
  ctx.shadowBlur=0;
  ctx.font="500 28px 'IBM Plex Sans Thai', sans-serif";
  ctx.fillStyle="#e6e1ff";
  ctx.fillText("ชิ้น ตลอด "+TOTAL+" วันของหลักสูตร", W/2, 1152);

  /* ตราประทับเมื่อถึงเป้า */
  if(hit){
    ctx.save();
    ctx.translate(W-186, 1090); ctx.rotate(-.18);
    ctx.strokeStyle="#ffcc4d"; ctx.lineWidth=6;
    ctx.beginPath(); ctx.arc(0,0,78,0,Math.PI*2); ctx.stroke();
    ctx.strokeStyle="#ffcc4d88"; ctx.lineWidth=3;
    ctx.beginPath(); ctx.arc(0,0,64,0,Math.PI*2); ctx.stroke();
    ctx.fillStyle="#ffcc4d";
    ctx.font="700 46px 'Pixelify Sans', monospace"; ctx.fillText(String(FINISH), 0, 2);
    ctx.font="500 18px 'IBM Plex Sans Thai', sans-serif"; ctx.fillText("ครบเป้า", 0, 32);
    ctx.restore();
  }

  const rank=ranked().filter(x=>x.role!=="coach").findIndex(x=>x.name===r.name)+1;
  const total=S.runners.filter(x=>x.role!=="coach").length;
  ctx.font="500 24px 'IBM Plex Sans Thai', sans-serif";
  ctx.fillStyle="#a49ce0";
  ctx.fillText("อันดับ "+rank+" จาก "+total+" คน  ·  ทำได้ "+s.rate+"% ของเป้าที่ตัวเองรับไว้"
    + "  ·  streak สูงสุด "+s.weekStreak+" สัปดาห์", W/2, 1224);

  ctx.font="500 22px 'IBM Plex Sans Thai', sans-serif";
  ctx.fillStyle="#6f68a8";
  ctx.fillText("#CreatorBootcamp", W/2, 1284);
}

function certText(){
  const r=meR(), s=stats(r), h=houseOf(r.house);
  const hit = s.contents>=FINISH;
  return "จบแล้ว " + TOTAL + " วัน 🎓\n"
    + "ปล่อยคอนเทนต์ไปทั้งหมด " + s.contents + " ชิ้น" + (hit ? " — ครบเป้า " + FINISH + " ชิ้น 🏆" : "") + "\n"
    + h.emoji + " บ้าน " + h.name + " · ทำได้ " + s.rate + "% ของเป้าที่รับไว้\n"
    + "#CreatorBootcamp";
}

function shareTextOf(){
  const r=meR(), s=stats(r), h=houseOf(r.house);
  const o=s.weekTarget?optOf(s.weekTarget):null;
  const fin = s.contents>=FINISH ? " 🏆 ครบเป้าแล้ว!" : ` จากเป้า ${FINISH}`;
  return `ปล่อยไปแล้ว ${s.contents} คอนเทนต์${fin} ใน ${C.TITLE} 🏁\n`
   + `${h.emoji} บ้าน ${h.name} · สัปดาห์ที่ ${curWeek()}/${WEEKS}\n`
   + (o?`สัปดาห์นี้รับเป้า ${o.name} ${o.target} ชิ้น — ทำไปแล้ว ${s.weekDone}\n`:"")
   + `streak ${s.weekStreak} สัปดาห์ 🔥\n#CreatorBootcamp`;
}
async function renderStatus(){
  const r=meR(); if(!r) return;
  document.fonts.ready.then(function(){ finished() ? drawCert() : drawCard(); });
  const s=stats(r), h=houseOf(r.house);
  const rank=ranked().findIndex(x=>x.name===r.name)+1;
  (finished() ? drawCert() : drawCard());
  $("shTitle").textContent = (finished() ? "🎓 ใบประกาศ · " : "") + r.name + " · " + h.emoji + " " + h.name;
  $("shSub").textContent=`อันดับ ${rank} จาก ${students().length} คน · ปล่อยไปแล้ว ${s.contents} จาก ${FINISH} ชิ้น ใน ${s.activeDays} วัน`
    + (s.contents>=FINISH ? ` · ถึงเส้นชัยแล้ว 🏆` : ` · เหลืออีก ${FINISH-s.contents}`);
  $("shStats").innerHTML=[
    [`CONTENTS / ${FINISH}`, s.contents],["วันที่ปล่อยงาน", s.activeDays],
    ["STREAK สัปดาห์", s.weekStreak],["ห่างจากเป้า", (s.pace>0?"+":"")+s.pace]
  ].map(([l,v])=>`<div class="statBox"><b>${v}</b><span>${l}</span></div>`).join("");
  $("shareText").value = finished() ? certText() : shareTextOf();
  $("mMap").innerHTML=`<div class="noJoin">กำลังโหลด…</div>`;
  try{ const det=await DB.detail(r); $("mMap").innerHTML=mapHTML(r, det.byDay); }
  catch(e){ console.error(e); $("mMap").innerHTML=`<div class="noJoin">โหลดแผนที่ไม่สำเร็จ</div>`; }
}
function canvasBlob(){
  return new Promise(res=>$("shareCanvas").toBlob(res,"image/png"));
}

/* ================= ADMIN (หัวหน้าโค้ช) ================= */
async function renderAdmin(){
  const demo = DB.mode==="demo";
  $("adNote").innerHTML = demo
    ? "โหมด DEMO — หน้านี้แสดงให้ดูหน้าตาเท่านั้น เพิ่มรายชื่อจริงไม่ได้ ต้องต่อ Supabase ก่อน"
    : "อีเมลที่เพิ่มตรงนี้คือประตูเข้าระบบ ใครไม่มีชื่อจะสมัครไม่ได้ และหนึ่งอีเมลสมัครได้ครั้งเดียว";
  $("adHouse").innerHTML = HOUSES.map(h=>
    '<option value="'+h.id+'">'+h.emoji+' '+h.name+' · '+h.th+'</option>').join("");

  let roster=[];
  try{ roster=await DB.rosterList(); }
  catch(e){ $("adNote").innerHTML += '<br><span style="color:var(--red)">อ่านรายชื่อไม่ได้: '+e.message+'</span>'; }

  $("adHouses").innerHTML = HOUSES.map(h=>{
    const rows=roster.filter(r=>r.house_id===h.id);
    const joined=rows.filter(r=>r.claimed_by).length;
    return '<div class="houseCard" style="border-color:'+h.color+' '+shift(h.color,-110)+' '+shift(h.color,-110)+' '+h.color+'">'
      + '<div class="hr">'+h.emoji+'</div>'
      + '<div class="hn" style="color:'+h.color+'">'+h.name+'</div>'
      + '<div class="hth">'+h.th+'</div>'
      + '<div class="hv">'+joined+'<span style="font-size:18px;color:var(--dim)">/'+rows.length+'</span></div>'
      + '<div class="hl">สมัครแล้ว / มีชื่อทั้งหมด</div></div>';
  }).join("");

  const un=roster.filter(r=>!r.claimed_by);
  $("adUnclaimed").innerHTML = un.length ? un.map((r,i)=>{
    const h=houseOf(r.house_id);
    return '<tr><td class="rk">'+String(i+1).padStart(2,"0")+'</td>'
      + '<td style="font-family:var(--f-th)">'+r.email+'</td>'
      + '<td style="font-family:var(--f-th);color:var(--dim)">'+(r.full_name||"—")+'</td>'
      + '<td><span class="hs">'+h.emoji+'</span> <span style="color:'+h.color+';font-size:12px">'+h.name+'</span></td></tr>';
  }).join("") : '<tr><td colspan="4" style="text-align:center;color:var(--dim);padding:24px">ทุกคนสมัครครบแล้ว 🎉</td></tr>';

  const behind=ranked().filter(r=>r.role!=="coach" && stats(r).pace<-5);
  $("adBehind").innerHTML = behind.length ? behind.map((r,i)=>{
    const s=stats(r), h=houseOf(r.house);
    const last=[...S.subs].filter(f=>f.who===r.name).sort((a,b)=>b.ts-a.ts)[0];
    return '<tr data-n="'+r.name+'"><td class="rk">'+String(i+1).padStart(2,"0")+'</td>'
      + '<td class="nm" style="color:'+r.color+'">'+r.name+'</td>'
      + '<td><span class="hs">'+h.emoji+'</span></td>'
      + '<td class="num">'+s.contents+'</td>'
      + '<td class="num" style="color:var(--dim)">'+s.target+'</td>'
      + '<td class="num" style="color:var(--orange)">'+s.pace+'</td>'
      + '<td class="hideSm" style="color:var(--dim);font-size:12px">'+(last?ago(last.ts):"ยังไม่เคยส่ง")+'</td></tr>';
  }).join("") : '<tr><td colspan="7" style="text-align:center;color:var(--dim);padding:24px">ไม่มีใครตามหลังเกิน 5 ชิ้น 👏</td></tr>';
}

/* ================= HUD ================= */
function renderHud(){
  const r=meR(); if(!r) return;
  const h=houseOf(r.house), s=stats(r);
  $("hudWeek").textContent=curWeek();
  $("hudWeeks").textContent=WEEKS;
  $("hudSprint").textContent = inOvertime() ? "ต่อเวลา" : (curSp()+1);
  $("hudSprints").textContent=NSP;
  $("hudDay").textContent=S.today;
  $("hudTotal").textContent=TOTAL;
  $("hudClock").textContent=cutoffLeft();
  $("meLine").innerHTML=`${h.emoji} <span style="color:${h.color}">${h.name}</span> ·
    ${r.name} · ปล่อยแล้ว <b style="color:${r.color}">${s.contents}</b> คอนเทนต์ ·
    คลิกที่เลนหรือแถวเพื่อดูโปรไฟล์`;
  $("who").textContent=r.name;
  /* ปิดปุ่มส่งงานเมื่อรุ่นยังไม่เปิด จบแล้ว หรือไม่ได้ลงสปรินต์ปัจจุบัน
     เซิร์ฟเวอร์กันอยู่แล้ว แต่บอกล่วงหน้าดีกว่าปล่อยให้กดแล้วเด้ง error */
  const joinedNow = inOvertime() ? r.joined.length > 0 : joinedIn(r, curSp());
  const blocked = !S.started ? "▶ รุ่นยังไม่เปิด"
                : finished()  ? "▶ จบหลักสูตรแล้ว"
                : !joinedNow  ? "▶ ไม่ได้ลงสปรินต์นี้" : null;
  $("pushBtn").disabled = !!blocked;
  $("pushBtn").textContent = blocked || "▶ SUBMIT";
  $("simBtn").style.display = DB.canSim?"":"none";
  $("adminNav").style.display = (DB.mode==="demo" || r.role==="coach") ? "" : "none";
  $("outBtn").textContent = DB.mode==="live"?"SIGN OUT":"RESET DEMO";
  $("modeTag").textContent = DB.mode==="live"?"LIVE":"DEMO MODE";
  $("modeTag").className = "chip "+(DB.mode==="live"?"live":"warnChip");
}
function renderAll(){
  renderFilters(); renderPledge(); renderTrack(); renderFeed(); renderHud();
  if($("pgBoard").classList.contains("on")) renderBoard();
  if($("pgStatus").classList.contains("on")) renderStatus();
}

/* ================= ONBOARDING ================= */
let pickColor=COLORS[0], pickPledge=7;
const ALL_SPRINTS = SPRINTS.map((_,i)=>i);   // ทุกคนลงครบทุกสปรินต์อัตโนมัติ
function drawSelect(){
  $("swatches").innerHTML=COLORS.map(c=>
    `<button class="sw ${c===pickColor?"sel":""}" data-c="${c}"
      style="background:linear-gradient(180deg,${shift(c,40)},${c} 55%,${shift(c,-50)})"></button>`).join("");
  $("myPreview").innerHTML=runnerBox(pickColor,4);
  $("myLabel").textContent=$("myName").value.trim().toUpperCase()||"RUNNER";
  $("myEmailLbl").textContent=(BOOTSTATE&&BOOTSTATE.email)||"เข้าสู่ระบบแล้ว";
}
/* ================= PLEDGE PICKER ================= */
function drawPledgePick(){
  const cw=curWeek(), me=meR(), cur=(me.pledges||{})[cw];
  const HIDE = C.HIDE_LOCKED_PLEDGES !== false;
  /* ซ่อนตัวเลือกที่ยังไม่ถึงสัปดาห์ปลดล็อก — เก็บไว้เป็นเซอร์ไพรส์
     แต่ถ้าเคยรับไว้แล้วต้องยังเห็นอยู่ ไม่งั้นการ์ดจะหาย */
  const burnt = stats(me).burnout;
  const visible = PLEDGES.filter(o =>
    (!HIDE || cw >= o.unlockWeek || o.target === cur) && (!burnt || o.target < HEAVY));
  $("plPick").innerHTML=visible.map(o=>{
    const locked = cw<o.unlockWeek ? "locked" : (cur && o.target<cur ? "locked" : "");
    const note = cw<o.unlockWeek ? `ปลดล็อกสัปดาห์ที่ ${o.unlockWeek}`
               : (cur && o.target<cur ? "ลดเป้ากลางสัปดาห์ไม่ได้" : "");
    return `<button class="optCard plCard ${o.style} ${pickPledge===o.target?"on":""} ${locked}"
      data-t="${o.target}" ${locked?"disabled":""}>
      <div class="tick">${pickPledge===o.target?"[✓]":"[  ]"}</div>
      <div class="opChar">${o.style==="flame"?aura():""}${sprite(me.color,2,o.style)}</div>
      <div class="no">${o.target} ชิ้น</div>
      <div class="nm">${o.name}</div>
      <div class="th">${o.th}</div>
      <div class="wk">${o.style==="red"?"🔴 ตัวละครเป็นสีแดงทั้งสัปดาห์"
        : o.style==="flame"?"🔥 ตัวละครติดไฟ โหมดซูเปอร์ไซย่า"
        : "เฉลี่ย "+(o.target/7).toFixed(1)+" ชิ้นต่อวัน"}</div>
      ${note?`<div class="lockTag">${note}</div>`:""}</button>`;
  }).join("");
  const o=optOf(pickPledge);
  $("plNote").innerHTML = burnt
    ? `<b style="color:#ff8fa3">💀 หมดแรง</b> — สัปดาห์ที่แล้วรับเป้าหนักไว้แล้วทำไม่ถึง<br>` +
      `<span style="color:var(--dim)">สัปดาห์นี้เลือกได้แค่ต่ำกว่า ${HEAVY} ชิ้น ตัวละครจะเป็นร่างกระโหลกจนจบสัปดาห์<br>` +
      `ทำให้ครบแล้วสัปดาห์หน้ากลับมาเลือกเป้าหนักได้เหมือนเดิม</span>`
    : `เลือก <b>${o.target}</b> ชิ้นในสัปดาห์นี้ = เฉลี่ยวันละ ${(o.target/7).toFixed(1)} ชิ้น` +
      `<br><span style="color:var(--dim)">รับแล้วเพิ่มได้ตลอด แต่ลดไม่ได้จนกว่าจะขึ้นสัปดาห์ใหม่</span>`;
}
function openPledge(){
  const cw=curWeek(), cur=(meR().pledges||{})[cw];
  pickPledge = cur || 7;
  $("plTitle").textContent = stats(meR()).burnout
    ? `💀 หมดแรง · เป้าของสัปดาห์ที่ ${cw}` : `เป้าของสัปดาห์ที่ ${cw}`;
  $("plLede").innerHTML = cur
    ? `ตอนนี้รับไว้ที่ <b style="color:var(--gold)">${cur} ชิ้น</b> — เพิ่มได้ ลดไม่ได้`
    : `สัปดาห์นี้จะปล่อยกี่ชิ้น เลือกเองได้ตามความพร้อม ไม่มีถูกผิด แต่เลือกแล้วต้องทำ`;
  drawPledgePick();
  $("pledgeModal").classList.add("on");
}
window.openPledge=openPledge;

/* ================= EVENTS ================= */
$("swatches").onclick=e=>{ const b=e.target.closest(".sw"); if(b){ pickColor=b.dataset.c; drawSelect(); } };
$("myName").oninput=drawSelect;
$("plPick").onclick=e=>{
  const b=e.target.closest(".optCard"); if(!b||b.disabled) return;
  pickPledge=+b.dataset.t; drawPledgePick();
};
$("startBtn").onclick=()=>{ drawSelect(); show(BOOTSTATE&&BOOTSTATE.needsAuth?"scAuth":"scSelect"); };
$("authBtn").onclick=async()=>{
  const em=$("email").value.trim();
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return toast("ใส่อีเมลให้ถูกก่อน");
  $("authBtn").disabled=true;
  try{ await DB.signIn(em); $("authNote").textContent="ส่งลิงก์เข้าอีเมลแล้ว — เปิดอีเมลแล้วกดลิงก์"; }
  catch(err){ toast(err.message); $("authBtn").disabled=false; }
};
$("joinBtn").onclick=async()=>{
  const nm=$("myName").value.trim();
  if(!nm) return toast("ใส่ชื่อก่อน");
  $("joinBtn").disabled=true;
  try{
    /* handle ไม่ต้องกรอกแล้ว ฐานข้อมูลเติมให้จากอีเมลที่ล็อกอิน */
    await DB.createProfile({name:nm.toUpperCase().slice(0,10),
      color:pickColor, joined:ALL_SPRINTS, house:1+((Date.now())%4)});
    await boot();
  }catch(err){ toast(err.message); $("joinBtn").disabled=false; }
};
document.querySelector(".nav").onclick=e=>{
  const b=e.target.closest(".navBtn"); if(b) showPage(b.dataset.page);
};
$("raceFilters").onclick=e=>{ const b=e.target.closest(".fBtn"); if(b){ S.raceFilter=b.dataset.f; renderFilters(); renderTrack(); } };
$("boardFilters").onclick=e=>{ const b=e.target.closest(".fBtn"); if(b){ S.boardFilter=b.dataset.f; renderFilters(); renderBoard(); } };
$("lanes").onclick=e=>{ const l=e.target.closest(".lane"); if(l) openProfile(l.dataset.n); };
$("board").onclick=e=>{ const t=e.target.closest("tr[data-n]"); if(t) openProfile(t.dataset.n); };
$("adUpload").onclick=async()=>{
  const raw=$("adEmails").value.split(/[\n\r]+/).map(x=>x.trim()).filter(Boolean);
  const house=+$("adHouse").value;
  const rows=[], bad=[];
  raw.forEach(line=>{
    const parts=line.split(",").map(x=>x.trim());
    const em=parts[0];
    if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)){ bad.push(line); return; }
    rows.push({email:em.toLowerCase(), house_id:house, full_name:parts.slice(1).join(", ")||null});
  });
  if(!rows.length) return toast("ไม่มีอีเมลที่ใช้ได้");
  $("adUpload").disabled=true;
  try{
    await DB.rosterAdd(rows);
    $("adResult").innerHTML = "เพิ่มแล้ว <b>"+rows.length+"</b> อีเมล เข้าห้อง "+houseOf(house).name
      + (bad.length ? '<br><span style="color:var(--red)">ข้าม '+bad.length+' บรรทัดที่ไม่ใช่อีเมล</span>' : "");
    $("adEmails").value="";
    await renderAdmin();
    toast("เพิ่ม "+rows.length+" อีเมลแล้ว");
  }catch(e){
    $("adResult").innerHTML = '<span style="color:var(--red)">'+e.message+'</span>';
    toast(e.message);
  }
  $("adUpload").disabled=false;
};
$("adBehind").onclick=e=>{ const t=e.target.closest("tr[data-n]"); if(t) openProfile(t.dataset.n); };
$("jumpMe").onclick=()=>{
  const el=$("row-"+S.me);
  if(el) el.scrollIntoView({block:"center",behavior:"smooth"});
};
document.querySelectorAll("[data-close]").forEach(b=> b.onclick=()=>b.closest(".modal").classList.remove("on"));
document.querySelectorAll(".modal").forEach(m=> m.onclick=e=>{ if(e.target===m) m.classList.remove("on"); });
document.addEventListener("keydown",e=>{ if(e.key==="Escape") document.querySelectorAll(".modal").forEach(m=>m.classList.remove("on")); });

$("pushBtn").onclick=async()=>{
  const url=$("url").value.trim();
  if(!/^https?:\/\/.+\..+/.test(url)) return toast("ใส่ลิงก์ให้ถูก<br>ต้องขึ้นต้นด้วย http(s)://");
  const before=stats(meR());
  $("pushBtn").disabled=true;
  try{
    await DB.submit({url, platform:$("plat").value});
    $("url").value="";
    S.postedToday=true;
    await refresh();
    const after=stats(meR());
    const o=after.weekTarget?optOf(after.weekTarget):null;
    let msg=`+1 CONTENT · รวม ${after.contents} ชิ้น`;
    if(o && before.weekDone<o.target && after.weekDone>=o.target)
      msg=`ครบเป้าสัปดาห์นี้แล้ว! 🎉<br>${o.name} ${o.target}/${o.target}`;
    else if(o) msg=`+1 CONTENT · สัปดาห์นี้ ${after.weekDone}/${o.target}`;
    toast(msg);
  }catch(err){ toast(err.message); }
  $("pushBtn").disabled=false;
};
$("pledgeBtn").onclick=openPledge;
$("plSave").onclick=async()=>{
  $("plSave").disabled=true;
  try{
    await DB.setPledge(curWeek(), pickPledge);
    await refresh();
    $("pledgeModal").classList.remove("on");
    const o=optOf(pickPledge);
    toast(o.style==="flame" ? `🔥 ${o.name}<br>ตัวละครติดไฟแล้ว`
        : o.style==="red" ? `🔴 ${o.name}<br>ตัวละครเป็นสีแดงสัปดาห์นี้`
        : `รับเป้า ${o.target} ชิ้นแล้ว`);
  }catch(err){ toast(err.message); }
  $("plSave").disabled=false;
};
$("simBtn").onclick=async()=>{
  try{
    const r=DB.simulateDay(); await refresh();
    toast(r.weekChanged?`ขึ้นสัปดาห์ที่ ${r.week} แล้ว<br>อย่าลืมเลือกเป้าใหม่`
                       :`วันที่ ${r.day} · มี ${r.n} ชิ้นเข้ามา`);
    if(r.weekChanged && !(meR().pledges||{})[curWeek()]) openPledge();
  }catch(err){ toast(err.message); }
};
$("outBtn").onclick=async()=>{ await DB.signOut(); location.reload(); };

/* ---- share ---- */
$("shDownload").onclick=async()=>{
  const b=await canvasBlob();
  const a=document.createElement("a");
  a.href=URL.createObjectURL(b);
  a.download=`${meR().name}-bootcamp-${stats(meR()).contents}.png`;
  a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),3000);
  toast("ดาวน์โหลดแล้ว");
};
$("shCopy").onclick=async()=>{
  try{ await navigator.clipboard.writeText($("shareText").value); toast("คัดลอกข้อความแล้ว"); }
  catch(e){ $("shareText").select(); toast("กด Ctrl+C เพื่อคัดลอก"); }
};
$("shShare").onclick=async()=>{
  const text=$("shareText").value;
  try{
    const b=await canvasBlob();
    const file=new File([b], "bootcamp.png", {type:"image/png"});
    if(navigator.canShare && navigator.canShare({files:[file]})){
      await navigator.share({files:[file], text});
    } else if(navigator.share){
      await navigator.share({text});
    } else {
      await navigator.clipboard.writeText(text);
      toast("เครื่องนี้ไม่รองรับเมนูแชร์<br>คัดลอกข้อความให้แล้ว");
    }
  }catch(e){ if(e.name!=="AbortError") toast("แชร์ไม่สำเร็จ ลองดาวน์โหลดรูปแทน"); }
};

/* ================= BOOT ================= */
async function refresh(){
  const d=await DB.fetchAll();
  S.today=d.today; S.me=d.me; S.runners=d.runners; S.subs=d.subs; S.postedToday=!!d.postedToday;
  S.started = d.started !== false; S.daysUntil = d.daysUntil||0; S.startDate = d.startDate||null;
  if(DB.mode==="demo") S.runners.forEach(r=>{ r.st=computeStats(r); });
  renderAll();
}
async function boot(){
  const st=BOOTSTATE=await DB.init();
  if(st.needsAuth||st.needsProfile){
    drawSelect();
    if(st.email){ $("authWho").textContent=st.email; }
    show("scTitle");
    return;
  }
  await refresh();
  DB.subscribe(()=>refresh());
  show("scArena");
  if(!(meR().pledges||{})[curWeek()]) setTimeout(openPledge, 400);
}

/* ---- static bits ---- */
$("sky").insertAdjacentHTML("beforeend",
  [[9,26,"18s"],[46,14,"26s"],[74,32,"21s"],[24,44,"32s"]].map(([l,t,d])=>
    `<div class="cloud" style="left:${l}%;top:${t}%;width:${34+l%20}px;animation-duration:${d};animation-delay:-${l/4}s"></div>`).join(""));
$("parade").innerHTML=["normal","normal","red","normal","flame"].map((stl,i)=>
  `<div style="animation-duration:${7+i*1.7}s;animation-delay:-${i*2.3}s">${runnerBox(COLORS[i],2,stl)}</div>`).join("");
$("bcTitle").textContent=C.TITLE;
$("bcTitle2").textContent=C.TITLE;
document.title=C.TITLE;
$("plat").innerHTML=PLATS.map(p=>`<option>${p}</option>`).join("");
$("titleSub").innerHTML=`${TOTAL} วัน · ${NSP} สปรินต์ · เลือกเป้าเองทุกสัปดาห์<br>
  4 / 7 / 10 ชิ้นต่อสัปดาห์ ตามที่ไหว<br>
  เป้ารวม ${FINISH} คอนเทนต์ — ส่งเกินได้ ไม่มีเพดาน<br>
  ส่งลิงก์แล้วนับทันที ตัวละครวิ่งเลย`;
$("foot").innerHTML = LIVE
  ? "ข้อมูลจริงบน Supabase · เห็นตรงกันทุกเครื่องแบบเรียลไทม์"
  : "โหมด DEMO — ข้อมูลปลอมในเบราว์เซอร์นี้เท่านั้น ใส่คีย์ใน config.js เพื่อใช้งานจริง";
if(LIVE && C.GOOGLE_AUTH){
  $("googleBtn").style.display="";
  $("googleBtn").onclick=async()=>{ try{ await DB.signInGoogle(); }catch(e){ toast(e.message); } };
}
setInterval(()=>{ if($("scArena").classList.contains("on")) $("hudClock").textContent=cutoffLeft(); },1000);
setInterval(()=>{ if($("pgRace").classList.contains("on")) renderFeed(); },60000);

boot().catch(err=>{ console.error(err); show("scTitle"); toast("เชื่อมต่อไม่ได้<br>"+err.message); });
