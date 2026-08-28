-- ============================================================
-- PHASE 3c — คำสัญญารายสัปดาห์ (Weekly Pledge)
--
-- เปลี่ยนแกนคะแนนจาก "วันละ 1 ชิ้น" เป็น "สัปดาห์ละกี่ชิ้นตามที่ตัวเองเลือก"
-- ทุกต้นสัปดาห์นักเรียนเลือกเองว่าสัปดาห์นี้จะปล่อยกี่ชิ้น
--
--    4 ชิ้น/สัปดาห์   COMPROMISE          ตัวละครปกติ
--    7 ชิ้น/สัปดาห์   RECOMMENDED         ตัวละครปกติ
--   10 ชิ้น/สัปดาห์   LASER FOCUS         ตัวละครเป็นสีแดง เฉพาะสัปดาห์นั้น
--   14 ชิ้น/สัปดาห์   LASER FOCUS PRO MAX ตัวละครติดไฟ — เปิดหลังผ่าน 6 สัปดาห์
--
-- คะแนนยังเป็นของรายคน ห้องกับสปรินต์ยังอยู่เหมือนเดิม
-- รันหลัง 001 + 002 + 003
-- ============================================================

-- ------------------------------------------------------------
-- 1. ค่าคงที่ของรุ่นที่เพิ่มเข้ามา
-- ------------------------------------------------------------
alter table public.cohort add column if not exists weeks       smallint not null default 12;
alter table public.cohort add column if not exists max_per_day smallint not null default 4;

comment on column public.cohort.max_per_day is
  'นับได้สูงสุดกี่ชิ้นต่อวัน กันคนดัมป์ 14 คลิปรวดเดียววันอาทิตย์แล้วเคลมว่าทำครบ';

-- ------------------------------------------------------------
-- 2. ตัวเลือกที่ให้เลือกได้
-- ------------------------------------------------------------
create table if not exists public.pledge_options (
  target      smallint primary key,
  key         text not null unique,
  name        text not null,
  th          text not null,
  unlock_week smallint not null default 1,   -- เปิดให้เลือกตั้งแต่สัปดาห์ที่เท่าไหร่
  style       text not null default 'normal' -- normal | red | flame
);

insert into public.pledge_options (target, key, name, th, unlock_week, style) values
  ( 4,'compromise', 'COMPROMISE',          'ประนีประนอม — สัปดาห์นี้งานยุ่ง เอาแค่ไม่หลุด', 1,'normal'),
  ( 7,'recommended','RECOMMENDED',         'แนะนำ — วันละชิ้น จังหวะที่โตได้จริง',            1,'normal'),
  (10,'laser',      'LASER FOCUS',         'โฟกัสเต็มที่ — เร่งเครื่องสัปดาห์นี้',             1,'red'),
  (14,'promax',     'LASER FOCUS PRO MAX', 'โหมดไฟลุก — วันละสองชิ้น ไม่ใช่เล่น ๆ',           7,'flame')
on conflict (target) do update
  set key = excluded.key, name = excluded.name, th = excluded.th,
      unlock_week = excluded.unlock_week, style = excluded.style;

-- ------------------------------------------------------------
-- 3. คำสัญญาของแต่ละคนแต่ละสัปดาห์
-- ------------------------------------------------------------
create table if not exists public.pledges (
  profile_id uuid     not null references public.profiles(id) on delete cascade,
  week_no    smallint not null,
  target     smallint not null references public.pledge_options(target),
  chosen_at  timestamptz not null default now(),
  primary key (profile_id, week_no)
);
create index if not exists pledges_week_idx on public.pledges (week_no);

-- ------------------------------------------------------------
-- 4. ตัวช่วยเรื่องสัปดาห์
-- ------------------------------------------------------------
create or replace function public.week_of(d int)
returns int language sql immutable as $fn$
  select greatest(1, ((d - 1) / 7) + 1);
$fn$;

create or replace function public.current_week()
returns int language sql stable as $fn$
  select public.week_of(public.day_of(now()));
$fn$;

-- สัปดาห์ที่ w อยู่ในสปรินต์ไหน
create or replace function public.sprint_of_week(w int)
returns int language sql stable as $fn$
  select ((w - 1) * 7) / (select sprint_days from public.cohort where id = 1);
$fn$;

-- ------------------------------------------------------------
-- 5. กติกาตอนเลือก / แก้คำสัญญา
--
--    * เลือกล่วงหน้าได้ แต่ย้อนหลังไม่ได้
--    * สัปดาห์ที่กำลังวิ่งอยู่ "เพิ่มได้ ลดไม่ได้"
--      เพราะถ้าลดได้ คนจะสัญญา 10 ไว้ก่อน พอทำไม่ไหวก็ลดเหลือ 4 ตอนวันศุกร์
--      แล้วคำสัญญาจะไม่มีความหมายอะไรเลย
--    * ตัวเลือก 14 เปิดเฉพาะสัปดาห์ที่ 7 เป็นต้นไป
--    * สัปดาห์ที่อยู่ในสปรินต์ที่ไม่ได้ลง เลือกไม่ได้
-- ------------------------------------------------------------
create or replace function public.guard_pledge()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  c   public.cohort%rowtype;
  cw  int;
  opt public.pledge_options%rowtype;
  sp  int;
begin
  select * into c from public.cohort where id = 1;
  cw := public.current_week();

  if new.week_no < 1 or new.week_no > c.weeks then
    raise exception 'สัปดาห์ที่ % ไม่มีในรุ่นนี้', new.week_no;
  end if;

  if new.week_no < cw then
    raise exception 'สัปดาห์ที่ % ผ่านไปแล้ว เลือกย้อนหลังไม่ได้', new.week_no;
  end if;

  select * into opt from public.pledge_options where target = new.target;
  if opt.target is null then
    raise exception 'ไม่มีตัวเลือก % ชิ้นต่อสัปดาห์', new.target;
  end if;
  if new.week_no < opt.unlock_week then
    raise exception '% ยังไม่เปิด ต้องถึงสัปดาห์ที่ % ก่อน', opt.name, opt.unlock_week;
  end if;

  sp := public.sprint_of_week(new.week_no);
  if not exists (select 1 from public.enrollments e
                 where e.profile_id = new.profile_id and e.sprint_idx = sp) then
    raise exception 'สัปดาห์ที่ % อยู่ในสปรินต์ % ซึ่งยังไม่ได้ลง', new.week_no, sp + 1;
  end if;

  if TG_OP = 'UPDATE' and new.week_no = cw and new.target < old.target then
    raise exception 'สัปดาห์นี้เริ่มไปแล้ว เพิ่มเป้าได้ แต่ลดไม่ได้ (เดิม % ชิ้น)', old.target;
  end if;

  new.chosen_at := now();
  return new;
end $fn$;

drop trigger if exists trg_pledge_ins on public.pledges;
create trigger trg_pledge_ins before insert on public.pledges
  for each row execute function public.guard_pledge();
drop trigger if exists trg_pledge_upd on public.pledges;
create trigger trg_pledge_upd before update on public.pledges
  for each row execute function public.guard_pledge();

alter table public.pledges enable row level security;
drop policy if exists pledges_read on public.pledges;
create policy pledges_read on public.pledges for select to authenticated using (true);
drop policy if exists pledges_write_own on public.pledges;
create policy pledges_write_own on public.pledges for insert to authenticated
  with check (profile_id = auth.uid());
drop policy if exists pledges_update_own on public.pledges;
create policy pledges_update_own on public.pledges for update to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());

do $blk$ begin
  alter publication supabase_realtime add table public.pledges;
exception when duplicate_object then null; end $blk$;

-- ------------------------------------------------------------
-- 6. งานที่ "นับ" ได้จริง
--    อนุมัติแล้ว และไม่เกินโควตาต่อวัน (เรียงตามเวลาที่ส่ง ชิ้นที่เกินไม่นับ)
-- ------------------------------------------------------------
create or replace view public.v_counted as
select s.*, public.week_of(s.day_index) as week_no
from (
  select x.*,
         row_number() over (partition by x.profile_id, x.day_index order by x.created_at) as seq
  from public.submissions x
  where x.status = 'approved'
) s
where s.seq <= (select max_per_day from public.cohort where id = 1);

-- ------------------------------------------------------------
-- 7. ความคืบหน้ารายสัปดาห์
-- ------------------------------------------------------------
create or replace view public.v_week_progress as
select
  pl.profile_id,
  pl.week_no,
  pl.target,
  o.key   as pledge_key,
  o.name  as pledge_name,
  o.style as pledge_style,
  coalesce(cnt.done, 0)                                            as done,
  greatest(0, pl.target - coalesce(cnt.done, 0))                   as remaining,
  round(least(1, coalesce(cnt.done,0)::numeric / pl.target) * 100) as pct,
  (coalesce(cnt.done, 0) >= pl.target)                             as hit,
  (pl.week_no <  public.current_week())                            as finished,
  (pl.week_no =  public.current_week())                            as is_current
from public.pledges pl
join public.pledge_options o on o.target = pl.target
left join lateral (
  select count(*) as done from public.v_counted v
  where v.profile_id = pl.profile_id and v.week_no = pl.week_no
) cnt on true;

-- ------------------------------------------------------------
-- 8. streak รายสัปดาห์ — กี่สัปดาห์ติดกันที่ทำได้ตามที่สัญญาไว้
--    สัปดาห์ที่ไม่ได้ลงสปรินต์ ข้ามไปเฉย ๆ ไม่ตัด streak
--    สัปดาห์ปัจจุบันนับให้ถ้าทำครบแล้ว ถ้ายังไม่ครบก็ยังไม่ตัดสิน
-- ------------------------------------------------------------
create or replace function public.week_streak_of(pid uuid)
returns int language plpgsql stable as $fn$
declare
  cw  int := public.current_week();
  w   int;
  n   int := 0;
  rec record;
begin
  for w in reverse cw..1 loop
    select target, done, hit into rec
    from public.v_week_progress
    where profile_id = pid and week_no = w;

    if not found then
      continue;
    elsif rec.hit then
      n := n + 1;
    elsif w = cw then
      continue;
    else
      exit;
    end if;
  end loop;
  return n;
end $fn$;

-- ------------------------------------------------------------
-- 9. กระดานรายคน — คิดใหม่ทั้งหมดตามระบบชิ้นงาน
--    ระยะทาง = จำนวนชิ้นที่นับได้
--    เป้า     = ผลรวมคำสัญญาของสัปดาห์ที่ผ่านมาแล้วรวมสัปดาห์นี้
--    เส้นชัย  = 84 ชิ้น (7 ชิ้น x 12 สัปดาห์ = เส้นทาง RECOMMENDED)
--               คนเลือก 4 จะไม่ถึงเส้นชัย ซึ่งถูกแล้ว เพราะเขาเลือกเอง
--               คนเลือก 10-14 จะถึงก่อนกำหนดและวิ่งเลยเส้นไปได้
-- ------------------------------------------------------------
drop view if exists public.v_leaderboard cascade;
create view public.v_leaderboard as
with c as (select * from public.cohort where id = 1),
cw as (select public.current_week() as w),
enr as (
  select profile_id,
         array_agg(sprint_idx order by sprint_idx) as joined,
         count(*)                                  as sprints_joined
  from public.enrollments group by profile_id
),
con as (
  select profile_id,
         count(*)                  as contents,
         count(distinct day_index) as active_days,
         max(created_at)           as last_at
  from public.v_counted group by profile_id
),
raw as (
  select profile_id,
         count(*)                                    as submitted,
         count(*) filter (where status = 'pending')  as pending,
         count(*) filter (where status = 'rejected') as rejected,
         round(avg(stars) filter (where status = 'approved' and stars > 0), 2) as craft
  from public.submissions group by profile_id
),
goal as (
  select pl.profile_id,
         sum(pl.target) filter (where pl.week_no <= (select w from cw)) as target_to_date,
         sum(pl.target)                                                 as target_total
  from public.pledges pl group by pl.profile_id
),
wk as (
  select profile_id,
         count(*) filter (where hit and finished) as weeks_hit,
         count(*) filter (where finished)         as weeks_done
  from public.v_week_progress group by profile_id
),
now_pledge as (
  select wp.profile_id, wp.target as week_target, wp.done as week_done,
         wp.pct as week_pct, wp.pledge_key, wp.pledge_name, wp.pledge_style
  from public.v_week_progress wp where wp.is_current
)
select
  p.id, p.name, p.handle, p.color, p.role,
  p.house_id, h.key as house_key, h.name as house_name,
  h.th as house_th, h.color as house_color, h.emoji as house_emoji,
  coalesce(enr.joined, '{}')       as joined,
  coalesce(enr.sprints_joined, 0)  as sprints_joined,
  coalesce(con.contents, 0)        as contents,
  coalesce(con.active_days, 0)     as active_days,
  coalesce(goal.target_to_date, 0) as target_to_date,
  coalesce(goal.target_total, 0)   as target_total,
  coalesce(con.contents, 0) - coalesce(goal.target_to_date, 0) as pace,
  case when coalesce(goal.target_to_date,0) > 0
       then round(coalesce(con.contents,0)::numeric / goal.target_to_date * 100)
       else 0 end                  as rate,
  raw.craft,
  coalesce(raw.submitted, 0)       as submitted,
  coalesce(raw.pending, 0)         as pending,
  coalesce(raw.rejected, 0)        as rejected,
  con.last_at,
  coalesce(wk.weeks_hit, 0)        as weeks_hit,
  coalesce(wk.weeks_done, 0)       as weeks_done,
  np.week_target, np.week_done, np.week_pct,
  np.pledge_key, np.pledge_name,
  coalesce(np.pledge_style, 'normal') as pledge_style,
  public.week_streak_of(p.id)      as week_streak,
  st.streak                        as day_streak,
  st.freeze_left
from public.profiles p
left join public.houses h on h.id = p.house_id
left join enr  on enr.profile_id  = p.id
left join con  on con.profile_id  = p.id
left join raw  on raw.profile_id  = p.id
left join goal on goal.profile_id = p.id
left join wk   on wk.profile_id   = p.id
left join now_pledge np on np.profile_id = p.id
left join lateral public.streak_of(p.id) st on true;

-- ------------------------------------------------------------
-- 10. กระดานห้อง (สร้างใหม่ เพราะโดน cascade ตอน drop v_leaderboard)
-- ------------------------------------------------------------
create or replace view public.v_house_board as
select
  h.id, h.key, h.name, h.th, h.color, h.emoji, h.motto,
  count(l.id) filter (where l.role = 'student')                  as students,
  (select count(*) from public.roster r where r.house_id = h.id) as seats,
  (select count(*) from public.roster r
    where r.house_id = h.id and r.claimed_by is null)            as unclaimed,
  coalesce(round(avg(l.contents) filter (where l.role='student'), 1), 0) as avg_contents,
  coalesce(round(avg(l.rate)     filter (where l.role='student'), 0), 0) as avg_rate,
  coalesce(round(avg(l.craft)    filter (where l.role='student'), 2), 0) as avg_craft,
  coalesce(sum(l.contents)       filter (where l.role='student'), 0)     as total_contents,
  count(*) filter (where l.role='student' and l.pace >= 0)               as on_pace,
  count(*) filter (where l.role='student' and l.pace < -3)               as falling_behind,
  count(*) filter (where l.role='student' and l.pledge_style = 'red')    as laser_this_week,
  count(*) filter (where l.role='student' and l.pledge_style = 'flame')  as promax_this_week,
  coalesce(sum(l.pending)        filter (where l.role='student'), 0)     as pending_reviews
from public.houses h
left join public.v_leaderboard l on l.house_id = h.id
group by h.id, h.key, h.name, h.th, h.color, h.emoji, h.motto
order by avg_rate desc, avg_contents desc;

-- ------------------------------------------------------------
-- 11. คิวตรวจงาน (โดน cascade ไปด้วย สร้างใหม่)
-- ------------------------------------------------------------
create or replace view public.v_review_queue as
select s.id, s.profile_id, p.name, p.handle, p.color,
       p.house_id, h.key as house_key, h.emoji as house_emoji,
       s.platform, s.url, s.day_index, s.sprint_idx,
       public.week_of(s.day_index) as week_no,
       s.flag, s.created_at,
       (select count(*) from public.submissions x
        where x.profile_id = s.profile_id and x.status = 'rejected') as past_rejects,
       round(extract(epoch from (now() - s.created_at))/3600, 1)     as hours_waiting
from public.submissions s
join public.profiles p on p.id = s.profile_id
left join public.houses h on h.id = p.house_id
where s.status = 'pending'
order by s.flag desc, s.created_at asc;

grant select on public.pledge_options, public.pledges, public.v_counted,
                public.v_week_progress, public.v_leaderboard,
                public.v_house_board, public.v_review_queue
             to authenticated;

-- ============================================================
-- คำสั่งที่ใช้ดูแลรุ่น
-- ============================================================
-- ใครยังไม่เลือกคำสัญญาของสัปดาห์นี้ (ต้องไปตาม):
--   select p.name, h.name as house
--   from public.profiles p
--   left join public.houses h on h.id = p.house_id
--   where p.role = 'student'
--     and not exists (select 1 from public.pledges pl
--                     where pl.profile_id = p.id and pl.week_no = public.current_week())
--   order by h.name, p.name;
--
-- สัปดาห์นี้ใครเลือกอะไรบ้าง:
--   select o.name, count(*) from public.pledges pl
--   join public.pledge_options o on o.target = pl.target
--   where pl.week_no = public.current_week()
--   group by o.name order by count(*) desc;
--
-- คนที่รับ PRO MAX แล้วกำลังจะไม่ไหว (เหลือ 2 วันแต่ยังขาดเกิน 5 ชิ้น):
--   select p.name, w.target, w.done, w.remaining
--   from public.v_week_progress w join public.profiles p on p.id = w.profile_id
--   where w.is_current and w.remaining > 5 order by w.remaining desc;
--
-- เปลี่ยนสัปดาห์ที่ปลดล็อก PRO MAX:
--   update public.pledge_options set unlock_week = 7 where target = 14;
--
-- เปลี่ยนโควตาต่อวัน (กันดัมป์งานรวดเดียว):
--   update public.cohort set max_per_day = 4 where id = 1;
