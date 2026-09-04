-- ============================================================
-- King of the Week — ที่ 1 ของแต่ละบ้านในแต่ละสัปดาห์ที่จบแล้ว
-- (ชิ้นที่นับได้ในสัปดาห์นั้นมากสุด ต้องรับเป้าไว้ · เสมอกันให้คนที่ยอดรวมมากกว่า)
-- หน้าเว็บ: คนนี้ได้ป้าย KING OF WEEK และประวัติในโปรไฟล์
-- ส่วน King "สด" ของสัปดาห์ปัจจุบัน หน้าเว็บคิดเองจาก v_leaderboard (week_done)
-- รันหลัง 001-020
-- ============================================================
create or replace view public.v_week_kings as
select distinct on (wp.week_no, p.house_id)
       wp.week_no, p.house_id, p.id as profile_id, p.name, wp.done
from public.v_week_progress wp
join public.profiles p on p.id = wp.profile_id
left join (select profile_id, count(*) as total from public.v_counted group by profile_id) t on t.profile_id = p.id
where p.role = 'student' and p.house_id is not null
  and wp.week_no < public.current_week()
  and wp.done > 0
order by wp.week_no, p.house_id, wp.done desc, coalesce(t.total,0) desc, p.created_at;

grant select on public.v_week_kings to anon, authenticated;

select 'ok' as status, (select count(*) from public.v_week_kings) as kings_so_far;
