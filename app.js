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
const DEL_MS  = 30*60e3;                     // ลบงานของตัวเองได้ภายในกี่มิลลิวินาทีหลังส่ง (ต้องตรงกับ policy ใน migration 047)
const HEAVY   = C.HEAVY_TARGET || 10;      // รับเป้าตั้งแต่เท่านี้ขึ้นไปแล้วทำไม่ถึง = หมดแรงสัปดาห์ถัดไป
const WEEKS   = Math.round((SPD * NSP) / 7);
const FINISH  = C.GOAL_TOTAL || 7 * WEEKS; // เส้นชัย = ปล่อยครบกี่ชิ้น (ส่งเกินได้)
const NEAR    = C.NEAR_RANGE || 3;
const KIND_ICON={short:"🎬",long:"🎥",image:"🖼",article:"📝",live:"🔴",other:"✨"};
const KIND_TH={short:"คลิปสั้น",long:"คลิปยาว",image:"รูป",article:"บทความ",live:"ไลฟ์",other:"อื่น ๆ"};
const kindOpts=(v)=>`<option value="">—</option>`+Object.keys(KIND_ICON).map(k=>`<option value="${k}" ${k===v?"selected":""}>${KIND_ICON[k]} ${KIND_TH[k]}</option>`).join("");
const fmtN=n=>n>=1e6?(n/1e6).toFixed(1)+"M":n>=1e3?(n/1e3).toFixed(n>=1e4?0:1)+"K":String(n);
const TAG     = C.HASHTAG || "#CreatorBootcamp";
const CREDIT  = C.CREDIT  || "";
const LIVE    = !!(C.SUPABASE_URL && C.SUPABASE_ANON_KEY) && !/[?&]demo\b/.test(location.search);  // ?demo = ลองในเครื่องด้วยข้อมูลปลอม
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
/* ตัวละครประกอบจากชั้น: ร่างพื้นฐาน → เสื้อ → กางเกง → ผม → หน้า → แว่น → หมวก
   ตาราง 16 กว้าง x 28 สูง — 4 แถวบนเป็นพื้นที่ว่างให้หมวกสูง/ผมตั้ง/ผมฟู
   พิกัดในโค้ดใช้ระบบเดิม (หัวเริ่มแถว 0) แถวติดลบ = พื้นที่เหนือหัว
   SVG บนสนามกับ canvas ในการ์ดแชร์ใช้ตารางเดียวกัน หน้าตาเลยตรงกันเป๊ะ */
const HR=4, ROWS=24+HR;
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

/* ---- ตัวเลือกในห้องแต่งตัว (เก็บเป็น index ลง profiles.avatar) ---- */
const AV = {
  gender:["ชาย","หญิง"],
  skin:[["#ffe3cc","#e6b898"],["#ffd2a8","#d99a6c"],["#e8b482","#c48752"],["#c98a5b","#9c6236"],["#8f5a3c","#66391f"],["#5c3520","#3c2010"]],
  hair:["สั้น","ตั้งแหลม","ยาว","บ๊อบ","โล้น","หางม้า","มวยบนหัว","โมฮอว์ก","แอฟโฟร"],
  hairColor:[["#1d1b26","#3b3850"],["#2e1c14","#5a3a22"],["#e2bd3f","#fff0a0"],["#c1442a","#ea7a55"],["#2d6cdf","#6aa2ff"],["#ff6fb5","#ffb3d9"],["#d6d6e6","#f6f6ff"],["#3fbf6a","#8ff0aa"]],
  glasses:["ไม่ใส่","กลมทอง","เหลี่ยมดำ","กันแดด","กรอบขาวหนา","แว่นหัวใจ ♀","วิเซอร์ไซเบอร์ ♂"],
  top:["เสื้อยืด","ฮู้ด","แจ็กเก็ต","เสื้อกล้าม","เดรส","สูทผูกไท","เชิ้ตขาว",
       "เสื้อครอป ♀","แจ็กเก็ตหนัง ♂","เกราะเงิน ♂","เดรสราตรี ♀","เกราะทอง ♂","ปีกนางฟ้า ♀","ผ้าคลุมฮีโร่ ♂"],
  pants:["ขายาว","ขาสั้น","กระโปรง"],
  pantsColor:[["#3450a8","#22357a"],["#2a2a35","#15151c"],["#b89a62","#8a6f3f"],["#c0392b","#7d2419"],["#e6e6f0","#b0b0c0"],["#3f7a4a","#26512f"],["#6a3fb5","#472a7a"]],
  hat:["ไม่ใส่","แก๊ป","ไหมพรม","มงกุฎ","ผ้าคาดหัว","หมวกทรงสูง","คาวบอย","หมวกพ่อมด",
       "เบเร่ต์ ♀","หมวกฟาง ♀","แก๊ปกลับหลัง ♂","โบว์ใหญ่ ♀","หูแมว ♀","หมวกไวกิ้ง ♂","ทิอาร่าเพชร ♀","มงกุฎราชา ♂","รัศมีนางฟ้า",
       "💩 อึบนหัว","หัวล้านเงา","ป้าย LOSER","หมวกโง่","ป้าย WINNER"],
  mouth:["ยิ้ม","เฉย","อ้าปาก","ยิงฟัน","หนวด","หนวดเครา"],
  nose:["ไม่มี","จุด","โต"]
};
const HAT_COL=[["#000","#000"],["#d63031","#8f1f21"],["#7d5fff","#4c36a8"],["#ffcc4d","#c98a12"],["#e0202a","#8f1f21"],["#1a1a22","#3a3a48"],["#c8955a","#8a6238"],["#5b3fd1","#3a2790"],
  ["#b3213a","#7a1428"],["#e8c872","#b89a42"],["#2d6cdf","#1d47a0"],["#ff6fb5","#c23a82"],["#c9895a","#8a5a35"],["#8a8a95","#5a5a66"],["#9fd8ff","#5aa8e0"],["#ffcc4d","#c98a12"],["#fff3a0","#ffd23a"],
  ["#7a4a24","#4e2d12"],["#000","#000"],["#f6f6ff","#c9c4dd"],["#f6f6ff","#c9c4dd"],["#ffcc4d","#c98a12"]];
/* หมวกจากการดวล — เลือกในห้องแต่งตัวไม่ได้ ผู้ชนะเลือกให้ผู้แพ้ใส่ 7 วัน ส่วนผู้ชนะได้ป้าย WINNER อัตโนมัติ */
const PRIZE_PICK = [17,18,19,20];
const WINNER_HAT = 21;
const PRIZE_HATS = new Set([...PRIZE_PICK, WINNER_HAT]);
const SIGN_TEXT  = {19:["LOSER","#e0202a"], 21:["WINNER","#3a1a05"]};
const DEF_AV={g:0,sk:1,hr:0,hc:1,gl:0,top:0,pt:0,pc:0,hat:0,mo:0,no:1};
const AV_KEYS=Object.keys(DEF_AV);
/* หน้าตาของ runner — คนที่ยังไม่เคยแต่งได้ค่าเริ่มต้น + สีชุดที่เลือกไว้ */
/* มงกุฎไม่ใช่สกินที่เลือกเองได้ — ใส่ได้เฉพาะ King of the Week (ที่ 1 ของบ้านในสัปดาห์นี้) */
const CROWN_HATS = new Set([3,14,15]);
const KING_HAT   = 15;
const isKingNow  = r => !!(r && S.kingsNow && S.kingsNow.has(r.id));
const avOf = r => {
  const av=Object.assign({}, DEF_AV), src=(r&&r.avatar)||{};
  AV_KEYS.forEach(k=>{ if(Number.isInteger(src[k])) av[k]=src[k]; });
  if(CROWN_HATS.has(av.hat) || PRIZE_HATS.has(av.hat)) av.hat=0;
  const dh = (typeof duelHatOf==="function") ? duelHatOf(r) : null;   // แพ้ดวล → ใส่หมวกที่ผู้ชนะเลือก 7 วัน
  if(dh!=null) av.hat=dh;
  if(isKingNow(r)) av.hat=KING_HAT;
  const ad = r && (typeof duelOf==="function") ? duelOf(r.id) : null;      // กำลังดวล → ถือดาบ
  av.sword = !!(ad && ad.status==="active");
  av.color=(r&&r.color)||COLORS[0];
  return av;
};
/* สุ่มหน้าตาแบบคงที่ตาม seed — ใช้กับขบวนหน้าแรกและข้อมูลปลอมในโหมด DEMO */
function randAv(seed){
  let s=(seed*9301+49297)%233280;
  const rnd=n=>{ s=(s*9301+49297)%233280; return Math.floor(s/233280*n); };
  const g=rnd(2);
  return {g, sk:rnd(6), hr:g?[2,3,5,6,8][rnd(5)]:[0,1,4,7,8][rnd(5)], hc:rnd(8), gl:rnd(3)===0?1+rnd(6):0,
    top:rnd(14), pt:g?rnd(3):rnd(2), pc:rnd(7), hat:rnd(2)===0?1+rnd(16):0, mo:g?rnd(4):rnd(6), no:rnd(3)};
}

function shift(hex,amt){
  const n=parseInt(hex.slice(1),16);
  const ch=i=>Math.max(0,Math.min(255,((n>>(16-8*i))&255)+amt));
  return "#"+[0,1,2].map(i=>ch(i).toString(16).padStart(2,"0")).join("");
}
/* จานสีตามโหมดของสัปดาห์: ปกติ / ฟ้า (7 ชิ้น) / แดง (LASER) / ไฟ (PRO MAX) / กระโหลก (หมดแรง)
   ตัวอักษร: O ขอบ  H/h ผม  S/s ผิว  E ตา  C/c/l ชุด  P/p กางเกง  B/b รองเท้า  K กระดูก
             F กรอบดำ  D เลนส์ดำ  M ปาก  R แดง  W ขาว  G ทอง  N กรมท่า(สูท)  A/a หมวก */
function palette(av, style){
  const skin=AV.skin[av.sk]||AV.skin[1], hc=AV.hairColor[av.hc]||AV.hairColor[1];
  const pc=AV.pantsColor[av.pc]||AV.pantsColor[0], hat=HAT_COL[av.hat]||HAT_COL[0];
  const acc={F:"#1c1c24", D:"#1d1d2c", M:"#8a2f2f", R:"#e0202a", W:"#f6f6ff", G:"#ffcc4d", g:"#c98a12", N:"#242840",
             Q:"#ff5fa8", V:"#39e5ff", A:hat[0], a:hat[1]};
  if(style==="burnout"){
    return Object.assign({O:"#1a1622", K:"#d8d4c8", E:"#241f18", S:"#d8d4c8", s:"#a9a496",
      C:"#6b6a78", c:"#43424f", l:"#8f8e9c", P:"#3a3946", p:"#2a2934", B:"#8d8a9a", b:"#5d5b68",
      H:"#d8d4c8", h:"#eae7dc"}, acc, {A:"#6b6a78", a:"#43424f", G:"#a9a496", R:"#7a4a4a", N:"#3a3946", W:"#c8c4b8"});
  }
  if(style==="weak"){
    /* หมดแรง: ผิวซีด ชุดสีหม่น ตาคล้ำ */
    const dull=shift(av.color,-70);
    return Object.assign({O:"#1a1622", H:shift(hc[0],-30), h:shift(hc[1],-40), S:"#e6dfd2", s:"#b9ad9a", E:"#2a2230",
      C:dull, c:shift(dull,-40), l:shift(dull,30), P:shift(pc[0],-50), p:shift(pc[1],-50), B:"#c9c6d4", b:"#8f8ba3"}, acc, {D:"#5a4a5a"});
  }
  const suit = style==="red" ? "#ff2436" : style==="flame" ? "#ffb324" : av.color;
  const p=Object.assign({O:"#140d2e", H:hc[0], h:hc[1], S:skin[0], s:skin[1], E:"#140d2e",
    C:suit, c:shift(suit,-62), l:shift(suit,58), P:pc[0], p:pc[1], B:"#eceaf6", b:"#a8a4c4"}, acc);
  if(style==="boost"){ p.E="#39e5ff"; }
  if(style==="green"){ p.E="#0f4a28"; }                      // ไฟเขียว Green Go Go: สีชุดเดิม + ออร่าเขียวเล็ก ๆ                      // ตาเรืองแสงฟ้า
  if(style==="red"){ p.E="#fff2f2"; }                        // ตาขาวร้อน ต้นทางเลเซอร์
  if(style==="flame"){ p.H="#ffd23a"; p.h="#fff8c4"; p.l="#fff3a0"; p.P="#c85a10"; p.p="#8a3606"; p.O="#3a1a05"; p.E="#ff1f1f"; }
  return p;
}
/* ประกอบตัวละครลงตาราง — frame = ท่าขา 0-3 */
function buildGrid(av, style, frame){
  const g=[]; for(let y=0;y<ROWS;y++) g.push(new Array(16).fill("."));
  const fill=(rows,y0)=>rows.forEach((r,i)=>{ const yy=y0+i+HR; if(yy<0||yy>=ROWS) return; const row=r.padEnd(16,"."); for(let x=0;x<16;x++) g[yy][x]=row[x]; });
  const set=(y,x,ch)=>{ y+=HR; if(y>=0&&y<ROWS&&x>=0&&x<16) g[y][x]=ch; };
  const get=(y,x)=>g[y+HR][x];
  const burn=style==="burnout", weak=style==="weak";
  const TORSO_THIN=["....OCCCCCCO....","...OCCCCCCCCO...","..OSCCCCCCCCSO..","..OSClCCCCCCSO..","..OsCCCCCCCCsO..","...OCCCCCCCCO...","....OCCCCCCO...."];
  fill(burn?HEAD_SKULL:HEAD,0); fill(weak?TORSO_THIN:TORSO,10); fill(FRAMES[frame]||LEGS.b,17);
  if(weak){ /* ขาผอม: เอาคอลัมน์นอกสุดของกางเกงออก */
    for(let y=17;y<=21;y++){ for(const x of [3,12]){ const c=get(y,x); if(c==="P"||c==="p") set(y,x,"."); } }
  }

  /* ---- เสื้อ ---- */
  const top=av.top;
  const bodyRe=(from,to)=>{ for(let y=10;y<=16;y++) for(let x=0;x<16;x++){ const c=get(y,x); if(from.includes(c)) set(y,x,to); } };
  if(top===1){ /* ฮู้ด: ไหล่มีฮู้ดสีเข้ม เชือกขาว กระเป๋าหน้าท้อง */
    set(9,2,"O");set(9,3,"c");set(9,12,"c");set(9,13,"O");
    set(10,2,"O");set(10,3,"c");set(10,4,"c");set(10,11,"c");set(10,12,"c");set(10,13,"O");
    set(11,6,"W");set(12,6,"W");set(13,6,"W");set(11,9,"W");set(12,9,"W");set(13,9,"W");
    for(let x=5;x<=10;x++){ set(14,x,"c");set(15,x,"c"); } }
  if(top===2){ /* แจ็กเก็ต: ตัวเสื้อสีเข้ม เปิดหน้าเห็นเสื้อในสีสด */
    bodyRe("Cl","c"); for(let y=11;y<=16;y++){ set(y,7,"C");set(y,8,"C"); }
    set(11,6,"l");set(11,9,"l");set(12,6,"l");set(12,9,"l"); }
  if(top===3){ /* เสื้อกล้าม: ไหล่เปลือย */
    set(10,3,"O");set(10,4,"S");set(10,11,"S");set(10,12,"O");
    set(11,3,"S");set(11,4,"S");set(11,11,"S");set(11,12,"S");set(12,3,"S");set(12,12,"S");set(13,3,"S");set(13,12,"S"); }
  if(top===5){ /* สูทกรมท่า เชิ้ตขาว ไทแดง */
    bodyRe("Ccl","N"); set(10,6,"W");set(10,9,"W");
    for(let y=11;y<=13;y++){ set(y,6,"W");set(y,8,"W"); } for(let y=11;y<=15;y++) set(y,7,"R"); }
  if(top===6){ /* เชิ้ตขาว คอปกสีชุด กระดุมดำ */
    bodyRe("Ccl","W"); set(10,5,"C");set(10,6,"C");set(10,9,"C");set(10,10,"C");set(11,5,"C");set(11,10,"C");
    set(12,7,"F");set(14,7,"F");set(16,7,"F"); }
  /* ---- ไอเทมพิเศษ (ปลดล็อกที่ 30 / 60 / 90 ชิ้น) ---- */
  const setE=(y,x,ch)=>{ const yy=y+HR; if(yy>=0&&yy<ROWS&&x>=0&&x<16&&g[yy][x]===".") g[yy][x]=ch; };
  if(top===7){ for(let y=14;y<=16;y++) for(let x=0;x<16;x++){ const c=get(y,x); if("Ccl".includes(c)) set(y,x, x<10?"S":"s"); } }          // ครอป โชว์หน้าท้อง
  if(top===8){ bodyRe("Ccl","F"); for(let y=11;y<=15;y++) set(y,7,"b"); set(11,6,"K");set(11,8,"K");set(12,5,"K");set(12,9,"K"); }             // แจ็กเก็ตหนัง
  if(top===9){ bodyRe("Ccl","b"); [3,4,11,12].forEach(x=>{ set(10,x,"B");set(11,x,"B"); }); set(11,5,"W");set(12,5,"W");set(11,6,"W");
    for(let x=6;x<=9;x++) set(13,x,"O"); }                                                                                                  // เกราะเงิน
  if(top===10){ fill(["...OCCCCCCCCO...","..OCClCCCCCCCO..","..OCCCCCClCCCO..",".OCCCCCCCCCCCCO.",".OClCCCCCCCClCO.","OCCCCCCCCCCCCCCO"],17); } // เดรสราตรี
  if(top===11){ bodyRe("Ccl","G"); [3,4,11,12].forEach(x=>{ set(10,x,"W");set(11,x,"W"); }); set(11,5,"W");set(12,5,"W");
    for(let y=12;y<=15;y++){ set(y,10,"g");set(y,11,"g"); } for(let x=6;x<=9;x++) set(13,x,"g"); }                                          // เกราะทอง
  if(top===12){ bodyRe("Ccl","W"); fill(["...OWWWWWWWWO...","..OWWbWWWWWWWO..","..OWWWWWWbWWWO..",".OWWWWWWWWWWWWO."],17);
    [[9,1],[9,14],[10,0],[10,1],[10,14],[10,15],[11,0],[11,1],[11,14],[11,15],[12,0],[12,15],[13,0],[13,15],[14,1],[14,14]]
      .forEach(([y,x])=>setE(y,x,"W")); }                                                                                                    // ปีกนางฟ้า + ชุดขาว
  if(top===13){ for(let y=10;y<=19;y++){ setE(y,0,"R");setE(y,1,"R");setE(y,14,"R");setE(y,15,"R"); } }                                     // ผ้าคลุมฮีโร่
  const longDress = top===4 || top===10 || top===12;
  /* ---- กางเกง / ขาสั้น / กระโปรง / เดรส ---- */
  const skinLegs=y=>{ for(let x=0;x<16;x++){ const c=get(y,x); if(c==="P") set(y,x,"S"); else if(c==="p") set(y,x,"s"); } };
  if(top===4){ fill(["...OCCCCCCCCO...","..OCClCCCCCCCO..","..OCClCCCCCCCO..",".OCCClCCCCCCCCO."],17); skinLegs(21); }
  else if(top===12){ skinLegs(21); }
  else if(longDress){ }
  else if(av.pt===1){ skinLegs(20); skinLegs(21); }
  else if(av.pt===2){ fill(["...OPPPPPPPPO...","..OPPPPppppPO...",".OPPPPPppppppO.."],17); skinLegs(20); skinLegs(21); }

  if(!burn){
    /* ---- ผม ---- */
    const hr=av.hr;
    if(hr===1){ fill(["....h..h..h.....","....hh.hh.hh....","...OhhhhhhhhO..."],-2); }
    if(hr===2){ for(let y=4;y<=12;y++){ set(y,1,"O");set(y,2,"H");set(y,13,"H");set(y,14,"O"); } set(13,2,"O");set(13,13,"O"); }
    if(hr===3){ for(let y=4;y<=8;y++){ set(y,1,"O");set(y,2,"H");set(y,13,"H");set(y,14,"O"); } set(9,2,"O");set(9,13,"O"); }
    if(hr===4){ fill([".....OOOOO......","...OOSSSSSOO....","..OSSSSSSSSSO...","..OSSSSSSSSSO..."],0);
      for(let y=4;y<=7;y++) set(y,2,"S"); set(4,3,"S");set(4,11,"S");set(4,12,"S");set(5,12,"S"); }
    if(hr===5){ set(3,13,"O"); for(let y=4;y<=11;y++){ set(y,13,"H");set(y,14,"O"); } set(12,13,"O"); }
    if(hr===6){ fill(["......OhhO......",".....OhhhhO....."],-2); }
    if(hr===7){ /* โมฮอว์ก: แถบกลางสูง ข้างโกน */
      fill(["......OhhO......","......OhhO......","......OhhO......","....OOOhhOOO....","...OOSShhSSOO...","..OSSSShhSSSSO..","..OSSSShhSSSSO.."],-3);
      for(let y=4;y<=7;y++) set(y,2,"S"); set(4,3,"S");set(4,11,"S");set(4,12,"S");set(5,12,"S"); }
    if(hr===8){ /* แอฟโฟร: ทรงกลมใหญ่ */
      fill([".....OOOOOO.....","...OOhhhhhhOO...","..OhhhhhhhhhhO..",".OhhhhhhhhhhhhO.",".OhhhhhhhhhhhhO.","OhhhhhhhhhhhhhhO","OhhhHHHHHHHHhhhO","OhhHSSSSSSSHhhhO"],-3);
      for(let y=5;y<=8;y++){ set(y,0,"O");set(y,1,"h");set(y,14,"h");set(y,15,"O"); } set(9,1,"O");set(9,14,"O"); }
    /* ---- หน้า ---- */
    if(av.g===1){ set(5,4,"E");set(5,9,"E"); }              // ขนตา = ตาโต
    if(av.no===1){ set(7,7,"s"); }
    if(av.no===2){ set(6,7,"s");set(6,8,"s");set(7,7,"s");set(7,8,"s"); }
    const mo=av.mo;
    if(mo===0){ set(8,6,"M");set(8,7,"M");set(8,8,"M");set(7,5,"M");set(7,9,"M"); }
    if(mo===1){ set(8,6,"M");set(8,7,"M");set(8,8,"M"); }
    if(mo===2){ for(let x=6;x<=8;x++){ set(7,x,"M");set(8,x,"M"); } set(8,7,"R"); }
    if(mo===3){ for(let x=5;x<=9;x++){ set(7,x,"M");set(8,x,"M"); } for(let x=6;x<=8;x++) set(7,x,"W"); }
    if(mo===4){ for(let x=5;x<=9;x++) set(7,x,"H"); set(8,4,"H");set(8,10,"H"); }
    if(mo===5){ for(let x=5;x<=9;x++) set(7,x,"H"); for(let x=3;x<=12;x++){ set(8,x,"H");set(9,x,"H"); } set(10,4,"H");set(10,11,"H"); for(let x=5;x<=10;x++) set(10,x,"H"); }
    if(style==="flame"){ set(5,4,"E");set(5,9,"E"); }       // PRO MAX: ตาแดงโตเรืองแสง
    if(weak){ /* ตาคล้ำ ปากคว่ำ เหงื่อตก */
      set(7,4,"D");set(7,9,"D");
      for(let x=6;x<=8;x++) set(8,x,"S"); set(8,6,"M");set(8,7,"M");set(8,8,"M");set(9,5,"M");set(9,9,"M");
      set(4,12,"V");set(5,13,"V");
    }
  }
  /* ---- แว่น (2-3 แถว ให้เห็นชัด) ---- */
  const gl=av.gl;
  const frames=(ch)=>{ [3,5,8,10].forEach(x=>{ set(5,x,ch);set(6,x,ch); }); set(5,6,ch);set(5,7,ch); };
  if(gl===1){ frames("G"); [3,4,5,8,9,10].forEach(x=>set(4,x,"G")); }
  if(gl===2){ frames("F"); [3,4,5,8,9,10].forEach(x=>set(4,x,"F")); [3,4,5,8,9,10].forEach(x=>set(7,x,"F")); }
  if(gl===3){ [3,4,5,8,9,10].forEach(x=>{ set(5,x,"D");set(6,x,"D");set(4,x,"F"); }); set(5,6,"F");set(5,7,"F"); }
  if(gl===4){ frames("W"); [3,4,5,8,9,10].forEach(x=>{ set(4,x,"W");set(7,x,"W"); }); set(6,6,"W");set(6,7,"W"); }
  if(gl===5){ [[4,2],[4,4],[4,8],[4,10],[5,2],[5,3],[5,4],[5,5],[5,6],[5,8],[5,9],[5,10],[5,11],[5,12],[6,3],[6,4],[6,5],[6,9],[6,10],[6,11],[7,4],[7,10]]
    .forEach(([y,x])=>set(y,x,"Q")); }                                                                                                       // แว่นหัวใจ
  if(gl===6){ for(let x=2;x<=12;x++){ set(5,x,(x===2||x===12)?"O":"V"); set(6,x,(x===2||x===12)?"O":"D"); } }                              // วิเซอร์
  /* ---- หมวก (ใช้พื้นที่เหนือหัว) ---- */
  const hat=av.hat;
  if(hat===1){ fill(["....OOOOOOO.....","...OAAAAAAAO....","..OAAAAAAAAAO...","..OAAAAAAAAAO...","..OAaaaaaaaaAAAO"],-1); }
  if(hat===2){ fill(["......OWWO......",".....OWWWWO.....","....OAAAAAAO....","...OAAAAAAAAO...","..OAAAAAAAAAAO..","..OaaaaaaaaaaO.."],-2); }
  if(hat===3){ fill(["...G.G.G.G.G.G..","...GGGGGGGGGGG..","..OGRGGGRGGGRGO.","..OGGGGGGGGGGGO."],-2); }
  if(hat===4){ for(let x=3;x<=13;x++) set(3,x,"A"); set(4,13,"a");set(4,14,"O");set(5,14,"O"); }        // ผ้าคาดหัว: ใช้สีจาก HAT_COL เหมือนหมวกอื่น (เดิมฝังสี R ตายตัว ร่างกระโหลก/หมดแรงเลยไม่หม่นตาม)
  if(hat===5){ fill(["....OAAAAAAO....","....OAAAAAAO....","....OAAAAAAO....","....OAAaaAAO....","..OOOAAAAAAOOO..",".OAAAAAAAAAAAAO."],-4); }
  if(hat===6){ fill([".....OAAAAO.....","....OAAAAAAO....",".OAAAAAAAAAAAAO.","OAaaaaaaaaaaaaAO"],-2); }
  if(hat===7){ fill([".......OO.......","......OAAO......",".....OAAAAO.....","....OAAaAAAO....","...OAAAAAAAAO...","OOAAAAAAAAAAAAOO"],-4); }
  if(hat===8){ fill(["......OaO.......",".....OAAAAAAO...","...OAAAAAAAAAO..","..OAaaaaaaaaaAO."],-1); }                                       // เบเร่ต์
  if(hat===9){ fill([".....OAAAAO.....","....OAAAAAAO....","....OAAAAAAO....","OOAAAAAAAAAAAAOO",".OaaaaaaaaaaaaO."],-2); }                   // หมวกฟาง
  if(hat===10){ fill(["....OOOOOOO.....","...OAAAAAAAO....","..OAAAAAAAAAO...","OAAAaaaaaaaaAO.."],0); }                                       // แก๊ปกลับหลัง
  if(hat===11){ fill(["....OAAO.OAAO...","....OAAAOAAAO...",".....OAAaAAO...."],-2); }                                                        // โบว์ใหญ่
  if(hat===12){ fill(["..OAAO.....OAAO.","..OARAO...OARAO.",".OAAAAOOOOOAAAAO"],-2); }                                                        // หูแมว
  if(hat===13){ fill(["..W.........W...","..WW.......WW...","...WOOOOOOOW....","...OAAAAAAAAO...","..OAAAAAAAAAO...","..OaAAAAAAAaO..."],-2); } // ไวกิ้ง
  if(hat===14){ fill(["....A..W..A.....","....OAAAAAAAO..."],-1); }                                                                           // ทิอาร่าเพชร
  if(hat===15){ fill(["...G.G.G.G.G.G..","...GGGGGGGGGGG..","..OGRGGWGGGRGGO.","..OGGGGGGGGGGGO.","..OgGGGGGGGGGgO."],-3); }                  // มงกุฎราชา
  /* ---- ดาบ: ถือมือขวาตอนกำลังดวล ---- */
  if(av.sword){ set(3,14,"W"); for(let y=4;y<=11;y++){ set(y,14,"W"); set(y,15,"O"); } set(12,13,"G");set(12,14,"G");set(12,15,"G"); set(13,14,"g");set(14,14,"g"); }
  /* ---- หมวกจากการดวล (ผู้แพ้ต้องใส่ 7 วัน) ---- */
  if(hat===17){ fill([".......OO.......","......OAAO......",".....OAaAAO.....","....OAWAAWAO....","...OAAaAAAaAO..."],-4); }                    // อึบนหัว
  if(hat===18){ /* หัวล้านเงา: ลบผมเหนือหัวและบนกระหม่อมออก เหลือแต่ผิว + แสงสะท้อน */
    for(let y=-HR;y<=3;y++) for(let x=0;x<16;x++){ const c=get(y,x); if(y<0 && "HhO".includes(c)) set(y,x,"."); else if(y>=0 && "Hh".includes(c)) set(y,x,"S"); }
    fill([".....OOOOO......","...OOSSSSSOO....","..OSWWSSSSSO....","..OSWSSSSSSO...."],0); }
  if(hat===19){ fill(["OWWWWWWWWWWWWWWO","OWWWWWWWWWWWWWWO","OWWWWWWWWWWWWWWO",".......OO......."],-4); }                                       // ป้าย LOSER (ตัวอักษรพิมพ์ทับใน sprite)
  if(hat===20){ fill([".......OO.......","......OWWO......",".....ORRRRO.....","....OWWWWWWO....","...OWWWWWWWWO..."],-4); }                    // หมวกโง่ (กรวย)
  if(hat===21){ fill(["OGGGGGGGGGGGGGGO","OGGGGGGGGGGGGGGO","OGGGGGGGGGGGGGGO",".......OO......."],-4); }                                       // ป้าย WINNER
  if(hat===16){ fill([".....GGGGGG.....","....G......G....",".....GGGGGG....."],-4); }                                                        // รัศมีนางฟ้า
  return g;
}
function sprite(av, px=2, style="normal"){
  if(typeof av==="string") av=Object.assign({},DEF_AV,{color:av});
  const pal=palette(av,style);
  const rects=(g,y0,y1)=>{ let s=""; for(let y=y0;y<y1;y++) for(let x=0;x<16;x++){
    const c=pal[g[y][x]]; if(c) s+=`<rect x="${x*px}" y="${y*px}" width="${px}" height="${px}" fill="${c}"/>`; } return s; };
  const g0=buildGrid(av,style,0);
  const LEG0=17+HR;
  const legs=FRAMES.map((_,i)=>
    `<g class="leg k${i}" style="animation-delay:-${(i*.12).toFixed(2)}s">${rects(i?buildGrid(av,style,i):g0,LEG0,ROWS)}</g>`).join("");
  /* ป้ายบนหัว: ตัวอักษรเล็กเกินกว่าจะวาดเป็นพิกเซลใน 16 ช่อง เลยพิมพ์เป็น text ทับกระดานแทน */
  const sign = SIGN_TEXT[av.hat] ? `<text x="${8*px}" y="${2.45*px}" font-family="Arial Black,Impact,sans-serif" font-weight="900" font-size="${2.6*px}" fill="${SIGN_TEXT[av.hat][1]}" text-anchor="middle" textLength="${11*px}" lengthAdjust="spacingAndGlyphs">${SIGN_TEXT[av.hat][0]}</text>` : "";
  return `<svg width="${16*px}" height="${ROWS*px}" viewBox="0 0 ${16*px} ${ROWS*px}" shape-rendering="crispEdges">
    ${rects(g0,0,LEG0)}${legs}${sign}</svg>`;
}
/* แถวบนสุดที่มีพิกเซล — ไว้วางป้ายชื่อให้ชิดหัว (หมวกสูงก็ขยับขึ้นตาม) */
function spriteTop(av, style){
  const g=buildGrid(av,style,0);
  for(let y=0;y<ROWS;y++) if(g[y].some(c=>c!==".")) return y;
  return HR;
}
/* ไฟรอบตัว: red = ไฟแดง (LASER FOCUS)  flame = ไฟทอง (PRO MAX) */
const hasAura = style => style==="red" || style==="flame" || style==="green";
const aura = (style="flame") => `<span class="aura ${style}">${"<i></i>".repeat(style==="flame"?5:3)}</span>`;
function runnerBox(av, px, style="normal"){
  return `<div class="runner ${style}" style="position:relative;transform:none;width:auto">
    <div class="body">${hasAura(style)?aura(style):""}${sprite(av,px,style)}</div></div>`;
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
const curWeek   = () => S.week || weekOf(S.today);            // live: เลขสัปดาห์จากเซิร์ฟเวอร์ (ตัดพุธ 19:30) · demo: คิดจากวัน
const vacDay     = d => !!S.vacFrom && d>=S.vacFrom && d<=S.vacTo;           // วันปิดเทอม (14–20 ต.ค. = วันที่ 43–49)
const isVacation = () => vacDay(S.today);                                       // วันนี้ปิดเทอม → ป้าย/มีม
const starN      = r => (r && S.holiday && S.holiday[r.id]) || 0;             // ชิ้นที่ส่งช่วงปิดเทอม → นักเรียนดีเด่น 🏅
const noPledgeWeek = () => isVacation() || (!!S.vacationWeek && curWeek()===S.vacationWeek);   // สัปดาห์นี้ไม่ต้องเลือกเป้า
const dayDateTH  = (d,opt) => { const x=new Date((S.startDate||"")+"T00:00:00"); if(isNaN(x)) return "วันที่ "+d; x.setDate(x.getDate()+d-1); return x.toLocaleDateString("th-TH",opt||{day:"numeric",month:"short"}); };
const VAC_MEMES  = ["🏅 นักเรียนดีเด่น! ส่งงานช่วงปิดเทอม นับรวมยอดให้เลย"];
const joinedIn  = (r,s) => !r.joined || !r.joined.length || r.joined.includes(s);   // ไม่มีข้อมูลสปรินต์ = ถือว่าลงครบ (ทุกคนลงครบเสมอตั้งแต่ 040)
const joinedWeek= (r,w) => joinedIn(r, spOfWeek(w));
const meR       = () => (S.spectator || !S.me) ? null : (S.runners.find(r=>r.name===S.me) || null);   // ห้ามหล่นไปเป็นคนอื่น (ออกจากโหมดคนดูแล้วเคยกลายเป็น runner[0])
/* บทบาทในสนาม: student / ta (โค้ชประจำบ้าน ชื่อเขียว) / head (หัวหน้าโค้ช ชื่อแดง โผล่ทุกบ้าน) */
const roleOf    = r => r.role!=="coach" ? "student" : (r.house ? "ta" : "head");
const nameColor = r => roleOf(r)==="ta" ? "#5ef08c" : roleOf(r)==="head" ? "#ff4d6d" : r.color;
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
  /* หมดแรงแบบเบา: สัปดาห์ที่แล้วรับ 4/7 แล้วทำไม่ถึง → ร่างผอมแห้งทั้งสัปดาห์ (เลือกเป้าได้ปกติ) */
  let weak = !!r.weak;
  if(!burnout && !weak && cw > 1){
    const pw = cw - 1, pt = r.pledges && r.pledges[pw];
    if(pt && pt < HEAVY && joinedWeek(r, pw)) weak = my.filter(s=>weekOf(s.day)===pw).length < pt;
  }
  const contents=my.length;
  return {contents, activeDays:Object.keys(byDay).length, weekDone, weekTarget, target,
    pace:contents-target, rate: target?Math.round(contents/target*100):0,
    weekStreak:ws, dayStreak:ds, byDay, weeksHit, burnout, weak,
    style: burnout ? "burnout" : weak ? "weak" : (weekTarget ? optOf(weekTarget).style : "normal")};
}

/* ================= DATA LAYER ================= */
const DemoDB = (()=>{
  const KEY="creatorBootcamp.demo.v3";
  const NAMES=["MILD","POND","NAMTAN","BAS","JAAB","TAE","OAK","PLOY","GIFT","NOTE","FILM","MAY",
    "BEAM","FERN","KAI","NUT","PANG","BOOM","MEW","JAME","TOP","GOLF","NAN","JOY","PIM","TONG",
    "EARTH","BELLE","AOM","KWAN","PREW","NINE","FAH","KING","ARM","TEE","PUN","MIN","ICE","NAM",
    "PAM","KAO","DEW","PEAR","SOM","BOAT","NIDA","JIB","KATE","NONT"];
  let uid=1, db=null, onChange=()=>{};
  const save=()=>{ try{ db.uid=uid; localStorage.setItem(KEY,JSON.stringify(db)); }catch(e){} };

  /* ข้อมูลปลอม 50 คน (สุ่มแบบคงที่ ทุกเครื่องเห็นเหมือนกัน)
     วันที่ 45 = สัปดาห์ที่ 7 → PRO MAX เปิดแล้ว  มีครบทุกร่าง: ปกติ / ฟ้า / แดง / ไฟทอง / กระโหลก
     + หัวหน้าโค้ช 1 + TA 4 + คนที่ถึงเส้นชัยแล้ว 1 */
  function build(me){
    let seed=20260902;
    const R=()=>{ seed=(seed*1103515245+12345)%2147483648; return seed/2147483648; };
    const today=Math.min(45,TOTAL), cw=weekOf(today);
    const runners=NAMES.map((n,i)=>({
      id:"d"+i, name:n, handle:"@"+n.toLowerCase()+["",".tv",".studio",".daily",".official"][i%5],
      color:COLORS[(i*3+1)%COLORS.length], avatar:randAv(i*7+3),
      house: i===0 ? 0 : 1+(i%4),
      role: i<=4 ? "coach" : "student",                   // 0 = หัวหน้าโค้ช (ไม่มีบ้าน), 1-4 = TA ประจำบ้าน
      joined:[0,1,2,3,4,5], pledges:{}
    }));
    runners.unshift({id:"me", name:me.name, handle:me.handle||("@"+me.name.toLowerCase()), color:me.color, avatar:me.avatar||{},
      house:me.house||1, role:"student", joined:me.joined, pledges:{}});

    /* บทบาทพิเศษในสนามสาธิต */
    const BURN  = new Set([12,31]);              // กระโหลกแค่ 2 คน ไม่ให้น่ากลัว   // รับ 10/14 สัปดาห์ที่แล้วแล้วพลาด → กระโหลก
    const FLAME = new Set([]);                   // PRO MAX คนเดียว = KING (คนที่ถึงเส้นชัย)
    const RED   = new Set([9,20,33]);            // ไฟแดงมีน้อย ๆ
    const WEAK  = new Set([8,23,36,48]);   // รับ 4/7 สัปดาห์ที่แล้วแล้วพลาด → ร่างผอมแห้ง
    const FINISHER = 34;                          // KING วิ่งถึง 90 แล้ว

    runners.forEach((r,i)=>{
      const grit = i===0 ? 1.02 : i===FINISHER ? 1.3 : .8+R()*.25;   // ส่วนใหญ่ทำได้ตามเป้า คนที่พลาดคือชุดที่กำหนดไว้
      for(let w=1; w<=cw; w++){
        if(!joinedWeek(r,w)) continue;
        if(i===0 && w===cw) continue;              // ผู้เล่นใหม่ยังไม่ได้เลือกเป้าสัปดาห์นี้
        const roll=R();
        let t = roll<.25 ? 4 : roll<.92 ? 7 : 10;   // ส่วนใหญ่ 7 · 10 นาน ๆ ที · 14 เฉพาะคนที่กำหนด
        if(BURN.has(i)  && w===cw-1) t = R()<.5 ? 10 : 14;
        if(BURN.has(i)  && w===cw)   t = 4;        // สัปดาห์นี้เลือกได้แค่ 4/7
        if(WEAK.has(i)  && w===cw-1) t = R()<.5 ? 4 : 7;
        if(WEAK.has(i)  && w===cw)   t = 7;
        if(FLAME.has(i) && w===cw)   t = 14;
        if(RED.has(i)   && w===cw)   t = 10;
        if(i===FINISHER)             t = w>=7 ? 14 : 10;
        r.pledges[w] = t;
      }
      r._grit=grit;
    });

    let subs=[];
    runners.forEach((r,i)=>{
      for(let d=1; d<=today; d++){
        if(!joinedIn(r,spOf(d))) continue;
        if(i===0 && d===today) continue;           // เว้นวันนี้ให้ผู้เล่นกดเอง
        const w=weekOf(d), t=r.pledges[w]||7;
        let perDay=t/7*1.25;                        // เผื่อไว้ให้คนทั่วไปทำครบเป้า
        if(i===FINISHER) perDay=2.1;
        if(BURN.has(i) && w===cw-1) perDay=Math.min(perDay, (t-4)/7);   // สัปดาห์ที่พลาด ทำได้ไม่ถึง
        if(WEAK.has(i) && w===cw-1) perDay=Math.max(0,(t-3))/7;
        let n=Math.floor(perDay);
        if(R() < (perDay-n)) n++;
        if(R() > r._grit) n=Math.max(0,n-1);
        for(let k=0;k<n;k++){
          const hour = 6+Math.floor(R()*17);        // ส่วนใหญ่ส่งกลางวัน-ค่ำ
          subs.push({id:uid++, who:r.name, day:d, sp:spOf(d), plat:PLATS[Math.floor(R()*PLATS.length)],
            url:`https://tiktok.com/${r.handle.slice(1)}/${d}-${k}-${Math.floor(R()*9e4)}`,
            ts:Date.now()-(today-d)*864e5-(hour*3600e3)-Math.floor(R()*3e6)});
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
    async updateAvatar(av, color){ const r=db.runners.find(x=>x.name===db.me); r.avatar=av; r.color=color; save(); onChange(); },
    async fetchAll(){
      if(!db) db=build({name:"YOU", color:COLORS[0], joined:ALL_SPRINTS, avatar:{}});   // โหมดคนดูใน DEMO ยังไม่ได้สร้างตัวละคร
      const postedToday = db.subs.some(s=>s.who===db.me && s.day===db.today);
      const todaySubs = db.subs.filter(s=>s.who===db.me && s.day===db.today).map(s=>s.ts);
      /* ถ้วยบ้าน: บ้านที่เฉลี่ยต่อคนสูงสุดของแต่ละสัปดาห์ที่จบแล้ว */
      const cups=[], cw=weekOf(db.today);
      for(let w=1; w<cw; w++){
        let best=null;
        HOUSES.forEach(hs=>{
          const mem=db.runners.filter(r=>r.role==="student"&&r.house===hs.id); if(!mem.length) return;
          const n=db.subs.filter(s=>weekOf(s.day)===w && mem.some(m=>m.name===s.who)).length;
          const avg=n/mem.length;
          if(!best||avg>best.avg_pieces) best={week_no:w, house_id:hs.id, avg_pieces:+avg.toFixed(2), pieces:n, members:mem.length};
        });
        if(best) cups.push(best);
      }
      /* ประวัติ King of the Week: ที่ 1 ของบ้านในแต่ละสัปดาห์ที่จบแล้ว */
      const kings=[];
      for(let w=1; w<cw; w++){
        HOUSES.forEach(hs=>{
          const best=db.runners.filter(r=>r.role==="student"&&r.house===hs.id&&r.pledges[w])
            .map(r=>({r, done:db.subs.filter(s=>s.who===r.name&&weekOf(s.day)===w).length}))
            .filter(x=>x.done>0).sort((a,b)=>b.done-a.done)[0];
          if(best) kings.push({week_no:w, house_id:hs.id, profile_id:best.r.id, name:best.r.name, done:best.done});
        });
      }
      /* ดวลสด + บอสสาธิต */
      const duels=(db.duels||[]).map(d=>{ const nm=id=>(db.runners.find(x=>x.id===id)||{}).name; const sc=id=>d.start_day?db.subs.filter(s=>s.who===nm(id)&&s.day>=d.start_day&&s.day<=d.end_day).length:0;
        return Object.assign({}, d, {challenger_name:nm(d.challenger), opponent_name:nm(d.opponent), challenger_score:sc(d.challenger), opponent_score:sc(d.opponent), today:db.today}); });
      const bosses=HOUSES.map((hs,i)=>{ const mem=db.runners.filter(r=>r.role==="student"&&r.house===hs.id); const dmg=db.subs.filter(s=>weekOf(s.day)===cw&&mem.some(m=>m.name===s.who)).length;
        return {id:100+hs.id, week_no:cw, house_id:hs.id, name:["มังกรผัดวันประกันพรุ่ง","ยักษ์ขี้เกียจ","ปีศาจเลื่อนโพสต์","ราชาผู้ไม่กล้ากดปล่อย"][i], emoji:["🐉","👹","👻","💀"][i], skin:["dragon","ogre","ghost","skull"][i], hp:60+i*10, reward:"ป้าย BOSS SLAYER ทั้งบ้าน", damage:dmg, fighters:new Set(db.subs.filter(s=>weekOf(s.day)===cw&&mem.some(m=>m.name===s.who)).map(s=>s.who)).size}; });
      const bossKills=[]; bosses.filter(b=>b.damage>=b.hp).forEach(b=>{ db.runners.filter(r=>r.role==="student"&&r.house===b.house_id&&db.subs.some(s=>s.who===r.name&&weekOf(s.day)===cw)).forEach(r=>bossKills.push({boss_id:b.id, week_no:cw, name:b.name, profile_id:r.id})); });
      const cheerWeeks=[]; (db.cheers||[]).forEach(c=>{ const w=weekOf(c.day_index); let row=cheerWeeks.find(x=>x.profile_id===c.to_id&&x.week_no===w); if(!row){ row={profile_id:c.to_id, week_no:w, n:0}; cheerWeeks.push(row);} row.n++; });
      const reach={}; db.subs.forEach(s=>{ const r0=db.runners.find(x=>x.name===s.who); if(!r0) return; const o=reach[r0.id]=reach[r0.id]||{profile_id:r0.id,total_views:0,total_likes:0,best_views:0,pieces:0}; o.total_views+=s.views||0; o.total_likes+=s.likes||0; o.best_views=Math.max(o.best_views,s.views||0); o.pieces++; });
      return {today:db.today, me:db.me, runners:db.runners, subs:db.subs, postedToday, todayCount:todaySubs.length, todaySubs, cups, kings,
              reach:Object.values(reach), kudos:[], sessions:[], myCheckins:[],
              cheers:db.cheers||[], nudges:db.nudges||[], cheerWeeks, duels, bosses, bossKills,
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
      const weeks=Object.entries(runner.pledges||{}).map(([w,t])=>{
        const wn=+w, done=my.filter(s=>weekOf(s.day)===wn).length;
        return {week_no:wn, target:t, done, hit:done>=t, finished:wn<weekOf(db.today)};
      });
      return {byDay, weeks, early:my.some(s=>new Date(s.ts).getHours()<6),
              recent:[...my].sort((a,b)=>b.ts-a.ts)};
    },
    /* ---- ขอฟีเจอร์ (จำลองในเครื่อง) ---- */
    async feedbackList(){ db.feedback=db.feedback||[]; const me=db.runners.find(r=>r.name===db.me);
      return db.feedback.map(f=>Object.assign({},f,{votes:(f.voters||[]).length, mine:(f.voters||[]).includes(me.id), own:f.profile_id===me.id})).sort((a,b)=>b.votes-a.votes||b.id-a.id); },
    async feedbackSend(kind,text,page){ db.feedback=db.feedback||[]; const me=db.runners.find(r=>r.name===db.me);
      db.feedback.push({id:uid++, kind, text, page, status:"new", admin_note:null, created_at:new Date().toISOString(), profile_id:me.id, author:me.name, house_id:me.house, voters:[]}); save(); },
    async feedbackVote(id,on){ const f=(db.feedback||[]).find(x=>x.id===id); if(!f) return; const me=db.runners.find(r=>r.name===db.me); f.voters=(f.voters||[]).filter(v=>v!==me.id); if(on) f.voters.push(me.id); save(); },
    async nudge(toId){ db.nudges=db.nudges||[]; const me=db.runners.find(x=>x.name===db.me), to=db.runners.find(x=>x.id===toId);
      if(db.subs.some(s=>s.who===to.name&&s.day===db.today)) throw new Error("เขาส่งงานวันนี้แล้ว 🎉 ไปเชียร์แทนได้เลย");
      if(db.nudges.some(n=>n.from_id===me.id&&n.to_id===toId&&n.day_index===db.today)) throw new Error("วันนี้สะกิดคนนี้ไปแล้ว");
      if(db.nudges.filter(n=>n.from_id===me.id&&n.day_index===db.today).length>=5) throw new Error("วันนี้สะกิดครบ 5 คนแล้ว");
      db.nudges.push({from_id:me.id,to_id:toId,day_index:db.today}); save(); onChange(); },
    /* ---- สังคม (จำลองในเครื่อง) ---- */
    async cheer(toId, emoji){
      db.cheers=db.cheers||[]; const me=db.runners.find(x=>x.name===db.me);
      if(db.cheers.some(c=>c.from_id===me.id&&c.to_id===toId&&c.day_index===db.today)) throw new Error("วันนี้เชียร์คนนี้ไปแล้ว");
      db.cheers.push({from_id:me.id, to_id:toId, emoji, day_index:db.today}); save(); onChange();
    },
    async duelCreate(opponent){
      db.duels=db.duels||[]; const me=db.runners.find(x=>x.name===db.me);
      if(db.duels.some(d=>["pending","active"].includes(d.status)&&(d.challenger===me.id||d.opponent===me.id||d.challenger===opponent||d.opponent===opponent))) throw new Error("มีดวลค้างอยู่แล้ว รอให้จบก่อน");
      db.duels.push({id:Date.now(), challenger:me.id, opponent, status:"pending", start_day:null, end_day:null, winner:null, prize_hat:null}); save(); onChange();
    },
    async duelUpdate(id, patch){
      const d=(db.duels||[]).find(x=>x.id===id); if(!d) throw new Error("ไม่พบดวล");
      if(patch.status==="active"){ d.status="active"; d.start_day=db.today; d.end_day=db.today+6; }
      else if(patch.status==="declined"){ d.status="declined"; }
      else if(patch.status==="done"){
        const sc=id2=>db.subs.filter(s=>{const r=db.runners.find(x=>x.id===id2); return r&&s.who===r.name&&s.day>=d.start_day&&s.day<=d.end_day;}).length;
        const a=sc(d.challenger), b=sc(d.opponent); d.status="done"; d.winner=a>b?d.challenger:b>a?d.opponent:null;
      }
      else if(patch.prize_hat!=null){ d.prize_hat=patch.prize_hat; }
      save(); onChange();
    },
    async deleteSub(id){
      const i=db.subs.findIndex(s=>s.id===id&&s.who===db.me); if(i<0) throw new Error("ไม่พบงาน");
      if(Date.now()-db.subs[i].ts>DEL_MS) throw new Error("ลบได้เฉพาะภายใน 30 นาทีหลังส่ง");
      db.subs.splice(i,1); save(); onChange();
    },
    async savePush(){}, async removePush(){},
    async submit({url, platform, kind, note}){
      const r=db.runners.find(x=>x.name===db.me);
      if(db.subs.some(s=>s.url.toLowerCase()===url.toLowerCase())) throw new Error("ลิงก์นี้ถูกส่งไปแล้ว");
      const s=spOf(db.today);
      if(!r.joined.includes(s)) throw new Error(`ไม่ได้ลงสปรินต์ ${s+1}`);
      db.subs.push({id:uid++, who:r.name, day:db.today, sp:s, plat:platform, url, ts:Date.now(), kind:kind||null, note:note||null, views:0, likes:0});
      save(); onChange();
    },
    async updateSub(id, patch){
      const s=db.subs.find(x=>x.id===id && x.who===db.me); if(!s) throw new Error("ไม่พบงานชิ้นนี้");
      if(patch.platform!=null) s.plat=patch.platform; if(patch.kind!==undefined) s.kind=patch.kind||null; if(patch.note!==undefined) s.note=patch.note||null;
      if(patch.views!=null) s.views=+patch.views||0; if(patch.likes!=null) s.likes=+patch.likes||0;
      save(); onChange();
    },
    async fixUrl(id, url){
      const s=db.subs.find(x=>x.id===id && x.who===db.me); if(!s) throw new Error("ไม่พบงานชิ้นนี้");
      if(!/^https?:\/\/.+\..+/.test(url)) throw new Error("ลิงก์ต้องขึ้นต้นด้วย http:// หรือ https://");
      if(db.subs.some(x=>x.id!==id && x.url===url)) throw new Error("ลิงก์นี้ถูกส่งไปแล้ว ใช้ซ้ำไม่ได้");
      s.url=url; save(); onChange();
    },
    async checkin(){ throw new Error("โหมดทดลองไม่มีเรียนสด"); },
    async rename(name){
      if(db.runners.some(r=>r.name.toUpperCase()===name.toUpperCase() && r.name!==db.me)) throw new Error("ชื่อนี้มีคนใช้แล้ว ลองชื่ออื่น");
      const r=db.runners.find(x=>x.name===db.me);
      db.subs.forEach(s=>{ if(s.who===db.me) s.who=name; });
      r.name=name; db.me=name; save(); onChange();
    },
    async fixPlatform(id, platform){
      const s=db.subs.find(x=>x.id===id && x.who===db.me); if(!s) throw new Error("ไม่พบงานชิ้นนี้");
      s.plat=platform; save(); onChange();
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
  /* ตอนไลฟ์มีคนส่งงานรัว ๆ ทุกครั้งที่ตารางขยับจะสั่งโหลดใหม่ทั้งชุด
     หน่วง 400ms เดิมสั้นเกินไป รอบโหลดเลยซ้อนกันจนหน้าเว็บหนืด — ขยับเป็น 2 วินาที */
  const bump=()=>{ clearTimeout(timer); timer=setTimeout(()=>onChange(), 2000); };

  /* ---- เกราะกันฐานข้อมูลเย็น -------------------------------------------
     วัดจริง 2026-09-09: ยิงครั้งแรกตอนแคชเย็น v_feed ใช้ 22.7 วินาที
     ส่วน v_leaderboard คืน error 500 เพราะชน statement timeout
     แต่พอแคชอุ่นแล้ว view เดียวกันเหลือ 88–334 ms ทุกตัว
     แปลว่า "ครั้งที่ล้มเหลว" คือตัวที่อุ่นแคชให้เอง ลองใหม่อีกทีจึงมักผ่านและเร็ว
     must = ขาดไม่ได้ ลองซ้ำจนได้ · soft = ขาดได้ ล้มแล้วคืนค่าว่างไปก่อน       */
  const withTimeout = (p, ms, label) => Promise.race([
    Promise.resolve(p),
    new Promise((_,rej)=>setTimeout(()=>rej(new Error(label+" ช้าเกิน "+Math.round(ms/1000)+" วิ")), ms))
  ]);
  async function must(fn, label, tries=3){
    let last;
    for(let i=0;i<tries;i++){
      try{
        const r = await withTimeout(fn(), i===0 ? 25000 : 35000, label);
        if(r && r.error) throw new Error(r.error.message);
        return r;
      }catch(e){
        last=e;
        console.warn("โหลด "+label+" รอบ "+(i+1)+" ไม่ผ่าน:", e.message||e);
        if(i<tries-1) await new Promise(r=>setTimeout(r, 500*(i+1)));
      }
    }
    throw new Error(label+" โหลดไม่ได้ — "+((last&&last.message)||last));
  }
  const soft = (fn, label) => must(fn, label, 2).catch(()=>({data:[]}));

  /* ทยอยยิงทีละไม่กี่ตัว ห้ามยิงรวดเดียวทั้งหมด
     วัดจริง 2026-09-09: ยิง 19 query พร้อมกันแล้ว "ทุกตัว" หมดเวลาที่ 12 วินาที
     รวมทั้ง query ตารางเปล่า ๆ อย่าง cheers ที่ปกติใช้ 99 ms
     เพราะ Supabase ฟรีมี connection pool จำกัด ยิงพรวดเดียวคือทุกตัวเข้าคิวรอกันเอง
     ทยอยยิงทีละ 3 จบเร็วกว่ายิงพร้อมกันหมดมาก */
  async function pool(tasks, n){
    const out=new Array(tasks.length); let i=0;
    await Promise.all(Array.from({length:Math.min(n,tasks.length)}, async ()=>{
      while(i<tasks.length){ const k=i++; out[k]=await tasks[k](); }
    }));
    return out;
  }
  const todayFrom = sd => {
    const shifted=new Date(Date.now()-C.CUTOFF_HOUR*3600e3);
    return Math.max(1, Math.floor((shifted-new Date(sd+"T00:00:00"))/864e5)+1);
  };
  return {
    mode:"live", canSim:false,
    _sb(){ return sb; },
    async init(){
      sb=window.supabase.createClient(C.SUPABASE_URL, C.SUPABASE_ANON_KEY);
      const {data:{session:s}}=await sb.auth.getSession(); session=s;
      sb.auth.onAuthStateChange((_e,ns)=>{ if(!!ns!==!!session) location.reload(); session=ns; });
      if(!session) return {needsAuth:true, needsProfile:false};
      const {data:prof}=await sb.from("profiles").select("id").eq("id",session.user.id).maybeSingle();
      return {needsAuth:false, needsProfile:!prof, email:session.user.email};
    },
    /* อีเมล + รหัสเดียวกันทั้งรุ่น — ไม่พึ่งอีเมลส่งลิงก์ (ติดเพดาน 2 ฉบับ/ชม.)
       เข้าครั้งแรก: เช็คว่าอยู่ในรายชื่อ แล้วสมัครให้เอง (Supabase ตั้ง autoconfirm ไว้) */
    async signIn(email, password){
      const WRONG="รหัสไม่ถูกต้อง<br><small>เคยเข้าได้แล้วแต่เข้าเครื่องใหม่ไม่ได้? แจ้งทีมงานให้กด \"รีเซ็ตรหัส\" ให้</small>";
      email=email.trim().toLowerCase();
      /* มือถือชอบเติมช่องว่างท้าย / ขึ้นตัวพิมพ์ใหญ่ตัวแรกให้เอง — ลองตามที่พิมพ์ก่อน แล้วค่อยลองแบบแก้ให้ */
      const t=password.trim();
      const tries=[...new Set([password, t, t.charAt(0).toLowerCase()+t.slice(1), t.toLowerCase()])];
      let r1;
      for(const pw of tries){ r1=await sb.auth.signInWithPassword({email,password:pw}); if(!r1.error){ password=pw; return; } }   // onAuthStateChange จะรีโหลดให้
      if(!/invalid login credentials/i.test(r1.error.message)) throw new Error(r1.error.message);
      const {data:ok,error:e2}=await sb.rpc("email_allowed",{em:email});
      if(e2) throw new Error(e2.message);
      if(!ok) throw new Error("อีเมลนี้ไม่อยู่ในรายชื่อรุ่น<br>ติดต่อทีมงานให้เพิ่มชื่อก่อน");
      /* รหัสต้องตรงกับรหัสรวมที่ทีมงานตั้งไว้ (ลองแบบแก้ตัวพิมพ์ให้ด้วย) */
      let codeOk=false, codeUsed=t;
      for(const pw of tries){ const {data,error:e3}=await sb.rpc("login_code_ok",{c:pw}); if(e3) throw new Error(e3.message); if(data!==false){ codeOk=true; codeUsed=pw; break; } }
      if(!codeOk) throw new Error("รหัสไม่ถูกต้อง<br><small>ใช้รหัสที่ทีมงานแจกเท่านั้น เช็คตัวพิมพ์ใหญ่-เล็ก</small>");
      password=codeUsed;
      /* มีบัญชีอยู่แล้วแต่รหัสในบัญชีเป็นรหัสรวมชุดเก่า (เข้าเครื่องใหม่ไม่ได้) → ตั้งให้เท่ากับรหัสรวมปัจจุบันแล้วเข้าใหม่ (042) */
      try{
        const {data:healed}=await sb.rpc("login_self_reset",{em:email, c:password});
        if(healed){ const r3=await sb.auth.signInWithPassword({email,password}); if(!r3.error) return; }
      }catch(e){ /* ยังไม่ได้รัน 042 → ไปทางเดิม */ }
      const r2=await sb.auth.signUp({email,password:password.trim()});
      if(r2.error){
        if(/already registered/i.test(r2.error.message)) throw new Error(WRONG);
        throw new Error(r2.error.message);
      }
      /* อีเมลนี้มีบัญชีอยู่แล้วแต่รหัสผิด — Supabase คืน user ปลอมที่ไม่มี identities */
      if(!r2.data.session){
        const ids=(r2.data.user&&r2.data.user.identities)||[];
        throw new Error(ids.length ? "สมัครแล้วแต่ยังเข้าไม่ได้ — เปิด autoconfirm ใน Supabase" : WRONG);
      }
    },
    async signInGoogle(){
      const {error}=await sb.auth.signInWithOAuth({provider:"google",options:{redirectTo:location.href.split("#")[0]}});
      if(error) throw new Error(error.message);
    },
    async signOut(){ await sb.auth.signOut(); location.reload(); },
    async createProfile(p){
      const {error}=await sb.from("profiles").insert({id:session.user.id, name:p.name, color:p.color, avatar:p.avatar||{}});
      if(error){
        /* บอกให้ตรงว่าชนตรงไหน ไม่งั้นผู้ใช้จะเปลี่ยนชื่อไปเรื่อย ๆ ทั้งที่ปัญหาอยู่ที่อื่น */
        const m = error.message || "";
        if(/profiles_name_key/i.test(m))        throw new Error("ชื่อนี้มีคนใช้แล้ว ลองชื่ออื่น");
        if(/profiles_pkey/i.test(m))            throw new Error("คุณมีโปรไฟล์อยู่แล้ว ลองรีเฟรชหน้าเว็บ");
        if(/profiles_handle_key/i.test(m))      throw new Error("ระบบตั้ง handle ให้ไม่สำเร็จ แจ้งทีมงาน");
        if(/ไม่อยู่ในรายชื่อ|ถูกใช้สมัครไปแล้ว/.test(m)) throw new Error(m);
        throw new Error(m);
      }
      /* ตั้งแต่ 040 ฐานข้อมูลลงสปรินต์ให้เองตอนสร้าง profile — อันนี้แค่กันเหนียว ห้ามล้มการสมัครถ้าพลาด
         (เดิมถ้าคำสั่งนี้หลุด คนนั้นจะติด "ยังไม่ได้ลงสปรินต์" เลือกเป้า/ส่งงานไม่ได้ทั้งรุ่น) */
      const {error:e2}=await sb.from("enrollments").upsert(p.joined.map(s=>({profile_id:session.user.id,sprint_idx:s})), {onConflict:"profile_id,sprint_idx", ignoreDuplicates:true});
      if(e2) console.warn("ลงสปรินต์จากหน้าเว็บไม่ผ่าน (ฐานข้อมูลลงให้แล้ว)", e2.message);
    },
    /* ดึงเฉพาะผลสรุปที่ Postgres คิดมาแล้ว
       250 คน = 250 แถว + ฟีด 50 แถว + คำสัญญาของตัวเองอีก 12 แถว
       แทนที่จะลากงานทั้งรุ่นสองหมื่นกว่าแถวมาคำนวณในเครื่องนักเรียน */
    async updateAvatar(av, color){
      const {error}=await sb.from("profiles").update({avatar:av, color}).eq("id",session.user.id);
      if(error) throw new Error(error.message);
    },
    /* onExtras = ฟังก์ชันที่จะถูกเรียกทีหลังเมื่อของประดับสนามโหลดเสร็จ
       เดิมยิง 20 query พร้อมกันแล้วรอ "ครบทุกตัว" ก่อนจะโชว์อะไรสักอย่าง
       เวลารอของทุกคนจึงเท่ากับตัวที่ช้าที่สุด และถ้ามีตัวใดพังก็จอว่างทั้งหน้า
       ตอนนี้แยกเป็นสองชุด: ชุดหลักมาถึงก็เปิดสนามเล่นได้เลย ที่เหลือค่อยตามมาเติม */
    async fetchAll(onExtras){
      const uidNow = session ? session.user.id : null;      // null = โหมดคนดู

      /* ---- ชุดที่ 1: ขาดไม่ได้ ต้องได้ครบถึงจะเปิดสนาม แค่ 4 ตัว ---- */
      const [{data:co},{data:board},{data:feed},{data:pls}]=await pool([
        ()=>must(()=>sb.from("cohort").select("*").eq("id",1).single(), "cohort"),
        ()=>must(()=>sb.from("v_leaderboard").select("*"), "กระดานคะแนน"),
        ()=>soft(()=>sb.from("v_feed").select("*").limit(50), "v_feed"),
        ()=>uidNow ? soft(()=>sb.from("pledges").select("week_no,target").eq("profile_id",uidNow), "pledges") : Promise.resolve({data:[]})
      ], 4);
      cohort=co;

      const runners=(board||[]).map(b=>({
        id:b.id, name:b.name, handle:b.handle, color:b.color, avatar:b.avatar||{},
        house:b.house_id||0, role:b.role,          // 0 = หัวหน้าโค้ช ไม่ประจำบ้าน
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
          freezeLeft: b.freeze_left==null ? null : b.freeze_left,
          weeksHit:   b.weeks_hit||0,
          byDay:      {},                      // โหลดเฉพาะตอนเปิดโปรไฟล์
          style:      (b.pledge_style && b.pledge_style!=="normal") ? b.pledge_style : (b.week_target ? optOf(b.week_target).style : "normal")   // เซิร์ฟเวอร์ไม่รู้จักไฟเขียว (เป้า 4) → เติมจาก config
        }
      }));
      /* ป้าย burnout/weak ย้ายไปติดตอนของประดับมาถึง (markStyles) เพราะมาจาก v_burnout/v_weak */
      const me=runners.find(r=>r.id===uidNow);
      if(me) (pls||[]).forEach(x=>{ me.pledges[x.week_no]=x.target; });
      /* สถานะรุ่นต้องเอาจากเซิร์ฟเวอร์ เพราะมันคิดตามเวลาไทยและตัดรอบตี 4
         ถ้าปล่อยให้เบราว์เซอร์คิดเอง คนที่ตั้งไทม์โซนไม่ตรงจะเห็นวันเหลื่อมไปหนึ่งวัน
         และต้องรู้ด้วยว่ารุ่นเริ่มหรือยัง ไม่งั้นช่วงก่อนเปิดจะโชว์ว่าเป็นวันที่ 1 */
      let todayIdx, started = true, daysUntil = 0;
      try{
        /* ต้องมีเพดานเวลา ไม่งั้นตอนฐานข้อมูลเย็น RPC ตัวนี้ค้างได้ไม่จำกัด
           แล้วหน้าเว็บจะค้างตามทั้งที่มีทางถอยคือคำนวณวันจากเครื่องแทนอยู่แล้ว */
        const {data:cs,error:e0}=await withTimeout(sb.rpc("cohort_status"), 15000, "cohort_status");
        if(e0) throw e0;
        const row = Array.isArray(cs) ? cs[0] : cs;
        todayIdx  = Number(row.day_index);
        S.week = Number(row.week_no)||null; S.weekEndsAt = row.week_ends_at ? new Date(row.week_ends_at).getTime() : null;
        /* โฟกัสแพลตฟอร์ม (037): จำกัดกี่แพลตฟอร์ม + ที่เลือกไว้ล่าสุด · ไม่มีคอลัมน์ = ยังไม่เปิดใช้ */
        S.platLimit = row.plat_limit==null ? null : Number(row.plat_limit); S.platPick = Array.isArray(row.plat_pick) && row.plat_pick.length ? row.plat_pick : null;
        S.vacationWeek = row.vacation_week==null ? null : Number(row.vacation_week); S.weekCut = row.week_cut_time || null;
        S.vacFrom = row.vacation_from_day==null ? null : Number(row.vacation_from_day); S.vacTo = row.vacation_to_day==null ? null : Number(row.vacation_to_day);
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
      let todayCount=0, todaySubs=[];
      if(uidNow){
        const q=await soft(()=>sb.from("submissions").select("created_at")
          .eq("profile_id",uidNow).eq("day_index",todayIdx).eq("status","approved"), "งานที่ส่งวันนี้");
        todaySubs=(q.data||[]).map(s=>new Date(s.created_at).getTime());
        todayCount=todaySubs.length;
      }
      /* ---- ชุดที่ 2: ของประดับสนาม เริ่มยิงหลังชุดหลักมาถึงแล้วเท่านั้น
             และทยอยทีละ 3 ตัว เพื่อไม่ไปแย่ง connection กับชุดหลัก ---- */
      const extrasReady = pool([
        ()=>soft(()=>sb.from("v_burnout").select("profile_id"), "v_burnout"),
        ()=>soft(()=>sb.from("v_weak").select("profile_id"), "v_weak"),
        ()=>soft(()=>sb.from("v_house_cup").select("*"), "v_house_cup"),
        ()=>soft(()=>sb.from("v_week_kings").select("*"), "v_week_kings"),
        ()=>soft(()=>sb.from("v_week_ta_kings").select("*"), "v_week_ta_kings"),
        /* PostgREST ตัดที่ 1,000 แถว — ดึงแค่ 2 วันล่าสุด (ใช้กับเควส/ปุ่มเชียร์วันนี้) ส่วนยอดรวมมาจาก v_cheer_stats */
        ()=>soft(()=>sb.from("cheers").select("from_id,to_id,emoji,day_index").gte("day_index",(todayIdx||1)-1).order("id",{ascending:false}).limit(5000), "cheers"),
        ()=>soft(()=>sb.from("v_cheers_week").select("*"), "v_cheers_week"),
        ()=>soft(()=>sb.from("v_duels").select("*"), "v_duels"),
        ()=>soft(()=>sb.from("v_boss_progress").select("*"), "v_boss_progress"),
        ()=>soft(()=>sb.from("v_boss_kills").select("boss_id,week_no,name,profile_id"), "v_boss_kills"),
        ()=>soft(()=>sb.from("v_reach").select("profile_id,total_views,total_likes,best_views,pieces"), "v_reach"),
        ()=>soft(()=>sb.from("v_kudos").select("profile_id,n"), "v_kudos"),
        ()=>soft(()=>sb.from("live_sessions").select("id,title,starts_at,ends_at").gte("ends_at", new Date(Date.now()-2*3600e3).toISOString()).order("starts_at"), "live_sessions"),
        ()=>uidNow ? soft(()=>sb.from("checkins").select("session_id").eq("profile_id",uidNow), "checkins") : Promise.resolve({data:[]}),
        ()=>soft(()=>sb.from("v_holiday_grinders").select("profile_id,n"), "v_holiday_grinders"),
        ()=>soft(()=>sb.from("v_cheer_stats").select("profile_id,given,received,quest_days"), "v_cheer_stats"),
        ()=>soft(()=>sb.from("nudges").select("from_id,to_id,day_index").gte("day_index",(todayIdx||1)-1).limit(5000), "nudges")
      ], 3).then(([{data:burn},{data:weakRows},{data:cups},{data:kingRows},{data:taKingRows},{data:cheerRows},
                   {data:cheerWeeks},{data:duelRows},{data:bossRows},{data:killRows},{data:reachRows},
                   {data:kudosRows},{data:sessRows},{data:ckRows},{data:holRows},{data:cheerStatRows},{data:nudgeRows}])=>({
        cheerStats: cheerStatRows||[], nudges: nudgeRows||[],
        burnIds: (burn||[]).map(b=>b.profile_id),
        weakIds: (weakRows||[]).map(b=>b.profile_id),
        cups: cups||[],
        kings: (kingRows||[]).concat(taKingRows||[]),      // King ของบ้าน + King of TA (TA มีรางวัลของตัวเอง)
        cheers: cheerRows||[], cheerWeeks: cheerWeeks||[], duels: duelRows||[],
        bosses: bossRows||[], bossKills: killRows||[],
        reach: reachRows||[], kudos: kudosRows||[], holiday: holRows||[],
        sessions: sessRows||[], myCheckins: (ckRows||[]).map(c=>c.session_id)
      }));
      if(typeof onExtras === "function") extrasReady.then(onExtras).catch(e=>console.warn("ของประดับสนามโหลดไม่ครบ", e));
      return {
        today: todayIdx,
        me: me ? me.name : null,
        postedToday: (todayCount||0) > 0,
        todayCount, todaySubs,
        started, daysUntil, startDate: co.start_date,
        extrasReady,                 // ของประดับสนามตามมาทีหลัง คนเรียกจะ await เองหรือไม่ก็ได้
        runners,
        subs:(feed||[]).map(f=>({
          id:f.id, who:f.name, day:f.day_index, sp:f.sprint_idx,
          plat:f.platform, url:f.url, ts:new Date(f.created_at).getTime(),
          kind:f.kind||null, views:f.views||0, likes:f.likes||0, note:f.note||null, kudos:!!f.kudos}))
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
      const [{data},{data:wk}]=await Promise.all([
        sb.from("submissions")
          .select("id,platform,url,day_index,sprint_idx,created_at,kind,views,likes,note,kudos(submission_id)")
          .eq("profile_id",runner.id).eq("status","approved")
          .order("created_at",{ascending:false}).limit(400),
        sb.from("v_week_progress").select("week_no,target,done,hit,finished").eq("profile_id",runner.id)
      ]);
      const byDay={};
      (data||[]).forEach(s=>{ byDay[s.day_index]=(byDay[s.day_index]||0)+1; });
      /* ส่งก่อน 6 โมงเช้าเวลาไทย */
      const early=(data||[]).some(s=>((new Date(s.created_at).getUTCHours()+7)%24) < 6);
      return {byDay, weeks:wk||[], early, recent:(data||[]).map(s=>({
        id:s.id, who:runner.name, day:s.day_index, sp:s.sprint_idx,
        plat:s.platform, url:s.url, ts:new Date(s.created_at).getTime(),
        kind:s.kind||null, views:s.views||0, likes:s.likes||0, note:s.note||null, kudos:!!(s.kudos&&s.kudos.length)}))};
    },
    async submit({url, platform, kind, note}){
      const {error}=await sb.from("submissions").insert({
        profile_id:session.user.id, url, url_key:url, platform, day_index:1, sprint_idx:0, kind:kind||null, note:note||null});
      if(error){
        if(error.code==="23505"||/duplicate/i.test(error.message)){
          /* บอกให้ชัดว่าลิงก์นี้ชนกับของใคร — ของตัวเองหรือคนอื่น */
          let who=null;
          try{
            const {data:key}=await sb.rpc("norm_url",{u:url});
            const {data:row}=await sb.from("submissions").select("profile_id,created_at").eq("url_key",key).maybeSingle();
            if(row){
              const mine=row.profile_id===session.user.id;
              const r=S.runners.find(x=>x.id===row.profile_id);
              who = mine ? `คุณส่งลิงก์นี้ไปแล้วเมื่อ ${ago(new Date(row.created_at).getTime())}<br>ดูได้ที่ MY STATUS → งานที่ส่งล่าสุด`
                         : `ลิงก์นี้ ${r?r.name:"คนอื่น"} ส่งไปแล้วเมื่อ ${ago(new Date(row.created_at).getTime())}<br>ถ้าเป็นงานของคุณจริง แจ้งทีมงาน`;
            }
          }catch(e){}
          throw new Error(who || "ลิงก์นี้ถูกส่งไปแล้ว");
        }
        throw new Error(error.message.replace(/^.*?:\s*/,""));
      }
    },
    /* ---- ข้อมูลต่อชิ้น (เจ้าของแก้เอง: แพลตฟอร์ม/ประเภท/สรุป/ยอดวิว/ไลก์) ---- */
    async updateSub(id, patch){
      const p={}; if(patch.platform!=null) p.platform=patch.platform; if(patch.kind!==undefined) p.kind=patch.kind||null;
      if(patch.note!==undefined) p.note=patch.note||null; if(patch.views!=null) p.views=Math.max(0,+patch.views||0); if(patch.likes!=null) p.likes=Math.max(0,+patch.likes||0);
      const {error}=await sb.from("submissions").update(p).eq("id",id).eq("profile_id",session.user.id);
      if(error) throw new Error(error.message.replace(/^.*?:\s*/,""));
    },
    /* แก้ลิงก์งานตัวเอง (โพสต์ผิดแอคเคาท์ / ลบโพสต์เดิมแล้วลงใหม่) — วันที่กับยอดไม่ขยับ */
    async fixUrl(id, url){
      const {error}=await sb.rpc("fix_submission_url", {sid:id, new_url:url});
      if(error) throw new Error(error.message.replace(/^.*?:\s*/,""));
    },
    async checkin(sessionId){
      const {error}=await sb.from("checkins").insert({session_id:sessionId, profile_id:session.user.id});
      if(error){ if(error.code==="23505") return; throw new Error(/policy/i.test(error.message)?"เช็คอินได้เฉพาะช่วงเวลาเรียนสด":error.message); }
    },
    /* ---- ขอฟีเจอร์ / แจ้งบั๊ก (044) ---- */
    async feedbackList(){
      const [{data:rows,error},{data:mine}] = await Promise.all([
        sb.from("v_feedback").select("*").order("votes",{ascending:false}).order("created_at",{ascending:false}).limit(200),
        session ? sb.from("feedback_votes").select("feedback_id").eq("profile_id",session.user.id) : Promise.resolve({data:[]})
      ]);
      if(error) throw new Error(error.message);
      const my=new Set((mine||[]).map(v=>v.feedback_id));
      return (rows||[]).map(r=>Object.assign(r,{mine:my.has(r.id), own:session && r.profile_id===session.user.id}));
    },
    async feedbackSend(kind, text, page){
      const {error}=await sb.from("feedback").insert({profile_id:session.user.id, kind, text, page});
      if(error) throw new Error(error.message.replace(/^.*?:\s*/,""));
    },
    async feedbackVote(id, on){
      const q = on ? sb.from("feedback_votes").insert({feedback_id:id, profile_id:session.user.id})
                   : sb.from("feedback_votes").delete().eq("feedback_id",id).eq("profile_id",session.user.id);
      const {error}=await q; if(error && error.code!=="23505") throw new Error(error.message);
    },
    async nudge(toId){
      const {error}=await sb.rpc("nudge",{to_pid:toId});
      if(error) throw new Error(/nudge|schema cache|does not exist/i.test(error.message) ? "ฟีเจอร์สะกิดยังไม่เปิด (รอทีมงานอัปเดตฐานข้อมูล)" : error.message.replace(/^.*?:s*/,""));
    },
    /* ---- สังคม: เชียร์ / ดวล / ลบงานล่าสุด / push ---- */
    async cheer(toId, emoji){
      const {error}=await sb.from("cheers").insert({from_id:session.user.id, to_id:toId, emoji, day_index:1});
      if(error){ if(error.code==="23505") throw new Error("วันนี้เชียร์คนนี้ไปแล้ว"); throw new Error(error.message.replace(/^.*?:\s*/,"")); }
    },
    async duelCreate(opponent){
      const {error}=await sb.from("duels").insert({challenger:session.user.id, opponent});
      if(error) throw new Error(error.message.replace(/^.*?:\s*/,""));
    },
    async duelUpdate(id, patch){
      const {error}=await sb.from("duels").update(patch).eq("id",id);
      if(error) throw new Error(error.message.replace(/^.*?:\s*/,""));
    },
    async deleteSub(id){
      const {error, count}=await sb.from("submissions").delete({count:"exact"}).eq("id",id).eq("profile_id",session.user.id);
      if(error) throw new Error(error.message.replace(/^.*?:\s*/,""));
      if(!count) throw new Error("ลบไม่ได้ — ลบได้เฉพาะภายใน 30 นาทีหลังส่ง");
    },
    async savePush(sub){
      const {error}=await sb.from("push_subs").upsert({profile_id:session.user.id, ...sub},{onConflict:"profile_id,endpoint"});
      if(error) throw new Error(error.message);
    },
    async removePush(endpoint){ await sb.from("push_subs").delete().eq("profile_id",session.user.id).eq("endpoint",endpoint); },
    /* เปลี่ยนชื่อบนสนาม — ห้ามซ้ำทั้งรุ่น ยาวไม่เกิน 10 ตัว */
    async rename(name){
      const {error}=await sb.from("profiles").update({name}).eq("id",session.user.id);
      if(error){
        if(/profiles_name_key/i.test(error.message)) throw new Error("ชื่อนี้มีคนใช้แล้ว ลองชื่ออื่น");
        if(/name_len/i.test(error.message)) throw new Error("ชื่อยาวได้ไม่เกิน 10 ตัวอักษร");
        throw new Error(error.message);
      }
    },
    /* แก้แพลตฟอร์มของงานตัวเอง — trigger ฝั่ง DB ยอมให้เปลี่ยนแค่ช่องนี้ */
    async fixPlatform(id, platform){
      const {error}=await sb.from("submissions").update({platform}).eq("id",id).eq("profile_id",session.user.id);
      if(error) throw new Error(error.message.replace(/^.*?:\s*/,""));
    },
    async setPledge(week,target,plats){
      const row={profile_id:session.user.id, week_no:week, target};
      if(Array.isArray(plats) && plats.length) row.platforms=plats;        // ไม่ส่ง = เซิร์ฟเวอร์ใช้ของสัปดาห์ก่อน
      const {error}=await sb.from("pledges")
        .upsert(row, {onConflict:"profile_id,week_no"});
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
        .on("postgres_changes",{event:"*",schema:"public",table:"duels"},bump)
        .subscribe();
    }
  };
})();
const DB = LIVE ? LiveDB : DemoDB;

/* ================= STATE ================= */
/* ส่วนประดับสนามต้องมีค่าตั้งต้นเป็นค่าว่าง เพราะตอนนี้หน้าจอวาดรอบแรกได้
   ตั้งแต่ชุดข้อมูลหลักมาถึง โดยยังไม่รอถ้วยบ้าน/คิง/บอส/ยอดวิว ที่ตามมาทีหลัง */
let S = {today:1, me:null, runners:[], subs:[], raceFilter:"near", boardFilter:"all", spectator:false,
         cups:[], kings:[], kingsNow:new Set(), cheers:[], cheerWeeks:[], duels:[], bosses:[], bossKills:[],
         reach:{}, kudos:{}, holiday:{}, sessions:[], myCheckins:new Set()};
let BOOTSTATE = null;

/* ================= UI HELPERS ================= */
let toastT;
/* toast ต่อคิว: ส่งงานสำเร็จ + ปลดล็อก + ป้ายใหม่ มาพร้อมกันจะเห็นครบทุกอัน ไม่ทับกัน */
const _tq=[]; let _tOn=false;
function toast(msg){
  if(_tq[_tq.length-1]===msg) return;
  _tq.push(msg); if(!_tOn) _tNext();
}
function _tNext(){
  const msg=_tq.shift(); if(msg==null){ _tOn=false; return; }
  _tOn=true; const t=$("toast"); t.innerHTML=msg; t.classList.add("on");
  clearTimeout(toastT);
  toastT=setTimeout(()=>{ t.classList.remove("on"); setTimeout(_tNext, 320); }, _tq.length ? 2300 : 3200);
}
/* ---- ข้อความบนหน้าโหลด ----------------------------------------------
   ฐานข้อมูลที่ยังไม่ถูกแตะมาสักพักจะตอบช้ามากในครั้งแรก (วัดได้ถึง 22 วินาที)
   ถ้าปล่อยให้จอค้างเงียบ ๆ คนจะคิดว่าเว็บพัง แล้วรีเฟรชซ้ำจนยิ่งช้าเข้าไปอีก
   จึงบอกไปตรง ๆ ว่ากำลังปลุกเซิร์ฟเวอร์ และถ้าพลาดจริงก็ให้ปุ่มลองใหม่ ไม่ต้องรีโหลดเอง */
let _ldTimer=null;
function loaderStart(){
  const ld=$("loader"), box=ld&&ld.querySelector(".ldBox"); if(!ld||!box) return;
  ld.hidden=false;
  const t0=Date.now();
  box.innerHTML='<div class="ldDots"><i></i><i></i><i></i></div><span id="ldMsg">กำลังโหลดสนาม…</span>';
  clearInterval(_ldTimer);
  _ldTimer=setInterval(()=>{
    const s=Math.round((Date.now()-t0)/1000), m=$("ldMsg"); if(!m) return;
    if(s>=8)  m.textContent="กำลังปลุกเซิร์ฟเวอร์… ("+s+" วิ)";
    if(s>=20) m.textContent="เซิร์ฟเวอร์เพิ่งตื่น รอบแรกช้าหน่อย… ("+s+" วิ)";
  }, 1000);
}
function loaderFail(msg, retry){
  const ld=$("loader"), box=ld&&ld.querySelector(".ldBox"); if(!ld||!box) return;
  clearInterval(_ldTimer); ld.hidden=false;
  box.innerHTML='<div style="margin-bottom:10px">โหลดสนามไม่สำเร็จ<br><small style="opacity:.7">'+
                String(msg||"").replace(/[<>]/g,"")+'</small></div>'+
                '<button class="btn" id="ldRetry">ลองใหม่อีกครั้ง</button>';
  const b=$("ldRetry"); if(b) b.onclick=()=>{ loaderStart(); retry(); };
}
function show(id){
  const ld=$("loader"); if(ld) ld.hidden=true;
  clearInterval(_ldTimer);
  if(id==="scArena") setTimeout(renderTodayBar, 0);
  document.querySelectorAll(".screen").forEach(s=>s.classList.toggle("on", s.id===id));
  $("sky").style.opacity = id==="scArena" ? ".28" : "1";
  window.scrollTo(0,0);
}
window.showPage=showPage;
function showPage(id, fromPop){
  if(!fromPop && $("scArena").classList.contains("on")){
    const cur=(history.state&&history.state.page)||"pgRace";
    if(cur!==id) history.pushState({page:id}, "");
  }
  document.querySelectorAll(".page").forEach(p=>p.classList.toggle("on", p.id===id));
  document.querySelectorAll(".navBtn").forEach(b=>b.classList.toggle("on", b.dataset.page===id));
  if(id==="pgStatus") renderStatus();
  if(id==="pgBoard")  renderBoard();
  if(id==="pgAdmin")  renderAdmin();
  window.scrollTo(0,0);
  if(typeof updateFab==="function") updateFab();
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
/* ทุกคนวิ่ง — TA อยู่ในลู่ของบ้านตัวเอง หัวหน้าโค้ชโผล่ทุกบ้าน
   แต่ค่าเฉลี่ยบ้านและเลขอันดับคิดจากนักเรียนเท่านั้น */
const students = () => S.runners.filter(r => r.role !== "coach");
const rankOf   = name => ranked().filter(r=>roleOf(r)==="student").findIndex(r=>r.name===name)+1;
const ranked = () => [...S.runners].sort((a,b)=>{
  const A=stats(a), B=stats(b);
  return B.contents-A.contents || B.rate-A.rate || B.weekStreak-A.weekStreak;
});

/* ================= PLEDGE CARD ================= */
function renderPledge(){
  if(S.spectator){
    $("pledgeCard").innerHTML =
      '<div class="paceNum on">👀</div>'
      + '<div class="pledgeTxt"><span class="big normal">โหมดคนดู</span><br>'
      + 'เห็นสนามแข่งและกระดานแบบเรียลไทม์ · กดที่เลนหรือแถวเพื่อดูโปรไฟล์<br>'
      + '<span style="color:var(--dim)">ส่งงานหรือรับเป้าต้องเป็นนักเรียนในรุ่นเท่านั้น</span></div>'
      + '<button class="btn go" style="max-width:260px" onclick="leaveSpectator()">▶ เข้าสู่ระบบเพื่อลงแข่ง</button>'
      + bossHTML();
    return;
  }
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
  if(noPledgeWeek() && !st.weekTarget){
    const vacTxt = isVacation()
      ? `<span class="big normal">🏖 ปิดเทอม ${dayDateTH(S.vacFrom)} – ${dayDateTH(S.vacTo)}</span><br>ไม่ต้องส่งการบ้าน streak ไม่ขาด ร่างไม่โดนลงโทษ · กลับมาส่งกัน ${dayDateTH(S.vacTo+1)}<br>
        <span style="color:var(--gold)">ใครส่งช่วงนี้ = นักเรียนดีเด่น 🏅 นับรวมยอดและได้ป้าย STAR STUDENT</span>`
      : `<span class="big normal">กลับมาแล้ว! 💪</span><br>งานวันนี้นับรวมยอดเลย · สัปดาห์ใหม่เริ่มหลังไลฟ์ ${DOW_TH[C.WEEK_CUTOFF_DOW==null?3:+C.WEEK_CUTOFF_DOW]} ${S.weekCut||C.WEEK_CUTOFF_TIME||"19:30"} น.<br>
        <span style="color:var(--dim)">ค่อยเลือกเป้าสัปดาห์ใหม่ตอนนั้น</span>`;
    $("pledgeCard").innerHTML=`<div class="paceNum on">${isVacation()?"🏖":"💪"}</div><div class="pledgeTxt">${vacTxt}</div>` + starBoardHTML() + bossHTML();
    return;
  }
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
  const ringColor = o.style==="flame" ? "#ffb020" : o.style==="red" ? "#ff2436" : o.style==="boost" ? "#39e5ff" : o.style==="green" ? "#5ef08c" : r.color;
  /* เซิร์ฟเวอร์ตัดรอบพุธ 19:30 ไม่ใช่เที่ยงคืนวันที่ 7 — ใช้เวลาตัดจริงถ้ามี ไม่งั้นเช้าวันพุธจะโชว์ "เหลือ 0 วัน" ทั้งที่ยังส่งได้ */
  const dayLeft = S.weekEndsAt ? Math.max(1, Math.ceil((S.weekEndsAt-Date.now())/864e5)) : weekEnd(cw)-S.today+1;
  /* เตือนว่าวันนี้ยังไม่ได้ส่งงาน — ตัวเดียวที่ทำงานได้โดยไม่ต้องพึ่งบริการภายนอก */
  const left = cutoffLeft().split(":");
  const nudge = "";
  const _unused = S.postedToday ? "" :
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
    </div>
    <div class="rival">${st.burnout
      ? `💀 สัปดาห์นี้เป็นร่างกระโหลก · ทำครบ ${st.weekTarget} ชิ้น = <b style="color:var(--gold)">ฟื้นคืนชีพ</b> ได้ป้าย REVIVED · `
      : st.weak ? `😵 สัปดาห์นี้เป็นร่างหมดแรง (พลาดเป้าสัปดาห์ที่แล้ว) · ทำครบสัปดาห์นี้แล้วสัปดาห์หน้ากลับมาปกติ · ` : ""}${rivalHTML(r)}</div>`
    + myCheersHTML() + duelBannerHTML() + bossHTML() + nudge;
  /* ยุบเหลือบรรทัดเดียวเมื่อเลือกเป้าแล้ว — ขยายเองถ้ามีเรื่องต้องกด (ดวล/เชียร์ใหม่/บอสใกล้ตาย) */
  const d=myDuel(); const needAct = d && ((d.status==="pending" && d.opponent===r.id) || (d.status==="done" && d.winner===r.id && d.prize_hat==null));
  const key="pledgeOpen."+r.id; let open=false; try{ open=localStorage.getItem(key)==="1"; }catch(e){}
  if(needAct) open=true;
  const bossList=(S.bosses||[]).filter(b=>b.week_no===cw && (b.house_id==null || b.house_id===r.house));
  const chips = bossList.map(b=>`<span class="pchip ${b.hp-b.damage<=b.hp*.3&&b.damage<b.hp?"hot":""}">${b.damage>=b.hp?"💥 บอสล้มแล้ว":`👹 บอส HP ${Math.max(0,b.hp-b.damage)}/${b.hp}`}</span>`).join("")
    + (d ? `<span class="pchip hot">⚔️ ${d.status==="pending"?"รอรับคำท้า":d.status==="active"?`ดวล ${d.challenger===r.id?d.challenger_score:d.opponent_score}:${d.challenger===r.id?d.opponent_score:d.challenger_score}`:"เลือกหมวกให้ผู้แพ้"}</span>` : "")
    + (cheersToday(r.id).length ? `<span class="pchip">👏 ${cheersToday(r.id).length}</span>` : "");
  $("pledgeCard").insertAdjacentHTML("afterbegin", `<div class="plSum" onclick="togglePledge()">
      <span class="big ${o.style}" style="font-size:13px">${o.name}</span> <b>${st.weekDone}/${st.weekTarget}</b>
      <span>เหลือ ${dayLeft} วัน${st.weekDone>=st.weekTarget?" · ครบเป้าแล้ว 🎉":" · ขาดอีก "+(st.weekTarget-st.weekDone)}</span>
      ${chips}<em>${open?"▲ ย่อ":"▼ รายละเอียด · คู่แข่ง · เชียร์ · ดวล · บอส"}</em></div>`);
  $("pledgeCard").classList.toggle("collapsed", !open);
}
function togglePledge(){
  const r=meR(); if(!r) return;
  const open=$("pledgeCard").classList.contains("collapsed");
  try{ localStorage.setItem("pledgeOpen."+r.id, open?"1":"0"); }catch(e){}
  renderPledge();
}

/* ================= TRACK ================= */
function raceList(){
  const all=ranked();
  if(S.raceFilter==="all") return all;
  if(S.raceFilter==="ta") return all.filter(r=>roleOf(r)!=="student");
  if(S.raceFilter!=="near") return all.filter(r=>r.house===+S.raceFilter || roleOf(r)==="head");
  const i=all.findIndex(r=>r.name===S.me);
  if(i<0) return all.slice(0,NEAR*2+1);
  return all.slice(Math.max(0,i-NEAR), i+NEAR+1);
}
function renderFilters(){
  const mk=(cur,pfx)=>[(S.spectator || pfx==="b") ? "" : `<button class="fBtn ${cur==="near"?"on":""}" data-f="near"
      style="${cur==="near"?"background:linear-gradient(180deg,#5b51c4,#332a80)":""}">ใกล้ฉัน</button>`,
    `<button class="fBtn ${cur==="all"?"on":""}" data-f="all"
      style="${cur==="all"?"background:linear-gradient(180deg,#5b51c4,#332a80)":""}">ทั้งรุ่น</button>`]
    .concat(HOUSES.map(h=>`<button class="fBtn ${cur===String(h.id)?"on":""}" data-f="${h.id}"
      style="${cur===String(h.id)?`background:linear-gradient(180deg,${h.color},${shift(h.color,-90)});color:#0d0a22`:""}">
      ${h.id===champHouse()?"🏆 ":""}${h.emoji} ${h.name}</button>`))
    .concat(S.runners.some(r=>roleOf(r)!=="student") ? [`<button class="fBtn ${cur==="ta"?"on":""}" data-f="ta"
      style="${cur==="ta"?"background:linear-gradient(180deg,#5ef08c,#1f8a4a);color:#0d0a22":"color:#5ef08c"}">🎓 เฉพาะโค้ช</button>`] : []).join("");
  const meBtn = S.spectator ? "" : `<button class="fBtn goMe" data-me="1">📍 ตัวฉัน</button>`;
  $("raceFilters").innerHTML=mk(S.raceFilter,"r")+meBtn;
  $("boardFilters").innerHTML=mk(S.boardFilter,"b");
}
function renderTrack(){
  const list=raceList();
  $("zones").innerHTML=SPRINTS.map((sp,i)=>`<div class="zone"><b>S${i+1}<span class="zt"> ${sp.e} ${sp.n}</span></b></div>`).join("");
  const st=stats(meR());
  $("cps").innerHTML =
    [Math.round(FINISH/3),Math.round(FINISH*2/3),FINISH].filter((v,i,a)=>a.indexOf(v)===i)
      .map(v=>`<div class="cp${v===FINISH?" finish":""}" style="left:calc(${v/FINISH*100}% - 7px)"><em>${v===FINISH?"🏁 ":""}${v} ชิ้น</em></div>`).join("")
    + (st.target ? `<div class="cp pace" style="left:${Math.min(100,st.target/FINISH*100)}%"><em>เป้าของคุณ ${st.target}</em></div>` : "");

  $("lanes").innerHTML = list.length ? list.map(r=>{
    const s=stats(r), h=houseOf(r.house);
    const p=Math.min(s.contents/FINISH,1);
    const role=roleOf(r), rtag=role==="head"?" COACH":role==="ta"?" TA":"";
    /* ป้ายชื่อ+ตัวเลขวางอยู่เหนือพิกเซลบนสุดของตัวละครพอดี (คิดจากหมวก/ผมจริง)
       ต้นสนามชิดซ้าย กลางสนามอยู่กลางหัว ใกล้เส้นชัยชิดขวา จะได้ไม่ล้นออกนอกสนาม */
    const av=avOf(r), top=spriteTop(av,s.style);
    const side = p<0.12 ? "edgeL" : p>0.78 ? "edgeR" : "";
    return `<div class="lane ${r.name===S.me?"meLane":""}" data-n="${r.name}">
      <div class="runner ${r.name===S.me?"me":""} ${s.style} ${r.house===champHouse()&&roleOf(r)==="student"?"cup":""} ${s.contents>=FINISH?"champ":""}" style="--p:${p}">
        <div class="body">
          <div class="lbl ${side}" style="bottom:${(ROWS-top)*2}px">
            <span class="name ${role}"><i>${role==="head"?"🎓":h.emoji}</i> ${isKingNow(r)?"👑 ":""}${starN(r)?"🏅 ":""}${r.name}${rtag}${s.weekTarget?` · ${s.weekDone}/${s.weekTarget}`:""}${s.dayStreak>=2?` <em class="stk">🔥${s.dayStreak}</em>`:""}${av.sword?` <em class="duelTag">⚔️ FIGHTING</em>`:""}</span>
            <span class="tag">${s.contents}${s.contents>=FINISH?" 🏆":""}</span>
          </div>
          ${hasAura(s.style)?aura(s.style):""}${starN(r)?'<span class="medal" title="นักเรียนดีเด่น ส่งงานช่วงปิดเทอม">🏅</span>':""}${sprite(av,2,s.style)}${s.dayStreak>=7?`<span class="feetfire ${s.dayStreak>=14?"big":""}"></span>`:""}
          ${s.dayStreak?'<span class="dust"></span><span class="dust b"></span>':''}</div>
        <div class="shadow"></div>
      </div></div>`;
  }).join("") : `<div class="noJoin">ยังไม่มีใครในกลุ่มนี้</div>`;

  renderTaRoom();
  renderDuelRoom();
  $("trackTitle").textContent=`RACE TRACK · ${FINISH} CONTENTS`;
  const cc=champCup();
  $("trackSub").textContent = cc
    ? `🏆 บ้านแชมป์สัปดาห์ที่แล้ว: ${houseOf(cc.house_id).emoji} ${houseOf(cc.house_id).name} (เฉลี่ย ${cc.avg_pieces} ชิ้น/คน) · ระยะทาง = จำนวนคอนเทนต์`
    : "ระยะทาง = จำนวนคอนเทนต์ · เส้นฟ้า = เป้าของคุณ ณ สัปดาห์นี้";
}

/* ห้องรวม TA + หัวหน้าโค้ช — เรียงตามจำนวนชิ้น */
function renderTaRoom(){
  const list=ranked().filter(r=>roleOf(r)!=="student");
  $("taPanel").hidden = !list.length;
  $("stTa").hidden = !list.length;
  if(!list.length){ if(document.querySelector('#subTabs button.on')?.dataset.st==="ta") setSubTab("track"); return; }
  const total=list.reduce((n,r)=>n+stats(r).contents,0);
  $("taSub").textContent=`TA ${list.filter(r=>roleOf(r)==="ta").length} คน + หัวหน้าโค้ช · เฉลี่ย ${(total/list.length).toFixed(1)} ชิ้น/คน · คลิกดูโปรไฟล์`;
  $("taRoom").innerHTML=list.map((r,i)=>{
    const s=stats(r), h=houseOf(r.house), role=roleOf(r), p=Math.min(1,s.contents/FINISH);
    return `<div class="taRow ${r.name===S.me?"me":""} ${s.style}" data-n="${r.name}">
      <div class="taRank">${i===0?"👑":"#"+(i+1)}</div>
      <div class="taSpr">${hasAura(s.style)?aura(s.style):""}${sprite(avOf(r),2,s.style)}</div>
      <div class="taInfo">
        <div class="taName" style="color:${nameColor(r)}">${role==="head"?"🎓":h.emoji} ${r.name}
          <small>${role==="head"?"หัวหน้าโค้ช":"TA · "+h.name}</small></div>
        <div class="taBar"><i style="width:${p*100}%;background:${role==="head"?"linear-gradient(90deg,#ff4d6d,#ff8a9a)":"linear-gradient(90deg,#1f8a4a,#5ef08c)"}"></i>
          <span>${s.contents} / ${FINISH}${s.contents>=FINISH?" 🏆":""}</span></div>
        <div class="taMeta">สัปดาห์นี้ <b>${s.weekDone}${s.weekTarget?"/"+s.weekTarget:""}</b> ชิ้น · ทำแล้ว ${s.activeDays} วัน${s.dayStreak>=2?` · <em class="stk">🔥${s.dayStreak}</em>`:""}${s.burnout?" · 💀":s.weak?" · 😵":""}</div>
      </div>
    </div>`;
  }).join("");
}
$("taRoom").onclick=e=>{ const t=e.target.closest(".taRow"); if(t) openProfile(t.dataset.n); };

/* ================= SCOREBOARD ================= */
function renderHouses(){
  const rows=HOUSES.map(h=>{
    const mem=students().filter(r=>r.house===h.id);
    const sts=mem.map(stats);
    const avg = sts.length ? sts.reduce((a,s)=>a+s.contents,0)/sts.length : 0;
    const rate= sts.length ? sts.reduce((a,s)=>a+s.rate,0)/sts.length : 0;
    const behind = sts.filter(s=>s.pace<-3).length;
    const laser = sts.filter(s=>s.style==="red"||s.style==="flame").length;
    return {h, mem:mem.length, avg, rate, behind, laser};
  }).sort((a,b)=>b.rate-a.rate || b.avg-a.avg);

  /* ประวัติถ้วยรายสัปดาห์ */
  let hist=$("cupHist");
  if(!hist){ hist=document.createElement("div"); hist.id="cupHist"; $("houseGrid").parentNode.insertBefore(hist,$("houseGrid")); }
  const cc=champCup();
  hist.innerHTML = (S.cups||[]).length
    ? `<div class="cupNow">${cc ? `🏆 บ้านแชมป์สัปดาห์ที่แล้ว: <b style="color:${houseOf(cc.house_id).color}">${houseOf(cc.house_id).emoji} ${houseOf(cc.house_id).name}</b> · เฉลี่ย ${cc.avg_pieces} ชิ้น/คน` : "🏆 ถ้วยสัปดาห์ที่แล้วยังไม่ตัดสิน"}</div>
       <div class="cupHist">${(S.cups||[]).map(c=>`<span title="เฉลี่ย ${c.avg_pieces} ชิ้น/คน">W${c.week_no} ${houseOf(c.house_id).emoji}</span>`).join("")}</div>`
    : `<div class="cupNow" style="color:var(--dim)">🏆 ถ้วยบ้านรายสัปดาห์ — ตัดสินทุกต้นสัปดาห์จากค่าเฉลี่ยชิ้นต่อคน บ้านที่ชนะได้มงกุฎบนสนาม 7 วัน</div>`;
  $("houseGrid").innerHTML=rows.map((x,i)=>`
    <div class="houseCard" style="border-color:${x.h.color} ${shift(x.h.color,-110)} ${shift(x.h.color,-110)} ${x.h.color}">
      <div class="hr">${x.h.emoji}</div>
      <div class="hn" style="color:${x.h.color}">${x.h.id===champHouse()?"🏆 ":""}${x.h.name}${cupsOf(x.h.id)?` <small style="font-size:11px;color:var(--gold)">ถ้วย ×${cupsOf(x.h.id)}</small>`:""}</div>
      <div class="hth">${x.h.th} · ${x.mem} คน</div>
      <div class="hv">${x.avg.toFixed(1)}</div>
      <div class="hl">คอนเทนต์เฉลี่ยต่อคน · ทำได้ ${Math.round(x.rate)}% ของเป้า</div>
      <div class="hl" style="margin-top:8px">
        🔥 โหมดเร่ง ${x.laser} คน · ⚠ ตามหลัง ${x.behind} คน
      </div>
    </div>`).join("");
}
function boardList(){
  let all=ranked();
  if(S.boardMode==="reach"){ const v=r=>((S.reach||{})[r.id]||{}).total_views||0; all=[...all].sort((a,b)=>v(b)-v(a)); }
  if(S.boardFilter==="ta") return all.filter(r=>roleOf(r)!=="student");
  return S.boardFilter==="all"||S.boardFilter==="near" ? all : all.filter(r=>r.house===+S.boardFilter || roleOf(r)==="head");
}
function renderBoard(){
  renderHouses(); renderNearMe();
  const full=ranked();
  const list=boardList();
  $("board").innerHTML=list.map(r=>{
    const s=stats(r), h=houseOf(r.house);
    const role=roleOf(r);
    const i=list.indexOf(r);                                   // เลขเรียงตามแถวที่เห็น 1..N · เหรียญเฉพาะ 3 อันดับแรก
    const medal=i===0?"🥇":i===1?"🥈":i===2?"🥉":String(i+1).padStart(2,"0");
    const o=s.weekTarget?optOf(s.weekTarget):null;
    const wk = o ? `<span class="wkTag ${s.weekDone>=s.weekTarget?"hit":o.style}">${s.weekDone}/${s.weekTarget}${o.style==="red"?" 🔴":o.style==="flame"?" 🔥":""}</span>`
                 : `<span class="wkTag normal" style="opacity:.5">—</span>`;
    const pc = s.pace>0?"var(--green)":s.pace<0?"var(--orange)":"var(--cyan)";
    return `<tr class="${r.name===S.me?"me":""}" data-n="${r.name}" id="row-${r.name}">
      <td class="rk ${i<3?"top"+(i+1):""}">${medal}</td>
      <td class="nm" style="color:${boardColor(r,s)}">${isKingNow(r)?"👑 ":""}${starN(r)?"🏅 ":""}${r.name} <em class="lvMini">Lv${levelOf(xpOf(r))}</em>
        <span style="font-family:var(--f-th);font-size:11px;color:var(--dim)">${r.handle}</span></td>
      <td class="hideSm">${role==="head" ? '<span style="color:#ff4d6d;font-size:12px">🎓 หัวหน้าโค้ช</span>'
        : `<span class="hs">${h.emoji}</span> <span style="color:${h.color};font-size:12px">${h.name}</span>`}</td>
      ${S.boardMode==="reach" ? `<td class="num reach" style="color:var(--cyan)">👁 ${fmtN(((S.reach||{})[r.id]||{}).total_views||0)}<br><small style="color:var(--dim)">❤ ${fmtN(((S.reach||{})[r.id]||{}).total_likes||0)} · ${s.contents} ชิ้น</small></td>` : `<td class="num" style="color:${r.color}">${s.contents}</td>`}
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

/* สีชื่อในสกอร์บอร์ด: ปกติขาว · TA เขียว · หัวหน้าโค้ชแดง · ร่างพิเศษมีสีของตัวเอง */
function boardColor(r,s){
  const role=roleOf(r);
  if(role==="head") return "#ff4d6d";
  if(role==="ta")   return "#5ef08c";
  if(s.contents>=FINISH) return "#ffcc4d";
  if(s.style==="flame")  return "#ffcc4d";
  if(s.style==="red")    return "#ff8a00";
  if(s.burnout)          return "#8a8a9a";
  if(s.weak)             return "#9fb3e6";
  return "#fff";
}

/* ================= FEED ================= */
function renderFeed(){
  const list=[...S.subs].sort((a,b)=>b.ts-a.ts).slice(0,50);
  $("feed").innerHTML = list.length ? list.map(f=>{
    const r=S.runners.find(x=>x.name===f.who)||{};
    const h=houseOf(r.house);
    return `<li><span class="who" style="color:${r.color||"#fff"}">${h.emoji} ${f.who}</span>
      <span class="sp">S${f.sp+1}</span><span class="plat">${f.plat}</span>${f.kind?`<span class="kd" title="${KIND_TH[f.kind]}">${KIND_ICON[f.kind]}</span>`:""}
      <a href="${f.url}" target="_blank" rel="noopener">${f.url}</a>
      ${f.kudos?'<span class="kudo">👍</span>':""}${vacDay(f.day)?'<span class="vac" title="ส่งงานช่วงปิดเทอม">🏅 นักเรียนดีเด่น</span>':""}${f.views?`<span class="stat">👁 ${fmtN(f.views)}</span>`:""}
      <span class="when">${ago(f.ts)}</span>${f.note?`<span class="note">💬 ${f.note.replace(/</g,"&lt;")}</span>`:""}</li>`;
  }).join("") : `<li style="color:var(--dim)">ยังไม่มีใครส่งงานเลย — วางลิงก์ชิ้นแรกแล้วชื่อคุณจะขึ้นตรงนี้เป็นคนแรกของรุ่น</li>`;
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
  const role=roleOf(r);
  /* ตัวใหญ่ + ร่างปัจจุบัน (กระโหลก / ไฟ / ตาฟ้า) ให้เห็นชัดว่าตอนนี้เขาอยู่สถานะไหน */
  $("mSprite").innerHTML=runnerBox(avOf(r),6,s.style);
  $("mForm").className="pForm "+s.style;
  $("mForm").innerHTML=formLabel(r,s);
  $("mWeek").innerHTML = s.weekTarget
    ? `สัปดาห์ที่ ${curWeek()} · ทำแล้ว <b style="color:#fff">${s.weekDone}</b> จากเป้า ${s.weekTarget} ชิ้น
       ${s.weekDone>=s.weekTarget?"· ครบเป้าแล้ว 🎉":"· ขาดอีก "+(s.weekTarget-s.weekDone)}
       <div class="bar"><i style="width:${Math.min(100,s.weekDone/s.weekTarget*100)}%;background:linear-gradient(180deg,${shift(r.color,55)},${r.color} 55%,${shift(r.color,-55)})"></i></div>`
    : (inOvertime() ? "ช่วงต่อเวลา · ไม่มีเป้ารายสัปดาห์" : "ยังไม่ได้เลือกเป้าของสัปดาห์นี้");
  $("mName").innerHTML=`<span style="color:${nameColor(r)}">${r.name}</span>
    <span style="font-family:var(--f-th);font-size:12px;color:var(--dim)"> ${r.handle}</span>`;
  $("mRank").textContent = role==="head" ? `🎓 หัวหน้าโค้ช · วิ่งอยู่ทุกบ้าน`
    : role==="ta" ? `${h.emoji} ${h.name} · TA ประจำบ้าน`
    : `${h.emoji} ${h.name} · อันดับ ${rankOf(name)} จาก ${students().length} · ลงไว้ ${r.joined.length}/${NSP} สปรินต์`;
  $("mStats").innerHTML=[
    ["CONTENTS", s.contents],["สัปดาห์นี้", s.weekTarget?`${s.weekDone}/${s.weekTarget}`:"—"],
    ["STREAK 🔥", s.weekStreak+" สัปดาห์"],["ห่างจากเป้า", (s.pace>0?"+":"")+s.pace]
  ].map(([l,v])=>`<div class="statBox"><b>${v}</b><span>${l}</span></div>`).join("");
  let det={byDay:{},recent:[],weeks:[]};
  $("mBadges").innerHTML="";
  try{ det=await DB.detail(r); }catch(e){ console.error(e); }
  $("pMap").innerHTML=mapHTML(r, det.byDay);
  $("mBadges").innerHTML=badgesHTML(earnedBadges(r,det), false);
  $("mLevel").innerHTML=levelHTML(r);
  $("mCheer").innerHTML=cheerHTML(r)+nudgeHTML(r)+duelBtnHTML(r);
  $("mFeed").innerHTML=det.recent.slice(0,12)
    .map(f=>`<li><span class="plat">${f.plat}</span>${f.kind?`<span class="kd">${KIND_ICON[f.kind]}</span>`:""}
      <a href="${f.url}" target="_blank" rel="noopener">${f.url}</a>
      ${f.kudos?'<span class="kudo">👍</span>':""}${vacDay(f.day)?'<span class="vac" title="ส่งงานช่วงปิดเทอม">🏅 นักเรียนดีเด่น</span>':""}${f.views?`<span class="stat">👁 ${fmtN(f.views)}${f.likes?" · ❤ "+fmtN(f.likes):""}</span>`:""}
      <span class="when">${ago(f.ts)}</span>${f.note?`<span class="note">💬 ${f.note.replace(/</g,"&lt;")}</span>`:""}</li>`).join("") || `<li style="color:var(--dim)">ยังไม่มีงาน</li>`;
}

/* ป้ายอธิบายร่างปัจจุบันของตัวละคร */
function formLabel(r, s){
  const o = s.weekTarget ? optOf(s.weekTarget) : null;
  const kw=(S.kings||[]).filter(k=>k.profile_id===r.id).map(k=>"W"+k.week_no);
  const fin = (s.contents>=FINISH ? `<br>🏆 ถึงเส้นชัย ${FINISH} ชิ้นแล้ว — ออร่าทองถาวร` : "")
    + (isKingNow(r) ? `<br><span style="color:var(--gold)">👑 KING OF THE WEEK — ที่ 1 ของบ้าน ${houseOf(r.house).name} สัปดาห์นี้ (มงกุฎติดจนกว่าจะมีคนแซง)</span>` : "")
    + (kw.length ? `<br><span style="color:var(--gold)">👑 เคยเป็น King of the Week: ${kw.join(", ")}</span>` : "");
  if(s.style==="burnout")
    return `<b>💀 ร่างกระโหลก · หมดแรง</b><br>สัปดาห์ที่แล้วรับเป้าหนัก (${HEAVY}+ ชิ้น) แล้วทำไม่ถึง สัปดาห์นี้เลือกได้แค่ 4 หรือ 7<br><span style="color:var(--dim)">ทำครบสัปดาห์นี้ = ฟื้นคืนชีพ ได้ป้าย REVIVED</span>`+fin;
  if(s.style==="weak")
    return `<b>😵 ร่างหมดแรง · ผอมแห้ง</b><br>สัปดาห์ที่แล้วรับเป้า ${r.weakTarget||"4/7"} ชิ้นแล้วทำไม่ถึง ผิวซีด ตาคล้ำ ตัวลีบทั้งสัปดาห์<br><span style="color:var(--dim)">ทำครบสัปดาห์นี้ = กลับมาร่างปกติสัปดาห์หน้า</span>`+fin;
  if(s.style==="flame")
    return `<b>🔥 LASER FOCUS PRO MAX</b><br>รับ 14 ชิ้น/สัปดาห์ — ไฟทองท่วมตัว ตาแดง ผมทอง<br><span style="color:var(--dim)">พลาดเป้า = สัปดาห์หน้ากลายเป็นร่างกระโหลก</span>`+fin;
  if(s.style==="red")
    return `<b>🔴 LASER FOCUS</b><br>รับ 10 ชิ้น/สัปดาห์ — ไฟแดงลุกทั้งตัว<br><span style="color:var(--dim)">พลาดเป้า = สัปดาห์หน้ากลายเป็นร่างกระโหลก</span>`+fin;
  if(s.style==="boost")
    return `<b>🔵 RECOMMENDED</b><br>รับ 7 ชิ้น/สัปดาห์ — ตาเรืองแสงฟ้า วันละชิ้น`+fin;
  if(o && o.target<=4)
    return `<b>🟢 COMPROMISE</b><br>รับ 4 ชิ้น/สัปดาห์ — สัปดาห์นี้เอาแค่ไม่หลุด`+fin;
  return `<b>⚪ ร่างปกติ</b><br>${inOvertime()?"ช่วงต่อเวลา ไม่มีเป้ารายสัปดาห์":"ยังไม่ได้เลือกเป้าของสัปดาห์นี้"}`+fin;
}

/* ================= STATUS CARD ================= */
function drawSpriteCanvas(ctx, x, y, px, av, style){
  const pal=palette(av,style), g=buildGrid(av,style,1);
  if(style==="flame"){
    const gr=ctx.createRadialGradient(x+8*px, y+24*px, 3*px, x+8*px, y+18*px, 24*px);
    gr.addColorStop(0,"rgba(255,240,150,1)"); gr.addColorStop(.3,"rgba(255,200,50,.85)");
    gr.addColorStop(.6,"rgba(255,130,20,.45)"); gr.addColorStop(1,"rgba(255,80,10,0)");
    ctx.fillStyle=gr; ctx.fillRect(x-18*px, y-12*px, 52*px, 46*px);
  }
  if(style==="red"){
    const gr=ctx.createRadialGradient(x+8*px, y+24*px, 2*px, x+8*px, y+22*px, 15*px);
    gr.addColorStop(0,"rgba(255,120,120,.95)"); gr.addColorStop(.4,"rgba(255,40,70,.6)");
    gr.addColorStop(.7,"rgba(200,0,40,.25)"); gr.addColorStop(1,"rgba(200,0,40,0)");
    ctx.fillStyle=gr; ctx.fillRect(x-8*px, y-6*px, 32*px, 34*px);
  }
  if(style==="green"){
    const gg=ctx.createRadialGradient(x+8*px, y+22*px, 2*px, x+8*px, y+20*px, 14*px);
    gg.addColorStop(0,"rgba(150,255,190,.85)"); gg.addColorStop(.45,"rgba(60,220,120,.45)"); gg.addColorStop(1,"rgba(30,160,80,0)");
    ctx.fillStyle=gg; ctx.fillRect(x-8*px, y-6*px, 32*px, 36*px);
  }
  if(style==="boost"){
    const gr=ctx.createRadialGradient(x+8*px, y+16*px, 2*px, x+8*px, y+16*px, 13*px);
    gr.addColorStop(0,"rgba(57,229,255,.5)"); gr.addColorStop(1,"rgba(57,229,255,0)");
    ctx.fillStyle=gr; ctx.fillRect(x-8*px, y-6*px, 32*px, 36*px);
  }
  for(let ry=0;ry<ROWS;ry++) for(let cx=0;cx<16;cx++){
    const c=pal[g[ry][cx]]; if(!c) continue;
    ctx.fillStyle=c; ctx.fillRect(x+cx*px, y+ry*px, px, px);
  }
  if(SIGN_TEXT[av.hat]){
    ctx.save(); ctx.fillStyle=SIGN_TEXT[av.hat][1]; ctx.textAlign="center"; ctx.textBaseline="middle";
    ctx.font=`900 ${2.4*px}px "Arial Black",Impact,sans-serif`; ctx.fillText(SIGN_TEXT[av.hat][0], x+8*px, y+1.55*px, 11*px); ctx.restore();
  }
}
/* อันดับของใครก็ได้ ทั้งในบ้านและทั้งรุ่น — กลุ่มเดียวกับสกอร์บอร์ด (หัวหน้าโค้ชอยู่ในทุกบ้านเหมือนในเกม) */
function rankPair(r){
  const all = ranked();
  if(!r.house) return { all: all.findIndex(x=>x.id===r.id)+1, allN: all.length, house: 0, houseN: 0 };
  const hl = all.filter(x => x.house===r.house);
  return { all: all.findIndex(x=>x.id===r.id)+1, allN: all.length,
           house: hl.findIndex(x=>x.id===r.id)+1, houseN: hl.length };
}
function drawCard(){
  const cv=$("shareCanvas"), ctx=cv.getContext("2d");
  const r=meR(); if(!r) return;
  const s=stats(r), h=houseOf(r.house), noHouse=!r.house;      // หัวหน้าโค้ชไม่สังกัดบ้าน
  const accent = noHouse ? "#ffcc4d" : h.color;
  const W=cv.width, H=cv.height;
  ctx.imageSmoothingEnabled=false;

  const bg=ctx.createLinearGradient(0,0,0,H);
  bg.addColorStop(0,"#150f3a"); bg.addColorStop(.45,"#2d1f6b");
  bg.addColorStop(.8,"#4a2a72"); bg.addColorStop(1,"#0a0820");
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);

  const glow=ctx.createRadialGradient(W/2,H*.42,40,W/2,H*.42,W*.62);
  glow.addColorStop(0,accent+"55"); glow.addColorStop(1,"transparent");
  ctx.fillStyle=glow; ctx.fillRect(0,0,W,H);

  ctx.globalAlpha=.14; ctx.fillStyle="#000";
  for(let y=0;y<H;y+=6) ctx.fillRect(0,y,W,2);
  ctx.globalAlpha=1;

  ctx.textAlign="center";
  ctx.font="700 40px 'PxSeven','Pixelify Sans', monospace";
  ctx.fillStyle="#cdc7ff"; ctx.fillText(C.TITLE, W/2, 92);
  ctx.font="500 30px 'IBM Plex Sans Thai', sans-serif";
  ctx.fillStyle="#9a92d8";
  ctx.fillText(`สัปดาห์ที่ ${curWeek()} จาก ${WEEKS} · วันที่ ${S.today}`, W/2, 142);

  const px=18, sw=16*px;
  drawSpriteCanvas(ctx, (W-sw)/2, 160, px, avOf(r), s.style);

  /* อันดับ · เลเวล · เหรียญ */
  const isStu = roleOf(r)==="student";
  const rk = rankPair(r);
  const lv = levelOf(xpOf(r)), lvTitle = titleOf(lv);
  const marks = (isKingNow(r)?"👑 ":"") + (starN(r)?"🏅 ":"");

  ctx.font="700 78px 'PxSeven','Pixelify Sans', monospace";
  ctx.fillStyle="#fff"; ctx.shadowColor="#000"; ctx.shadowOffsetY=6;
  let nf=78; while(ctx.measureText(marks+r.name).width > W-120 && nf>40){ nf-=4; ctx.font=`700 ${nf}px 'PxSeven','Pixelify Sans', monospace`; }
  ctx.fillText(marks+r.name, W/2, 735);
  ctx.shadowOffsetY=0;
  ctx.font="500 30px 'IBM Plex Sans Thai', sans-serif";
  ctx.fillStyle=accent;
  ctx.fillText(noHouse ? `🎓 หัวหน้าโค้ช · Lv${lv} ${lvTitle}`
                       : `${h.emoji} ${h.name}${isStu?"":" · TA"} · Lv${lv} ${lvTitle}`, W/2, 782);

  ctx.font="700 170px 'PxSeven','Pixelify Sans', monospace";
  ctx.fillStyle=s.style==="flame"?"#ffc24d":s.style==="red"?"#ff6b85":"#ffcc4d";
  ctx.shadowColor=ctx.fillStyle; ctx.shadowBlur=40;
  ctx.fillText(String(s.contents), W/2, 935);
  ctx.shadowBlur=0;
  ctx.font="700 36px 'PxSeven','Pixelify Sans', monospace";
  ctx.fillStyle="#e6e1ff";
  ctx.fillText(s.contents>=FINISH ? `🏆 ครบ ${FINISH} ชิ้นแล้ว` : `CONTENTS · เป้า ${FINISH} ชิ้น`, W/2, 982);

  const rows=[
    [["สัปดาห์นี้", s.weekTarget?`${s.weekDone}/${s.weekTarget}`:"—"],
     ["STREAK วัน", `${s.dayStreak||0}🔥`],
     ["ห่างจากเป้า", `${s.pace>0?"+":""}${s.pace}`]],
    [["อันดับในบ้าน", noHouse ? "—" : `#${rk.house}`],
     ["อันดับรุ่น", `#${rk.all}`],          // ไม่บอกจำนวนคนทั้งหมด — การ์ดเอาไปโพสต์ข้างนอก
     ["เชียร์ที่ได้รับ", String((S.cheerStats&&S.cheerStats[r.id]) ? S.cheerStats[r.id].received : (S.cheers||[]).filter(c=>c.to_id===r.id).length)]]
  ];
  const bw=300, gap=20, x0=(W-(bw*3+gap*2))/2;
  rows.forEach((boxes,ri)=> boxes.forEach(([l,v],i)=>{
    const x=x0+i*(bw+gap), y=1010+ri*112, bh=100;
    ctx.fillStyle="rgba(13,10,34,.72)"; ctx.fillRect(x,y,bw,bh);
    ctx.strokeStyle=accent+"88"; ctx.lineWidth=3; ctx.strokeRect(x,y,bw,bh);
    let fs=46; ctx.font=`700 ${fs}px 'PxSeven','Pixelify Sans', monospace`;
    while(ctx.measureText(String(v)).width > bw-24 && fs>22){ fs-=4; ctx.font=`700 ${fs}px 'PxSeven','Pixelify Sans', monospace`; }
    ctx.fillStyle="#fff"; ctx.fillText(String(v), x+bw/2, y+56);
    let ls=22; ctx.font=`500 ${ls}px 'IBM Plex Sans Thai', sans-serif`;
    while(ctx.measureText(l).width > bw-16 && ls>14){ ls-=2; ctx.font=`500 ${ls}px 'IBM Plex Sans Thai', sans-serif`; }
    ctx.fillStyle="#a49ce0"; ctx.fillText(l, x+bw/2, y+86);
  }));

  if(["boost","red","flame","green"].includes(s.style)){
    const o=optOf(s.weekTarget);
    ctx.font="700 34px 'PxSeven','Pixelify Sans', monospace";
    ctx.fillStyle=s.style==="flame"?"#ffb020":s.style==="red"?"#ff4d6d":s.style==="green"?"#5ef08c":"#39e5ff";
    ctx.fillText(`${s.style==="flame"?"🔥":s.style==="red"?"🔥":s.style==="green"?"🟢":"🔵"} ${o.name} MODE`, W/2, 178);
  } else if(s.style==="burnout" || s.style==="weak"){
    ctx.font="700 34px 'PxSeven','Pixelify Sans', monospace";
    ctx.fillStyle=s.style==="burnout"?"#c8c4b8":"#b9ad9a";
    ctx.fillText(s.style==="burnout"?"💀 BURNOUT · ต้องฟื้นคืนชีพ":"😵 หมดแรง · สู้ต่อสัปดาห์นี้", W/2, 178);
  }
  /* ป้ายรางวัลที่ได้แล้ว: อีโมจิ + ชื่อป้าย (สูงสุด 4 ชื่อ) */
  const bl = S.myDet ? earnedBadges(r,S.myDet) : earnedBadges(r,null);
  if(bl.length){
    ctx.font="40px sans-serif"; ctx.fillStyle="#fff";
    ctx.fillText(bl.slice(0,10).map(b=>b.e).join(" "), W/2, 1268);
    ctx.font="700 20px 'PxSeven','Pixelify Sans', monospace"; ctx.fillStyle="#ffcc4d";
    const names=bl.slice(0,4).map(b=>b.n).join(" · ") + (bl.length>4?` +${bl.length-4}`:"");
    ctx.fillText(names, W/2, 1300);
  }
  /* บรรทัดล่างสุด: แฮชแท็กซ้าย เครดิตขวา */
  ctx.textAlign="left";
  ctx.font="600 22px 'IBM Plex Sans Thai', sans-serif";
  ctx.fillStyle="#9a92d8"; ctx.fillText(TAG, 40, H-16);
  drawCredit(ctx, W, H-16);
  ctx.textAlign="center";
}
/* ลายน้ำเครดิต มุมขวาล่างของการ์ด — แคปหน้าจอไปก็ยังเห็น */
function drawCredit(ctx, W, y){
  if(!CREDIT) return;
  ctx.save();
  ctx.textAlign="right";
  ctx.font="700 24px 'PxSeven','Pixelify Sans', monospace";
  ctx.fillStyle="rgba(255,204,77,.95)"; ctx.shadowColor="#000"; ctx.shadowBlur=6;
  ctx.fillText(CREDIT, W-40, y);
  ctx.restore();
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
  ctx.font="700 34px 'PxSeven','Pixelify Sans', monospace";
  ctx.fillStyle="#cdc7ff";
  ctx.fillText("CERTIFICATE OF COMPLETION", W/2, 148);
  ctx.font="500 26px 'IBM Plex Sans Thai', sans-serif";
  ctx.fillStyle="#9a92d8";
  ctx.fillText("ใบรับรองการจบหลักสูตร", W/2, 190);

  ctx.font="700 40px 'PxSeven','Pixelify Sans', monospace";
  ctx.fillStyle=gold; ctx.shadowColor=gold; ctx.shadowBlur=24;
  ctx.fillText(C.TITLE, W/2, 254);
  ctx.shadowBlur=0;

  const px=17, sw=16*px;
  drawSpriteCanvas(ctx,(W-sw)/2, 270, px, avOf(r), s.style);

  ctx.font="500 26px 'IBM Plex Sans Thai', sans-serif";
  ctx.fillStyle="#a49ce0";
  ctx.fillText("มอบให้แก่", W/2, 760);

  ctx.font="700 96px 'PxSeven','Pixelify Sans', monospace";
  ctx.fillStyle="#fff"; ctx.shadowColor="#000"; ctx.shadowOffsetY=6;
  ctx.fillText(r.name, W/2, 858);
  ctx.shadowOffsetY=0;

  ctx.font="500 28px 'IBM Plex Sans Thai', sans-serif";
  ctx.fillStyle=h.color;
  ctx.fillText(r.house ? h.emoji+"  บ้าน "+h.name+" · "+h.th : "🎓  หัวหน้าโค้ช · ดูแลทั้งรุ่น", W/2, 906);

  ctx.font="500 28px 'IBM Plex Sans Thai', sans-serif";
  ctx.fillStyle="#e6e1ff";
  ctx.fillText("ปล่อยคอนเทนต์รวมทั้งสิ้น", W/2, 976);

  ctx.font="700 150px 'PxSeven','Pixelify Sans', monospace";
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
    ctx.font="700 46px 'PxSeven','Pixelify Sans', monospace"; ctx.fillText(String(FINISH), 0, 2);
    ctx.font="500 18px 'IBM Plex Sans Thai', sans-serif"; ctx.fillText("ครบเป้า", 0, 32);
    ctx.restore();
  }

  const rank=ranked().filter(x=>x.role!=="coach").findIndex(x=>x.name===r.name)+1;
  const total=S.runners.filter(x=>x.role!=="coach").length;
  ctx.font="500 24px 'IBM Plex Sans Thai', sans-serif";
  ctx.fillStyle="#a49ce0";
  ctx.fillText("อันดับ "+rank+" จาก "+total+" คน  ·  ทำได้ "+s.rate+"% ของเป้าที่ตัวเองรับไว้"
    + "  ·  streak สูงสุด "+s.weekStreak+" สัปดาห์", W/2, 1224);

  ctx.font="600 24px 'IBM Plex Sans Thai', sans-serif";
  ctx.fillStyle="#9a92d8";
  ctx.fillText(TAG, W/2, 1284);
  drawCredit(ctx, W, H-60);
}

function certText(){
  const r=meR(), s=stats(r), h=houseOf(r.house);
  const hit = s.contents>=FINISH;
  return "จบแล้ว " + TOTAL + " วัน 🎓\n"
    + "ปล่อยคอนเทนต์ไปทั้งหมด " + s.contents + " ชิ้น" + (hit ? " — ครบเป้า " + FINISH + " ชิ้น 🏆" : "") + "\n"
    + (r.house ? h.emoji + " บ้าน " + h.name : "🎓 หัวหน้าโค้ช") + " · ทำได้ " + s.rate + "% ของเป้าที่รับไว้\n"
    + TAG + (CREDIT ? "\n" + CREDIT : "");
}

function shareTextOf(){
  const r=meR(), s=stats(r), h=houseOf(r.house);
  const o=s.weekTarget?optOf(s.weekTarget):null;
  const fin = s.contents>=FINISH ? " 🏆 ครบเป้าแล้ว!" : ` จากเป้า ${FINISH}`;
  const rk=rankPair(r);
  const bl=S.myDet?earnedBadges(r,S.myDet):[];
  return `ปล่อยไปแล้ว ${s.contents} คอนเทนต์${fin} ใน ${C.TITLE} 🏁\n`
   + (r.house ? `${h.emoji} บ้าน ${h.name} · สัปดาห์ที่ ${curWeek()}/${WEEKS}\n`
              : `🎓 หัวหน้าโค้ช · สัปดาห์ที่ ${curWeek()}/${WEEKS}\n`)
   + (r.house ? `อันดับ ${rk.house} ของบ้าน · ${rk.all} ของรุ่น` : `อันดับ ${rk.all} ของรุ่น`)
   + ` · Lv${levelOf(xpOf(r))} ${titleOf(levelOf(xpOf(r)))}\n`
   + (bl.length?`ป้าย: ${bl.slice(0,5).map(b=>b.e+" "+b.n).join(", ")}\n`:"")
   + (o?`สัปดาห์นี้รับเป้า ${o.name} ${o.target} ชิ้น — ทำไปแล้ว ${s.weekDone}\n`:"")
   + rivalText(r)
   + `streak ${s.weekStreak} สัปดาห์ 🔥\n${TAG}` + (CREDIT ? "\n"+CREDIT : "");
}
async function renderStatus(){
  const r=meR(); if(!r) return;
  document.fonts.ready.then(function(){ finished() ? drawCert() : drawCard(); });
  const s=stats(r), h=houseOf(r.house);
  const rp=rankPair(r);                                    // กลุ่มเดียวกับสกอร์บอร์ด ตัวตั้งกับตัวหารต้องเป็นกลุ่มเดียวกัน
  (finished() ? drawCert() : drawCard());
  $("shTitle").textContent = (finished() ? "🎓 ใบประกาศ · " : "") + r.name + " · " + (r.house ? h.emoji + " " + h.name : "🎓 หัวหน้าโค้ช");
  $("shSub").textContent=`อันดับ ${rp.all} จาก ${rp.allN} คน · ปล่อยไปแล้ว ${s.contents} จาก ${FINISH} ชิ้น ใน ${s.activeDays} วัน`
    + (s.contents>=FINISH ? ` · ถึงเส้นชัยแล้ว 🏆` : ` · เหลืออีก ${FINISH-s.contents}`);
  $("shStats").innerHTML=[
    [`CONTENTS / ${FINISH}`, s.contents],["วันที่ปล่อยงาน", s.activeDays],
    ["STREAK สัปดาห์", s.weekStreak],["ห่างจากเป้า", (s.pace>0?"+":"")+s.pace]
  ].map(([l,v])=>`<div class="statBox"><b>${v}</b><span>${l}</span></div>`).join("");
  $("shareText").value = finished() ? certText() : shareTextOf();
  $("mMap").innerHTML=`<div class="noJoin">กำลังโหลด…</div>`;
  $("shBadges").innerHTML = S.myDet ? badgesHTML(earnedBadges(r,S.myDet), true) : "";
  try{ const det=await DB.detail(r); S.myDet=det; $("mMap").innerHTML=mapHTML(r, det.byDay);
    $("shBadges").innerHTML=badgesHTML(earnedBadges(r,det), true);
    renderMyFeed(det.recent||[]);
    (finished() ? drawCert() : drawCard());          // วาดใหม่ให้มีป้ายบนการ์ด
  }catch(e){ console.error(e); $("mMap").innerHTML=`<div class="noJoin">โหลดแผนที่ไม่สำเร็จ</div>`; }
}
function canvasBlob(){
  return new Promise(res=>$("shareCanvas").toBlob(res,"image/png"));
}

/* ================= ADMIN (หัวหน้าโค้ช) ================= */
async function renderAdmin(){
  const demo = DB.mode==="demo";
  $("adNote").innerHTML = demo
    ? "โหมด DEMO — หน้านี้แสดงให้ดูหน้าตาเท่านั้น เพิ่มรายชื่อจริงไม่ได้ ต้องต่อ Supabase ก่อน"
    : "อีเมลที่เพิ่มตรงนี้คือประตูเข้าระบบ ใครไม่มีชื่อจะสมัครไม่ได้ และหนึ่งอีเมลสมัครได้ครั้งเดียว"
      + ' · <a href="admin.html" style="color:var(--cyan)">เปิดหน้าจัดการเต็ม (ย้ายบ้าน / ลบ / เตะออก) →</a>';
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
  $("hudWeek").textContent=curWeek();
  $("hudWeeks").textContent=WEEKS;
  $("hudSprint").textContent = inOvertime() ? "ต่อเวลา" : (curSp()+1);
  $("hudSprints").textContent=NSP;
  $("hudDay").textContent=S.today;
  $("hudTotal").textContent=TOTAL;
  $("hudClock").textContent=cutoffLeft();
  renderTodayBar(); renderBell(); updateSky(); renderWeekCut();
  $("submitPanel").style.display = S.spectator ? "none" : "";
  $("navSubmit").style.display = S.spectator ? "none" : "";
  $("pledgeBtn2").style.display = S.spectator ? "none" : "";
  { const me0=meR(); $("taLink").hidden = !(me0 && !S.spectator && roleOf(me0)==="ta" && DB.mode==="live"); }
  $("statusNav").style.display   = S.spectator ? "none" : "";
  $("outBtn2").style.display = S.spectator ? "none" : "";          // ต้องอยู่ก่อน return ของโหมดคนดู ไม่งั้นคนดูเห็น SIGN OUT
  $("jumpMe").style.display  = S.spectator ? "none" : "";
  { const noPl = inOvertime() || finished() || noPledgeWeek();       // ช่วงต่อเวลา/จบรุ่น/ปิดเทอม ไม่มีเป้าให้เลือก
    $("pledgeBtn").style.display = noPl ? "none" : "";
    if(!S.spectator) $("pledgeBtn2").style.display = noPl ? "none" : ""; }
  if(S.spectator){
    $("meLine").innerHTML=`👀 <span style="color:var(--cyan)">โหมดคนดู</span> · นักเรียน ${students().length} คน`;
    $("adminNav").style.display="none";
    $("modeTag").textContent = DB.mode==="live"?"LIVE · ดูอย่างเดียว":"DEMO · ดูอย่างเดียว";
    $("modeTag").className = "chip "+(DB.mode==="live"?"live":"warnChip");
    return;
  }
  const r=meR(); if(!r) return;
  const h=houseOf(r.house), s=stats(r);
  const roleLbl = roleOf(r)==="head" ? '🎓 <span style="color:#ff4d6d">หัวหน้าโค้ช</span>' : `${h.emoji} <span style="color:${h.color}">${h.name}</span>${roleOf(r)==="ta"?' · <span style="color:#5ef08c">TA</span>':""}`;
  $("meLine").innerHTML=`${r.name} · ${roleLbl} · <b style="color:${r.color}">${s.contents}</b> ชิ้น`;
  $("who").textContent=r.name;
  applyPlatFocus();
  /* ปิดปุ่มส่งงานเมื่อรุ่นยังไม่เปิด จบแล้ว หรือไม่ได้ลงสปรินต์ปัจจุบัน
     เซิร์ฟเวอร์กันอยู่แล้ว แต่บอกล่วงหน้าดีกว่าปล่อยให้กดแล้วเด้ง error */
  const joinedNow = inOvertime() ? r.joined.length > 0 : joinedIn(r, curSp());
  const blocked = !S.started ? "▶ รุ่นยังไม่เปิด"
                : finished()  ? "▶ จบหลักสูตรแล้ว"
                : !joinedNow  ? "▶ ไม่ได้ลงสปรินต์นี้" : null;
  $("pushBtn").disabled = !!blocked;
  $("pushBtn").textContent = blocked || "▶ SUBMIT";
  $("simBtn").style.display = DB.canSim?"":"none";
  $("adminNav").style.display = (DB.mode==="demo" || roleOf(r)==="head") ? "" : "none";
  $("outBtn").textContent = DB.mode==="live"?"SIGN OUT":"RESET DEMO";
  $("outBtn2").innerHTML = DB.mode==="live"?"<i>⏏</i><div>SIGN OUT</div>":"<i>↺</i><div>RESET DEMO</div>";
  $("outBtn2").style.display = S.spectator ? "none" : "";
  $("modeTag").textContent = DB.mode==="live"?"LIVE":"DEMO MODE";
  $("modeTag").className = "chip "+(DB.mode==="live"?"live":"warnChip");
}
function renderAll(){
  try{ bgmSync(); }catch(e){}                       // เปลี่ยนเพลงตามสถานการณ์ (ดวล/บอสใกล้ล้ม)
  try{ nudgeWatch(); }catch(e){}
  /* แถบเตือนโหมดทดลอง — กันคนเข้าใจผิดว่าส่งงานจริงแล้ว */
  $("demoBar").style.display = DB.mode==="demo" ? "" : "none";
  renderFilters(); renderPledge(); renderTrack(); renderFeed(); renderHud(); renderQuests();
  if($("pgBoard").classList.contains("on")) renderBoard();
  if($("pgStatus").classList.contains("on")) renderStatus();
}

/* ================= ONBOARDING ================= */
let pickColor=COLORS[0], pickPledge=7, pickAv=Object.assign({},DEF_AV);
const ALL_SPRINTS = SPRINTS.map((_,i)=>i);   // ทุกคนลงครบทุกสปรินต์อัตโนมัติ
function drawSelect(){
  $("swatches").innerHTML=COLORS.map(c=>
    `<button class="sw ${c===pickColor?"sel":""}" data-c="${c}"
      style="background:linear-gradient(180deg,${shift(c,40)},${c} 55%,${shift(c,-50)})"></button>`).join("");
  $("myPreview").innerHTML=runnerBox(Object.assign({},pickAv,{color:pickColor}),4);
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
      <div class="opChar">${hasAura(o.style)?aura(o.style):""}${sprite(avOf(me),2,o.style)}</div>
      <div class="no">${o.target} ชิ้น</div>
      <div class="nm">${o.name}</div>
      <div class="th">${o.th}</div>
      <div class="wk">${o.style==="red"?"🔥 ไฟแดงลุกทั้งตัวทั้งสัปดาห์"
        : o.style==="flame"?"🔥 ตัวละครติดไฟ โหมดซูเปอร์ไซย่า"
        : o.style==="boost"?"🔵 ตาเรืองแสงสีฟ้าทั้งสัปดาห์"
        : o.style==="green"?"🟢 ไฟเขียว Green Go Go! ทั้งสัปดาห์"
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
  pickPlats = (S.platLimit && S.platPick) ? S.platPick.slice(0, S.platLimit) : [];
  drawPlatPick();
  $("pledgeModal").classList.add("on");
}
window.openPledge=openPledge;
/* ---- โฟกัสแพลตฟอร์ม (037): WISDOM เลือก 1 · COURAGE เลือก 2 · บ้านอื่นไม่จำกัด ---- */
let pickPlats=[];
function drawPlatPick(){
  const box=$("plPlat"); if(!box) return;
  const lim=S.platLimit;
  if(!lim){ box.hidden=true; box.innerHTML=""; return; }
  box.hidden=false;
  box.innerHTML=`<div class="platHead">🎯 สัปดาห์นี้บ้านคุณโฟกัสได้ <b>${lim}</b> แพลตฟอร์ม — ส่งงานได้เฉพาะที่เลือก <small>(${pickPlats.length}/${lim})</small></div>
    <div class="platPick">${PLATS.map(p=>`<button type="button" class="platChip ${pickPlats.includes(p)?"on":""}" data-p="${p}">${p}</button>`).join("")}</div>`;
}
$("plPlat").onclick=e=>{
  const b=e.target.closest(".platChip"); if(!b) return;
  const p=b.dataset.p, lim=S.platLimit||99;
  if(pickPlats.includes(p)) pickPlats=pickPlats.filter(x=>x!==p);
  else if(pickPlats.length>=lim){ if(lim===1) pickPlats=[p]; else return toast(`เลือกได้แค่ ${lim} แพลตฟอร์ม — เอาอันเดิมออกก่อน`); }
  else pickPlats=[...pickPlats,p];
  drawPlatPick();
};
/* ช่องเลือกแพลตฟอร์มตอนส่งงาน: ถ้าถูกจำกัดและเลือกไว้แล้ว ให้เหลือเฉพาะที่เลือก */
function applyPlatFocus(){
  const sel=$("plat"); if(!sel) return;
  const focus = S.platLimit && S.platPick ? PLATS.filter(p=>S.platPick.includes(p)) : null;
  const list = focus && focus.length ? focus : PLATS;
  const cur=sel.value;
  sel.innerHTML=list.map(p=>`<option>${p}</option>`).join("");
  if(list.includes(cur)) sel.value=cur;
  const hint=$("platHint"); if(!hint) return;
  /* เขียนคำใบ้เฉพาะตอนช่องลิงก์ยังว่าง หรือโฟกัสเปลี่ยน — ไม่งั้น refresh ทุก 2 วิจะลบข้อความ "✓ เลือก TikTok ให้แล้ว" ที่เพิ่งขึ้น */
  const key=focus ? focus.join(",") : (S.platLimit ? "need" : "");
  if(hint.dataset.focus===key && ($("url").value||"").trim()) return;
  hint.dataset.focus=key;
  if(focus && focus.length) hint.textContent=`🎯 สัปดาห์นี้โฟกัส ${focus.join(" · ")} — เปลี่ยนได้ตอนรับเป้าสัปดาห์หน้า`;
  else if(S.platLimit && !S.platPick) hint.textContent=`🎯 บ้านคุณต้องเลือกแพลตฟอร์มโฟกัส ${S.platLimit} อัน ตอนรับเป้าสัปดาห์นี้`;
}

/* ================= EVENTS ================= */
$("swatches").onclick=e=>{ const b=e.target.closest(".sw"); if(b){ pickColor=b.dataset.c; drawSelect(); } };
$("myName").oninput=drawSelect;
$("plPick").onclick=e=>{
  const b=e.target.closest(".optCard"); if(!b||b.disabled) return;
  pickPledge=+b.dataset.t; drawPledgePick();
};
/* PRESS START: ถ้าล็อกอินและมีตัวละครแล้ว เข้าสนามเลย ไม่ต้องผ่านหน้าสร้างตัวละครอีก */
$("startBtn").onclick=async()=>{
  if(BOOTSTATE && !BOOTSTATE.needsAuth && !BOOTSTATE.needsProfile){
    if(S.me && S.runners.length){ show("scArena"); showPage("pgRace"); return; }
    $("startBtn").textContent="กำลังโหลดสนาม…";
    try{ await boot(); } catch(e){ toast(e.message); } finally{ $("startBtn").textContent="▶ PRESS START"; }
    return;
  }
  drawSelect(); show(BOOTSTATE&&BOOTSTATE.needsAuth?"scAuth":"scSelect");
};
$("authBtn").onclick=async()=>{
  const em=$("email").value.trim(), pw=$("pass").value;
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return toast("ใส่อีเมลให้ถูกก่อน");
  if(!pw) return toast("ใส่รหัสเข้าก่อน");
  $("authBtn").disabled=true;
  try{ await DB.signIn(em, pw); $("authNote").textContent="กำลังเข้า…"; }
  catch(err){ toast(err.message); $("authBtn").disabled=false; }
};
$("pass").onkeydown=e=>{ if(e.key==="Enter") $("authBtn").click(); };
/* กด Enter ในช่องกรอกหลัก = กดปุ่มถัดไป (เดิมไม่มี form กด Enter แล้วเงียบ) */
[["url","pushBtn"],["myName","joinBtn"],["email","authBtn"]].forEach(([i,b])=>{ const el=$(i); if(el) el.onkeydown=e=>{ if(e.key==="Enter"){ e.preventDefault(); $(b).click(); } }; });
$("joinBtn").onclick=async()=>{
  const nm=$("myName").value.trim();
  if(!nm) return toast("ใส่ชื่อก่อน");
  $("joinBtn").disabled=true;
  try{
    /* handle ไม่ต้องกรอกแล้ว ฐานข้อมูลเติมให้จากอีเมลที่ล็อกอิน */
    await DB.createProfile({name:nm.toUpperCase().slice(0,10),
      color:pickColor, avatar:pickAv, joined:ALL_SPRINTS, house:1+((Date.now())%4)});
  }catch(err){ toast(err.message); $("joinBtn").disabled=false; return; }
  /* โปรไฟล์สร้างแล้ว ถ้าโหลดสนามพลาด (ฐานข้อมูลเย็น) ต้องให้ลองโหลดใหม่ ไม่ใช่ให้กดเข้าร่วมซ้ำจนเจอ "มีโปรไฟล์อยู่แล้ว" */
  try{ await boot(); }catch(err){ loaderFail(err.message, bootWithRetry); }
};
document.querySelector(".nav").onclick=e=>{
  const b=e.target.closest(".navBtn"); if(b && b.dataset.page) showPage(b.dataset.page);
};
function scrollToMe(){
  const el=document.querySelector(".lane.meLane");
  if(!el){ toast("คุณไม่ได้อยู่ในกลุ่มนี้"); return; }
  el.scrollIntoView({block:"center", behavior:"smooth"});
  el.classList.add("flash"); setTimeout(()=>el.classList.remove("flash"), 1600);
}
$("raceFilters").onclick=e=>{
  const b=e.target.closest(".fBtn"); if(!b) return;
  if(b.dataset.me){ scrollToMe(); return; }
  S.raceFilter=b.dataset.f; renderFilters(); renderTrack();
  /* เปลี่ยนเป็นทั้งรุ่น/บ้าน แล้วพาไปหาตัวเองเลย จะได้รู้ว่าอยู่ตรงไหนของแถว */
  if(S.raceFilter!=="near" && !S.spectator) setTimeout(scrollToMe, 60);
};
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
$("reachToggle").onclick=()=>{ S.boardMode = S.boardMode==="reach" ? "contents" : "reach"; $("reachToggle").textContent = S.boardMode==="reach" ? "🏁 จำนวนชิ้น" : "👁 ยอดวิว"; renderBoard(); };
$("jumpMe").onclick=()=>{
  const el=$("row-"+S.me);
  if(el) el.scrollIntoView({block:"center",behavior:"smooth"});
  else toast("คุณไม่ได้อยู่ในกลุ่มที่กรองอยู่ — กด \"ทั้งรุ่น\" ก่อน");
};
/* ปิดโมดัล: ถ้าตอนเปิดได้ push history ไว้ ให้ถอยประวัติแทน ไม่งั้นกด Back ครั้งถัดไปจะเหมือนไม่ทำอะไร */
function closeModal(m){ if(!m || !m.classList.contains("on")) return; if(m._pushed && history.state && history.state.modal===m.id) history.back(); else m.classList.remove("on"); }
document.querySelectorAll("[data-close]").forEach(b=> b.onclick=()=>closeModal(b.closest(".modal")));
document.querySelectorAll(".modal").forEach(m=> m.onclick=e=>{ if(e.target===m) closeModal(m); });
document.addEventListener("keydown",e=>{ if(e.key==="Escape"){ const open=[...document.querySelectorAll(".modal.on")]; if(open.length) closeModal(open[open.length-1]); } });

$("pushBtn").onclick=async()=>{
  const url=$("url").value.trim();
  if(!/^https?:\/\/.+\..+/.test(url)) return toast("ใส่ลิงก์ให้ถูก<br>ต้องขึ้นต้นด้วย http(s)://");
  const before=stats(meR()), hadUnlocked=unlockedSet(before);
  $("pushBtn").disabled=true; S.submitting=true;
  try{
    await DB.submit({url, platform:$("plat").value, kind:$("kind").value, note:$("note").value.trim()});
    $("url").value=""; $("platHint").textContent=""; $("note").value="";
    S.postedToday=true;
    await refresh();
    S.submitting=false;
    const after=stats(meR());
    sprintMe();
    const todayN=Math.max(S.todayCount||0, (after.byDay||{})[S.today]||0);
    if(todayN>=2) setTimeout(()=>comboPop(todayN), 350);
    const passed=(S.lastPass&&S.lastPass.iPassed)||[];
    if(passed.length) setTimeout(()=>{ bigPop(`แซง ${passed[0]}${passed.length>1?" +"+(passed.length-1):""} แล้ว!`, passed.length>1?`แซงไป ${passed.length} คนในชิ้นเดียว`:"", "pass"); SFX.unlock(); }, todayN>=2?1700:400);
    const o=after.weekTarget?optOf(after.weekTarget):null;
    let msg=`+1 CONTENT · รวม ${after.contents} ชิ้น`, kind="submit";
    if(o && before.weekDone<o.target && after.weekDone>=o.target){
      if(before.burnout){ msg=`ฟื้นคืนชีพ! 💀→🔥<br>ทำครบเป้าทั้งที่เป็นร่างกระโหลก ได้ป้าย REVIVED`; kind="revive"; }
      else if(before.weak){ msg=`กลับมามีแรงแล้ว! 😵→💪<br>ครบเป้าสัปดาห์นี้ สัปดาห์หน้าร่างกลับมาปกติ`; kind="revive"; }
      else { msg=`ครบเป้าสัปดาห์นี้แล้ว! 🎉<br>${o.name} ${o.target}/${o.target}`; kind="target"; }
    }
    else if(o) msg=`+1 CONTENT · สัปดาห์นี้ ${after.weekDone}/${o.target}`;
    if(after.contents>=FINISH && before.contents<FINISH){ msg=`🏆 ถึงเส้นชัย ${FINISH} ชิ้นแล้ว!<br>ออร่าทองถาวรติดตัวตลอดรุ่น`; kind="target"; }
    const starPop = isVacation();
    if(starPop){ msg=`${VAC_MEMES[Math.floor(Math.random()*VAC_MEMES.length)]}<br>${msg}`; }
    celebrate(kind); toast(msg);
    if(starPop) setTimeout(()=>{ bigPop("🏅 นักเรียนดีเด่น", `ส่งงานช่วงปิดเทอม · ชิ้นที่ ${starN(meR())||1}`, "star"); SFX.fanfare(); confetti(60); }, todayN>=2?1900:500);
    S.submitting=false;
    /* ปลดล็อกของแต่งตัวใหม่ */
    const fresh=[...unlockedSet(after)].filter(k=>!hadUnlocked.has(k));
    if(fresh.length) setTimeout(()=>{ celebrate("unlock");
      toast(`🔓 ปลดล็อกแล้ว: ${fresh.map(k=>UNLOCKS[k].th).join(" · ")}<br>ไปใส่ได้ที่ห้องแต่งตัว`); }, 2200);
  }catch(err){ S.submitting=false; toast(err.message); }
  $("pushBtn").disabled=false; renderHud();            // ให้ renderHud ตัดสินอีกทีว่าปุ่มต้องล็อกไหม (จบรุ่น/หมดสปรินต์)
};
$("pledgeBtn").onclick=openPledge;
$("plSave").onclick=async()=>{
  if(S.platLimit){
    if(!pickPlats.length) return toast(`เลือกแพลตฟอร์มโฟกัสก่อน (${S.platLimit} อัน)`);
    if(pickPlats.length>S.platLimit) return toast(`เลือกได้แค่ ${S.platLimit} แพลตฟอร์ม`);
  }
  $("plSave").disabled=true;
  try{
    await DB.setPledge(curWeek(), pickPledge, S.platLimit ? pickPlats : null);
    await refresh();
    closeModal($("pledgeModal"));
    const o=optOf(pickPledge);
    toast(o.style==="flame" ? `🔥 ${o.name}<br>ตัวละครติดไฟแล้ว`
        : o.style==="red" ? `🔥 ${o.name}<br>ไฟแดงลุกทั้งตัวสัปดาห์นี้`
        : o.style==="boost" ? `🔵 ${o.name}<br>ตาเรืองแสงฟ้าสัปดาห์นี้`
        : o.style==="green" ? `🟢 ${o.name}<br>ไฟเขียว Green Go Go!`
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
$("outBtn2").onclick=()=>{ $("moreMenu").hidden=true; $("outBtn").click(); };
$("moreBtn").onclick=()=>{ const m=$("moreMenu"); m.hidden=!m.hidden; $("bellMenu").hidden=true; };
$("pledgeBtn2").onclick=()=>{ $("moreMenu").hidden=true; openPledge(); };
$("taLink").onclick=()=>{ location.href="/ta.html"; };
/* ---- XP + เลเวล: แกนความก้าวหน้าที่สอง (คิดจากข้อมูลที่มีอยู่แล้ว) ---- */
const LV_TITLES=[[1,"มือใหม่"],[3,"นักลอง"],[5,"นักปล่อย"],[7,"ครีเอเตอร์"],[9,"มือโปร"],[11,"ตำนาน"]];
function xpOf(r){
  if(!r) return 0;
  const s=stats(r);
  const cst=(S.cheerStats||{})[r.id];                       // ยอดรวมจากเซิร์ฟเวอร์ (043) · โหมดทดลองไม่มี → นับจากก้อนที่โหลดมา
  const cheersGiven= cst ? +cst.given : (S.cheers||[]).filter(c=>c.from_id===r.id).length;
  const kills=(S.bossKills||[]).filter(k=>k.profile_id===r.id).length;
  const wins=(S.duels||[]).filter(d=>d.status==="done"&&d.winner===r.id).length;
  const kingW=(S.kings||[]).filter(k=>k.profile_id===r.id).length;
  /* วันภารกิจ = วันที่ส่ง ≥1 ชิ้น และเชียร์ ≥3 ครั้ง — คิดจากข้อมูลเซิร์ฟเวอร์ให้ทุกคนเท่ากัน
     (เดิมนับใน localStorage ของเครื่องตัวเอง → เปลี่ยนเครื่องแล้ว XP ตก คนอื่นได้ 0 ตลอด) */
  const byDay=s.byDay||{}; const cheerDays={};
  (S.cheers||[]).forEach(c=>{ if(c.from_id===r.id) cheerDays[c.day_index]=(cheerDays[c.day_index]||0)+1; });
  const questDays= cst ? +cst.quest_days : Object.keys(byDay).filter(d=>byDay[d]>=1 && (cheerDays[d]||0)>=3).length;
  return s.contents*10 + cheersGiven*2 + s.weeksHit*30 + kills*50 + wins*40 + kingW*60 + questDays*30 + Math.min(s.dayStreak,30)*3;
}
const XP_RULES="ส่งงาน 1 ชิ้น +10 · เชียร์เพื่อน +2/ครั้ง · ส่ง 1 + เชียร์ 3 ในวันเดียว +30 · ครบเป้าสัปดาห์ +30 · streak +3/วัน (สูงสุด 30 วัน) · ชนะดวล +40 · ล้มบอส +50 · King of the Week +60";
const levelOf = xp => Math.floor(Math.sqrt(xp/40))+1;
const xpForLevel = lv => (lv-1)*(lv-1)*40;
const titleOf = lv => { let t=LV_TITLES[0][1]; LV_TITLES.forEach(([l,n])=>{ if(lv>=l) t=n; }); return t; };
function levelHTML(r){
  const xp=xpOf(r), lv=levelOf(xp), lo=xpForLevel(lv), hi=xpForLevel(lv+1), pct=Math.round((xp-lo)/(hi-lo)*100);
  return `<div class="lvBox" title="${XP_RULES}"><span class="lvTag">LV ${lv}</span><span class="lvTitle">${titleOf(lv)}</span>
    <span class="lvBar"><i style="width:${pct}%"></i></span><span class="lvXp">${xp} / ${hi} XP</span></div>`;
}
/* ---- ภารกิจวันนี้ 3 ข้อ ---- */
function questsOf(){
  const me=meR(); if(!me) return [];
  const n=Math.max(S.todayCount||0,(stats(me).byDay||{})[S.today]||0);
  const cheered=(S.cheers||[]).filter(c=>c.from_id===me.id && c.day_index===S.today).length;
  const early=(S.todaySubs||[]).some(ts=>{ const hh=new Date(ts).getHours(); return hh>=C.CUTOFF_HOUR && hh<20; });
  return [
    {k:"post",  i:"🔗", t:"ส่งงาน 1 ชิ้น", done:n>=1, sub:n>=1?`ส่งแล้ว ${n} ชิ้น`:"วางลิงก์ด้านบน", go:goSubmit},
    {k:"cheer", i:"👏", t:"เชียร์เพื่อน 3 คน", done:cheered>=3, sub:`${Math.min(cheered,3)}/3 · คลิกตัวละครเพื่อนแล้วกดอิโมจิ`, go:()=>{ showPage("pgBoard"); }},
    {k:"early", i:"🌤", t:"ส่งก่อน 2 ทุ่ม", done:early, sub:early?"ทันเวลา!":(n>=1?"วันนี้ส่งหลัง 2 ทุ่ม พรุ่งนี้ลองใหม่":"ส่งก่อน 20:00 จะได้ข้อนี้"), go:goSubmit}
  ];
}
function renderQuests(){ /* รวมอยู่ในการ์ดวันนี้แล้ว */ }

/* ---- นับถอยหลังตัดรับงานประจำสัปดาห์ (ค่าเริ่มต้น พุธ 19:30 เวลาไทย ตั้งใน config.js) ---- */
const DOW_TH=["อาทิตย์","จันทร์","อังคาร","พุธ","พฤหัส","ศุกร์","เสาร์"];
function nextWeekCut(){
  const dow = C.WEEK_CUTOFF_DOW==null ? 3 : +C.WEEK_CUTOFF_DOW;
  const [hh,mm] = String(S.weekCut||C.WEEK_CUTOFF_TIME||"20:30").split(":").map(Number);
  /* คิดเป็นเวลาไทยเสมอ: แปลงเวลาเครื่องเป็น UTC+7 ก่อน */
  const now=new Date(); const th=new Date(now.getTime()+ (now.getTimezoneOffset()+420)*60000);
  const d=new Date(th); d.setHours(hh,mm,0,0);
  let diff=(dow - d.getDay()+7)%7; if(diff===0 && d<=th) diff=7; d.setDate(d.getDate()+diff);
  return d.getTime()-th.getTime();
}
function renderWeekCut(){
  const box=$("weekCut"); if(!box) return;
  if(!$("scArena").classList.contains("on") || !S.started || (typeof finished==="function" && finished())){ box.hidden=true; return; }
  box.hidden=false;
  let ms=(S.weekEndsAt ? S.weekEndsAt-Date.now() : nextWeekCut()); if(ms<0) ms=0;
  box.classList.toggle("vac", isVacation());
  if(isVacation()){ box.classList.remove("soon"); $("dlLabel").textContent=`🏖 ปิดเทอม ${dayDateTH(S.vacFrom)} – ${dayDateTH(S.vacTo)}`; $("dlClock").innerHTML='<span class="vacClock">🌴 พัก 🌴</span>'; $("dlSub").textContent=`ไม่ต้องส่งการบ้าน streak ไม่ขาด · กลับมาส่ง ${dayDateTH(S.vacTo+1)} · ส่งช่วงนี้ = นักเรียนดีเด่น 🏅`; return; }
  const s=Math.floor(ms/1000), dd=Math.floor(s/86400), hh=Math.floor(s%86400/3600), mi=Math.floor(s%3600/60), ss=s%60;
  const pad=n=>String(n).padStart(2,"0");
  $("dlLabel").textContent=`⏳ ${C.WEEK_CUTOFF_LABEL||"ตัดรับงานสัปดาห์นี้"}`;
  $("dlClock").innerHTML=(dd>0?`${dd}<small>วัน</small>`:"")+`${pad(hh)}:${pad(mi)}:${pad(ss)}`;
  const preVac = S.vacFrom && S.today<S.vacFrom && S.today>=S.vacFrom-7;
  const postVac = noPledgeWeek() && !isVacation();
  $("dlSub").textContent = preVac ? `ส่งการบ้านให้ครบภายใน ${dayDateTH(S.vacFrom-1)} · ${dayDateTH(S.vacFrom)} – ${dayDateTH(S.vacTo)} ปิดเทอม 🏖`
    : postVac ? `กลับมาแล้ว! งานวันนี้นับรวมยอด · สัปดาห์ใหม่เริ่มหลังไลฟ์ ${DOW_TH[C.WEEK_CUTOFF_DOW==null?3:+C.WEEK_CUTOFF_DOW]} ${S.weekCut||C.WEEK_CUTOFF_TIME||"20:30"} น.`
    : `${DOW_TH[C.WEEK_CUTOFF_DOW==null?3:+C.WEEK_CUTOFF_DOW]} ${S.weekCut||C.WEEK_CUTOFF_TIME||"20:30"} น. · งานที่ส่งหลังเวลานี้นับเป็นสัปดาห์ถัดไป`;
  if(postVac) $("dlLabel").textContent="📅 สัปดาห์ใหม่เริ่มใน";
  box.classList.toggle("soon", ms<24*3600e3);
  /* มือถือ: เห็นเต็มใบครั้งแรกของวัน หลังจากนั้นย่อเป็นแถบ (แตะสลับได้) · ใกล้ตัดรอบ <24 ชม. ไม่ย่อ */
  if(box._miniInit===undefined){
    const k="cutSeen."+new Date().toDateString(); let seen=false;
    try{ seen=!!localStorage.getItem(k); localStorage.setItem(k,"1"); }catch(e){}
    box._miniInit=true; box.classList.toggle("mini", seen);
    box.onclick=()=>box.classList.toggle("mini");
  }
  if(box.classList.contains("soon")) box.classList.remove("mini");
}
/* ---- ท้องฟ้าเปลี่ยนตามเวลาที่เหลือก่อนปิดรอบ (ส่งแล้วฟ้าสงบ) ---- */
function updateSky(){
  const sky=$("sky"); if(!sky) return;
  const [hh]=cutoffLeft().split(":").map(Number);
  let cls = hh>10 ? "" : hh>=4 ? "dusk" : hh>=1 ? "night" : "late";
  if(!$("scArena").classList.contains("on")) cls="";
  else if(S.spectator || S.postedToday){ if(cls==="late"||cls==="night") cls="dusk"; }
  ["dusk","night","late"].forEach(c=>sky.classList.toggle(c, c===cls));
}
/* ---- คอมโบ / ป้ายใหญ่กลางจอ ---- */
function bigPop(main, sub="", cls=""){
  const el=document.createElement("div"); el.className="combo "+cls; el.innerHTML=`<b>${main}</b>${sub?`<small>${sub}</small>`:""}`;
  document.body.appendChild(el); setTimeout(()=>el.remove(), 1500);
}
function comboPop(n){
  bigPop(`×${n} COMBO`, n>=4?"บ้าไปแล้ว!":n===3?"ร้อนแรง!":"วันนี้ชิ้นที่ 2!");
  [0,1,2].forEach(i=>beep(880*Math.pow(1.12,n+i), .12, "square", .14, i*.07));
}
/* ---- วิ่งจริงตอนส่งงาน: กล้องไปหาตัวเรา สปรินต์ ฝุ่นฟุ้ง จอสั่น ---- */
function sprintMe(){
  setSubTab("track");
  if(!document.querySelector(".lane.meLane")){ S.raceFilter="near"; renderFilters(); renderTrack(); }
  const lane=document.querySelector(".lane.meLane"); if(!lane) return;
  lane.scrollIntoView({block:"center", behavior:"smooth"});
  const r=lane.querySelector(".runner"); if(r){ r.classList.add("sprint"); setTimeout(()=>r.classList.remove("sprint"), 1600); }
  document.body.classList.add("shake"); setTimeout(()=>document.body.classList.remove("shake"), 400);
}
/* ---- แซง / โดนแซง: เทียบจำนวนชิ้นกับรอบก่อน (เก็บในเครื่อง) ---- */
S.passEvents=[];
function trackOvertakes(){
  const me=meR(); if(!me || S.spectator) return {iPassed:[],passedMe:[]};
  const key="snap."+me.id; let prev=null; try{ prev=JSON.parse(localStorage.getItem(key)||"null"); }catch(e){}
  const now={}; S.runners.forEach(r=>{ if(roleOf(r)==="student") now[r.name]=stats(r).contents; });
  const out={iPassed:[],passedMe:[]};
  if(prev && prev[me.name]!=null){
    const mb=prev[me.name], ma=now[me.name];
    Object.keys(now).forEach(n=>{
      if(n===me.name || prev[n]==null) return;
      const xb=prev[n], xa=now[n];
      if(xb>=mb && xa<ma) out.iPassed.push(n);
      if(xb<=mb && xa>ma && xa>xb) out.passedMe.push({who:n, gap:xa-ma});
    });
  }
  try{ localStorage.setItem(key, JSON.stringify(now)); }catch(e){}
  const ts=Date.now();
  out.passedMe.forEach(p=>S.passEvents.unshift({who:p.who, gap:p.gap, ts}));
  S.passEvents=S.passEvents.slice(0,10);
  if(out.passedMe.length && !S.submitting && document.visibilityState==="visible"){
    const p=out.passedMe[0];
    bigPop(`${p.who} แซงคุณแล้ว!`, `ห่าง ${p.gap} ชิ้น — เอาคืนสิ`, "pass");
    beep(330,.18,"sawtooth",.12); beep(262,.3,"sawtooth",.12,.18);
  }
  return out;
}

/* ---- PWA: ลงทะเบียน service worker + ปุ่มติดตั้ง ---- */
if("serviceWorker" in navigator && location.protocol==="https:"){ navigator.serviceWorker.register("/sw.js").catch(()=>{}); }
let deferredInstall=null;
window.addEventListener("beforeinstallprompt", e=>{ e.preventDefault(); deferredInstall=e; $("installBtn").hidden=false; });
window.addEventListener("appinstalled", ()=>{ $("installBtn").hidden=true; toast("ติดตั้งแอปแล้ว 📲 เปิดจากหน้าจอโฮมได้เลย"); });
$("installBtn").onclick=async()=>{ $("moreMenu").hidden=true; if(!deferredInstall) return; deferredInstall.prompt(); await deferredInstall.userChoice; deferredInstall=null; $("installBtn").hidden=true; };

/* ---- กระดิ่ง: เหตุการณ์ที่เกี่ยวกับฉัน ---- */
function myEvents(){
  const me=meR(); if(!me || S.spectator) return [];
  const ev=[], id=me.id, cw=curWeek();
  const ch=(S.cheers||[]).filter(c=>c.to_id===id && c.day_index===S.today);
  if(ch.length){ const names=[...new Set(ch.map(c=>(S.runners.find(r=>r.id===c.from_id)||{}).name).filter(Boolean))];
    ev.push({k:"cheer"+ch.length, i:"👏", t:`วันนี้มีคนเชียร์คุณ ${ch.length} คน`, s:names.slice(0,5).join(", "), go:()=>showPage("pgRace")}); }
  { const ng=(S.nudges||[]).filter(n=>n.to_id===id && n.day_index===S.today);
    if(ng.length && !S.postedToday){ const nn=[...new Set(ng.map(n=>(S.runners.find(r=>r.id===n.from_id)||{}).name).filter(Boolean))];
      ev.push({k:"ng"+S.today+":"+ng.length, i:"👉", t:`${nn.length} คนสะกิดให้คุณส่งงานวันนี้`, s:nn.slice(0,5).join(", "), go:goSubmit}); } }
  (S.duels||[]).forEach(d=>{
    const mine=d.challenger===id||d.opponent===id; if(!mine) return;
    const other=d.challenger===id?d.opponent_name:d.challenger_name;
    if(d.status==="pending" && d.opponent===id) ev.push({k:"dp"+d.id, i:"⚔️", t:`${other} ท้าดวลคุณ 7 วัน`, s:"กดรับหรือปฏิเสธที่การ์ดเป้า", go:()=>showPage("pgRace")});
    if(d.status==="active"){ const my=d.challenger===id?d.challenger_score:d.opponent_score, th=d.challenger===id?d.opponent_score:d.challenger_score;
      ev.push({k:"da"+d.id+my+th, i:"⚔️", t:`ดวลกับ ${other}: คุณ ${my} : ${th}`, s:`เหลือ ${Math.max(0,d.end_day-S.today+1)} วัน`, go:()=>showPage("pgRace")}); }
    if(d.status==="done" && d.winner===id && d.prize_hat==null) ev.push({k:"dw"+d.id, i:"🏆", t:`คุณชนะดวลกับ ${other}!`, s:"เลือกหมวกให้ผู้แพ้ที่การ์ดเป้า", go:()=>showPage("pgRace")});
    if(d.status==="done" && d.winner && d.winner!==id && d.prize_hat!=null && S.today<=d.end_day+7) ev.push({k:"dl"+d.id, i:"😵", t:`แพ้ดวล ${other} — ใส่หมวกที่เขาเลือกอีก ${d.end_day+7-S.today+1} วัน`, s:"", go:()=>showPage("pgStatus")});
  });
  (S.bosses||[]).filter(b=>b.week_no===cw && (b.house_id==null||b.house_id===me.house)).forEach(b=>{
    if(b.damage>=b.hp) ev.push({k:"bk"+b.id, i:"💥", t:`ล้มบอส ${b.name} แล้ว!`, s:"ทุกคนที่ส่งงานสัปดาห์นี้ได้ป้าย BOSS SLAYER", go:()=>showPage("pgRace")});
    else if(b.hp-b.damage<=Math.ceil(b.hp*0.2)) ev.push({k:"bh"+b.id+b.damage, i:"👹", t:`บอส ${b.name} เหลือ HP ${b.hp-b.damage}`, s:"อีกนิดเดียว ส่งงานช่วยบ้าน!", go:()=>showPage("pgRace")});
  });
  (S.passEvents||[]).filter(p=>Date.now()-p.ts<86400e3).slice(0,3).forEach(p=>ev.push({k:"pass"+p.who+p.ts, i:"🏃", t:`${p.who} แซงคุณแล้ว (ห่าง ${p.gap} ชิ้น)`, s:"ส่งอีกชิ้นเอาคืน", go:goSubmit}));
  if(isKingNow(me)) ev.push({k:"king"+cw, i:"👑", t:"คุณคือที่ 1 ของบ้านสัปดาห์นี้", s:"รักษาไว้จนจบสัปดาห์จะได้ป้าย King of the Week", go:()=>showPage("pgBoard")});
  const st=stats(me);
  if(st.dayStreak>=7 && [7,14,21,30].includes(st.dayStreak)) ev.push({k:"stk"+st.dayStreak, i:"🔥", t:`streak ${st.dayStreak} วันติด!`, s:"", go:()=>showPage("pgStatus")});
  return ev;
}
function renderBell(){
  const me=meR(), btn=$("bellBtn"); if(!btn) return;
  if(!me || S.spectator){ btn.hidden=true; $("bellMenu").hidden=true; return; }
  btn.hidden=false;
  const ev=myEvents(); const key="bellSeen."+me.id; let seen=""; try{ seen=localStorage.getItem(key)||""; }catch(e){}
  const sig=ev.map(e=>e.k).join("|");
  const n = sig && sig!==seen ? ev.length : 0;
  $("bellN").hidden = !n; $("bellN").textContent=n;
  $("bellMenu").innerHTML = ev.length ? ev.map((e,i)=>`<div class="it" data-ev="${i}"><i>${e.i}</i><div>${e.t}${e.s?`<small>${e.s}</small>`:""}</div></div>`).join("")
    : '<div class="none">ยังไม่มีอะไรใหม่ — ส่งงานแล้วเดี๋ยวมีคนมาเชียร์</div>';
  $("bellMenu")._ev=ev; $("bellMenu")._sig=sig;
}
$("bellBtn").onclick=()=>{ const m=$("bellMenu"); m.hidden=!m.hidden; $("moreMenu").hidden=true; if(!m.hidden){ try{ localStorage.setItem("bellSeen."+meR().id, m._sig||""); }catch(e){} $("bellN").hidden=true; } };
$("bellMenu").onclick=e=>{ const it=e.target.closest(".it"); if(!it) return; const ev=($("bellMenu")._ev||[])[+it.dataset.ev]; $("bellMenu").hidden=true; if(ev&&ev.go) ev.go(); };
document.addEventListener("click", e=>{ if(!e.target.closest("#bellMenu") && !e.target.closest("#bellBtn")) $("bellMenu").hidden=true; if(!e.target.closest("#moreMenu") && !e.target.closest("#moreBtn")) $("moreMenu").hidden=true; });

/* ---- ใกล้ฉันในสกอร์บอร์ด: คนบน / ฉัน / คนล่าง ---- */
function renderNearMe(){
  const box=$("nearMe"); const me=meR();
  if(!me || S.spectator){ box.hidden=true; return; }
  const list=ranked(); const i=list.findIndex(r=>r.name===me.name); if(i<0){ box.hidden=true; return; }
  const rows=[i-1,i,i+1].filter(j=>j>=0 && j<list.length).map(j=>{
    const r=list[j], s=stats(r), my=stats(me).contents, d=s.contents-my;
    const gap = j===i ? "คุณ" : d>0 ? `นำคุณ ${d} ชิ้น` : d<0 ? `ตามคุณ ${-d} ชิ้น` : "เท่ากัน";
    return `<div class="nr ${j===i?"me":""}" data-n="${r.name}"><span class="rk">${j<3?["🥇","🥈","🥉"][j]:String(j+1).padStart(2,"0")}</span>
      <span class="nm" style="color:${boardColor(r,s)}">${r.name}</span><span class="gap">${gap}</span><span class="ct">${s.contents}</span></div>`;
  }).join("");
  box.hidden=false;
  box.innerHTML=`<div class="head">รอบตัวคุณ · อันดับ ${i+1} จาก ${list.length}</div>`+rows;
}
$("nearMe").onclick=e=>{ const t=e.target.closest(".nr"); if(t) openProfile(t.dataset.n); };

/* ---- ปุ่มย้อนกลับของมือถือ/เบราว์เซอร์: ปิดหน้าต่างที่เปิดอยู่ก่อน ไม่งั้นกลับสนามแข่ง ---- */
new MutationObserver(ms=>{
  ms.forEach(m=>{ const el=m.target; if(!el.classList.contains("modal")) return; if(el.classList.contains("on") && !el._pushed){ el._pushed=true; history.pushState({modal:el.id, page:(history.state&&history.state.page)||"pgRace"}, ""); }
    if(!el.classList.contains("on")) el._pushed=false; });
}).observe(document.body, {attributes:true, attributeFilter:["class"], subtree:true});
window.addEventListener("popstate", e=>{
  const open=[...document.querySelectorAll(".modal.on")];
  if(open.length){ open[open.length-1].classList.remove("on"); return; }
  const m=$("moreMenu"), b=$("bellMenu"); if(m) m.hidden=true; if(b) b.hidden=true;
  if($("scArena").classList.contains("on")) showPage((e.state&&e.state.page)||"pgRace", true);
});
document.querySelectorAll("[data-back]").forEach(el=>el.onclick=ev=>{ ev.preventDefault(); showPage("pgRace"); });

/* ---- แท็บในหน้า RACE: สนาม | TA WAR | ฟีด ---- */
function setSubTab(k){
  if(k==="ta" && $("taPanel").hidden) k="track";
  document.querySelectorAll("#subTabs button").forEach(b=>b.classList.toggle("on", b.dataset.st===k));
  $("trackPanel").hidden = k!=="track";
  $("taPanel").style.display = k==="ta" ? "" : "none";
  $("duelPanel").hidden = k!=="duel";
  $("feedPanel").hidden = k!=="feed";
  try{ localStorage.setItem("subTab", k); }catch(e){}
}
$("subTabs").onclick=e=>{ const b=e.target.closest("button[data-st]"); if(b) setSubTab(b.dataset.st); };
(function(){ let k="track"; try{ k=localStorage.getItem("subTab")||"track"; }catch(e){} setTimeout(()=>setSubTab(k),0); })();

/* ---- hint ยาว ๆ ซ่อนหลัง ⓘ ---- */
document.querySelectorAll("#scArena .panel .hint, #scArena .shareSide .hint").forEach(el=>{
  if(el.id || el.closest("details")) return;
  const d=document.createElement("details"); d.className="infoD"; d.innerHTML="<summary>ⓘ รายละเอียด</summary>";
  el.parentNode.insertBefore(d, el); d.appendChild(el);
});

/* ---- โปรไฟล์บนมือถือ: ปัดลงเพื่อปิด ---- */
(function(){ let y0=null;
  document.addEventListener("touchstart", e=>{ const t=e.target.closest(".modal.on .sheet .titlebar"); y0 = t ? e.touches[0].clientY : null; }, {passive:true});
  document.addEventListener("touchmove", e=>{ if(y0==null) return; const dy=e.touches[0].clientY-y0; if(dy>70){ const m=e.target.closest(".modal"); if(m) m.classList.remove("on"); y0=null; } }, {passive:true});
})();

/* ---- ปุ่มส่งงานในเมนู: ไปหน้า RACE เลื่อนถึงช่อง แล้ววางเคอร์เซอร์ให้ ---- */
function goSubmit(){
  if(S.spectator) return leaveSpectator();
  showPage("pgRace");
  setTimeout(()=>{ $("submitPanel").scrollIntoView({behavior:"smooth", block:"start"}); setTimeout(()=>$("url").focus({preventScroll:true}), 450); }, 30);
}
$("navSubmit").onclick=goSubmit;
/* ปุ่มส่งงานลอย (มือถือ): โผล่เฉพาะหน้าสนามตอนฟอร์มส่งงานหลุดจอ และยังส่งได้ */
function updateFab(){
  const f=$("fab"); if(!f) return;
  const onRace = $("scArena").classList.contains("on") && $("pgRace").classList.contains("on");
  f.hidden = S.spectator || !onRace || !!f._formSeen || $("pushBtn").disabled;
}
if("IntersectionObserver" in window){
  new IntersectionObserver(es=>{ $("fab")._formSeen=es[0].isIntersecting; updateFab(); },{threshold:0.1}).observe($("submitPanel"));
}
$("fab").onclick=goSubmit;
window.addEventListener("scroll", updateFab, {passive:true});
/* ---- เดาแพลตฟอร์มจากลิงก์ ---- */
function detectPlat(url){
  const u=url.toLowerCase();
  const map=[[/tiktok\.com|vt\.tiktok/,"TikTok"],[/youtube\.com|youtu\.be/,"YouTube"],[/threads\.(net|com)/,"Threads"],[/instagram\.com|instagr\.am/,"Instagram"],
             [/facebook\.com|fb\.watch|fb\.com|fb\.me/,"Facebook"],[/(^|\/\/)(www\.)?(x\.com|twitter\.com)|t\.co\//,"X"]];
  const hit=map.find(([re])=>re.test(u)); return hit ? hit[1] : null;
}
$("url").addEventListener("input", ()=>{
  const p=detectPlat($("url").value.trim());
  if(p && PLATS.includes(p) && [...$("plat").options].some(o=>o.value===p)){ $("plat").value=p; $("platHint").textContent=`✓ เลือก ${p} ให้แล้ว`; }
  else if(p && PLATS.includes(p) && S.platPick){ $("platHint").textContent=`⚠️ ลิงก์นี้เป็น ${p} แต่สัปดาห์นี้คุณโฟกัส ${S.platPick.join(" · ")}`; }
  else $("platHint").textContent = $("url").value.trim() ? "เลือกแพลตฟอร์มด้านบนให้ตรง" : "";
});
/* ---- แถบวันนี้ (ติดขอบบน) ---- */
function renderTodayBar(){ renderToday(); }
/* การ์ด "วันนี้ของฉัน" — ตัวละคร เลเวล สถานะวันนี้ นาฬิกา ภารกิจ streak โล่ รวมที่เดียว */
function renderToday(){
  const box=$("todayCard"); if(!box) return;
  const me=meR();
  if(S.spectator || !me || !$("scArena").classList.contains("on")){ box.hidden=true; return; }
  box.hidden=false;
  const s=stats(me), h=houseOf(me.house), role=roleOf(me);
  const n=Math.max(S.todayCount||0,(s.byDay||{})[S.today]||0);
  const left=cutoffLeft(); const hrs=parseInt(left,10);
  const stCls = n ? "ok" : (isFinite(hrs)&&hrs<3 ? "late" : "wait");
  const q=questsOf(), done=q.filter(x=>x.done).length;
  try{ const k="questDone."+me.id, kd="questDays."+me.id; const last=localStorage.getItem(k);
    if(done===3 && last!==String(S.today)){ localStorage.setItem(k,String(S.today)); bigPop("ภารกิจครบ 3 ข้อ!","+30 XP · เก่งมาก","pass"); SFX.unlock(); } }catch(e){}
  const roleLbl = role==="head" ? '<span style="color:#ff4d6d">🎓 หัวหน้าโค้ช</span>' : `${h.emoji} <span style="color:${h.color}">${h.name}</span>${role==="ta"?' · <span style="color:#5ef08c">TA</span>':""}`;
  box.innerHTML=`<div class="titlebar"><h2>วันนี้ของฉัน · ภารกิจ ${done}/3</h2><span title="${XP_RULES}">${done===3?"ครบแล้ว 🎉":"ส่ง 1 + เชียร์ 3 = +30 XP"}</span></div>
    <div class="body qBody">
      <div class="tdTop">
        <div class="tdMe">${sprite(avOf(me),2,s.style)}</div>
        <div class="tdInfo"><div class="tdName">${me.name}<small>${roleLbl}</small></div>${levelHTML(me)}</div>
        <div class="tdState ${stCls}"><b>${n?`✅ วันนี้ส่งแล้ว ${n} ชิ้น`:"⏳ วันนี้ยังไม่ส่ง"}</b><span>ปิดรอบใน <i id="tbClock">${left}</i></span></div>
      </div>
      ${liveHTML()}
      <div class="qList">${q.map(x=>`<button class="q ${x.done?"done":""}" data-q="${x.k}"><i>${x.done?"✅":x.i}</i><b>${x.t}</b><small>${x.sub}</small></button>`).join("")}</div>
      <div class="qFoot">
        <span>🎯 สัปดาห์นี้ <b>${s.weekDone}${s.weekTarget?"/"+s.weekTarget:""}</b></span>
        <span>🔥 streak ${s.dayStreak} วัน</span>
        ${s.freezeLeft==null?"":`<span class="shield" title="พลาดวันได้โดย streak ไม่ขาด สปรินต์ละ 2 วัน">🛡 วันลา ${s.freezeLeft}/2</span>`}
        ${n?"":'<button class="btn xs gold" id="tbGo">ส่งงาน ▶</button>'}
      </div>
    </div>`;
  const go=$("tbGo"); if(go) go.onclick=goSubmit;
}
$("todayCard").onclick=e=>{ const b=e.target.closest("button[data-q]"); if(!b) return; const q=questsOf().find(x=>x.k===b.dataset.q); if(q&&!q.done&&q.go) q.go(); };
/* ---- เรียนสด: เช็คอิน (โชว์เมื่ออยู่ในช่วง −30 นาที ถึง +60 นาทีของคาบ) ---- */
function liveNow(){
  const now=Date.now();
  return (S.sessions||[]).find(s=>now>=new Date(s.starts_at).getTime()-30*60e3 && now<=new Date(s.ends_at).getTime()+60*60e3)||null;
}
function liveHTML(){
  const s=liveNow(); if(!s) return "";
  const done=S.myCheckins && S.myCheckins.has(s.id);
  const t=new Date(s.starts_at).toLocaleTimeString("th-TH",{hour:"2-digit",minute:"2-digit"});
  return `<div class="liveRow ${done?"done":""}">📺 <b>${s.title}</b><span style="font-size:12px;color:#cdc7ff">เรียนสด ${t} น.</span>
    ${done?'<span style="color:var(--green);font-weight:700">✅ เช็คอินแล้ว</span>':`<button class="btn xs gold" data-checkin="${s.id}">เช็คอินเข้าเรียน</button>`}</div>`;
}
document.addEventListener("click", async e=>{
  const b=e.target.closest("button[data-checkin]"); if(!b) return;
  b.disabled=true;
  try{ await DB.checkin(+b.dataset.checkin); SFX.coin(); toast("เช็คอินแล้ว ✅ ขอให้สนุกกับคาบเรียน"); await refresh(); }
  catch(err){ toast(err.message); b.disabled=false; }
});
/* ---- +1 ลอยเหนือหัวตัวเอง ---- */
function floatPlus(txt="+1"){
  const el=document.querySelector(".runner.me .body"); if(!el) return;
  const b=document.createElement("b"); b.className="plus1"; b.textContent=txt; el.appendChild(b); setTimeout(()=>b.remove(),1700);
}
/* ---- แนะนำครั้งแรก 3 หน้า ---- */
let obIdx=0;
function obShow(i){ obIdx=i; document.querySelectorAll(".obSlide").forEach(s=>s.hidden=+s.dataset.ob!==i); $("obStep").textContent=`${i+1} / 3`; $("obNext").textContent=i===2?"เริ่มเลย ▶":"ต่อไป ▶"; }
function maybeOnboard(){
  const me=meR(); if(!me || S.spectator) return Promise.resolve(false);
  const key="onboarded."+me.id; let seen=false; try{ seen=!!localStorage.getItem(key); }catch(e){}
  if(seen || stats(me).contents>0){ try{ localStorage.setItem(key,"1"); }catch(e){} return Promise.resolve(false); }
  return new Promise(res=>{
    obShow(0); $("obModal").classList.add("on");
    let fin=false;
    const done=()=>{ if(fin) return; fin=true; mo.disconnect(); $("obModal").classList.remove("on"); try{ localStorage.setItem(key,"1"); }catch(e){} res(true); };
    /* ปิดด้วยแตะข้างนอก / Esc / ปุ่ม Back ก็ต้องนับว่าจบ ไม่งั้น boot() ค้างรอ ไม่เปิดเลือกเป้า และเด้งแนะนำซ้ำทุกครั้ง */
    const mo=new MutationObserver(()=>{ if(!$("obModal").classList.contains("on")) done(); });
    mo.observe($("obModal"),{attributes:true, attributeFilter:["class"]});
    $("obSkip").onclick=done;
    $("obNext").onclick=()=>{ if(obIdx<2) obShow(obIdx+1); else done(); };
  });
}
$("helpBtn").onclick=()=>{ $("moreMenu").hidden=true; $("helpModal").classList.add("on"); };
/* ---- ขอฟีเจอร์ / แจ้งบั๊ก + โหวต ---- */
let fbKind="idea";
const FB_ST={new:"ใหม่", planned:"รับแล้ว กำลังทำ", done:"ทำแล้ว ✅", rejected:"ไม่ทำ"};
function fbPage(){ const p=document.querySelector(".page.on"), st=document.querySelector("#subTabs button.on"); return (p&&p.id||"")+(st&&st.dataset.st?"/"+st.dataset.st:""); }
async function renderFeedback(){
  const box=$("fbList"); if(!box) return;
  try{
    const rows=await DB.feedbackList();
    if(!rows.length){ box.innerHTML='<div class="fbEmpty">ยังไม่มีคำขอ — เป็นคนแรกเลย</div>'; return; }
    box.innerHTML=rows.map(r=>`<div class="fbItem ${r.status}" data-id="${r.id}">
      <button class="fbVote ${r.mine?"on":""}" data-vote="${r.id}" ${S.spectator?"disabled":""} title="${r.mine?"เอาโหวตออก":"โหวตให้อันนี้"}">👍 ${r.votes}</button>
      <div class="fbBody"><div class="fbMeta">${r.kind==="bug"?"🐛 บั๊ก":"💡 ฟีเจอร์"} · <b>${r.author||"?"}</b>${r.own?" (คุณ)":""} · ${new Date(r.created_at).toLocaleDateString("th-TH",{day:"numeric",month:"short"})}<span class="fbSt ${r.status}">${FB_ST[r.status]||r.status}</span></div>
        <p>${String(r.text).replace(/[<>&]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]))}</p>
        ${r.admin_note?`<div class="fbNote">💬 ทีมงาน: ${String(r.admin_note).replace(/[<>&]/g,c=>({"<":"&lt;",">":"&gt;","&":"&amp;"}[c]))}</div>`:""}</div></div>`).join("");
  }catch(err){ box.innerHTML=`<div class="fbEmpty">โหลดไม่ได้: ${err.message}</div>`; }
}
function openFeedback(){
  $("moreMenu").hidden=true;
  $("fbForm").hidden=!!S.spectator;
  $("fbText").value=""; $("fbCount").textContent="0 / 400";
  $("fbModal").classList.add("on"); renderFeedback();
}
$("fbBtn").onclick=openFeedback;
document.querySelector(".fbKinds").onclick=e=>{ const b=e.target.closest(".fbKind"); if(!b) return; fbKind=b.dataset.k; document.querySelectorAll(".fbKind").forEach(x=>x.classList.toggle("on",x===b)); };
$("fbText").oninput=()=>{ $("fbCount").textContent=`${$("fbText").value.length} / 400`; };
$("fbSend").onclick=async()=>{
  const text=$("fbText").value.trim();
  if(text.length<5) return toast("เล่าอีกนิด อย่างน้อย 5 ตัวอักษร");
  $("fbSend").disabled=true;
  try{ await DB.feedbackSend(fbKind, text, fbPage()); $("fbText").value=""; $("fbCount").textContent="0 / 400"; toast("ส่งคำขอแล้ว ขอบคุณ 💡"); await renderFeedback(); }
  catch(err){ toast(err.message); }
  $("fbSend").disabled=false;
};
$("fbList").onclick=async e=>{
  const b=e.target.closest("[data-vote]"); if(!b || b.disabled) return;
  const id=+b.dataset.vote, on=!b.classList.contains("on");
  b.disabled=true;
  try{ await DB.feedbackVote(id, on); await renderFeedback(); }catch(err){ toast(err.message); b.disabled=false; }
};
$("eyeBtn").onclick=()=>{ const p=$("pass"); p.type = p.type==="password" ? "text" : "password"; $("eyeBtn").textContent = p.type==="password" ? "👁" : "🙈"; p.focus(); };
window.addEventListener("scroll", ()=>{ $("toTop").hidden = window.scrollY < 600; }, {passive:true});
$("toTop").onclick=()=>window.scrollTo({top:0, behavior:"smooth"});

/* ---- share ---- */
$("shDownload").onclick=async()=>{
  const b=await canvasBlob();
  const a=document.createElement("a");
  a.href=URL.createObjectURL(b);
  a.download=`${meR().name}-bootcamp-${stats(meR()).contents}.png`;
  document.body.appendChild(a); a.click(); a.remove();
  setTimeout(()=>URL.revokeObjectURL(a.href),3000);
  toast("เซฟรูปแล้ว 💾<br>เอาไปโพสต์ IG / TikTok / LINE ได้เลย");
};
/* ปุ่มแชร์ผ่านแอปโชว์เฉพาะเครื่องที่รองรับ (มือถือส่วนใหญ่) */
if(!(navigator.share)) $("shShare").style.display="none";
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

/* ================= DRESSING ROOM ================= */
const DR_CATS=[["g","เพศ"],["sk","สีผิว"],["hr","ทรงผม"],["hc","สีผม"],["gl","แว่นตา"],["top","เสื้อ"],["pt","กางเกง"],["pc","สีกางเกง"],["hat","หมวก"],["mo","ปาก"],["no","จมูก"]];
const DR_OPTS={g:AV.gender, sk:AV.skin, hr:AV.hair, hc:AV.hairColor, gl:AV.glasses, top:AV.top, pt:AV.pants, pc:AV.pantsColor, hat:AV.hat, mo:AV.mouth, no:AV.nose};
const DR_LABEL={sk:i=>"โทน "+(i+1), hc:i=>["ดำ","น้ำตาล","ทอง","แดง","น้ำเงิน","ชมพู","ขาว","เขียว"][i], pc:i=>["น้ำเงิน","ดำ","กากี","แดง","ขาว","เขียว","ม่วง"][i]};
let drAv=null, drCat="g", drMode="select";
/* mode: "select" = ตอนสมัคร (เก็บไว้ในเครื่องจนกดเข้าร่วม)  "arena" = แก้ทีหลัง (บันทึกลงฐานข้อมูลทันที) */
function openDress(mode){
  drMode=mode;
  /* โหมดสนามเริ่มจากชุดที่เก็บไว้จริง ไม่ใช่ avOf() ที่แปะมงกุฎ/หมวกดวล/ดาบทับอยู่ ไม่งั้นกดบันทึกแล้วหมวกจริงหาย */
  if(mode==="select") drAv=Object.assign({},pickAv,{color:pickColor});
  else { const r=meR(), src=(r&&r.avatar)||{}; drAv=Object.assign({},DEF_AV); AV_KEYS.forEach(k=>{ if(Number.isInteger(src[k])) drAv[k]=src[k]; }); if(CROWN_HATS.has(drAv.hat)||PRIZE_HATS.has(drAv.hat)) drAv.hat=0; drAv.color=(r&&r.color)||COLORS[0]; }
  drCat="g"; drawDress(); $("dressModal").classList.add("on");
}
window.openDress=openDress;
function drawDress(){
  $("drPreview").innerHTML=runnerBox(drAv,7);
  $("drTabs").innerHTML=DR_CATS.map(([k,n])=>`<button class="drTab ${k===drCat?"on":""}" data-k="${k}">${n}</button>`).join("");
  const st = drMode==="arena" ? stats(meR()) : EMPTY_ST;
  $("drOpts").innerHTML=DR_OPTS[drCat].map((o,i)=>{
    if(drCat==="hat" && (CROWN_HATS.has(i) || PRIZE_HATS.has(i))) return "";   // มงกุฎ = King of the Week เท่านั้น · หมวกดวล = แพ้/ชนะดวลเท่านั้น
    const av=Object.assign({},drAv,{[drCat]:i});
    const label = DR_LABEL[drCat] ? DR_LABEL[drCat](i) : o;
    const lock = lockOf(drCat,i,st);
    /* หมวดที่เป็น "สี" โชว์เป็นแถบสี — ตัวละครจิ๋วต่างกันแค่ไม่กี่พิกเซล มองไม่ออกว่าอันไหนสีอะไร */
    if(["sk","hc","pc"].includes(drCat))
      return `<button class="drOpt tile ${drAv[drCat]===i?"on":""}" data-i="${i}"><i class="tileSw" style="background:linear-gradient(180deg,${o[0]},${o[1]})"></i><span>${label}</span></button>`;
    return `<button class="drOpt ${drAv[drCat]===i?"on":""} ${lock?"locked":""}" data-i="${i}">${sprite(av,4,"normal")}<span>${label}</span>${lock?`<em>🔒 ${lock.how}</em>`:""}</button>`;
  }).join("");
  /* สวอตช์สีชุดโชว์เฉพาะแท็บเสื้อ — เดิมโผล่ใต้ทุกแท็บ คนอยู่แท็บสีกางเกงเลยกดสวอตช์แล้วเสื้อเปลี่ยนแทน */
  const showSw = drCat==="top";
  $("drSwatches").hidden = !showSw; $("drSwatches").previousElementSibling.hidden = !showSw;
  $("drSwatches").innerHTML=COLORS.map(c=>
    `<button class="sw ${c===drAv.color?"sel":""}" data-c="${c}"
      style="background:linear-gradient(180deg,${shift(c,40)},${c} 55%,${shift(c,-50)})"></button>`).join("");
}
$("drTabs").onclick=e=>{ const b=e.target.closest(".drTab"); if(b){ drCat=b.dataset.k; drawDress(); } };
$("drOpts").onclick=e=>{
  const b=e.target.closest(".drOpt"); if(!b) return;
  const i=+b.dataset.i;
  const lock=lockOf(drCat,i, drMode==="arena" ? stats(meR()) : EMPTY_ST);
  if(lock) return toast(`🔒 ${lock.th} ปลดล็อกเมื่อ${lock.how}`);
  drAv[drCat]=i;
  /* เปลี่ยนเพศแล้วสลับทรงผมเริ่มต้นให้ ถ้ายังใช้ทรงพื้นฐานอยู่ */
  if(drCat==="g"){ if(i===1 && [0,1,4].includes(drAv.hr)) drAv.hr=2; if(i===0 && [2,3].includes(drAv.hr)) drAv.hr=0; }
  drawDress();
};
$("drSwatches").onclick=e=>{ const b=e.target.closest(".sw"); if(b){ drAv.color=b.dataset.c; drawDress(); } };
$("drRandom").onclick=()=>{ drAv=Object.assign(randAv(Date.now()%9973),{color:COLORS[Math.floor(Math.random()*COLORS.length)]}); drawDress(); };
$("drSave").onclick=async()=>{
  /* กันของล็อก/มงกุฎ/หมวกดวลหลุดเข้ามาทางปุ่มสุ่ม */
  const stSave = drMode==="arena" ? stats(meR()) : EMPTY_ST;
  AV_KEYS.forEach(k=>{ if(lockOf(k,drAv[k],stSave)) drAv[k]=DEF_AV[k]; });
  if(CROWN_HATS.has(drAv.hat)||PRIZE_HATS.has(drAv.hat)) drAv.hat=0;
  const av={}; AV_KEYS.forEach(k=>{ av[k]=drAv[k]; });
  if(drMode==="select"){ pickAv=av; pickColor=drAv.color; drawSelect(); $("dressModal").classList.remove("on"); return; }
  $("drSave").disabled=true;
  try{ await DB.updateAvatar(av, drAv.color); await refresh(); $("dressModal").classList.remove("on"); toast("เปลี่ยนชุดแล้ว 👕"); }
  catch(err){ toast(err.message); }
  $("drSave").disabled=false;
};
$("dressBtn").onclick=()=>openDress("select");
$("dressBtn2").onclick=()=>openDress("arena");

/* ================= GAMIFICATION ================= */
/* ---- 1. ปลดล็อกของแต่งตัวด้วยผลงาน
   เช็คจาก stats ของตัวเองฝั่งเว็บ (ของแต่งตัวไม่มีผลต่อคะแนน เลยไม่ต้องกันฝั่งเซิร์ฟเวอร์)
   key = หมวด:index ในห้องแต่งตัว ---- */
const UNLOCKS = {
  "gl:3":  {th:"แว่นกันแดด",  need:s=>s.contents>=10, how:"ปล่อยครบ 10 ชิ้น"},
  "hat:6": {th:"หมวกคาวบอย",  need:s=>s.contents>=20, how:"ปล่อยครบ 20 ชิ้น"},
  "hat:5": {th:"หมวกทรงสูง",  need:s=>s.contents>=30, how:"ปล่อยครบ 30 ชิ้น"},
  "top:5": {th:"สูทผูกไท",    need:s=>s.contents>=45, how:"ปล่อยครบ 45 ชิ้น (ครึ่งทาง)"},
  "hr:8":  {th:"ผมแอฟโฟร",    need:s=>s.dayStreak>=7, how:"ส่งติดกัน 7 วัน"},
  "hat:7": {th:"หมวกพ่อมด",   need:s=>s.contents>=60, how:"ปล่อยครบ 60 ชิ้น"},
  /* ไอเทมพิเศษ — ชุดละ 6 ชิ้น มีทั้งแนวผู้หญิงและผู้ชาย */
  "hat:8":  {th:"เบเร่ต์",        need:s=>s.contents>=30, how:"ปล่อยครบ 30 ชิ้น"},
  "hat:9":  {th:"หมวกฟาง",       need:s=>s.contents>=30, how:"ปล่อยครบ 30 ชิ้น"},
  "hat:10": {th:"แก๊ปกลับหลัง",   need:s=>s.contents>=30, how:"ปล่อยครบ 30 ชิ้น"},
  "gl:5":   {th:"แว่นหัวใจ",      need:s=>s.contents>=30, how:"ปล่อยครบ 30 ชิ้น"},
  "top:7":  {th:"เสื้อครอป",      need:s=>s.contents>=30, how:"ปล่อยครบ 30 ชิ้น"},
  "top:8":  {th:"แจ็กเก็ตหนัง",   need:s=>s.contents>=30, how:"ปล่อยครบ 30 ชิ้น"},
  "hat:11": {th:"โบว์ใหญ่",       need:s=>s.contents>=60, how:"ปล่อยครบ 60 ชิ้น"},
  "hat:12": {th:"หูแมว",         need:s=>s.contents>=60, how:"ปล่อยครบ 60 ชิ้น"},
  "hat:13": {th:"หมวกไวกิ้ง",     need:s=>s.contents>=60, how:"ปล่อยครบ 60 ชิ้น"},
  "gl:6":   {th:"วิเซอร์ไซเบอร์", need:s=>s.contents>=60, how:"ปล่อยครบ 60 ชิ้น"},
  "top:9":  {th:"เกราะเงิน",      need:s=>s.contents>=60, how:"ปล่อยครบ 60 ชิ้น"},
  "top:10": {th:"เดรสราตรี",      need:s=>s.contents>=60, how:"ปล่อยครบ 60 ชิ้น"},
  "hat:16": {th:"รัศมีนางฟ้า",    need:s=>s.contents>=90, how:"ถึงเส้นชัย 90 ชิ้น"},
  "top:11": {th:"เกราะทอง",       need:s=>s.contents>=90, how:"ถึงเส้นชัย 90 ชิ้น"},
  "top:12": {th:"ปีกนางฟ้า",      need:s=>s.contents>=90, how:"ถึงเส้นชัย 90 ชิ้น"},
  "top:13": {th:"ผ้าคลุมฮีโร่",   need:s=>s.contents>=90, how:"ถึงเส้นชัย 90 ชิ้น"}
};
const unlockedSet = st => new Set(Object.keys(UNLOCKS).filter(k=>UNLOCKS[k].need(st||EMPTY_ST)));
const lockOf = (cat,i,st) => { const u=UNLOCKS[cat+":"+i]; return (u && !u.need(st||EMPTY_ST)) ? u : null; };

/* ---- 2. คู่แข่งข้างหน้า — อันดับ 137 ไม่มีความหมาย แต่ "ห่างจากคนข้างหน้า 2 ชิ้น" มี ---- */
function rivalOf(me){
  const list=ranked().filter(r=>roleOf(r)==="student");
  const i=list.findIndex(r=>r.name===me.name);
  if(i<0) return null;
  const my=stats(me).contents;
  if(i===0){ const b=list[1]; return {lead:true, who:b||null, gap:b?my-stats(b).contents:0}; }
  const a=list[i-1];
  return {lead:false, who:a, gap:stats(a).contents-my};
}
function rivalHTML(me){
  const rv=rivalOf(me); if(!rv) return "";
  if(rv.lead) return rv.who
    ? `👑 คุณนำทั้งรุ่นอยู่ · <b style="color:${nameColor(rv.who)}">${rv.who.name}</b> ตามมาห่าง ${rv.gap} ชิ้น`
    : "👑 คุณนำทั้งรุ่นอยู่";
  const gap=rv.gap;
  return `🎯 ข้างหน้าคุณคือ <b style="color:${nameColor(rv.who)}">${rv.who.name}</b> · `
    + (gap>0 ? `ห่างแค่ <b style="color:var(--gold)">${gap} ชิ้น</b> — ส่งอีก ${gap+1} ชิ้นแซงได้` : `คะแนนเท่ากัน — อีก 1 ชิ้นแซงเลย`);
}
function rivalText(me){
  const rv=rivalOf(me); if(!rv||!rv.who) return "";
  return rv.lead ? `👑 นำทั้งรุ่น · ${rv.who.name} ตามมาห่าง ${rv.gap} ชิ้น\n` : `🎯 ไล่ ${rv.who.name} อยู่ ห่างอีก ${rv.gap} ชิ้น\n`;
}

/* ---- 3. ป้ายรางวัล — คิดจากประวัติของคนนั้น (detail) + stats ---- */
const BADGES=[
  {k:"first",   e:"🎬", n:"FIRST POST",   th:"ปล่อยชิ้นแรก",                       test:c=>c.st.contents>=1},
  {k:"streak7", e:"🔥", n:"7-DAY STREAK", th:"ส่งติดกัน 7 วัน",                    test:c=>c.maxDay>=7},
  {k:"hit3",    e:"🎯", n:"HAT-TRICK",    th:"ครบเป้า 3 สัปดาห์ซ้อน",              test:c=>c.maxHit>=3},
  {k:"early",   e:"🌅", n:"EARLY BIRD",   th:"ส่งงานก่อน 6 โมงเช้า",                test:c=>c.early},
  {k:"laser",   e:"🔴", n:"LASER",        th:"เคยรับเป้า 10 ชิ้น",                  test:c=>c.weeks.some(w=>w.target>=10&&w.target<14)},
  {k:"promax",  e:"🔥", n:"PRO MAX",      th:"เคยรับเป้า 14 ชิ้น",                  test:c=>c.weeks.some(w=>w.target>=14)},
  {k:"revive",  e:"💀", n:"REVIVED",      th:"พลาดเป้าหนักจนเป็นกระโหลก แล้วกลับมาทำครบ", test:c=>c.revived},
  {k:"c30",     e:"🥉", n:"30 CONTENTS",  th:"ปล่อยครบ 30 ชิ้น",                    test:c=>c.st.contents>=30},
  {k:"c60",     e:"🥈", n:"60 CONTENTS",  th:"ปล่อยครบ 60 ชิ้น",                    test:c=>c.st.contents>=60},
  {k:"c90",     e:"🏆", n:"FINISHER",     th:"ถึงเส้นชัย 90 ชิ้น",                  test:c=>c.st.contents>=FINISH},
  {k:"cup",     e:"🏆", n:"HOUSE CUP",    th:"บ้านของคุณชนะถ้วยรายสัปดาห์",         test:c=>c.cups>0},
  {k:"king",    e:"👑", n:"KING OF WEEK", th:"ที่ 1 ของบ้านในสัปดาห์ที่จบไป (ได้ใส่มงกุฎราชา)", test:c=>c.kingWeeks.length>0,
                label:c=>c.kingWeeks.length>1?`KING ×${c.kingWeeks.length}`:"KING OF WEEK"},
  {k:"popular", e:"💖", n:"POPULAR",      th:"มีคนเชียร์ 10 ครั้งขึ้นไปในสัปดาห์เดียว",     test:c=>c.popular},
  {k:"duelist", e:"⚔️", n:"DUELIST",      th:"ชนะดวล 7 วัน",                                test:c=>c.duelWins>0,
                label:c=>c.duelWins>1?`DUELIST ×${c.duelWins}`:"DUELIST"},
  {k:"fallen",  e:"🩹", n:"FALLEN",       th:"เคยแพ้ดวล ต้องใส่หมวกที่ผู้ชนะเลือก",           test:c=>c.duelLosses>0,
                label:c=>c.duelLosses>1?`FALLEN ×${c.duelLosses}`:"FALLEN"},
  {k:"quality", e:"👍", n:"QUALITY",      th:"TA ให้ 'งานดี' 3 ชิ้นขึ้นไป",                  test:c=>c.kudosN>=3},
  {k:"reach",   e:"👁", n:"10K VIEWS",    th:"ยอดวิวรวมที่กรอกไว้ถึง 10,000",              test:c=>c.views>=10000},
  {k:"holiday", e:"🏅", n:"STAR STUDENT", th:"นักเรียนดีเด่น ส่งงานช่วงปิดเทอม",              test:c=>c.holiday>0,
                label:c=>c.holiday>1?`STAR STUDENT ×${c.holiday}`:"STAR STUDENT"},
  {k:"slayer",  e:"🗡️", n:"BOSS SLAYER",  th:"ร่วมล้มบอสประจำสัปดาห์กับบ้าน",               test:c=>c.bossKills>0,
                label:c=>c.bossKills>1?`SLAYER ×${c.bossKills}`:"BOSS SLAYER"}
];
function badgeCtx(r, det){
  const st=stats(r), weeks=((det&&det.weeks)||[]).slice().sort((a,b)=>a.week_no-b.week_no);
  const byDay=(det&&det.byDay)||{};
  let maxDay=0, run=0;
  for(let d=1; d<=S.today; d++){ if(byDay[d]){ run++; maxDay=Math.max(maxDay,run); } else run=0; }
  let maxHit=0, hh=0, revived=false, burnedAt=null;
  const cw=curWeek();
  weeks.forEach(w=>{
    const decided = w.finished || w.week_no<cw;
    if(decided || w.hit){ if(w.hit){ hh++; maxHit=Math.max(maxHit,hh); } else if(decided) hh=0; }
    if(decided && w.target>=HEAVY && !w.hit) burnedAt=w.week_no;
    else if(burnedAt!==null && w.hit && w.week_no>burnedAt) revived=true;
  });
  const cups=(S.cups||[]).filter(c=>c.house_id===r.house).length;
  const kingWeeks=(S.kings||[]).filter(k=>k.profile_id===r.id).map(k=>k.week_no).sort((a,b)=>a-b);
  const popular=(S.cheerWeeks||[]).some(w=>w.profile_id===r.id && w.n>=10);
  const duelWins=(S.duels||[]).filter(d=>d.status==="done" && d.winner===r.id).length;
  const duelLosses=(S.duels||[]).filter(d=>d.status==="done" && d.winner && d.winner!==r.id && (d.challenger===r.id||d.opponent===r.id)).length;
  const bossKills=(S.bossKills||[]).filter(k=>k.profile_id===r.id).length;
  const kudosN=(S.kudos||{})[r.id]||0, views=((S.reach||{})[r.id]||{}).total_views||0;
  const holiday = det ? Object.keys(byDay).reduce((s,d)=>s+(vacDay(+d)?byDay[d]:0),0) : ((S.holiday||{})[r.id]||0);
  return {st, weeks, maxDay, maxHit, early:!!(det&&det.early), revived, cups, kingWeeks, popular, duelWins, duelLosses, bossKills, kudosN, views, holiday};
}
const earnedBadges = (r,det) => { const c=badgeCtx(r,det); return BADGES.filter(b=>b.test(c)).map(b=>Object.assign({},b,{n:b.label?b.label(c):b.n})); };
function badgesHTML(list, showAll){
  const html=BADGES.map(b=>{
    const got=list.find(x=>x.k===b.k), on=!!got; if(!on && !showAll) return "";
    return `<span class="badge ${on?"on":""}" title="${b.th}"><i>${b.e}</i><b>${on?got.n:b.n}</b><small>${b.th}</small></span>`;
  }).join("");
  return html ? `<div class="badges">${html}</div>` : `<div class="noJoin" style="padding:10px">ยังไม่มีป้าย — ปล่อยชิ้นแรกก็ได้ป้ายแรกแล้ว</div>`;
}

/* ---- 4. ถ้วยบ้านรายสัปดาห์ — บ้านที่เฉลี่ยต่อคนสูงสุดของสัปดาห์ที่แล้ว ---- */
const champCup   = () => (S.cups||[]).find(c=>c.week_no===curWeek()-1) || null;
const champHouse = () => { const c=champCup(); return c ? c.house_id : null; };
const cupsOf     = hid => (S.cups||[]).filter(c=>c.house_id===hid).length;

/* ---- 5. ฟีดแบ็กตอนส่งงาน — เสียง 8-bit จาก WebAudio (ไม่ต้องมีไฟล์) + กระโดด + confetti ---- */
let AC=null;
function beep(freq, dur, type="square", vol=.15, when=0){
  try{
    AC=AC||new (window.AudioContext||window.webkitAudioContext)();
    const o=AC.createOscillator(), g=AC.createGain();
    o.type=type; o.frequency.value=freq; o.connect(g); g.connect(AC.destination);
    const t=AC.currentTime+when;
    g.gain.setValueAtTime(vol,t); g.gain.exponentialRampToValueAtTime(.001,t+dur);
    o.start(t); o.stop(t+dur);
  }catch(e){}
}
const SFX={
  coin:   ()=>{ beep(988,.08); beep(1319,.28,"square",.15,.08); },
  fanfare:()=>{ [523,659,784,1047].forEach((f,i)=>beep(f,.18,"square",.14,i*.11)); beep(1319,.55,"square",.14,.46); },
  unlock: ()=>{ [784,988,1175,1568].forEach((f,i)=>beep(f,.13,"triangle",.16,i*.08)); },
  revive: ()=>{ beep(196,.3,"sawtooth",.12); beep(392,.2,"square",.12,.3); beep(784,.45,"square",.14,.5); }
};
/* ---- เพลงประกอบ (BGM): เล่นวนเบา ๆ เปิด/ปิด/ปรับความดังได้ตลอด จำค่าไว้ในเครื่อง
   เบราว์เซอร์ห้ามเล่นเสียงเองก่อนผู้ใช้แตะจอ → ปุ่มลำโพงกะพริบชวนแตะ แล้วเริ่มเล่นตอนแตะครั้งแรก ---- */
const BGM={ a:null, on:true, vol:(+C.BGM_VOLUME>0 ? +C.BGM_VOLUME : .2), started:false, missing:false, mode:"calm" };
/* gain = ตัวคูณต่อเพลง: เพลงดวล/บอสมิกซ์มาดังกว่าเพลงชิล เลยกดลงให้ฟังแล้วดังพอ ๆ กัน */
const BGM_TRACKS={ calm:  {url:()=>C.BGM_URL||"bgm.mp3",             title:()=>C.BGM_TITLE||"เพลงประกอบ",      icon:"🎵", label:"เล่นวนไปเรื่อย ๆ", gain:1},
                   battle:{url:()=>C.BGM_BATTLE_URL||"bgm-battle.mp3", title:()=>C.BGM_BATTLE_TITLE||"เพลงดวล",  icon:"⚔️", label:"เพลงดวล (คุณกำลังดวลอยู่)", gain:.6},
                   boss:  {url:()=>C.BGM_BOSS_URL||"bgm-boss.mp3",     title:()=>C.BGM_BOSS_TITLE||"เพลงบอส",    icon:"👹", label:"เพลงบอส (บอสใกล้ล้ม ทุกคนได้ยิน)", gain:.6} };
/* ค่อย ๆ ไล่ความดังไปหาเป้า (1.5 วิ) ไม่ให้เพลงโผล่มาดังปุ๊บ */
function bgmApplyVol(instant){
  const a=BGM.a; if(!a) return;
  const target=Math.max(0, Math.min(1, BGM.vol*(BGM_TRACKS[BGM.mode]||BGM_TRACKS.calm).gain));
  clearInterval(BGM._fade);
  if(instant || Math.abs(a.volume-target)<.02){ a.volume=target; return; }
  const from=a.volume, steps=15; let i=0;
  BGM._fade=setInterval(()=>{ i++; a.volume=from+(target-from)*(i/steps); if(i>=steps){ a.volume=target; clearInterval(BGM._fade); } }, 100);
}
/* โหมดเพลง: บอสสัปดาห์นี้ใกล้ล้ม → เพลงบอส (ทุกคน) · กำลังดวล → เพลงดวล · ไม่งั้นเพลงชิล */
function bgmMode(){
  const cw=curWeek(), lim=+C.BGM_BOSS_HP||200;
  /* "ใกล้ล้ม" = เหลือต่ำกว่า BGM_BOSS_HP และไม่เกิน 30% ของเลือดเต็ม (บอสตัวเล็กในโหมดทดลองจะได้ไม่ติดเพลงบอสตลอด) */
  if((S.bosses||[]).some(b=>b.week_no===cw && b.damage<b.hp && (b.hp-b.damage)<lim && (b.hp-b.damage)<=b.hp*.3)) return "boss";
  const me=meId && meId(); const d=me ? duelOf(me) : null;
  if(d && d.status==="active") return "battle";
  return "calm";
}
function bgmSync(){
  const mode=bgmMode(); if(mode===BGM.mode) return;
  BGM.mode=mode;
  if(BGM.a){ const wasPlaying=!BGM.a.paused; BGM.a.src=BGM_TRACKS[mode].url(); BGM.a.volume=0; if(wasPlaying) BGM.a.play().then(()=>bgmApplyVol()).catch(()=>{}); }
  if(BGM.a && !BGM.a.paused) toast(mode==="boss" ? "👹 บอสใกล้ล้ม! เพลงบอสมาแล้ว" : mode==="battle" ? "⚔️ เพลงดวล! สู้เขา" : "☕ กลับมาเพลงชิล");
  bgmRender();
}
try{ BGM.on = localStorage.getItem("bgm.on")!=="0"; const v=+localStorage.getItem("bgm.vol"); if(v>=0 && v<=1 && localStorage.getItem("bgm.vol")!=null) BGM.vol=v; }catch(e){}
function bgmAudio(){
  if(BGM.a) return BGM.a;
  const a=new Audio(); a.loop=true; a.preload="none"; a.volume=0;              // เริ่มเงียบแล้วเฟดขึ้น
  BGM.mode=bgmMode(); a.src = BGM_TRACKS[BGM.mode].url();            // ไฟล์วางไว้ที่รากเว็บ (deploy แบบ flat)
  a.onerror=()=>{
    /* ไฟล์เพลงบอส/ดวลยังไม่มี → ถอยไปใช้เพลงดวล แล้วเพลงชิล ก่อนจะยอมแพ้ */
    const fb = BGM.mode==="boss" ? "battle" : BGM.mode==="battle" ? "calm" : null;
    if(fb){ BGM._fellBack=BGM.mode; BGM.mode=fb; a.src=BGM_TRACKS[fb].url(); a.volume=0; if(BGM.on) a.play().then(()=>bgmApplyVol()).catch(()=>{}); bgmRender(); return; }
    BGM.missing=true; bgmRender();
  };
  a.onplaying=()=>{ BGM.started=true; bgmRender(); };
  a.onpause=bgmRender;
  BGM.a=a; return a;
}
async function bgmPlay(){
  const a=bgmAudio(); if(BGM.missing) return;
  try{ a.volume=0; await a.play(); BGM.on=true; bgmApplyVol(); }catch(e){ /* ยังไม่มี gesture หรือโหลดไม่ได้ */ }
  bgmSave(); bgmRender();
}
function bgmStop(){ if(BGM.a) BGM.a.pause(); BGM.on=false; bgmSave(); bgmRender(); }
function bgmSave(){ try{ localStorage.setItem("bgm.on", BGM.on?"1":"0"); localStorage.setItem("bgm.vol", String(BGM.vol)); }catch(e){} }
function bgmRender(){
  const b=$("bgmBtn"); if(!b) return;
  const playing = !!(BGM.a && !BGM.a.paused) && BGM.vol>0;          // ดังอยู่จริง = 🔊 · หยุด/เงียบ = 🔇 (สัญลักษณ์เดียว ไม่ต้องตีความ)
  b.textContent = playing ? "🔊" : "🔇";
  b.classList.toggle("playing", playing);
  b.classList.toggle("nudge", !BGM.missing && BGM.on && !playing && !BGM.started);   // ยังไม่ได้แตะ → ชวนแตะ
  b.title = BGM.missing ? "ยังไม่มีไฟล์เพลง" : playing ? "แตะเพื่อปิดเพลง · กดค้างปรับความดัง" : "แตะเพื่อเปิดเพลง · กดค้างปรับความดัง";
  b.setAttribute("aria-pressed", String(playing));
  const f=$("bgmFab");
  if(f){ f.textContent=b.textContent; f.classList.toggle("playing", playing); f.classList.toggle("nudge", b.classList.contains("nudge")); f.title=b.title; f.setAttribute("aria-pressed", String(playing)); }
  const p=$("bgmPlay"), v=$("bgmVol"), meta=$("bgmMeta");
  if(p){ p.textContent = playing ? "🔊 เพลง: เปิด" : "🔇 เพลง: ปิด"; p.setAttribute("aria-pressed", String(playing)); }
  if(v) v.value = Math.round(BGM.vol*100);
  if(meta){ const t=BGM_TRACKS[BGM.mode]; meta.textContent = BGM.missing ? "ยังไม่มีไฟล์เพลง (bgm.mp3)" : `${t.icon} ${t.title()} · ${t.label} · ${C.BGM_CREDIT||""}`.replace(/ · $/,""); }
}
function bgmOpenPop(fromFab){
  const pop=$("bgmPop"); $("moreMenu").hidden=true; $("bellMenu").hidden=true;
  pop.classList.toggle("fromFab", !!fromFab); pop.hidden=false; bgmRender();
}
/* กติกาเดียวทั้งสองปุ่ม (เหมือนปุ่มเสียงในเกมมือถือ): แตะสั้น = เปิด/ปิดเพลง · กดค้าง = เมนูความดัง · เมนู ⋯ ก็เปิดเมนูนี้ได้ */
function bgmToggle(){
  if(BGM.missing) return toast("ยังไม่มีไฟล์เพลง");
  if(BGM.a && !BGM.a.paused){ bgmStop(); return; }
  if(BGM.vol===0){ BGM.vol=BGM._lastVol||(+C.BGM_VOLUME||.2); }     // เคยลากความดังลง 0 ไว้ → เปิดกลับมาให้ได้ยิน
  bgmPlay().then(()=>{
    let seen=false; try{ seen=!!localStorage.getItem("bgm.hint"); localStorage.setItem("bgm.hint","1"); }catch(e){}
    if(!seen) toast("🎵 เพลงเริ่มแล้ว · แตะลำโพงเพื่อปิด · กดค้างเพื่อปรับความดัง");
  });
}
$("bgmBtn").onclick=()=>{ if($("bgmBtn")._long){ $("bgmBtn")._long=false; return; } $("moreMenu").hidden=true; $("bellMenu").hidden=true; bgmToggle(); };
$("bgmFab").onclick=()=>{ if($("bgmFab")._long){ $("bgmFab")._long=false; return; } bgmToggle(); };
$("bgmPlay").onclick=bgmToggle;
$("bgmMenuBtn").onclick=()=>{ $("moreMenu").hidden=true; bgmOpenPop(false); };
/* กดค้าง 0.45 วิ ที่ลำโพงตัวไหนก็ได้ → เปิดเมนูความดัง (ปุ่มบน HUD แตะสั้นก็เปิดได้เมื่อเพลงเริ่มแล้ว) */
[["bgmBtn",false],["bgmFab",true]].forEach(([id,fromFab])=>{
  const el=$(id); let t=null;
  const start=e=>{ if(e.pointerType==="mouse" && e.button!==0) return; clearTimeout(t); t=setTimeout(()=>{ el._long=true; bgmOpenPop(fromFab); if(navigator.vibrate) navigator.vibrate(15); }, 450); };
  const end=()=>clearTimeout(t);
  el.addEventListener("pointerdown", start); el.addEventListener("pointerup", end); el.addEventListener("pointerleave", end); el.addEventListener("pointercancel", end);
  el.addEventListener("contextmenu", e=>e.preventDefault());       // กดค้างบนมือถือไม่ให้เด้งเมนูคัดลอก
});
if("IntersectionObserver" in window){
  const hud=document.querySelector(".hud");
  if(hud) new IntersectionObserver(es=>{ $("bgmFab").hidden = es[0].isIntersecting || BGM.missing || !$("scArena").classList.contains("on"); }).observe(hud);
}
$("bgmVol").oninput=e=>{ const v=(+e.target.value)/100; if(BGM.vol>0 && v===0) BGM._lastVol=BGM.vol; BGM.vol=v; bgmApplyVol(true); bgmSave(); bgmRender(); };
document.addEventListener("click", e=>{ if(!e.target.closest("#bgmPop,#bgmBtn,#bgmFab,#bgmMenuBtn")) $("bgmPop").hidden=true; });
/* แตะจอครั้งแรกที่ไหนก็ได้ → ถ้าเคยเปิดเพลงไว้ (หรือค่าเริ่มต้น) เริ่มเล่นให้เอง */
/* ใช้ pointerup ไม่ใช่ pointerdown: บนมือถือ (touch) เบราว์เซอร์นับว่า "ผู้ใช้แตะแล้ว" ตอนปล่อยนิ้ว ถ้าสั่ง play ตอนกดจะโดนปฏิเสธเงียบ ๆ */
document.addEventListener("pointerup", function firstTap(e){
  if(e.target.closest("#bgmBtn,#bgmFab,#bgmPop")) return;         // แตะที่ลำโพงเอง ให้ปุ่มจัดการ ไม่งั้นเริ่มแล้วโดนปิดทันที
  if(BGM.on && !BGM.started) bgmPlay();
  if(BGM.started||BGM.missing) document.removeEventListener("pointerup", firstTap);
}, {passive:true});
/* สลับแท็บ/พับจอ → หยุดชั่วคราว กลับมาแล้วเล่นต่อ ไม่กินแบตตอนไม่ได้ดู */
document.addEventListener("visibilitychange", ()=>{ if(!BGM.a) return; if(document.hidden){ BGM._wasPlaying=!BGM.a.paused; BGM.a.pause(); } else if(BGM._wasPlaying && BGM.on){ BGM.a.play().catch(()=>{}); } });
bgmRender();
function confetti(n=48){
  const box=document.createElement("div"); box.className="confetti";
  for(let i=0;i<n;i++){
    const p=document.createElement("i");
    p.style.left=(50+(Math.random()*40-20))+"%";
    p.style.background=COLORS[i%COLORS.length];
    p.style.setProperty("--dx",(Math.random()*420-210)+"px");
    p.style.setProperty("--dy",(-(220+Math.random()*320))+"px");
    p.style.setProperty("--r",(Math.random()*720)+"deg");
    p.style.animationDelay=(Math.random()*.15)+"s";
    box.appendChild(p);
  }
  document.body.appendChild(box); setTimeout(()=>box.remove(),1700);
}
function jumpMe(){
  const el=document.querySelector(".runner.me .body");
  if(el){ el.classList.add("jump"); setTimeout(()=>el.classList.remove("jump"),700); }
}
function celebrate(kind){
  if(kind==="submit"){ SFX.coin(); jumpMe(); floatPlus("+1"); }
  if(kind==="target"){ SFX.fanfare(); jumpMe(); floatPlus("🎯 ครบเป้า!"); confetti(); }
  if(kind==="unlock"){ SFX.unlock(); confetti(30); }
  if(kind==="revive"){ SFX.revive(); jumpMe(); confetti(70); }
}

/* ================= งานของฉัน — แก้แพลตฟอร์มเองได้ ================= */
function renderMyFeed(list){
  $("myFeedCount").textContent = list.length ? `ทั้งหมด ${list.length} ชิ้น` : "";
  $("myFeed").innerHTML = list.length ? list.map(f=>`<li>
      <select class="platFix" data-fix="${f.id}">${PLATS.map(p=>`<option ${p===f.plat?"selected":""}>${p}</option>`).join("")}</select>
      <select class="kindSel" data-kind="${f.id}" title="ประเภท">${kindOpts(f.kind)}</select>
      <span class="sp">วันที่ ${f.day}</span>
      <a href="${f.url}" target="_blank" rel="noopener">${f.url}</a>
      <button class="btn xs" data-editurl="${f.id}" title="แก้ลิงก์ เช่น โพสต์ผิดแอคเคาท์ แล้วลงใหม่">🔗 แก้ลิงก์</button>
      ${f.kudos?'<span class="kudo" title="TA ให้ 👍 งานดี">👍 งานดี</span>':""}${vacDay(f.day)?'<span class="vac" title="ส่งงานช่วงปิดเทอม">🏅 นักเรียนดีเด่น</span>':""}
      <span class="when">${ago(f.ts)}</span>
      ${Date.now()-f.ts<DEL_MS ? `<button class="btn xs danger" data-delsub="${f.id}" title="ลบได้ภายใน 30 นาทีหลังส่ง">ลบ (เหลือ ${Math.max(1,Math.ceil((DEL_MS-(Date.now()-f.ts))/60000))} นาที)</button>` : ""}
      <span class="note" style="display:flex;gap:6px;align-items:center;flex-wrap:wrap">
        <input class="statIn" type="number" min="0" inputmode="numeric" data-views="${f.id}" value="${f.views||""}" placeholder="👁 วิว">
        <input class="statIn" type="number" min="0" inputmode="numeric" data-likes="${f.id}" value="${f.likes||""}" placeholder="❤ ไลก์">
        <input class="noteIn" maxlength="140" data-note="${f.id}" value="${(f.note||"").replace(/"/g,"&quot;")}" placeholder="สรุป 1 บรรทัด / ได้เรียนรู้อะไร"></span></li>`).join("")
    : `<li style="color:var(--dim)">ยังไม่มีงานที่ส่ง</li>`;
}
$("myFeed").onclick=async e=>{
  const eb=e.target.closest("button[data-editurl]");
  if(eb){
    const id = isNaN(+eb.dataset.editurl) ? eb.dataset.editurl : +eb.dataset.editurl;
    const cur = (S.myDet && (S.myDet.recent||[]).find(x=>String(x.id)===String(id))) || {};
    const v = prompt("วางลิงก์ใหม่ของงานชิ้นนี้\n(วันที่ส่งและยอดสัปดาห์ไม่เปลี่ยน)", cur.url || "");
    if(v===null) return;
    const url=v.trim(); if(!url) return;
    eb.disabled=true;
    try{ await DB.fixUrl(id, url); toast("แก้ลิงก์แล้ว 🔗"); await refresh(); renderStatus(); }
    catch(err){ toast(err.message); eb.disabled=false; }
    return;
  }
  const b=e.target.closest("button[data-delsub]"); if(!b) return;
  if(!confirm("ลบงานชิ้นนี้? (ส่งใหม่ได้ทีหลัง)")) return;
  b.disabled=true;
  const id = isNaN(+b.dataset.delsub) ? b.dataset.delsub : +b.dataset.delsub;
  try{ await DB.deleteSub(id); toast("ลบแล้ว"); await refresh(); renderStatus(); }
  catch(err){ toast(err.message); b.disabled=false; }
};
/* แก้ชื่อตัวเองจากหน้า MY STATUS */
$("renameBtn").onclick=async()=>{
  const cur=meR(); if(!cur) return;
  const v=prompt("ชื่อใหม่บนสนาม (ไม่เกิน 10 ตัวอักษร ห้ามซ้ำกับคนอื่น)", cur.name);
  if(v===null) return;
  const name=v.trim().toUpperCase().slice(0,10);
  if(!name) return toast("ใส่ชื่อก่อน");
  if(name===cur.name) return;
  try{ await DB.rename(name); await refresh(); toast(`เปลี่ยนชื่อเป็น ${name} แล้ว`); }
  catch(err){ toast(err.message); }
};
$("myFeed").onchange=async e=>{
  const t=e.target;
  const key = t.dataset.views!=null ? "views" : t.dataset.likes!=null ? "likes" : t.dataset.kind!=null ? "kind" : t.dataset.note!=null ? "note" : null;
  if(key){
    const id = isNaN(+t.dataset[key]) ? t.dataset[key] : +t.dataset[key];
    t.disabled=true;
    try{ await DB.updateSub(id, {[key]: t.value}); toast(key==="views"||key==="likes" ? "บันทึกยอดแล้ว 👁" : "บันทึกแล้ว");
      /* อัปเดตในเครื่องพอ ไม่ refresh() ทั้งหน้า — ไม่งั้นรายการถูกวาดใหม่ทับช่องถัดไปที่กำลังพิมพ์อยู่ */
      const row=((S.myDet&&S.myDet.recent)||[]).find(x=>x.id===id); if(row) row[key]=t.value; }
    catch(err){ toast(err.message); }
    t.disabled=false; return;
  }
  const s=e.target.closest("select[data-fix]"); if(!s) return;
  const id = isNaN(+s.dataset.fix) ? s.dataset.fix : +s.dataset.fix;
  s.disabled=true;
  try{ await DB.fixPlatform(id, s.value); toast(`เปลี่ยนเป็น ${s.value} แล้ว`); await refresh(); }
  catch(err){ toast(err.message); }
  s.disabled=false;
};

/* ================= SOCIAL: เชียร์ · ดวล · บอส · สรุปสัปดาห์ · push ================= */
const CHEER_EMOJI = ["👏","🔥","💪","❤️"];
const meId = () => { const r=meR(); return r ? r.id : null; };

/* ---- เชียร์ ---- */
const cheersToday = id => (S.cheers||[]).filter(c=>c.to_id===id && c.day_index===S.today);
const cheeredByMeToday = id => (S.cheers||[]).some(c=>c.to_id===id && c.from_id===meId() && c.day_index===S.today);
function cheerHTML(r){
  if(!r || S.spectator || !meR() || r.id===meId()) return "";
  const got=cheersToday(r.id), done=cheeredByMeToday(r.id);
  const counts={}; got.forEach(c=>counts[c.emoji]=(counts[c.emoji]||0)+1);
  return `<div class="cheerBox">
    <span class="cheerCount">${got.length ? `วันนี้มีคนเชียร์ ${got.length} คน · ${Object.entries(counts).map(([e,n])=>e+n).join(" ")}` : "ยังไม่มีใครเชียร์วันนี้ — เป็นคนแรก!"}</span>
    <span class="cheerBtns">${CHEER_EMOJI.map(e=>`<button class="cheerBtn" data-cheer="${e}" data-to="${r.id}" ${done?"disabled":""}>${e}</button>`).join("")}</span>
    ${done ? `<small>เชียร์ไปแล้ววันนี้</small>` : `<small>ส่งได้วันละครั้งต่อคน</small>`}
  </div>`;
}
document.addEventListener("click", async e=>{
  const b=e.target.closest(".cheerBtn"); if(!b || b.disabled) return;
  b.disabled=true;
  try{ await DB.cheer(b.dataset.to, b.dataset.cheer); SFX.coin(); toast(`ส่ง ${b.dataset.cheer} ให้แล้ว`); await refresh();
    const r=S.runners.find(x=>x.id===b.dataset.to); if(r && $("modal").classList.contains("on")) $("mCheer").innerHTML=cheerHTML(r)+nudgeHTML(r)+duelBtnHTML(r); }
  catch(err){ toast(err.message); b.disabled=false; }
});
/* กำลังใจที่ฉันได้รับวันนี้ (โชว์ในการ์ดเป้า) */
function myCheersHTML(){
  const id=meId(); if(!id) return "";
  const got=cheersToday(id); if(!got.length) return "";
  const counts={}; got.forEach(c=>counts[c.emoji]=(counts[c.emoji]||0)+1);
  const names=[...new Set(got.map(c=>(S.runners.find(r=>r.id===c.from_id)||{}).name).filter(Boolean))];
  return `<div class="myCheer">🎉 วันนี้มีคนเชียร์คุณ <b>${got.length}</b> คน ${Object.entries(counts).map(([e,n])=>e+n).join(" ")}<br><span style="color:var(--dim)">${names.slice(0,8).join(", ")}${names.length>8?" …":""}</span></div>`;
}

/* ---- ดวล ---- */
const myDuel = () => { const id=meId(); if(!id) return null;
  return (S.duels||[]).find(d=>(d.challenger===id||d.opponent===id) && (d.status==="pending"||d.status==="active" || (d.status==="done" && d.winner===id && d.prize_hat==null))) || null; };
const duelOf = id => (S.duels||[]).find(d=>(d.challenger===id||d.opponent===id) && (d.status==="pending"||d.status==="active")) || null;
/* หมวกที่ผู้แพ้ต้องใส่ 7 วันหลังดวลจบ */
function duelHatOf(r){
  if(!r) return null;
  const d=(S.duels||[]).find(d=>d.status==="done" && d.prize_hat!=null && d.winner && (d.challenger===r.id||d.opponent===r.id) && S.today>d.end_day && S.today<=d.end_day+7);
  if(!d) return null;
  return d.winner===r.id ? WINNER_HAT : d.prize_hat;      // ผู้ชนะได้ป้าย WINNER ควบคู่กันไป 7 วันเท่ากัน
}
/* ---- 👉 สะกิดเพื่อนที่วันนี้ยังไม่ส่งงาน (คำขอจากนักเรียน · migration 047) — วันละครั้งต่อคน สูงสุด 5 คนต่อวัน เซิร์ฟเวอร์เป็นคนตัดสิน ---- */
const nudgedByMeToday = id => (S.nudges||[]).some(n=>n.to_id===id && n.from_id===meId() && n.day_index===S.today);
function nudgeHTML(r){
  if(!r || S.spectator || !meR() || r.id===meId() || isVacation() || finished()) return "";
  if((S.subs||[]).some(s=>s.who===r.name && s.day===S.today)) return "";            // รู้แน่ว่าส่งแล้ว → ไม่ต้องโชว์
  const done=nudgedByMeToday(r.id), got=(S.nudges||[]).filter(n=>n.to_id===r.id && n.day_index===S.today).length;
  return `<div class="duelBox nudgeBox"><button class="btn sm" data-nudge="${r.id}" ${done?"disabled":""}>👉 ${done?"สะกิดไปแล้ววันนี้":"สะกิดให้ส่งงาน"}</button>
    <small>${got?`วันนี้โดนสะกิดแล้ว ${got} คน · `:""}เขาจะเห็นในกระดิ่ง (และแจ้งเตือนถ้าเปิดไว้) · ใช้ได้เมื่อเขายังไม่ส่งงานวันนี้</small></div>`;
}
document.addEventListener("click", async e=>{
  const b=e.target.closest("button[data-nudge]"); if(!b || b.disabled) return;
  const r=S.runners.find(x=>x.id===b.dataset.nudge); if(!r) return;
  b.disabled=true;
  try{ await DB.nudge(r.id); SFX.coin(); toast(`👉 สะกิด ${r.name} แล้ว`); (S.nudges=S.nudges||[]).push({from_id:meId(), to_id:r.id, day_index:S.today});
    if($("modal").classList.contains("on")) $("mCheer").innerHTML=cheerHTML(r)+nudgeHTML(r)+duelBtnHTML(r); }
  catch(err){ toast(err.message); b.disabled=false; }
});
/* โดนสะกิด → toast ครั้งเดียวต่อคนต่อวัน (ถ้ายังไม่ส่งงาน) */
function nudgeWatch(){
  const id=meId(); if(!id || S.postedToday) return;
  const mine=(S.nudges||[]).filter(n=>n.to_id===id && n.day_index===S.today); if(!mine.length) return;
  let seen={}; try{ seen=JSON.parse(localStorage.getItem("opb.nudgeSeen")||"{}"); }catch(e){}
  const fresh=mine.filter(n=>!seen[S.today+":"+n.from_id]); if(!fresh.length) return;
  const names=fresh.map(n=>(S.runners.find(r=>r.id===n.from_id)||{}).name).filter(Boolean);
  fresh.forEach(n=>{ seen[S.today+":"+n.from_id]=1; });
  try{ const keep={}; Object.keys(seen).filter(k=>k.startsWith(S.today+":")).forEach(k=>keep[k]=1); localStorage.setItem("opb.nudgeSeen", JSON.stringify(keep)); }catch(e){}
  if(names.length) toast(`👉 ${names.slice(0,3).join(", ")}${names.length>3?` และอีก ${names.length-3} คน`:""} สะกิดคุณ<br>วันนี้ยังไม่ได้ส่งงานนะ 💪`);
}
function duelBtnHTML(r){
  if(!r || S.spectator || !meR() || r.id===meId()) return "";          // ทุกคนท้าได้ รวม TA และโค้ช (อีกฝ่ายต้องกดรับ)
  const d=duelOf(r.id), mine=myDuel();
  if(d) return `<div class="duelBox"><b>⚔️ กำลังดวลอยู่</b> ${d.challenger_name} vs ${d.opponent_name} · ${d.status==="pending"?"รอรับคำท้า":`${d.challenger_score}-${d.opponent_score} · เหลือ ${Math.max(0,d.end_day-S.today+1)} วัน`}</div>`;
  if(mine) return `<div class="duelBox" style="color:var(--dim)">⚔️ คุณมีดวลค้างอยู่ ต้องจบก่อนถึงท้าคนใหม่ได้</div>`;
  return `<div class="duelBox"><button class="btn sm" data-duel="${r.id}">⚔️ ท้าดวล 7 วัน</button>
    <small>ใครส่งมากกว่าใน 7 วันชนะ · ผู้แพ้ต้องใส่หมวกที่ผู้ชนะเลือกให้ 7 วัน</small></div>`;
}
document.addEventListener("click", async e=>{
  const b=e.target.closest("button[data-duel]"); if(!b) return;
  const r=S.runners.find(x=>x.id===b.dataset.duel); if(!r) return;
  if(!confirm(`ท้าดวล ${r.name} 7 วัน?\nใครส่งมากกว่าชนะ ผู้แพ้ต้องใส่หมวกที่ผู้ชนะเลือกให้ 7 วัน`)) return;
  b.disabled=true;
  try{ await DB.duelCreate(r.id); SFX.fanfare(); toast(`ส่งคำท้าให้ ${r.name} แล้ว ⚔️<br>รอเขากดรับ`); await refresh(); $("modal").classList.remove("on"); }
  catch(err){ toast(err.message); b.disabled=false; }
});
function duelBannerHTML(){
  const d=myDuel(), id=meId(); if(!d) return "";
  const meIsCh=d.challenger===id, other=meIsCh?d.opponent_name:d.challenger_name;
  if(d.status==="pending"){
    return meIsCh ? `<div class="duelBar">⚔️ รอ <b>${other}</b> รับคำท้า…</div>`
      : `<div class="duelBar">⚔️ <b>${other}</b> ท้าดวลคุณ 7 วัน! ใครส่งมากกว่าชนะ ผู้แพ้ใส่หมวกที่ผู้ชนะเลือก
         <button class="btn sm" data-duelact="active" data-id="${d.id}">รับคำท้า</button> <button class="btn sm" data-duelact="declined" data-id="${d.id}">ไม่เอา</button></div>`;
  }
  if(d.status==="active"){
    const my=meIsCh?d.challenger_score:d.opponent_score, th=meIsCh?d.opponent_score:d.challenger_score;
    const left=d.end_day-S.today+1;
    if(left<=0) return `<div class="duelBar">⚔️ ดวลกับ <b>${other}</b> จบแล้ว ${my}-${th} <button class="btn sm" data-duelact="done" data-id="${d.id}">สรุปผล</button></div>`;
    return `<div class="duelBar">⚔️ ดวลกับ <b>${other}</b> · คุณ <b style="color:${my>=th?"var(--green)":"var(--orange)"}">${my}</b> : ${th} · เหลือ ${left} วัน ${my>th?"— นำอยู่ 🔥":my<th?"— ตามอยู่ เร่งหน่อย!":"— เสมอ"}</div>`;
  }
  if(d.status==="done" && d.winner===id && d.prize_hat==null){
    const hats=PRIZE_PICK.map(i=>({n:AV.hat[i],i}));
    return `<div class="duelBar">🏆 คุณชนะดวลกับ <b>${other}</b>! เลือกหมวกปั่น ๆ ให้เขาใส่ 7 วัน (คุณได้ป้าย WINNER):
      <select id="prizeHat">${hats.map(h=>`<option value="${h.i}">${h.n}</option>`).join("")}</select>
      <button class="btn sm" data-duelact="prize" data-id="${d.id}">ยืนยัน</button></div>`;
  }
  return "";
}
document.addEventListener("click", async e=>{
  const b=e.target.closest("button[data-duelact]"); if(!b) return;
  b.disabled=true;
  try{
    const act=b.dataset.duelact, id=+b.dataset.id;
    if(act==="prize") await DB.duelUpdate(id,{prize_hat:+$("prizeHat").value});
    else await DB.duelUpdate(id,{status:act});
    if(act==="active"){ SFX.fanfare(); toast("รับคำท้าแล้ว ⚔️ เริ่มนับตั้งแต่วันนี้ 7 วัน"); }
    if(act==="done"){ SFX.fanfare(); }
    await refresh();
    if(act==="done"){ const d=(S.duels||[]).find(x=>x.id===id); if(d){ const me=meId(); toast(d.winner===me?"🏆 คุณชนะ! เลือกหมวกให้ผู้แพ้ได้เลย":d.winner?"แพ้แล้ว 😵 ต้องใส่หมวกที่เขาเลือก 7 วัน":"เสมอ ไม่มีใครต้องใส่หมวก"); } }
    if(act==="prize"){ toast("ส่งหมวกให้ผู้แพ้แล้ว 😈"); }
    if(act==="declined"){ toast("ปฏิเสธคำท้าแล้ว"); }
    closeModal($("duelModal"));
  }catch(err){ toast(err.message); b.disabled=false; }
});

/* ---- ห้องดวล: ใครกำลังสู้กันอยู่ ซ้าย = คนท้า ขวา = คนถูกท้า ---- */
function renderDuelRoom(){
  const all=(S.duels||[]).filter(d=>d.status==="active"||d.status==="pending"||(d.status==="done"&&d.end_day!=null&&S.today<=d.end_day+7));
  const ord={active:0,pending:1,done:2};
  all.sort((a,b)=>(ord[a.status]-ord[b.status])||((a.end_day||9999)-(b.end_day||9999))||(b.id-a.id));
  const nAct=all.filter(d=>d.status==="active").length;
  $("duelSub").textContent = nAct ? `กำลังดวล ${nAct} คู่ · 7 วัน ใครส่งมากกว่าชนะ · ผู้แพ้ใส่หมวกที่ผู้ชนะเลือก` : "7 วัน ใครส่งมากกว่าชนะ · ผู้แพ้ใส่หมวกที่ผู้ชนะเลือก · ท้าได้จากโปรไฟล์ของคนที่อยากดวล";
  if(!all.length){ $("duelRoom").innerHTML=`<div class="duelEmpty">ยังไม่มีใครดวลกัน · เปิดโปรไฟล์ใครก็ได้แล้วกด ⚔️ ท้าดวล 7 วัน</div>`; return; }
  const me=meId();
  const fighter=(id,name,score,side,cls,fighting)=>{
    const r=S.runners.find(x=>x.id===id); const h=r?houseOf(r.house):null;
    return `<div class="dfighter ${side} ${cls}" data-n="${r?r.name:""}">
      <div class="spr">${r?sprite(avOf(r),3,"normal"):""}</div>
      <div><div class="nm" style="color:${r?nameColor(r):"#fff"}">${fighting?`<em class="duelTag">⚔️ FIGHTING</em> `:""}${name||"?"}<small>${r?(roleOf(r)==="head"?"🎓 หัวหน้าโค้ช":`${h.emoji} ${h.name}`):""}</small></div>
      <div class="sc">${score}</div></div></div>`;
  };
  $("duelRoom").innerHTML=all.map(d=>{
    const cs=+d.challenger_score||0, os=+d.opponent_score||0, tot=cs+os;
    const left = d.status==="active" ? Math.max(0,d.end_day-S.today+1) : 0;
    const mine = d.challenger===me||d.opponent===me;
    let cCls="", oCls="", mid="", state="";
    if(d.status==="pending"){ mid=`<b>VS</b>รอรับคำท้า`; state=`⏳ <b>${d.opponent_name}</b> ยังไม่ได้กดรับคำท้าจาก ${d.challenger_name}`; }
    else if(d.status==="active"){
      cCls=cs>os?"win":cs<os?"lose":""; oCls=os>cs?"win":os<cs?"lose":"";
      mid=`<b>VS</b>${left>0?`🔥 เหลือ ${left} วัน`:"หมดเวลา รอสรุปผล"}`;
      state= cs===os ? "เสมอกันอยู่ · ใครส่งก่อนนำ 🔥" : `<b>${cs>os?d.challenger_name:d.opponent_name}</b> นำอยู่ ${Math.abs(cs-os)} ชิ้น 🔥`;
    } else {
      cCls=d.winner===d.challenger?"win":d.winner?"lose":""; oCls=d.winner===d.opponent?"win":d.winner?"lose":"";
      mid=`<b>${cs}-${os}</b>จบแล้ว`;
      state= d.winner ? `🏆 <b>${d.winner===d.challenger?d.challenger_name:d.opponent_name}</b> ชนะ${d.prize_hat!=null?` · ผู้แพ้ใส่ "${AV.hat[d.prize_hat]}" 7 วัน`:" · รอเลือกหมวกให้ผู้แพ้"}` : "เสมอ ไม่มีใครต้องใส่หมวก";
    }
    const pct = tot ? Math.round(cs/tot*100) : 50;
    return `<div class="duelRow ${mine?"me":""} ${d.status==="pending"?"pend":""} ${d.status==="active"?"hot":""}">
      ${fighter(d.challenger,d.challenger_name,d.status==="pending"?"–":cs,"l",cCls,d.status==="active")}
      <div class="dmid">${mid}</div>
      ${fighter(d.opponent,d.opponent_name,d.status==="pending"?"–":os,"r",oCls,d.status==="active")}
      <div class="dbar"><i style="width:${pct}%"></i><em></em></div>
      <div class="dstate">${state}</div>
    </div>`;
  }).join("");
}
$("duelRoom").onclick=e=>{ const t=e.target.closest(".dfighter"); if(t&&t.dataset.n) openProfile(t.dataset.n); };

/* ---- แจ้งเตือนดวล: ป๊อปอัพเมื่อถูกท้า · toast เมื่ออีกฝ่ายรับ/ปฏิเสธ/เลือกหมวก
   จำสถานะที่เห็นแล้วไว้ในเครื่อง จะได้เตือนแค่ครั้งเดียวต่อเหตุการณ์ แม้ปิดแท็บไปแล้วค่อยกลับมา ---- */
const DUEL_SEEN="opb.duelSeen";
function duelWatch(){
  const id=meId(); if(!id||S.spectator||!(S.duels||[]).length) return;
  let seen=null; try{ seen=JSON.parse(localStorage.getItem(DUEL_SEEN)||"null"); }catch(e){}
  const fresh=!seen; seen=seen||{};
  const next={};
  S.duels.forEach(d=>{
    if(d.challenger!==id && d.opponent!==id) return;
    const key=`${d.id}:${d.status}:${d.prize_hat==null?"":"h"}`;
    next[key]=1;
    if(d.status==="pending" && d.opponent===id){ if(!openDuelPop._dis.has(d.id) && openDuelPop(d)!==false) openDuelPop._dis.add(d.id); return; }   // เด้งครั้งเดียวต่อการเปิดหน้า (นับเฉพาะที่เด้งจริง) ที่เหลือมีแถบในการ์ดเป้าให้กด
    if(seen[key] || fresh) return;
    const other = d.challenger===id ? d.opponent_name : d.challenger_name;
    if(d.challenger===id && d.status==="declined"){ toast(`😔 <b>${other}</b> ปฏิเสธคำท้าดวล<br>ท้าคนอื่นได้เลย`); }
    else if(d.status==="expired"){ toast(`⌛ คำท้าดวลกับ <b>${other}</b> หมดอายุ (ไม่มีการตอบรับใน 7 วัน)<br>ท้าคนอื่นได้เลย`); }
    else if(d.challenger===id && d.status==="active"){ SFX.fanfare(); toast(`⚔️ <b>${other}</b> รับคำท้าแล้ว!<br>นับตั้งแต่วันนี้ 7 วัน ใครส่งมากกว่าชนะ`); }
    else if(d.status==="done" && d.winner && d.winner!==id && d.prize_hat!=null){ toast(`😈 แพ้ดวล <b>${other}</b><br>ต้องใส่ "${AV.hat[d.prize_hat]}" 7 วัน`); }
  });
  try{ localStorage.setItem(DUEL_SEEN, JSON.stringify(next)); }catch(e){}
}
function openDuelPop(d){
  if(openDuelPop._dis.has(d.id) || $("duelModal").classList.contains("on")) return false;   // false = ไม่ได้เด้ง (คนเรียกจะได้ไม่นับว่าเห็นแล้ว)
  const ch=S.runners.find(x=>x.id===d.challenger), me=meR();
  const box=(r,nm)=>`<div>${r?sprite(avOf(r),5,"normal"):""}<div class="nm" style="color:${r?nameColor(r):"#fff"}">${nm}</div></div>`;
  $("duelPopBody").innerHTML=`<div class="duelPop">
    <div class="vs">${box(ch,d.challenger_name)}<b>VS</b>${box(me,me?me.name:"คุณ")}</div>
    <p><b style="color:var(--gold)">${d.challenger_name}</b> ท้าดวลคุณ 7 วัน!<br>ใครส่งงานมากกว่าใน 7 วันชนะ · ผู้แพ้ต้องใส่หมวกที่ผู้ชนะเลือกให้ 7 วัน</p>
    <div class="btns"><button class="btn gold" data-duelact="active" data-id="${d.id}">⚔️ รับคำท้า</button><button class="btn sm" data-duelact="declined" data-id="${d.id}">ไม่เอา</button></div>
  </div>`;
  $("duelModal").dataset.id=d.id; $("duelModal").classList.add("on"); SFX.unlock();
}
openDuelPop._dis=new Set();
$("duelPopClose").onclick=()=>{ openDuelPop._dis.add(+$("duelModal").dataset.id); closeModal($("duelModal")); };

/* ---- บอสประจำสัปดาห์ (หัวหน้าโค้ชตั้ง) ---- */
/* 🏅 บอร์ดนักเรียนดีเด่น — ใครส่งงานช่วงปิดเทอมบ้าง */
function starBoardHTML(){
  const rows=S.runners.filter(r=>roleOf(r)==="student" && starN(r)>0).sort((a,b)=>starN(b)-starN(a) || stats(b).contents-stats(a).contents);
  const me=meR(), mine=me?starN(me):0;
  const list = rows.length ? rows.slice(0,10).map((r,i)=>`<li class="${r.name===S.me?"me":""}"><span class="rk">${i<3?["🥇","🥈","🥉"][i]:i+1}</span><span class="nm" style="color:${r.color}">${houseOf(r.house).emoji} ${r.name}</span><span class="n">${starN(r)} ชิ้น</span></li>`).join("")
    : `<li class="none">ยังไม่มีใครส่งเลย · คนแรกได้เหรียญ 🏅 ติดตัวบนสนามทั้งรุ่น</li>`;
  return `<div class="starBoard"><div class="sbHead"><b>🏅 บอร์ดนักเรียนดีเด่น</b><span>ส่งงานช่วงปิดเทอม · ${rows.length} คน</span></div>
    <ul>${list}</ul>${mine?`<div class="sbMe">คุณส่งไป ${mine} ชิ้นแล้ว 🏅 เหรียญติดตัวบนสนามและในสกอร์บอร์ด</div>`:isVacation()?`<div class="sbMe dim">ส่งชิ้นเดียวก็ได้เหรียญ 🏅 และป้าย STAR STUDENT</div>`:""}</div>`;
}
function bossHTML(){
  const me=meR(), cw=curWeek();
  const list=(S.bosses||[]).filter(b=>b.week_no===cw && (b.house_id==null || (me && b.house_id===me.house) || S.spectator));
  if(!list.length) return "";
  return list.map(b=>{
    const left=Math.max(0,b.hp-b.damage), pct=Math.min(100, b.damage/b.hp*100), dead=b.damage>=b.hp, hurt=!dead && left<=b.hp*0.3;
    const h=b.house_id?houseOf(b.house_id):null, state=dead?"dead":hurt?"hurt":"idle";
    /* ดาเมจใหม่ตั้งแต่เปิดครั้งก่อน → ตัวเลขเด้ง + บอสสะเทือน */
    const key="bossDmg."+b.id; let prev=null; try{ prev=localStorage.getItem(key); localStorage.setItem(key,String(b.damage)); }catch(e){}
    const delta=prev==null?0:b.damage-(+prev);
    return `<div class="bossBar ${state} ${delta>0?"hit":""}">
      <div class="bossStage">
        <div class="bossFig">${bossSprite(b.skin, 4, state)}<span class="bossShadow"></span>${delta>0?`<b class="dmgPop">-${delta}</b>`:""}</div>
        <div class="bossInfo">
          <div class="bossTag">${dead?"★ DEFEATED ★":hurt?"⚠ BOSS ใกล้ตาย!":"WEEKLY BOSS"} · WEEK ${b.week_no}</div>
          <div class="bossName">${b.name}<span class="bossWho">${h?h.emoji+" "+h.name:"🌏 ทั้งรุ่นช่วยกัน"}</span></div>
          <div class="bossHp"><i style="width:${pct}%"></i><span>${dead?"💥 ล้มแล้ว!":`HP ${left} / ${b.hp}`}</span></div>
          <div class="bossSub">${dead ? `ล้มบอสสำเร็จ · ทุกคนที่ส่งงานสัปดาห์นี้ได้ป้าย BOSS SLAYER${b.reward?" · 🎁 "+b.reward:""}`
            : `ทุกชิ้นที่ส่ง = 1 ดาเมจ · โดนไปแล้ว <b>${b.damage}</b> จาก ${b.fighters} คน${hurt?" · อีก <b>"+left+"</b> ชิ้นล้ม!":""}${b.reward?" · 🎁 "+b.reward:""}`}</div>
        </div>
      </div>
    </div>`;
  }).join("");
}

/* ---- สรุปจบสัปดาห์ ---- */
async function maybeShowRecap(){
  const me=meR(); if(!me || S.spectator) return false;
  const cw=curWeek(); if(cw<2) return false;
  const key="recapSeen."+me.id; let seen=0; try{ seen=+localStorage.getItem(key)||0; }catch(e){}
  if(seen>=cw) return false;
  let det; try{ det=await DB.detail(me); }catch(e){ return false; }
  const pw=cw-1, w=(det.weeks||[]).find(x=>x.week_no===pw);
  const king=(S.kings||[]).find(k=>k.week_no===pw && k.house_id===me.house);
  const kingMe=king && king.profile_id===me.id;
  const badges=earnedBadges(me,det);
  let prevKeys=[], firstTime=true; try{ const raw=localStorage.getItem("badges."+me.id); firstTime=raw==null; prevKeys=JSON.parse(raw||"[]"); }catch(e){}
  const newBadges=badges.filter(b=>!prevKeys.includes(b.k));
  try{ localStorage.setItem("badges."+me.id, JSON.stringify(badges.map(b=>b.k))); localStorage.setItem(key, String(cw)); }catch(e){}
  const h=houseOf(me.house), st=stats(me);
  const done=w?w.done:0, target=w?w.target:0, hit=w?w.hit:false;
  $("recapBody").innerHTML=`
    <div class="recapHero">${runnerBox(avOf(me),5,st.style)}</div>
    <div class="recapGrid">
      <div class="statBox"><b>${done}${target?"/"+target:""}</b><span>สัปดาห์ที่ ${pw}</span></div>
      <div class="statBox"><b>${target ? (hit?"✅":"❌") : "—"}</b><span>${target ? (hit?"ครบเป้า":"ไม่ถึงเป้า") : "ไม่ได้รับเป้า"}</span></div>
      <div class="statBox"><b>${st.contents}</b><span>รวมทั้งหมด</span></div>
      <div class="statBox"><b>${rankOf(me.name)||"—"}</b><span>อันดับตอนนี้</span></div>
    </div>
    <div class="recapLine">${!me.house ? `🎓 หัวหน้าโค้ช · ดูแลทั้งรุ่น` : kingMe ? `👑 <b>คุณคือ King of the Week ของบ้าน ${h.name}!</b> มงกุฎราชาเป็นของคุณ`
      : king ? `👑 King of the Week บ้าน ${h.name}: <b>${king.name}</b> (${king.done} ชิ้น)` : `สัปดาห์ที่แล้วยังไม่มี King ในบ้าน ${h.name}`}</div>
    ${newBadges.length ? `<div class="recapLine">🏅 ${firstTime?"ป้ายที่มี":"ป้ายใหม่"}: ${newBadges.map(b=>b.e+" "+b.n).join(" · ")}</div>` : ""}
    <div class="recapLine" style="color:var(--dim)">${st.burnout ? "💀 สัปดาห์นี้เป็นร่างกระโหลก — ทำครบสัปดาห์นี้แล้วฟื้น" : st.weak ? "😵 สัปดาห์นี้ร่างหมดแรง — ทำครบสัปดาห์นี้แล้วกลับมาปกติ" : hit ? "รักษาจังหวะนี้ไว้ 🔥" : "สัปดาห์ใหม่ เริ่มใหม่ได้เสมอ"}</div>`;
  $("recapTitle").textContent=`สรุปสัปดาห์ที่ ${pw} · ${me.name}`;
  $("recapModal").classList.add("on");
  drawRecapCard(me, st, pw, done, target, hit, king, kingMe, newBadges);
  return true;
}
function drawRecapCard(me, st, pw, done, target, hit, king, kingMe, newBadges){
  const cv=$("recapCanvas"), ctx=cv.getContext("2d"), W=cv.width, H=cv.height, h=houseOf(me.house);
  ctx.imageSmoothingEnabled=false;
  const bg=ctx.createLinearGradient(0,0,0,H); bg.addColorStop(0,"#150f3a"); bg.addColorStop(.5,"#2d1f6b"); bg.addColorStop(1,"#0a0820");
  ctx.fillStyle=bg; ctx.fillRect(0,0,W,H);
  ctx.textAlign="center";
  ctx.font="700 40px 'PxSeven','Pixelify Sans', monospace"; ctx.fillStyle="#cdc7ff"; ctx.fillText(C.TITLE, W/2, 90);
  ctx.font="700 56px 'PxSeven','Pixelify Sans', monospace"; ctx.fillStyle="#ffcc4d"; ctx.fillText(`WEEK ${pw} RECAP`, W/2, 160);
  drawSpriteCanvas(ctx, (W-16*18)/2, 200, 18, avOf(me), st.style);
  ctx.font="700 80px 'PxSeven','Pixelify Sans', monospace"; ctx.fillStyle="#fff"; ctx.fillText(me.name, W/2, 760);
  ctx.font="500 30px 'IBM Plex Sans Thai', sans-serif"; ctx.fillStyle=me.house?h.color:"#ffcc4d"; ctx.fillText(me.house?`${h.emoji} ${h.name}`:"🎓 หัวหน้าโค้ช", W/2, 810);
  ctx.font="700 150px 'PxSeven','Pixelify Sans', monospace"; ctx.fillStyle=hit?"#5ef08c":"#ffcc4d"; ctx.fillText(`${done}${target?"/"+target:""}`, W/2, 980);
  ctx.font="500 32px 'IBM Plex Sans Thai', sans-serif"; ctx.fillStyle="#e6e1ff";
  ctx.fillText(target ? (hit?"ครบเป้าสัปดาห์นี้ ✅":"ยังไม่ถึงเป้า — สัปดาห์หน้าเอาใหม่") : "ปล่อยไป "+done+" ชิ้นในสัปดาห์นี้", W/2, 1040);
  ctx.fillStyle="#cdc7ff"; ctx.font="500 28px 'IBM Plex Sans Thai', sans-serif";
  ctx.fillText(`รวมทั้งหมด ${st.contents} ชิ้น · อันดับ ${rankOf(me.name)||"-"} ของรุ่น`, W/2, 1100);
  if(kingMe){ ctx.fillStyle="#ffcc4d"; ctx.font="700 36px 'PxSeven','Pixelify Sans', monospace"; ctx.fillText("👑 KING OF THE WEEK · "+h.name, W/2, 1170); }
  else if(king){ ctx.fillStyle="#a49ce0"; ctx.fillText(`👑 King ของบ้าน: ${king.name}`, W/2, 1170); }
  if(newBadges.length){ ctx.font="40px sans-serif"; ctx.fillStyle="#fff"; ctx.fillText(newBadges.map(b=>b.e).join("  "), W/2, 1240); }
  ctx.textAlign="left"; ctx.font="600 22px 'IBM Plex Sans Thai', sans-serif"; ctx.fillStyle="#9a92d8"; ctx.fillText(TAG, 40, H-16);
  drawCredit(ctx, W, H-16); ctx.textAlign="center";
}
$("recapSave").onclick=()=>{
  $("recapCanvas").toBlob(b=>{ const a=document.createElement("a"); a.href=URL.createObjectURL(b); a.download=`${meR().name}-week${curWeek()-1}.png`; document.body.appendChild(a); a.click(); a.remove(); toast("เซฟรูปแล้ว 💾"); },"image/png");
};
$("recapClose").onclick=()=>closeModal($("recapModal"));
/* ปิดสรุปสัปดาห์ด้วยวิธีไหนก็ตาม (ปุ่ม/แตะข้างนอก/Esc/Back) → ค่อยเปิดเลือกเป้าต่อ */
new MutationObserver(()=>{ const m=$("recapModal");
  if(m.classList.contains("on")){ m._shown=true; return; }
  if(m._shown){ m._shown=false; const me=meR(); if(me && !noPledgeWeek() && !inOvertime() && !finished() && !(me.pledges||{})[curWeek()]) setTimeout(openPledge,300); }
}).observe($("recapModal"),{attributes:true, attributeFilter:["class"]});

/* ---- Web Push ---- */
async function pushState(){
  if(!("serviceWorker" in navigator) || !("PushManager" in window)) return "unsupported";
  if(Notification.permission==="denied") return "denied";
  try{ const reg=await navigator.serviceWorker.getRegistration(); const sub=reg && await reg.pushManager.getSubscription(); return sub ? "on" : "off"; }catch(e){ return "off"; }
}
function b64ToU8(b64){ const s=(b64+"=".repeat((4-b64.length%4)%4)).replace(/-/g,"+").replace(/_/g,"/"); const raw=atob(s); return Uint8Array.from([...raw].map(c=>c.charCodeAt(0))); }
async function enablePush(){
  if(!C.VAPID_PUBLIC) return toast("ยังไม่ได้ตั้งค่า push บนเซิร์ฟเวอร์");
  try{
    const reg=await navigator.serviceWorker.register("/sw.js");
    const perm=await Notification.requestPermission();
    if(perm!=="granted") return toast("ไม่ได้อนุญาตการแจ้งเตือน");
    const sub=await reg.pushManager.subscribe({userVisibleOnly:true, applicationServerKey:b64ToU8(C.VAPID_PUBLIC)});
    const j=sub.toJSON();
    await DB.savePush({endpoint:j.endpoint, p256dh:j.keys.p256dh, auth:j.keys.auth});
    toast("เปิดเตือนแล้ว 🔔<br>จะเตือนตอน 2 ทุ่มถ้ายังไม่ได้ส่งงาน");
    renderPushBtn();
  }catch(e){ toast("เปิดไม่สำเร็จ: "+e.message); }
}
async function disablePush(){
  try{ const reg=await navigator.serviceWorker.getRegistration(); const sub=reg && await reg.pushManager.getSubscription();
    if(sub){ await DB.removePush(sub.endpoint); await sub.unsubscribe(); } toast("ปิดเตือนแล้ว"); renderPushBtn(); }catch(e){ toast(e.message); }
}
async function renderPushBtn(){
  const b=$("pushBtn2"); if(!b) return;
  const st=await pushState();
  b.hidden = (st==="unsupported" || S.spectator || DB.mode==="demo");     // ปุ่มมี attribute hidden มาแต่แรก ต้องถอดตรงนี้ ไม่ใช่แค่ style.display
  b.textContent = st==="on" ? "🔔 เตือนอยู่ (กดเพื่อปิด)" : st==="denied" ? "🔕 ถูกบล็อกในเบราว์เซอร์" : "🔔 เปิดเตือนก่อนปิดรอบ";
  b.onclick = st==="on" ? disablePush : enablePush;
}


/* ================= BOOT ================= */
/* ป้าย burnout / weak — มาจาก v_burnout กับ v_weak ซึ่งอยู่ในชุดที่โหลดตามมาทีหลัง */
function markStyles(burnIds, weakIds){
  const burnt=new Set(burnIds||[]), weak=new Set(weakIds||[]);
  S.runners.forEach(r=>{
    delete r.burnout; delete r.weak; delete r.st.burnout; delete r.st.weak;
    if(r.st.style==="burnout"||r.st.style==="weak") r.st.style = r.st.weekTarget ? optOf(r.st.weekTarget).style : "normal";
    if(burnt.has(r.id)){ r.burnout=true; r.st.burnout=true; r.st.style="burnout"; }
    else if(weak.has(r.id)){ r.weak=true; r.st.weak=true; r.st.style="weak"; }
  });
}
/* King ของสัปดาห์นี้ (สด): นักเรียนที่ทำชิ้นสัปดาห์นี้มากสุดของแต่ละบ้าน (ต้องมีอย่างน้อย 1 ชิ้น) */
function computeKingsNow(){
  S.kingsNow = new Set();
  HOUSES.forEach(h=>{
    const best = S.runners.filter(r=>roleOf(r)==="student" && r.house===h.id && stats(r).weekDone>0)
      .sort((a,b)=>stats(b).weekDone-stats(a).weekDone || stats(b).contents-stats(a).contents)[0];
    if(best) S.kingsNow.add(best.id);
  });
  /* King of TA (สด): TA ที่ทำชิ้นสัปดาห์นี้มากสุดทั้งรุ่น — TA ไม่ไปแย่งมงกุฎของนักเรียน */
  const bestTa = S.runners.filter(r=>roleOf(r)==="ta" && stats(r).weekDone>0)
    .sort((a,b)=>stats(b).weekDone-stats(a).weekDone || stats(b).contents-stats(a).contents)[0];
  if(bestTa) S.kingsNow.add(bestTa.id);
}
/* เติมของประดับสนามที่ตามมาทีหลัง แล้ววาดใหม่อีกรอบ */
function applyExtras(e){
  if(!e) return;
  /* โหมดทดลองคิด burnout/weak เองใน computeStats ไม่มีสองก้อนนี้มา จึงต้องไม่ไปล้างของเขา */
  if(Array.isArray(e.burnIds) || Array.isArray(e.weakIds)) markStyles(e.burnIds, e.weakIds);
  S.cups=e.cups||[];
  S.kings=e.kings||[];                        // ประวัติ King of the Week (สัปดาห์ที่จบแล้ว) จากเซิร์ฟเวอร์
  S.cheers=e.cheers||[]; S.cheerWeeks=e.cheerWeeks||[]; S.duels=e.duels||[];
  S.nudges=e.nudges||[];
  S.cheerStats=null; if(Array.isArray(e.cheerStats) && e.cheerStats.length){ S.cheerStats={}; e.cheerStats.forEach(x=>{ S.cheerStats[x.profile_id]=x; }); }
  S.bosses=e.bosses||[]; S.bossKills=e.bossKills||[];
  S.reach={};   (e.reach||[]).forEach(r=>{ S.reach[r.profile_id]=r; });
  S.kudos={};   (e.kudos||[]).forEach(k=>{ S.kudos[k.profile_id]=+k.n; });
  S.holiday={}; (e.holiday||[]).forEach(k=>{ S.holiday[k.profile_id]=+k.n; });
  S.sessions=e.sessions||[]; S.myCheckins=new Set(e.myCheckins||[]);
  computeKingsNow();
  renderAll();
  duelWatch();
}

/* โหลดใหม่ทั้งสนาม — กันโหลดซ้อน เพราะ realtime สั่งมารัว ๆ ตอนไลฟ์
   ถ้ามีคำสั่งเข้ามาระหว่างกำลังโหลด จะจำไว้แล้วโหลดอีกรอบเดียวตอนจบ */
async function refresh(){
  if(refresh._busy){ refresh._again=true; return; }
  refresh._busy=true;
  try{
    const d=await DB.fetchAll(applyExtras);        // ของประดับตามมาทีหลัง วาดซ้ำเองตอนถึง
    S.today=d.today; S.me=S.spectator?null:d.me; S.runners=d.runners; S.subs=d.subs; S.postedToday=!!d.postedToday;
    S.todayCount=d.todayCount||0; S.todaySubs=d.todaySubs||[];
    S.started = d.started !== false; S.daysUntil = d.daysUntil||0; S.startDate = d.startDate||null;
    if(DB.mode==="demo"){ S.runners.forEach(r=>{ r.st=computeStats(r); }); applyExtras(d); }  // โหมดทดลองคำนวณในเครื่อง ได้ครบมาพร้อมกันอยู่แล้ว
    computeKingsNow();
    S.lastPass=trackOvertakes();
    renderAll();
  } finally {
    refresh._busy=false;
    if(refresh._again){ refresh._again=false; setTimeout(()=>refresh().catch(e=>console.warn("โหลดรอบตามไม่ผ่าน", e)), 300); }
  }
}
/* โหมดคนดู — ไม่ต้องล็อกอิน เห็นสนามแบบเรียลไทม์ แต่ส่งงานไม่ได้ (ฐานข้อมูลกันอยู่แล้ว)
   เปิดลิงก์ #watch ไปฉายบนจอในห้องเรียนได้เลย */
async function enterSpectator(){
  S.spectator=true; S.raceFilter="all"; S.boardFilter="all";
  try{ await refresh(); }
  catch(e){
    S.spectator=false;
    /* ถ้ายังอยู่บนหน้าโหลด (ลิงก์ #watch) ต้องโชว์ปุ่มลองใหม่ ไม่งั้นค้างที่ "กำลังโหลดสนาม…" ตลอด เพราะ toast อยู่ใต้ loader */
    if(!$("loader").hidden) loaderFail(e.message, ()=>{ location.reload(); });
    else toast("โหลดสนามไม่ได้: "+e.message);
    return;
  }
  if(!S._subbed){ DB.subscribe(()=>refresh()); S._subbed=true; }
  show("scArena"); showPage("pgRace");
  if(!S._pulse){ trackVisit("watch"); startPulse("watch"); }
}
/* กลับหน้าแรก (PRESS START) — ใช้ได้ทั้งคนดูและคนที่ล็อกอิน */
window.goHome=()=>{
  document.querySelectorAll(".modal.on").forEach(m=>m.classList.remove("on"));
  $("moreMenu").hidden=true; $("bellMenu").hidden=true;
  if(S.spectator){ S.spectator=false; history.replaceState(null,"",location.pathname+location.search); }
  show("scTitle"); window.scrollTo(0,0);
};
$("homeBtn").onclick=goHome; $("homeBtn2").onclick=goHome;
document.querySelector(".brand").onclick=goHome;
window.leaveSpectator=()=>{
  /* ถอด #watch แล้วโหลดใหม่ — ถ้าล็อกอินอยู่จะเข้าสนามปกติ ถ้ายังไม่ล็อกอินจะเจอหน้าแรก */
  history.replaceState(null,"",location.pathname+location.search);
  location.reload();
};
$("watchBtn").onclick=enterSpectator;
/* ---- engagement: บันทึกการเข้าใช้ (เปิดแอป 1 ครั้ง + pulse ทุก 5 นาทีตอนเปิดหน้าค้างอยู่) ---- */
const VKEY=(()=>{ try{ let k=localStorage.getItem("opb_vk"); if(!k){ k=Math.random().toString(36).slice(2)+Date.now().toString(36); localStorage.setItem("opb_vk",k); } return k; }catch(e){ return "nols"; } })();
const isPWA=()=>{ try{ return matchMedia("(display-mode: standalone)").matches || navigator.standalone===true; }catch(e){ return false; } };
async function trackVisit(page, kind="open"){
  if(!LIVE || !window.supabase) return;
  try{
    const cli = DB._sb ? DB._sb() : null; if(!cli) return;
    await cli.rpc("track_visit",{p_page:page, p_kind:kind, p_vkey:VKEY,
      p_device:/Mobi|Android|iPhone|iPad|iPod/i.test(navigator.userAgent)?"mobile":"desktop",
      p_pwa:isPWA(), p_ref:(document.referrer||"").slice(0,120)});
  }catch(e){ /* เงียบ ไม่กระทบเกม */ }
}
function startPulse(page){
  if(S._pulse) return;
  S._pulse=setInterval(()=>{ if(document.visibilityState==="visible") trackVisit(page,"pulse"); }, 5*60e3);
  document.addEventListener("visibilitychange", ()=>{ if(document.visibilityState==="visible") trackVisit(page,"open"); });
}
async function boot(){
  const st=BOOTSTATE=await DB.init();
  if(location.hash==="#watch"){ drawSelect(); await enterSpectator(); return; }   // ลิงก์ฉายจอ — ดูอย่างเดียวเสมอ
  if(st.needsAuth||st.needsProfile){
    trackVisit("title");
    drawSelect();
    if(st.email){ $("authWho").textContent=st.email; }
    show("scTitle");
    return;
  }
  await refresh();
  DB.subscribe(()=>refresh()); S._subbed=true;
  show("scArena");
  trackVisit("app"); startPulse("app");
  renderPushBtn();
  await maybeOnboard();                                  // เข้าครั้งแรก: 3 หน้าสั้น ๆ ก่อนเริ่ม
  const recap = await maybeShowRecap();               // ขึ้นสัปดาห์ใหม่ → สรุปสัปดาห์ที่แล้วก่อน แล้วค่อยเลือกเป้า
  if(!recap && !noPledgeWeek() && !inOvertime() && !finished() && !(meR().pledges||{})[curWeek()]) setTimeout(openPledge, 400);
}

/* ---- static bits ---- */
$("sky").insertAdjacentHTML("beforeend",
  [[9,26,"18s"],[46,14,"26s"],[74,32,"21s"],[24,44,"32s"]].map(([l,t,d])=>
    `<div class="cloud" style="left:${l}%;top:${t}%;width:${34+l%20}px;animation-duration:${d};animation-delay:-${l/4}s"></div>`).join(""));
$("parade").innerHTML=["normal","boost","red","normal","flame"].map((stl,i)=>
  `<div style="animation-duration:${7+i*1.7}s;animation-delay:-${i*2.3}s">${runnerBox(Object.assign(randAv(i+3),{color:COLORS[i]}),2,stl)}</div>`).join("");
$("bcTitle").textContent=C.TITLE;
$("wm").textContent = C.TITLE + (CREDIT ? " · " + CREDIT : "");
if($("wmFoot")) $("wmFoot").textContent = $("wm").textContent;
$("bcTitle2").textContent=C.TITLE;
document.title=C.TITLE;
applyPlatFocus();
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
setInterval(()=>{ if($("scArena").classList.contains("on")){ $("hudClock").textContent=cutoffLeft(); const c=$("tbClock"); if(c) c.textContent=cutoffLeft(); renderWeekCut(); } },1000);
setInterval(updateSky, 60000);
setInterval(()=>{ if($("pgRace").classList.contains("on")) renderFeed(); },60000);

/* เริ่มเกม — ถ้าล้มก็ให้ปุ่มลองใหม่ตรงหน้าโหลด ไม่ต้องให้คนไปกดรีเฟรชเอง
   เพราะเคสที่ล้มบ่อยที่สุดคือฐานข้อมูลยังไม่ตื่น ซึ่งกดครั้งที่สองมักผ่านทันที */
function bootWithRetry(){
  loaderStart();
  boot().catch(err=>{
    console.error(err);
    loaderFail(err && err.message, bootWithRetry);
  });
}
bootWithRetry();
