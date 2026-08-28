-- ============================================================
-- ตรวจว่ากติกากันโกงทำงานจริง — ไม่ใช่แค่ซ่อนปุ่มในหน้าเว็บ
-- รันบนโปรเจกต์ทดสอบ หลังรัน 001 + 002 + seed แล้ว
-- ทุกข้อควรขึ้น PASS ถ้ามี FAIL แปลว่ารูรั่ว อย่าเพิ่งเปิดใช้จริง
-- ============================================================
do $$
declare
  stu uuid;
  other uuid;
  cur_sp int;
  sid bigint;
  ok boolean;
begin
  select id into stu   from public.profiles where role = 'student' order by name limit 1;
  select id into other from public.profiles where role = 'student' and id <> stu order by name limit 1;
  cur_sp := (public.day_of(now()) - 1) / (select sprint_days from public.cohort where id = 1);

  -- ให้แน่ใจว่านักเรียนคนนี้ลงสปรินต์ปัจจุบันไว้
  insert into public.enrollments (profile_id, sprint_idx) values (stu, cur_sp)
    on conflict do nothing;

  ---------------------------------------------------------------
  raise notice '--- 1. ส่งงานแล้วนับทันที (ไม่มีระบบตรวจแล้ว) ---';
  insert into public.submissions (profile_id, url, url_key, platform, day_index, sprint_idx, status, stars)
  values (stu, 'https://tiktok.com/@test/smoke-1', 'x', 'TikTok', 1, 0, 'rejected', 3)
  returning id into sid;
  select (status = 'approved') into ok from public.submissions where id = sid;
  raise notice '%  สถานะถูกบังคับเป็น approved แม้จะยัด rejected มา', case when ok then 'PASS' else 'FAIL' end;

  ---------------------------------------------------------------
  raise notice '--- 2. วันที่ต้องคิดจากเซิร์ฟเวอร์ ไม่ใช่ค่าที่ส่งมา ---';
  select (day_index = public.day_of(now())) into ok from public.submissions where id = sid;
  raise notice '%  day_index คิดใหม่ฝั่งเซิร์ฟเวอร์ (ส่งมา 1)', case when ok then 'PASS' else 'FAIL' end;

  ---------------------------------------------------------------
  raise notice '--- 3. ลิงก์ซ้ำต้องส่งไม่ได้ ---';
  begin
    insert into public.submissions (profile_id, url, url_key, platform, day_index, sprint_idx)
    values (other, 'https://tiktok.com/@test/smoke-1', 'x', 'TikTok', 1, 0);
    raise notice 'FAIL  คนอื่นเอาลิงก์เดิมไปส่งซ้ำได้';
  exception when unique_violation then
    raise notice 'PASS  ลิงก์ซ้ำถูกบล็อก';
  end;

  ---------------------------------------------------------------
  raise notice '--- 4. ส่งงานในสปรินต์ที่ไม่ได้ลงต้องไม่ได้ ---';
  delete from public.enrollments where profile_id = other and sprint_idx = cur_sp;
  begin
    insert into public.submissions (profile_id, url, url_key, platform, day_index, sprint_idx)
    values (other, 'https://tiktok.com/@test/smoke-2', 'y', 'TikTok', 1, 0);
    raise notice 'FAIL  ส่งงานได้ทั้งที่ไม่ได้ลงสปรินต์นี้';
  exception when others then
    raise notice 'PASS  ถูกปฏิเสธ (%)', left(SQLERRM, 40);
  end;

  ---------------------------------------------------------------
  raise notice '--- 5. ลงสปรินต์ที่เริ่มไปแล้วไม่ได้ ---';
  begin
    insert into public.enrollments (profile_id, sprint_idx) values (other, cur_sp);
    raise notice 'FAIL  ลงสปรินต์ที่กำลังวิ่งอยู่ได้';
  exception when others then
    raise notice 'PASS  ถูกปฏิเสธ (%)', left(SQLERRM, 40);
  end;

  ---------------------------------------------------------------
  raise notice '--- 6. ธงแดงเมื่อลิงก์ไม่มี handle ของเจ้าตัว ---';
  select flag into ok from public.submissions where id = sid;
  raise notice '%  ติดธงแดงอัตโนมัติ', case when ok then 'PASS' else 'FAIL' end;

  delete from public.submissions where id = sid;
end $$;

-- ============================================================
-- ข้อ 7 ต้องทดสอบในฐานะ "นักเรียนที่ล็อกอินอยู่" เพราะเป็นเรื่อง RLS
-- ============================================================
do $$
declare stu uuid; sid bigint; n int;
begin
  select p.id into stu from public.profiles p where p.role = 'student' order by p.name limit 1;
  select s.id into sid from public.submissions s where s.status = 'approved' limit 1;

  set local role authenticated;
  perform set_config('request.jwt.claims', json_build_object('sub', stu, 'role','authenticated')::text, true);

  raise notice '--- 7. นักเรียนแก้สถานะงานเองไม่ได้ (ลบงานคนอื่น/ปลุกงานตัวเอง) ---';
  update public.submissions set status = 'rejected' where id = sid;
  get diagnostics n = row_count;
  raise notice '%  นักเรียนแก้สถานะไม่ได้ (แก้ได้ % แถว)',
    case when n = 0 then 'PASS' else 'FAIL' end, n;

  raise notice '--- 8. นักเรียนตั้งตัวเองเป็นโค้ชไม่ได้ ---';
  begin
    update public.profiles set role = 'coach' where id = stu;
    get diagnostics n = row_count;
    raise notice '%  เลื่อนตัวเองเป็นโค้ชไม่ได้ (แก้ได้ % แถว)',
      case when n = 0 then 'PASS' else 'FAIL' end, n;
  exception when others then
    raise notice 'PASS  ถูกปฏิเสธ (%)', left(SQLERRM, 40);
  end;

  reset role;
end $$;

-- ============================================================
-- ข้อ 9-12: กติกาคำสัญญารายสัปดาห์ (Phase 3c)
-- ============================================================
do $blk$
declare
  stu uuid;
  cw  int := public.current_week();
  sp  int;
begin
  select id into stu from public.profiles where role = 'student' order by name limit 1;
  sp := public.sprint_of_week(cw);
  insert into public.enrollments (profile_id, sprint_idx) values (stu, sp) on conflict do nothing;
  delete from public.pledges where profile_id = stu and week_no = cw;

  raise notice '--- 9. เลือกคำสัญญาย้อนหลังไม่ได้ ---';
  begin
    insert into public.pledges (profile_id, week_no, target) values (stu, greatest(1, cw - 1), 7);
    raise notice 'FAIL  เลือกย้อนหลังได้';
  exception when others then
    raise notice 'PASS  ถูกปฏิเสธ (%)', left(SQLERRM, 45);
  end;

  raise notice '--- 10. PRO MAX ยังไม่เปิดก่อนสัปดาห์ที่ 7 ---';
  if cw < 7 then
    begin
      insert into public.pledges (profile_id, week_no, target) values (stu, cw, 14);
      raise notice 'FAIL  เลือก 14 ได้ทั้งที่ยังไม่ถึงสัปดาห์ 7';
    exception when others then
      raise notice 'PASS  ถูกปฏิเสธ (%)', left(SQLERRM, 45);
    end;
  else
    raise notice 'SKIP  ตอนนี้สัปดาห์ที่ % แล้ว PRO MAX เปิดแล้ว', cw;
  end if;

  raise notice '--- 11. สัปดาห์ที่กำลังวิ่งอยู่ เพิ่มเป้าได้ ---';
  insert into public.pledges (profile_id, week_no, target) values (stu, cw, 4);
  update public.pledges set target = 10 where profile_id = stu and week_no = cw;
  raise notice 'PASS  เพิ่มจาก 4 เป็น 10 ได้';

  raise notice '--- 12. สัปดาห์ที่กำลังวิ่งอยู่ ลดเป้าไม่ได้ ---';
  begin
    update public.pledges set target = 4 where profile_id = stu and week_no = cw;
    raise notice 'FAIL  ลดเป้ากลางสัปดาห์ได้ คำสัญญาไม่มีความหมาย';
  exception when others then
    raise notice 'PASS  ถูกปฏิเสธ (%)', left(SQLERRM, 45);
  end;

  delete from public.pledges where profile_id = stu and week_no = cw;
end $blk$;

-- ============================================================
-- ข้อ 13: วันหนึ่งส่งหลายชิ้นได้ และต้องนับครบทุกชิ้น
-- ============================================================
do $blk$
declare
  stu uuid;
  d   int := public.day_of(now());
  before_n int; after_n int; i int;
begin
  select id into stu from public.profiles where role = 'student' order by name limit 1;
  select count(*) into before_n from public.v_counted where profile_id = stu and day_index = d;

  for i in 1..6 loop
    insert into public.submissions (profile_id, url, url_key, platform, day_index, sprint_idx)
    values (stu, 'https://tiktok.com/@many/' || i || '-' || clock_timestamp()::text, 'z', 'TikTok', 1, 0);
  end loop;

  select count(*) into after_n from public.v_counted where profile_id = stu and day_index = d;
  raise notice '--- 13. ส่งหลายชิ้นในวันเดียว ---';
  raise notice '%  ส่งเพิ่ม 6 ชิ้น นับเพิ่มได้ % ชิ้น',
    case when after_n - before_n = 6 then 'PASS' else 'FAIL' end, after_n - before_n;

  delete from public.submissions where profile_id = stu and url like '%@many/%';
end $blk$;
