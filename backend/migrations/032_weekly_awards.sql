-- ============================================================
-- 🏆 Weekly Awards → Discord ทุกพุธหลังตัดรับ (19:45 ไทย)
--   King ของแต่ละบ้าน · ถ้วยบ้าน · Popular Vote · นักเรียนดีเด่น (ถ้ามี) · คนไต่อันดับเร็วสุด · สรุปครบเป้า
--   weekly_awards_text(w) ดูตัวอย่างได้จากหน้า admin · send_weekly_awards() ยิงเอง
-- รันหลัง 031
-- ============================================================
create or replace function public.weekly_awards_text(w int default null)
returns text language plpgsql security definer set search_path = public as $fn$
declare
  wk int := coalesce(w, public.current_week() - 1);
  t text; kings text; cup text; pop text; stars text; climb text; hits text;
  d0 int; d1 int; snap_day int; cup_h record;
  site text := 'https://opb-bootcamp.netlify.app';
begin
  if auth.uid() is not null and not (public.is_head_coach() or public.is_ta()) then raise exception 'เฉพาะหัวหน้าโค้ชหรือ TA เท่านั้น'; end if;
  if wk < 1 then return null; end if;
  d0 := (wk - 1) * 7 + 1; d1 := wk * 7;                       -- วันในสัปดาห์นั้น (ตามวัน)

  /* 👑 King ของแต่ละบ้าน */
  select string_agg(h.emoji || ' ' || h.name || ': **' || k.name || '** ' || k.done || ' ชิ้น', E'\n' order by h.id) into kings
  from public.v_week_kings k join public.houses h on h.id = k.house_id where k.week_no = wk;

  /* 🏆 ถ้วยบ้าน */
  select c.*, h.emoji, h.name as hname into cup_h from public.v_house_cup c join public.houses h on h.id = c.house_id where c.week_no = wk;
  if found then cup := cup_h.emoji || ' **' || cup_h.hname || '** เฉลี่ย ' || cup_h.avg_pieces || ' ชิ้น/คน (' || cup_h.pieces || ' ชิ้น)'; end if;

  /* 💖 Popular Vote: เชียร์ที่ได้รับในสัปดาห์นั้น */
  select string_agg(x.line, E'\n') into pop from (
    select (row_number() over (order by n desc, fans desc))::text || '. **' || p.name || '** ' || n || ' เชียร์ จาก ' || fans || ' คน' as line
    from (select c.to_id, count(*) as n, count(distinct c.from_id) as fans from public.cheers c
          where c.day_index between d0 and d1 group by c.to_id order by n desc, fans desc limit 3) y
    join public.profiles p on p.id = y.to_id) x;

  /* 🏅 นักเรียนดีเด่น: ส่งงานในวันปิดเทอมของสัปดาห์นั้น */
  select string_agg(p.name || ' (' || y.n || ')', ', ' order by y.n desc, p.name) into stars from (
    select v.profile_id, count(*) as n from public.v_counted v
    where v.day_index between d0 and d1 and public.is_vacation_day(v.day_index) group by v.profile_id order by n desc limit 8) y
  join public.profiles p on p.id = y.profile_id;

  /* 🚀 ไต่อันดับเร็วสุด: อันดับ (ตามชิ้นรวม) ตอนต้นสัปดาห์จาก snapshot เทียบตอนนี้ · ถ้าไม่มี snapshot ใช้ชิ้นในสัปดาห์แทน */
  snap_day := d0 - 1;
  if exists (select 1 from public.daily_snapshots s where s.day_index = snap_day) then
    select string_agg(x.line, E'\n') into climb from (
      select '**' || name || '** ' || gain || ' อันดับ (' || old_rank || ' → ' || new_rank || ')' as line
      from (
        select p.name, o.rk as old_rank, n.rk as new_rank, o.rk - n.rk as gain
        from (select profile_id, rank() over (order by contents desc) as rk from public.daily_snapshots where day_index = snap_day and role = 'student') o
        join (select l.id as profile_id, rank() over (order by l.contents desc) as rk from public.v_leaderboard l join public.profiles p2 on p2.id = l.id where p2.role = 'student') n on n.profile_id = o.profile_id
        join public.profiles p on p.id = o.profile_id
        where o.rk > n.rk order by gain desc, n.rk limit 3) z) x;
  else
    select string_agg(x.line, E'\n') into climb from (
      select '**' || p.name || '** ' || y.n || ' ชิ้นในสัปดาห์เดียว' as line
      from (select v.profile_id, count(*) as n from public.v_counted v where v.week_no = wk group by v.profile_id order by n desc limit 3) y
      join public.profiles p on p.id = y.profile_id) x;
  end if;

  /* 🎯 ครบเป้า */
  select 'ครบเป้า **' || count(*) filter (where wp.hit) || '/' || count(*) || ' คน**' into hits
  from public.v_week_progress wp join public.profiles p on p.id = wp.profile_id where wp.week_no = wk and p.role = 'student';
  select string_agg(tier, ' · ' order by target) into t from (
    select wp.target, wp.target || ' ชิ้น: ' || count(*) filter (where wp.hit) || '/' || count(*) as tier
    from public.v_week_progress wp join public.profiles p on p.id = wp.profile_id where wp.week_no = wk and p.role = 'student' group by wp.target) q;
  hits := coalesce(hits, 'ยังไม่มีข้อมูล') || case when t is not null then E'\n' || t else '' end;

  t := '🏆 **WEEKLY AWARDS · สัปดาห์ที่ ' || wk || '**' || E'\n\n'
    || '👑 **KING OF THE WEEK**' || E'\n' || coalesce(kings, 'ไม่มี') || E'\n\n'
    || '🏆 **HOUSE CUP** ' || coalesce(cup, 'ไม่มี') || E'\n\n'
    || '💖 **POPULAR VOTE**' || E'\n' || coalesce(pop, 'ยังไม่มีใครกดเชียร์') || E'\n\n'
    || case when stars is not null then '🏅 **นักเรียนดีเด่น** (ส่งงานช่วงปิดเทอม)' || E'\n' || stars || E'\n\n' else '' end
    || '🚀 **ไต่อันดับเร็วสุด**' || E'\n' || coalesce(climb, 'ไม่มี') || E'\n\n'
    || '🎯 ' || hits || E'\n\n'
    || 'สัปดาห์ที่ ' || (wk + 1) || ' เริ่มแล้ว เข้าไปเลือกเป้าใหม่ได้เลย 👉 ' || site;
  return t;
end $fn$;
grant execute on function public.weekly_awards_text(int) to authenticated;

create or replace function public.send_weekly_awards()
returns void language plpgsql security definer set search_path = public as $fn$
declare t text; wk int := public.current_week() - 1;
begin
  if not public.has_started() or wk < 1 then return; end if;
  if exists (select 1 from public.notifications n where n.kind = 'weekly_awards' and n.payload ->> 'week' = wk::text) then return; end if;   -- กันส่งซ้ำ
  t := public.weekly_awards_text(wk);
  if t is null then return; end if;
  begin
    perform public.notify_discord(t);
    insert into public.notifications (kind, payload, sent_at) values ('weekly_awards', jsonb_build_object('week', wk), now());
  exception when others then raise notice 'weekly awards not sent: %', sqlerrm;
  end;
end $fn$;

-- ทุกพุธ 12:45 UTC = 19:45 ไทย (หลังตัดรับ 19:30)
select cron.unschedule('discord-awards') where exists (select 1 from cron.job where jobname = 'discord-awards');
select cron.schedule('discord-awards', '45 12 * * 3', $cron$ select public.send_weekly_awards(); $cron$);
