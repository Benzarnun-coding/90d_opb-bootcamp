-- 058: ปิดช่องโหว่ที่พบจากรายงาน dev 1 ต.ค. (+ ช่องที่ร้ายแรงกว่าที่รายงานไม่ได้เห็น)
-- ก) cohort.discord_webhook อ่านได้จาก anon key → ย้ายไปตารางลับ private_config (ไม่มี policy = client เข้าไม่ได้)
--    หน้า admin เดิมยังบันทึก webhook ได้: trigger ย้ายค่าไปตารางลับแล้วเคลียร์คอลัมน์ให้เอง
-- ข) notify_discord / send_daily_digest ฯลฯ เรียกได้โดยไม่ต้องล็อกอิน (PUBLIC execute) → ใครก็สั่งส่งข้อความเข้า Discord ได้
--    ปิดฟังก์ชันที่มีไว้ให้ cron เท่านั้น · ฟังก์ชันของหน้า admin เหลือสิทธิ์เฉพาะผู้ล็อกอิน (ข้างในเช็คหัวหน้าโค้ชอยู่แล้ว)
-- หลังรัน: ต้อง rotate webhook เดิมใน Discord (URL เก่าหลุดแล้ว) แล้ววาง URL ใหม่ในหน้า admin
create table if not exists public.private_config (key text primary key, value text);
alter table public.private_config enable row level security;
revoke all on public.private_config from anon, authenticated;
insert into public.private_config (key, value) select 'discord_webhook', discord_webhook from public.cohort where id = 1 and coalesce(discord_webhook, '') <> ''
on conflict (key) do update set value = excluded.value;

create or replace function public.cohort_hide_webhook() returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if coalesce(new.discord_webhook, '') <> '' then
    insert into public.private_config (key, value) values ('discord_webhook', new.discord_webhook)
    on conflict (key) do update set value = excluded.value;
    new.discord_webhook := null;
  end if;
  return new;
end $fn$;
drop trigger if exists trg_cohort_hide_webhook on public.cohort;
create trigger trg_cohort_hide_webhook before insert or update on public.cohort for each row execute function public.cohort_hide_webhook();
update public.cohort set discord_webhook = null where id = 1 and discord_webhook is not null;

create or replace function public.notify_discord(msg text)
returns bigint language plpgsql security definer set search_path = public as $fn$
declare url text; rid bigint;
begin
  if auth.uid() is not null and not public.is_head_coach() then raise exception 'เฉพาะหัวหน้าโค้ชเท่านั้น'; end if;
  select value into url from public.private_config where key = 'discord_webhook';
  if url is null or url = '' then raise exception 'ยังไม่ได้ใส่ Discord webhook ในหน้า admin'; end if;
  select net.http_post(url := url, body := jsonb_build_object('content', left(msg, 1900)),
    headers := '{"Content-Type":"application/json"}'::jsonb) into rid;
  insert into public.notifications (kind, payload, sent_at) values ('daily_digest', jsonb_build_object('text', msg, 'request_id', rid), now());
  return rid;
end $fn$;

do $$
declare r record;
begin
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('send_daily_digest','send_week_start','send_weekly_awards','warm_cache','take_daily_snapshot') loop
    execute format('revoke execute on function %s from public, anon, authenticated', r.sig);
  end loop;
  for r in select p.oid::regprocedure as sig from pg_proc p join pg_namespace n on n.oid = p.pronamespace
           where n.nspname = 'public' and p.proname in ('notify_discord','digest_text','weekly_awards_text','risk_text') loop
    execute format('revoke execute on function %s from public, anon', r.sig);
    execute format('grant execute on function %s to authenticated', r.sig);
  end loop;
end $$;

select 'webhook hidden' as check, (select discord_webhook is null from public.cohort where id = 1) as column_null,
       exists (select 1 from public.private_config where key = 'discord_webhook') as stored_privately;
select p.proname as anon_can_call_secdef, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute') order by 1;
