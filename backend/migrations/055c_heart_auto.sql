-- 055c: กำลังใจอัตโนมัติ ส่วนที่ 3/3 — รอบส่งเอง (cron 19:00 ไทย) + หน้าตั้งค่า (รันหลัง 055b)
create or replace function public.coach_heart_auto()
returns int language plpgsql security definer set search_path = public as $fn$
declare c public.cohort%rowtype; r record; n int := 0;
begin
  select * into c from public.cohort where id = 1;
  if not c.heart_auto or coalesce(c.heart_per_day, 0) <= 0 then return 0; end if;
  if public.is_vacation_day() then return 0; end if;
  for r in
    select p.profile_id as pid, p.reason as rs, public.coach_heart_why(p.reason, p.gap_days, p.last7) as why
    from public.coach_heart_pool() p
    order by power(random(), 1.0 / ((case p.reason when 'comeback' then 5 + least(coalesce(p.gap_days,0),14)/2.0 when 'first' then 5 else 1 end)
                                   * (case when p.received = 0 then 2 else 1 end))::float8) desc
    limit c.heart_per_day
  loop
    if public.coach_heart_put(r.pid, c.heart_from, r.rs, c.heart_msg || E'\n' || r.why, true) then n := n + 1; end if;
  end loop;
  perform public.audit('coach_heart.auto', n::text, jsonb_build_object('count', n));
  return n;
end $fn$;
revoke execute on function public.coach_heart_auto() from public, anon, authenticated;

create or replace function public.coach_heart_config(enabled boolean, per_day int, msg text)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if not public.is_head_coach() then raise exception 'เฉพาะหัวหน้าโค้ชเท่านั้น'; end if;
  update public.cohort set heart_auto = enabled, heart_per_day = greatest(0, least(coalesce(per_day, 2), 10)),
         heart_msg = coalesce(nullif(btrim(msg), ''), heart_msg), heart_from = auth.uid() where id = 1;
  perform public.audit('coach_heart.config', null, jsonb_build_object('enabled', enabled, 'per_day', per_day));
end $fn$;
revoke execute on function public.coach_heart_config(boolean, int, text) from public, anon;
grant execute on function public.coach_heart_config(boolean, int, text) to authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'coach-heart';
select cron.schedule('coach-heart', '0 12 * * *', $cron$ select public.coach_heart_auto(); $cron$);

select '055c ok' as ok, heart_auto, heart_per_day, (select name from public.profiles where id = heart_from) as sender from public.cohort where id = 1;
