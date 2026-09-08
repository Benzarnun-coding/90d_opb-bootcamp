-- ============================================================
-- 👑 King of the Week: คิดจาก "ส่งได้เยอะที่สุดในสัปดาห์นั้น" ตรง ๆ
--    เดิมต้องรับเป้าไว้ก่อนถึงจะเป็น King ได้ (ดึงจาก v_week_progress ซึ่งมาจาก pledges)
--    ใหม่: นับชิ้นที่ส่งจริงทุกคน ไม่ว่าจะรับเป้าไว้หรือไม่
-- 🟢 King of TA: แยกรางวัลของ TA ออกมาต่างหาก · TA ไม่ไปแย่งรางวัลของนักเรียน
-- 🦴 รายงานใน Discord: สัปดาห์นี้กลายร่างเป็นน้องกระดูกกี่คน (ไม่บอกชื่อ)
-- รันหลัง 033
-- ============================================================

-- ---------- 1. King ของแต่ละบ้าน = ส่งเยอะสุดในสัปดาห์นั้น ----------
create or replace view public.v_week_kings as
select distinct on (x.week_no, x.house_id)
       x.week_no::smallint as week_no, x.house_id, x.profile_id, x.name, x.done::bigint as done
from (
  select v.week_no, p.house_id, p.id as profile_id, p.name, count(*) as done,
         coalesce(t.total, 0) as total, p.created_at
  from public.v_counted v
  join public.profiles p on p.id = v.profile_id
  left join (select profile_id, count(*) as total from public.v_counted group by profile_id) t on t.profile_id = p.id
  where p.role = 'student' and p.house_id is not null
  group by v.week_no, p.house_id, p.id, p.name, t.total, p.created_at
) x
where x.week_no < public.current_week() and x.done > 0
order by x.week_no, x.house_id, x.done desc, x.total desc, x.created_at;
grant select on public.v_week_kings to anon, authenticated;

-- ---------- 2. King of TA = TA ที่ส่งเยอะสุดของสัปดาห์นั้น (ทั้งรุ่น) ----------
create or replace view public.v_week_ta_kings as
select distinct on (x.week_no)
       x.week_no::smallint as week_no, x.house_id, x.profile_id, x.name, x.done::bigint as done
from (
  select v.week_no, p.house_id, p.id as profile_id, p.name, count(*) as done,
         coalesce(t.total, 0) as total, p.created_at
  from public.v_counted v
  join public.profiles p on p.id = v.profile_id
  left join (select profile_id, count(*) as total from public.v_counted group by profile_id) t on t.profile_id = p.id
  where p.role = 'coach' and p.house_id is not null            -- TA ประจำบ้าน (ไม่รวมหัวหน้าโค้ช)
  group by v.week_no, p.house_id, p.id, p.name, t.total, p.created_at
) x
where x.week_no < public.current_week() and x.done > 0
order by x.week_no, x.done desc, x.total desc, x.created_at;
grant select on public.v_week_ta_kings to anon, authenticated;

-- ---------- 3. นับคนที่โดนลงโทษของสัปดาห์นั้น (ไม่เอาชื่อ) ----------
create or replace function public.week_punish_count(wk int)
returns table (bones int, weak int, vacation boolean)
language sql stable as $fn$
  select
    (select count(*) from public.v_week_progress wp
       join public.profiles p on p.id = wp.profile_id, public.cohort c
      where c.id = 1 and wp.week_no = wk and p.role = 'student' and wp.target >= c.heavy_target and not wp.hit)::int,
    (select count(*) from public.v_week_progress wp
       join public.profiles p on p.id = wp.profile_id, public.cohort c
      where c.id = 1 and wp.week_no = wk and p.role = 'student' and wp.target <  c.heavy_target and not wp.hit)::int,
    (wk = coalesce((select vacation_week from public.cohort where id = 1), -1));
$fn$;
grant execute on function public.week_punish_count(int) to authenticated;

-- ---------- 4. ข้อความ Weekly Awards ----------
create or replace function public.weekly_awards_text(w int default null)
returns text language plpgsql security definer set search_path = public as $fn$
declare
  wk int := coalesce(w, public.current_week() - 1);
  t text; kings text; taking text; cup text; pop text; stars text; climb text; hits text; bones text;
  d0 int; d1 int; snap_day int; cup_h record; pc record;
  site text := 'https://opb-bootcamp.netlify.app';
begin
  if auth.uid() is not null and not (public.is_head_coach() or public.is_ta()) then raise exception 'เฉพาะหัวหน้าโค้ชหรือ TA เท่านั้น'; end if;
  if wk < 1 then return null; end if;
  d0 := (wk - 1) * 7 + 1; d1 := wk * 7;

  /* 👑 King ของแต่ละบ้าน (นักเรียนเท่านั้น) */
  select string_agg(h.emoji || ' ' || h.name || ': **' || k.name || '** ' || k.done || ' ชิ้น', E'\n' order by h.id) into kings
  from public.v_week_kings k join public.houses h on h.id = k.house_id where k.week_no = wk;

  /* 🟢 King of TA */
  select h.emoji || ' **' || k.name || '** (' || h.name || ') ' || k.done || ' ชิ้น' into taking
  from public.v_week_ta_kings k join public.houses h on h.id = k.house_id where k.week_no = wk;

  /* 🏆 ถ้วยบ้าน */
  select c.*, h.emoji, h.name as hname into cup_h from public.v_house_cup c join public.houses h on h.id = c.house_id where c.week_no = wk;
  if found then cup := cup_h.emoji || ' **' || cup_h.hname || '** เฉลี่ย ' || cup_h.avg_pieces || ' ชิ้น/คน (' || cup_h.pieces || ' ชิ้น)'; end if;

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
  select 'ครบเป้า **' || count(*) filter (where wp.hit) || '/' || count(*) || ' คน**' into hits
  from public.v_week_progress wp join public.profiles p on p.id = wp.profile_id where wp.week_no = wk and p.role = 'student';
  select string_agg(tier, ' · ' order by target) into t from (
    select wp.target, wp.target || ' ชิ้น: ' || count(*) filter (where wp.hit) || '/' || count(*) as tier
    from public.v_week_progress wp join public.profiles p on p.id = wp.profile_id where wp.week_no = wk and p.role = 'student' group by wp.target) q;
  hits := coalesce(hits, 'ยังไม่มีข้อมูล') || case when t is not null then E'\n' || t else '' end;

  /* 🦴 น้องกระดูก (ไม่บอกชื่อ) */
  select * into pc from public.week_punish_count(wk);
  if pc.vacation then
    bones := '🏖 สัปดาห์ปิดเทอม ไม่มีใครโดนลงโทษ';
  else
    bones := '🦴 กลายร่างเป็นน้องกระดูก **' || coalesce(pc.bones, 0) || ' คน**'
          || ' · 😵 หมดแรง **' || coalesce(pc.weak, 0) || ' คน**'
          || case when coalesce(pc.bones,0) + coalesce(pc.weak,0) = 0 then E'\nสัปดาห์นี้ไม่มีใครร่างพัง 🎉' else E'\nทำครบเป้าสัปดาห์หน้าแล้วร่างจะกลับมาปกติ' end;
  end if;

  t := '🏆 **WEEKLY AWARDS · สัปดาห์ที่ ' || wk || '**' || E'\n\n'
    || '👑 **KING OF THE WEEK** (ส่งเยอะสุดของบ้าน)' || E'\n' || coalesce(kings, 'ไม่มี') || E'\n\n'
    || '🟢 **KING OF TA** ' || coalesce(taking, 'ไม่มี') || E'\n\n'
    || '🏆 **HOUSE CUP** ' || coalesce(cup, 'ไม่มี') || E'\n\n'
    || '💖 **POPULAR VOTE**' || E'\n' || coalesce(pop, 'ยังไม่มีใครกดเชียร์') || E'\n\n'
    || case when stars is not null then '🏅 **นักเรียนดีเด่น** (ส่งงานช่วงปิดเทอม)' || E'\n' || stars || E'\n\n' else '' end
    || '🚀 **ไต่อันดับเร็วสุด**' || E'\n' || coalesce(climb, 'ไม่มี') || E'\n\n'
    || '🎯 ' || hits || E'\n\n'
    || bones || E'\n\n'
    || 'สัปดาห์ที่ ' || (wk + 1) || ' เริ่มแล้ว เข้าไปเลือกเป้าใหม่ได้เลย 👉 ' || site;
  return t;
end $fn$;
grant execute on function public.weekly_awards_text(int) to authenticated;

select public.weekly_awards_text(1) as preview;
