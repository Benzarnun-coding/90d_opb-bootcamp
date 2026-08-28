-- ============================================================
-- ตั้งวันเปิดรุ่นจริง + กันการส่งงานก่อนรุ่นเริ่ม
--
-- ปัญหา: day_of() ใช้ greatest(1, ...) เพื่อกันค่าติดลบ
--        ผลคือช่วงก่อนถึง start_date ระบบจะตอบว่าเป็น "วันที่ 1"
--        ใครได้ลิงก์ไปก่อนแล้วส่งงาน จะถูกนับเป็นผลงานวันแรกทั้งที่ยังไม่เปิดรุ่น
--
-- รันหลัง 001-006
-- ============================================================

update public.cohort
   set start_date = '2026-09-02',
       name       = '90 Day One Person Business Bootcamp'
 where id = 1;

-- ------------------------------------------------------------
-- รุ่นเริ่มหรือยัง
-- ------------------------------------------------------------
create or replace function public.has_started()
returns boolean language sql stable as $fn$
  select ((now() at time zone 'Asia/Bangkok') - make_interval(hours => c.cutoff_hour))::date
         >= c.start_date
  from public.cohort c where c.id = 1;
$fn$;

-- ------------------------------------------------------------
-- ส่งงานก่อนรุ่นเริ่มไม่ได้
-- ------------------------------------------------------------
create or replace function public.on_submission_insert()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  c public.cohort%rowtype;
  h text;
begin
  select * into c from public.cohort where id = 1;

  if not public.has_started() then
    raise exception 'รุ่นยังไม่เริ่ม เปิดวันที่ % (เวลาไทย)', to_char(c.start_date, 'DD Mon YYYY');
  end if;

  new.created_at := now();
  new.day_index  := public.day_of(new.created_at);
  new.sprint_idx := (new.day_index - 1) / c.sprint_days;
  new.url_key    := public.norm_url(new.url);
  new.status     := 'approved';
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

  select lower(replace(p.handle, '@', '')) into h from public.profiles p where p.id = new.profile_id;
  new.flag := (h is not null and position(h in new.url_key) = 0);

  return new;
end $fn$;

-- ------------------------------------------------------------
-- ให้หน้าเว็บถามได้ว่ารุ่นเริ่มหรือยัง และเหลืออีกกี่วัน
-- ------------------------------------------------------------
create or replace function public.cohort_status()
returns table (started boolean, start_date date, days_until int, day_index int, week_no int)
language sql stable as $fn$
  select public.has_started(),
         c.start_date,
         greatest(0, (c.start_date - ((now() at time zone 'Asia/Bangkok')
                                      - make_interval(hours => c.cutoff_hour))::date))::int,
         public.day_of(now()),
         public.current_week()
  from public.cohort c where c.id = 1;
$fn$;

select * from public.cohort_status();
