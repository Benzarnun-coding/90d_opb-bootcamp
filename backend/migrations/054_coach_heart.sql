-- ============================================================
-- 054: 💛 กำลังใจจากอาจารย์ (Coach's Heart)
--
-- ที่มา (29 ก.ย.): Benz อยากกดส่งกำลังใจเองให้นักเรียนที่ "กลับมา" ทำต่อได้ 2 วันติด
--   ไม่ใช่ทุกวัน แต่สุ่มนาน ๆ ที (คนละไม่เกินสัปดาห์ละครั้ง) และคนที่ยังไม่เคยได้ ต้องได้ก่อน
-- ระบบคัดคนให้อัตโนมัติ (coach_heart_candidates) · Benz กด "สุ่ม" หรือเลือกเองในหน้า admin แล้วกดส่ง
-- นักเรียนเห็นป๊อปอัปพิเศษตอนเปิดแอป + push (ถ้าเปิดแจ้งเตือน) + กระดิ่ง + ป้าย 💛 ในโปรไฟล์
--
-- เกณฑ์ (นักเรียนเท่านั้น · ตัดคนที่ได้ไปแล้วภายใน 7 วัน):
--   comeback  🌱 ลงงาน 2 วันติด (จบที่วันนี้หรือเมื่อวาน) หลังหายไป ≥ 3 วัน
--   first     🐣 ลงงาน 2 วันติดเป็นครั้งแรกในชีวิตแคมป์ (ก่อนหน้านี้ไม่เคยส่งเลย)
--   steady    🔁 ส่ง ≥ 3 วันใน 7 วันล่าสุด และยังไม่เคยได้กำลังใจจากอาจารย์เลย
-- จำลองกับข้อมูลจริงวันที่ 22–28: comeback ≈ 2 คน/วัน (16 คนใน 7 วัน) · steady 57 คน
-- รันหลัง 053
-- ============================================================

create table if not exists public.coach_hearts (
  id         bigint generated always as identity primary key,
  to_id      uuid not null references public.profiles(id) on delete cascade,
  from_id    uuid references public.profiles(id) on delete set null,
  reason     text not null default 'pick' check (reason in ('comeback','first','steady','pick')),
  message    text not null,
  created_at timestamptz not null default now(),
  seen_at    timestamptz
);
create index if not exists coach_hearts_to_idx on public.coach_hearts (to_id, created_at desc);
alter table public.coach_hearts enable row level security;
drop policy if exists coach_hearts_read on public.coach_hearts;
create policy coach_hearts_read on public.coach_hearts for select to authenticated
  using (to_id = auth.uid() or public.is_head_coach());
grant select on public.coach_hearts to authenticated;

-- จำนวนที่ได้ (โชว์ป้ายในโปรไฟล์ของทุกคน · ไม่เปิดเผยข้อความ)
create or replace view public.v_coach_heart_counts as
select to_id as profile_id, count(*)::int as n from public.coach_hearts group by to_id;
grant select on public.v_coach_heart_counts to anon, authenticated;

-- รายชื่อผู้เข้าข่าย (หัวหน้าโค้ชเท่านั้น)
create or replace function public.coach_heart_candidates()
returns table (profile_id uuid, name text, house_id int, reason text, gap_days int, last7 int,
               received int, last_received timestamptz)
language plpgsql stable security definer set search_path = public as $fn$
declare t int := public.day_of(now());
begin
  if not public.is_head_coach() then raise exception 'เฉพาะหัวหน้าโค้ชเท่านั้น'; end if;
  return query
  with posted as (
    select distinct s.profile_id as pid, s.day_index as d from public.submissions s where s.status = 'approved'
  ),
  st as (
    select p.id, p.name, p.house_id,
      /* วันจบของคู่วันติดล่าสุด: วันนี้ หรือเมื่อวาน */
      case when exists (select 1 from posted x where x.pid = p.id and x.d = t) and exists (select 1 from posted x where x.pid = p.id and x.d = t-1) then t
           when exists (select 1 from posted x where x.pid = p.id and x.d = t-1) and exists (select 1 from posted x where x.pid = p.id and x.d = t-2) then t-1
      end as pair_end,
      (select count(*)::int from posted x where x.pid = p.id and x.d between t-6 and t) as last7,
      (select count(*)::int from public.coach_hearts h where h.to_id = p.id) as received,
      (select max(h.created_at) from public.coach_hearts h where h.to_id = p.id) as last_received
    from public.profiles p where p.role = 'student'
  ),
  cl as (
    select st.*,
      (select max(x.d) from posted x where x.pid = st.id and x.d < st.pair_end - 1) as prev_day
    from st
  )
  select cl.id, cl.name, cl.house_id,
    case when cl.pair_end is not null and cl.prev_day is null then 'first'
         when cl.pair_end is not null and (cl.pair_end - 1) - cl.prev_day - 1 >= 3
              and not exists (select 1 from posted x where x.pid = cl.id and x.d = cl.pair_end - 2) then 'comeback'
         else 'steady' end,
    case when cl.pair_end is not null and cl.prev_day is not null then (cl.pair_end - 1) - cl.prev_day - 1 else null end,
    cl.last7, cl.received, cl.last_received
  from cl
  where (cl.last_received is null or cl.last_received < now() - interval '7 days')
    and (
      (cl.pair_end is not null and cl.prev_day is null)
      or (cl.pair_end is not null and (cl.pair_end - 1) - cl.prev_day - 1 >= 3)
      or (cl.received = 0 and cl.last7 >= 3)
    );
end $fn$;
revoke execute on function public.coach_heart_candidates() from public, anon;
grant execute on function public.coach_heart_candidates() to authenticated;

-- ส่งกำลังใจ (หัวหน้าโค้ชเท่านั้น) · ข้ามคนที่ได้ไปแล้วภายใน 7 วัน · push ถึงเครื่อง
create or replace function public.coach_heart_send(to_ids uuid[], reasons text[], messages text[])
returns int language plpgsql security definer set search_path = public, extensions as $fn$
declare me uuid := auth.uid(); i int; n int := 0; cmd text; k text; u text; rs text; msg text;
begin
  if not public.is_head_coach() then raise exception 'เฉพาะหัวหน้าโค้ชเท่านั้น'; end if;
  select command into cmd from cron.job where jobname = 'push-nudge' limit 1;
  k := (regexp_match(cmd, '"x-cron-key":"([^"]+)"'))[1];
  u := (regexp_match(cmd, 'url\s*:=\s*''([^'']+)'''))[1];
  for i in 1 .. coalesce(array_length(to_ids, 1), 0) loop
    if exists (select 1 from public.coach_hearts h where h.to_id = to_ids[i] and h.created_at > now() - interval '7 days') then continue; end if;
    rs  := coalesce(nullif(reasons[i], ''), 'pick'); if rs not in ('comeback','first','steady','pick') then rs := 'pick'; end if;
    msg := left(coalesce(nullif(btrim(messages[i]), ''), 'อาจารย์กำลังส่งกำลังใจให้คุณ เฝ้ารอดูคุณอยู่นะ 💛'), 400);
    insert into public.coach_hearts (to_id, from_id, reason, message) values (to_ids[i], me, rs, msg);
    n := n + 1;
    begin
      if k is not null and u is not null then
        perform net.http_post(url := u,
          headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', k),
          body    := jsonb_build_object('profile_id', to_ids[i], 'title', '💛 อาจารย์ส่งกำลังใจให้คุณ', 'body', msg));
      end if;
    exception when others then null;
    end;
  end loop;
  perform public.audit('coach_heart.send', n::text, jsonb_build_object('count', n));
  return n;
end $fn$;
revoke execute on function public.coach_heart_send(uuid[], text[], text[]) from public, anon;
grant execute on function public.coach_heart_send(uuid[], text[], text[]) to authenticated;

-- นักเรียนกด "ขอบคุณ" แล้ว = อ่านแล้ว
create or replace function public.coach_heart_seen(hid bigint)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  update public.coach_hearts set seen_at = coalesce(seen_at, now()) where id = hid and to_id = auth.uid();
end $fn$;
revoke execute on function public.coach_heart_seen(bigint) from public, anon;
grant execute on function public.coach_heart_seen(bigint) to authenticated;

select 'coach heart ready' as ok;
