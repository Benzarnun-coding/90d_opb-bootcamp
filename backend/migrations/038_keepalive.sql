-- ============================================================
-- 🔥 กันฐานข้อมูล "เย็น" — ต้นเหตุที่เว็บค้างตอนคนแรกเปิด
--
--    วัดจริง 2026-09-09: ครั้งแรกที่ยิงเข้ามาแบบเย็น
--      v_feed          22,755 ms
--      v_house_cup      5,054 ms
--      v_boss_progress  3,836 ms
--      v_leaderboard    error 500 (statement timeout)
--    หลังอุ่นแล้ว view เดียวกันเหลือ 88–334 ms ทุกตัว
--
--    ทำไม: v_leaderboard เรียก streak_of()/week_streak_of() ซึ่งวนลูป
--    ทีละวันตั้งแต่วันที่ 1 ถึงวันนี้ ต่อนักเรียนหนึ่งคน แต่ละรอบยิง EXISTS
--    สองครั้ง ตอนแคชอุ่นมันคือ index probe ระดับไมโครวินาที แต่ตอนแคชเย็น
--    มันคือการอ่านดิสก์หลายหมื่นครั้ง จึงพุ่งจากหลักร้อยมิลลิวินาทีเป็นหลักสิบวินาที
--    ทางแก้ที่ปลอดภัยที่สุดคือไม่ปล่อยให้แคชเย็น ไม่ต้องแตะสูตรเกมเลย
-- รันหลัง 037
-- ============================================================

create or replace function public.warm_cache()
returns void language plpgsql security definer set search_path = public as $fn$
begin
  set local statement_timeout = '90s';

  /* ต้องรวมคอลัมน์ที่แพงเข้าไปในผลลัพธ์ด้วย ไม่งั้น Postgres จะตัด
     lateral streak_of() ทิ้งเพราะไม่มีใครใช้ค่า แล้วการอุ่นจะไม่เกิดขึ้นจริง */
  perform sum(coalesce(day_streak,0) + coalesce(week_streak,0)
            + coalesce(freeze_left,0) + coalesce(contents,0)
            + coalesce(week_done,0)   + coalesce(weeks_hit,0))
     from public.v_leaderboard;

  perform count(*) from public.v_feed;
  perform count(*) from public.v_week_progress;
  perform count(*) from public.v_house_cup;
  perform count(*) from public.v_boss_progress;
  perform count(*) from public.v_reach;
  perform count(*) from public.v_counted;
  perform count(*) from public.v_burnout;
  perform count(*) from public.v_weak;
  perform count(*) from public.v_week_kings;
  perform count(*) from public.v_week_ta_kings;
  perform count(*) from public.v_cheers_week;
  perform count(*) from public.v_duels;
  perform count(*) from public.v_kudos;
  perform count(*) from public.v_holiday_grinders;
exception when others then
  raise notice 'warm_cache: %', sqlerrm;   -- อุ่นไม่สำเร็จก็ต้องไม่ทำให้ cron ตาย
end $fn$;

comment on function public.warm_cache() is
  'อุ่นแคชของ view หนักทุก 2 นาที กันอาการคนแรกที่เปิดเว็บต้องรอ 10-25 วินาที';

-- ตารางเดิมชื่อซ้ำได้ ลบก่อนแล้วค่อยตั้งใหม่ (รันซ้ำได้ไม่พัง)
select cron.unschedule('warm-cache') where exists (select 1 from cron.job where jobname = 'warm-cache');
select cron.schedule('warm-cache', '*/2 * * * *', $cron$ select public.warm_cache(); $cron$);
