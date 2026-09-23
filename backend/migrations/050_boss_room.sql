-- ============================================================
-- 050: ห้องบอส — ใครตีบอสไปกี่ดาเมจ
--
-- ที่มา (23 ก.ย.): Benz อยากได้แท็บ "ห้องบอส" โชว์สถิติว่าใครโจมตีไปกี่แต้ม ใครตีแรงสุดในรอบนี้
-- v_boss_progress มีแค่ยอดรวมทั้งตัว ไฟล์นี้แตกเป็นรายคน กติกาเดียวกันเป๊ะ:
--   ชิ้นที่นับ (v_counted: approved + ไม่เกินวันละ max_per_day) ในสัปดาห์ของบอส · นักเรียนเท่านั้น · บ้านตรง (ถ้าบอสประจำบ้าน)
-- ผลรวม hits ของทุกคน = damage ใน v_boss_progress เสมอ
--
-- คอลัมน์:
--   hits        ดาเมจรวมของคนนั้น
--   days        ตีไปกี่วัน (วันที่ส่งอย่างน้อย 1 ชิ้น)
--   best_day    ตีหนักสุดในวันเดียวกี่ชิ้น (คอมโบ)
--   first_blood คนตีดาเมจแรกของบอส
--   last_hit    คนตีดาเมจที่ทำให้เลือดหมดพอดี (ชิ้นที่ hp) — เป็น false ทุกคนถ้ายังไม่ล้ม
--   last_at     ตีล่าสุดเมื่อไร (ไว้ตัดสินเสมอ: ใครถึงยอดนี้ก่อนได้อันดับดีกว่า)
-- รันหลัง 049 (หรือเมื่อไรก็ได้ ไม่พึ่งไฟล์อื่นนอกจาก 022/028)
-- ============================================================

create or replace view public.v_boss_hits as
with h as (
  select b.id as boss_id, b.hp, v.profile_id, v.day_index, v.created_at,
         row_number() over (partition by b.id order by v.created_at, v.id) as n
  from public.bosses b
  join public.v_counted v on v.week_no = b.week_no
  join public.profiles p  on p.id = v.profile_id
  where p.role = 'student' and (b.house_id is null or p.house_id = b.house_id)
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

-- เช็ค: ผลรวม hits ต้องเท่ากับ damage ของบอสทุกตัว
select bp.id, bp.name, bp.week_no, bp.hp, bp.damage,
       coalesce((select sum(hits) from public.v_boss_hits x where x.boss_id = bp.id), 0) as sum_hits
from public.v_boss_progress bp order by bp.week_no;
