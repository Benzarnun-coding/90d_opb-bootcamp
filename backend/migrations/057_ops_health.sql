-- 057: เครื่องบันทึกอาการฐานข้อมูล (30 ก.ย. เซิร์ฟค้าง ~22:15-22:23 แต่ log ของ Supabase ล่มพร้อมกัน ย้อนดูไม่ได้)
-- ทุก 2 นาที cron วัดเวลา query เบา ๆ (+ query หนักทุก 10 นาที) และถ่ายภาพว่าตอนนั้นมี query ไหนค้าง/ใครบล็อกใคร
-- เก็บ 7 วัน · ตารางเล็ก (~5 พันแถว) · ไม่กระทบเกม · อ่านผ่าน ops_health_recent() (หัวหน้าโค้ชเท่านั้น)
create table if not exists public.ops_health (
  id bigint generated always as identity primary key,
  at timestamptz not null default now(),
  light_ms int, heavy_ms int, waiting int, active int, slow jsonb
);
create index if not exists ops_health_at on public.ops_health (at desc);
alter table public.ops_health enable row level security;

create or replace function public.ops_probe()
returns void language plpgsql security definer set search_path = public as $fn$
declare a jsonb; w int; act int; l int; h int; t0 timestamptz;
begin
  select coalesce(jsonb_agg(jsonb_build_object('pid', pid, 'state', state,
           'wait', coalesce(wait_event_type, '') || ':' || coalesce(wait_event, ''),
           'age_s', extract(epoch from now() - query_start)::int, 'blocked_by', pg_blocking_pids(pid),
           'q', left(regexp_replace(query, '\s+', ' ', 'g'), 140))), '[]'::jsonb)
    into a from pg_stat_activity
   where datname = current_database() and pid <> pg_backend_pid() and state <> 'idle' and query_start < now() - interval '5 seconds';
  select count(*) filter (where wait_event_type = 'Lock')::int, count(*) filter (where state <> 'idle')::int
    into w, act from pg_stat_activity where datname = current_database();
  t0 := clock_timestamp();
  perform count(*) from public.cohort; perform count(*) from public.pledge_options;
  l := (extract(epoch from clock_timestamp() - t0) * 1000)::int;
  if extract(minute from now())::int % 10 = 0 then
    t0 := clock_timestamp(); perform count(*) from public.v_leaderboard;
    h := (extract(epoch from clock_timestamp() - t0) * 1000)::int;
  end if;
  insert into public.ops_health (light_ms, heavy_ms, waiting, active, slow)
  values (l, h, w, act, case when jsonb_array_length(a) > 0 then a end);
  delete from public.ops_health where at < now() - interval '7 days';
end $fn$;
revoke execute on function public.ops_probe() from public, anon, authenticated;

create or replace function public.ops_health_recent(hrs int default 6)
returns setof public.ops_health language sql stable security definer set search_path = public as $$
  select * from public.ops_health where public.is_head_coach() and at > now() - make_interval(hours => hrs) order by at desc;
$$;
revoke execute on function public.ops_health_recent(int) from public, anon;
grant execute on function public.ops_health_recent(int) to authenticated;

select cron.unschedule(jobid) from cron.job where jobname = 'ops-probe';
select cron.schedule('ops-probe', '*/2 * * * *', $cron$ select public.ops_probe(); $cron$);
select public.ops_probe();
select 'ops probe ok' as ok, light_ms, waiting, active from public.ops_health order by id desc limit 1;
