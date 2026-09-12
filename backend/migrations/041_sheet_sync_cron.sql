-- ============================================================
-- 041: ซิงก์รายชื่อจากฟอร์มสมัคร (Google Sheet) อัตโนมัติทุก 8 ชั่วโมง
--
-- เดิม: backend/functions/sheet-sync (Edge Function) ไม่เคยถูก deploy และไม่มี cron
--       คนที่กรอกฟอร์มหลัง 8 ก.ย. เลยไม่อยู่ในรายชื่อ สมัครเข้าเกมไม่ได้ (เจอ 13 คนเมื่อ 11 ก.ย.)
-- ใหม่: ให้ Postgres ดึง CSV จากชีทเองด้วย pg_net ไม่ต้องพึ่ง Edge Function / secret
--       กติกาเดิมของ sheet-sync: แถวล่าสุดของอีเมลนั้นชนะ · เพิ่มคนที่ยังไม่มี ·
--       ย้ายบ้านตามฟอร์ม ยกเว้น TA และคนที่หัวหน้าโค้ชย้ายเอง (house_locked)
--
-- ก่อนรัน: แชร์ชีทฟอร์มเป็น "ทุกคนที่มีลิงก์ → ผู้ดู" (ไม่งั้น Google ตอบ 401)
-- pg_net ทำงานแบบไม่รอผล จึงแยกเป็น 2 จังหวะ: นาที :00 ยิงขอ · นาที :03 อ่านผลแล้วซิงก์
-- เวลา UTC 0/8/16 = ไทย 07:00 / 15:00 / 23:00
-- รันหลัง 040
-- ============================================================

create extension if not exists pg_net with schema extensions;

create table if not exists public.sheet_sync_req (
  id           bigint primary key,
  requested_at timestamptz not null default now()
);
alter table public.sheet_sync_req enable row level security;

create or replace function public.sheet_sync_fetch() returns bigint
language plpgsql security definer set search_path = public, extensions as $$
declare rid bigint;
begin
  select net.http_get(
    url := 'https://docs.google.com/spreadsheets/d/15vwVv4aKRhzXkiyc_yBaKfBP4E_-z_gYr6E3XVX4dfo/gviz/tq?tqx=out:csv&gid=0',
    timeout_milliseconds := 20000) into rid;
  delete from public.sheet_sync_req;
  insert into public.sheet_sync_req (id) values (rid);
  return rid;
end $$;

create or replace function public.sheet_sync_apply() returns jsonb
language plpgsql security definer set search_path = public, extensions as $$
declare
  rid bigint; st int; body text; line text; em text; up text; hid int;
  added text[] := '{}'; moved text[] := '{}'; rec record; n int := 0;
begin
  select id into rid from public.sheet_sync_req order by requested_at desc limit 1;
  if rid is null then return jsonb_build_object('skip', 'no request'); end if;

  select status_code, content::text into st, body from net._http_response where id = rid;
  if st is null then return jsonb_build_object('skip', 'no response yet'); end if;
  if st <> 200 or body is null or left(ltrim(body), 1) = '<' then
    insert into public.audit_log (actor_name, action, detail)
      values ('sheet-sync', 'sheet.sync.error', jsonb_build_object('status', st, 'hint', 'แชร์ชีทเป็น ทุกคนที่มีลิงก์ → ผู้ดู'));
    delete from public.sheet_sync_req where id = rid;
    return jsonb_build_object('error', st);
  end if;

  -- อีเมล → บ้าน ตามแถวล่าสุด (ไล่ตามลำดับในชีท = ลำดับเวลาที่กรอก)
  create temp table if not exists _sheet (email text primary key, house_id int) on commit drop;
  delete from _sheet;
  for line in select * from regexp_split_to_table(replace(body, E'\r', ''), E'\n') loop
    em := lower((regexp_match(line, '[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}'))[1]);
    if em is null or em = 'jj@gmail.com' then continue; end if;
    up := upper(line);
    hid := case when up like '%WISDOM%' then 1 when up like '%JUSTICE%' then 2
                when up like '%COURAGE%' then 3 when up like '%DISCIPLINE%' then 4 end;
    if hid is null then continue; end if;
    insert into _sheet (email, house_id) values (em, hid)
      on conflict (email) do update set house_id = excluded.house_id;
    n := n + 1;
  end loop;

  for rec in
    select s.email, s.house_id, r.email as r_email, r.house_id as r_house, r.role, r.house_locked, r.claimed_by
    from _sheet s left join public.roster r on lower(r.email) = s.email
  loop
    if rec.r_email is null then
      insert into public.roster (email, house_id) values (rec.email, rec.house_id) on conflict do nothing;
      added := added || (rec.email || ',' || rec.house_id);
    elsif rec.r_house is distinct from rec.house_id and coalesce(rec.role, '') <> 'ta' and not coalesce(rec.house_locked, false) then
      update public.roster set house_id = rec.house_id where email = rec.r_email;
      if rec.claimed_by is not null then
        update public.profiles set house_id = rec.house_id where id = rec.claimed_by and role = 'student';
      end if;
      moved := moved || (rec.email || ',' || rec.r_house || '->' || rec.house_id);
    end if;
  end loop;

  delete from public.sheet_sync_req where id = rid;
  if coalesce(array_length(added, 1), 0) > 0 or coalesce(array_length(moved, 1), 0) > 0 then
    insert into public.audit_log (actor_name, action, detail)
      values ('sheet-sync', 'sheet.sync', jsonb_build_object('added', to_jsonb(added), 'moved', to_jsonb(moved)));
  end if;
  return jsonb_build_object('rows', n, 'added', coalesce(array_length(added, 1), 0), 'moved', coalesce(array_length(moved, 1), 0));
end $$;

revoke execute on function public.sheet_sync_fetch() from public, anon, authenticated;
revoke execute on function public.sheet_sync_apply() from public, anon, authenticated;

select cron.unschedule(jobid) from cron.job where jobname in ('sheet-sync-fetch', 'sheet-sync-apply');
select cron.schedule('sheet-sync-fetch', '0 */8 * * *', $cron$ select public.sheet_sync_fetch(); $cron$);
select cron.schedule('sheet-sync-apply', '3 */8 * * *', $cron$ select public.sheet_sync_apply(); $cron$);

-- ยิงรอบแรกทันที · รอ ~1 นาทีแล้วรัน  select public.sheet_sync_apply();  ควรได้ rows ≈ 320+, added 0, moved 0 (ซิงก์มือไปแล้ว 11 ก.ย.)
select public.sheet_sync_fetch();
select jobid, jobname, schedule from cron.job where jobname like 'sheet-sync%';
