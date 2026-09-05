/* ================= BOSS SPRITES =================
   บอสประจำสัปดาห์ — พิกเซลอาร์ต 24×24 สไตล์เดียวกับตัววิ่ง
   ใช้ร่วมกันทั้งหน้าเกม (index.html) และหน้า admin (admin.html)
   ตัวอักษรในกริด = สีในพาเลต · "." = โปร่ง · "O" = เส้นขอบ
   anim = ตัวอักษรที่จะถูกจับกลุ่มแยกไว้ขยับ (ปีก / ZZZ / เปลว) */
const BOSS_SKINS = [
  { k:"dragon", n:"มังกรผัดวันประกันพรุ่ง", e:"🐉", anim:"Hh",
    pal:{B:"#4cc96a", b:"#22803a", Y:"#ffe08a", H:"#b04cff", h:"#6b1fb0", R:"#ff3b5c", E:"#ffea00", W:"#ffffff"},
    g:[
    "........................",
    "..OO...Ob......bO..OO...",
    ".OHHO..ObO....ObO.OHHO..",
    ".OHHHO..OOBBBBOO.OHHHO..",
    ".OHHHHO.OBBBBBBO.OHHHHO.",
    "..OHHHHOBBBBBBBBOHHHHO..",
    "..OHHHHOBBEBBBEBOHHHHO..",
    "...OHHHOBBEBBBEBOHHHO...",
    "...OHHOBBBBBBBBBBOHHO...",
    "....OOBBWBWBWBWBBBOO....",
    ".....OBBRRRRRRRRBBO.....",
    ".....OBBBBBBBBBBBBO.....",
    "....OBBBBYYYYYYBBBBO....",
    "...OBBBBYYYYYYYYBBBBO...",
    "...OBBBBYYYYYYYYBBBBO...",
    "...OBBBBYYYYYYYYBBBBO...",
    "....OBBBBYYYYYYBBBBO....",
    ".....OBBBBBBBBBBBBO.OO..",
    "....OBBOOBBBBBBOOBBOBBO.",
    "....OBBO.OBBBBO..OBBBBO.",
    "....OOO..OBBBBO...OBBO..",
    ".........OOOOOO....OO...",
    "........................",
    "........................"]},
  { k:"ogre", n:"ยักษ์ขี้เกียจ", e:"👹", anim:"Z",
    pal:{S:"#e8734a", s:"#a8452a", K:"#5a3d2b", E:"#ffffff", T:"#ffe9c4", C:"#3b6ea5", Z:"#ffd23f"},
    g:[
    "..................ZZ....",
    "..OTO......OTO...Z......",
    "..OTOOOOOOOOTO...ZZZ....",
    "..OKKKKKKKKKKO..........",
    ".OKKSSSSSSSSKKO.........",
    ".OKSSSSSSSSSSKO.........",
    ".OSSEESSSSEESSO.........",
    ".OSSOOSSSSOOSSO.........",
    ".OSSSSSSSSSSSSO...OO....",
    ".OSSSsssssssSSO..OKKO...",
    "..OSTSSSSSSTSO...OKKO...",
    "..OOOSSSSSSOOO...OKKO...",
    ".OSSSOOOOOOSSSOOOOKKO...",
    "OSSSSSSSSSSSSSSSSKKKO...",
    "OSSSSSSSSSSSSSSSSOKO....",
    "OSSSSSSSSSSSSSSSSOO.....",
    ".OSSSSSSSSSSSSSSO.......",
    "..OCCCCCCCCCCCCO........",
    "..OCCCCCOOCCCCCO........",
    "..OCCCCO..OCCCCO........",
    "..OCCCCO..OCCCCO........",
    ".OKKKKKO..OKKKKKO.......",
    ".OOOOOOO..OOOOOOO.......",
    "........................"]},
  { k:"ghost", n:"ผีเลื่อนโพสต์", e:"👻", anim:"",
    pal:{G:"#dfe9ff", g:"#9fb3e6", E:"#0b0316", M:"#5c2bd6"},
    g:[
    "........................",
    "........OOOOOOOO........",
    "......OOGGGGGGGGOO......",
    ".....OGGGGGGGGGGGGO.....",
    "....OGGGGGGGGGGGGGGO....",
    "....OGGGGGGGGGGGGGGO....",
    "...OGGGEEGGGGGGEEGGGO...",
    "...OGGGEEGGGGGGEEGGGO...",
    "...OGGGGGGGGGGGGGGGGO...",
    "...OGGGGGGGMMMMGGGGGO...",
    "...OGGGGGGMMMMMMGGGGO...",
    "...OGGGGGGGMMMMGGGGGO...",
    "...OGGGGGGGGGGGGGGGGO...",
    "...OGGGGGGGGGGGGGGGGO...",
    "...OGGGGGGGGGGGGGGGGO...",
    "...OGgGGGGGGGGGGGGgGO...",
    "...OGgGGGGgGGGGgGGgGO...",
    "...OGggGGGggGGgggGggO...",
    "...OGgGOGgggOGgggOGgO...",
    "...OgGO.OggO.OggO.OgO...",
    "...OOO...OO...OO...OO...",
    "........................",
    "........................",
    "........................"]},
  { k:"slime", n:"สไลม์ขี้เกียจ", e:"🟣", anim:"",
    pal:{S:"#b04cff", s:"#7a2bc0", L:"#e6b3ff", E:"#0b0316", W:"#ffffff", M:"#4a0f80"},
    g:[
    "........................",
    "........................",
    "........................",
    "........................",
    ".........OOOOOO.........",
    ".......OOSSSSSSOO.......",
    ".....OOSSLLSSSSSSOO.....",
    "....OSSSLLSSSSSSSSSO....",
    "...OSSSSLSSSSSSSSSSSO...",
    "..OSSSSSSSSSSSSSSSSSSO..",
    "..OSSSSEESSSSSSEESSSSO..",
    ".OSSSSSEWSSSSSSEWSSSSSO.",
    ".OSSSSSSSSSSSSSSSSSSSSO.",
    ".OSSSSSSSMMMMMMMSSSSSSO.",
    ".OSSSSSSMWMWMWMWMSSSSSO.",
    ".OSSSSSSSMMMMMMMSSSSSSO.",
    ".OSSSSSSSSSSSSSSSSSSSSO.",
    ".OsSSSSSSSSSSSSSSSSSSsO.",
    ".OssSSSSSSSSSSSSSSSSssO.",
    "..OsssSSSSSSSSSSSSsssO..",
    "...OOssssssssssssssOO...",
    ".....OOOOOOOOOOOOOO.....",
    "........................",
    "........................"]},
  { k:"robot", n:"จอมอัลกอริทึม", e:"🤖", anim:"Y",
    pal:{M:"#9aa7b8", m:"#5b6675", E:"#ff3b5c", C:"#4ee1ff", Y:"#ffd23f"},
    g:[
    "...........OO...........",
    "...........OYO..........",
    "...........OO...........",
    "......OOOOOOOOOOOO......",
    ".....OMMMMMMMMMMMMO.....",
    "....OMMmmmmmmmmmmMMO....",
    "....OMMmEEEmmEEEmMMO....",
    "....OMMmEEEmmEEEmMMO....",
    "....OMMmmmmmmmmmmMMO....",
    "....OMMmCCCCCCCCmMMO....",
    ".....OMMMMMMMMMMMMO.....",
    "......OOOOOMMOOOOO......",
    "..OOO....OMMMMO....OOO..",
    ".OMMMOOOOMMMMMMOOOOMMMO.",
    ".OMMMMMMMMCCMMMMMMMMMMO.",
    ".OMMMOOMMMMCCMMMMOOMMMO.",
    ".OMMMO.OMMMMMMMMO.OMMMO.",
    ".OMMMO.OMMmmmmMMO.OMMMO.",
    ".OOOO..OMMMMMMMMO..OOOO.",
    ".......OMMMOOMMMO.......",
    "......OMMMO..OMMMO......",
    "......OMMMO..OMMMO......",
    "......OOOOO..OOOOO......",
    "........................"]},
  { k:"skull", n:"ราชาผู้ไม่กล้ากดปล่อย", e:"💀", anim:"",
    pal:{K:"#f2eee6", k:"#b8b0a4", G:"#ffcc4d", R:"#ff3b5c", E:"#3a0a4a", P:"#c4b5ff", p:"#7a5cd6"},
    g:[
    "....G...G...G...G...G...",
    "....GGGGGGGGGGGGGGGGG...",
    "....GGGRGGGGGGGGGRGGG...",
    "....GGGGGGGGGGGGGGGGG...",
    ".....OOOOOOOOOOOOOOO....",
    "....OKKKKKKKKKKKKKKKO...",
    "...OKKKKKKKKKKKKKKKKKO..",
    "...OKKKEEEKKKKKEEEKKKO..",
    "...OKKKEEEKKKKKEEEKKKO..",
    "...OKKKKKKKKEKKKKKKKKO..",
    "...OKKKKKKKEEEKKKKKKKO..",
    "....OKKKKKKKKKKKKKKKO...",
    ".....OkKOKOKOKOKOKkO....",
    "......OOOOOOOOOOOOO.....",
    ".....OPPPPPPPPPPPPPO....",
    "....OPPPPPPPPPPPPPPPO...",
    "...OPPPPPpKKKKKpPPPPPO..",
    "...OPPPPPpKKKKKpPPPPPO..",
    "...OPPPPPPPPPPPPPPPPPO..",
    "...OPPPPPPPPPPPPPPPPPO..",
    "...OpppppppppppppppppO..",
    "...OOOOOOOOOOOOOOOOOOO..",
    "........................",
    "........................"]}
];
const BOSS_W = 24, BOSS_H = 24;
const bossSkin = k => BOSS_SKINS.find(s=>s.k===k) || BOSS_SKINS[0];

/* วาดบอสเป็น SVG · state: idle | hurt (HP ≤ 30%) | dead */
function bossSprite(k, px=4, state="idle"){
  const sk = bossSkin(k);
  const pal = Object.assign({O:"#0b0316"}, sk.pal);
  if(state==="hurt") pal.E = "#ff2d55";             // ตาแดงตอนใกล้ตาย
  let body="", anim="";
  for(let y=0;y<BOSS_H;y++) for(let x=0;x<BOSS_W;x++){
    const ch=sk.g[y][x], c=pal[ch]; if(!c) continue;
    const r=`<rect x="${x*px}" y="${y*px}" width="${px}" height="${px}" fill="${c}"/>`;
    if(sk.anim.includes(ch)) anim+=r; else body+=r;
  }
  return `<svg class="bossSprite ${state}" width="${BOSS_W*px}" height="${BOSS_H*px}" viewBox="0 0 ${BOSS_W*px} ${BOSS_H*px}" shape-rendering="crispEdges">
    ${body}${anim?`<g class="banim">${anim}</g>`:""}</svg>`;
}
/* วาดลง canvas (การ์ดสรุป / แชร์) */
function drawBossCanvas(ctx, x, y, px, k){
  const sk = bossSkin(k), pal = Object.assign({O:"#0b0316"}, sk.pal);
  for(let yy=0;yy<BOSS_H;yy++) for(let xx=0;xx<BOSS_W;xx++){
    const c=pal[sk.g[yy][xx]]; if(!c) continue;
    ctx.fillStyle=c; ctx.fillRect(x+xx*px, y+yy*px, px, px);
  }
}
