-- ============================================================
-- 1) เส้นตัดสัปดาห์ = พุธ 19:30 เวลาไทย (เวลาไลฟ์) แทนตี 4 ของวันพุธ
--    - วัน/streak ยังตัดตี 4 เหมือนเดิม (day_of)
--    - "สัปดาห์" ของงาน/เป้า/King/ถ้วย คิดจากเวลาที่ส่ง (week_of_ts) แทน day_index
-- 2) สัปดาห์ปิดเทอม (vacation_week = 7 → 14–20 ต.ค. 2026)
--    - ไม่ต้องเลือกเป้า · พลาดไม่โดนร่างกระโหลก/หมดแรง · streak ไม่ขาด · ไม่แจ้งเตือน
--    - ส่งงานได้ นับรวมยอด (โบนัส)
-- รันหลัง 001-027
-- ============================================================
alter table public.cohort add column if not exists week_cut_time time not null default '19:30';
alter table public.cohort add column if not exists vacation_week int;
update public.cohort set vacation_week = 7, week_cut_time = '19:30' where id = 1;

-- เส้นตัดของสัปดาห์ w (timestamptz): start_date + 7*w วัน เวลา week_cut_time ไทย
create or replace function public.week_end_at(w int)
returns timestamptz language sql stable as $fn$
  select ((c.start_date + 7 * w)::timestamp + c.week_cut_time) at time zone 'Asia/Bangkok'
  from public.cohort c where c.id = 1;
$fn$;

create or replace function public.week_of_ts(ts timestamptz)
returns int language sql stable as $fn$
  select greatest(1, 2 + floor(extract(epoch from (ts - public.week_end_at(1))) / (7 * 86400))::int);
$fn$;

create or replace function public.current_week()
returns int language sql stable as $fn$
  select public.week_of_ts(now());
$fn$;

create or replace function public.is_vacation()
returns boolean language sql stable as $fn$
  select public.current_week() = coalesce((select vacation_week from public.cohort where id = 1), -1);
$fn$;

-- งานที่นับ: สัปดาห์คิดจากเวลาที่ส่ง
-- หมายเหตุ: ต้องระบุคอลัมน์ให้ตรงกับ view เดิม (CREATE OR REPLACE ห้ามเปลี่ยนลำดับคอลัมน์ — submissions มีคอลัมน์ใหม่จาก 027)
create or replace view public.v_counted as
select s.id, s.profile_id, s.url, s.url_key, s.platform, s.day_index, s.sprint_idx, s.status, s.stars, s.flag, s.note, s.reviewed_by, s.reviewed_at, s.created_at, s.seq,
       public.week_of_ts(s.created_at) as week_no
from (
  select x.*,
         row_number() over (partition by x.profile_id, x.day_index order by x.created_at) as seq
  from public.submissions x
  where x.status = 'approved'
) s
where (select max_per_day from public.cohort where id = 1) = 0
   or s.seq <= (select max_per_day from public.cohort where id = 1);

-- ร่างกระโหลก / หมดแรง: ไม่ลงโทษผลของสัปดาห์ปิดเทอม
create or replace view public.v_burnout as
select wp.profile_id, wp.target as failed_target, wp.done as failed_done, wp.week_no as failed_week
from public.v_week_progress wp, public.cohort c
where c.id = 1
  and wp.week_no = public.current_week() - 1
  and wp.week_no <> coalesce(c.vacation_week, -1)
  and wp.target >= c.heavy_target
  and not wp.hit;

create or replace view public.v_weak as
select wp.profile_id, wp.target as failed_target, wp.done as failed_done, wp.week_no as failed_week
from public.v_week_progress wp, public.cohort c
where c.id = 1
  and wp.week_no = public.current_week() - 1
  and wp.week_no <> coalesce(c.vacation_week, -1)
  and wp.target < c.heavy_target
  and not wp.hit;

-- streak รายวัน: วันในสัปดาห์ปิดเทอมไม่นับและไม่ตัด
create or replace function public.streak_of(pid uuid)
returns table (streak int, freeze_left int) language plpgsql stable as $$
declare
  c public.cohort%rowtype;
  today int; d int; sp int;
  used jsonb := '{}'::jsonb;
  budget int; st int := 0; cur_sp int;
begin
  select * into c from public.cohort where id = 1;
  today := public.day_of(now());
  cur_sp := (today - 1) / c.sprint_days;
  for d in 1..today loop
    sp := (d - 1) / c.sprint_days;
    if not exists (select 1 from public.enrollments e where e.profile_id = pid and e.sprint_idx = sp) then continue; end if;
    if c.vacation_week is not null and public.week_of(d) = c.vacation_week then continue; end if;   -- ปิดเทอม
    if exists (select 1 from public.submissions s where s.profile_id = pid and s.day_index = d and s.status = 'approved') then
      st := st + 1;
    else
      budget := coalesce((used ->> sp::text)::int, 0);
      if budget < c.freeze_per_sprint then
        used := used || jsonb_build_object(sp::text, budget + 1);
      else
        st := 0;
      end if;
    end if;
  end loop;
  streak := st;
  freeze_left := c.freeze_per_sprint - coalesce((used ->> cur_sp::text)::int, 0);
  return next;
end $$;

-- แจ้งเตือน: เงียบช่วงปิดเทอม
create or replace view public.v_needs_pledge as
select p.id, p.name, h.name as house_name, h.emoji as house_emoji
from public.profiles p
left join public.houses h on h.id = p.house_id
where p.role = 'student'
  and not public.is_vacation()
  and exists (select 1 from public.enrollments e
              where e.profile_id = p.id and e.sprint_idx = public.sprint_of_week(public.current_week()))
  and not exists (select 1 from public.pledges pl
                  where pl.profile_id = p.id and pl.week_no = public.current_week());

create or replace view public.v_needs_nudge as
select
  p.id, p.name, p.handle, h.name as house_name, h.emoji as house_emoji,
  l.week_target, l.week_done,
  greatest(0, coalesce(l.week_target,0) - coalesce(l.week_done,0)) as remaining,
  l.pace,
  (7 - (public.day_of(now()) - (public.current_week()-1)*7 - 1)) as days_left_in_week
from public.profiles p
join public.v_leaderboard l on l.id = p.id
left join public.houses h on h.id = p.house_id
where p.role = 'student'
  and not public.is_vacation()
  and exists (select 1 from public.enrollments e
              where e.profile_id = p.id
                and e.sprint_idx = (public.day_of(now())-1)/(select sprint_days from public.cohort where id=1))
  and not exists (select 1 from public.submissions s
                  where s.profile_id = p.id and s.day_index = public.day_of(now()) and s.status = 'approved');

-- Discord ต้นสัปดาห์: ถ้าเป็นสัปดาห์ปิดเทอมส่งข้อความปิดเทอมแทน (ยิงเมื่อวันแรกของสัปดาห์ตามวัน)
create or replace function public.send_week_start()
returns void language plpgsql security definer set search_path = public as $fn$
declare cw int; t text; vw int;
begin
  if not public.has_started() then return; end if;
  if (public.day_of(now()) - 1) % 7 <> 0 then return; end if;
  cw := public.week_of(public.day_of(now()));
  select vacation_week into vw from public.cohort where id = 1;
  if cw = vw then
    t := '🏖 **สัปดาห์นี้ปิดเทอม** ไม่ต้องเลือกเป้า streak ไม่ขาด ใครอยากส่งก็ส่งได้ (นับรวมยอด)' || E'\n' || 'เจอกันสัปดาห์หน้า พุธ 19:30';
  else
    t := '📅 **สัปดาห์ที่ ' || cw || ' เริ่มแล้ว**' || E'\n'
      || 'เข้าไปเลือกเป้าของสัปดาห์นี้ 4 / 7 / 10 ชิ้น'
      || case when cw >= 7 then E'\nสัปดาห์นี้ PRO MAX 14 ชิ้นเปิดแล้ว 🔥' else '' end
      || E'\nส่งงานสัปดาห์นี้ให้ทันก่อนไลฟ์ พุธ 19:30 · https://opb-bootcamp.netlify.app';
  end if;
  perform public.notify_discord(t);
end $fn$;

-- กลุ่มเสี่ยง: ช่วงปิดเทอมไม่นับ "เงียบ" และไม่บังคับเลือกเป้า
create or replace view public.v_at_risk as
with base as (
  select p.id, p.name, p.handle, p.house_id, l.contents, l.day_streak, l.week_target, l.week_done, l.last_at,
         (select max(s.day_index) from public.submissions s where s.profile_id = p.id and s.status = 'approved') as last_day,
         (not public.is_vacation()) and not exists (select 1 from public.pledges pl where pl.profile_id = p.id and pl.week_no = public.current_week()) as no_pledge,
         exists (select 1 from public.v_burnout b where b.profile_id = p.id) as burnout,
         exists (select 1 from public.v_weak w where w.profile_id = p.id) as weak
  from public.profiles p
  join public.v_leaderboard l on l.id = p.id
  where p.role = 'student'
)
select b.*, h.name as house_name, h.emoji as house_emoji,
       case when b.last_day is null then public.day_of(now()) else public.day_of(now()) - b.last_day end as days_silent,
       case when b.contents = 0 then 'never'
            when public.is_vacation() then 'ok'
            when public.day_of(now()) - b.last_day >= 3 then 'silent3'
            when public.day_of(now()) - b.last_day = 2 then 'silent2'
            when b.burnout then 'burnout'
            when b.weak then 'weak'
            when b.no_pledge then 'nopledge'
            else 'ok' end as risk
from base b
left join public.houses h on h.id = b.house_id;

-- cohort_status: บอกเส้นตัดสัปดาห์และสัปดาห์ปิดเทอมให้หน้าเว็บ
drop function if exists public.cohort_status();
create function public.cohort_status()
returns table (started boolean, start_date date, days_until int, day_index int,
               week_no int, total_days int, sprint_days_total int, overtime boolean,
               week_ends_at timestamptz, week_cut_time text, vacation_week int, is_vacation boolean)
language sql stable as $fn$
  select public.has_started(),
         c.start_date,
         greatest(0, (c.start_date - ((now() at time zone 'Asia/Bangkok') - make_interval(hours => c.cutoff_hour))::date))::int,
         public.day_of(now()),
         public.current_week(),
         c.total_days,
         c.sprints * c.sprint_days,
         public.in_overtime(),
         public.week_end_at(public.current_week()),
         to_char(c.week_cut_time, 'HH24:MI'),
         c.vacation_week,
         public.is_vacation()
  from public.cohort c where c.id = 1;
$fn$;
grant execute on function public.cohort_status() to anon, authenticated;
grant execute on function public.week_end_at(int) to anon, authenticated;
grant execute on function public.week_of_ts(timestamptz) to anon, authenticated;
grant execute on function public.is_vacation() to anon, authenticated;

select public.current_week() as week_now, public.week_end_at(public.current_week()) at time zone 'Asia/Bangkok' as week_ends_th, public.is_vacation() as vacation_now;
