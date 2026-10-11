-- 061b: ถ้วยบ้านรายสัปดาห์ = อันดับ 1 ของ v_house_week (หน้าเว็บอ่าน view เดิมชื่อเดิม) · รันหลัง 061a
-- avg_pieces = ชิ้นเฉลี่ยต่อสมาชิกที่นับ · members = จำนวนสมาชิกที่นับ · score = คะแนนบ้านใหม่
create or replace view public.v_house_cup as
select distinct on (week_no) week_no, house_id,
       round(pieces::numeric / greatest(active, 1), 2) as avg_pieces,
       pieces::bigint as pieces, active::bigint as members, score
from public.v_house_week
where is_final
order by week_no, rk, pieces desc, house_id;
grant select on public.v_house_cup to anon, authenticated;

create or replace function public.house_cup_line(wk int)
returns text language sql stable security definer set search_path = public as $$
  select h.emoji || ' **' || h.name || '** คะแนน ' || w.score || ' (ครบเป้า ' || w.hit || '/' || w.active || ' คน · ' || w.pieces || ' ชิ้น)'
  from public.v_house_week w join public.houses h on h.id = w.house_id
  where w.week_no = wk order by w.rk, w.pieces desc limit 1;
$$;
grant execute on function public.house_cup_line(int) to authenticated;
notify pgrst, 'reload schema';

select week_no, house_id, avg_pieces, members, score from public.v_house_cup order by week_no;
