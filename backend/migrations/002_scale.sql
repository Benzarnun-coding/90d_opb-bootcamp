-- ============================================================
-- PHASE 2 — รองรับ 250 คน
-- ปัญหาที่แก้: เวอร์ชันแรกดึง submissions ทั้งหมดมาคำนวณในเบราว์เซอร์
--   250 คน x 84 วัน ≈ 20,000 แถว → โหลดหนัก 4MB และคำนวณ 5 ล้านรอบต่อการวาดหนึ่งครั้ง
--   เบราว์เซอร์นักเรียนจะค้าง
-- ทางแก้: ให้ Postgres สรุปให้ เบราว์เซอร์ดึงแค่ 250 แถวที่สรุปแล้ว
-- รันหลัง 001_core.sql
-- ============================================================

-- ------------------------------------------------------------
-- 1. Index ที่จำเป็นตอนข้อมูลเยอะ
-- ------------------------------------------------------------
create index if not exists subs_approved_idx
  on public.submissions (profile_id, day_index) where status = 'approved';
create index if not exists subs_sprint_idx
  on public.submissions (sprint_idx, status);
create index if not exists subs_feed_idx
  on public.submissions (created_at desc);

-- ------------------------------------------------------------
-- 2. วันปัจจุบันของ bootcamp (ใช้ซ้ำหลายที่)
-- ------------------------------------------------------------
create or replace function public.today_index()
returns int language sql stable as $$
  select public.day_of(now());
$$;

-- ------------------------------------------------------------
-- 3. streak ของคนหนึ่งคน — เดินวันต่อวัน หักวันลาให้อัตโนมัติ
--    นับเฉพาะวันที่อยู่ในสปรินต์ที่เขาลงไว้
-- ------------------------------------------------------------
create or replace function public.streak_of(pid uuid)
returns table (streak int, freeze_left int) language plpgsql stable as $$
declare
  c public.cohort%rowtype;
  today int;
  d int;
  sp int;
  used jsonb := '{}'::jsonb;
  budget int;
  st int := 0;
  cur_sp int;
begin
  select * into c from public.cohort where id = 1;
  today := public.day_of(now());
  cur_sp := (today - 1) / c.sprint_days;

  for d in 1..today loop
    sp := (d - 1) / c.sprint_days;
    -- ข้ามวันที่อยู่ในสปรินต์ที่ไม่ได้ลง
    if not exists (select 1 from public.enrollments e
                   where e.profile_id = pid and e.sprint_idx = sp) then
      continue;
    end if;
    if exists (select 1 from public.submissions s
               where s.profile_id = pid and s.day_index = d and s.status = 'approved') then
      st := st + 1;
    else
      budget := coalesce((used ->> sp::text)::int, 0);
      if budget < c.freeze_per_sprint then
        used := used || jsonb_build_object(sp::text, budget + 1);   -- ใช้วันลา streak ไม่ขาด
      else
        st := 0;
      end if;
    end if;
  end loop;

  streak := st;
  freeze_left := c.freeze_per_sprint - coalesce((used ->> cur_sp::text)::int, 0);
  return next;
end $$;

-- ------------------------------------------------------------
-- 4. สรุปรายสปรินต์ของแต่ละคน
-- ------------------------------------------------------------
create or replace view public.v_sprint_stats as
select
  e.profile_id,
  e.sprint_idx,
  count(distinct s.day_index) filter (where s.status = 'approved')            as days,
  round(avg(s.stars) filter (where s.status = 'approved' and s.stars > 0), 2) as craft,
  count(s.id) filter (where s.status = 'pending')                             as pending
from public.enrollments e
left join public.submissions s
  on s.profile_id = e.profile_id and s.sprint_idx = e.sprint_idx
group by e.profile_id, e.sprint_idx;

-- ------------------------------------------------------------
-- 5. กระดานหลัก — หนึ่งแถวต่อหนึ่งคน เบราว์เซอร์ดึงแค่ view นี้
-- ------------------------------------------------------------
create or replace view public.v_leaderboard as
with c as (select * from public.cohort where id = 1),
today as (select public.day_of(now()) as d),
enr as (
  select profile_id,
         array_agg(sprint_idx order by sprint_idx) as joined,
         count(*)                                  as sprints_joined
  from public.enrollments group by profile_id
),
agg as (
  select profile_id,
         count(distinct day_index) filter (where status = 'approved')            as days,
         round(avg(stars) filter (where status = 'approved' and stars > 0), 2)   as craft,
         count(*)                                                               as submitted,
         count(*) filter (where status = 'pending')                             as pending,
         count(*) filter (where status = 'rejected')                            as rejected,
         max(created_at)                                                        as last_at
  from public.submissions group by profile_id
),
-- เป้าถึงวันนี้ = จำนวนวันที่ผ่านไปแล้วเฉพาะในสปรินต์ที่ลงไว้
due as (
  select e.profile_id,
         sum(greatest(0, least(c.sprint_days,
             (select d from today) - (e.sprint_idx * c.sprint_days + 1) + 1)))::int as due_days
  from public.enrollments e cross join c
  group by e.profile_id
)
select
  p.id, p.name, p.handle, p.color, p.role,
  coalesce(enr.joined, '{}')            as joined,
  coalesce(enr.sprints_joined, 0)       as sprints_joined,
  coalesce(agg.days, 0)                 as days,
  coalesce(due.due_days, 0)             as due_days,
  coalesce(agg.days, 0) - coalesce(due.due_days, 0) as pace,
  case when coalesce(due.due_days,0) > 0
       then round(coalesce(agg.days,0)::numeric / due.due_days * 100)
       else 0 end                       as rate,
  agg.craft,
  coalesce(agg.submitted, 0)            as submitted,
  coalesce(agg.pending, 0)              as pending,
  coalesce(agg.rejected, 0)             as rejected,
  agg.last_at,
  coalesce(enr.sprints_joined, 0) * (select sprint_days from c) as cap_days,
  st.streak, st.freeze_left
from public.profiles p
left join enr on enr.profile_id = p.id
left join agg on agg.profile_id = p.id
left join due on due.profile_id = p.id
left join lateral public.streak_of(p.id) st on true;

-- ------------------------------------------------------------
-- 6. ฟีดงานล่าสุด — เบราว์เซอร์ดึงแค่ 50 แถว ไม่ใช่ทั้งหมด
-- ------------------------------------------------------------
create or replace view public.v_feed as
select s.id, s.profile_id, p.name, p.color, s.platform, s.url,
       s.day_index, s.sprint_idx, s.status, s.stars, s.flag, s.created_at
from public.submissions s
join public.profiles p on p.id = s.profile_id
order by s.created_at desc;

-- ------------------------------------------------------------
-- 7. คิวตรวจงานของโค้ช
-- ------------------------------------------------------------
create or replace view public.v_review_queue as
select s.id, s.profile_id, p.name, p.handle, p.color,
       s.platform, s.url, s.day_index, s.sprint_idx, s.flag, s.created_at,
       (select count(*) from public.submissions x
        where x.profile_id = s.profile_id and x.status = 'rejected') as past_rejects
from public.submissions s
join public.profiles p on p.id = s.profile_id
where s.status = 'pending'
order by s.flag desc, s.created_at asc;

-- view สืบทอดสิทธิ์จากตารางต้นทาง (RLS ของ 001 คุมอยู่แล้ว)
grant select on public.v_leaderboard, public.v_sprint_stats,
                public.v_feed, public.v_review_queue to authenticated;

-- ------------------------------------------------------------
-- 8. เช็คว่าเร็วพอ (รันหลัง seed 250 คน)
--    explain analyze select * from public.v_leaderboard;
--    ควรได้ต่ำกว่า 300ms — ถ้าช้ากว่านั้นให้ทำเป็น materialized view
--    แล้วรีเฟรชทุก 1 นาทีด้วย pg_cron แทน
-- ------------------------------------------------------------
