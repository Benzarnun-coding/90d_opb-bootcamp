-- ============================================================
-- ⏰ ย้ายสรุปสัปดาห์ไปส่งตอนพุธ 19:15 (ก่อนไลฟ์ 15 นาที) แทน 19:45
--    เดิมสรุป "สัปดาห์ที่จบไปแล้ว" · ใหม่สรุป "สัปดาห์ที่กำลังจะปิด" ให้อ่านสดในไลฟ์ได้เลย
--    King / ถ้วยบ้าน คิดสดจาก v_counted (ไม่ต้องรอสัปดาห์ปิด) · น้องกระดูกขึ้นเป็น "ถ้าปิดรอบตอนนี้"
--    ยังเรียกย้อนหลังได้: weekly_awards_text(3) = สัปดาห์ที่ 3 (ถ้าจบแล้วจะใช้ข้อความแบบประกาศผล)
-- รันหลัง 034
-- ============================================================
create or replace function public.weekly_awards_text(w int default null)
returns text language plpgsql security definer set search_path = public as $fn$
declare
  wk int := coalesce(w, public.current_week());          -- ปกติ = สัปดาห์ที่กำลังจะปิด (ส่ง 19:15 ก่อนไลฟ์)
  live boolean;
  t text; kings text; taking text; cup text; pop text; stars text; climb text; hits text; bones text;
  d0 int; d1 int; snap_day int; pc record;
  site text := 'https://opb-bootcamp.netlify.app';
begin
  if auth.uid() is not null and not (public.is_head_coach() or public.is_ta()) then raise exception 'เฉพาะหัวหน้าโค้ชหรือ TA เท่านั้น'; end if;
  if wk < 1 then return null; end if;
  live := wk >= public.current_week();
  d0 := (wk - 1) * 7 + 1; d1 := wk * 7;

  /* 👑 King ของแต่ละบ้าน = ส่งเยอะสุด (คิดสดได้ทุกสัปดาห์) */
  with tally as (
    select p.house_id, p.id, p.name, count(*) as done
    from public.v_counted v join public.profiles p on p.id = v.profile_id
    where v.week_no = wk and p.role = 'student' and p.house_id is not null
    group by p.house_id, p.id, p.name),
  top as (select distinct on (house_id) house_id, name, done from tally order by house_id, done desc, name)
  select string_agg(h.emoji || ' ' || h.name || ': **' || tp.name || '** ' || tp.done || ' ชิ้น', E'\n' order by h.id) into kings
  from top tp join public.houses h on h.id = tp.house_id;

  /* 🟢 King of TA */
  with tally as (
    select p.house_id, p.name, count(*) as done
    from public.v_counted v join public.profiles p on p.id = v.profile_id
    where v.week_no = wk and p.role = 'coach' and p.house_id is not null
    group by p.house_id, p.name)
  select h.emoji || ' **' || tl.name || '** (' || h.name || ') ' || tl.done || ' ชิ้น' into taking
  from tally tl join public.houses h on h.id = tl.house_id order by tl.done desc, tl.name limit 1;

  /* 🏆 ถ้วยบ้าน = ชิ้นเฉลี่ยต่อคนมากสุด */
  with mem as (select house_id, count(*) as n from public.profiles where role = 'student' and house_id is not null group by house_id),
  wkp as (select p.house_id, count(*) as pieces from public.v_counted v join public.profiles p on p.id = v.profile_id
          where v.week_no = wk and p.role = 'student' and p.house_id is not null group by p.house_id)
  select h.emoji || ' **' || h.name || '** เฉลี่ย ' || round(wkp.pieces::numeric / greatest(mem.n, 1), 2) || ' ชิ้น/คน (' || wkp.pieces || ' ชิ้น)' into cup
  from wkp join mem on mem.house_id = wkp.house_id join public.houses h on h.id = wkp.house_id
  order by (wkp.pieces::numeric / greatest(mem.n, 1)) desc, wkp.pieces desc limit 1;

  /* 💖 Popular Vote */
  select string_agg(x.line, E'\n') into pop from (
    select (row_number() over (order by n desc, fans desc))::text || '. **' || p.name || '** ' || n || ' เชียร์ จาก ' || fans || ' คน' as line
    from (select c.to_id, count(*) as n, count(distinct c.from_id) as fans from public.cheers c
          where c.day_index between d0 and d1 group by c.to_id order by n desc, fans desc limit 3) y
    join public.profiles p on p.id = y.to_id) x;

  /* 🏅 นักเรียนดีเด่น (ส่งช่วงปิดเทอม) */
  select string_agg(p.name || ' (' || y.n || ')', ', ' order by y.n desc, p.name) into stars from (
    select v.profile_id, count(*) as n from public.v_counted v
    where v.day_index between d0 and d1 and public.is_vacation_day(v.day_index) group by v.profile_id order by n desc limit 8) y
  join public.profiles p on p.id = y.profile_id;

  /* 🚀 ไต่อันดับเร็วสุด */
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
      from (select v.profile_id, count(*) as n from public.v_counted v join public.profiles p2 on p2.id = v.profile_id
            where v.week_no = wk and p2.role = 'student' group by v.profile_id order by n desc limit 3) y
      join public.profiles p on p.id = y.profile_id) x;
  end if;

  /* 🎯 ครบเป้า */
  select 'ครบเป้าแล้ว **' || count(*) filter (where wp.hit) || '/' || count(*) || ' คน**' into hits
  from public.v_week_progress wp join public.profiles p on p.id = wp.profile_id where wp.week_no = wk and p.role = 'student';
  select string_agg(tier, ' · ' order by target) into t from (
    select wp.target, wp.target || ' ชิ้น: ' || count(*) filter (where wp.hit) || '/' || count(*) as tier
    from public.v_week_progress wp join public.profiles p on p.id = wp.profile_id where wp.week_no = wk and p.role = 'student' group by wp.target) q;
  hits := coalesce(hits, 'ยังไม่มีข้อมูล') || case when t is not null then E'\n' || t else '' end;

  /* 🦴 น้องกระดูก (นับอย่างเดียว ไม่บอกชื่อ) */
  select * into pc from public.week_punish_count(wk);
  if pc.vacation then
    bones := '🏖 สัปดาห์ปิดเทอม ไม่มีใครโดนลงโทษ';
  elsif live then
    bones := '🦴 **ถ้าปิดรอบตอนนี้** จะกลายร่างเป็นน้องกระดูก **' || coalesce(pc.bones, 0) || ' คน** · 😵 หมดแรง **' || coalesce(pc.weak, 0) || ' คน**'
          || E'\nเหลืออีก 15 นาที ใครยังขาดอยู่รีบปล่อยงาน!';
  else
    bones := '🦴 กลายร่างเป็นน้องกระดูก **' || coalesce(pc.bones, 0) || ' คน** · 😵 หมดแรง **' || coalesce(pc.weak, 0) || ' คน**'
          || case when coalesce(pc.bones,0) + coalesce(pc.weak,0) = 0 then E'\nสัปดาห์นี้ไม่มีใครร่างพัง 🎉' else E'\nทำครบเป้าสัปดาห์หน้าแล้วร่างจะกลับมาปกติ' end;
  end if;

  t := case when live then '📊 **สรุปก่อนไลฟ์ · สัปดาห์ที่ ' || wk || '**' || E'\n(ยอด ณ 19:15 · ปิดรับงาน 19:30)'
            else '🏆 **WEEKLY AWARDS · สัปดาห์ที่ ' || wk || '**' end || E'\n\n'
    || '👑 **KING OF THE WEEK** (ส่งเยอะสุดของบ้าน)' || E'\n' || coalesce(kings, 'ยังไม่มีใครส่ง') || E'\n\n'
    || '🟢 **KING OF TA** ' || coalesce(taking, 'ยังไม่มี') || E'\n\n'
    || '🏆 **HOUSE CUP** ' || coalesce(cup, 'ยังไม่มี') || E'\n\n'
    || '💖 **POPULAR VOTE**' || E'\n' || coalesce(pop, 'ยังไม่มีใครกดเชียร์') || E'\n\n'
    || case when stars is not null then '🏅 **นักเรียนดีเด่น** (ส่งงานช่วงปิดเทอม)' || E'\n' || stars || E'\n\n' else '' end
    || '🚀 **ไต่อันดับเร็วสุด**' || E'\n' || coalesce(climb, 'ยังไม่มี') || E'\n\n'
    || '🎯 ' || hits || E'\n\n'
    || bones || E'\n\n'
    || case when live then 'เจอกันในไลฟ์ 19:30 · ส่งงานให้ทันได้ที่ ' || site
            else 'สัปดาห์ที่ ' || (wk + 1) || ' เริ่มแล้ว เข้าไปเลือกเป้าใหม่ได้เลย 👉 ' || site end;
  return t;
end $fn$;
grant execute on function public.weekly_awards_text(int) to authenticated;

create or replace function public.send_weekly_awards()
returns void language plpgsql security definer set search_path = public as $fn$
declare t text; wk int := public.current_week();
begin
  if not public.has_started() then return; end if;
  if exists (select 1 from public.notifications n where n.kind = 'weekly_awards' and n.payload ->> 'week' = wk::text) then return; end if;
  t := public.weekly_awards_text(wk);
  if t is null then return; end if;
  begin
    perform public.notify_discord(t);
    insert into public.notifications (kind, payload, sent_at) values ('weekly_awards', jsonb_build_object('week', wk), now());
  exception when others then raise notice 'weekly awards not sent: %', sqlerrm;
  end;
end $fn$;

-- ทุกพุธ 12:15 UTC = 19:15 ไทย (ก่อนตัดรับ 19:30 · ก่อนไลฟ์)
select cron.unschedule('discord-awards') where exists (select 1 from cron.job where jobname = 'discord-awards');
select cron.schedule('discord-awards', '15 12 * * 3', $cron$ select public.send_weekly_awards(); $cron$);

select public.weekly_awards_text() as preview_now;
