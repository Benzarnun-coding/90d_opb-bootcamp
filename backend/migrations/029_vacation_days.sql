-- ============================================================
-- ปิดเทอมนับเป็น "วัน" 14–20 ต.ค. (วันที่ 43–49): ส่งถึง 13 ต.ค. · กลับมาส่ง 21 ต.ค.
-- ส่งช่วงปิดเทอมได้ = "ขยันวันหยุด" (meme) นับรวมยอด
-- สัปดาห์ที่ 7 (ตามเส้นตัด พุธ 19:30) ไม่ต้องเลือกเป้าและไม่โดนลงโทษ
-- รันหลัง 028
-- ============================================================
alter table public.cohort add column if not exists vacation_from_day int;
alter table public.cohort add column if not exists vacation_to_day   int;
update public.cohort set vacation_from_day = 43, vacation_to_day = 49, vacation_week = 7 where id = 1;

-- วันนี้เป็นวันปิดเทอมไหม (ตามวัน ตัดตี 4)
create or replace function public.is_vacation_day(d int default null)
returns boolean language sql stable as $fn$
  select coalesce(d, public.day_of(now())) between c.vacation_from_day and c.vacation_to_day
  from public.cohort c where c.id = 1;
$fn$;
-- ช่วงยกเว้นเรื่องเป้าสัปดาห์: วันปิดเทอม หรือยังอยู่ในสัปดาห์ปิดเทอมตามเส้นตัด
create or replace function public.is_vacation()
returns boolean language sql stable as $fn$
  select public.is_vacation_day()
      or public.current_week() = coalesce((select vacation_week from public.cohort where id = 1), -1);
$fn$;
grant execute on function public.is_vacation_day(int) to anon, authenticated;

-- streak: ข้ามเฉพาะวันปิดเทอม (ตามวัน)
create or replace function public.streak_of(pid uuid)
returns table (streak int, freeze_left int) language plpgsql stable as $$
declare c public.cohort%rowtype; today int; d int; sp int; used jsonb := '{}'::jsonb; budget int; st int := 0; cur_sp int;
begin
  select * into c from public.cohort where id = 1;
  today := public.day_of(now()); cur_sp := (today - 1) / c.sprint_days;
  for d in 1..today loop
    sp := (d - 1) / c.sprint_days;
    if not exists (select 1 from public.enrollments e where e.profile_id = pid and e.sprint_idx = sp) then continue; end if;
    if c.vacation_from_day is not null and d between c.vacation_from_day and c.vacation_to_day then continue; end if;
    if exists (select 1 from public.submissions s where s.profile_id = pid and s.day_index = d and s.status = 'approved') then st := st + 1;
    else budget := coalesce((used ->> sp::text)::int, 0);
      if budget < c.freeze_per_sprint then used := used || jsonb_build_object(sp::text, budget + 1); else st := 0; end if;
    end if;
  end loop;
  streak := st; freeze_left := c.freeze_per_sprint - coalesce((used ->> cur_sp::text)::int, 0); return next;
end $$;

-- v_feed: ป้าย "ขยันวันหยุด"
create or replace view public.v_feed as
select s.id, s.profile_id, p.name, p.color, s.platform, s.url,
       s.day_index, s.sprint_idx, s.status, s.stars, s.flag, s.created_at,
       s.kind, s.views, s.likes, s.note,
       exists (select 1 from public.kudos k where k.submission_id = s.id) as kudos,
       public.is_vacation_day(s.day_index) as vacation
from public.submissions s
join public.profiles p on p.id = s.profile_id
order by s.created_at desc;

-- ใครส่งช่วงปิดเทอมบ้าง (ป้าย HOLIDAY GRINDER)
create or replace view public.v_holiday_grinders as
select s.profile_id, count(*) as n
from public.submissions s
where s.status = 'approved' and public.is_vacation_day(s.day_index)
group by s.profile_id;
grant select on public.v_holiday_grinders to anon, authenticated;

-- cohort_status: is_vacation = ตามวัน (ไว้โชว์ป้าย) + ช่วงวัน
drop function if exists public.cohort_status();
create function public.cohort_status()
returns table (started boolean, start_date date, days_until int, day_index int, week_no int, total_days int, sprint_days_total int, overtime boolean,
               week_ends_at timestamptz, week_cut_time text, vacation_week int, is_vacation boolean, vacation_from_day int, vacation_to_day int)
language sql stable as $fn$
  select public.has_started(), c.start_date,
         greatest(0, (c.start_date - ((now() at time zone 'Asia/Bangkok') - make_interval(hours => c.cutoff_hour))::date))::int,
         public.day_of(now()), public.current_week(), c.total_days, c.sprints * c.sprint_days, public.in_overtime(),
         public.week_end_at(public.current_week()), to_char(c.week_cut_time, 'HH24:MI'), c.vacation_week, public.is_vacation_day(),
         c.vacation_from_day, c.vacation_to_day
  from public.cohort c where c.id = 1;
$fn$;
grant execute on function public.cohort_status() to anon, authenticated;

select public.is_vacation_day() as vac_today, public.is_vacation_day(43) as d43, public.is_vacation_day(50) as d50;
