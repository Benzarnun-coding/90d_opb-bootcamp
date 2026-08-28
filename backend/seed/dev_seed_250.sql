-- ============================================================
-- ข้อมูลทดสอบ 250 คน — ไว้วัดว่าระบบรับไหวจริงไหม
--
--   ⚠ รันบนโปรเจกต์ Supabase สำหรับทดสอบเท่านั้น
--   ⚠ ห้ามรันบนโปรเจกต์ที่มีนักเรียนจริง — มันลบข้อมูลทิ้งทั้งหมด
--
-- ต้องรัน 001 + 002 + 003 มาก่อน
-- ใช้วัดสองอย่าง
--   1. v_leaderboard เร็วพอไหมตอนมี 250 คน
--   2. คิวตรวจงานต่อวันเยอะแค่ไหน โค้ชคนเดียวไหวไหม
-- ============================================================

begin;

-- ล้างของเก่า
truncate public.submissions, public.enrollments, public.roster, public.pledges restart identity cascade;
delete from public.profiles;

-- ปลด FK ไป auth.users ชั่วคราว เพราะข้อมูลปลอมไม่มีบัญชีล็อกอินจริง
alter table public.profiles drop constraint if exists profiles_id_fkey;

-- ปิด trigger ระหว่าง seed (ปกติมันคิดวันที่ให้เองและห้ามลงสปรินต์/เลือกเป้าย้อนหลัง)
alter table public.profiles    disable trigger all;
alter table public.pledges     disable trigger all;
alter table public.enrollments disable trigger all;
alter table public.submissions disable trigger all;

-- ตั้งวันเริ่มรุ่นให้ตอนนี้เป็นวันที่ 38 (กลางสปรินต์ 3)
update public.cohort set start_date = current_date - 37 where id = 1;

-- ---------- 250 นักเรียน แบ่ง 4 ห้องแบบวนไปเรื่อย ----------
insert into public.profiles (id, name, handle, color, role, house_id)
select gen_random_uuid(),
       'ST' || lpad(i::text, 3, '0'),
       '@st' || lpad(i::text, 3, '0'),
       (array['#ff4d6d','#4ee1ff','#5ef08c','#ffcc4d','#ff9f43','#ff7bc6','#b06bff','#3ddbb8'])[1 + (i % 8)],
       case when i = 1 then 'coach' else 'student' end,
       case when i = 1 then null else 1 + (i % 4) end   -- คนแรกเป็นหัวหน้าโค้ช ไม่สังกัดห้อง
from generate_series(1, 250) i;

-- รายชื่อที่โค้ชอัปโหลด — ในของจริงคืออีเมลนักเรียน ตรงนี้สร้างให้ตรงกับโปรไฟล์ที่เพิ่งสร้าง
insert into public.roster (email, house_id, full_name, claimed_by, claimed_at)
select lower(p.name) || '@example.com', p.house_id, p.name, p.id, now()
from public.profiles p where p.house_id is not null;

-- ---------- ลงสปรินต์ ----------
-- ทุกคนลงสปรินต์ 1-3 (ที่ผ่านมาแล้ว) ส่วนสปรินต์ 4-6 ลงบ้างไม่ลงบ้าง
insert into public.enrollments (profile_id, sprint_idx)
select p.id, s
from public.profiles p
cross join generate_series(0, 5) s
where s <= 2 or random() < 0.62;

-- ---------- คำสัญญารายสัปดาห์ ----------
-- สุ่มตามนิสัย: ส่วนใหญ่เลือก 7 มีบางคนเอา 4 บางคนเอา 10
-- สัปดาห์ 7 เป็นต้นไปมีคนกล้าเลือก 14 (PRO MAX)
insert into public.pledges (profile_id, week_no, target)
select e.profile_id, w,
       case
         when w >= 7 and random() < 0.12 then 14
         when random() < 0.22 then 4
         when random() < 0.80 then 7
         else 10
       end
from public.enrollments e
cross join lateral generate_series(
  (e.sprint_idx * (select sprint_days from public.cohort where id = 1)) / 7 + 1,
  ((e.sprint_idx + 1) * (select sprint_days from public.cohort where id = 1)) / 7) gs(w)
where w <= public.current_week()
on conflict do nothing;

-- ---------- งานที่ส่ง ----------
-- แต่ละคนมีนิสัยความสม่ำเสมอต่างกัน (0.35 - 0.95)
with hab as (
  select id, 0.35 + random() * 0.60 as consistency, 1.2 + random() * 1.6 as craft
  from public.profiles
),
days as (
  -- วันละได้หลายชิ้น เพราะคนที่รับเป้า 10-14 ชิ้น/สัปดาห์ ต้องปล่อยวันละมากกว่าหนึ่ง
  select e.profile_id, e.sprint_idx, gs.d, rep.k
  from public.enrollments e
  cross join lateral generate_series(
      e.sprint_idx * (select sprint_days from public.cohort where id = 1) + 1,
      least((e.sprint_idx + 1) * (select sprint_days from public.cohort where id = 1),
            public.day_of(now()))) gs(d)
  cross join lateral generate_series(1, 3) rep(k)
)
insert into public.submissions
  (profile_id, url, url_key, platform, day_index, sprint_idx, status, stars, flag, created_at)
select
  d.profile_id,
  'https://tiktok.com/@st/' || d.profile_id || '/' || d.d || '-' || d.k,
  'tiktok.com/@st/' || d.profile_id || '/' || d.d || '-' || d.k,
  (array['TikTok','YouTube','Instagram','Facebook','X','Blog'])[1 + floor(random() * 6)::int],
  d.d,
  d.sprint_idx,
  'approved',   -- ไม่มีระบบตรวจแล้ว ส่งแล้วนับทันที
  greatest(1, least(3, round(h.craft + (random() * 1.4 - 0.7))::int)),
  random() < 0.08,
  now() - make_interval(days => public.day_of(now()) - d.d, hours => floor(random() * 20)::int, mins => d.k * 7)
from days d
join hab h on h.id = d.profile_id
-- ชิ้นแรกของวันมาบ่อย ชิ้นที่สองสามมาน้อยลงเรื่อย ๆ
where random() < h.consistency / d.k;

-- ไม่ใช้ดาวแล้ว
update public.submissions set stars = 0;

alter table public.profiles    enable trigger all;
alter table public.pledges     enable trigger all;
alter table public.enrollments enable trigger all;
alter table public.submissions enable trigger all;

commit;

-- ============================================================
-- วัดผล — รันทีละบรรทัดแล้วดูตัวเลข
-- ============================================================

-- มีข้อมูลเท่าไหร่
select (select count(*) from public.profiles)                                as students,
       (select count(*) from public.enrollments)                             as enrollments,
       (select count(*) from public.submissions)                             as submissions,
       (select count(*) from public.submissions where day_index = public.day_of(now())) as today_posts,
       public.day_of(now())                                                  as today;

-- กระดานหลักเร็วพอไหม (ควรต่ำกว่า 300ms)
explain analyze select * from public.v_leaderboard;

-- ภาพรวม 4 ห้อง
select * from public.v_house_board;

-- สัปดาห์นี้ใครเลือกคำสัญญาอะไรบ้าง
select o.name, o.target, count(*) as people
from public.pledges pl join public.pledge_options o on o.target = pl.target
where pl.week_no = public.current_week()
group by o.name, o.target order by o.target;

-- คนที่ตามหลังเป้าตัวเองเกิน 5 ชิ้น (ไว้ให้โค้ชตามงาน)
select h.name as house, count(*) as behind
from public.v_leaderboard l join public.houses h on h.id = l.house_id
where l.role = 'student' and l.pace < -5
group by h.name order by behind desc;

-- คนที่ถึงเส้นชัยแล้ว
select count(*) as finished
from public.v_leaderboard
where role = 'student'
  and contents >= (select goal_total from public.cohort where id = 1);
