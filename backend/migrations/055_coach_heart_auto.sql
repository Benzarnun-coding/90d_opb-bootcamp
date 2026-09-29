-- ============================================================
-- 055: 💛 กำลังใจจากอาจารย์ — ส่งเองอัตโนมัติ แล้วเก็บ log ไว้ให้ดู
--
-- ที่มา (1 ต.ค.): Benz บอกว่าระบบสุ่มยังต้องกดเองอยู่ ใช้ยาก อยากให้มันรันเอง แค่เก็บ log ไว้
-- ทำงาน: pg_cron ทุกวัน 19:00 ไทย (12:00 UTC) — ก่อนเตือน 20:00 ให้คนที่ได้มีแรงส่งต่อคืนนั้น
--   1. ดึงผู้เข้าข่ายจากเกณฑ์เดิมของ 054 (กลับมาแล้ว / เริ่มครั้งแรก / สม่ำเสมอแต่ยังไม่เคยได้ · ตัดคนที่ได้ภายใน 7 วัน)
--   2. สุ่มแบบถ่วงน้ำหนัก ไม่เกิน N คน/วัน (ค่าเริ่มต้น 2): กลับมาแล้ว/เริ่มครั้งแรกมาก่อน · ยังไม่เคยได้ ×2 · หายนานได้น้ำหนักเพิ่ม
--   3. ส่งในนามหัวหน้าโค้ช (Benz) · ข้อความ = ข้อความหลัก + บรรทัดเหตุผลของแต่ละคน · push ถึงเครื่อง
--   ข้ามวันปิดเทอม · ปิด/เปิด และปรับจำนวนต่อวันได้จากหน้า admin
-- log = ตาราง coach_hearts เดิม (+ คอลัมน์ auto) หน้า admin โชว์ประวัติ ใครได้ เมื่อไหร่ เพราะอะไร เปิดอ่านหรือยัง
-- รันหลัง 054
-- ============================================================

alter table public.coach_hearts add column if not exists auto boolean not null default false;
alter table public.cohort add column if not exists heart_auto boolean not null default true;
alter table public.cohort add column if not exists heart_per_day int not null default 2;
alter table public.cohort add column if not exists heart_from uuid references public.profiles(id) on delete set null;
alter table public.cohort add column if not exists heart_msg text not null default 'อาจารย์กำลังส่งกำลังใจให้คุณ เฝ้ารอดูคุณอยู่นะ 💛';

-- ตั้งผู้ส่งเริ่มต้น = หัวหน้าโค้ชคนแรก (Benz) · ถ้า Benz กดบันทึกการตั้งค่าในหน้า admin จะเป็นตัวเขาเอง
update public.cohort set heart_from = (select id from public.profiles where role = 'coach' and house_id is null order by created_at limit 1)
where id = 1 and heart_from is null;

-- เกณฑ์ (ภายใน · ไม่เช็คสิทธิ์ · เรียกได้จาก cron และจาก coach_heart_candidates)
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
    select p.id, p.name, p.house_id,
      case when exists (select 1 from posted x where x.pid = p.id and x.d = t) and exists (select 1 from posted x where x.pid = p.id and x.d = t-1) then t
           when exists (select 1 from posted x where x.pid = p.id and x.d = t-1) and exists (select 1 from posted x where x.pid = p.id and x.d = t-2) then t-1
      end as pair_end,
      (select count(*)::int from posted x where x.pid = p.id and x.d between t-6 and t) as last7,
      (select count(*)::int from public.coach_hearts h where h.to_id = p.id) as received,
      (select max(h.created_at) from public.coach_hearts h where h.to_id = p.id) as last_received
    from public.profiles p where p.role = 'student'
  ),
  cl as (select st.*, (select max(x.d) from posted x where x.pid = st.id and x.d < st.pair_end - 1) as prev_day from st)
  select cl.id, cl.name, cl.house_id,
    case when cl.pair_end is not null and cl.prev_day is null then 'first'
         when cl.pair_end is not null and (cl.pair_end - 1) - cl.prev_day - 1 >= 3 then 'comeback'
         else 'steady' end,
    case when cl.pair_end is not null and cl.prev_day is not null then (cl.pair_end - 1) - cl.prev_day - 1 else null end,
    cl.last7, cl.received, cl.last_received
  from cl
  where (cl.last_received is null or cl.last_received < now() - interval '7 days')
    and ((cl.pair_end is not null and cl.prev_day is null)
      or (cl.pair_end is not null and (cl.pair_end - 1) - cl.prev_day - 1 >= 3)
      or (cl.received = 0 and cl.last7 >= 3));
end $fn$;
revoke execute on function public.coach_heart_pool() from public, anon, authenticated;

create or replace function public.coach_heart_candidates()
returns table (profile_id uuid, name text, house_id int, reason text, gap_days int, last7 int, received int, last_received timestamptz)
language plpgsql stable security definer set search_path = public as $fn$
begin
  if not public.is_head_coach() then raise exception 'เฉพาะหัวหน้าโค้ชเท่านั้น'; end if;
  return query select * from public.coach_heart_pool();
end $fn$;

-- บรรทัดเหตุผล (ให้ข้อความจาก cron กับจากหน้า admin ตรงกัน)
create or replace function public.coach_heart_why(reason text, gap int, last7 int)
returns text language sql immutable as $$
  select case reason
    when 'comeback' then 'เห็นนะว่ากลับมาลงงาน 2 วันติดแล้ว หลังหายไป ' || gap || ' วัน'
    when 'first'    then 'เห็นว่าเริ่มลงงาน 2 วันติดแล้ว ก้าวแรกสำคัญที่สุด'
    when 'steady'   then 'เห็นความสม่ำเสมอของคุณนะ สัปดาห์นี้ลงไป ' || last7 || ' วันแล้ว'
    else '' end;
$$;

-- ส่งหนึ่งคน (ภายใน) · กันซ้ำภายใน 7 วัน · push
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

-- ส่งเองจากหน้า admin (ยังใช้ได้เหมือนเดิม)
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

-- รอบอัตโนมัติ (cron) · สุ่มถ่วงน้ำหนักแบบ Efraimidis–Spirakis: key = random()^(1/w) เอามากสุด N คน
create or replace function public.coach_heart_auto()
returns int language plpgsql security definer set search_path = public as $fn$
declare c public.cohort%rowtype; r record; n int := 0;
begin
  select * into c from public.cohort where id = 1;
  if not c.heart_auto or coalesce(c.heart_per_day, 0) <= 0 then return 0; end if;
  if public.is_vacation_day() then return 0; end if;
  for r in
    select p.*, public.coach_heart_why(p.reason, p.gap_days, p.last7) as why
    from public.coach_heart_pool() p
    order by power(random(), 1.0 / ((case p.reason when 'comeback' then 5 + least(coalesce(p.gap_days,0),14)/2.0 when 'first' then 5 else 1 end)
                                   * (case when p.received = 0 then 2 else 1 end))) desc
    limit c.heart_per_day
  loop
    if public.coach_heart_put(r.profile_id, c.heart_from, r.reason, c.heart_msg || E'\n' || r.why, true) then n := n + 1; end if;
  end loop;
  perform public.audit('coach_heart.auto', n::text, jsonb_build_object('count', n));
  return n;
end $fn$;
revoke execute on function public.coach_heart_auto() from public, anon, authenticated;

-- ตั้งค่าจากหน้า admin: เปิด/ปิด · จำนวนต่อวัน · ข้อความหลัก · ผู้ส่ง = คนที่กดบันทึก
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
select cron.schedule('coach-heart', '0 12 * * *', $cron$ select public.coach_heart_auto(); $cron$);   -- 19:00 ไทย ทุกวัน

-- เช็ค: ตั้งค่า + ผู้เข้าข่ายตอนนี้ (ยังไม่ได้ส่งจริง รอ 19:00)
select heart_auto, heart_per_day, (select name from public.profiles where id = heart_from) as sender, heart_msg from public.cohort where id = 1;
select reason, count(*) from public.coach_heart_pool() group by reason;
