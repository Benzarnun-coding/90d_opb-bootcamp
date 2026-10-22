-- 063b: ฟังก์ชัน Wrapped (รันหลัง 063a)
--  wrapped_put      หัวหน้าโค้ชอัปโหลดสถิติทั้งรุ่น (ทีละก้อน)
--  wrapped_me       นักเรียนอ่านของตัวเอง "เฉพาะเมื่อเปิดสวิตช์แล้ว"
--  wrapped_for      หัวหน้าโค้ชพรีวิวของใครก็ได้ (แม้ยังปิดอยู่)
--  wrapped_set_open เปิด/ปิดให้นักเรียนดู · wrapped_status ดูสถานะ
create or replace function public.wrapped_put(rows jsonb) returns int
language plpgsql security definer set search_path = public as $fn$
declare r jsonb; n int := 0;
begin
  if not public.is_head_coach() then raise exception 'เฉพาะหัวหน้าโค้ช'; end if;
  for r in select value from jsonb_array_elements(rows) loop
    insert into public.wrapped_stats (profile_id, data, built_at) values ((r->>'pid')::uuid, r->'data', now())
    on conflict (profile_id) do update set data = excluded.data, built_at = excluded.built_at;
    n := n + 1;
  end loop;
  return n;
end $fn$;

create or replace function public.wrapped_me() returns jsonb
language plpgsql security definer set search_path = public as $fn$
declare op boolean; d jsonb;
begin
  if auth.uid() is null then return jsonb_build_object('open', false); end if;
  op := coalesce((select wrapped_open from public.cohort where id = 1), false);
  if not op then return jsonb_build_object('open', false); end if;
  d := (select data from public.wrapped_stats where profile_id = auth.uid());
  return jsonb_build_object('open', true, 'data', d);
end $fn$;

create or replace function public.wrapped_for(pid uuid) returns jsonb
language plpgsql security definer set search_path = public as $fn$
begin
  if not public.is_head_coach() then raise exception 'เฉพาะหัวหน้าโค้ช'; end if;
  return jsonb_build_object('open', coalesce((select wrapped_open from public.cohort where id = 1), false),
                            'data', (select data from public.wrapped_stats where profile_id = pid));
end $fn$;

create or replace function public.wrapped_set_open(o boolean) returns boolean
language plpgsql security definer set search_path = public as $fn$
begin
  if not public.is_head_coach() then raise exception 'เฉพาะหัวหน้าโค้ช'; end if;
  update public.cohort set wrapped_open = o where id = 1;
  return o;
end $fn$;

create or replace function public.wrapped_status() returns jsonb
language plpgsql security definer set search_path = public as $fn$
begin
  if not public.is_head_coach() then raise exception 'เฉพาะหัวหน้าโค้ช'; end if;
  return jsonb_build_object('open', coalesce((select wrapped_open from public.cohort where id = 1), false),
    'rows', (select count(*) from public.wrapped_stats), 'built_at', (select max(built_at) from public.wrapped_stats));
end $fn$;

revoke execute on function public.wrapped_put(jsonb), public.wrapped_me(), public.wrapped_for(uuid), public.wrapped_set_open(boolean), public.wrapped_status() from public, anon;
grant execute on function public.wrapped_put(jsonb), public.wrapped_me(), public.wrapped_for(uuid), public.wrapped_set_open(boolean), public.wrapped_status() to authenticated;
notify pgrst, 'reload schema';
select 'wrapped rpc ok' as ok, (public.wrapped_me()) as me_when_not_logged_in;
