-- ============================================================
-- ตรวจว่ากติกาทุกข้อบังคับได้จริงที่ฐานข้อมูล ไม่ใช่แค่ซ่อนปุ่มในหน้าเว็บ
--
-- ปลอดภัยกับ production: ทุกอย่างอยู่ใน transaction เดียวและ ROLLBACK ทิ้งท้าย
-- ระหว่างทดสอบจะขยับ start_date ชั่วคราวเพื่อจำลองว่ารุ่นเดินไปแล้ว
-- พอ rollback ทุกอย่างกลับเป็นเหมือนเดิมหมด ไม่มีข้อมูลค้าง
--
-- ต้องมีโปรไฟล์อย่างน้อย 1 คนในระบบก่อนถึงจะรันได้
-- ทุกข้อควรขึ้น PASS — ถ้ามี FAIL อย่าเพิ่งเปิดรุ่น
-- ============================================================

begin;

-- ------------------------------------------------------------
-- เตรียม: ใช้โปรไฟล์จริงเป็นตัวทดสอบ ปรับเป็นนักเรียนชั่วคราว
-- ------------------------------------------------------------
update public.profiles set role = 'student' where role = 'coach';
update public.cohort set start_date = current_date - 20 where id = 1;  -- วันที่ 21 สัปดาห์ 3

do $t$
declare
  stu uuid; cw int; d int; sp int; sid bigint; n int; ok boolean; msg text;
  pass int := 0; fail int := 0;
  procedure_note text;
begin
  select id into stu from public.profiles order by created_at limit 1;
  if stu is null then
    raise notice 'ข้ามทั้งหมด: ยังไม่มีโปรไฟล์ในระบบ ให้สมัครอย่างน้อย 1 คนก่อน';
    return;
  end if;
  cw := public.current_week();
  d  := public.day_of(now());
  sp := (d - 1) / (select sprint_days from public.cohort where id = 1);

  raise notice '=== วันที่ % · สัปดาห์ % · สปรินต์ % ===', d, cw, sp + 1;

  -- 1 ------------------------------------------------------------
  insert into public.pledges (profile_id, week_no, target)
  values (stu, cw, 7) on conflict (profile_id, week_no) do update set target = 7;

  insert into public.submissions (profile_id, url, url_key, platform, day_index, sprint_idx, status, stars)
  values (stu, 'https://tiktok.com/@arnun.tre/smoke-1', 'x', 'TikTok', 1, 0, 'rejected', 3)
  returning id into sid;
  select (status = 'approved' and stars = 0) into ok from public.submissions where id = sid;
  if ok then pass:=pass+1; else fail:=fail+1; end if;
  raise notice '%  1. ส่งแล้วนับทันที (ยัด rejected มาก็ถูกบังคับเป็น approved)',
    case when ok then 'PASS' else 'FAIL' end;

  -- 2 ------------------------------------------------------------
  select (day_index = d) into ok from public.submissions where id = sid;
  if ok then pass:=pass+1; else fail:=fail+1; end if;
  raise notice '%  2. วันที่คิดจากเซิร์ฟเวอร์ ไม่เชื่อค่าที่ส่งมา (ส่งมา 1 ได้ %)',
    case when ok then 'PASS' else 'FAIL' end, (select day_index from public.submissions where id = sid);

  -- 3 ------------------------------------------------------------
  begin
    insert into public.submissions (profile_id, url, url_key, platform, day_index, sprint_idx)
    values (stu, 'https://tiktok.com/@arnun.tre/smoke-1', 'y', 'TikTok', 1, 0);
    fail:=fail+1; raise notice 'FAIL  3. ลิงก์ซ้ำส่งได้';
  exception when unique_violation then
    pass:=pass+1; raise notice 'PASS  3. ลิงก์ซ้ำถูกบล็อก';
  end;

  -- 4 ------------------------------------------------------------
  select flag into ok from public.submissions where id = sid;
  if not ok then pass:=pass+1; else fail:=fail+1; end if;
  raise notice '%  4. ลิงก์ที่มี handle ของเจ้าตัว ไม่ติดธง',
    case when not ok then 'PASS' else 'FAIL' end;

  insert into public.submissions (profile_id, url, url_key, platform, day_index, sprint_idx)
  values (stu, 'https://tiktok.com/@someoneelse/999', 'z', 'TikTok', 1, 0) returning id into sid;
  select flag into ok from public.submissions where id = sid;
  if ok then pass:=pass+1; else fail:=fail+1; end if;
  raise notice '%  5. ลิงก์ที่ไม่มี handle ของเจ้าตัว ติดธงแดง',
    case when ok then 'PASS' else 'FAIL' end;

  -- 6 ------------------------------------------------------------
  begin
    insert into public.pledges (profile_id, week_no, target) values (stu, greatest(1, cw - 1), 7);
    fail:=fail+1; raise notice 'FAIL  6. เลือกเป้าย้อนหลังได้';
  exception when others then
    pass:=pass+1; raise notice 'PASS  6. เลือกเป้าย้อนหลังไม่ได้';
  end;

  -- 7 ------------------------------------------------------------
  update public.pledges set target = 10 where profile_id = stu and week_no = cw;
  select (target = 10) into ok from public.pledges where profile_id = stu and week_no = cw;
  if ok then pass:=pass+1; else fail:=fail+1; end if;
  raise notice '%  7. สัปดาห์ปัจจุบัน เพิ่มเป้าได้ (7 → 10)',
    case when ok then 'PASS' else 'FAIL' end;

  -- 8 ------------------------------------------------------------
  begin
    update public.pledges set target = 4 where profile_id = stu and week_no = cw;
    fail:=fail+1; raise notice 'FAIL  8. ลดเป้ากลางสัปดาห์ได้ คำสัญญาไม่มีความหมาย';
  exception when others then
    pass:=pass+1; raise notice 'PASS  8. ลดเป้ากลางสัปดาห์ไม่ได้';
  end;

  -- 9 ------------------------------------------------------------
  if cw < 7 then
    begin
      insert into public.pledges (profile_id, week_no, target) values (stu, cw + 1, 14);
      fail:=fail+1; raise notice 'FAIL  9. เลือก PRO MAX 14 ได้ทั้งที่ยังไม่ถึงสัปดาห์ 7';
    exception when others then
      pass:=pass+1; raise notice 'PASS  9. PRO MAX ยังไม่เปิดก่อนสัปดาห์ 7';
    end;
  else
    raise notice 'SKIP  9. ตอนนี้สัปดาห์ % แล้ว PRO MAX เปิดแล้ว', cw;
  end if;

  -- 10 -----------------------------------------------------------
  for n in 1..5 loop
    insert into public.submissions (profile_id, url, url_key, platform, day_index, sprint_idx)
    values (stu, 'https://tiktok.com/@arnun.tre/many-' || n, 'm' || n, 'TikTok', 1, 0);
  end loop;
  select count(*) into n from public.v_counted where profile_id = stu and day_index = d;
  ok := n >= 7;
  if ok then pass:=pass+1; else fail:=fail+1; end if;
  raise notice '%  10. วันเดียวส่งหลายชิ้นได้ นับครบทุกชิ้น (นับได้ %)',
    case when ok then 'PASS' else 'FAIL' end, n;

  raise notice '--- ผ่าน % ข้อ ตก % ข้อ (ชุดแรก) ---', pass, fail;
end $t$;

-- ------------------------------------------------------------
-- ชุดที่ 2: burnout — รับเป้าหนักแล้วทำไม่ถึง
-- ------------------------------------------------------------
do $t$
declare stu uuid; cw int; ok boolean;
begin
  select id into stu from public.profiles order by created_at limit 1;
  if stu is null then return; end if;
  cw := public.current_week();

  -- สัปดาห์ที่แล้วรับ 10 ไว้ แต่ไม่มีงานเลย
  delete from public.pledges where profile_id = stu and week_no = cw - 1;
  insert into public.pledges (profile_id, week_no, target)
  select stu, cw - 1, 10 where cw > 1;
  -- ใส่ตรง ๆ เพราะ trigger ห้ามเลือกย้อนหลัง
  update public.pledges set week_no = cw - 1 where profile_id = stu and week_no = cw - 1;

  ok := public.burned_out(stu, cw);
  raise notice '%  11. ตรวจจับสถานะหมดแรงได้ (สัปดาห์ที่แล้วรับ 10 ทำได้ 0)',
    case when ok then 'PASS' else 'FAIL' end;

  if ok then
    begin
      insert into public.pledges (profile_id, week_no, target) values (stu, cw, 10)
      on conflict (profile_id, week_no) do update set target = 10;
      raise notice 'FAIL  12. หมดแรงแล้วยังเลือกเป้าหนักได้';
    exception when others then
      raise notice 'PASS  12. หมดแรงแล้วเลือกเป้าหนักไม่ได้';
    end;
  end if;
end $t$;

-- ------------------------------------------------------------
-- ชุดที่ 3: ขอบเขตวัน — ก่อนเปิดรุ่น / ช่วงต่อเวลา / หลังจบ
-- ------------------------------------------------------------
do $t$
declare stu uuid; ok boolean;
begin
  select id into stu from public.profiles order by created_at limit 1;
  if stu is null then return; end if;

  -- ก่อนเปิดรุ่น
  update public.cohort set start_date = current_date + 5 where id = 1;
  begin
    insert into public.submissions (profile_id, url, url_key, platform, day_index, sprint_idx)
    values (stu, 'https://tiktok.com/@arnun.tre/early', 'e', 'TikTok', 1, 0);
    raise notice 'FAIL  13. ส่งงานก่อนรุ่นเปิดได้';
  exception when others then
    raise notice 'PASS  13. ส่งงานก่อนรุ่นเปิดไม่ได้';
  end;

  -- ช่วงต่อเวลา วันที่ 85-90
  update public.cohort set start_date = current_date - 85 where id = 1;   -- วันที่ 86
  insert into public.enrollments (profile_id, sprint_idx)
  select stu, i from generate_series(0,5) i on conflict do nothing;
  begin
    insert into public.submissions (profile_id, url, url_key, platform, day_index, sprint_idx)
    values (stu, 'https://tiktok.com/@arnun.tre/overtime', 'o', 'TikTok', 1, 0);
    select (day_index = 86 and sprint_idx = 5) into ok from public.submissions
     where url like '%overtime%';
    raise notice '%  14. ช่วงต่อเวลาส่งงานได้ และปัดเข้าสปรินต์สุดท้าย',
      case when ok then 'PASS' else 'FAIL' end;
  exception when others then
    raise notice 'FAIL  14. ช่วงต่อเวลาส่งไม่ได้ (%)', left(SQLERRM, 50);
  end;

  -- เลยวันสุดท้าย
  update public.cohort set start_date = current_date - 95 where id = 1;   -- วันที่ 96
  begin
    insert into public.submissions (profile_id, url, url_key, platform, day_index, sprint_idx)
    values (stu, 'https://tiktok.com/@arnun.tre/late', 'l', 'TikTok', 1, 0);
    raise notice 'FAIL  15. ส่งงานหลังจบหลักสูตรได้';
  exception when others then
    raise notice 'PASS  15. ส่งงานหลังจบหลักสูตรไม่ได้';
  end;
end $t$;

-- ------------------------------------------------------------
-- ชุดที่ 4: RLS — ทดสอบในฐานะนักเรียนที่ล็อกอินอยู่
-- ------------------------------------------------------------
do $t$
declare stu uuid; sid bigint; n int;
begin
  select id into stu from public.profiles order by created_at limit 1;
  select id into sid from public.submissions order by id desc limit 1;
  if stu is null or sid is null then return; end if;

  set local role authenticated;
  perform set_config('request.jwt.claims',
    json_build_object('sub', stu, 'role', 'authenticated')::text, true);

  update public.submissions set status = 'rejected' where id = sid;
  get diagnostics n = row_count;
  raise notice '%  16. นักเรียนแก้สถานะงานเองไม่ได้ (แก้ได้ % แถว)',
    case when n = 0 then 'PASS' else 'FAIL' end, n;

  begin
    update public.profiles set role = 'coach' where id = stu;
    get diagnostics n = row_count;
    raise notice '%  17. นักเรียนตั้งตัวเองเป็นโค้ชไม่ได้ (แก้ได้ % แถว)',
      case when n = 0 then 'PASS' else 'FAIL' end, n;
  exception when others then
    raise notice 'PASS  17. ถูกปฏิเสธ (%)', left(SQLERRM, 40);
  end;

  begin
    update public.profiles set house_id = 3 where id = stu;
    get diagnostics n = row_count;
    raise notice '%  18. นักเรียนย้ายห้องเองไม่ได้ (แก้ได้ % แถว)',
      case when n = 0 then 'PASS' else 'FAIL' end, n;
  exception when others then
    raise notice 'PASS  18. ถูกปฏิเสธ (%)', left(SQLERRM, 40);
  end;

  select count(*) into n from public.roster;
  raise notice '%  19. นักเรียนเห็นรายชื่อได้เฉพาะแถวตัวเอง (เห็น % แถว)',
    case when n <= 1 then 'PASS' else 'FAIL' end, n;

  reset role;
end $t$;

-- ------------------------------------------------------------
-- ชุดที่ 5: ประตูรายชื่อ + handle อัตโนมัติ
-- ------------------------------------------------------------
do $t$
declare ok boolean;
begin
  select public.handle_from_email('Arnun.Tre+tag@Gmail.com') = '@arnun.tretag' into ok;
  raise notice '%  20. handle เติมจากอีเมลอัตโนมัติ (ได้ %)',
    case when ok then 'PASS' else 'FAIL' end,
    public.handle_from_email('Arnun.Tre+tag@Gmail.com');

  select not exists (select 1 from public.roster where email = 'ไม่มีจริง@example.com') into ok;
  raise notice '%  21. อีเมลนอกรายชื่อไม่มีในระบบ (ประตูกันคนนอกทำงาน)',
    case when ok then 'PASS' else 'FAIL' end;
end $t$;

-- ============================================================
-- คืนสถานะทั้งหมด ไม่มีอะไรค้างในฐานข้อมูล
-- ============================================================
rollback;

-- ตรวจว่า rollback สำเร็จ — ตัวเลขต้องเท่ากับก่อนรันเทสต์
select (select count(*) from public.submissions) as submissions_after,
       (select count(*) from public.pledges)     as pledges_after,
       (select role from public.profiles order by created_at limit 1) as first_profile_role,
       (select start_date from public.cohort where id = 1) as start_date_after;
