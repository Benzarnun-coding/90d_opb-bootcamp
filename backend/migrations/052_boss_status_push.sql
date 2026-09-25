-- ============================================================
-- 052: แจ้งเตือนสถานะเลือดบอส ทุกวัน 20:00 ไทย (Web Push)
--
-- ที่มา (25 ก.ย.): Benz อยากให้ "Share Status เลือดบอสทุกวันตอน 20:00 แบบแจ้งเตือน"
-- วิธี: ยืม URL + กุญแจของ Edge Function push จาก cron 'push-nudge' (แบบเดียวกับ nudge() ใน 047)
--       แล้วยิงโหมด "ส่งให้คนเดียว" (profile_id + title + body) ให้ทุกคนที่เปิดแจ้งเตือนไว้
--       ไม่ต้องแก้/deploy Edge Function
-- ส่งเฉพาะสัปดาห์ที่มีบอสและบอสยังไม่ล้ม (ล้มแล้วไม่สแปมทุกวัน)
-- pg_net ยิงแบบ async ทีละคน — คนเปิด push ~ไม่กี่สิบคน ไม่หนัก
-- รันหลัง 051b
-- ============================================================

create or replace function public.send_boss_status()
returns table (bosses int, pushed int) language plpgsql security definer set search_path = public as $fn$
declare cmd text; k text; u text; b record; top record; n int := 0; nb int := 0;
        left_hp int; days_left int; title text; body text; sub record;
begin
  select command into cmd from cron.job where jobname = 'push-nudge' limit 1;
  k := (regexp_match(cmd, '"x-cron-key":"([^"]+)"'))[1];
  u := (regexp_match(cmd, 'url\s*:=\s*''([^'']+)'''))[1];
  if k is null or u is null then bosses := 0; pushed := 0; return next; return; end if;

  for b in select * from public.v_boss_progress where week_no = public.current_week() and damage < hp loop
    nb := nb + 1;
    left_hp := b.hp - b.damage;
    days_left := greatest(0, ceil(extract(epoch from (public.week_end_at(b.week_no) - now())) / 86400))::int;

    /* MVP ณ ตอนนี้ */
    select p.name, h.hits into top
    from public.v_boss_hits h join public.profiles p on p.id = h.profile_id
    where h.boss_id = b.id order by h.hits desc, h.last_at asc limit 1;

    title := case when left_hp <= b.hp * 0.3 then '⚠ ' || b.name || ' ใกล้ตาย! HP ' || left_hp || '/' || b.hp
                  else b.emoji || ' ' || b.name || ' HP ' || left_hp || '/' || b.hp end;
    body  := 'โดนไปแล้ว ' || b.damage || ' ดาเมจ จาก ' || b.fighters || ' คน'
             || case when top.name is not null then ' · MVP ' || top.name || ' (' || top.hits || ')' else '' end
             || ' · เหลือ ' || days_left || ' วัน · ส่งงาน 1 ชิ้น = 1 ดาเมจ';

    for sub in
      select distinct ps.profile_id
      from public.push_subs ps
      join public.profiles p on p.id = ps.profile_id
      where b.house_id is null or p.house_id = b.house_id
    loop
      perform net.http_post(
        url     := u,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', k),
        body    := jsonb_build_object('profile_id', sub.profile_id, 'title', title, 'body', body));
      n := n + 1;
    end loop;
  end loop;
  bosses := nb; pushed := n; return next;
end $fn$;
revoke execute on function public.send_boss_status() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'boss-status';
select cron.schedule('boss-status', '0 13 * * *', $cron$ select public.send_boss_status(); $cron$);   -- 20:00 ไทย ทุกวัน

-- เช็ค: cron ตั้งแล้ว + ตัวอย่างข้อความที่จะส่ง (ไม่ได้ส่งจริง)
select jobname, schedule from cron.job where jobname in ('boss-status', 'push-nudge');
select b.name, b.hp - b.damage as left_hp, b.damage, b.fighters,
       (select count(distinct profile_id) from public.push_subs) as people_with_push
from public.v_boss_progress b where b.week_no = public.current_week();
