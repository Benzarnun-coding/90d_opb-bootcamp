-- 060: บันทึกคริติคอลรายครั้ง (ใครติด ×3/×5/×10 ไปกี่ครั้ง เมื่อไหร่) — ไว้โชว์ตอนชี้เมาส์ที่ปุ่ม "คริติคอล" และให้โค้ชตรวจรางวัลหนังสือ (×10)
-- นับเฉพาะชิ้นที่นับเป็นดาเมจจริง (v_counted) ของนักรบที่ตีบอสได้ ตรงกับ v_boss_hits · รันหลัง 059c
create or replace view public.v_crit_log as
select b.id as boss_id, v.profile_id, s.crit::int as crit, v.created_at
from public.bosses b
join public.v_counted v on v.week_no = b.week_no
join public.submissions s on s.id = v.id
join public.profiles p on p.id = v.profile_id
where s.crit > 1
  and (p.role = 'student' or (p.role = 'coach' and p.house_id is not null))
  and (b.house_id is null or p.house_id = b.house_id);
grant select on public.v_crit_log to anon, authenticated;
notify pgrst, 'reload schema';

select 'crit log ok' as ok, count(*) as crits, count(*) filter (where crit = 10) as x10 from public.v_crit_log;
