-- 062: ลดการแย่งทรัพยากรฐานข้อมูลคืนวันพุธ + เปิดตัวบันทึกอาการ (ops-probe) ที่ 057 ลืมตั้งเวลา
-- ที่มา (22 ต.ค.): Benz บอกเว็บช้ามากคืนวันพุธ · ตรวจแล้วพบ ops_health ว่าง (ไม่มี cron ops-probe),
--   warm_cache ทุก 2 นาที (เฉลี่ย 0.9 วินาที สูงสุด 24 วินาที) และงาน 20:00 ทั้งสามตัวรุมกันตอนนักเรียนเข้าพร้อมกัน
-- ทำ 3 อย่าง (ไม่แตะข้อมูลเกม · ย้อนกลับได้): 1) ตั้ง ops-probe  2) warm_cache ข้ามช่วงพุธ 19:30–21:00 ไทย  3) เหลื่อมงาน 20:00
-- รันทั้งไฟล์ได้เลย (ไม่ถึง 3 KB) · jobid อ้างจากชื่อ ไม่ต้องรู้เลข

-- 1) ตัวบันทึกอาการ: ทุก 2 นาที (เบามาก) · พุธหน้าจะมีข้อมูลดูย้อนหลังได้ที่ select * from ops_health order by at desc
select cron.unschedule(jobid) from cron.job where jobname = 'ops-probe';
select cron.schedule('ops-probe', '*/2 * * * *', $c$ select public.ops_probe(); $c$);
select public.ops_probe();

-- 2) warm_cache: ข้ามช่วงพุธ 19:30–21:00 เวลาไทย (นักเรียนเข้าเว็บเองอยู่แล้ว แคชร้อนอยู่) ช่วงอื่นทำงานเหมือนเดิม
select cron.alter_job((select jobid from cron.job where jobname = 'warm-cache'),
  command := $c$ select public.warm_cache() where not (extract(dow from (now() at time zone 'Asia/Bangkok')) = 3 and (now() at time zone 'Asia/Bangkok')::time between time '19:30' and time '21:00') $c$);

-- 3) เหลื่อมงาน 20:00: สรุป Discord 20:00 (เดิม) · แจ้งบอส 20:03 · push-nudge 20:06 (alter_job ไม่แตะคำสั่ง/กุญแจเดิม)
select cron.alter_job((select jobid from cron.job where jobname = 'boss-status'), schedule := '3 13 * * *');
select cron.alter_job((select jobid from cron.job where jobname = 'push-nudge'), schedule := '6 13 * * *');

-- เช็ค
select jobname, schedule, active from cron.job where jobname in ('ops-probe','warm-cache','boss-status','push-nudge','discord-daily','discord-awards') order by jobname;
select count(*) as probe_rows_now from public.ops_health;

-- ย้อนกลับ (ถ้าต้องการ):
--   select cron.alter_job((select jobid from cron.job where jobname = 'warm-cache'), command := 'select public.warm_cache();');
--   select cron.alter_job((select jobid from cron.job where jobname = 'boss-status'), schedule := '0 13 * * *');
--   select cron.alter_job((select jobid from cron.job where jobname = 'push-nudge'), schedule := '0 13 * * *');
--   select cron.unschedule(jobid) from cron.job where jobname = 'ops-probe';
