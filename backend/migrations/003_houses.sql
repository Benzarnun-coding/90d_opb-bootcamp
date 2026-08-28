-- ============================================================
-- PHASE 3a — แบ่งนักเรียนเป็น 4 ห้อง + รายชื่อที่โค้ชอัปโหลดเอง
--
-- โจทย์
--   1. แบ่ง 250 คนเป็น 4 ห้อง: WISDOM / JUSTICE / COURAGE / DISCIPLINE
--   2. โค้ชอัปโหลดอีเมลของแต่ละห้องไว้ล่วงหน้า
--   3. นักเรียนล็อกอินเอง ระบบจับเข้าห้องจากอีเมลอัตโนมัติ
--   4. คนที่อีเมลไม่อยู่ในรายชื่อ เข้าระบบไม่ได้เลย
--   5. คะแนนยังเป็นของรายคนเหมือนเดิม ห้องเป็นแค่ชั้นที่ครอบอยู่ข้างบน
--
-- ผลพลอยได้ที่สำคัญ: รายชื่อนี้ทำหน้าที่เป็นประตูของทั้งระบบไปในตัว
-- ใครไม่ได้จ่ายค่าคอร์ส = ไม่มีชื่อ = สมัครไม่ได้ ไม่ต้องทำระบบเช็คสิทธิ์แยก
--
-- รันหลัง 001_core.sql และ 002_scale.sql
-- ============================================================

create extension if not exists citext;

-- ------------------------------------------------------------
-- 1. ห้อง
-- ------------------------------------------------------------
create table if not exists public.houses (
  id     smallint primary key,
  key    text not null unique,
  name   text not null,
  th     text not null,
  color  text not null,
  emoji  text not null,
  motto  text
);

insert into public.houses (id, key, name, th, color, emoji, motto) values
  (1,'wisdom',    'WISDOM',     'ปัญญา',    '#4ee1ff','🦉','รู้ว่าจะเล่าอะไร'),
  (2,'justice',   'JUSTICE',    'ยุติธรรม', '#ffcc4d','⚖️','เล่าอย่างตรงไปตรงมา'),
  (3,'courage',   'COURAGE',    'ความกล้า', '#ff4d6d','🦁','กล้ากดปล่อย'),
  (4,'discipline','DISCIPLINE', 'วินัย',    '#5ef08c','🛡️','ปล่อยทุกวันไม่มีข้อแม้')
on conflict (id) do update
  set key = excluded.key, name = excluded.name, th = excluded.th,
      color = excluded.color, emoji = excluded.emoji, motto = excluded.motto;

-- ------------------------------------------------------------
-- 2. รายชื่อนักเรียนที่โค้ชอัปโหลด
-- ------------------------------------------------------------
create table if not exists public.roster (
  email      citext primary key,
  house_id   smallint not null references public.houses(id),
  full_name  text,                 -- ชื่อจริง ไว้ให้โค้ชเทียบว่าใครเป็นใคร
  note       text,                 -- เบอร์โทร / เลขที่ใบเสร็จ / อะไรก็ได้
  added_at   timestamptz not null default now(),
  claimed_by uuid references public.profiles(id) on delete set null,
  claimed_at timestamptz,
  constraint email_has_at check (position('@' in email) > 1)
);
create index if not exists roster_house_idx     on public.roster (house_id);
create index if not exists roster_unclaimed_idx on public.roster (house_id) where claimed_by is null;

-- ------------------------------------------------------------
-- 3. ผูกห้องเข้ากับโปรไฟล์
--    โค้ชประจำห้อง = role 'coach' + house_id
--    หัวหน้าโค้ช    = role 'coach' + house_id ว่าง (เห็นทุกห้อง)
-- ------------------------------------------------------------
alter table public.profiles add column if not exists house_id smallint references public.houses(id);
create index if not exists profiles_house_idx on public.profiles (house_id);

-- ------------------------------------------------------------
-- 4. ตัวช่วยเรื่องสิทธิ์
-- ------------------------------------------------------------
create or replace function public.is_head_coach()
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from public.profiles
                 where id = auth.uid() and role = 'coach' and house_id is null);
$fn$;

create or replace function public.my_house()
returns smallint language sql stable security definer set search_path = public as $fn$
  select house_id from public.profiles where id = auth.uid();
$fn$;

-- ------------------------------------------------------------
-- 5. ตอนสมัคร: หาอีเมลในรายชื่อ แล้วจับเข้าห้องอัตโนมัติ
--    ถ้าไม่มีชื่อ = สมัครไม่ได้
-- ------------------------------------------------------------
create or replace function public.claim_roster()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare
  em citext;
  r  public.roster%rowtype;
begin
  -- โค้ชที่ตั้งด้วยมือจาก SQL ข้ามการเช็ครายชื่อ
  if new.role = 'coach' then return new; end if;

  select u.email into em from auth.users u where u.id = new.id;
  if em is null then
    raise exception 'ไม่พบอีเมลของบัญชีนี้';
  end if;

  select * into r from public.roster where email = em;
  if r.email is null then
    raise exception 'อีเมล % ไม่อยู่ในรายชื่อรุ่นนี้ ติดต่อทีมงานเพื่อเพิ่มชื่อก่อน', em;
  end if;
  if r.claimed_by is not null and r.claimed_by <> new.id then
    raise exception 'อีเมล % ถูกใช้สมัครไปแล้ว', em;
  end if;

  new.house_id := r.house_id;

  update public.roster
     set claimed_by = new.id, claimed_at = now()
   where email = em;

  return new;
end $fn$;

drop trigger if exists trg_claim_roster on public.profiles;
create trigger trg_claim_roster
  before insert on public.profiles
  for each row execute function public.claim_roster();

-- กันนักเรียนย้ายห้องเอง
create or replace function public.lock_house()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if new.house_id is distinct from old.house_id and not public.is_head_coach() then
    raise exception 'ย้ายห้องเองไม่ได้';
  end if;
  return new;
end $fn$;

drop trigger if exists trg_lock_house on public.profiles;
create trigger trg_lock_house
  before update on public.profiles
  for each row execute function public.lock_house();

-- ------------------------------------------------------------
-- 6. RLS
-- ------------------------------------------------------------
alter table public.houses enable row level security;
alter table public.roster enable row level security;

drop policy if exists houses_read on public.houses;
create policy houses_read on public.houses for select to authenticated using (true);

-- นักเรียนเห็นเฉพาะแถวของตัวเอง โค้ชเห็นทั้งห้องตัวเอง หัวหน้าโค้ชเห็นหมด
drop policy if exists roster_read on public.roster;
create policy roster_read on public.roster for select to authenticated
  using (
    claimed_by = auth.uid()
    or public.is_head_coach()
    or (public.is_coach() and house_id = public.my_house())
  );
drop policy if exists roster_admin on public.roster;
create policy roster_admin on public.roster for all to authenticated
  using (public.is_head_coach()) with check (public.is_head_coach());

-- โค้ชประจำห้องตรวจได้เฉพาะงานของห้องตัวเอง
drop policy if exists subs_review_coach on public.submissions;
create policy subs_review_coach on public.submissions for update to authenticated
  using (
    public.is_head_coach()
    or (public.is_coach() and exists (
          select 1 from public.profiles p
          where p.id = submissions.profile_id and p.house_id = public.my_house()))
  )
  with check (
    public.is_head_coach()
    or (public.is_coach() and exists (
          select 1 from public.profiles p
          where p.id = submissions.profile_id and p.house_id = public.my_house()))
  );

-- ------------------------------------------------------------
-- 7. กระดานรายคน — คะแนนยังเป็นของแต่ละคนเหมือนเดิม เพิ่มแค่ว่าอยู่ห้องไหน
-- ------------------------------------------------------------
drop view if exists public.v_leaderboard cascade;
create view public.v_leaderboard as
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
         count(distinct day_index) filter (where status = 'approved')          as days,
         round(avg(stars) filter (where status = 'approved' and stars > 0), 2) as craft,
         count(*)                                                             as submitted,
         count(*) filter (where status = 'pending')                           as pending,
         count(*) filter (where status = 'rejected')                          as rejected,
         max(created_at)                                                      as last_at
  from public.submissions group by profile_id
),
due as (
  select e.profile_id,
         sum(greatest(0, least(c.sprint_days,
             (select d from today) - (e.sprint_idx * c.sprint_days + 1) + 1)))::int as due_days
  from public.enrollments e cross join c
  group by e.profile_id
)
select
  p.id, p.name, p.handle, p.color, p.role,
  p.house_id, h.key as house_key, h.name as house_name,
  h.th as house_th, h.color as house_color, h.emoji as house_emoji,
  coalesce(enr.joined, '{}')      as joined,
  coalesce(enr.sprints_joined, 0) as sprints_joined,
  coalesce(agg.days, 0)           as days,
  coalesce(due.due_days, 0)       as due_days,
  coalesce(agg.days, 0) - coalesce(due.due_days, 0) as pace,
  case when coalesce(due.due_days,0) > 0
       then round(coalesce(agg.days,0)::numeric / due.due_days * 100)
       else 0 end                 as rate,
  agg.craft,
  coalesce(agg.submitted, 0)      as submitted,
  coalesce(agg.pending, 0)        as pending,
  coalesce(agg.rejected, 0)       as rejected,
  agg.last_at,
  coalesce(enr.sprints_joined, 0) * (select sprint_days from c) as cap_days,
  st.streak, st.freeze_left
from public.profiles p
left join public.houses h on h.id = p.house_id
left join enr on enr.profile_id = p.id
left join agg on agg.profile_id = p.id
left join due on due.profile_id = p.id
left join lateral public.streak_of(p.id) st on true;

-- ------------------------------------------------------------
-- 8. กระดานระดับห้อง — สรุปจากคะแนนรายคนอีกที ไม่ได้แทนที่กัน
--    ใช้ "ค่าเฉลี่ยต่อคน" ไม่ใช่ผลรวม เพราะห้องมีคนไม่เท่ากัน
--    ถ้าใช้ผลรวม ห้องที่คนเยอะกว่าชนะอัตโนมัติ เกมจะไม่มีความหมาย
-- ------------------------------------------------------------
create or replace view public.v_house_board as
select
  h.id, h.key, h.name, h.th, h.color, h.emoji, h.motto,
  count(l.id) filter (where l.role = 'student')                  as students,
  (select count(*) from public.roster r where r.house_id = h.id) as seats,
  (select count(*) from public.roster r
    where r.house_id = h.id and r.claimed_by is null)            as unclaimed,
  coalesce(round(avg(l.days)  filter (where l.role='student'), 1), 0) as avg_days,
  coalesce(round(avg(l.rate)  filter (where l.role='student'), 0), 0) as avg_rate,
  coalesce(round(avg(l.craft) filter (where l.role='student'), 2), 0) as avg_craft,
  coalesce(sum(l.days)        filter (where l.role='student'), 0)     as total_days,
  count(*) filter (where l.role='student' and l.pace >= 0)            as on_pace,
  count(*) filter (where l.role='student' and l.pace < -3)            as falling_behind,
  coalesce(sum(l.pending)     filter (where l.role='student'), 0)     as pending_reviews
from public.houses h
left join public.v_leaderboard l on l.house_id = h.id
group by h.id, h.key, h.name, h.th, h.color, h.emoji, h.motto
order by avg_rate desc, avg_days desc;

-- ------------------------------------------------------------
-- 9. คิวตรวจงาน แยกตามห้อง
-- ------------------------------------------------------------
drop view if exists public.v_review_queue;
create view public.v_review_queue as
select s.id, s.profile_id, p.name, p.handle, p.color,
       p.house_id, h.key as house_key, h.emoji as house_emoji,
       s.platform, s.url, s.day_index, s.sprint_idx, s.flag, s.created_at,
       (select count(*) from public.submissions x
        where x.profile_id = s.profile_id and x.status = 'rejected') as past_rejects,
       round(extract(epoch from (now() - s.created_at))/3600, 1)     as hours_waiting
from public.submissions s
join public.profiles p on p.id = s.profile_id
left join public.houses h on h.id = p.house_id
where s.status = 'pending'
order by s.flag desc, s.created_at asc;

grant select on public.houses, public.v_house_board to authenticated;
grant select on public.v_leaderboard, public.v_review_queue to authenticated;

-- ============================================================
-- วิธีอัปโหลดรายชื่อ (รันใน SQL Editor)
-- ============================================================
-- วางอีเมลทีละห้อง เปลี่ยนเลขห้องแล้ววางชุดใหม่
--   1 = WISDOM   2 = JUSTICE   3 = COURAGE   4 = DISCIPLINE
--
--   insert into public.roster (email, house_id, full_name) values
--     ('somchai@gmail.com',   1, 'สมชาย'),
--     ('malee@gmail.com',     1, 'มาลี'),
--     ('nattapong@gmail.com', 1, 'ณัฐพงษ์')
--   on conflict (email) do update set house_id = excluded.house_id;
--
-- ถ้ามีไฟล์ CSV อยู่แล้ว ใช้ปุ่ม Import data ในหน้า Table Editor ของ Supabase
-- คอลัมน์ที่ต้องมีคือ email กับ house_id (full_name กับ note จะใส่หรือไม่ใส่ก็ได้)
--
-- ตั้งโค้ชประจำห้อง (เห็นและตรวจเฉพาะงานห้องตัวเอง):
--   update public.profiles set role='coach', house_id=3 where name='PLOY';
--
-- ตั้งหัวหน้าโค้ช (เห็นทุกห้อง จัดการรายชื่อได้):
--   update public.profiles set role='coach', house_id=null where name='BENZ';
--
-- ดูว่าใครยังไม่มาสมัคร:
--   select h.name, r.email, r.full_name
--   from public.roster r join public.houses h on h.id = r.house_id
--   where r.claimed_by is null order by h.id, r.email;
--
-- ย้ายห้องให้นักเรียน (ทำได้เฉพาะหัวหน้าโค้ช):
--   update public.roster   set house_id = 2 where email = 'somchai@gmail.com';
--   update public.profiles set house_id = 2 where name  = 'SOMCHAI';
--
-- ดูภาพรวมทั้ง 4 ห้อง:
--   select * from public.v_house_board;
