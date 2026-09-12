-- ============================================================
-- 🎯 โฟกัสแพลตฟอร์มตามบ้าน
--    WISDOM   = เลือกได้ 1 แพลตฟอร์ม
--    COURAGE  = เลือกได้ 2 แพลตฟอร์ม
--    JUSTICE / DISCIPLINE / TA / หัวหน้าโค้ช = ไม่จำกัด
--    นักเรียนเลือกตอนรับเป้าประจำสัปดาห์ · ส่งงานได้เฉพาะแพลตฟอร์มที่เลือกไว้
--    ไม่ได้เลือก = ยังไม่ล็อก (ระบบไม่บล็อกใครทิ้งไว้กลางทาง) และสืบทอดจากสัปดาห์ก่อนอัตโนมัติ
-- รันหลัง 036
-- ============================================================
alter table public.houses  add column if not exists platform_limit smallint;
alter table public.pledges add column if not exists platforms text[];
comment on column public.houses.platform_limit is 'จำนวนแพลตฟอร์มที่นักเรียนบ้านนี้เลือกได้ · null = ไม่จำกัด';
comment on column public.pledges.platforms is 'แพลตฟอร์มที่เลือกไว้ของสัปดาห์นั้น · null = ไม่จำกัด';

update public.houses set platform_limit = case name when 'WISDOM' then 1 when 'COURAGE' then 2 else null end;

-- เริ่มบังคับตั้งแต่สัปดาห์ไหน (null = ทันที) · ตั้ง 3 = หลังตัดรอบพุธ 16 ก.ย. 19:30 สัปดาห์ที่ 2 ยังส่งได้ทุกแพลตฟอร์ม
alter table public.cohort add column if not exists platform_from_week int;
comment on column public.cohort.platform_from_week is 'สัปดาห์แรกที่บังคับจำกัดแพลตฟอร์ม · null = ทันที';
update public.cohort set platform_from_week = 3 where id = 1;

-- ลิมิตของคนนี้ (null = ไม่จำกัด · TA กับหัวหน้าโค้ชไม่จำกัดเสมอ · ก่อนสัปดาห์เริ่มบังคับไม่จำกัดทุกคน)
create or replace function public.platform_limit_of(pid uuid)
returns smallint language sql stable as $fn$
  select case when p.role <> 'student' then null
              when c.platform_from_week is not null and public.current_week() < c.platform_from_week then null
              else h.platform_limit end
  from public.profiles p
  left join public.houses h on h.id = p.house_id
  cross join (select platform_from_week from public.cohort where id = 1) c
  where p.id = pid;
$fn$;
grant execute on function public.platform_limit_of(uuid) to anon, authenticated;

-- แพลตฟอร์มที่เลือกไว้: ของสัปดาห์นั้น ถ้ายังไม่เลือกใช้ของสัปดาห์ล่าสุดที่เคยเลือก
create or replace function public.platforms_of(pid uuid, wk int default null)
returns text[] language sql stable as $fn$
  select pl.platforms from public.pledges pl
  where pl.profile_id = pid and pl.platforms is not null
    and pl.week_no <= coalesce(wk, public.current_week())
  order by pl.week_no desc limit 1;
$fn$;
grant execute on function public.platforms_of(uuid, int) to anon, authenticated;

-- ตอนรับเป้า: ตรวจจำนวนแพลตฟอร์ม และสืบทอดของเดิมถ้าไม่ได้ส่งมา
create or replace function public.guard_pledge_platforms()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare lim smallint;
begin
  lim := public.platform_limit_of(new.profile_id);
  if lim is null then
    new.platforms := null;                                   -- บ้านไม่จำกัด ไม่ต้องเก็บ
    return new;
  end if;
  if new.platforms is null or array_length(new.platforms, 1) is null then
    -- ไม่ได้ส่งมา (เช่นกดเพิ่มเป้าทีหลัง) → ใช้ของเดิมไว้ก่อน ไม่ล้างทิ้ง
    new.platforms := case when TG_OP = 'UPDATE' then old.platforms else public.platforms_of(new.profile_id, new.week_no) end;
    return new;
  end if;
  new.platforms := (select array_agg(distinct x) from unnest(new.platforms) as x where x is not null and x <> '');
  if array_length(new.platforms, 1) > lim then
    raise exception 'บ้านคุณเลือกได้ไม่เกิน % แพลตฟอร์ม (เลือกมา % อัน)', lim, array_length(new.platforms, 1);
  end if;
  return new;
end $fn$;
drop trigger if exists trg_pledge_platforms on public.pledges;
create trigger trg_pledge_platforms before insert or update on public.pledges
  for each row execute function public.guard_pledge_platforms();

-- ตอนส่งงาน: ต้องเป็นแพลตฟอร์มที่เลือกไว้ (TA/หัวหน้าโค้ชแก้ให้ทีหลังได้)
create or replace function public.guard_platform_choice()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare lim smallint; ps text[];
begin
  if TG_OP = 'UPDATE' and (public.is_ta() or public.is_head_coach()) then return new; end if;
  lim := public.platform_limit_of(new.profile_id);
  if lim is null then return new; end if;
  ps := public.platforms_of(new.profile_id, null);
  if ps is null or array_length(ps, 1) is null then return new; end if;   -- ยังไม่ได้เลือก ไม่บล็อก
  if not (new.platform = any(ps)) then
    raise exception 'สัปดาห์นี้บ้านคุณโฟกัส % · ส่งได้เฉพาะ %', new.platform, array_to_string(ps, ' หรือ ');
  end if;
  return new;
end $fn$;
drop trigger if exists trg_submission_platform on public.submissions;
create trigger trg_submission_platform before insert or update of platform on public.submissions
  for each row execute function public.guard_platform_choice();

-- บอกหน้าเว็บว่าคนที่ล็อกอินอยู่ถูกจำกัดกี่แพลตฟอร์ม และเลือกอะไรไว้
drop function if exists public.cohort_status();
create function public.cohort_status()
returns table (started boolean, start_date date, days_until int, day_index int, week_no int, total_days int,
               sprint_days_total int, overtime boolean, week_ends_at timestamptz, week_cut_time text,
               vacation_week int, is_vacation boolean, vacation_from_day int, vacation_to_day int,
               plat_limit int, plat_pick text[])
language sql stable as $fn$
  select public.has_started(), c.start_date,
         greatest(0, (c.start_date - ((now() at time zone 'Asia/Bangkok') - make_interval(hours => c.cutoff_hour))::date))::int,
         public.day_of(now()), public.current_week(), c.total_days, c.sprints * c.sprint_days, public.in_overtime(),
         public.week_end_at(public.current_week()), to_char(c.week_cut_time, 'HH24:MI'), c.vacation_week, public.is_vacation_day(),
         c.vacation_from_day, c.vacation_to_day,
         public.platform_limit_of(auth.uid())::int, public.platforms_of(auth.uid(), null)
  from public.cohort c where c.id = 1;
$fn$;
grant execute on function public.cohort_status() to anon, authenticated;

select h.name, h.platform_limit from public.houses h order by h.id;
