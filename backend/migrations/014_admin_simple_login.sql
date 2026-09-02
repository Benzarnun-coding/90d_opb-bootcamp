-- ============================================================
-- ล็อกอินแบบง่าย + หน้าจัดการรายชื่อ (admin.html)
--
-- เปลี่ยนจาก magic link (ติดเพดานอีเมล 2 ฉบับ/ชม.) เป็น อีเมล + รหัสเดียวกันทั้งรุ่น
--   - นักเรียนพิมพ์อีเมล + รหัส → ถ้ายังไม่มีบัญชี ระบบสมัครให้เอง (autoconfirm)
--   - สมัครได้เฉพาะอีเมลที่อยู่ใน roster (เช็คด้วย email_allowed ก่อน)
--
-- หน้า admin.html ให้หัวหน้าโค้ช เพิ่ม / ย้ายบ้าน / ลบ / เตะออก
--
-- ต้องตั้งค่า Auth ใน Supabase ด้วย: mailer_autoconfirm = true
-- รันหลัง 001-013
-- ============================================================

-- ------------------------------------------------------------
-- 1. เช็คว่าอีเมลอยู่ในรายชื่อไหม — anon เรียกได้ก่อนสมัคร
--    คืนแค่ true/false ไม่บอกชื่อ ไม่บอกบ้าน
-- ------------------------------------------------------------
create or replace function public.email_allowed(em text)
returns boolean language sql stable security definer set search_path = public as $fn$
  select exists (select 1 from public.roster where email = em::citext);
$fn$;
grant execute on function public.email_allowed(text) to anon, authenticated;

-- ------------------------------------------------------------
-- 2. ย้ายบ้าน — อัปเดตทั้ง roster และ profiles ของคนที่สมัครแล้ว
--    (policy profiles_update_own ให้แก้ได้แค่แถวตัวเอง เลยต้องผ่านฟังก์ชันนี้)
-- ------------------------------------------------------------
create or replace function public.admin_set_house(em text, hid smallint)
returns void language plpgsql security definer set search_path = public as $fn$
begin
  if not public.is_head_coach() then
    raise exception 'เฉพาะหัวหน้าโค้ชเท่านั้น';
  end if;
  update public.roster set house_id = hid where email = em::citext;
  if not found then
    raise exception 'ไม่พบอีเมล % ในรายชื่อ', em;
  end if;
  update public.profiles p
     set house_id = hid
    from public.roster r
   where r.email = em::citext and p.id = r.claimed_by;
end $fn$;
grant execute on function public.admin_set_house(text, smallint) to authenticated;

-- ------------------------------------------------------------
-- 3. เตะออกจากรุ่น — ลบรายชื่อ + บัญชี + งานทั้งหมดของคนนั้น
--    ถ้าเพิ่มอีเมลกลับเข้ามา เขาสมัครใหม่ได้ (เริ่มจากศูนย์)
-- ------------------------------------------------------------
create or replace function public.admin_kick(em text)
returns void language plpgsql security definer set search_path = public as $fn$
declare uid uuid;
begin
  if not public.is_head_coach() then
    raise exception 'เฉพาะหัวหน้าโค้ชเท่านั้น';
  end if;
  select claimed_by into uid from public.roster where email = em::citext;
  delete from public.roster where email = em::citext;
  if uid is not null then
    if uid = auth.uid() then
      raise exception 'เตะตัวเองไม่ได้';
    end if;
    delete from auth.users where id = uid;   -- cascade → profiles → submissions/pledges/enrollments
  end if;
end $fn$;
grant execute on function public.admin_kick(text) to authenticated;

-- ------------------------------------------------------------
-- 4. ชื่อที่โชว์ในหน้า admin — หัวหน้าโค้ชอ่าน profiles ได้อยู่แล้ว (profiles_read)
--    ไม่ต้องเพิ่ม policy
-- ------------------------------------------------------------

select 'ok' as status,
       public.email_allowed('nobody@example.com') as should_be_false;
