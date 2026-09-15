# 90 Day One Person Business Bootcamp

**LIVE:** https://opb-bootcamp.netlify.app (Netlify project `opb-bootcamp`, Supabase `vbbaefceiswuidylwzmp`)

เว็บแอปแข่งปล่อยคอนเทนต์สำหรับ bootcamp 12 สัปดาห์ หน้าตาเป็นเกมพิกเซล 16-bit
นักเรียนเลือกเองทุกสัปดาห์ว่าจะปล่อยกี่ชิ้น ส่งลิงก์แล้วตัวละครวิ่งทันที
ทุกคนเห็นสนามแข่งเดียวกันแบบเรียลไทม์

**เป้ารวม 90 คอนเทนต์ · 6 สปรินต์ · 4 ห้อง · ส่งเกินได้ ไม่มีเพดาน**

---

## เริ่มดูใน 10 วินาที

```bash
node serve.js
```

เปิด `http://localhost:5173` — โหมด DEMO มีข้อมูลปลอมให้เล่นทันที ไม่ต้องตั้งค่าอะไร
กด `SIMULATE 1 DAY` รัว ๆ จะเห็นสัปดาห์เดินไป โหมด PRO MAX ปลดล็อก และหน้าใบประกาศตอนจบ

ติดตั้งใช้งานจริง ดู **[SETUP.md](SETUP.md)**

---

## โครงสร้างโปรเจกต์ (อ่านตรงนี้ก่อนแก้อะไร)

ไม่มี build step ไม่มี framework — ทุกไฟล์ที่รากคือไฟล์ที่ deploy ขึ้น Netlify ตรง ๆ (โยน zip แบบ flat)

```
.
├── index.html        หน้าเกม (HTML + CSS ทั้งหมดของหน้าเกมอยู่ในไฟล์นี้)
├── app.js            ตรรกะเกมทั้งหมด (~3,400 บรรทัด ดูแผนที่ด้านล่าง)
├── config.js         ค่าที่หัวหน้าโค้ชปรับได้: วันเริ่ม, เป้า, บ้าน, แพลตฟอร์ม, เพลง, Supabase URL/anon key
├── sw.js             service worker: แคช offline + network race 4 วิ (ไม่แคชไฟล์เสียง)
├── admin.html/.js    แผงหัวหน้าโค้ช: รายชื่อ, บ้าน, บอส, รหัสรวม, feedback, Discord, analytics
├── ta.html/.js       แผง TA ประจำบ้าน: ดูงานลูกบ้าน, ลบงาน, ย้ายบ้าน, ให้ kudos
├── boss.js           สไปรต์พิกเซลของบอส 4 ตัว (ใช้ร่วมกันทั้งเกมและ admin)
├── serve.js          เซิร์ฟเวอร์ทดสอบในเครื่อง  node serve.js → http://localhost:5173
├── install.html      คู่มือติดตั้งเป็นแอป (PWA) + guide-ios-*.png
├── manifest.webmanifest, icon-*.png, logo-*.png, 404.html, netlify.toml
├── bgm*.mp3          เพลงประกอบ 3 ไฟล์ (ไม่อยู่ใน git — วางเองตอน deploy, ดู config.js BGM_*)
└── backend/
    ├── migrations/   001–044 รันเรียงลำดับใน Supabase SQL Editor · ไฟล์ = ความจริงของ schema/RLS/RPC/view/cron
    ├── functions/    Edge Functions (Deno): push = แจ้งเตือน, notify, sheet-sync (ตัวหลังถูกแทนด้วย 041 แล้ว)
    ├── seed/         ข้อมูลปลอม 250 คนสำหรับทดสอบ
    ├── test/         smoke.sql
    └── ops/          สคริปต์อุ่นฐานข้อมูลสำรอง (ตัวจริงคือ pg_cron ใน 038)
```

### แผนที่ใน app.js (หัวข้อ `/* ===== ... ===== */` เรียงตามไฟล์)

| ส่วน | ทำอะไร | แก้เมื่อ |
|---|---|---|
| SPRITE | วาดตัวละครพิกเซล 16×N จากตาราง `AV` (ผม/เสื้อ/หมวก…) `buildGrid()` → `sprite()` / `drawSpriteCanvas()` | เพิ่มชุด/หมวก/ไอเทม |
| MATH | คำนวณวัน-สัปดาห์-สปรินต์ `weekOf()` `curWeek()` และ `computeStats()` (โหมด DEMO) | กติกาคะแนน/streak |
| DATA LAYER | `DemoDB` (ข้อมูลปลอมใน localStorage) และ `LiveDB` (Supabase) **สองตัวต้องมีเมธอดชื่อเดียวกันเสมอ** · `fetchAll()` = core 4 query ก่อน แล้ว extras ทยอย 3 ตัว | เพิ่ม query/RPC ใหม่ |
| STATE | `S` = state ก้อนเดียวของหน้า (runners, subs, duels, bosses, cheers…) | — |
| UI HELPERS | `$()` `toast()` (ต่อคิว) `loaderStart/Fail` `show()` `showPage()` | — |
| PLEDGE CARD · TRACK · SCOREBOARD · FEED · SPRINT MAP · PROFILE | ฟังก์ชัน `renderXxx()` วาดแต่ละส่วนจาก `S` · `renderAll()` เรียกทั้งหมด | เปลี่ยนหน้าตา |
| STATUS CARD / ใบประกาศ | canvas 1080×1350 สำหรับแชร์ | การ์ดแชร์ |
| HUD · ONBOARDING · PLEDGE PICKER | แถบบน, แนะนำครั้งแรก, เลือกเป้า + โฟกัสแพลตฟอร์ม (037) | — |
| EVENTS | handler ปุ่มทั้งหมด (`$("id").onclick=`) ส่งงาน, ล็อกอิน, เมนู, feedback, เพลง | เพิ่มปุ่ม |
| DRESSING ROOM | ห้องแต่งตัว `DR_CATS` / `lockOf()` ของล็อกตามผลงาน | ไอเทมใหม่ |
| GAMIFICATION | XP `xpOf()`, เลเวล, ป้าย `BADGES`, ภารกิจวัน `questsOf()`, ปลดล็อก `UNLOCKS`, เพลง `BGM` | กติกา XP/ป้าย |
| SOCIAL | เชียร์, ดวล (`duelOf`, Duel Arena), บอส, King, สรุปสัปดาห์ | ฟีเจอร์สังคม |
| BOOT | `boot()` → `refresh()` (มี guard กันซ้อน) → realtime subscribe · `#watch` = โหมดคนดู | ลำดับโหลด |

### กติกาที่ต้องรักษาเวลาแก้โค้ด
- **โหมด DEMO ต้องเล่นได้เสมอ** (`?demo` ไม่ต่อเน็ต): เพิ่มอะไรใน `LiveDB` ต้องมีคู่ใน `DemoDB`
- ข้อมูลที่หน้าเว็บ**ไม่ควรดึงทั้งตาราง** — PostgREST ตัดที่ 1,000 แถว (เคยพังกับ `cheers`) ให้ทำ view สรุปฝั่ง SQL แทน
- query เสริมใส่ใน `extras` ผ่าน `soft()` = พังแล้วเว็บยังเปิดได้ · query หลักใช้ `must()` = retry
- เปลี่ยน schema = ไฟล์ migration ใหม่เลขถัดไป ห้ามแก้ไฟล์เก่า · ทุก RPC ที่เขียนต้องเช็ค `is_head_coach()` / `auth.uid()`
- ข้อความ UI ภาษาไทย · ปุ่มบนมือถือสูงอย่างน้อย 36px · ทุกอย่างที่ซ่อนด้วย `hidden` ต้องมี CSS `[hidden]{display:none}` ถ้ามี rule `display:` ทับ
- ไฟล์เสียง/รูปใหม่ต้องเพิ่มในรายการ zip ตอน deploy (deploy เป็น flat ไม่มีโฟลเดอร์)

### วงจรงาน
1. นักเรียนขอฟีเจอร์/แจ้งบั๊กในเกม (เมนู ⋯) → หัวหน้าโค้ชกด "รับแล้ว" ในหน้า admin
2. บอท (Claude routine ทุก 8 ชม.) หยิบคำขอที่โหวตสูงสุด → branch `feat/fb-<id>` → เปิด Pull Request ภาษาไทย
3. หัวหน้าโค้ชดู PR → Merge / Close
4. รวมเป็นชุด → ทดสอบใน `node serve.js` → zip → Netlify (โควตา ~20 deploy/เดือน) → ถ้ามี migration ให้รันก่อน deploy

---

## มีอะไรบ้าง

**🏁 RACE** สนามแข่ง 6 โซนตามสปรินต์ ตัวละครวิ่งตามจำนวนคอนเทนต์ที่ปล่อย
มีเส้นเป้าของตัวเอง กรองดูเฉพาะคนใกล้ตัวหรือรายห้องได้ พร้อมการ์ดเป้าสัปดาห์
วงแหวนความคืบหน้า และตัวเตือนว่าวันนี้ยังไม่ได้ส่งงาน

**🏆 SCOREBOARD** ตารางบ้าน 4 ห้องคิดจากค่าเฉลี่ยต่อคน และอันดับทุกคนแบบเกม

**📣 MY STATUS** การ์ดพิกเซลขนาด 1080×1350 วาดด้วย canvas กดแชร์ลงโซเชียลได้
พอจบหลักสูตรจะกลายเป็นใบประกาศพร้อมตราประทับสำหรับคนที่ถึงเป้า

**⚙️ ADMIN** สำหรับหัวหน้าโค้ช — อัปโหลดรายชื่ออีเมล ดูว่าใครยังไม่สมัคร ใครตามหลังเป้า

---

## ตัวละครเปลี่ยนตามเป้าที่รับ

| เป้า/สัปดาห์ | โหมด | ตัวละคร |
|---|---|---|
| 4 | COMPROMISE | สีที่ตัวเองเลือก |
| 7 | RECOMMENDED | สีที่ตัวเองเลือก |
| 10 | LASER FOCUS | ชุดแดงทั้งตัว + แสงแดง |
| 14 | PRO MAX | ชุดทอง ผมทอง ไฟลุกรอบตัว — **ซ่อนไว้จนถึงสัปดาห์ 7** |

---

## Stack

หน้าเว็บเป็น HTML/CSS/JS ล้วน ไม่มีเฟรมเวิร์ก ไม่มี build step ลากขึ้นโฮสต์ได้เลย
ตัวละครเป็น inline SVG ที่ generate จากตารางพิกเซล การ์ดแชร์เป็น Canvas 2D
หลังบ้านเป็น Supabase (Postgres + RLS + Auth + Realtime)

**กติกาทั้งหมดบังคับที่ฐานข้อมูล ไม่ใช่ที่หน้าเว็บ** — ลิงก์ซ้ำ วันที่ เป้าที่ลดไม่ได้
สิทธิ์โค้ช ล้วนเป็น trigger กับ RLS policy และการคำนวณอันดับอยู่ใน SQL view

ชั้นข้อมูลเป็น adapter (`DemoDB` / `LiveDB` อินเทอร์เฟซเดียวกัน) โหมด DEMO เลยรันได้โดยไม่ต้องมีเซิร์ฟเวอร์

---

## โครงสร้าง

```
index.html      หน้าเว็บ + ดีไซน์
app.js          ตรรกะทั้งหมด
config.js       ไฟล์เดียวที่ต้องแก้เวลาปรับกติกา
serve.js        เซิร์ฟเวอร์ไว้เปิดดูในเครื่อง
netlify.toml    ตั้งค่า deploy
backend/
  README.md     แผนงานแบ่งเป็นเฟส
  migrations/   001-006 รันตามลำดับใน Supabase SQL Editor
  functions/    Edge Function สำหรับแจ้งเตือนผ่าน LINE
  seed/         ข้อมูลทดสอบ 250 คน
  test/         ชุดเทสต์ว่ากติกากันโกงได้จริง
```
