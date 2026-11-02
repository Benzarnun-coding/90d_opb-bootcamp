-- 067: สรุป Discord 20:00 แบบ "ปั่นให้ตื่นเต้น" (Benz 2 พ.ย.: ไม่ต้องตามงานว่าใครยังไม่ส่ง · ส่งสถานะบอส · เอาผล PVP มาแทนตารางบ้าน)
-- เปลี่ยนแค่ข้อความของ digest_text() (ฟังก์ชันเดียว) — cron 'discord-daily' / send_daily_digest() ยังเรียกตัวเดิม ไม่แตะเวลา/กุญแจ/webhook
-- ข้อความใหม่:  1) วันนี้ส่งการบ้านไปแล้วกี่ชิ้น จากกี่คน (ไม่มีชื่อคนที่ยังไม่ส่ง, ไม่มีเตือนเลือกเป้า)
--              2) เลือดบอสสัปดาห์นี้ + แถบ HP + MVP + เหลือกี่วัน + รางวัล + ชวนช่วยกันตี
--              3) PVP: คู่ที่กำลังสู้กัน (สกอร์สด) + ผลคู่ที่เพิ่งจบ (เฉพาะชื่อผู้ชนะ — สกอร์ของคู่ที่จบแล้วคิดสดจากโพสต์ จึงอาจไม่ตรงกับผลตัดสิน)  ·  ตารางบ้านเอาออก
-- รันทั้งไฟล์ได้เลย · ย้อนกลับ: รัน 017 ช่วง digest_text ซ้ำ (ตัวเดิม)
create or replace function public.digest_text()
returns text language plpgsql security definer set search_path = public as $fn$
declare
  d int := public.day_of(now());
  cw int := public.current_week();
  site text := 'https://opb-bootcamp.netlify.app';
  n_posts int; n_people int; t text := ''; b record; top record;
  filled int; days_left int; duel_live text; duel_done text;
begin
  if not public.has_started() then return null; end if;

  select count(*), count(distinct profile_id) into n_posts, n_people from public.v_counted where day_index = d;
  t := '🏁 **วันที่ ' || d || ' · สัปดาห์ที่ ' || cw || '**' || E'\n';
  if n_posts = 0 then
    t := t || '📥 วันนี้ยังเงียบอยู่ — ใครส่งชิ้นแรกเป็นคนแรกของวัน ⚡' || E'\n';
  else
    t := t || '📥 วันนี้ส่งการบ้านกันไปแล้ว **' || n_posts || ' ชิ้น** จาก ' || n_people || ' คน 🔥' || E'\n';
  end if;

  /* ---- บอสสัปดาห์นี้ ---- */
  for b in select * from public.v_boss_progress where week_no = cw order by id loop
    select p.name, h.hits into top
      from public.v_boss_hits h join public.profiles p on p.id = h.profile_id
      where h.boss_id = b.id order by h.hits desc, h.last_at asc limit 1;
    t := t || E'\n' || b.emoji || ' **' || b.name || '**' || E'\n';
    if b.damage >= b.hp then
      t := t || '💀 ล้มแล้ว! ' || b.damage || '/' || b.hp || ' ดาเมจ · ขอบคุณทุกคนที่ช่วยกันตี 🎉' || E'\n';
    else
      filled := least(10, greatest(0, round(b.damage::numeric / b.hp * 10)::int));
      days_left := greatest(0, ceil(extract(epoch from (public.week_end_at(b.week_no) - now())) / 86400))::int;
      t := t || repeat('🟥', filled) || repeat('⬛', 10 - filled) || E'\n'
        || 'เลือดเหลือ **' || (b.hp - b.damage) || '/' || b.hp || '** · นักสู้ ' || b.fighters || ' คน'
        || case when b.crits > 0 then ' · คริติคอล ' || b.crits || ' ครั้ง 💥' else '' end || E'\n'
        || case when top.name is not null then '👑 MVP ตอนนี้ ' || top.name || ' (' || top.hits || ' ดาเมจ)' || E'\n' else '' end
        || '⏳ เหลือเวลา ' || days_left || ' วัน · ส่งงาน 1 ชิ้น = ตีบอส 1 ครั้ง ลุ้นคริ ×3 ×5 ×10 — ช่วยกันตีให้ล้ม!' || E'\n'
        || case when b.reward is not null and btrim(split_part(b.reward, E'\n', 1)) <> '' then '🎁 รางวัล: ' || btrim(split_part(b.reward, E'\n', 1)) || E'\n' else '' end;
    end if;
  end loop;

  /* ---- PVP: คู่ที่กำลังสู้ + ผลที่เพิ่งจบ ---- */
  select string_agg(x.line, E'\n') into duel_live from (
    select '• ' || challenger_name || ' 🆚 ' || opponent_name || ' · ' || challenger_score || '–' || opponent_score
           || case when challenger_score > opponent_score then ' (' || challenger_name || ' นำ)'
                   when challenger_score < opponent_score then ' (' || opponent_name || ' นำ)' else ' (สูสี)' end as line
    from public.v_duels
    where status = 'active' and start_day is not null and d between start_day and end_day
    order by greatest(challenger_score, opponent_score) desc limit 6) x;
  select string_agg(x.line, E'\n') into duel_done from (
    select '• 🏆 ' || case when winner = challenger then challenger_name when winner = opponent then opponent_name end
           || ' ชนะ ' || case when winner = challenger then opponent_name else challenger_name end
           as line
    from public.v_duels
    where status = 'done' and winner is not null and end_day >= d - 1
    order by end_day desc limit 5) x;
  if duel_live is not null or duel_done is not null then
    t := t || E'\n⚔️ **PVP**\n' || coalesce(duel_live || E'\n', '') || coalesce(duel_done || E'\n', '');
  end if;

  return t || E'\n' || site;
end $fn$;
grant execute on function public.digest_text() to authenticated;

-- ตัวส่งเข้า Discord (ต่อจาก 058a): 1) allowed_mentions = ไม่ให้ข้อความปิงใครเลย — ชื่อนักเรียนยาวได้ถึง 10 ตัวอักษร ตั้งเป็น "@everyone" (9 ตัว) ได้
--   แล้วชื่อนั้นโผล่ใน MVP/ผู้ชนะ PVP/รางวัลรายสัปดาห์ = ปิงทั้งเซิร์ฟเวอร์ · 2) ข้อความยาวเกิน 1900 ตัวอักษรตัดที่ท้ายบรรทัด (เดิมตัดกลางคำ ลิงก์ท้ายข้อความหายเงียบ ๆ)
create or replace function public.notify_discord(msg text)
returns bigint language plpgsql security definer set search_path = public as $fn$
declare url text; rid bigint; body text := msg;
begin
  if auth.uid() is not null and not public.is_head_coach() then raise exception 'เฉพาะหัวหน้าโค้ชเท่านั้น'; end if;
  select value into url from public.private_config where key = 'discord_webhook';
  if url is null or url = '' then raise exception 'ยังไม่ได้ใส่ Discord webhook ในหน้า admin'; end if;
  if length(body) > 1900 then
    body := left(body, 1900);
    body := regexp_replace(body, E'\n[^\n]*$', '');           -- ตัดทิ้งบรรทัดที่ขาดครึ่ง
    body := body || E'\n…';
  end if;
  select net.http_post(url := url,
    body := jsonb_build_object('content', body, 'allowed_mentions', jsonb_build_object('parse', '[]'::jsonb)),
    headers := '{"Content-Type":"application/json"}'::jsonb) into rid;
  insert into public.notifications (kind, payload, sent_at) values ('daily_digest', jsonb_build_object('text', msg, 'request_id', rid), now());
  return rid;
end $fn$;

-- ตัวอย่างข้อความ (ไม่ได้ส่งจริง)
select public.digest_text() as preview;
