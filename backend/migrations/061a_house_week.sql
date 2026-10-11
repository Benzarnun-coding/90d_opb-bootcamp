-- 061a: คะแนนบ้านรายสัปดาห์แบบแฟร์ (กติกาใหม่แทน "ชิ้นเฉลี่ยต่อนักเรียนทุกคน") · รันก่อน 061b/061c
-- รายคน: คะแนน = min(100%, ชิ้นที่ทำ / เป้าที่เลือก) · ไม่ได้เลือกเป้า = วัดกับ 7 ชิ้น · ครบเป้า = ชิ้น >= เป้า
-- สมาชิกที่นับ = เลือกเป้าสัปดาห์นั้น หรือส่งงานอย่างน้อย 1 ชิ้นใน 3 สัปดาห์ล่าสุด (คนที่หายไปนานไม่ถูกนับ)
-- บ้าน: คะแนน = 50% ค่าเฉลี่ย % ของเป้า + 50% สัดส่วนคนที่ครบเป้า · แต้มสัปดาห์ 4/3/2/1 ตามอันดับ · ข้ามสัปดาห์ปิดเทอม
create or replace view public.v_house_week as
with wks as (
  select w as week_no from generate_series(1, public.current_week()) w
  where w <> coalesce((select vacation_week from public.cohort where id = 1), -1)
), st as (
  select id as profile_id, house_id from public.profiles where role = 'student' and house_id is not null
), cnt as (
  select profile_id, week_no, count(*)::int as n from public.v_counted group by profile_id, week_no
), m as (
  select s.house_id, s.profile_id, w.week_no, coalesce(c.n, 0) as pieces, coalesce(pl.target, 7) as tgt
  from st s cross join wks w
  left join cnt c on c.profile_id = s.profile_id and c.week_no = w.week_no
  left join public.pledges pl on pl.profile_id = s.profile_id and pl.week_no = w.week_no
  where pl.target is not null
     or exists (select 1 from cnt c2 where c2.profile_id = s.profile_id and c2.week_no between w.week_no - 2 and w.week_no)
), agg as (
  select house_id, week_no, count(*)::int as active, (count(*) filter (where pieces >= tgt))::int as hit,
         sum(pieces)::int as pieces, avg(least(1.0, pieces::numeric / tgt)) as pct
  from m group by house_id, week_no
), sc as (
  select a.*, round(100 * (0.5 * a.pct + 0.5 * a.hit::numeric / a.active), 1) as score from agg a
), rk as (
  select sc.*, rank() over (partition by week_no order by score desc, pieces desc) as r from sc
)
select week_no, house_id, active, hit, pieces, round(pct * 100, 1) as pct, score,
       r::int as rk, greatest(0, 5 - r)::int as points, (week_no < public.current_week()) as is_final
from rk;
grant select on public.v_house_week to anon, authenticated;
notify pgrst, 'reload schema';

select week_no, house_id, active, hit, score, rk, points, is_final from public.v_house_week order by week_no, rk;
