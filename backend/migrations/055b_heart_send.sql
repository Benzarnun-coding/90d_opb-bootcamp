-- 055b: กำลังใจอัตโนมัติ ส่วนที่ 2/3 — บรรทัดเหตุผล + ส่งหนึ่งคน + ส่งเองจากหน้า admin (รันหลัง 055a)
create or replace function public.coach_heart_why(reason text, gap int, last7 int)
returns text language sql immutable as $$
  select case reason
    when 'comeback' then 'เห็นนะว่ากลับมาลงงาน 2 วันติดแล้ว หลังหายไป ' || gap || ' วัน'
    when 'first'    then 'เห็นว่าเริ่มลงงาน 2 วันติดแล้ว ก้าวแรกสำคัญที่สุด'
    when 'steady'   then 'เห็นความสม่ำเสมอของคุณนะ สัปดาห์นี้ลงไป ' || last7 || ' วันแล้ว'
    else '' end;
$$;

create or replace function public.coach_heart_put(to_pid uuid, from_pid uuid, rs text, msg text, is_auto boolean)
returns boolean language plpgsql security definer set search_path = public, extensions as $fn$
declare cmd text; k text; u text;
begin
  if exists (select 1 from public.coach_hearts h where h.to_id = to_pid and h.created_at > now() - interval '7 days') then return false; end if;
  insert into public.coach_hearts (to_id, from_id, reason, message, auto) values (to_pid, from_pid, rs, left(msg, 400), is_auto);
  begin
    select command into cmd from cron.job where jobname = 'push-nudge' limit 1;
    k := (regexp_match(cmd, '"x-cron-key":"([^"]+)"'))[1];
    u := (regexp_match(cmd, 'url\s*:=\s*''([^'']+)'''))[1];
    if k is not null and u is not null then
      perform net.http_post(url := u,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', k),
        body    := jsonb_build_object('profile_id', to_pid, 'title', '💛 อาจารย์ส่งกำลังใจให้คุณ', 'body', split_part(msg, E'\n', 1)));
    end if;
  exception when others then null;
  end;
  return true;
end $fn$;
revoke execute on function public.coach_heart_put(uuid, uuid, text, text, boolean) from public, anon, authenticated;

create or replace function public.coach_heart_send(to_ids uuid[], reasons text[], messages text[])
returns int language plpgsql security definer set search_path = public as $fn$
declare i int; n int := 0; rs text;
begin
  if not public.is_head_coach() then raise exception 'เฉพาะหัวหน้าโค้ชเท่านั้น'; end if;
  for i in 1 .. coalesce(array_length(to_ids, 1), 0) loop
    rs := coalesce(nullif(reasons[i], ''), 'pick'); if rs not in ('comeback','first','steady','pick') then rs := 'pick'; end if;
    if public.coach_heart_put(to_ids[i], auth.uid(), rs,
         coalesce(nullif(btrim(messages[i]), ''), 'อาจารย์กำลังส่งกำลังใจให้คุณ เฝ้ารอดูคุณอยู่นะ 💛'), false) then n := n + 1; end if;
  end loop;
  perform public.audit('coach_heart.send', n::text, jsonb_build_object('count', n));
  return n;
end $fn$;

select '055b ok' as ok;
