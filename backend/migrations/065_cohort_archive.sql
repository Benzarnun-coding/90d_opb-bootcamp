-- 065: SNAPSHOT รุ่น (Plan C) — เก็บ "ประวัติรายคนของรุ่นนี้" ไว้ถาวร โดยใช้อีเมลแบบ hash เป็นกุญแจ
-- ที่มา: Benz บอกศิษย์เก่าไม่กลับมาเป็นกลุ่ม แต่บางคนมาเรียนซ้ำ → ต้องมี log เก่าของคนนั้นเก็บไว้ และจำได้ตอนนำเข้ารายชื่อรุ่นใหม่
-- ทำอะไร: 1) ตาราง cohort_archive (หัวรุ่น) + alumni_records (รายคน: ตัวตน, Wrapped, log โพสต์ที่นับคะแนน) · ปิดสิทธิ์ตรงทั้งหมด
--          2) archive_take(ชื่อรุ่น)     หัวหน้าโค้ชถ่าย snapshot (รันซ้ำได้ = ถ่ายใหม่ทับรุ่นชื่อเดิม)
--          3) archive_export(ชื่อรุ่น)   ดึงทั้งก้อนเป็น JSON ไว้ดาวน์โหลดเก็บ (ไฟล์สำรองนอก Supabase)
--          4) archive_import(json)       นำไฟล์นั้นเข้าโปรเจกต์ของรุ่นใหม่ (1 รุ่น = 1 โปรเจกต์ Supabase)
--          5) alumni_match(emails[]) / alumni_lookup(email)   หัวหน้าโค้ชดูว่าใครในรายชื่อเคยเรียนรุ่นไหน
--          6) my_past_cohorts()          นักเรียนที่ล็อกอินอยู่ดูประวัติรุ่นเก่าของตัวเอง (จับคู่ด้วยอีเมลของบัญชีตัวเองเท่านั้น)
-- ไม่แตะข้อมูลเกม · ไม่มี cron · อีเมลจริงไม่ถูกเก็บในตาราง/ไฟล์ (เก็บเฉพาะ sha256 ของอีเมลตัวเล็ก) · รันทั้งไฟล์ได้เลย · รันหลัง 063b

create table if not exists public.cohort_archive (
  label    text primary key,
  taken_at timestamptz not null default now(),
  meta     jsonb not null default '{}'::jsonb,
  people   int not null default 0,
  posts    int not null default 0
);
create table if not exists public.alumni_records (
  email_hash text not null,
  label      text not null references public.cohort_archive(label) on delete cascade,
  name       text,
  handle     text,
  role       text,
  house      text,
  wrapped    jsonb,
  posts      jsonb not null default '[]'::jsonb,   -- [[day, platform, url, epoch, stars, crit], ...]
  primary key (email_hash, label)
);
alter table public.cohort_archive enable row level security;
alter table public.alumni_records enable row level security;
revoke all on public.cohort_archive, public.alumni_records from public, anon, authenticated;

create or replace function public.archive_hash(e text) returns text
language sql immutable as $fn$
  select encode(sha256(convert_to(lower(btrim(e)), 'UTF8')), 'hex')
$fn$;

create or replace function public.archive_take(p_label text) returns jsonb
language plpgsql security definer set search_path = public, auth as $fn$
declare n int; np int;
begin
  if not public.is_head_coach() then raise exception 'เฉพาะหัวหน้าโค้ช'; end if;
  if coalesce(btrim(p_label), '') = '' then raise exception 'ต้องตั้งชื่อรุ่น เช่น รุ่น 1'; end if;
  insert into public.cohort_archive (label, taken_at, meta)
  values (btrim(p_label), now(), jsonb_build_object(
    'cohort', (select jsonb_build_object('name', c.name, 'start_date', c.start_date, 'sprint_days', c.sprint_days, 'sprints', c.sprints, 'cutoff_hour', c.cutoff_hour) from public.cohort c where c.id = 1),
    'houses', (select coalesce(jsonb_agg(to_jsonb(h) order by h.id), '[]'::jsonb) from public.houses h),
    'bosses', (select coalesce(jsonb_agg(to_jsonb(b)), '[]'::jsonb) from public.bosses b),
    'cup',    (select coalesce(jsonb_agg(to_jsonb(x)), '[]'::jsonb) from public.v_house_cup x)))
  on conflict (label) do update set taken_at = excluded.taken_at, meta = excluded.meta;
  delete from public.alumni_records where label = btrim(p_label);   -- ถ่ายซ้ำ = แทนที่ทั้งรุ่น
  insert into public.alumni_records (email_hash, label, name, handle, role, house, wrapped, posts)
  select public.archive_hash(u.email), btrim(p_label), p.name, p.handle, p.role, h.th, w.data, coalesce(po.posts, '[]'::jsonb)
  from public.profiles p
  join auth.users u on u.id = p.id
  left join public.houses h on h.id = p.house_id
  left join public.wrapped_stats w on w.profile_id = p.id
  left join lateral (
    select jsonb_agg(jsonb_build_array(v.day_index, v.platform, v.url, extract(epoch from v.created_at)::bigint, v.stars, s.crit) order by v.created_at) as posts
    from public.v_counted v join public.submissions s on s.id = v.id
    where v.profile_id = p.id) po on true
  where u.email is not null
  on conflict (email_hash, label) do nothing;                      -- กันอีเมลซ้ำ (ไม่น่าเกิด)
  get diagnostics n = row_count;
  select coalesce(sum(jsonb_array_length(posts)), 0) into np from public.alumni_records where label = btrim(p_label);
  update public.cohort_archive set people = n, posts = np where label = btrim(p_label);
  return jsonb_build_object('label', btrim(p_label), 'people', n, 'posts', np,
    'with_wrapped', (select count(*) from public.alumni_records where label = btrim(p_label) and wrapped is not null));
end $fn$;

create or replace function public.archive_export(p_label text) returns jsonb
language plpgsql security definer set search_path = public as $fn$
begin
  if not public.is_head_coach() then raise exception 'เฉพาะหัวหน้าโค้ช'; end if;
  return (select jsonb_build_object('version', 1, 'label', a.label, 'taken_at', a.taken_at, 'meta', a.meta,
      'records', (select coalesce(jsonb_agg(jsonb_build_object('h', r.email_hash, 'name', r.name, 'handle', r.handle, 'role', r.role, 'house', r.house, 'wrapped', r.wrapped, 'posts', r.posts) order by r.name), '[]'::jsonb)
                  from public.alumni_records r where r.label = a.label))
    from public.cohort_archive a where a.label = btrim(p_label));
end $fn$;

create or replace function public.archive_import(doc jsonb) returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare lb text := btrim(doc->>'label'); r jsonb; n int := 0; np int;
begin
  if not public.is_head_coach() then raise exception 'เฉพาะหัวหน้าโค้ช'; end if;
  if lb is null or lb = '' or (doc->'records') is null then raise exception 'ไฟล์ snapshot ไม่ถูกต้อง'; end if;
  insert into public.cohort_archive (label, taken_at, meta)
  values (lb, coalesce((doc->>'taken_at')::timestamptz, now()), coalesce(doc->'meta', '{}'::jsonb))
  on conflict (label) do update set taken_at = excluded.taken_at, meta = excluded.meta;
  delete from public.alumni_records where label = lb;
  for r in select value from jsonb_array_elements(doc->'records') loop
    insert into public.alumni_records (email_hash, label, name, handle, role, house, wrapped, posts)
    values (r->>'h', lb, r->>'name', r->>'handle', r->>'role', r->>'house', nullif(r->'wrapped', 'null'::jsonb), coalesce(r->'posts', '[]'::jsonb))
    on conflict (email_hash, label) do nothing;
    n := n + 1;
  end loop;
  select coalesce(sum(jsonb_array_length(posts)), 0) into np from public.alumni_records where label = lb;
  update public.cohort_archive set people = n, posts = np where label = lb;
  return jsonb_build_object('label', lb, 'people', n, 'posts', np);
end $fn$;

create or replace function public.archive_list() returns jsonb
language plpgsql security definer set search_path = public as $fn$
begin
  if not public.is_head_coach() then raise exception 'เฉพาะหัวหน้าโค้ช'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('label', label, 'taken_at', taken_at, 'people', people, 'posts', posts) order by taken_at) from public.cohort_archive), '[]'::jsonb);
end $fn$;

-- หัวหน้าโค้ช: ส่งรายชื่ออีเมลมา ได้กลับ {อีเมล: [{label, name, house, posts}]} เฉพาะคนที่เคยเรียน
create or replace function public.alumni_match(p_emails text[]) returns jsonb
language plpgsql security definer set search_path = public as $fn$
begin
  if not public.is_head_coach() then raise exception 'เฉพาะหัวหน้าโค้ช'; end if;
  return coalesce((
    select jsonb_object_agg(e.email, e.recs)
    from (
      select m.email, jsonb_agg(jsonb_build_object('label', r.label, 'name', r.name, 'house', r.house, 'posts', jsonb_array_length(r.posts)) order by a.taken_at) as recs
      from unnest(p_emails) as m(email)
      join public.alumni_records r on r.email_hash = public.archive_hash(m.email)
      join public.cohort_archive a on a.label = r.label
      group by m.email) e), '{}'::jsonb);
end $fn$;

-- หัวหน้าโค้ช: เปิดดูประวัติเต็มของอีเมลเดียว
create or replace function public.alumni_lookup(p_email text) returns jsonb
language plpgsql security definer set search_path = public as $fn$
begin
  if not public.is_head_coach() then raise exception 'เฉพาะหัวหน้าโค้ช'; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('label', r.label, 'taken_at', a.taken_at, 'name', r.name, 'handle', r.handle, 'role', r.role, 'house', r.house, 'wrapped', r.wrapped, 'posts', r.posts) order by a.taken_at)
    from public.alumni_records r join public.cohort_archive a on a.label = r.label
    where r.email_hash = public.archive_hash(p_email)), '[]'::jsonb);
end $fn$;

-- นักเรียนที่ล็อกอิน: ดูประวัติรุ่นเก่าของ "ตัวเอง" (อีเมลมาจากบัญชีที่ล็อกอิน ไม่รับพารามิเตอร์)
create or replace function public.my_past_cohorts() returns jsonb
language plpgsql security definer set search_path = public, auth as $fn$
declare em text;
begin
  if auth.uid() is null then return '[]'::jsonb; end if;
  select email into em from auth.users where id = auth.uid();
  if em is null then return '[]'::jsonb; end if;
  return coalesce((select jsonb_agg(jsonb_build_object('label', r.label, 'taken_at', a.taken_at, 'name', r.name, 'house', r.house, 'wrapped', r.wrapped, 'posts', jsonb_array_length(r.posts)) order by a.taken_at)
    from public.alumni_records r join public.cohort_archive a on a.label = r.label
    where r.email_hash = public.archive_hash(em)), '[]'::jsonb);
end $fn$;

revoke execute on function public.archive_hash(text), public.archive_list(), public.archive_take(text), public.archive_export(text), public.archive_import(jsonb),
  public.alumni_match(text[]), public.alumni_lookup(text), public.my_past_cohorts() from public, anon;
grant execute on function public.archive_list(), public.archive_take(text), public.archive_export(text), public.archive_import(jsonb),
  public.alumni_match(text[]), public.alumni_lookup(text), public.my_past_cohorts() to authenticated;
notify pgrst, 'reload schema';

select 'archive ok' as ok,
  (select count(*) from public.cohort_archive) as archives,
  public.archive_hash('Test@Example.com ') = public.archive_hash('test@example.com') as hash_is_case_and_space_proof;

-- ย้อนกลับ (ไม่แตะข้อมูลเกม): drop function public.archive_list(), public.archive_take(text), public.archive_export(text), public.archive_import(jsonb), public.alumni_match(text[]), public.alumni_lookup(text), public.my_past_cohorts(), public.archive_hash(text); drop table public.alumni_records, public.cohort_archive;
