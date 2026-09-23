-- ============================================================
-- 051b: ซ่อม view ห้องบอสหลังรัน 051 (24 ก.ย. 00:50)
--
-- อาการหลัง 051: v_boss_progress ถูกต้อง (damage 27, 17 คน) แต่
--   - v_boss_hits หายไป (PostgREST: "Could not find the table 'public.v_boss_hits'")
--   - v_boss_kills คืน 27 แถว ทั้งที่บอสยังไม่ล้ม (ควรว่าง)
-- ไฟล์นี้สร้าง 2 view นั้นใหม่ + สั่ง PostgREST โหลด schema ใหม่ + โชว์นิยามจริงให้ตรวจ
-- รันทั้งไฟล์ทีเดียว
-- ============================================================

drop view if exists public.v_boss_kills;
drop view if exists public.v_boss_hits;

create view public.v_boss_kills as
select bp.id as boss_id, bp.week_no, bp.name, v.profile_id
from public.v_boss_progress bp
join public.v_counted v on v.week_no = bp.week_no
join public.profiles p on p.id = v.profile_id
where bp.damage >= bp.hp
  and (p.role = 'student' or (p.role = 'coach' and p.house_id is not null))
  and (bp.house_id is null or p.house_id = bp.house_id)
group by bp.id, bp.week_no, bp.name, v.profile_id;
grant select on public.v_boss_kills to anon, authenticated;

create view public.v_boss_hits as
with h as (
  select b.id as boss_id, b.hp, v.profile_id, v.day_index, v.created_at,
         row_number() over (partition by b.id order by v.created_at, v.id) as n
  from public.bosses b
  join public.v_counted v on v.week_no = b.week_no
  join public.profiles p  on p.id = v.profile_id
  where (p.role = 'student' or (p.role = 'coach' and p.house_id is not null))
    and (b.house_id is null or p.house_id = b.house_id)
), d as (
  select boss_id, profile_id, day_index, count(*)::int as c
  from h group by boss_id, profile_id, day_index
)
select h.boss_id, h.profile_id,
       count(*)::int                                  as hits,
       (select count(*)::int from d where d.boss_id = h.boss_id and d.profile_id = h.profile_id) as days,
       (select max(c)        from d where d.boss_id = h.boss_id and d.profile_id = h.profile_id) as best_day,
       bool_or(h.n = 1)                               as first_blood,
       bool_or(h.n = h.hp)                            as last_hit,
       max(h.created_at)                              as last_at
from h
group by h.boss_id, h.profile_id;
grant select on public.v_boss_hits to anon, authenticated;

-- ให้ API เห็น view ใหม่ทันที
notify pgrst, 'reload schema';

-- ผลที่ควรได้: kills = 0 (บอสยังไม่ล้ม) · hits_people = 17 · sum_hits = 27 · ta_people = 4
select (select count(*) from public.v_boss_kills)                                   as kills,
       (select count(*) from public.v_boss_hits)                                    as hits_people,
       (select sum(hits) from public.v_boss_hits)                                   as sum_hits,
       (select count(*) from public.v_boss_hits x join public.profiles p on p.id = x.profile_id where p.role = 'coach') as ta_people,
       (select damage from public.v_boss_progress where id = 1)                     as damage;
