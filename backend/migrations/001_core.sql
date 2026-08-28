-- ============================================================
-- CREATOR BOOTCAMP — โครงสร้างฐานข้อมูล (Supabase / Postgres)
-- วิธีใช้: เปิด Supabase Dashboard > SQL Editor > วางทั้งไฟล์นี้ > RUN
-- รันซ้ำได้ ไม่พัง (ทุกอย่างเป็น create ... if not exists / or replace)
-- ============================================================

-- ------------------------------------------------------------
-- 1. รุ่น (cohort) — มีแถวเดียวต่อหนึ่งรุ่น
-- ------------------------------------------------------------
create table if not exists public.cohort (
  id           int primary key default 1,
  name         text not null default 'Bootcamp รุ่น 1',
  start_date   date not null,                 -- วันแรกของ bootcamp = วันที่ 1
  sprint_days  int  not null default 14,
  sprints      int  not null default 6,
  cutoff_hour  int  not null default 4,        -- ตัดรอบตี 4 เวลาไทย
  freeze_per_sprint int not null default 2,
  constraint cohort_singleton check (id = 1)
);

-- ตั้งวันเริ่มรุ่น: แก้วันที่ตรงนี้ให้เป็นวันแรกจริงของ bootcamp
insert into public.cohort (id, name, start_date)
values (1, 'Bootcamp รุ่น 1', current_date)
on conflict (id) do nothing;

-- ------------------------------------------------------------
-- 2. โปรไฟล์นักเรียน — ผูกกับ auth.users 1:1
-- ------------------------------------------------------------
create table if not exists public.profiles (
  id         uuid primary key references auth.users(id) on delete cascade,
  name       text not null,
  handle     text not null,                    -- @ชื่อที่ใช้โพสต์จริง ใช้ตรวจว่าลิงก์เป็นของเจ้าตัว
  color      text not null default '#ff4d6d',
  role       text not null default 'student',  -- 'student' | 'coach'
  created_at timestamptz not null default now(),
  constraint name_len   check (char_length(name) between 1 and 10),
  constraint handle_fmt check (handle ~ '^@[A-Za-z0-9._-]{2,30}$'),
  constraint role_ok    check (role in ('student','coach'))
);
create unique index if not exists profiles_name_key   on public.profiles (upper(name));
create unique index if not exists profiles_handle_key on public.profiles (lower(handle));

-- ------------------------------------------------------------
-- 3. การลงสปรินต์
-- ------------------------------------------------------------
create table if not exists public.enrollments (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  sprint_idx int  not null,                    -- 0-based
  created_at timestamptz not null default now(),
  primary key (profile_id, sprint_idx)
);

-- ------------------------------------------------------------
-- 4. งานที่ส่ง
-- ------------------------------------------------------------
create table if not exists public.submissions (
  id          bigint generated always as identity primary key,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  url         text not null,
  url_key     text not null,                   -- url ที่ normalize แล้ว ใช้กันส่งซ้ำ
  platform    text not null,
  day_index   int  not null,                   -- วันที่เท่าไหร่ของ bootcamp
  sprint_idx  int  not null,
  status      text not null default 'pending', -- pending | approved | rejected
  stars       int  not null default 0,         -- 0-3 โค้ชให้ตอนตรวจ
  flag        boolean not null default false,  -- ลิงก์ไม่มี handle ของเจ้าตัว
  note        text,
  reviewed_by uuid references public.profiles(id),
  reviewed_at timestamptz,
  created_at  timestamptz not null default now(),
  constraint status_ok check (status in ('pending','approved','rejected')),
  constraint stars_ok  check (stars between 0 and 3)
);

-- กันส่งลิงก์ซ้ำทั้งรุ่น — คนอื่นเอาลิงก์เราไปส่งซ้ำไม่ได้ ตัวเองส่งซ้ำก็ไม่ได้
create unique index if not exists submissions_url_key on public.submissions (url_key);
create index if not exists submissions_profile_idx on public.submissions (profile_id, day_index);
create index if not exists submissions_status_idx  on public.submissions (status) where status = 'pending';

-- ------------------------------------------------------------
-- 5. ฟังก์ชันช่วย
-- ------------------------------------------------------------

-- วันที่เท่าไหร่ของ bootcamp โดยตัดรอบตาม cutoff_hour เวลาไทย
create or replace function public.day_of(ts timestamptz)
returns int language sql stable as $$
  select greatest(1,
    ( ((ts at time zone 'Asia/Bangkok') - make_interval(hours => c.cutoff_hour))::date
      - c.start_date ) + 1)
  from public.cohort c where c.id = 1;
$$;

-- ล้าง url ให้เทียบกันได้: ตัด query string, ตัด / ท้าย, ตัด www., เป็นตัวเล็ก
create or replace function public.norm_url(u text)
returns text language sql immutable as $$
  select regexp_replace(
           regexp_replace(
             regexp_replace(lower(trim(u)), '[?#].*$', ''),
           '^https?://(www\.)?', ''),
         '/+$', '');
$$;

create or replace function public.is_coach()
returns boolean language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.profiles where id = auth.uid() and role = 'coach');
$$;

-- ------------------------------------------------------------
-- 6. Trigger ตอนส่งงาน — คำนวณฝั่งเซิร์ฟเวอร์ทั้งหมด
--    นักเรียนแก้ day_index / status / stars เองไม่ได้
-- ------------------------------------------------------------
create or replace function public.on_submission_insert()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c public.cohort%rowtype;
  h text;
begin
  select * into c from public.cohort where id = 1;

  new.created_at := now();
  new.day_index  := public.day_of(new.created_at);
  new.sprint_idx := (new.day_index - 1) / c.sprint_days;
  new.url_key    := public.norm_url(new.url);
  new.status     := 'pending';     -- ส่งมาต้องรอตรวจเสมอ
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

  -- ธงแดงอัตโนมัติเมื่อลิงก์ไม่มี handle ที่ลงทะเบียนไว้
  select lower(replace(p.handle, '@', '')) into h from public.profiles p where p.id = new.profile_id;
  new.flag := (h is not null and position(h in new.url_key) = 0);

  return new;
end $$;

drop trigger if exists trg_submission_insert on public.submissions;
create trigger trg_submission_insert
  before insert on public.submissions
  for each row execute function public.on_submission_insert();

-- ตอนโค้ชตรวจ: บันทึกว่าใครตรวจ เมื่อไหร่ และห้ามแก้ข้อมูลดิบของงาน
create or replace function public.on_submission_review()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not public.is_coach() then
    raise exception 'เฉพาะโค้ชเท่านั้นที่ตรวจงานได้';
  end if;
  new.profile_id := old.profile_id;
  new.url        := old.url;
  new.url_key    := old.url_key;
  new.day_index  := old.day_index;
  new.sprint_idx := old.sprint_idx;
  new.created_at := old.created_at;
  new.reviewed_by := auth.uid();
  new.reviewed_at := now();
  if new.status = 'rejected' then new.stars := 0; end if;
  return new;
end $$;

drop trigger if exists trg_submission_review on public.submissions;
create trigger trg_submission_review
  before update on public.submissions
  for each row execute function public.on_submission_review();

-- ห้ามแก้การลงสปรินต์ที่เริ่มไปแล้ว
create or replace function public.guard_enrollment()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  c public.cohort%rowtype;
  cur int;
  target int;
begin
  select * into c from public.cohort where id = 1;
  cur := (public.day_of(now()) - 1) / c.sprint_days;
  target := coalesce(new.sprint_idx, old.sprint_idx);
  if target <= cur then
    raise exception 'สปรินต์ % เริ่มไปแล้ว แก้ไม่ได้', target + 1;
  end if;
  return coalesce(new, old);
end $$;

drop trigger if exists trg_enrollment_ins on public.enrollments;
create trigger trg_enrollment_ins before insert on public.enrollments
  for each row when (pg_trigger_depth() = 0) execute function public.guard_enrollment();
drop trigger if exists trg_enrollment_del on public.enrollments;
create trigger trg_enrollment_del before delete on public.enrollments
  for each row execute function public.guard_enrollment();

-- ------------------------------------------------------------
-- 7. Row Level Security
-- ------------------------------------------------------------
alter table public.cohort      enable row level security;
alter table public.profiles    enable row level security;
alter table public.enrollments enable row level security;
alter table public.submissions enable row level security;

drop policy if exists cohort_read on public.cohort;
create policy cohort_read on public.cohort for select to authenticated using (true);

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated using (true);
drop policy if exists profiles_insert_own on public.profiles;
create policy profiles_insert_own on public.profiles for insert to authenticated
  with check (id = auth.uid() and role = 'student');
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid() and role = (select role from public.profiles where id = auth.uid()));

drop policy if exists enroll_read on public.enrollments;
create policy enroll_read on public.enrollments for select to authenticated using (true);
drop policy if exists enroll_write_own on public.enrollments;
create policy enroll_write_own on public.enrollments for insert to authenticated
  with check (profile_id = auth.uid());
drop policy if exists enroll_del_own on public.enrollments;
create policy enroll_del_own on public.enrollments for delete to authenticated
  using (profile_id = auth.uid());

drop policy if exists subs_read on public.submissions;
create policy subs_read on public.submissions for select to authenticated using (true);
drop policy if exists subs_insert_own on public.submissions;
create policy subs_insert_own on public.submissions for insert to authenticated
  with check (profile_id = auth.uid());
drop policy if exists subs_review_coach on public.submissions;
create policy subs_review_coach on public.submissions for update to authenticated
  using (public.is_coach()) with check (public.is_coach());
-- ไม่มี policy delete = ลบไม่ได้ทั้งนักเรียนและโค้ช (ตีกลับใช้ status='rejected' แทน)

-- ------------------------------------------------------------
-- 8. เปิด Realtime — ทุกคนเห็นตัวละครขยับพร้อมกัน
-- ------------------------------------------------------------
do $$ begin
  alter publication supabase_realtime add table public.submissions;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.profiles;
exception when duplicate_object then null; end $$;
do $$ begin
  alter publication supabase_realtime add table public.enrollments;
exception when duplicate_object then null; end $$;

-- ============================================================
-- คำสั่งที่ต้องใช้ตอนดูแลรุ่น (รันใน SQL Editor เมื่อจำเป็น)
-- ============================================================
-- ตั้งวันเริ่มรุ่นใหม่:
--   update public.cohort set start_date = '2026-09-01' where id = 1;
--
-- ตั้งให้ใครเป็นโค้ช (ต้องให้เขาสมัครเข้ามาก่อน):
--   update public.profiles set role = 'coach' where name = 'BENZ';
--
-- ดูงานที่ค้างตรวจ:
--   select p.name, s.day_index, s.url, s.flag
--   from public.submissions s join public.profiles p on p.id = s.profile_id
--   where s.status = 'pending' order by s.created_at;
--
-- สรุปผลรายคน:
--   select p.name,
--          count(distinct s.day_index) filter (where s.status='approved') as days,
--          round(avg(s.stars) filter (where s.status='approved' and s.stars>0),2) as craft,
--          count(*) as submitted
--   from public.profiles p left join public.submissions s on s.profile_id = p.id
--   group by p.name order by days desc;
