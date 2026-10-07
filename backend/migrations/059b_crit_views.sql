-- 059b: Critical hit (ส่วน 2/2) — ดาเมจบอส = ผลรวมของตัวคูณ แทนการนับชิ้น (รันหลัง 059a)
-- hits ใน v_boss_hits ตอนนี้ = ดาเมจ (รวมคริ) · posts = จำนวนชิ้น · crits = จำนวนครั้งที่ติด · best_crit = ตัวคูณสูงสุด
drop view if exists public.v_boss_kills;
drop view if exists public.v_boss_hits;
drop view if exists public.v_boss_progress;

create view public.v_boss_progress as
select b.*,
  (select coalesce(sum(s.crit), 0)::bigint from public.v_counted v join public.submissions s on s.id = v.id join public.profiles p on p.id = v.profile_id
    where v.week_no = b.week_no and (p.role = 'student' or (p.role = 'coach' and p.house_id is not null)) and (b.house_id is null or p.house_id = b.house_id)) as damage,
  (select count(distinct v.profile_id) from public.v_counted v join public.profiles p on p.id = v.profile_id
    where v.week_no = b.week_no and (p.role = 'student' or (p.role = 'coach' and p.house_id is not null)) and (b.house_id is null or p.house_id = b.house_id)) as fighters,
  (select count(*) filter (where s.crit > 1)::int from public.v_counted v join public.submissions s on s.id = v.id join public.profiles p on p.id = v.profile_id
    where v.week_no = b.week_no and (p.role = 'student' or (p.role = 'coach' and p.house_id is not null)) and (b.house_id is null or p.house_id = b.house_id)) as crits
from public.bosses b;
grant select on public.v_boss_progress to anon, authenticated;

create view public.v_boss_kills as
select bp.id as boss_id, bp.week_no, bp.name, v.profile_id
from public.v_boss_progress bp
join public.v_counted v on v.week_no = bp.week_no
join public.profiles p on p.id = v.profile_id
where bp.damage >= bp.hp and (p.role = 'student' or (p.role = 'coach' and p.house_id is not null)) and (bp.house_id is null or p.house_id = bp.house_id)
group by bp.id, bp.week_no, bp.name, v.profile_id;
grant select on public.v_boss_kills to anon, authenticated;

create view public.v_boss_hits as
with h as (
  select b.id as boss_id, b.hp, v.profile_id, v.day_index, v.created_at, s.crit,
         sum(s.crit) over (partition by b.id order by v.created_at, v.id) as cum,
         row_number() over (partition by b.id order by v.created_at, v.id) as n
  from public.bosses b
  join public.v_counted v on v.week_no = b.week_no
  join public.submissions s on s.id = v.id
  join public.profiles p on p.id = v.profile_id
  where (p.role = 'student' or (p.role = 'coach' and p.house_id is not null)) and (b.house_id is null or p.house_id = b.house_id)
), d as (
  select boss_id, profile_id, day_index, count(*)::int as c from h group by boss_id, profile_id, day_index
)
select h.boss_id, h.profile_id,
       sum(h.crit)::int as hits,
       count(*)::int as posts,
       (select count(*)::int from d where d.boss_id = h.boss_id and d.profile_id = h.profile_id) as days,
       (select max(c) from d where d.boss_id = h.boss_id and d.profile_id = h.profile_id) as best_day,
       bool_or(h.n = 1) as first_blood,
       bool_or(h.cum - h.crit < h.hp and h.cum >= h.hp) as last_hit,
       (count(*) filter (where h.crit > 1))::int as crits,
       max(h.crit)::int as best_crit,
       max(h.created_at) as last_at
from h group by h.boss_id, h.profile_id;
grant select on public.v_boss_hits to anon, authenticated;

-- เช็ค: ผลรวม hits ต้องเท่ากับ damage ของบอสทุกตัว
select bp.id, bp.name, bp.hp, bp.damage, bp.crits, (select sum(hits) from public.v_boss_hits x where x.boss_id = bp.id) as sum_hits
from public.v_boss_progress bp order by bp.week_no;
