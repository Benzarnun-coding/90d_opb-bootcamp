-- ============================================================
-- 051: TA ตีบอสได้ด้วย
--
-- ที่มา (24 ก.ย. 00:30): คืนเปิดบอสตัวแรก TA หลายคนส่งงานเพื่อตีบอส (PHON, DEWKO AI, M.WRITE, SAMA-ฟลุ๊ค)
--        แต่ view ของ 022 นับเฉพาะ role = 'student' Benz ตัดสินใจให้ TA ตีได้
-- กติกาใหม่: นับนักเรียน + TA (โค้ชที่ประจำบ้าน) · หัวหน้าโค้ช (ไม่มีบ้าน) ยังไม่นับ
--   เงื่อนไข "นักรบ" = (p.role = 'student' or (p.role = 'coach' and p.house_id is not null))
-- มีผลย้อนหลังทันที: ชิ้นที่ TA ส่งไปแล้วในสัปดาห์ของบอสจะกลายเป็นดาเมจเอง ไม่ต้อง deploy
-- ทำแบบ drop แล้วสร้างใหม่ทั้ง 3 view (kills/hits พึ่ง progress จึงต้อง drop ก่อนตามลำดับ)
-- รันหลัง 050
-- ============================================================

drop view if exists public.v_boss_kills;
drop view if exists public.v_boss_hits;
drop view if exists public.v_boss_progress;

create view public.v_boss_progress as
select b.*,
       (select count(*) from public.v_counted v join public.profiles p on p.id = v.profile_id
         where v.week_no = b.week_no
           and (p.role = 'student' or (p.role = 'coach' and p.house_id is not null))
           and (b.house_id is null or p.house_id = b.house_id)) as damage,
       (select count(distinct v.profile_id) from public.v_counted v join public.profiles p on p.id = v.profile_id
         where v.week_no = b.week_no
           and (p.role = 'student' or (p.role = 'coach' and p.house_id is not null))
           and (b.house_id is null or p.house_id = b.house_id)) as fighters
from public.bosses b;
grant select on public.v_boss_progress to anon, authenticated;

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

-- เช็ค: damage ต้องขยับขึ้นจาก 18 (TA ที่ส่งไปแล้วถูกนับเพิ่ม) · sum_hits = damage · ta_fighters > 0
select bp.id, bp.name, bp.hp, bp.damage, bp.fighters,
       (select sum(hits) from public.v_boss_hits x where x.boss_id = bp.id) as sum_hits,
       (select count(*) from public.v_boss_hits x join public.profiles p on p.id = x.profile_id where x.boss_id = bp.id and p.role = 'coach') as ta_fighters
from public.v_boss_progress bp order by bp.week_no;
