-- ============================================================
-- 046: TA ย้ายบ้านให้นักเรียนที่สมัครเข้าเกมแล้วไม่ได้ ("ย้ายห้องเองไม่ได้")
--
-- อาการ (18 ก.ย.): TA กดย้าย MONEYINLAW จาก DISCIPLINE → COURAGE ในหน้า TA แล้วเด้ง P0001 "ย้ายห้องเองไม่ได้"
-- สาเหตุ: ta_move_student (026) แก้ profiles.house_id ในนามของ TA แต่ trigger lock_house (012)
--        ยอมให้แก้ house_id เฉพาะหัวหน้าโค้ช → ย้ายได้แค่คนที่ "ยังไม่สมัคร" (ไม่มีแถว profiles ให้ชน trigger)
--        ใช้ไม่ได้กับนักเรียนที่เล่นอยู่จริงมาตั้งแต่แรก
-- แก้: ให้ RPC ที่ตรวจสิทธิ์แล้วเปิดธงชั่วคราวในทรานแซกชัน (opb.allow_house_move) แล้ว lock_house ปล่อยผ่านเมื่อเห็นธง
--      ผู้ใช้ตั้งธงเองไม่ได้ เพราะ PostgREST เรียกได้เฉพาะฟังก์ชันใน schema public
-- เพิ่ม: TA ย้ายแล้วล็อกบ้าน (house_locked) เหมือนหัวหน้าโค้ชย้าย ไม่งั้นซิงก์ฟอร์มรอบถัดไป (041) จะย้ายกลับตามฟอร์มเดิม
-- รันหลัง 045
-- ============================================================

create or replace function public.lock_house()
returns trigger language plpgsql security definer set search_path = public as $fn$
begin
  if auth.uid() is null then return new; end if;                                   -- ฝั่งเซิร์ฟเวอร์ / cron
  if coalesce(current_setting('opb.allow_house_move', true), '') = '1' then return new; end if;   -- มาจาก RPC ที่ตรวจสิทธิ์แล้ว
  if new.house_id is distinct from old.house_id and not public.is_head_coach() then
    raise exception 'ย้ายห้องเองไม่ได้';
  end if;
  return new;
end $fn$;

create or replace function public.ta_move_student(em text, hid smallint, code text)
returns void language plpgsql security definer set search_path = public as $fn$
declare r public.roster%rowtype; prole text; nm text;
begin
  if not (public.is_ta() or public.is_head_coach()) then raise exception 'เฉพาะ TA หรือหัวหน้าโค้ชเท่านั้น'; end if;
  if not exists (select 1 from public.houses where id = hid) then raise exception 'ไม่พบบ้านปลายทาง'; end if;
  if not public.login_code_set() then raise exception 'ยังไม่ได้ตั้งรหัสเข้าใช้รวม ให้หัวหน้าโค้ชตั้งในหน้า admin ก่อน'; end if;
  if not public.login_code_ok(code) then raise exception 'รหัสยืนยันไม่ถูกต้อง'; end if;
  select * into r from public.roster where email = em::citext;
  if r.email is null then raise exception 'ไม่พบอีเมลนี้ในรายชื่อ'; end if;
  if public.is_ta() and r.house_id <> public.my_house() then raise exception 'ย้ายได้เฉพาะคนในบ้านของคุณ'; end if;
  if r.role = 'ta' then raise exception 'ย้าย TA ไม่ได้ ให้หัวหน้าโค้ชทำ'; end if;
  if r.claimed_by is not null then
    select role into prole from public.profiles where id = r.claimed_by;
    if prole = 'coach' then raise exception 'ย้ายโค้ช/TA ไม่ได้ ให้หัวหน้าโค้ชทำ'; end if;
  end if;
  if r.house_id = hid then raise exception 'อยู่บ้านนี้อยู่แล้ว'; end if;

  perform set_config('opb.allow_house_move', '1', true);                          -- เฉพาะทรานแซกชันนี้
  update public.roster set house_id = hid, house_locked = true where email = r.email;
  update public.profiles set house_id = hid where id = r.claimed_by and role = 'student';
  perform set_config('opb.allow_house_move', '', true);

  select name into nm from public.profiles where id = auth.uid();
  insert into public.house_moves (email, from_house, to_house, moved_by, note)
  values (r.email, r.house_id, hid, auth.uid(), 'โดย ' || coalesce(nm, 'TA'));
end $fn$;
grant execute on function public.ta_move_student(text, smallint, text) to authenticated;

select 'ta_move_student fixed' as ok;
