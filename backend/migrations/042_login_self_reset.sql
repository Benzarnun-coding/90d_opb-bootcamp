-- ============================================================
-- 042: เข้าเครื่องใหม่ได้เสมอด้วยรหัสรวมปัจจุบัน (ไม่ต้องให้ทีมงานกด "รีเซ็ตรหัส")
--
-- ที่มา: บัญชีถูกสร้างครั้งแรกด้วยรหัสรวม ณ ตอนนั้น ถ้าทีมงานเปลี่ยนรหัสรวมทีหลัง
--        เครื่องเดิมยังเข้าได้ (session ค้างอยู่) แต่เครื่องใหม่ใส่รหัสใหม่แล้วเข้าไม่ได้
--        ดูเหมือน "เข้าได้เครื่องเดียว" ทั้งที่จริงคือรหัสในบัญชีเป็นรหัสเก่า
-- แก้: ถ้าใส่รหัสรวมปัจจุบันถูก + อีเมลอยู่ในรายชื่อ + มีบัญชีอยู่แล้ว → ตั้งรหัสบัญชีให้เท่ากับรหัสรวมปัจจุบัน
--      (กติกาเดิมของรุ่นคือ "รหัสเดียวทั้งรุ่น" อยู่แล้ว ระดับความปลอดภัยเท่าเดิม แค่ไม่ค้างรหัสเก่า)
--      ใช้กลไกเดียวกับ admin_reset_password ใน 025
-- รันหลัง 041
-- ============================================================

create or replace function public.login_self_reset(em text, c text)
returns boolean language plpgsql security definer set search_path = public, extensions as $fn$
declare cur text; n int;
begin
  em := lower(trim(em)); c := trim(c);
  select code into cur from public.login_code where id = 1;
  if cur is null or c is null or c <> cur then return false; end if;            -- รหัสไม่ตรงรหัสรวมปัจจุบัน
  if not exists (select 1 from public.roster r where lower(r.email) = em) then return false; end if;
  update auth.users set encrypted_password = extensions.crypt(cur, extensions.gen_salt('bf')), updated_at = now()
   where lower(email) = em;
  get diagnostics n = row_count;
  if n = 0 then return false; end if;                                             -- ยังไม่เคยมีบัญชี → หน้าเว็บไป signUp ตามปกติ
  insert into public.audit_log (actor_name, action, target) values ('self-service', 'password.selfreset', em);
  return true;
end $fn$;
grant execute on function public.login_self_reset(text, text) to anon, authenticated;

-- ทดสอบ (ไม่เปลี่ยนอะไร เพราะรหัสผิด): ควรได้ false
select public.login_self_reset('test@example.com', 'wrong-code');
