-- ============================================================
-- 047: คำขอจากนักเรียนรอบแรก (กล่อง feedback #3 #5)
--   A. ลบงานที่เพิ่งส่งได้ภายใน 30 นาที (เดิม 10 นาที — JEED: "ลบไม่ทัน")
--   B. 👉 สะกิดเพื่อนที่วันนี้ยังไม่ส่งงาน (MONG: "อยากได้ฟีเจอร์กระตุ้นเพื่อนให้ส่ง content")
--      สะกิดได้วันละครั้งต่อคน · ส่งได้ไม่เกิน 5 คนต่อวัน · คนที่ส่งงานแล้ววันนี้สะกิดไม่ได้
--      ผู้ถูกสะกิดเห็นในกระดิ่ง และได้ push ถ้าเปิดแจ้งเตือนไว้ (ใช้ Edge Function push ตัวเดิม)
-- (ไฟเขียวของเป้า 4 ชิ้น — คำขอ #2 — เป็นงานฝั่งหน้าเว็บล้วน ไม่มี SQL)
-- รันหลัง 046
-- ============================================================

-- ---------- A. หน้าต่างลบงาน 30 นาที ----------
drop policy if exists subs_delete_own_recent on public.submissions;
create policy subs_delete_own_recent on public.submissions for delete to authenticated
  using (profile_id = auth.uid() and created_at > now() - interval '30 minutes');

-- ---------- B. สะกิดเพื่อน ----------
create table if not exists public.nudges (
  id         bigint generated always as identity primary key,
  from_id    uuid not null references public.profiles(id) on delete cascade,
  to_id      uuid not null references public.profiles(id) on delete cascade,
  day_index  int  not null,
  created_at timestamptz not null default now(),
  constraint nudge_not_self check (from_id <> to_id),
  unique (from_id, to_id, day_index)
);
create index if not exists nudges_to_day_idx on public.nudges (to_id, day_index);
alter table public.nudges enable row level security;
drop policy if exists nudges_read on public.nudges;
create policy nudges_read on public.nudges for select to anon, authenticated using (true);
grant select on public.nudges to anon, authenticated;
-- เขียนผ่าน RPC เท่านั้น (ไม่มี insert policy)

create or replace function public.nudge(to_pid uuid)
returns void language plpgsql security definer set search_path = public, extensions as $fn$
declare me uuid := auth.uid(); d int := public.day_of(now()); my_name text; cmd text; k text; u text;
begin
  if me is null then raise exception 'ต้องล็อกอินก่อน'; end if;
  if not public.has_started() then raise exception 'รุ่นยังไม่เปิด'; end if;
  if to_pid = me then raise exception 'สะกิดตัวเองไม่ได้'; end if;
  if not exists (select 1 from public.profiles where id = to_pid) then raise exception 'ไม่พบคนนี้'; end if;
  if public.is_vacation_day() then raise exception 'ช่วงปิดเทอม ปล่อยเพื่อนพักก่อน 🏖'; end if;
  if exists (select 1 from public.submissions s where s.profile_id = to_pid and s.day_index = d) then
    raise exception 'เขาส่งงานวันนี้แล้ว 🎉 ไปเชียร์แทนได้เลย';
  end if;
  if exists (select 1 from public.nudges n where n.from_id = me and n.to_id = to_pid and n.day_index = d) then
    raise exception 'วันนี้สะกิดคนนี้ไปแล้ว';
  end if;
  if (select count(*) from public.nudges n where n.from_id = me and n.day_index = d) >= 5 then
    raise exception 'วันนี้สะกิดครบ 5 คนแล้ว';
  end if;

  insert into public.nudges (from_id, to_id, day_index) values (me, to_pid, d);

  -- push ถึงเครื่องเพื่อน (ถ้าเขาเปิดแจ้งเตือนไว้) — ยืม URL + กุญแจจาก cron push-nudge ที่ตั้งไว้แล้ว พลาดก็ไม่เป็นไร
  begin
    select name into my_name from public.profiles where id = me;
    select command into cmd from cron.job where jobname = 'push-nudge' limit 1;
    k := (regexp_match(cmd, '"x-cron-key":"([^"]+)"'))[1];
    u := (regexp_match(cmd, 'url\s*:=\s*''([^'']+)'''))[1];
    if k is not null and u is not null then
      perform net.http_post(
        url     := u,
        headers := jsonb_build_object('Content-Type', 'application/json', 'x-cron-key', k),
        body    := jsonb_build_object('profile_id', to_pid,
                                      'title', '👉 ' || coalesce(my_name, 'เพื่อน') || ' สะกิดคุณ',
                                      'body',  'วันนี้ยังไม่ได้ส่งงานนะ ปล่อยสักชิ้นไหม 💪'));
    end if;
  exception when others then null;
  end;
end $fn$;
revoke execute on function public.nudge(uuid) from public, anon;
grant execute on function public.nudge(uuid) to authenticated;

select 'student requests ready' as ok,
       (select count(*) from pg_policies where policyname = 'subs_delete_own_recent') as delete_policy,
       (select count(*) from information_schema.tables where table_schema = 'public' and table_name = 'nudges') as nudges_table;
