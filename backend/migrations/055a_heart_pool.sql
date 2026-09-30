-- 055a: กำลังใจอัตโนมัติ ส่วนที่ 1/3 — คอลัมน์ + ตัวคัดผู้เข้าข่าย (รันหลัง 054 · แล้วรัน 055b, 055c ตามลำดับ)
alter table public.coach_hearts add column if not exists auto boolean not null default false;
alter table public.cohort add column if not exists heart_auto boolean not null default true;
alter table public.cohort add column if not exists heart_per_day int not null default 2;
alter table public.cohort add column if not exists heart_from uuid references public.profiles(id) on delete set null;
alter table public.cohort add column if not exists heart_msg text not null default 'อาจารย์กำลังส่งกำลังใจให้คุณ เฝ้ารอดูคุณอยู่นะ 💛';

update public.cohort set heart_from = (select id from public.profiles where role = 'coach' and house_id is null order by created_at limit 1)
where id = 1 and heart_from is null;

create or replace function public.coach_heart_pool()
returns table (profile_id uuid, name text, house_id int, reason text, gap_days int, last7 int, received int, last_received timestamptz)
language plpgsql stable security definer set search_path = public as $fn$
declare t int := public.day_of(now());
begin
  return query
  with posted as (
    select distinct s.profile_id as pid, s.day_index as d from public.submissions s where s.status = 'approved'
  ),
  st as (
    select p.id, p.name, p.house_id::int as hid,
      case when exists (select 1 from posted x where x.pid = p.id and x.d = t) and exists (select 1 from posted x where x.pid = p.id and x.d = t-1) then t
           when exists (select 1 from posted x where x.pid = p.id and x.d = t-1) and exists (select 1 from posted x where x.pid = p.id and x.d = t-2) then t-1
      end as pair_end,
      (select count(*)::int from posted x where x.pid = p.id and x.d between t-6 and t) as l7,
      (select count(*)::int from public.coach_hearts h where h.to_id = p.id) as rec,
      (select max(h.created_at) from public.coach_hearts h where h.to_id = p.id) as lastrec
    from public.profiles p where p.role = 'student'
  ),
  cl as (select st.*, (select max(x.d) from posted x where x.pid = st.id and x.d < st.pair_end - 1) as prev_day from st)
  select cl.id, cl.name, cl.hid,
    case when cl.pair_end is not null and cl.prev_day is null then 'first'
         when cl.pair_end is not null and (cl.pair_end - 1) - cl.prev_day - 1 >= 3 then 'comeback'
         else 'steady' end,
    case when cl.pair_end is not null and cl.prev_day is not null then (cl.pair_end - 1) - cl.prev_day - 1 else null end,
    cl.l7, cl.rec, cl.lastrec
  from cl
  where (cl.lastrec is null or cl.lastrec < now() - interval '7 days')
    and ((cl.pair_end is not null and cl.prev_day is null)
      or (cl.pair_end is not null and (cl.pair_end - 1) - cl.prev_day - 1 >= 3)
      or (cl.rec = 0 and cl.l7 >= 3));
end $fn$;
revoke execute on function public.coach_heart_pool() from public, anon, authenticated;

create or replace function public.coach_heart_candidates()
returns table (profile_id uuid, name text, house_id int, reason text, gap_days int, last7 int, received int, last_received timestamptz)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not public.is_head_coach() then raise exception 'เฉพาะหัวหน้าโค้ชเท่านั้น'; end if;
  return query select * from public.coach_heart_pool();
end $fn$;

select '055a ok' as ok, (select count(*) from public.coach_heart_pool()) as candidates;
