-- ============================================================
-- DATA PACK (2026-09-07)
--   1. daily_snapshots  — เก็บสถานะทุกคนวันละแถว (+ backfill ย้อนหลัง) ไว้ดู retention หลังจบรุ่น
--   2. v_at_risk        — กลุ่มเสี่ยงสำหรับโค้ช/TA + risk_text() ข้อความวาง Discord
--   5. audit_log        — บันทึกทุกการแก้ไขสำคัญ (ย้ายบ้าน บทบาท ลบงาน รีเซ็ตรหัส บอส)
--   6-8. submissions    — views / likes / kind (ประเภท) / note (สรุป 1 บรรทัด) เจ้าของแก้เองได้ + v_reach
--   9. kudos            — TA กด 👍 งานดี + v_kudos
--   10. live_sessions   — เช็คอินเรียนสด
-- รันหลัง 001-026
-- ============================================================

-- ------------------------------------------------------------
-- 1. daily snapshots
-- ------------------------------------------------------------
create table if not exists public.daily_snapshots (
  day_index   int  not null,
  profile_id  uuid not null references public.profiles(id) on delete cascade,
  house_id    smallint,
  role        text,
  contents    int  not null default 0,
  posted      boolean not null default false,
  day_streak  int,
  week_no     int,
  week_target int,
  week_done   int,
  style       text,
  taken_at    timestamptz not null default now(),
  primary key (day_index, profile_id)
);
create index if not exists snap_profile_idx on public.daily_snapshots (profile_id, day_index);
alter table public.daily_snapshots enable row level security;
drop policy if exists snap_read on public.daily_snapshots;
create policy snap_read on public.daily_snapshots for select to authenticated
  using (public.is_head_coach() or public.is_ta() or profile_id = auth.uid());
grant select on public.daily_snapshots to authenticated;

create or replace function public.take_daily_snapshot(d int default null)
returns int language plpgsql security definer set search_path = public as $fn$
declare dd int; n int;
begin
  dd := coalesce(d, public.day_of(now()));
  insert into public.daily_snapshots (day_index, profile_id, house_id, role, contents, posted, day_streak, week_no, week_target, week_done, style)
  select dd, l.id, l.house_id, l.role, l.contents,
         exists (select 1 from public.submissions s where s.profile_id = l.id and s.day_index = dd and s.status = 'approved'),
         l.day_streak, public.week_of(dd), l.week_target, l.week_done, coalesce(l.pledge_style, 'normal')
  from public.v_leaderboard l
  on conflict (day_index, profile_id) do update
    set contents = excluded.contents, posted = excluded.posted, day_streak = excluded.day_streak,
        week_target = excluded.week_target, week_done = excluded.week_done, style = excluded.style,
        house_id = excluded.house_id, role = excluded.role, taken_at = now();
  get diagnostics n = row_count;
  return n;
end $fn$;

-- ย้อนหลังวันที่ผ่านมา (คิดจากงานที่ส่ง ไม่มี streak/ร่าง เพราะคำนวณย้อนไม่ได้)
create or replace function public.backfill_snapshots()
returns int language plpgsql security definer set search_path = public as $fn$
declare dd int; today int; n int := 0; k int;
begin
  today := public.day_of(now());
  for dd in 1..greatest(0, today - 1) loop
    insert into public.daily_snapshots (day_index, profile_id, house_id, role, contents, posted, week_no, week_target, week_done)
    select dd, p.id, p.house_id, p.role,
           (select count(*) from public.submissions s where s.profile_id = p.id and s.status = 'approved' and s.day_index <= dd),
           exists (select 1 from public.submissions s where s.profile_id = p.id and s.status = 'approved' and s.day_index = dd),
           public.week_of(dd),
           (select target from public.pledges pl where pl.profile_id = p.id and pl.week_no = public.week_of(dd)),
           (select count(*) from public.submissions s where s.profile_id = p.id and s.status = 'approved'
              and public.week_of(s.day_index) = public.week_of(dd) and s.day_index <= dd)
    from public.profiles p
    where exists (select 1 from public.roster r where r.claimed_by = p.id
                  and coalesce(r.claimed_at, now()) < (select start_date::timestamptz + make_interval(days => dd) from public.cohort where id = 1))
    on conflict (day_index, profile_id) do nothing;
    get diagnostics k = row_count; n := n + k;
  end loop;
  return n;
end $fn$;

select cron.unschedule(jobid) from cron.job where jobname = 'snapshot-daily';
select cron.schedule('snapshot-daily', '55 20 * * *', $cron$ select public.take_daily_snapshot(); $cron$);   -- 03:55 ไทย ก่อนปิดรอบตี 4

-- ------------------------------------------------------------
-- 2. กลุ่มเสี่ยง
-- ------------------------------------------------------------
create or replace view public.v_at_risk as
with base as (
  select p.id, p.name, p.handle, p.house_id, l.contents, l.day_streak, l.week_target, l.week_done, l.last_at,
         (select max(s.day_index) from public.submissions s where s.profile_id = p.id and s.status = 'approved') as last_day,
         not exists (select 1 from public.pledges pl where pl.profile_id = p.id and pl.week_no = public.current_week()) as no_pledge,
         exists (select 1 from public.v_burnout b where b.profile_id = p.id) as burnout,
         exists (select 1 from public.v_weak w where w.profile_id = p.id) as weak
  from public.profiles p
  join public.v_leaderboard l on l.id = p.id
  where p.role = 'student'
)
select b.*, h.name as house_name, h.emoji as house_emoji,
       case when b.last_day is null then public.day_of(now()) else public.day_of(now()) - b.last_day end as days_silent,
       case when b.contents = 0 then 'never'
            when public.day_of(now()) - b.last_day >= 3 then 'silent3'
            when public.day_of(now()) - b.last_day = 2 then 'silent2'
            when b.burnout then 'burnout'
            when b.weak then 'weak'
            when b.no_pledge then 'nopledge'
            else 'ok' end as risk
from base b
left join public.houses h on h.id = b.house_id;
grant select on public.v_at_risk to authenticated;

-- ข้อความพร้อมวาง Discord (ทั้งรุ่น หรือเฉพาะบ้าน)
create or replace function public.risk_text(hid smallint default null)
returns text language plpgsql stable security definer set search_path = public as $fn$
declare t text := ''; n_never int; n_s3 int; n_s2 int; n_np int; n_bo int; l text;
begin
  select count(*) filter (where risk='never'), count(*) filter (where risk='silent3'), count(*) filter (where risk='silent2'),
         count(*) filter (where no_pledge), count(*) filter (where burnout or weak)
    into n_never, n_s3, n_s2, n_np, n_bo
  from public.v_at_risk where hid is null or house_id = hid;
  t := '🚨 **กลุ่มเสี่ยง วันที่ ' || public.day_of(now()) || (case when hid is null then ' · ทั้งรุ่น' else ' · ' || (select emoji || ' ' || name from public.houses where id = hid) end) || '**' || E'\n';
  select string_agg(house_emoji || ' ' || name, ', ' order by house_id, name) into l from public.v_at_risk where risk='silent3' and (hid is null or house_id = hid);
  t := t || '⛔ หายไป 3 วันขึ้นไป (' || n_s3 || '): ' || coalesce(l, '-') || E'\n';
  select string_agg(house_emoji || ' ' || name, ', ' order by house_id, name) into l from public.v_at_risk where risk='silent2' and (hid is null or house_id = hid);
  t := t || '⚠️ ไม่ส่ง 2 วันติด (' || n_s2 || '): ' || coalesce(l, '-') || E'\n';
  select string_agg(house_emoji || ' ' || name, ', ' order by house_id, name) into l from public.v_at_risk where risk='never' and (hid is null or house_id = hid);
  t := t || '🆕 สมัครแล้วยังไม่เคยส่ง (' || n_never || '): ' || coalesce(l, '-') || E'\n';
  select string_agg(house_emoji || ' ' || name, ', ' order by house_id, name) into l from public.v_at_risk where no_pledge and (hid is null or house_id = hid);
  t := t || '🎯 ยังไม่เลือกเป้าสัปดาห์นี้ (' || n_np || '): ' || coalesce(l, '-') || E'\n';
  select string_agg(house_emoji || ' ' || name || (case when burnout then ' 💀' else ' 😵' end), ', ' order by house_id, name) into l from public.v_at_risk where (burnout or weak) and (hid is null or house_id = hid);
  t := t || '🩹 ร่างกระโหลก/หมดแรง (' || n_bo || '): ' || coalesce(l, '-');
  return t;
end $fn$;
grant execute on function public.risk_text(smallint) to authenticated;

-- ------------------------------------------------------------
-- 5. audit log
-- ------------------------------------------------------------
create table if not exists public.audit_log (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  actor      uuid,
  actor_name text,
  action     text not null,
  target     text,
  detail     jsonb
);
create index if not exists audit_at_idx on public.audit_log (at desc);
alter table public.audit_log enable row level security;
drop policy if exists audit_read on public.audit_log;
create policy audit_read on public.audit_log for select to authenticated using (public.is_head_coach() or public.is_ta());
grant select on public.audit_log to authenticated;

create or replace function public.audit(a text, tgt text, d jsonb default null)
returns void language plpgsql security definer set search_path = public as $fn$
declare nm text;
begin
  select name into nm from public.profiles where id = auth.uid();
  insert into public.audit_log (actor, actor_name, action, target, detail) values (auth.uid(), coalesce(nm, 'system'), a, tgt, d);
end $fn$;

create or replace function public.audit_profiles()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if tg_op = 'UPDATE' then
    if old.house_id is distinct from new.house_id or old.role is distinct from new.role or old.name is distinct from new.name then
      perform public.audit('profile.update', new.name, jsonb_build_object('house', jsonb_build_array(old.house_id, new.house_id), 'role', jsonb_build_array(old.role, new.role), 'name', jsonb_build_array(old.name, new.name)));
    end if;
  elsif tg_op = 'INSERT' then
    perform public.audit('profile.create', new.name, jsonb_build_object('house', new.house_id));
  elsif tg_op = 'DELETE' then
    perform public.audit('profile.delete', old.name, jsonb_build_object('house', old.house_id));
  end if;
  return coalesce(new, old);
end $fn$;
drop trigger if exists trg_audit_profiles on public.profiles;
create trigger trg_audit_profiles after insert or update or delete on public.profiles for each row execute function public.audit_profiles();

create or replace function public.audit_roster()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if tg_op = 'UPDATE' then
    if old.house_id is distinct from new.house_id or old.role is distinct from new.role then
      perform public.audit('roster.update', new.email::text, jsonb_build_object('house', jsonb_build_array(old.house_id, new.house_id), 'role', jsonb_build_array(old.role, new.role)));
    end if;
  elsif tg_op = 'INSERT' then
    perform public.audit('roster.add', new.email::text, jsonb_build_object('house', new.house_id, 'role', new.role));
  elsif tg_op = 'DELETE' then
    perform public.audit('roster.delete', old.email::text, jsonb_build_object('house', old.house_id));
  end if;
  return coalesce(new, old);
end $fn$;
drop trigger if exists trg_audit_roster on public.roster;
create trigger trg_audit_roster after insert or update or delete on public.roster for each row execute function public.audit_roster();

create or replace function public.audit_submissions()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare nm text;
begin
  select name into nm from public.profiles where id = old.profile_id;
  perform public.audit('submission.delete', nm, jsonb_build_object('url', old.url, 'day', old.day_index, 'platform', old.platform));
  return old;
end $fn$;
drop trigger if exists trg_audit_submissions on public.submissions;
create trigger trg_audit_submissions after delete on public.submissions for each row execute function public.audit_submissions();

create or replace function public.audit_bosses()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if tg_op = 'INSERT' then perform public.audit('boss.create', new.name, jsonb_build_object('week', new.week_no, 'house', new.house_id, 'hp', new.hp));
  else perform public.audit('boss.delete', old.name, jsonb_build_object('week', old.week_no)); end if;
  return coalesce(new, old);
end $fn$;
drop trigger if exists trg_audit_bosses on public.bosses;
create trigger trg_audit_bosses after insert or delete on public.bosses for each row execute function public.audit_bosses();

-- ฟังก์ชันที่มีอยู่แล้ว: เพิ่มบันทึก
create or replace function public.admin_reset_password(em text)
returns void language plpgsql security definer set search_path = public, extensions as $fn$
declare c text; n int;
begin
  if not public.is_head_coach() then raise exception 'เฉพาะหัวหน้าโค้ชเท่านั้น'; end if;
  select code into c from public.login_code where id = 1;
  if c is null then raise exception 'ยังไม่ได้ตั้งรหัสเข้าใช้รวมในหน้า admin'; end if;
  update auth.users set encrypted_password = extensions.crypt(c, extensions.gen_salt('bf')), updated_at = now() where email = em;
  get diagnostics n = row_count;
  if n = 0 then raise exception 'ไม่พบบัญชีของ % (ยังไม่เคยเข้าใช้)', em; end if;
  perform public.audit('password.reset', em, null);
end $fn$;

create or replace function public.admin_set_login_code(c text)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if not public.is_head_coach() then raise exception 'เฉพาะหัวหน้าโค้ชเท่านั้น'; end if;
  if c is null or length(trim(c)) < 4 then raise exception 'รหัสต้องยาวอย่างน้อย 4 ตัว'; end if;
  insert into public.login_code (id, code, set_at) values (1, trim(c), now())
  on conflict (id) do update set code = excluded.code, set_at = now();
  perform public.audit('login_code.set', null, null);
end $fn$;

-- ------------------------------------------------------------
-- 6-8. ข้อมูลต่อชิ้น: views / likes / kind / note — เจ้าของ (และ TA ของบ้าน) แก้ได้
-- ------------------------------------------------------------
alter table public.submissions add column if not exists views int not null default 0 check (views >= 0);
alter table public.submissions add column if not exists likes int not null default 0 check (likes >= 0);
alter table public.submissions add column if not exists kind  text;
alter table public.submissions drop constraint if exists kind_ok;
alter table public.submissions add constraint kind_ok check (kind is null or kind in ('short','long','image','article','live','other'));
alter table public.submissions add column if not exists stats_at timestamptz;

create or replace function public.on_submission_review()
returns trigger language plpgsql security definer set search_path = public as $fn$
declare p text; v int; lk int; k text; nt text; ohouse smallint;
begin
  if not public.is_head_coach() then
    select house_id into ohouse from public.profiles where id = old.profile_id;
    if auth.uid() = old.profile_id or (public.is_ta() and ohouse = public.my_house()) then
      p := new.platform; v := new.views; lk := new.likes; k := new.kind; nt := new.note;
      new := old;
      new.platform := p; new.views := v; new.likes := lk; new.kind := k; new.note := nt;
      if v is distinct from old.views or lk is distinct from old.likes then new.stats_at := now(); end if;
      return new;
    end if;
    raise exception 'เฉพาะหัวหน้าโค้ชเท่านั้นที่แก้สถานะงานได้';
  end if;
  new.profile_id := old.profile_id;
  new.url        := old.url;
  new.url_key    := old.url_key;
  new.day_index  := old.day_index;
  new.sprint_idx := old.sprint_idx;
  new.created_at := old.created_at;
  new.reviewed_by := auth.uid();
  new.reviewed_at := now();
  return new;
end $fn$;

-- ให้ TA แก้ผ่าน RLS ได้ด้วย (policy subs_review_coach มีอยู่แล้ว) — เพิ่ม RPC สำหรับหน้า TA
create or replace function public.ta_update_submission(sid bigint, plat text default null, v int default null, lk int default null, k text default null, nt text default null)
returns void language plpgsql security definer set search_path = public as $fn$
declare ohouse smallint;
begin
  if not (public.is_ta() or public.is_head_coach()) then raise exception 'เฉพาะ TA หรือหัวหน้าโค้ชเท่านั้น'; end if;
  select p.house_id into ohouse from public.submissions s join public.profiles p on p.id = s.profile_id where s.id = sid;
  if public.is_ta() and ohouse is distinct from public.my_house() then raise exception 'แก้ได้เฉพาะงานของคนในบ้านคุณ'; end if;
  update public.submissions set
    platform = coalesce(plat, platform), views = coalesce(v, views), likes = coalesce(lk, likes),
    kind = coalesce(k, kind), note = coalesce(nt, note),
    stats_at = case when v is not null or lk is not null then now() else stats_at end
  where id = sid;
end $fn$;
grant execute on function public.ta_update_submission(bigint, text, int, int, text, text) to authenticated;

-- ยอดรวมต่อคน
create or replace view public.v_reach as
select s.profile_id, p.name, p.house_id,
       sum(s.views) as total_views, sum(s.likes) as total_likes, max(s.views) as best_views,
       count(*) filter (where s.views > 0) as with_stats, count(*) as pieces
from public.submissions s join public.profiles p on p.id = s.profile_id
where s.status = 'approved'
group by s.profile_id, p.name, p.house_id;
grant select on public.v_reach to anon, authenticated;

create table if not exists public.kudos (
  submission_id bigint primary key references public.submissions(id) on delete cascade,
  by_id         uuid references public.profiles(id) on delete set null,
  at            timestamptz not null default now()
);
alter table public.kudos enable row level security;
drop policy if exists kudos_read on public.kudos;
create policy kudos_read on public.kudos for select to anon, authenticated using (true);
grant select on public.kudos to anon, authenticated;

-- v_feed: เพิ่ม kind / views / likes / note ให้หน้าเว็บโชว์ได้
create or replace view public.v_feed as
select s.id, s.profile_id, p.name, p.color, s.platform, s.url,
       s.day_index, s.sprint_idx, s.status, s.stars, s.flag, s.created_at,
       s.kind, s.views, s.likes, s.note,
       exists (select 1 from public.kudos k where k.submission_id = s.id) as kudos
from public.submissions s
join public.profiles p on p.id = s.profile_id
order by s.created_at desc;

-- ------------------------------------------------------------
-- 9. kudos 👍 จาก TA / หัวหน้าโค้ช
-- ------------------------------------------------------------
-- (ตาราง kudos สร้างไว้ด้านบนก่อน v_feed)

create or replace function public.ta_kudos(sid bigint, give boolean)
returns void language plpgsql security definer set search_path = public as $fn$
declare ohouse smallint;
begin
  if not (public.is_ta() or public.is_head_coach()) then raise exception 'เฉพาะ TA หรือหัวหน้าโค้ชเท่านั้น'; end if;
  select p.house_id into ohouse from public.submissions s join public.profiles p on p.id = s.profile_id where s.id = sid;
  if ohouse is null and not exists (select 1 from public.submissions where id = sid) then raise exception 'ไม่พบงาน'; end if;
  if public.is_ta() and ohouse is distinct from public.my_house() then raise exception 'ให้ได้เฉพาะงานของคนในบ้านคุณ'; end if;
  if give then
    insert into public.kudos (submission_id, by_id) values (sid, auth.uid()) on conflict (submission_id) do nothing;
  else
    delete from public.kudos where submission_id = sid;
  end if;
end $fn$;
grant execute on function public.ta_kudos(bigint, boolean) to authenticated;

create or replace view public.v_kudos as
select s.profile_id, count(*) as n
from public.kudos k join public.submissions s on s.id = k.submission_id
group by s.profile_id;
grant select on public.v_kudos to anon, authenticated;

-- ------------------------------------------------------------
-- 10. เรียนสด: เช็คอิน
-- ------------------------------------------------------------
create table if not exists public.live_sessions (
  id         bigint generated always as identity primary key,
  title      text not null,
  starts_at  timestamptz not null,
  ends_at    timestamptz not null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint session_span check (ends_at > starts_at)
);
alter table public.live_sessions enable row level security;
drop policy if exists sessions_read on public.live_sessions;
create policy sessions_read on public.live_sessions for select to anon, authenticated using (true);
drop policy if exists sessions_admin on public.live_sessions;
create policy sessions_admin on public.live_sessions for all to authenticated using (public.is_head_coach()) with check (public.is_head_coach());
grant select on public.live_sessions to anon, authenticated;
grant insert, update, delete on public.live_sessions to authenticated;

create table if not exists public.checkins (
  session_id bigint not null references public.live_sessions(id) on delete cascade,
  profile_id uuid not null references public.profiles(id) on delete cascade,
  at         timestamptz not null default now(),
  primary key (session_id, profile_id)
);
alter table public.checkins enable row level security;
drop policy if exists checkins_read on public.checkins;
create policy checkins_read on public.checkins for select to anon, authenticated using (true);
drop policy if exists checkins_insert on public.checkins;
create policy checkins_insert on public.checkins for insert to authenticated
  with check (profile_id = auth.uid() and exists (
    select 1 from public.live_sessions s where s.id = session_id
      and now() between s.starts_at - interval '30 minutes' and s.ends_at + interval '60 minutes'));
grant select on public.checkins to anon, authenticated;
grant insert on public.checkins to authenticated;

create or replace view public.v_session_attendance as
select s.id, s.title, s.starts_at, s.ends_at,
       (select count(*) from public.checkins c where c.session_id = s.id) as n,
       (select count(*) from public.profiles p where p.role = 'student') as students
from public.live_sessions s order by s.starts_at desc;
grant select on public.v_session_attendance to anon, authenticated;

select 'ok' as status;
