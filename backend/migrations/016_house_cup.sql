-- ============================================================
-- ถ้วยบ้านรายสัปดาห์
-- บ้านที่ "ชิ้นที่นับได้เฉลี่ยต่อนักเรียน" สูงสุดในสัปดาห์ที่จบไปแล้ว ได้ถ้วยของสัปดาห์นั้น
-- เฉลี่ยต่อคน ไม่ใช่ผลรวม บ้านคนน้อยไม่เสียเปรียบ (โค้ช/TA ไม่นับ)
-- หน้าเว็บดึง view นี้ (≤ 12 แถว) ไปโชว์มงกุฎบนสนาม + ป้าย HOUSE CUP
-- รันหลัง 001-015
-- ============================================================
create or replace view public.v_house_cup as
with mem as (
  select house_id, count(*) as n
  from public.profiles
  where role = 'student' and house_id is not null
  group by house_id
),
wk as (
  select p.house_id, v.week_no, count(*) as pieces
  from public.v_counted v
  join public.profiles p on p.id = v.profile_id
  where p.role = 'student' and p.house_id is not null
    and v.week_no < public.current_week()
  group by p.house_id, v.week_no
),
avgs as (
  select wk.week_no, wk.house_id, wk.pieces, mem.n as members,
         round(wk.pieces::numeric / greatest(mem.n, 1), 2) as avg_pieces
  from wk join mem on mem.house_id = wk.house_id
)
select distinct on (week_no) week_no, house_id, avg_pieces, pieces, members
from avgs
order by week_no, avg_pieces desc, pieces desc, house_id;

grant select on public.v_house_cup to anon, authenticated;

select 'ok' as status, (select count(*) from public.v_house_cup) as cups_so_far;
