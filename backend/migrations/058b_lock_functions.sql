-- 058b: ปิดสิทธิ์เรียกฟังก์ชัน (รันหลัง 058a) — cron-only: ปิดหมด · ของหน้า admin: เหลือเฉพาะผู้ล็อกอิน
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

select p.proname as still_callable_by_anon, pg_get_function_identity_arguments(p.oid) as args
from pg_proc p join pg_namespace n on n.oid = p.pronamespace
where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute') order by 1;
