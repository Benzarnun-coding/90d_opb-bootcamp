-- ============================================================
-- 053: 🤝 Buddy Streak — จับคู่บัดดี้ วันไหนส่งงานทั้งคู่ = +1
--
-- ที่มา (28 ก.ย.): Benz ศึกษา Friend Streak ของ Duolingo (คนที่มีบัดดี้ส่งงานวันนั้นมากขึ้น 22%) แล้วเคาะให้ทำ
-- กติกา:
--   - ชวนได้ทั้งนักเรียนและ TA (โค้ชที่ประจำบ้าน) · หัวหน้าโค้ชไม่ร่วม · คละบ้านได้
--   - คนละไม่เกิน 3 บัดดี้ (นับทั้งที่รอตอบรับและที่จับคู่แล้ว)
--   - อีกฝ่ายต้องกดรับ · เลิกเป็นบัดดี้ได้ทุกเมื่อ (ฝ่ายไหนก็ได้) · ผู้ชวนยกเลิกคำชวนได้
--   - streak = จำนวนวันติดกันที่ทั้งคู่ส่งงาน (นับตั้งแต่วันที่จับคู่) · วันนี้ยังไม่ครบไม่ตัด (ตัดวันตี 4 เหมือนเดิม)
--   - เป็นทางเลือก ไม่กระทบ streak ส่วนตัว / XP / เป้า
-- เขียนผ่าน RPC เท่านั้น · อ่านได้ทุกคน (เหมือนดวล)
-- รันหลัง 052
-- ============================================================

create table if not exists public.buddies (
  id           bigint generated always as identity primary key,
  a            uuid not null references public.profiles(id) on delete cascade,   -- ผู้ชวน
  b            uuid not null references public.profiles(id) on delete cascade,   -- ผู้ถูกชวน
  status       text not null default 'pending' check (status in ('pending','active','declined','ended')),
  created_at   timestamptz not null default now(),
  accepted_at  timestamptz,
  ended_at     timestamptz,
  constraint buddy_not_self check (a <> b)
);
create unique index if not exists buddies_open_pair on public.buddies (least(a,b), greatest(a,b)) where status in ('pending','active');
create index if not exists buddies_a_idx on public.buddies (a);
create index if not exists buddies_b_idx on public.buddies (b);
alter table public.buddies enable row level security;
drop policy if exists buddies_read on public.buddies;
create policy buddies_read on public.buddies for select to anon, authenticated using (true);
grant select on public.buddies to anon, authenticated;

create or replace function public.buddy_ok(pid uuid)
returns boolean language sql stable as $$
  select exists (select 1 from public.profiles p where p.id = pid and (p.role = 'student' or (p.role = 'coach' and p.house_id is not null)));
$$;

create or replace function public.buddy_open_count(pid uuid)
returns int language sql stable as $$
  select count(*)::int from public.buddies where (a = pid or b = pid) and status in ('pending','active');
$$;

-- ชวนเป็นบัดดี้ (+ push ถึงอีกฝ่ายถ้าเปิดแจ้งเตือน · ยืมกุญแจจาก cron push-nudge แบบเดียวกับ nudge())
create or replace function public.buddy_invite(to_pid uuid)
returns void language plpgsql security definer set search_path = public, extensions as $fn$
declare me uuid := auth.uid(); my_name text; cmd text; k text; u text;
begin
  if me is null then raise exception 'ต้องล็อกอินก่อน'; end if;
  if not public.has_started() then raise exception 'รุ่นยังไม่เปิด'; end if;
  if to_pid = me then raise exception 'ชวนตัวเองไม่ได้'; end if;
  if not public.buddy_ok(me) then raise exception 'หัวหน้าโค้ชไม่ร่วมบัดดี้ 😄'; end if;
  if not public.buddy_ok(to_pid) then raise exception 'ชวนคนนี้เป็นบัดดี้ไม่ได้'; end if;
  if exists (select 1 from public.buddies where least(a,b) = least(me,to_pid) and greatest(a,b) = greatest(me,to_pid) and status in ('pending','active')) then
    raise exception 'เป็นบัดดี้กันอยู่แล้ว หรือมีคำชวนค้างอยู่';
  end if;
  if public.buddy_open_count(me) >= 3 then raise exception 'คุณมีบัดดี้ (รวมคำชวนที่รอ) ครบ 3 คนแล้ว'; end if;
  if public.buddy_open_count(to_pid) >= 3 then raise exception 'เขามีบัดดี้ครบ 3 คนแล้ว'; end if;
  insert into public.buddies (a, b) values (me, to_pid);

  begin
    select name into my_name from public.profiles where id = me;
    select command into cmd from cron.job where jobname = 'push-nudge' limit 1;
    k := (regexp_match(cmd, '"x-cron-key":"([^"]+)"'))[1];
    u := (regexp_match(cmd, 'url\s*:=\s*''([^'']+)'''))[1];
    if k is not null and u is not null then
      perform net.http_post(url := u,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', k),
        body    := jsonb_build_object('profile_id', to_pid,
                                      'title', '🤝 ' || coalesce(my_name, 'เพื่อน') || ' ชวนคุณเป็นบัดดี้',
                                      'body',  'ส่งงานวันเดียวกันทั้งคู่ = streak คู่ +1 · เปิดแอปเพื่อกดรับ'));
    end if;
  exception when others then null;
  end;
end $fn$;

-- ตอบคำชวน (ผู้ถูกชวนเท่านั้น)
create or replace function public.buddy_respond(bid bigint, accept boolean)
returns void language plpgsql security definer set search_path = public as $fn$
declare me uuid := auth.uid(); r public.buddies%rowtype;
begin
  select * into r from public.buddies where id = bid for update;
  if not found or r.status <> 'pending' then raise exception 'คำชวนนี้ไม่อยู่แล้ว'; end if;
  if r.b <> me then raise exception 'ตอบได้เฉพาะคนที่ถูกชวน'; end if;
  if accept then
    if public.buddy_open_count(me) > 3 then raise exception 'คุณมีบัดดี้ครบ 3 คนแล้ว'; end if;
    update public.buddies set status = 'active', accepted_at = now() where id = bid;
  else
    update public.buddies set status = 'declined', ended_at = now() where id = bid;
  end if;
end $fn$;

-- เลิกเป็นบัดดี้ / ยกเลิกคำชวน (ฝ่ายไหนก็ได้)
create or replace function public.buddy_end(bid bigint)
returns void language plpgsql security definer set search_path = public as $fn$
declare me uuid := auth.uid(); r public.buddies%rowtype;
begin
  select * into r from public.buddies where id = bid for update;
  if not found or r.status not in ('pending','active') then raise exception 'ไม่พบบัดดี้คู่นี้'; end if;
  if me not in (r.a, r.b) then raise exception 'ไม่ใช่บัดดี้ของคุณ'; end if;
  update public.buddies set status = 'ended', ended_at = now() where id = bid;
end $fn$;

revoke execute on function public.buddy_invite(uuid), public.buddy_respond(bigint, boolean), public.buddy_end(bigint) from public, anon;
grant execute on function public.buddy_invite(uuid), public.buddy_respond(bigint, boolean), public.buddy_end(bigint) to authenticated;

-- คู่บัดดี้ + streak ปัจจุบัน / สูงสุด + วันนี้ใครส่งแล้ว
create or replace view public.v_buddies as
with t as (select public.day_of(now()) as today),
p as (
  select bu.*, public.day_of(bu.accepted_at) as d0 from public.buddies bu where bu.status = 'active'
),
posted as (select distinct profile_id, day_index from public.submissions where status = 'approved'),
both_days as (
  select p.id, pa.day_index as d
  from p
  join posted pa on pa.profile_id = p.a and pa.day_index >= p.d0
  join posted pb on pb.profile_id = p.b and pb.day_index = pa.day_index
),
runs as (
  select id, count(*)::int as len, max(d) as last_d
  from (select id, d, d - row_number() over (partition by id order by d) as grp from both_days) x
  group by id, grp
),
agg as (
  select r.id,
         coalesce(max(r.len) filter (where r.last_d >= t.today - 1), 0) as streak,
         coalesce(max(r.len), 0) as best
  from runs r, t group by r.id
)
select bu.id, bu.a, bu.b, bu.status, bu.created_at, bu.accepted_at,
       coalesce(agg.streak, 0) as streak, coalesce(agg.best, 0) as best,
       exists (select 1 from posted x, t where x.profile_id = bu.a and x.day_index = t.today) as a_today,
       exists (select 1 from posted x, t where x.profile_id = bu.b and x.day_index = t.today) as b_today
from public.buddies bu
left join agg on agg.id = bu.id
where bu.status in ('pending','active');
grant select on public.v_buddies to anon, authenticated;

select 'buddy streak ready' as ok, (select count(*) from public.buddies) as pairs;
