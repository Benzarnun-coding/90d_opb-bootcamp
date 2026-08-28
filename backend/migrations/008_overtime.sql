-- ============================================================
-- ต่อเวลา 6 วัน — ให้ครบ 90 วันตามชื่อคลาส
--
-- โครงสร้าง 6 สปรินต์ x 14 วัน = 84 วัน จบที่วันที่ 84
-- แล้วเปิดต่อเวลาวันที่ 85-90 อีก 6 วัน ส่งงานได้เหมือนเดิม
-- แต่ไม่มีเป้ารายสัปดาห์แล้ว เป็นช่วงเก็บตกให้ถึงเป้า 90 ชิ้น
--
-- รันหลัง 001-007
-- ============================================================

alter table public.cohort add column if not exists total_days int not null default 90;
update public.cohort set total_days = 90 where id = 1;

comment on column public.cohort.total_days is
  'ความยาวรุ่นทั้งหมด (วัน) — ยาวกว่า sprints * sprint_days ได้ ส่วนที่เกินคือช่วงต่อเวลา';

-- ------------------------------------------------------------
-- ตอนนี้อยู่ในช่วงต่อเวลาหรือยัง
-- ------------------------------------------------------------
create or replace function public.in_overtime()
returns boolean language sql stable as $fn$
  select public.day_of(now()) > c.sprints * c.sprint_days
  from public.cohort c where c.id = 1;
$fn$;

-- ------------------------------------------------------------
-- ส่งงานได้ถึงวันที่ 90
--   * วันที่ 1-84  ต้องลงสปรินต์ของวันนั้น
--   * วันที่ 85-90 ขอแค่เคยลงสปรินต์ไหนสักอัน
--   * sprint_idx ของช่วงต่อเวลาปัดเข้าเป็นสปรินต์สุดท้าย
--     เพื่อให้ view ที่จัดกลุ่มตามสปรินต์ยังทำงานได้เหมือนเดิม
-- ------------------------------------------------------------
create or replace function public.on_submission_insert()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  c        public.cohort%rowtype;
  h        text;
  last_day int;
  overtime boolean;
begin
  select * into c from public.cohort where id = 1;
  last_day := c.sprints * c.sprint_days;

  if not public.has_started() then
    raise exception 'รุ่นยังไม่เริ่ม เปิดวันที่ % (เวลาไทย)', to_char(c.start_date, 'DD Mon YYYY');
  end if;

  new.created_at := now();
  new.day_index  := public.day_of(new.created_at);
  overtime       := new.day_index > last_day;
  new.sprint_idx := least((new.day_index - 1) / c.sprint_days, c.sprints - 1);
  new.url_key    := public.norm_url(new.url);
  new.status     := 'approved';
  new.stars      := 0;
  new.reviewed_by := null;
  new.reviewed_at := null;

  if new.day_index > c.total_days then
    raise exception 'จบหลักสูตรแล้ว (ครบ % วัน)', c.total_days;
  end if;

  if overtime then
    if not exists (select 1 from public.enrollments e where e.profile_id = new.profile_id) then
      raise exception 'ไม่ได้ลงสปรินต์ไหนเลยในรุ่นนี้';
    end if;
  else
    if not exists (select 1 from public.enrollments e
                   where e.profile_id = new.profile_id and e.sprint_idx = new.sprint_idx) then
      raise exception 'ไม่ได้ลงสปรินต์ %', new.sprint_idx + 1;
    end if;
  end if;

  select lower(replace(p.handle, '@', '')) into h from public.profiles p where p.id = new.profile_id;
  new.flag := (h is not null and position(h in new.url_key) = 0);

  return new;
end $fn$;

-- ------------------------------------------------------------
-- บอกหน้าเว็บเพิ่มว่าอยู่ช่วงต่อเวลาไหม และรุ่นยาวกี่วัน
-- ------------------------------------------------------------
-- create or replace เปลี่ยน return type ไม่ได้ ต้อง drop ก่อน
drop function if exists public.cohort_status();
create function public.cohort_status()
returns table (started boolean, start_date date, days_until int, day_index int,
               week_no int, total_days int, sprint_days_total int, overtime boolean)
language sql stable as $fn$
  select public.has_started(),
         c.start_date,
         greatest(0, (c.start_date - ((now() at time zone 'Asia/Bangkok')
                                      - make_interval(hours => c.cutoff_hour))::date))::int,
         public.day_of(now()),
         public.current_week(),
         c.total_days,
         c.sprints * c.sprint_days,
         public.in_overtime()
  from public.cohort c where c.id = 1;
$fn$;

select * from public.cohort_status();
