-- ============================================================
-- บทลงโทษแบบเบา: รับเป้า 4 หรือ 7 แล้วทำไม่ถึง → สัปดาห์ถัดไปเป็น "ร่างหมดแรง ผอมแห้ง"
-- (ต่างจากกระโหลก: เลือกเป้าได้ปกติ แค่หน้าตาโทรมทั้งสัปดาห์)
-- หน้าเว็บดึง view นี้ไปวาดตัวละคร ไม่มี trigger ฝั่งเซิร์ฟเวอร์
-- รันหลัง 001-017
-- ============================================================
create or replace view public.v_weak as
select wp.profile_id,
       wp.target  as failed_target,
       wp.done    as failed_done,
       wp.week_no as failed_week
from public.v_week_progress wp, public.cohort c
where c.id = 1
  and wp.week_no = public.current_week() - 1
  and wp.target < c.heavy_target
  and not wp.hit;

grant select on public.v_weak to anon, authenticated;

select 'ok' as status, (select count(*) from public.v_weak) as weak_now;
