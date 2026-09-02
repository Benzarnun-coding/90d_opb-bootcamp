-- ============================================================
-- แจ้งเตือนผ่าน Discord webhook — ไม่ต้องมี Edge Function
--
-- pg_cron เรียกฟังก์ชันในฐานข้อมูล → ประกอบข้อความ → pg_net ยิงเข้า webhook ของช่อง
-- หัวหน้าโค้ชวาง webhook URL ในหน้า admin.html (เก็บใน cohort.discord_webhook)
--
--   ทุกวัน 20:00 น. ไทย  = 13:00 UTC  → สรุปใครยังไม่ส่ง + ตารางบ้าน
--   ทุกวัน 09:00 น. ไทย  = 02:00 UTC  → ถ้าเป็นวันแรกของสัปดาห์ เตือนเลือกเป้า
--
-- ต้องเปิด extension pg_cron และ pg_net ก่อน (เปิดแล้ว)
-- รันหลัง 001-016
-- ============================================================

alter table public.cohort add column if not exists discord_webhook text;

drop policy if exists cohort_admin on public.cohort;
create policy cohort_admin on public.cohort for update to authenticated
  using (public.is_head_coach()) with check (public.is_head_coach());

-- ------------------------------------------------------------
-- 1. ส่งข้อความเข้า Discord (หัวหน้าโค้ช หรือ cron ที่ไม่มี auth.uid)
-- ------------------------------------------------------------
create or replace function public.notify_discord(msg text)
returns bigint language plpgsql security definer set search_path = public as $fn$
declare url text; rid bigint;
begin
  if auth.uid() is not null and not public.is_head_coach() then
    raise exception 'เฉพาะหัวหน้าโค้ชเท่านั้น';
  end if;
  select discord_webhook into url from public.cohort where id = 1;
  if url is null or url = '' then
    raise exception 'ยังไม่ได้ใส่ Discord webhook ในหน้า admin';
  end if;
  select net.http_post(
    url     := url,
    body    := jsonb_build_object('content', left(msg, 1900)),
    headers := '{"Content-Type":"application/json"}'::jsonb
  ) into rid;
  insert into public.notifications (kind, payload, sent_at)
  values ('daily_digest', jsonb_build_object('text', msg, 'request_id', rid), now());
  return rid;
end $fn$;
grant execute on function public.notify_discord(text) to authenticated;

-- ------------------------------------------------------------
-- 2. ข้อความสรุปประจำวัน (Discord markdown)
-- ------------------------------------------------------------
create or replace function public.digest_text()
returns text language plpgsql security definer set search_path = public as $fn$
declare
  n_nudge int; n_pledge int; names text; houses text; t text;
  d  int := public.day_of(now());
  cw int := public.current_week();
  site text := 'https://opb-bootcamp.netlify.app';
begin
  if not public.has_started() then return null; end if;
  select count(*) into n_nudge  from public.v_needs_nudge;
  select count(*) into n_pledge from public.v_needs_pledge;
  select string_agg(name, ', ' order by name) into names
    from (select name from public.v_needs_nudge order by name limit 40) y;
  select string_agg(x.line, E'\n') into houses from (
    select h.emoji || ' ' || h.name || ' เฉลี่ย ' || b.avg_contents || ' ชิ้น/คน' as line
    from public.v_house_board b join public.houses h on h.id = b.id
    order by b.avg_rate desc limit 4) x;

  t := '🏁 **วันที่ ' || d || ' · สัปดาห์ที่ ' || cw || '**' || E'\n';
  if n_nudge = 0 then
    t := t || 'วันนี้ทุกคนส่งงานครบแล้ว 🎉' || E'\n';
  else
    t := t || '⏳ วันนี้ยังไม่ได้ส่งงาน **' || n_nudge || ' คน** — เหลืออีกไม่กี่ชั่วโมงก่อนปิดรอบตี 4' || E'\n'
           || coalesce(names, '') || E'\n';
  end if;
  if n_pledge > 0 then
    t := t || '📝 ยังไม่ได้เลือกเป้าสัปดาห์นี้ ' || n_pledge || ' คน' || E'\n';
  end if;
  if houses is not null then
    t := t || E'\n**ตารางบ้าน**\n' || houses || E'\n';
  end if;
  return t || E'\n' || site;
end $fn$;
grant execute on function public.digest_text() to authenticated;

create or replace function public.send_daily_digest()
returns void language plpgsql security definer set search_path = public as $fn$
declare t text;
begin
  t := public.digest_text();
  if t is not null then perform public.notify_discord(t); end if;
end $fn$;

-- ------------------------------------------------------------
-- 3. เตือนเลือกเป้าในวันแรกของสัปดาห์
-- ------------------------------------------------------------
create or replace function public.send_week_start()
returns void language plpgsql security definer set search_path = public as $fn$
declare cw int; t text;
begin
  if not public.has_started() then return; end if;
  if (public.day_of(now()) - 1) % 7 <> 0 then return; end if;
  cw := public.current_week();
  t := '📅 **สัปดาห์ที่ ' || cw || ' เริ่มแล้ว**' || E'\n'
    || 'เข้าไปเลือกเป้าของสัปดาห์นี้ 4 / 7 / 10 ชิ้น'
    || case when cw >= 7 then E'\nสัปดาห์นี้ PRO MAX 14 ชิ้นเปิดแล้ว 🔥' else '' end
    || E'\nhttps://opb-bootcamp.netlify.app';
  perform public.notify_discord(t);
end $fn$;

-- ------------------------------------------------------------
-- 4. ตั้งเวลา
-- ------------------------------------------------------------
select cron.unschedule(jobid) from cron.job where jobname in ('discord-daily','discord-week');
select cron.schedule('discord-daily', '0 13 * * *', $cron$ select public.send_daily_digest(); $cron$);
select cron.schedule('discord-week',  '0 2 * * *',  $cron$ select public.send_week_start();  $cron$);

select jobname, schedule from cron.job where jobname like 'discord-%';
