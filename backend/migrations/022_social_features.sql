-- ============================================================
-- ชุดฟีเจอร์สังคม: ลบงานตัวเอง (10 นาที) · เชียร์ · ท้าดวล · บอสประจำสัปดาห์ · push subscription
-- รันหลัง 001-021
-- ============================================================

-- ------------------------------------------------------------
-- 1. ลบงานของตัวเองได้ภายใน 10 นาทีหลังส่ง (ส่งผิดลิงก์)
-- ------------------------------------------------------------
drop policy if exists subs_delete_own_recent on public.submissions;
create policy subs_delete_own_recent on public.submissions for delete to authenticated
  using (profile_id = auth.uid() and created_at > now() - interval '10 minutes');

-- ------------------------------------------------------------
-- 2. เชียร์ 👏 — ส่งอิโมจิให้เพื่อน วันละครั้งต่อคน
-- ------------------------------------------------------------
create table if not exists public.cheers (
  id         bigint generated always as identity primary key,
  from_id    uuid not null references public.profiles(id) on delete cascade,
  to_id      uuid not null references public.profiles(id) on delete cascade,
  emoji      text not null default '👏',
  day_index  int  not null,
  created_at timestamptz not null default now(),
  constraint cheer_not_self check (from_id <> to_id),
  constraint cheer_emoji_ok check (emoji in ('👏','🔥','💪','❤️')),
  unique (from_id, to_id, day_index)
);
alter table public.cheers enable row level security;
drop policy if exists cheers_read on public.cheers;
create policy cheers_read on public.cheers for select to anon, authenticated using (true);
drop policy if exists cheers_send on public.cheers;
create policy cheers_send on public.cheers for insert to authenticated
  with check (from_id = auth.uid() and public.has_started());
grant select on public.cheers to anon, authenticated;
grant insert on public.cheers to authenticated;

create or replace function public.stamp_cheer()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  new.day_index := public.day_of(now());
  return new;
end $fn$;
drop trigger if exists trg_cheer_day on public.cheers;
create trigger trg_cheer_day before insert on public.cheers for each row execute function public.stamp_cheer();

-- เชียร์ที่ได้รับ แยกตามสัปดาห์ (ป้าย POPULAR = สัปดาห์ไหนได้ ≥ 10)
create or replace view public.v_cheers_week as
select to_id as profile_id, public.week_of(day_index) as week_no, count(*) as n
from public.cheers group by 1,2;
grant select on public.v_cheers_week to anon, authenticated;

-- ------------------------------------------------------------
-- 3. ท้าดวล 7 วัน — ใครส่งมากกว่าชนะ แพ้ต้องใส่หมวกที่ผู้ชนะเลือก 7 วัน
-- ------------------------------------------------------------
create table if not exists public.duels (
  id          bigint generated always as identity primary key,
  challenger  uuid not null references public.profiles(id) on delete cascade,
  opponent    uuid not null references public.profiles(id) on delete cascade,
  status      text not null default 'pending',       -- pending | active | declined | done
  start_day   int,
  end_day     int,
  winner      uuid references public.profiles(id) on delete set null,
  prize_hat   smallint,                              -- หมวกที่ผู้ชนะเลือกให้ผู้แพ้ใส่
  created_at  timestamptz not null default now(),
  constraint duel_not_self check (challenger <> opponent),
  constraint duel_status_ok check (status in ('pending','active','declined','done'))
);
create index if not exists duels_people_idx on public.duels (challenger, opponent);
alter table public.duels enable row level security;
drop policy if exists duels_read on public.duels;
create policy duels_read on public.duels for select to anon, authenticated using (true);
drop policy if exists duels_create on public.duels;
create policy duels_create on public.duels for insert to authenticated
  with check (challenger = auth.uid() and status = 'pending' and public.has_started());
drop policy if exists duels_update on public.duels;
create policy duels_update on public.duels for update to authenticated
  using (challenger = auth.uid() or opponent = auth.uid())
  with check (challenger = auth.uid() or opponent = auth.uid());
grant select on public.duels to anon, authenticated;
grant insert, update on public.duels to authenticated;

-- กันคนท้าซ้อน: มีดวลค้าง (pending/active) กับใครก็ได้แค่ 1 อันต่อคน
create or replace function public.guard_duel()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if tg_op = 'INSERT' then
    if exists (select 1 from public.duels d where d.status in ('pending','active')
               and (d.challenger in (new.challenger, new.opponent) or d.opponent in (new.challenger, new.opponent))) then
      raise exception 'มีดวลค้างอยู่แล้ว รอให้จบก่อน';
    end if;
    new.status := 'pending';
    return new;
  end if;
  /* UPDATE: ฝั่งที่ถูกท้าเป็นคนรับ/ปฏิเสธ · ตอนจบผู้ชนะเลือกหมวก · ห้ามแก้อย่างอื่น */
  new.challenger := old.challenger; new.opponent := old.opponent; new.created_at := old.created_at;
  if old.status = 'pending' and new.status in ('active','declined') then
    if auth.uid() <> old.opponent then raise exception 'เฉพาะคนถูกท้าเท่านั้นที่รับหรือปฏิเสธได้'; end if;
    if new.status = 'active' then
      new.start_day := public.day_of(now());
      new.end_day   := new.start_day + 6;
    end if;
    new.winner := null; new.prize_hat := null;
    return new;
  end if;
  if old.status = 'active' and new.status = 'done' then
    /* ปิดดวลได้เมื่อเลยวันสุดท้ายแล้ว ใครก็กดปิดได้ ผู้ชนะคิดจากชิ้นที่นับได้ในช่วงดวล */
    if public.day_of(now()) <= old.end_day then raise exception 'ดวลยังไม่จบ'; end if;
    new.start_day := old.start_day; new.end_day := old.end_day;
    select case when c.n > o.n then old.challenger when o.n > c.n then old.opponent else null end into new.winner
    from (select count(*) n from public.v_counted where profile_id = old.challenger and day_index between old.start_day and old.end_day) c,
         (select count(*) n from public.v_counted where profile_id = old.opponent  and day_index between old.start_day and old.end_day) o;
    new.prize_hat := null;
    return new;
  end if;
  if old.status = 'done' and old.prize_hat is null and new.prize_hat is not null then
    if auth.uid() <> old.winner then raise exception 'ผู้ชนะเท่านั้นที่เลือกหมวกได้'; end if;
    new.status := 'done'; new.winner := old.winner; new.start_day := old.start_day; new.end_day := old.end_day;
    return new;
  end if;
  raise exception 'แก้ดวลแบบนี้ไม่ได้';
end $fn$;
drop trigger if exists trg_duel_guard on public.duels;
create trigger trg_duel_guard before insert or update on public.duels for each row execute function public.guard_duel();

-- คะแนนดวลสด
create or replace view public.v_duels as
select d.*,
       pc.name as challenger_name, po.name as opponent_name,
       (select count(*) from public.v_counted v where v.profile_id = d.challenger and d.start_day is not null and v.day_index between d.start_day and d.end_day) as challenger_score,
       (select count(*) from public.v_counted v where v.profile_id = d.opponent  and d.start_day is not null and v.day_index between d.start_day and d.end_day) as opponent_score,
       public.day_of(now()) as today
from public.duels d
join public.profiles pc on pc.id = d.challenger
join public.profiles po on po.id = d.opponent;
grant select on public.v_duels to anon, authenticated;

-- ------------------------------------------------------------
-- 4. บอสประจำสัปดาห์ — หัวหน้าโค้ชตั้งเอง: สัปดาห์ไหน บ้านไหน (null = ทั้งรุ่น) ชื่อ HP
-- ------------------------------------------------------------
create table if not exists public.bosses (
  id         bigint generated always as identity primary key,
  week_no    int  not null,
  house_id   smallint references public.houses(id),
  name       text not null,
  emoji      text not null default '👹',
  hp         int  not null check (hp > 0),
  reward     text,                                   -- ข้อความรางวัล (โชว์เฉย ๆ)
  created_at timestamptz not null default now()
);
alter table public.bosses enable row level security;
drop policy if exists bosses_read on public.bosses;
create policy bosses_read on public.bosses for select to anon, authenticated using (true);
drop policy if exists bosses_admin on public.bosses;
create policy bosses_admin on public.bosses for all to authenticated
  using (public.is_head_coach()) with check (public.is_head_coach());
grant select on public.bosses to anon, authenticated;
grant insert, update, delete on public.bosses to authenticated;

-- ความคืบหน้า: ดาเมจ = ชิ้นที่นับได้ของนักเรียนบ้านนั้น (หรือทั้งรุ่น) ในสัปดาห์นั้น
create or replace view public.v_boss_progress as
select b.*,
       (select count(*) from public.v_counted v join public.profiles p on p.id = v.profile_id
         where v.week_no = b.week_no and p.role = 'student' and (b.house_id is null or p.house_id = b.house_id)) as damage,
       (select count(distinct v.profile_id) from public.v_counted v join public.profiles p on p.id = v.profile_id
         where v.week_no = b.week_no and p.role = 'student' and (b.house_id is null or p.house_id = b.house_id)) as fighters
from public.bosses b;
grant select on public.v_boss_progress to anon, authenticated;

-- ใครล้มบอสได้บ้าง (บอสตาย + คนนั้นส่งอย่างน้อย 1 ชิ้นในสัปดาห์นั้น)
create or replace view public.v_boss_kills as
select bp.id as boss_id, bp.week_no, bp.name, v.profile_id
from public.v_boss_progress bp
join public.v_counted v on v.week_no = bp.week_no
join public.profiles p on p.id = v.profile_id
where bp.damage >= bp.hp and p.role = 'student' and (bp.house_id is null or p.house_id = bp.house_id)
group by bp.id, bp.week_no, bp.name, v.profile_id;
grant select on public.v_boss_kills to anon, authenticated;

-- ------------------------------------------------------------
-- 5. Web Push subscriptions
-- ------------------------------------------------------------
create table if not exists public.push_subs (
  profile_id uuid not null references public.profiles(id) on delete cascade,
  endpoint   text not null,
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now(),
  primary key (profile_id, endpoint)
);
alter table public.push_subs enable row level security;
drop policy if exists push_own on public.push_subs;
create policy push_own on public.push_subs for all to authenticated
  using (profile_id = auth.uid()) with check (profile_id = auth.uid());
grant select, insert, update, delete on public.push_subs to authenticated;

select 'ok' as status;
