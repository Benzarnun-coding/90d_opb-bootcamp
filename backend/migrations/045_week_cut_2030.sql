-- ============================================================
-- 045: ย้ายเวลาตัดรับงาน/รับเป้าประจำสัปดาห์ จากพุธ 19:30 → พุธ 20:30 (เวลาไทย)
--
-- ทุกอย่างที่ผูกกับเส้นตัดสัปดาห์อ่านจาก cohort.week_cut_time (028) จึงเปลี่ยนที่เดียวพอ:
--   week_end_at(), current_week(), นับถอยหลังบนหน้าเว็บ (week_ends_at), โฟกัสแพลตฟอร์ม (037), ตัดสัปดาห์ของ pledges
-- สรุปรางวัลรายสัปดาห์ (035) เคยยิง 19:15 = 15 นาทีก่อนตัด → ขยับเป็น 20:15 ให้ยังครอบคลุมงานที่ส่งถึงนาทีสุดท้าย
-- รันหลัง 044 · รันได้ทันที มีผลกับการตัดรอบครั้งถัดไป
-- ============================================================

update public.cohort set week_cut_time = '20:30' where id = 1;

select cron.unschedule(jobid) from cron.job where jobname = 'discord-awards';
select cron.schedule('discord-awards', '15 13 * * 3', $cron$ select public.send_weekly_awards(); $cron$);   -- 20:15 ไทย

-- ตรวจ: week_cut_time = 20:30 · week_ends_at ของสัปดาห์นี้ต้องลงท้าย 13:30 UTC · discord-awards = 15 13 * * 3
select to_char(week_cut_time, 'HH24:MI') as cut, public.current_week() as week, public.week_end_at(public.current_week()) as week_ends_at
from public.cohort where id = 1;
select jobname, schedule from cron.job where jobname = 'discord-awards';
