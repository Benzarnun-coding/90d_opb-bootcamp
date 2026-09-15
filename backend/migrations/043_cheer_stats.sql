-- ============================================================
-- 043: สรุปเชียร์ต่อคน (แก้เควส "เชียร์เพื่อน 3 คน" ไม่ขึ้น)
--
-- อาการ (15 ก.ย.): กดเชียร์แล้วภารกิจยังเป็น 0/3 และ "เชียร์คนนี้ไปแล้ว" ไม่จำ
-- สาเหตุ: หน้าเว็บดึงตาราง cheers ทั้งก้อนมานับเอง แต่ PostgREST ส่งได้สูงสุด 1,000 แถว
--        พอเชียร์ทั้งรุ่นเกิน 1,000 ครั้ง (ตอนนี้ 1,052) แถวใหม่สุด (ของวันนี้) ถูกตัดทิ้ง
-- แก้: ให้ฐานข้อมูลนับให้ (view นี้) ส่วนหน้าเว็บดึงเฉพาะเชียร์ของ 2 วันล่าสุดไว้ใช้กับเควสวันนี้
-- รันหลัง 042
-- ============================================================

create or replace view public.v_cheer_stats as
with g as (
  select from_id as profile_id, day_index, count(*) as n
  from public.cheers group by 1, 2
),
sd as (
  select profile_id, day_index from public.submissions group by 1, 2
)
select p.id as profile_id,
       coalesce((select sum(n) from g where g.profile_id = p.id), 0)::int                    as given,
       coalesce((select count(*) from public.cheers c where c.to_id = p.id), 0)::int           as received,
       coalesce((select count(*) from g
                 where g.profile_id = p.id and g.n >= 3
                   and exists (select 1 from sd where sd.profile_id = p.id and sd.day_index = g.day_index)), 0)::int as quest_days
from public.profiles p;
grant select on public.v_cheer_stats to anon, authenticated;

select count(*) as cheers_total, max(day_index) as latest_day from public.cheers;
select * from public.v_cheer_stats order by given desc limit 5;
