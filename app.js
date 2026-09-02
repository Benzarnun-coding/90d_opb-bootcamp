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
       "เบเร่ต์ ♀","หมวกฟาง ♀","แก๊ปกลับหลัง ♂","โบว์ใหญ่ ♀","หูแมว ♀","หมวกไวกิ้ง ♂","ทิอาร่าเพชร ♀","มงกุฎราชา ♂","รัศมีนางฟ้า"],
  mouth:["ยิ้ม","เฉย","อ้าปาก","ยิงฟัน","หนวด","หนวดเครา"],
  nose:["ไม่มี","จุด","โต"]
};
const HAT_COL=[["#000","#000"],["#d63031","#8f1f21"],["#7d5fff","#4c36a8"],["#ffcc4d","#c98a12"],["#e0202a","#8f1f21"],["#1a1a22","#3a3a48"],["#c8955a","#8a6238"],["#5b3fd1","#3a2790"],
  ["#b3213a","#7a1428"],["#e8c872","#b89a42"],["#2d6cdf","#1d47a0"],["#ff6fb5","#c23a82"],["#c9895a","#8a5a35"],["#8a8a95","#5a5a66"],["#9fd8ff","#5aa8e0"],["#ffcc4d","#c98a12"],["#fff3a0","#ffd23a"]];
const DEF_AV={g:0,sk:1,hr:0,hc:1,gl:0,top:0,pt:0,pc:0,hat:0,mo:0,no:1};
const AV_KEYS=Object.keys(DEF_AV);
/* หน้าตาของ runner — คนที่ยังไม่เคยแต่งได้ค่าเริ่มต้น + สีชุดที่เลือกไว้ */
const avOf = r => {
  const av=Object.assign({}, DEF_AV), src=(r&&r.avatar)||{};
  AV_KEYS.forEach(k=>{ if(Number.isInteger(src[k])) av[k]=src[k]; });
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
  const suit = style==="red" ? "#ff2436" : style==="flame" ? "#ffb324" : av.color;
  const p=Object.assign({O:"#140d2e", H:hc[0], h:hc[1], S:skin[0], s:skin[1], E:"#140d2e",
    C:suit, c:shift(suit,-62), l:shift(suit,58), P:pc[0], p:pc[1], B:"#eceaf6", b:"#a8a4c4"}, acc);
  if(style==="boost"){ p.E="#39e5ff"; }                      // ตาเรืองแสงฟ้า
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
  const burn=style==="burnout";
  fill(burn?HEAD_SKULL:HEAD,0); fill(TORSO,10); fill(FRAMES[frame]||LEGS.b,17);

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
  if(hat===4){ for(let x=3;x<=11;x++) set(3,x,"R"); set(3,12,"R");set(3,13,"R");set(4,13,"R");set(4,14,"O");set(5,14,"O"); }
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
  return `<svg width="${16*px}" height="${ROWS*px}" viewBox="0 0 ${16*px} ${ROWS*px}" shape-rendering="crispEdges">
    ${rects(g0,0,LEG0)}${legs}</svg>`;
}
/* แถวบนสุดที่มีพิกเซล — ไว้วางป้ายชื่อให้ชิดหัว (หมวกสูงก็ขยับขึ้นตาม) */
function spriteTop(av, style){
  const g=buildGrid(av,style,0);
  for(let y=0;y<ROWS;y++) if(g[y].some(c=>c!==".")) return y;
  return HR;
}
/* ไฟรอบตัว: red = ไฟแดง (LASER FOCUS)  flame = ไฟทอง (PRO MAX) */
const hasAura = style => style==="red" || style==="flame";
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
const curWeek   = () => weekOf(S.today);
const joinedIn  = (r,s) => r.joined.includes(s);
const joinedWeek= (r,w) => joinedIn(r, spOfWeek(w));
const meR       = () => S.spectator ? null : (S.runners.find(r=>r.name===S.me) || S.runners[0]);
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
  const contents=my.length;
  return {contents, activeDays:Object.keys(byDay).length, weekDone, weekTarget, target,
    pace:contents-target, rate: target?Math.round(contents/target*100):0,
    weekStreak:ws, dayStreak:ds, byDay, weeksHit, burnout,
    style: burnout ? "burnout" : (weekTarget ? optOf(weekTarget).style : "normal")};
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
    const BURN  = new Set([7,12,18,25,31,44]);   // รับ 10/14 สัปดาห์ที่แล้วแล้วพลาด → กระโหลก
    const FLAME = new Set([6,14,22,38]);         // สัปดาห์นี้รับ 14
    const RED   = new Set([9,11,16,20,27,33,41,47]);
    const FINISHER = 34;                          // KING วิ่งถึง 90 แล้ว

    runners.forEach((r,i)=>{
      const grit = i===0 ? 1.02 : i===FINISHER ? 1.3 : .55+R()*.5;
      for(let w=1; w<=cw; w++){
        if(!joinedWeek(r,w)) continue;
        if(i===0 && w===cw) continue;              // ผู้เล่นใหม่ยังไม่ได้เลือกเป้าสัปดาห์นี้
        const roll=R();
        let t = w>=7 && roll<.12 ? 14 : roll<.25 ? 4 : roll<.8 ? 7 : 10;
        if(BURN.has(i)  && w===cw-1) t = R()<.5 ? 10 : 14;
        if(BURN.has(i)  && w===cw)   t = 4;        // สัปดาห์นี้เลือกได้แค่ 4/7
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
        let perDay=t/7;
        if(i===FINISHER) perDay=2.1;
        if(BURN.has(i) && w===cw-1) perDay=Math.min(perDay, (t-4)/7);   // สัปดาห์ที่พลาด ทำได้ไม่ถึง
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
      return {today:db.today, me:db.me, runners:db.runners, subs:db.subs, postedToday, cups,
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
              recent:[...my].sort((a,b)=>b.ts-a.ts).slice(0,15)};
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
    /* อีเมล + รหัสเดียวกันทั้งรุ่น — ไม่พึ่งอีเมลส่งลิงก์ (ติดเพดาน 2 ฉบับ/ชม.)
       เข้าครั้งแรก: เช็คว่าอยู่ในรายชื่อ แล้วสมัครให้เอง (Supabase ตั้ง autoconfirm ไว้) */
    async signIn(email, password){
      const r1=await sb.auth.signInWithPassword({email,password});
      if(!r1.error) return;                                    // onAuthStateChange จะรีโหลดให้
      if(!/invalid login credentials/i.test(r1.error.message)) throw new Error(r1.error.message);
      const {data:ok,error:e2}=await sb.rpc("email_allowed",{em:email});
      if(e2) throw new Error(e2.message);
      if(!ok) throw new Error("อีเมลนี้ไม่อยู่ในรายชื่อรุ่น<br>ติดต่อทีมงานให้เพิ่มชื่อก่อน");
      const r2=await sb.auth.signUp({email,password});
      if(r2.error){
        if(/already registered/i.test(r2.error.message)) throw new Error("รหัสไม่ถูกต้อง");
        throw new Error(r2.error.message);
      }
      /* อีเมลนี้มีบัญชีอยู่แล้วแต่รหัสผิด — Supabase คืน user ปลอมที่ไม่มี identities */
      if(!r2.data.session){
        const ids=(r2.data.user&&r2.data.user.identities)||[];
        throw new Error(ids.length ? "สมัครแล้วแต่ยังเข้าไม่ได้ — เปิด autoconfirm ใน Supabase" : "รหัสไม่ถูกต้อง");
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
      const {error:e2}=await sb.from("enrollments").insert(p.joined.map(s=>({profile_id:session.user.id,sprint_idx:s})));
      if(e2) throw new Error(e2.message);
    },
    /* ดึงเฉพาะผลสรุปที่ Postgres คิดมาแล้ว
       250 คน = 250 แถว + ฟีด 50 แถว + คำสัญญาของตัวเองอีก 12 แถว
       แทนที่จะลากงานทั้งรุ่นสองหมื่นกว่าแถวมาคำนวณในเครื่องนักเรียน */
    async updateAvatar(av, color){
      const {error}=await sb.from("profiles").update({avatar:av, color}).eq("id",session.user.id);
      if(error) throw new Error(error.message);
    },
    async fetchAll(){
      const uidNow = session ? session.user.id : null;      // null = โหมดคนดู
      const [{data:co},{data:board,error:be},{data:feed},{data:pls},{data:burn},{data:cups}]=await Promise.all([
        sb.from("cohort").select("*").eq("id",1).single(),
        sb.from("v_leaderboard").select("*"),
        sb.from("v_feed").select("*").limit(50),
        uidNow ? sb.from("pledges").select("week_no,target").eq("profile_id",uidNow) : Promise.resolve({data:[]}),
        sb.from("v_burnout").select("profile_id"),
        sb.from("v_house_cup").select("*")
      ]);
      if(be) throw new Error("อ่าน v_leaderboard ไม่ได้ — รัน migration 002-005 ครบหรือยัง? ("+be.message+")");
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
      let todayCount=0;
      if(uidNow){
        const q=await sb.from("submissions").select("id",{count:"exact",head:true})
          .eq("profile_id",uidNow).eq("day_index",todayIdx).eq("status","approved");
        todayCount=q.count||0;
      }
      return {
        today: todayIdx,
        me: me ? me.name : null,
        postedToday: (todayCount||0) > 0,
        started, daysUntil, startDate: co.start_date,
        cups: cups||[],
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
      const [{data},{data:wk}]=await Promise.all([
        sb.from("submissions")
          .select("id,platform,url,day_index,sprint_idx,created_at")
          .eq("profile_id",runner.id).eq("status","approved")
          .order("created_at",{ascending:false}).limit(400),
        sb.from("v_week_progress").select("week_no,target,done,hit,finished").eq("profile_id",runner.id)
      ]);
      const byDay={};
      (data||[]).forEach(s=>{ byDay[s.day_index]=(byDay[s.day_index]||0)+1; });
      /* ส่งก่อน 6 โมงเช้าเวลาไทย */
      const early=(data||[]).some(s=>((new Date(s.created_at).getUTCHours()+7)%24) < 6);
      return {byDay, weeks:wk||[], early, recent:(data||[]).slice(0,15).map(s=>({
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
let S = {today:1, me:null, runners:[], subs:[], raceFilter:"near", boardFilter:"all", spectator:false};
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
      + '<button class="btn go" style="max-width:260px" onclick="leaveSpectator()">▶ เข้าสู่ระบบเพื่อลงแข่ง</button>';
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
  const ringColor = o.style==="flame" ? "#ffb020" : o.style==="red" ? "#ff2436" : o.style==="boost" ? "#39e5ff" : r.color;
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
    </div>
    <div class="rival">${st.burnout
      ? `💀 สัปดาห์นี้เป็นร่างกระโหลก · ทำครบ ${st.weekTarget} ชิ้น = <b style="color:var(--gold)">ฟื้นคืนชีพ</b> ได้ป้าย REVIVED · `
      : ""}${rivalHTML(r)}</div>` + nudge;
}

/* ================= TRACK ================= */
function raceList(){
  const all=ranked();
  if(S.raceFilter==="all") return all;
  if(S.raceFilter!=="near") return all.filter(r=>r.house===+S.raceFilter || roleOf(r)==="head");
  const i=all.findIndex(r=>r.name===S.me);
  if(i<0) return all.slice(0,NEAR*2+1);
  return all.slice(Math.max(0,i-NEAR), i+NEAR+1);
}
function renderFilters(){
  const mk=(cur,pfx)=>[S.spectator ? "" : `<button class="fBtn ${cur==="near"?"on":""}" data-f="near"
      style="${cur==="near"?"background:linear-gradient(180deg,#5b51c4,#332a80)":""}">ใกล้ฉัน</button>`,
    `<button class="fBtn ${cur==="all"?"on":""}" data-f="all"
      style="${cur==="all"?"background:linear-gradient(180deg,#5b51c4,#332a80)":""}">ทั้งรุ่น</button>`]
    .concat(HOUSES.map(h=>`<button class="fBtn ${cur===String(h.id)?"on":""}" data-f="${h.id}"
      style="${cur===String(h.id)?`background:linear-gradient(180deg,${h.color},${shift(h.color,-90)});color:#0d0a22`:""}">
      ${h.id===champHouse()?"🏆 ":""}${h.emoji} ${h.name}</button>`)).join("");
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
    const role=roleOf(r), rtag=role==="head"?" COACH":role==="ta"?" TA":"";
    /* ป้ายชื่อ+ตัวเลขวางอยู่เหนือพิกเซลบนสุดของตัวละครพอดี (คิดจากหมวก/ผมจริง)
       ต้นสนามชิดซ้าย กลางสนามอยู่กลางหัว ใกล้เส้นชัยชิดขวา จะได้ไม่ล้นออกนอกสนาม */
    const av=avOf(r), top=spriteTop(av,s.style);
    const side = p<0.12 ? "edgeL" : p>0.78 ? "edgeR" : "";
    return `<div class="lane ${r.name===S.me?"meLane":""}" data-n="${r.name}">
      <div class="runner ${r.name===S.me?"me":""} ${s.style} ${r.house===champHouse()&&roleOf(r)==="student"?"cup":""} ${s.contents>=FINISH?"champ":""}" style="--p:${p}">
        <div class="body">
          <div class="lbl ${side}" style="bottom:${(ROWS-top)*2}px">
            <span class="name ${role}"><i>${role==="head"?"🎓":h.emoji}</i> ${r.name}${rtag}${s.weekTarget?` · ${s.weekDone}/${s.weekTarget}`:""}</span>
            <span class="tag">${s.contents}${s.contents>=FINISH?" 🏆":""}</span>
          </div>
          ${hasAura(s.style)?aura(s.style):""}${sprite(av,2,s.style)}
          ${s.dayStreak?'<span class="dust"></span><span class="dust b"></span>':''}</div>
        <div class="shadow"></div>
      </div></div>`;
  }).join("") : `<div class="noJoin">ยังไม่มีใครในกลุ่มนี้</div>`;

  $("trackTitle").textContent=`RACE TRACK · ${FINISH} CONTENTS`;
  const cc=champCup();
  $("trackSub").textContent = cc
    ? `🏆 บ้านแชมป์สัปดาห์ที่แล้ว: ${houseOf(cc.house_id).emoji} ${houseOf(cc.house_id).name} (เฉลี่ย ${cc.avg_pieces} ชิ้น/คน) · ระยะทาง = จำนวนคอนเทนต์`
    : "ระยะทาง = จำนวนคอนเทนต์ · เส้นฟ้า = เป้าของคุณ ณ สัปดาห์นี้";
}

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
  const all=ranked();
  return S.boardFilter==="all"||S.boardFilter==="near" ? all : all.filter(r=>r.house===+S.boardFilter || roleOf(r)==="head");
}
function renderBoard(){
  renderHouses();
  const full=ranked();
  const list=boardList();
  $("board").innerHTML=list.map(r=>{
    const s=stats(r), h=houseOf(r.house);
    const role=roleOf(r);
    const i=role==="student" ? rankOf(r.name)-1 : -1;
    const medal=role==="head"?"🎓":role==="ta"?"TA":i===0?"👑":i===1?"🥈":i===2?"🥉":String(i+1).padStart(2,"0");
    const o=s.weekTarget?optOf(s.weekTarget):null;
    const wk = o ? `<span class="wkTag ${s.weekDone>=s.weekTarget?"hit":o.style}">${s.weekDone}/${s.weekTarget}${o.style==="red"?" 🔴":o.style==="flame"?" 🔥":""}</span>`
                 : `<span class="wkTag normal" style="opacity:.5">—</span>`;
    const pc = s.pace>0?"var(--green)":s.pace<0?"var(--orange)":"var(--cyan)";
    return `<tr class="${r.name===S.me?"me":""}" data-n="${r.name}" id="row-${r.name}">
      <td class="rk ${i<3?"top"+(i+1):""}">${medal}</td>
      <td class="nm" style="color:${nameColor(r)}">${r.name}
        <span style="font-family:var(--f-th);font-size:11px;color:var(--dim)">${r.handle}</span></td>
      <td class="hideSm">${role==="head" ? '<span style="color:#ff4d6d;font-size:12px">🎓 หัวหน้าโค้ช</span>'
        : `<span class="hs">${h.emoji}</span> <span style="color:${h.color};font-size:12px">${h.name}</span>${role==="ta"?' <span style="color:#5ef08c;font-size:11px">TA</span>':""}`}</td>
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
  $("mFeed").innerHTML=det.recent.slice(0,12)
    .map(f=>`<li><span class="plat">${f.plat}</span>
      <a href="${f.url}" target="_blank" rel="noopener">${f.url}</a>
      <span class="when">${ago(f.ts)}</span></li>`).join("") || `<li style="color:var(--dim)">ยังไม่มีงาน</li>`;
}

/* ป้ายอธิบายร่างปัจจุบันของตัวละคร */
function formLabel(r, s){
  const o = s.weekTarget ? optOf(s.weekTarget) : null;
  const fin = s.contents>=FINISH ? `<br>🏆 ถึงเส้นชัย ${FINISH} ชิ้นแล้ว — ออร่าทองถาวร` : "";
  if(s.style==="burnout")
    return `<b>💀 ร่างกระโหลก · หมดแรง</b><br>สัปดาห์ที่แล้วรับเป้าหนัก (${HEAVY}+ ชิ้น) แล้วทำไม่ถึง สัปดาห์นี้เลือกได้แค่ 4 หรือ 7<br><span style="color:var(--dim)">ทำครบสัปดาห์นี้ = ฟื้นคืนชีพ ได้ป้าย REVIVED</span>`+fin;
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
  if(style==="boost"){
    const gr=ctx.createRadialGradient(x+8*px, y+16*px, 2*px, x+8*px, y+16*px, 13*px);
    gr.addColorStop(0,"rgba(57,229,255,.5)"); gr.addColorStop(1,"rgba(57,229,255,0)");
    ctx.fillStyle=gr; ctx.fillRect(x-8*px, y-6*px, 32*px, 36*px);
  }
  for(let ry=0;ry<ROWS;ry++) for(let cx=0;cx<16;cx++){
    const c=pal[g[ry][cx]]; if(!c) continue;
    ctx.fillStyle=c; ctx.fillRect(x+cx*px, y+ry*px, px, px);
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
  drawSpriteCanvas(ctx, (W-sw)/2, 150, px, avOf(r), s.style);

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
    ctx.fillStyle=s.style==="flame"?"#ffb020":s.style==="red"?"#ff4d6d":"#39e5ff";
    ctx.fillText(`${s.style==="flame"?"🔥":s.style==="red"?"🔥":"🔵"} ${o.name} MODE`, W/2, 178);
  }
  /* ป้ายรางวัลที่ได้แล้ว */
  const bl = S.myDet ? earnedBadges(r,S.myDet) : [];
  if(bl.length){
    ctx.font="36px sans-serif"; ctx.fillStyle="#fff";
    ctx.fillText(bl.map(b=>b.e).join("  "), W/2, 1312);
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
  ctx.font="700 24px 'Pixelify Sans', monospace";
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
  drawSpriteCanvas(ctx,(W-sw)/2, 270, px, avOf(r), s.style);

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
    + h.emoji + " บ้าน " + h.name + " · ทำได้ " + s.rate + "% ของเป้าที่รับไว้\n"
    + TAG + (CREDIT ? "\n" + CREDIT : "");
}

function shareTextOf(){
  const r=meR(), s=stats(r), h=houseOf(r.house);
  const o=s.weekTarget?optOf(s.weekTarget):null;
  const fin = s.contents>=FINISH ? " 🏆 ครบเป้าแล้ว!" : ` จากเป้า ${FINISH}`;
  return `ปล่อยไปแล้ว ${s.contents} คอนเทนต์${fin} ใน ${C.TITLE} 🏁\n`
   + `${h.emoji} บ้าน ${h.name} · สัปดาห์ที่ ${curWeek()}/${WEEKS}\n`
   + (o?`สัปดาห์นี้รับเป้า ${o.name} ${o.target} ชิ้น — ทำไปแล้ว ${s.weekDone}\n`:"")
   + rivalText(r)
   + `streak ${s.weekStreak} สัปดาห์ 🔥\n${TAG}` + (CREDIT ? "\n"+CREDIT : "");
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
  $("shBadges").innerHTML = S.myDet ? badgesHTML(earnedBadges(r,S.myDet), true) : "";
  try{ const det=await DB.detail(r); S.myDet=det; $("mMap").innerHTML=mapHTML(r, det.byDay);
    $("shBadges").innerHTML=badgesHTML(earnedBadges(r,det), true);
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
  $("submitPanel").style.display = S.spectator ? "none" : "";
  $("statusNav").style.display   = S.spectator ? "none" : "";
  if(S.spectator){
    $("meLine").innerHTML=`👀 <span style="color:var(--cyan)">โหมดคนดู</span> · นักเรียน ${students().length} คน · คลิกที่เลนหรือแถวเพื่อดูโปรไฟล์`;
    $("adminNav").style.display="none";
    $("modeTag").textContent = DB.mode==="live"?"LIVE · ดูอย่างเดียว":"DEMO · ดูอย่างเดียว";
    $("modeTag").className = "chip "+(DB.mode==="live"?"live":"warnChip");
    return;
  }
  const r=meR(); if(!r) return;
  const h=houseOf(r.house), s=stats(r);
  const roleLbl = roleOf(r)==="head" ? '🎓 <span style="color:#ff4d6d">หัวหน้าโค้ช</span>' : `${h.emoji} <span style="color:${h.color}">${h.name}</span>${roleOf(r)==="ta"?' · <span style="color:#5ef08c">TA</span>':""}`;
  $("meLine").innerHTML=`${roleLbl} ·
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
  $("adminNav").style.display = (DB.mode==="demo" || roleOf(r)==="head") ? "" : "none";
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
  const em=$("email").value.trim(), pw=$("pass").value;
  if(!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(em)) return toast("ใส่อีเมลให้ถูกก่อน");
  if(!pw) return toast("ใส่รหัสเข้าก่อน");
  $("authBtn").disabled=true;
  try{ await DB.signIn(em, pw); $("authNote").textContent="กำลังเข้า…"; }
  catch(err){ toast(err.message); $("authBtn").disabled=false; }
};
$("pass").onkeydown=e=>{ if(e.key==="Enter") $("authBtn").click(); };
$("joinBtn").onclick=async()=>{
  const nm=$("myName").value.trim();
  if(!nm) return toast("ใส่ชื่อก่อน");
  $("joinBtn").disabled=true;
  try{
    /* handle ไม่ต้องกรอกแล้ว ฐานข้อมูลเติมให้จากอีเมลที่ล็อกอิน */
    await DB.createProfile({name:nm.toUpperCase().slice(0,10),
      color:pickColor, avatar:pickAv, joined:ALL_SPRINTS, house:1+((Date.now())%4)});
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
  const before=stats(meR()), hadUnlocked=unlockedSet(before);
  $("pushBtn").disabled=true;
  try{
    await DB.submit({url, platform:$("plat").value});
    $("url").value="";
    S.postedToday=true;
    await refresh();
    const after=stats(meR());
    const o=after.weekTarget?optOf(after.weekTarget):null;
    let msg=`+1 CONTENT · รวม ${after.contents} ชิ้น`, kind="submit";
    if(o && before.weekDone<o.target && after.weekDone>=o.target){
      if(before.burnout){ msg=`ฟื้นคืนชีพ! 💀→🔥<br>ทำครบเป้าทั้งที่เป็นร่างกระโหลก ได้ป้าย REVIVED`; kind="revive"; }
      else { msg=`ครบเป้าสัปดาห์นี้แล้ว! 🎉<br>${o.name} ${o.target}/${o.target}`; kind="target"; }
    }
    else if(o) msg=`+1 CONTENT · สัปดาห์นี้ ${after.weekDone}/${o.target}`;
    if(after.contents>=FINISH && before.contents<FINISH){ msg=`🏆 ถึงเส้นชัย ${FINISH} ชิ้นแล้ว!<br>ออร่าทองถาวรติดตัวตลอดรุ่น`; kind="target"; }
    celebrate(kind); toast(msg);
    /* ปลดล็อกของแต่งตัวใหม่ */
    const fresh=[...unlockedSet(after)].filter(k=>!hadUnlocked.has(k));
    if(fresh.length) setTimeout(()=>{ celebrate("unlock");
      toast(`🔓 ปลดล็อกแล้ว: ${fresh.map(k=>UNLOCKS[k].th).join(" · ")}<br>ไปใส่ได้ที่ห้องแต่งตัว`); }, 2200);
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
        : o.style==="red" ? `🔥 ${o.name}<br>ไฟแดงลุกทั้งตัวสัปดาห์นี้`
        : o.style==="boost" ? `🔵 ${o.name}<br>ตาเรืองแสงฟ้าสัปดาห์นี้`
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
  drAv = mode==="select" ? Object.assign({},pickAv,{color:pickColor}) : avOf(meR());
  drCat="g"; drawDress(); $("dressModal").classList.add("on");
}
window.openDress=openDress;
function drawDress(){
  $("drPreview").innerHTML=runnerBox(drAv,7);
  $("drTabs").innerHTML=DR_CATS.map(([k,n])=>`<button class="drTab ${k===drCat?"on":""}" data-k="${k}">${n}</button>`).join("");
  const st = drMode==="arena" ? stats(meR()) : EMPTY_ST;
  $("drOpts").innerHTML=DR_OPTS[drCat].map((o,i)=>{
    const av=Object.assign({},drAv,{[drCat]:i});
    const label = DR_LABEL[drCat] ? DR_LABEL[drCat](i) : o;
    const lock = lockOf(drCat,i,st);
    return `<button class="drOpt ${drAv[drCat]===i?"on":""} ${lock?"locked":""}" data-i="${i}">${sprite(av,4,"normal")}<span>${label}</span>${lock?`<em>🔒 ${lock.how}</em>`:""}</button>`;
  }).join("");
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
  "hat:3": {th:"มงกุฎ",       need:s=>s.weeksHit>=3,  how:"ทำครบเป้า 3 สัปดาห์"},
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
  "hat:14": {th:"ทิอาร่าเพชร",    need:s=>s.contents>=90, how:"ถึงเส้นชัย 90 ชิ้น"},
  "hat:15": {th:"มงกุฎราชา",      need:s=>s.contents>=90, how:"ถึงเส้นชัย 90 ชิ้น"},
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
  {k:"cup",     e:"👑", n:"HOUSE CUP",    th:"บ้านของคุณชนะถ้วยรายสัปดาห์",         test:c=>c.cups>0}
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
  return {st, weeks, maxDay, maxHit, early:!!(det&&det.early), revived, cups};
}
const earnedBadges = (r,det) => { const c=badgeCtx(r,det); return BADGES.filter(b=>b.test(c)); };
function badgesHTML(list, showAll){
  const html=BADGES.map(b=>{
    const on=list.includes(b); if(!on && !showAll) return "";
    return `<span class="badge ${on?"on":""}" title="${b.th}"><i>${b.e}</i><b>${b.n}</b><small>${b.th}</small></span>`;
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
  if(kind==="submit"){ SFX.coin(); jumpMe(); }
  if(kind==="target"){ SFX.fanfare(); jumpMe(); confetti(); }
  if(kind==="unlock"){ SFX.unlock(); confetti(30); }
  if(kind==="revive"){ SFX.revive(); jumpMe(); confetti(70); }
}

/* ================= BOOT ================= */
async function refresh(){
  const d=await DB.fetchAll();
  S.today=d.today; S.me=S.spectator?null:d.me; S.runners=d.runners; S.subs=d.subs; S.postedToday=!!d.postedToday;
  S.started = d.started !== false; S.daysUntil = d.daysUntil||0; S.startDate = d.startDate||null;
  S.cups = d.cups||[];
  if(DB.mode==="demo") S.runners.forEach(r=>{ r.st=computeStats(r); });
  renderAll();
}
/* โหมดคนดู — ไม่ต้องล็อกอิน เห็นสนามแบบเรียลไทม์ แต่ส่งงานไม่ได้ (ฐานข้อมูลกันอยู่แล้ว)
   เปิดลิงก์ #watch ไปฉายบนจอในห้องเรียนได้เลย */
async function enterSpectator(){
  S.spectator=true; S.raceFilter="all"; S.boardFilter="all";
  try{ await refresh(); }catch(e){ toast("โหลดสนามไม่ได้: "+e.message); S.spectator=false; return; }
  if(!S._subbed){ DB.subscribe(()=>refresh()); S._subbed=true; }
  show("scArena"); showPage("pgRace");
}
window.leaveSpectator=()=>{
  /* ถอด #watch แล้วโหลดใหม่ — ถ้าล็อกอินอยู่จะเข้าสนามปกติ ถ้ายังไม่ล็อกอินจะเจอหน้าแรก */
  history.replaceState(null,"",location.pathname+location.search);
  location.reload();
};
$("watchBtn").onclick=enterSpectator;
async function boot(){
  const st=BOOTSTATE=await DB.init();
  if(location.hash==="#watch"){ drawSelect(); await enterSpectator(); return; }   // ลิงก์ฉายจอ — ดูอย่างเดียวเสมอ
  if(st.needsAuth||st.needsProfile){
    drawSelect();
    if(st.email){ $("authWho").textContent=st.email; }
    show("scTitle");
    return;
  }
  await refresh();
  DB.subscribe(()=>refresh()); S._subbed=true;
  show("scArena");
  if(!(meR().pledges||{})[curWeek()]) setTimeout(openPledge, 400);
}

/* ---- static bits ---- */
$("sky").insertAdjacentHTML("beforeend",
  [[9,26,"18s"],[46,14,"26s"],[74,32,"21s"],[24,44,"32s"]].map(([l,t,d])=>
    `<div class="cloud" style="left:${l}%;top:${t}%;width:${34+l%20}px;animation-duration:${d};animation-delay:-${l/4}s"></div>`).join(""));
$("parade").innerHTML=["normal","boost","red","normal","flame"].map((stl,i)=>
  `<div style="animation-duration:${7+i*1.7}s;animation-delay:-${i*2.3}s">${runnerBox(Object.assign(randAv(i+3),{color:COLORS[i]}),2,stl)}</div>`).join("");
$("bcTitle").textContent=C.TITLE;
$("wm").textContent = C.TITLE + (CREDIT ? " · " + CREDIT : "");
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
