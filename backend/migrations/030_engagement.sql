-- ============================================================
-- Engagement / Analytics: ใครเข้าแอปบ้าง บ่อยแค่ไหน คนดูข้างนอกกี่คน
--   visits: 1 แถวต่อการเปิดแอป (open) + pulse ทุก 5 นาทีตอนเปิดหน้าค้างอยู่
--   track_visit(): เรียกจากหน้าเว็บ (anon ได้) กันยิงถี่ในตัว
--   admin_engagement(days): รายงาน JSON สำหรับหน้า admin (หัวหน้าโค้ชเท่านั้น)
-- รันหลัง 029
-- ============================================================
create table if not exists public.visits (
  id         bigint generated always as identity primary key,
  at         timestamptz not null default now(),
  profile_id uuid references public.profiles(id) on delete set null,
  vkey       text not null,                       -- รหัสประจำเครื่อง/เบราว์เซอร์ (localStorage)
  page       text not null default 'app',         -- app | title | watch | ta | admin | install
  kind       text not null default 'open',        -- open | pulse
  device     text,                                -- mobile | desktop
  pwa        boolean not null default false,      -- เปิดจากไอคอนที่ติดตั้ง
  ref        text
);
create index if not exists visits_at_idx      on public.visits (at);
create index if not exists visits_profile_idx on public.visits (profile_id, at);
create index if not exists visits_vkey_idx    on public.visits (vkey, at);
alter table public.visits enable row level security;
drop policy if exists visits_read on public.visits;
create policy visits_read on public.visits for select to authenticated using (public.is_head_coach());
grant select on public.visits to authenticated;

create or replace function public.track_visit(p_page text default 'app', p_kind text default 'open', p_vkey text default null,
                                              p_device text default null, p_pwa boolean default false, p_ref text default null)
returns void language plpgsql security definer set search_path = public as $fn$
declare k text := coalesce(nullif(left(p_vkey, 64), ''), 'anon');
        pg text := left(coalesce(p_page, 'app'), 20);
        kd text := case when p_kind = 'pulse' then 'pulse' else 'open' end;
        win interval := case when p_kind = 'pulse' then interval '4 minutes' else interval '2 minutes' end;
begin
  -- กันยิงถี่: เครื่องเดียวกัน หน้าเดียวกัน ชนิดเดียวกัน ภายในช่วงสั้น ๆ ไม่บันทึกซ้ำ
  if exists (select 1 from public.visits v where v.vkey = k and v.page = pg and v.kind = kd and v.at > now() - win) then return; end if;
  insert into public.visits (profile_id, vkey, page, kind, device, pwa, ref)
  values (auth.uid(), k, pg, kd, left(p_device, 12), coalesce(p_pwa, false), left(p_ref, 120));
end $fn$;
grant execute on function public.track_visit(text, text, text, text, boolean, text) to anon, authenticated;

create or replace function public.admin_engagement(days int default 30)
returns jsonb language plpgsql security definer set search_path = public as $fn$
declare res jsonb;
        since  timestamptz := now() - make_interval(days => greatest(1, coalesce(days, 30)));
        today0 timestamptz := (date_trunc('day', now() at time zone 'Asia/Bangkok')) at time zone 'Asia/Bangkok';
        d7     timestamptz := now() - interval '7 days';
begin
  if not public.is_head_coach() then raise exception 'เฉพาะหัวหน้าโค้ชเท่านั้น'; end if;
  select jsonb_build_object(
    'since', since,
    'totals', (select jsonb_build_object(
        'opens_today',   count(*) filter (where kind = 'open' and at >= today0),
        'users_today',   count(distinct profile_id) filter (where profile_id is not null and at >= today0),
        'devices_today', count(distinct vkey) filter (where at >= today0),
        'users_7d',      count(distinct profile_id) filter (where profile_id is not null and at >= d7),
        'devices_7d',    count(distinct vkey) filter (where at >= d7),
        'users_range',   count(distinct profile_id) filter (where profile_id is not null and at >= since),
        'devices_range', count(distinct vkey) filter (where at >= since),
        'opens_range',   count(*) filter (where kind = 'open' and at >= since),
        'outside_7d',    count(distinct vkey) filter (where profile_id is null and at >= d7),
        'outside_range', count(distinct vkey) filter (where profile_id is null and at >= since),
        'watch_range',   count(*) filter (where page = 'watch' and kind = 'open' and at >= since),
        'pwa_users',     count(distinct profile_id) filter (where pwa and profile_id is not null and at >= since),
        'mobile_users',  count(distinct profile_id) filter (where device = 'mobile' and profile_id is not null and at >= since),
        'desktop_users', count(distinct profile_id) filter (where device = 'desktop' and profile_id is not null and at >= since),
        'minutes_range', 5 * count(*) filter (where kind = 'pulse' and at >= since) + count(*) filter (where kind = 'open' and at >= since)
      ) from public.visits),
    'registered',    (select count(*) from public.profiles where role = 'student'),
    'roster',        (select count(*) from public.roster),
    'never_visited', (select count(*) from public.profiles p where p.role = 'student'
                        and not exists (select 1 from public.visits v where v.profile_id = p.id)),
    'daily', (select coalesce(jsonb_agg(jsonb_build_object('d', d, 'opens', opens, 'users', users, 'outside', outside) order by d), '[]'::jsonb)
              from (select (at at time zone 'Asia/Bangkok')::date as d,
                           count(*) filter (where kind = 'open') as opens,
                           count(distinct profile_id) filter (where profile_id is not null) as users,
                           count(distinct vkey) filter (where profile_id is null) as outside
                    from public.visits where at >= since group by 1) x),
    'hours', (select coalesce(jsonb_agg(jsonb_build_object('h', h, 'n', n) order by h), '[]'::jsonb)
              from (select extract(hour from at at time zone 'Asia/Bangkok')::int as h, count(*) as n
                    from public.visits where at >= since and kind = 'open' group by 1) x),
    'pages', (select coalesce(jsonb_agg(jsonb_build_object('page', page, 'n', n) order by n desc), '[]'::jsonb)
              from (select page, count(*) as n from public.visits where at >= since and kind = 'open' group by 1) x),
    'users', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'house_id', p.house_id, 'role', p.role,
                       'opens', s.opens, 'days', s.days, 'minutes', s.minutes, 'last_at', s.last_at, 'first_at', s.first_at,
                       'pwa', s.pwa, 'mobile', s.mobile) order by s.days desc, s.opens desc), '[]'::jsonb)
              from public.profiles p
              join lateral (select count(*) filter (where kind = 'open') as opens,
                                   count(distinct (at at time zone 'Asia/Bangkok')::date) as days,
                                   5 * count(*) filter (where kind = 'pulse') + count(*) filter (where kind = 'open') as minutes,
                                   max(at) as last_at, min(at) as first_at,
                                   bool_or(pwa) as pwa, bool_or(device = 'mobile') as mobile
                            from public.visits v where v.profile_id = p.id and v.at >= since) s on true
              where s.opens > 0 or s.minutes > 0),
    'absent', (select coalesce(jsonb_agg(jsonb_build_object('id', p.id, 'name', p.name, 'house_id', p.house_id,
                        'last_at', (select max(at) from public.visits v where v.profile_id = p.id),
                        'contents', (select count(*) from public.submissions s where s.profile_id = p.id and s.status = 'approved')) order by p.house_id, p.name), '[]'::jsonb)
               from public.profiles p where p.role = 'student'
                 and not exists (select 1 from public.visits v where v.profile_id = p.id and v.at >= d7))
  ) into res;
  return res;
end $fn$;
grant execute on function public.admin_engagement(int) to authenticated;

select public.track_visit('app', 'open', 'migration-selftest', 'desktop', false, null);
delete from public.visits where vkey = 'migration-selftest';
select (public.admin_engagement(30) -> 'totals') as totals_ok;
