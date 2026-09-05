-- ============================================================
-- Web Push เตือนก่อนปิดรอบ — ตารางเวลา (รันแล้วบน production 2026-09-05 ผ่าน Management API)
--   Edge Function: backend/functions/push/index.ts  (deploy ชื่อ "push", verify_jwt=false)
--   secrets: VAPID_PUBLIC, VAPID_PRIVATE, VAPID_SUBJECT, PUSH_CRON_KEY, SITE_URL
--   ฝั่งเว็บ: config.js VAPID_PUBLIC + sw.js
-- แทน <PUSH_CRON_KEY> ด้วยค่าเดียวกับ secret ก่อนรัน
-- ============================================================
select cron.unschedule(jobid) from cron.job where jobname = 'push-nudge';
select cron.schedule('push-nudge', '0 13 * * *',   -- 20:00 ไทย
  $$select net.http_post(
      url     := 'https://vbbaefceiswuidylwzmp.supabase.co/functions/v1/push',
      headers := '{"Content-Type":"application/json","x-cron-key":"<PUSH_CRON_KEY>"}'::jsonb,
      body    := '{}'::jsonb)$$);
