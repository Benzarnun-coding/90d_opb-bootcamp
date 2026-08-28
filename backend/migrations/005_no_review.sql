-- ============================================================
-- PHASE 3d — ถอดระบบตรวจงานออก
--
-- เปลี่ยนจาก "ส่งแล้วรอโค้ชตรวจ" เป็น "ส่งแล้วนับทันที"
--   * ไม่มีคิวตรวจ ไม่มีดาว ไม่มีคะแนน CRAFT
--   * วันหนึ่งส่งกี่ชิ้นก็ได้ ไม่มีเพดาน ส่งเกินเป้าได้
--   * ยังกันลิงก์ซ้ำ และยังขึ้นธงถ้าลิงก์ไม่มี handle ของเจ้าตัว
--     แต่ธงเป็นแค่ข้อมูลให้ดู ไม่บล็อกอะไร
--   * หัวหน้าโค้ชยังลบงานที่มั่วออกได้ ด้วยการตั้ง status = 'rejected'
--
-- ผลที่ตามมา: ภาระโค้ช 250-400 งาน/วันหายไปทั้งหมด
-- และตัวละครขยับทันทีที่กดส่ง ซึ่งเป็นจังหวะที่เกมควรให้รางวัล
--
-- รันหลัง 001 + 002 + 003 + 004
-- ============================================================

-- ------------------------------------------------------------
-- 1. ส่งแล้วนับทันที
-- ------------------------------------------------------------
alter table public.submissions alter column status set default 'approved';

create or replace function public.on_submission_insert()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  c public.cohort%rowtype;
  h text;
begin
  select * into c from public.cohort where id = 1;

  new.created_at := now();
  new.day_index  := public.day_of(new.created_at);
  new.sprint_idx := (new.day_index - 1) / c.sprint_days;
  new.url_key    := public.norm_url(new.url);
  new.status     := 'approved';          -- นับทันที ไม่ต้องรอใครตรวจ
  new.stars      := 0;
  new.reviewed_by := null;
  new.reviewed_at := null;

  if new.day_index > c.sprints * c.sprint_days then
    raise exception 'bootcamp จบแล้ว (วันที่ % เกิน %)', new.day_index, c.sprints * c.sprint_days;
  end if;

  if not exists (select 1 from public.enrollments e
                 where e.profile_id = new.profile_id and e.sprint_idx = new.sprint_idx) then
    raise exception 'ไม่ได้ลงสปรินต์ %', new.sprint_idx + 1;
  end if;

  -- ธงบอกว่าลิงก์ไม่มี handle ที่ลงทะเบียนไว้ — เป็นข้อมูลเฉย ๆ ไม่บล็อก
  select lower(replace(p.handle, '@', '')) into h from public.profiles p where p.id = new.profile_id;
  new.flag := (h is not null and position(h in new.url_key) = 0);

  return new;
end $fn$;

-- ------------------------------------------------------------
-- 2. ไม่มีเพดานต่อวัน — 0 = ไม่จำกัด
-- ------------------------------------------------------------
update public.cohort set max_per_day = 0 where id = 1;

comment on column public.cohort.max_per_day is
  'นับได้สูงสุดกี่ชิ้นต่อวัน — 0 = ไม่จำกัด (ค่าเริ่มต้นของระบบนี้)';

create or replace view public.v_counted as
select s.*, public.week_of(s.day_index) as week_no
from (
  select x.*,
         row_number() over (partition by x.profile_id, x.day_index order by x.created_at) as seq
  from public.submissions x
  where x.status = 'approved'
) s
where (select max_per_day from public.cohort where id = 1) = 0
   or s.seq <= (select max_per_day from public.cohort where id = 1);

-- ------------------------------------------------------------
-- 3. คิวตรวจงานไม่ต้องมีแล้ว
-- ------------------------------------------------------------
drop view if exists public.v_review_queue;

-- เหลือไว้แค่ให้หัวหน้าโค้ชลบงานที่มั่วออกได้
drop policy if exists subs_review_coach on public.submissions;
create policy subs_void_head on public.submissions for update to authenticated
  using (public.is_head_coach()) with check (public.is_head_coach());

create or replace function public.on_submission_review()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if not public.is_head_coach() then
    raise exception 'เฉพาะหัวหน้าโค้ชเท่านั้นที่แก้สถานะงานได้';
  end if;
  new.profile_id := old.profile_id;
  new.url        := old.url;
  new.url_key    := old.url_key;
  new.day_index  := old.day_index;
  new.sprint_idx := old.sprint_idx;
  new.created_at := old.created_at;
  new.reviewed_by := auth.uid();
  new.reviewed_at := now();
  return new;
end $fn$;

-- ------------------------------------------------------------
-- 3.5 เป้ารวมของรุ่น — ปล่อยให้ครบกี่ชิ้นถึงจะถึงเส้นชัย
--     ส่งเกินได้ ไม่มีเพดาน ตัวเลขนี้ใช้แค่วาดเส้นชัยกับคิด %
-- ------------------------------------------------------------
alter table public.cohort add column if not exists goal_total int not null default 90;
update public.cohort set goal_total = 90 where id = 1;

comment on column public.cohort.goal_total is
  'เป้ารวมทั้งรุ่น (ชิ้น) — ต้องตรงกับ GOAL_TOTAL ใน config.js';

-- ------------------------------------------------------------
-- 4. หน้าสถานะรายคน — ใช้ทำการ์ดแชร์ลงโซเชียล
-- ------------------------------------------------------------
create or replace view public.v_status_card as
select
  l.id, l.name, l.handle, l.color,
  l.house_key, l.house_name, l.house_th, l.house_color, l.house_emoji,
  l.contents, l.active_days, l.target_to_date, l.target_total, l.pace, l.rate,
  l.week_target, l.week_done, l.week_pct, l.pledge_key, l.pledge_name, l.pledge_style,
  l.week_streak, l.day_streak, l.weeks_hit, l.weeks_done,
  public.current_week()                                as week_no,
  (select weeks from public.cohort where id = 1)       as weeks_total,
  public.day_of(now())                                 as day_no,
  (select goal_total from public.cohort where id = 1)  as goal_total,
  (l.contents >= (select goal_total from public.cohort where id = 1)) as finished,
  rank() over (order by l.contents desc, l.rate desc)  as rank_all,
  rank() over (partition by l.house_id
               order by l.contents desc, l.rate desc)  as rank_house,
  (select count(*) from public.profiles where role = 'student') as total_students
from public.v_leaderboard l
where l.role = 'student';

grant select on public.v_status_card to authenticated;

-- ============================================================
-- หมายเหตุ
--   คอลัมน์ stars / craft ยังอยู่ในตาราง แต่ไม่ได้ใช้แล้ว
--   ถ้าวันหนึ่งอยากกลับมาให้ดาว แค่แก้ on_submission_insert
--   ให้ตั้ง status = 'pending' เหมือนเดิม แล้วสร้าง v_review_queue กลับมา
--
--   ลบงานที่มั่วออก (เฉพาะหัวหน้าโค้ช):
--     update public.submissions set status = 'rejected' where id = 12345;
--
--   ดูงานที่ติดธงว่าลิงก์ไม่ตรง handle:
--     select p.name, s.url, s.created_at
--     from public.submissions s join public.profiles p on p.id = s.profile_id
--     where s.flag and s.status = 'approved' order by s.created_at desc;
-- ============================================================
