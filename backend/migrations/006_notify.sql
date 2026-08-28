-- ============================================================
-- PHASE 4 — ระบบแจ้งเตือน
--
-- ตัวที่ทำให้คนกลับมาจริง ๆ เพราะนักเรียนจะโพสต์เสร็จแล้วลืมมาวางลิงก์
-- ตั้งแต่สัปดาห์ที่ 3 เป็นต้นไป ถ้าไม่มีอะไรสะกิด ข้อมูลบนกระดานจะไม่ตรงความจริง
--
-- แนวคิด: ฐานข้อมูลรู้ว่าใครควรถูกเตือน → ใส่คิวไว้ → Edge Function มาหยิบไปส่ง
-- ช่องทางที่แนะนำคือ LINE กลุ่มรุ่น เพราะเป็นที่ที่นักเรียนอยู่แล้ว
--
-- รันหลัง 001-005
-- ============================================================

-- ------------------------------------------------------------
-- 1. คิวข้อความ
-- ------------------------------------------------------------
create table if not exists public.notifications (
  id          bigint generated always as identity primary key,
  kind        text not null,               -- daily_digest | week_start | personal_nudge
  profile_id  uuid references public.profiles(id) on delete cascade,
  payload     jsonb not null default '{}'::jsonb,
  send_after  timestamptz not null default now(),
  sent_at     timestamptz,
  error       text,
  created_at  timestamptz not null default now(),
  constraint kind_ok check (kind in ('daily_digest','week_start','personal_nudge'))
);
create index if not exists notif_pending_idx
  on public.notifications (send_after) where sent_at is null;

alter table public.notifications enable row level security;
drop policy if exists notif_read_head on public.notifications;
create policy notif_read_head on public.notifications for select to authenticated
  using (public.is_head_coach());
-- ไม่มี policy insert/update สำหรับ authenticated
-- Edge Function ใช้ service_role ซึ่งข้าม RLS อยู่แล้ว

-- ------------------------------------------------------------
-- 2. ใครควรถูกเตือนวันนี้
--    = ลงสปรินต์ปัจจุบันไว้ แต่วันนี้ยังไม่ส่งงานเลย
-- ------------------------------------------------------------
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
  and exists (select 1 from public.enrollments e
              where e.profile_id = p.id
                and e.sprint_idx = (public.day_of(now())-1)/(select sprint_days from public.cohort where id=1))
  and not exists (select 1 from public.submissions s
                  where s.profile_id = p.id
                    and s.day_index = public.day_of(now())
                    and s.status = 'approved');

-- ใครยังไม่เลือกเป้าของสัปดาห์นี้
create or replace view public.v_needs_pledge as
select p.id, p.name, h.name as house_name, h.emoji as house_emoji
from public.profiles p
left join public.houses h on h.id = p.house_id
where p.role = 'student'
  and exists (select 1 from public.enrollments e
              where e.profile_id = p.id
                and e.sprint_idx = public.sprint_of_week(public.current_week()))
  and not exists (select 1 from public.pledges pl
                  where pl.profile_id = p.id and pl.week_no = public.current_week());

-- ------------------------------------------------------------
-- 3. สร้างข้อความลงคิว
-- ------------------------------------------------------------
create or replace function public.enqueue_daily_digest()
returns int language plpgsql security definer set search_path = public as $fn$
declare
  n_nudge int;
  n_pledge int;
  top_line text;
  cw int := public.current_week();
begin
  select count(*) into n_nudge  from public.v_needs_nudge;
  select count(*) into n_pledge from public.v_needs_pledge;

  select string_agg(x.line, E'\n') into top_line from (
    select h.emoji || ' ' || h.name || ' เฉลี่ย ' || b.avg_contents || ' ชิ้น' as line
    from public.v_house_board b join public.houses h on h.id = b.id
    order by b.avg_rate desc limit 4
  ) x;

  insert into public.notifications (kind, payload)
  values ('daily_digest', jsonb_build_object(
    'day',            public.day_of(now()),
    'week',           cw,
    'not_posted',     n_nudge,
    'no_pledge',      n_pledge,
    'houses',         coalesce(top_line,''),
    'names',          coalesce((select string_agg(name, ', ' order by name)
                                from (select name from public.v_needs_nudge limit 25) y), '')
  ));
  return n_nudge;
end $fn$;

-- ------------------------------------------------------------
-- 4. ตั้งเวลาให้รันเอง (ต้องเปิด extension ก่อน)
-- ------------------------------------------------------------
-- Supabase Dashboard → Database → Extensions → เปิด pg_cron และ pg_net
--
--   select cron.schedule('daily-digest', '0 14 * * *', $cron$
--     select public.enqueue_daily_digest();
--   $cron$);
--
-- 14:00 UTC = 21:00 เวลาไทย
--
-- แล้วให้ Edge Function มาหยิบคิวไปส่งทุก 5 นาที:
--
--   select cron.schedule('drain-notifications', '*/5 * * * *', $cron$
--     select net.http_post(
--       url     := 'https://<PROJECT-REF>.supabase.co/functions/v1/notify',
--       headers := jsonb_build_object('Authorization','Bearer <SERVICE_ROLE_KEY>',
--                                     'Content-Type','application/json'),
--       body    := '{}'::jsonb);
--   $cron$);
--
-- ดูงานที่ตั้งไว้:  select * from cron.job;
-- ยกเลิก:          select cron.unschedule('daily-digest');

-- ------------------------------------------------------------
-- 5. ตรวจด้วยมือก่อนเปิดอัตโนมัติ
-- ------------------------------------------------------------
--   select * from public.v_needs_nudge order by pace;
--   select public.enqueue_daily_digest();
--   select * from public.notifications order by id desc limit 5;
